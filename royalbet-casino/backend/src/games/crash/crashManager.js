/**
 * backend/src/games/crash/crashManager.js
 *
 * Server-controlled round lifecycle manager.
 *
 * Phases:  BETTING (10s) → RUNNING (multiplier ticks) → CRASHED (3s) → loop
 *
 * Socket.IO events emitted:
 *   'crash:betting'  → { roundId, bettingEndsAt }
 *   'crash:start'    → { roundId }
 *   'crash:tick'     → { multiplier }       (every 100ms)
 *   'crash:end'      → { crashPoint, serverSeed, roundId }
 *   'crash:cashout'  → { userId, username, multiplier, profit }
 *
 * Redis keys:
 *   crash:round:current  → JSON { roundId, phase, crashPoint, startTime, serverSeed }
 *   crash:bets:{roundId} → Hash  userId → JSON { amount, cashedOut, cashoutMult, username }
 *   crash:history         → List (capped at 50)
 *   crash:roundId         → auto-increment counter
 */

import { getRedis } from '../../services/redisService.js';
import {
  generateServerSeed,
  computeCrashPoint,
  getMultiplierAtTime,
  getTimeForMultiplier,
} from './crashEngine.js';

const BETTING_DURATION = 10_000;  // 10 seconds
const POST_CRASH_DELAY = 3_000;   // 3 seconds
const TICK_INTERVAL     = 100;     // 100ms

let io = null;
let tickTimer = null;
let roundTimeout = null;

// ─── Initialise ───────────────────────────────────────────────────────────────
export function initCrashManager(socketIo) {
  io = socketIo;
  startNewRound();
}

// ─── Get current round state from Redis ───────────────────────────────────────
export async function getCurrentRound() {
  const redis = getRedis();
  const raw = await redis.get('crash:round:current');
  return raw ? JSON.parse(raw) : null;
}

// ─── Get current multiplier (server authority) ────────────────────────────────
export function getCurrentMultiplier(round) {
  if (!round || round.phase !== 'RUNNING') return 1.00;
  const elapsed = Date.now() - round.startTime;
  return getMultiplierAtTime(elapsed);
}

// ─── Start new round ─────────────────────────────────────────────────────────
async function startNewRound() {
  const redis = getRedis();

  // Auto-increment round ID
  const roundId = await redis.incr('crash:roundId');

  // Generate crash point BEFORE round (stored hidden in Redis)
  const serverSeed = generateServerSeed();
  const crashPoint = computeCrashPoint(serverSeed, roundId);

  const round = {
    roundId,
    phase: 'BETTING',
    crashPoint,        // hidden — not sent to clients
    serverSeed,        // hidden — revealed after crash
    bettingEndsAt: Date.now() + BETTING_DURATION,
    startTime: null,
  };

  await redis.set('crash:round:current', JSON.stringify(round));

  // Emit betting phase
  io.emit('crash:betting', {
    roundId,
    bettingEndsAt: round.bettingEndsAt,
  });

  console.log(`[Crash] Round #${roundId} — BETTING phase (crashPoint: ${crashPoint}x hidden)`);

  // After betting duration, start running
  roundTimeout = setTimeout(() => startRunning(roundId), BETTING_DURATION);
}

// ─── Start running phase ──────────────────────────────────────────────────────
async function startRunning(roundId) {
  const redis = getRedis();
  const raw = await redis.get('crash:round:current');
  if (!raw) return;

  const round = JSON.parse(raw);
  if (round.roundId !== roundId) return; // stale

  round.phase = 'RUNNING';
  round.startTime = Date.now();
  await redis.set('crash:round:current', JSON.stringify(round));

  io.emit('crash:start', { roundId });
  console.log(`[Crash] Round #${roundId} — RUNNING`);

  // Calculate when crash should happen
  const crashTimeMs = getTimeForMultiplier(round.crashPoint);

  // Set up tick interval (every 100ms)
  tickTimer = setInterval(() => {
    const elapsed = Date.now() - round.startTime;
    const multiplier = getMultiplierAtTime(elapsed);

    // Check if past crash time
    if (elapsed >= crashTimeMs) {
      clearInterval(tickTimer);
      tickTimer = null;
      crashRound(roundId, round.crashPoint);
      return;
    }

    io.emit('crash:tick', { multiplier: +multiplier.toFixed(2) });
  }, TICK_INTERVAL);
}

// ─── Crash the round ──────────────────────────────────────────────────────────
async function crashRound(roundId, crashPoint) {
  const redis = getRedis();
  const raw = await redis.get('crash:round:current');
  if (!raw) return;

  const round = JSON.parse(raw);
  if (round.roundId !== roundId) return;

  round.phase = 'CRASHED';
  await redis.set('crash:round:current', JSON.stringify(round));

  // Reveal server seed
  io.emit('crash:end', {
    roundId,
    crashPoint,
    serverSeed: round.serverSeed,
  });

  console.log(`[Crash] Round #${roundId} — CRASHED at ${crashPoint}x`);

  // Add to history (list, capped at 50)
  await redis.lpush('crash:history', JSON.stringify({
    roundId,
    crashPoint,
    serverSeed: round.serverSeed,
  }));
  await redis.ltrim('crash:history', 0, 49);

  // Cleanup bets key after a delay (keep for queries)
  // Wait post-crash delay then start new round
  roundTimeout = setTimeout(() => startNewRound(), POST_CRASH_DELAY);
}

// ─── Get bet table for a round ────────────────────────────────────────────────
export async function getRoundBets(roundId) {
  const redis = getRedis();
  const raw = await redis.hgetall(`crash:bets:${roundId}`);
  const bets = {};
  for (const [userId, val] of Object.entries(raw)) {
    bets[userId] = JSON.parse(val);
  }
  return bets;
}

// ─── Place a bet (called from controller) ─────────────────────────────────────
export async function placeBet(userId, username, amount) {
  const redis = getRedis();
  const round = await getCurrentRound();

  if (!round || round.phase !== 'BETTING') {
    throw Object.assign(new Error('Not in betting phase'), { status: 400 });
  }

  // Check if already bet this round
  const existing = await redis.hget(`crash:bets:${round.roundId}`, userId);
  if (existing) {
    throw Object.assign(new Error('Already placed a bet this round'), { status: 409 });
  }

  // Store bet
  const betData = { amount, cashedOut: false, cashoutMult: null, username };
  await redis.hset(`crash:bets:${round.roundId}`, userId, JSON.stringify(betData));

  // Set TTL on bets hash (auto-cleanup after 10 min)
  await redis.expire(`crash:bets:${round.roundId}`, 600);

  return { roundId: round.roundId };
}

// ─── Cash out (called from controller) ────────────────────────────────────────
export async function cashOut(userId) {
  const redis = getRedis();
  const round = await getCurrentRound();

  if (!round || round.phase !== 'RUNNING') {
    throw Object.assign(new Error('Not in running phase'), { status: 400 });
  }

  const raw = await redis.hget(`crash:bets:${round.roundId}`, userId);
  if (!raw) {
    throw Object.assign(new Error('No bet placed this round'), { status: 404 });
  }

  const betData = JSON.parse(raw);
  if (betData.cashedOut) {
    throw Object.assign(new Error('Already cashed out'), { status: 409 });
  }

  // Server calculates current multiplier (authoritative)
  const elapsed    = Date.now() - round.startTime;
  const multiplier = getMultiplierAtTime(elapsed);

  // Verify not past crash point
  if (multiplier >= round.crashPoint) {
    throw Object.assign(new Error('Round already crashed'), { status: 400 });
  }

  // Mark cashed out
  betData.cashedOut   = true;
  betData.cashoutMult = +multiplier.toFixed(2);
  await redis.hset(`crash:bets:${round.roundId}`, userId, JSON.stringify(betData));

  const profit  = +(betData.amount * multiplier).toFixed(2);

  // Emit cashout to all clients
  io.emit('crash:cashout', {
    userId,
    username: betData.username,
    multiplier: betData.cashoutMult,
    profit,
  });

  return {
    multiplier: betData.cashoutMult,
    profit,
    amount: betData.amount,
  };
}

// ─── Get history ──────────────────────────────────────────────────────────────
export async function getHistory() {
  const redis = getRedis();
  const raw = await redis.lrange('crash:history', 0, 49);
  return raw.map(r => JSON.parse(r));
}
