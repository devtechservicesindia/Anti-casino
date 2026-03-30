/**
 * backend/src/games/blackjack/blackjackController.js
 *
 * Handles all Blackjack routes.
 * Game state stored in Redis key 'bj:session:{userId}' with 30-min TTL.
 *
 * State machine: BETTING → PLAYER_TURN → DEALER_TURN → RESOLVED
 */

import crypto           from 'crypto';
import Joi              from 'joi';
import { PrismaClient } from '@prisma/client';
import { getRedis }     from '../../services/redisService.js';
import * as wallet      from '../../services/walletService.js';
import {
  STATES,
  createGameState,
  evaluateHand,
  isBlackjack,
  canSplit,
  dealerShouldHit,
  resolveHand,
  dealCard,
  RANK_VALUES,
} from './blackjackEngine.js';

const prisma    = new PrismaClient();
const SESSION_TTL = 1800; // 30 minutes

// ─── Helpers ──────────────────────────────────────────────────────────────────
function handleError(res, err) {
  const status = err.status || 500;
  const message = (status < 500 || process.env.NODE_ENV !== 'production')
    ? err.message
    : 'Internal server error';
  return res.status(status).json({ error: message });
}

function bjKey(userId) { return `bj:session:${userId}`; }

async function getSession(redis, userId) {
  const raw = await redis.get(bjKey(userId));
  return raw ? JSON.parse(raw) : null;
}

async function saveSession(redis, userId, state) {
  await redis.set(bjKey(userId), JSON.stringify(state), 'EX', SESSION_TTL);
}

async function deleteSession(redis, userId) {
  await redis.del(bjKey(userId));
}

/**
 * Sanitise state for API response — hide shoe and server seed until resolved.
 */
function sanitiseState(state) {
  const { shoe, serverSeed, ...safe } = state;
  // Hide dealer's second card if still in player turn
  if (state.phase === STATES.PLAYER_TURN) {
    safe.dealerHand = [state.dealerHand[0], { rank: '?', suit: '?' }];
  }
  // Include serverSeed only after resolution (provably fair reveal)
  if (state.phase === STATES.RESOLVED) {
    safe.serverSeed = serverSeed;
  }
  safe.shoeRemaining = shoe ? shoe.length : 0;
  return safe;
}

// ─── Dealer play-out logic ────────────────────────────────────────────────────
function playDealer(state) {
  while (dealerShouldHit(state.dealerHand)) {
    state.dealerHand.push(state.shoe.pop());
  }
}

/** Resolve all player hands against the dealer. */
function resolveAllHands(state) {
  state.phase = STATES.RESOLVED;
  state.outcomes = [];
  state.totalPayout = 0;

  for (let i = 0; i < state.playerHands.length; i++) {
    const result = resolveHand(
      state.playerHands[i],
      state.dealerHand,
      state.handBets[i],
      state.handDoubled[i],
    );
    state.outcomes.push(result);
    state.totalPayout += result.payout;
  }
}

// ─── POST /start ──────────────────────────────────────────────────────────────
const startSchema = Joi.object({
  betAmount: Joi.number().integer().min(10).max(5000).required(),
});

export const handleStart = async (req, res) => {
  try {
    const { error, value } = startSchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(422).json({ error: error.details[0].message });

    const userId = req.user.id;
    const redis  = getRedis();
    const { betAmount } = value;

    // Reject if an active session exists
    const existing = await getSession(redis, userId);
    if (existing && existing.phase !== STATES.RESOLVED) {
      return res.status(409).json({ error: 'Active game in progress. Finish or wait for timeout.' });
    }

    // Verify balance
    const balanceData = await wallet.getBalance(userId);
    if (Number(balanceData.balance) < betAmount) {
      return res.status(402).json({ error: 'Insufficient balance' });
    }

    // Deduct bet
    await wallet.deductTokens(userId, betAmount, 'BLACKJACK');

    // Seeds
    const serverSeed    = crypto.randomBytes(32).toString('hex');
    const clientSeedKey = `client:${userId}`;
    let clientSeed      = await redis.get(clientSeedKey);
    if (!clientSeed) {
      clientSeed = crypto.randomBytes(16).toString('hex');
      await redis.set(clientSeedKey, clientSeed);
    }
    const nonce = await redis.incr(`nonce:${userId}`);

    // Create game state (deals 2+2, checks immediate BJ)
    const state = createGameState(userId, betAmount, serverSeed, clientSeed, nonce);

    // If immediately resolved (natural blackjack), pay out now
    if (state.phase === STATES.RESOLVED) {
      if (state.totalPayout > 0) {
        const { newBalance } = await wallet.creditWinnings(userId, state.totalPayout, 'BLACKJACK');
        state.finalBalance = Number(newBalance);
      } else {
        const bd = await wallet.getBalance(userId);
        state.finalBalance = Number(bd.balance);
      }
      // Save GameSession to DB
      await saveGameSession(userId, state);
    }

    await saveSession(redis, userId, state);
    return res.json(sanitiseState(state));
  } catch (err) {
    return handleError(res, err);
  }
};

// ─── POST /hit ────────────────────────────────────────────────────────────────
export const handleHit = async (req, res) => {
  try {
    const userId = req.user.id;
    const redis  = getRedis();
    const state  = await getSession(redis, userId);
    if (!state) return res.status(404).json({ error: 'No active game' });
    if (state.phase !== STATES.PLAYER_TURN) {
      return res.status(400).json({ error: `Cannot hit in phase: ${state.phase}` });
    }

    const hi = state.activeHandIndex;
    dealCard(state, hi);

    const hand = evaluateHand(state.playerHands[hi]);

    if (hand.busted) {
      state.handStood[hi] = true;
      // Move to next hand or dealer
      await advanceHand(state, redis, userId);
    }

    await saveSession(redis, userId, state);
    return res.json(sanitiseState(state));
  } catch (err) {
    return handleError(res, err);
  }
};

// ─── POST /stand ──────────────────────────────────────────────────────────────
export const handleStand = async (req, res) => {
  try {
    const userId = req.user.id;
    const redis  = getRedis();
    const state  = await getSession(redis, userId);
    if (!state) return res.status(404).json({ error: 'No active game' });
    if (state.phase !== STATES.PLAYER_TURN) {
      return res.status(400).json({ error: `Cannot stand in phase: ${state.phase}` });
    }

    state.handStood[state.activeHandIndex] = true;
    await advanceHand(state, redis, userId);

    await saveSession(redis, userId, state);
    return res.json(sanitiseState(state));
  } catch (err) {
    return handleError(res, err);
  }
};

// ─── POST /double ─────────────────────────────────────────────────────────────
export const handleDouble = async (req, res) => {
  try {
    const userId = req.user.id;
    const redis  = getRedis();
    const state  = await getSession(redis, userId);
    if (!state) return res.status(404).json({ error: 'No active game' });
    if (state.phase !== STATES.PLAYER_TURN) {
      return res.status(400).json({ error: `Cannot double in phase: ${state.phase}` });
    }

    const hi = state.activeHandIndex;

    // Can only double on first 2 cards
    if (state.playerHands[hi].length !== 2) {
      return res.status(400).json({ error: 'Can only double on first 2 cards' });
    }

    // Deduct additional bet
    const addBet = state.handBets[hi];
    const balanceData = await wallet.getBalance(userId);
    if (Number(balanceData.balance) < addBet) {
      return res.status(402).json({ error: 'Insufficient balance to double' });
    }
    await wallet.deductTokens(userId, addBet, 'BLACKJACK');

    state.handDoubled[hi] = true;

    // Deal exactly 1 card then auto-stand
    dealCard(state, hi);
    state.handStood[hi] = true;

    await advanceHand(state, redis, userId);

    await saveSession(redis, userId, state);
    return res.json(sanitiseState(state));
  } catch (err) {
    return handleError(res, err);
  }
};

// ─── POST /split ──────────────────────────────────────────────────────────────
export const handleSplit = async (req, res) => {
  try {
    const userId = req.user.id;
    const redis  = getRedis();
    const state  = await getSession(redis, userId);
    if (!state) return res.status(404).json({ error: 'No active game' });
    if (state.phase !== STATES.PLAYER_TURN) {
      return res.status(400).json({ error: `Cannot split in phase: ${state.phase}` });
    }
    if (state.isSplit) {
      return res.status(400).json({ error: 'Already split once' });
    }

    const hi   = state.activeHandIndex;
    const hand = state.playerHands[hi];

    if (!canSplit(hand)) {
      return res.status(400).json({ error: 'Cannot split — cards are not a pair' });
    }

    // Deduct additional bet for second hand
    const addBet = state.handBets[hi];
    const balanceData = await wallet.getBalance(userId);
    if (Number(balanceData.balance) < addBet) {
      return res.status(402).json({ error: 'Insufficient balance to split' });
    }
    await wallet.deductTokens(userId, addBet, 'BLACKJACK');

    // Split into two hands
    const card1 = hand[0];
    const card2 = hand[1];

    state.playerHands[hi] = [card1, state.shoe.pop()];
    state.playerHands.push([card2, state.shoe.pop()]);
    state.handBets.push(addBet);
    state.handDoubled.push(false);
    state.handStood.push(false);
    state.isSplit = true;
    state.activeHandIndex = 0;

    await saveSession(redis, userId, state);
    return res.json(sanitiseState(state));
  } catch (err) {
    return handleError(res, err);
  }
};

// ─── GET /state ───────────────────────────────────────────────────────────────
export const handleGetState = async (req, res) => {
  try {
    const userId = req.user.id;
    const redis  = getRedis();
    const state  = await getSession(redis, userId);
    if (!state) return res.json({ phase: STATES.BETTING });
    return res.json(sanitiseState(state));
  } catch (err) {
    return handleError(res, err);
  }
};

// ─── Internal: advance to next hand or dealer turn ────────────────────────────
async function advanceHand(state, redis, userId) {
  // Check if there's a next hand (split scenario)
  const nextHand = state.activeHandIndex + 1;
  if (nextHand < state.playerHands.length && !state.handStood[nextHand]) {
    state.activeHandIndex = nextHand;
    return;
  }

  // All hands done — check if all busted
  const allBusted = state.playerHands.every((h, i) => evaluateHand(h).busted);

  if (!allBusted) {
    // Dealer plays
    state.phase = STATES.DEALER_TURN;
    playDealer(state);
  }

  // Resolve
  resolveAllHands(state);

  // Credit winnings
  if (state.totalPayout > 0) {
    const { newBalance } = await wallet.creditWinnings(userId, state.totalPayout, 'BLACKJACK');
    state.finalBalance = Number(newBalance);
  } else {
    const bd = await wallet.getBalance(userId);
    state.finalBalance = Number(bd.balance);
  }

  // Save to DB
  await saveGameSession(userId, state);
}

// ─── Save GameSession to Prisma ───────────────────────────────────────────────
async function saveGameSession(userId, state) {
  const totalBet = state.handBets.reduce((s, b, i) => s + (state.handDoubled[i] ? b * 2 : b), 0);
  const totalWin = state.totalPayout;

  await prisma.gameSession.create({
    data: {
      userId,
      gameType: 'BLACKJACK',
      betAmount: totalBet,
      winAmount: totalWin,
      outcome:   totalWin > totalBet ? 'WIN' : (totalWin > 0 ? 'PARTIAL' : 'LOSS'),
      metadata:  JSON.stringify({
        playerHands: state.playerHands,
        dealerHand:  state.dealerHand,
        outcomes:    state.outcomes,
        serverSeed:  state.serverSeed,
        clientSeed:  state.clientSeed,
        nonce:       state.nonce,
      }),
    },
  });
}
