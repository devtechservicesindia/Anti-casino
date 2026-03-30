/**
 * backend/src/games/poker/tableManager.js
 *
 * Texas Hold'em table state machine.
 *
 * PHASES: WAITING → PREFLOP → FLOP → TURN → RIVER → SHOWDOWN
 * Blinds: smallBlind = minBuyIn/20, bigBlind = smallBlind × 2
 * Turn timer: 30s, auto-fold at 0.
 * Side pot calculation for all-in scenarios.
 *
 * State stored in Redis: poker:table:{tableId}
 */

import crypto from 'crypto';
import { getRedis } from '../../services/redisService.js';
import {
  buildDeck,
  shuffleDeck,
  dealCards,
  determineWinners,
} from './pokerEngine.js';

const TABLE_TTL       = 3600;   // 1 hour
const TURN_TIMEOUT    = 30_000; // 30 seconds
const TURN_WARNING    = 10_000; // warn at 10s remaining
const SHOWDOWN_DELAY  = 4_000;  // 4s to show hands

// ─── Default Tables ───────────────────────────────────────────────────────────
const DEFAULT_TABLES = [
  { tableId: 'table_1', name: 'Beginner Table',     maxPlayers: 6, minBuyIn: 200,  maxBuyIn: 1000 },
  { tableId: 'table_2', name: 'Intermediate Table', maxPlayers: 6, minBuyIn: 500,  maxBuyIn: 2500 },
  { tableId: 'table_3', name: 'High Roller Table',  maxPlayers: 6, minBuyIn: 1000, maxBuyIn: 5000 },
];

// In-memory turn timers (per table)
const turnTimers   = new Map();
const warnTimers   = new Map();

// ─── Table key helper ─────────────────────────────────────────────────────────
function tKey(tableId) { return `poker:table:${tableId}`; }

// ─── Get / Save state ─────────────────────────────────────────────────────────
export async function getTable(tableId) {
  const redis = getRedis();
  const raw   = await redis.get(tKey(tableId));
  if (raw) return JSON.parse(raw);

  // Check if it's a default table — init if so
  const def = DEFAULT_TABLES.find(t => t.tableId === tableId);
  if (!def) return null;

  const state = {
    ...def,
    players: [],          // { seatIndex, userId, username, chips, holeCards, folded, allIn, currentBet }
    deck: [],
    communityCards: [],
    pot: 0,
    sidePots: [],
    currentPlayerIndex: -1,
    phase: 'WAITING',     // WAITING | PREFLOP | FLOP | TURN | RIVER | SHOWDOWN
    dealerIndex: 0,
    smallBlind: Math.floor(def.minBuyIn / 20),
    bigBlind: Math.floor(def.minBuyIn / 10),
    currentBet: 0,        // highest bet in current round
    lastRaiseIndex: -1,
    serverSeed: null,
    roundId: 0,
  };

  await saveTable(tableId, state);
  return state;
}

export async function saveTable(tableId, state) {
  const redis = getRedis();
  await redis.set(tKey(tableId), JSON.stringify(state), 'EX', TABLE_TTL);
}

// ─── List tables ──────────────────────────────────────────────────────────────
export async function listTables() {
  const tables = [];
  for (const def of DEFAULT_TABLES) {
    const state = await getTable(def.tableId);
    tables.push({
      tableId:    def.tableId,
      name:       def.name,
      maxPlayers: def.maxPlayers,
      minBuyIn:   def.minBuyIn,
      maxBuyIn:   def.maxBuyIn,
      playerCount: state ? state.players.length : 0,
      phase:      state ? state.phase : 'WAITING',
    });
  }
  return tables;
}

// ─── Join table ───────────────────────────────────────────────────────────────
export async function joinTable(tableId, userId, username, buyIn) {
  const state = await getTable(tableId);
  if (!state) throw Object.assign(new Error('Table not found'), { status: 404 });
  if (state.players.length >= state.maxPlayers) throw Object.assign(new Error('Table full'), { status: 409 });
  if (state.players.find(p => p.userId === userId)) throw Object.assign(new Error('Already at table'), { status: 409 });
  if (buyIn < state.minBuyIn || buyIn > state.maxBuyIn) {
    throw Object.assign(new Error(`Buy-in must be ${state.minBuyIn}-${state.maxBuyIn}`), { status: 400 });
  }

  // Find first available seat
  const takenSeats = new Set(state.players.map(p => p.seatIndex));
  let seat = 0;
  while (takenSeats.has(seat) && seat < state.maxPlayers) seat++;

  state.players.push({
    seatIndex:  seat,
    userId,
    username,
    chips:      buyIn,
    holeCards:  [],
    folded:     false,
    allIn:      false,
    currentBet: 0,
  });

  await saveTable(tableId, state);
  return { state, seat, buyIn };
}

// ─── Leave table ──────────────────────────────────────────────────────────────
export async function leaveTable(tableId, userId) {
  const state = await getTable(tableId);
  if (!state) return { chips: 0 };

  const idx = state.players.findIndex(p => p.userId === userId);
  if (idx === -1) return { chips: 0 };

  const player = state.players[idx];
  const chips = player.chips;

  // If mid-round, fold first
  if (state.phase !== 'WAITING' && state.phase !== 'SHOWDOWN' && !player.folded) {
    player.folded = true;
  }

  state.players.splice(idx, 1);

  // Fix indices
  if (state.currentPlayerIndex >= state.players.length) {
    state.currentPlayerIndex = 0;
  }

  await saveTable(tableId, state);
  return { chips };
}

// ─── Start a new hand ─────────────────────────────────────────────────────────
export async function startHand(tableId, io) {
  const state = await getTable(tableId);
  if (!state) return;

  const activePlayers = state.players.filter(p => p.chips > 0);
  if (activePlayers.length < 2) {
    state.phase = 'WAITING';
    await saveTable(tableId, state);
    io.to(tableId).emit('poker:state', sanitiseForAll(state));
    return;
  }

  // Reset for new hand
  state.roundId++;
  state.serverSeed = crypto.randomBytes(32).toString('hex');
  const clientSeed = `pokerclient_${tableId}`;

  state.deck = buildDeck();
  shuffleDeck(state.deck, state.serverSeed, clientSeed, state.roundId);

  state.communityCards = [];
  state.pot = 0;
  state.sidePots = [];
  state.currentBet = 0;
  state.lastRaiseIndex = -1;

  // Reset players
  for (const p of state.players) {
    p.holeCards = [];
    p.folded = p.chips <= 0; // skip broke players
    p.allIn = false;
    p.currentBet = 0;
  }

  // Move dealer button
  state.dealerIndex = (state.dealerIndex + 1) % state.players.length;

  // Post blinds
  const sbIdx = getNextActive(state, state.dealerIndex);
  const bbIdx = getNextActive(state, sbIdx);

  postBlind(state, sbIdx, state.smallBlind);
  postBlind(state, bbIdx, state.bigBlind);

  state.currentBet = state.bigBlind;

  // Deal 2 hole cards to each active player
  for (const p of state.players) {
    if (!p.folded) {
      p.holeCards = dealCards(state.deck, 2);
    }
  }

  state.phase = 'PREFLOP';
  state.currentPlayerIndex = getNextActive(state, bbIdx);
  state.lastRaiseIndex = bbIdx;

  await saveTable(tableId, state);

  // Emit state (without others' hole cards)
  io.to(tableId).emit('poker:state', sanitiseForAll(state));

  // Send each player their hole cards privately
  for (const p of state.players) {
    if (p.holeCards.length > 0) {
      io.to(tableId).emit('poker:deal', {
        userId: p.userId,
        holeCards: p.holeCards,
      });
    }
  }

  // Start turn timer
  startTurnTimer(tableId, state, io);
}

// ─── Player action ────────────────────────────────────────────────────────────
export async function handleAction(tableId, userId, action, amount, io) {
  const state = await getTable(tableId);
  if (!state || state.phase === 'WAITING' || state.phase === 'SHOWDOWN') {
    throw Object.assign(new Error('No active hand'), { status: 400 });
  }

  const player = state.players[state.currentPlayerIndex];
  if (!player || player.userId !== userId) {
    throw Object.assign(new Error('Not your turn'), { status: 400 });
  }

  clearTurnTimer(tableId);

  const toCall = state.currentBet - player.currentBet;

  switch (action) {
    case 'fold':
      player.folded = true;
      break;

    case 'check':
      if (toCall > 0) throw Object.assign(new Error('Cannot check — must call or raise'), { status: 400 });
      break;

    case 'call': {
      const callAmount = Math.min(toCall, player.chips);
      player.chips -= callAmount;
      player.currentBet += callAmount;
      state.pot += callAmount;
      if (player.chips === 0) player.allIn = true;
      break;
    }

    case 'raise': {
      const raiseTotal = Number(amount);
      if (!raiseTotal || raiseTotal < state.currentBet + state.bigBlind) {
        throw Object.assign(new Error(`Raise must be at least ${state.currentBet + state.bigBlind}`), { status: 400 });
      }
      const needed = raiseTotal - player.currentBet;
      if (needed > player.chips) {
        // All-in
        state.pot += player.chips;
        player.currentBet += player.chips;
        player.chips = 0;
        player.allIn = true;
      } else {
        player.chips -= needed;
        player.currentBet = raiseTotal;
        state.pot += needed;
      }
      state.currentBet = player.currentBet;
      state.lastRaiseIndex = state.currentPlayerIndex;
      break;
    }

    default:
      throw Object.assign(new Error(`Unknown action: ${action}`), { status: 400 });
  }

  await saveTable(tableId, state);

  // Broadcast action
  io.to(tableId).emit('poker:action', {
    userId, action, amount: amount || 0,
    pot: state.pot,
  });

  // Check if only one player remains
  const remaining = state.players.filter(p => !p.folded);
  if (remaining.length === 1) {
    // Winner by fold
    await awardPot(tableId, state, [remaining[0]], io);
    return;
  }

  // Check if betting round is complete
  const nextIdx = getNextActive(state, state.currentPlayerIndex);
  const bettingComplete = isBettingRoundComplete(state, nextIdx);

  if (bettingComplete) {
    await advancePhase(tableId, state, io);
  } else {
    state.currentPlayerIndex = nextIdx;
    await saveTable(tableId, state);
    io.to(tableId).emit('poker:state', sanitiseForAll(state));
    startTurnTimer(tableId, state, io);
  }
}

// ─── Betting round check ─────────────────────────────────────────────────────
function isBettingRoundComplete(state, nextIdx) {
  const active = state.players.filter(p => !p.folded && !p.allIn);
  if (active.length === 0) return true;
  if (active.length === 1 && active[0].currentBet >= state.currentBet) return true;

  // All active players have matched the current bet and action has gone around
  const allMatched = active.every(p => p.currentBet === state.currentBet);
  if (allMatched && nextIdx === state.lastRaiseIndex) return true;
  if (allMatched && state.lastRaiseIndex === -1) return true;

  return false;
}

// ─── Phase advancement ────────────────────────────────────────────────────────
async function advancePhase(tableId, state, io) {
  // Reset current bets for new betting round
  for (const p of state.players) {
    p.currentBet = 0;
  }
  state.currentBet = 0;
  state.lastRaiseIndex = -1;

  const active = state.players.filter(p => !p.folded);
  const canAct = active.filter(p => !p.allIn);

  switch (state.phase) {
    case 'PREFLOP':
      state.phase = 'FLOP';
      state.communityCards.push(...dealCards(state.deck, 3));
      io.to(tableId).emit('poker:community', { phase: 'FLOP', cards: state.communityCards });
      break;
    case 'FLOP':
      state.phase = 'TURN';
      state.communityCards.push(...dealCards(state.deck, 1));
      io.to(tableId).emit('poker:community', { phase: 'TURN', cards: state.communityCards });
      break;
    case 'TURN':
      state.phase = 'RIVER';
      state.communityCards.push(...dealCards(state.deck, 1));
      io.to(tableId).emit('poker:community', { phase: 'RIVER', cards: state.communityCards });
      break;
    case 'RIVER':
      // Go to showdown
      await doShowdown(tableId, state, io);
      return;
  }

  // If only 1 player can act (rest all-in), skip to showdown
  if (canAct.length <= 1) {
    // Deal remaining community cards
    while (state.communityCards.length < 5) {
      state.communityCards.push(...dealCards(state.deck, 1));
    }
    io.to(tableId).emit('poker:community', { phase: state.phase, cards: state.communityCards });
    await doShowdown(tableId, state, io);
    return;
  }

  // Set next player (left of dealer)
  state.currentPlayerIndex = getNextActive(state, state.dealerIndex);
  // Skip all-in players
  while (state.players[state.currentPlayerIndex]?.allIn) {
    state.currentPlayerIndex = getNextActive(state, state.currentPlayerIndex);
  }

  await saveTable(tableId, state);
  io.to(tableId).emit('poker:state', sanitiseForAll(state));
  startTurnTimer(tableId, state, io);
}

// ─── Showdown ─────────────────────────────────────────────────────────────────
async function doShowdown(tableId, state, io) {
  state.phase = 'SHOWDOWN';

  const active = state.players.filter(p => !p.folded);

  // Reveal all hands
  const showdownData = active.map(p => ({
    userId:    p.userId,
    username:  p.username,
    holeCards: p.holeCards,
  }));
  io.to(tableId).emit('poker:showdown', { players: showdownData, communityCards: state.communityCards });

  // Determine winners
  const { winners, handName } = determineWinners(active, state.communityCards);
  const winnerPlayers = active.filter(p => winners.includes(p.userId));

  // Award pot (split if tied)
  await awardPot(tableId, state, winnerPlayers, io, handName);
}

// ─── Award pot ────────────────────────────────────────────────────────────────
async function awardPot(tableId, state, winnerPlayers, io, handName = 'Winner by fold') {
  const share = Math.floor(state.pot / winnerPlayers.length);

  for (const wp of winnerPlayers) {
    const player = state.players.find(p => p.userId === wp.userId);
    if (player) player.chips += share;

    io.to(tableId).emit('poker:winner', {
      winnerId: wp.userId,
      username: wp.username,
      amount:   share,
      handName,
    });
  }

  state.pot = 0;
  state.phase = 'SHOWDOWN';
  clearTurnTimer(tableId);

  await saveTable(tableId, state);
  io.to(tableId).emit('poker:state', sanitiseForAll(state));

  // After delay, start new hand
  setTimeout(() => startHand(tableId, io), SHOWDOWN_DELAY);
}

// ─── Turn Timer ───────────────────────────────────────────────────────────────
function startTurnTimer(tableId, state, io) {
  clearTurnTimer(tableId);

  const player = state.players[state.currentPlayerIndex];
  if (!player) return;

  // Warning at 10s
  warnTimers.set(tableId, setTimeout(() => {
    io.to(tableId).emit('poker:timer-warning', {
      userId: player.userId,
      secondsLeft: 10,
    });
  }, TURN_TIMEOUT - TURN_WARNING));

  // Auto-fold at 0
  turnTimers.set(tableId, setTimeout(() => {
    handleAction(tableId, player.userId, 'fold', 0, io).catch(console.error);
  }, TURN_TIMEOUT));

  // Emit timer start
  io.to(tableId).emit('poker:timer', {
    userId: player.userId,
    duration: TURN_TIMEOUT,
    startedAt: Date.now(),
  });
}

function clearTurnTimer(tableId) {
  if (turnTimers.has(tableId)) { clearTimeout(turnTimers.get(tableId)); turnTimers.delete(tableId); }
  if (warnTimers.has(tableId)) { clearTimeout(warnTimers.get(tableId)); warnTimers.delete(tableId); }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function postBlind(state, idx, amount) {
  const player = state.players[idx];
  if (!player) return;
  const actual = Math.min(amount, player.chips);
  player.chips -= actual;
  player.currentBet = actual;
  state.pot += actual;
  if (player.chips === 0) player.allIn = true;
}

function getNextActive(state, fromIndex) {
  const n = state.players.length;
  let idx = (fromIndex + 1) % n;
  let loop = 0;
  while (loop < n) {
    if (!state.players[idx].folded && state.players[idx].chips >= 0) return idx;
    idx = (idx + 1) % n;
    loop++;
  }
  return fromIndex;
}

/**
 * Sanitise state for broadcast — hide other players' hole cards.
 */
export function sanitiseForAll(state) {
  return {
    tableId:          state.tableId,
    name:             state.name,
    maxPlayers:       state.maxPlayers,
    minBuyIn:         state.minBuyIn,
    phase:            state.phase,
    pot:              state.pot,
    communityCards:   state.communityCards,
    currentBet:       state.currentBet,
    currentPlayerIndex: state.currentPlayerIndex,
    dealerIndex:      state.dealerIndex,
    smallBlind:       state.smallBlind,
    bigBlind:         state.bigBlind,
    roundId:          state.roundId,
    players: state.players.map(p => ({
      seatIndex:  p.seatIndex,
      userId:     p.userId,
      username:   p.username,
      chips:      p.chips,
      folded:     p.folded,
      allIn:      p.allIn,
      currentBet: p.currentBet,
      hasCards:   p.holeCards.length > 0 && !p.folded,
      // Hole cards only revealed during showdown
      holeCards:  state.phase === 'SHOWDOWN' && !p.folded ? p.holeCards : [],
    })),
  };
}
