/**
 * backend/src/games/slots/slotsController.js
 *
 * Handles POST /spin and GET /jackpot for the slots game.
 */

import crypto           from 'crypto';
import Joi              from 'joi';
import { PrismaClient } from '@prisma/client';
import { getRedis }     from '../../services/redisService.js';
import * as wallet      from '../../services/walletService.js';
import { spin }         from './slotsEngine.js';

const prisma = new PrismaClient();

// ─── Joi validation schema ────────────────────────────────────────────────────
const spinSchema = Joi.object({
  betAmount: Joi.number().integer().min(10).max(500).required(),
});

// ─── Helper ───────────────────────────────────────────────────────────────────
function handleError(res, err) {
  const status = err.status || 500;
  const message = (status < 500 || process.env.NODE_ENV !== 'production')
    ? err.message
    : 'Internal server error';
  return res.status(status).json({ error: message });
}

// ─── POST /api/v1/games/slots/spin ───────────────────────────────────────────
export const handleSpin = async (req, res) => {
  try {
    // STEP 1: Validate betAmount
    const { error, value } = spinSchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(422).json({ error: error.details[0].message });

    const { betAmount } = value;
    const userId = req.user.id;
    const redis  = getRedis();

    // STEP 2: Verify wallet balance BEFORE deducting
    const balanceData = await wallet.getBalance(userId);
    const currentBalance = Number(balanceData.balance);
    if (currentBalance < betAmount) {
      return res.status(402).json({ error: 'Insufficient balance' });
    }

    // STEP 3: Atomically deduct bet tokens
    const { newBalance: balanceAfterBet } = await wallet.deductTokens(userId, betAmount, 'SLOTS');

    // STEP 4: Generate server seed
    const serverSeed = crypto.randomBytes(32).toString('hex');

    // STEP 5: Get or generate client seed from Redis
    const clientSeedKey = `client:${userId}`;
    let clientSeed = await redis.get(clientSeedKey);
    if (!clientSeed) {
      clientSeed = crypto.randomBytes(16).toString('hex');
      await redis.set(clientSeedKey, clientSeed); // persists until user rotates it
    }

    // STEP 6: Increment nonce
    const nonceKey = `nonce:${userId}`;
    const nonce = await redis.incr(nonceKey);

    // STEP 7: Generate 3×3 grid + STEP 8: Evaluate paylines
    const { grid, winAmount, winningLines } = spin({ serverSeed, clientSeed, nonce, betAmount });

    // STEP 9: Credit winnings if any
    let finalBalance = Number(balanceAfterBet);
    if (winAmount > 0) {
      const { newBalance } = await wallet.creditWinnings(userId, winAmount, 'SLOTS');
      finalBalance = Number(newBalance);
    }

    // STEP 10: Save GameSession to DB
    await prisma.gameSession.create({
      data: {
        userId,
        gameType: 'SLOTS',
        betAmount,
        winAmount,
        outcome:  winAmount > betAmount ? 'WIN' : (winAmount > 0 ? 'PARTIAL' : 'LOSS'),
        metadata: JSON.stringify({ grid, winningLines, serverSeed, clientSeed, nonce }),
      },
    });

    // STEP 11: Increment jackpot by 1% of betAmount
    const jackpotKey = 'jackpot:slots';
    const exists = await redis.exists(jackpotKey);
    if (!exists) await redis.set(jackpotKey, '1000000'); // seed at 1,000,000
    await redis.incrbyfloat(jackpotKey, betAmount * 0.01);

    // STEP 12: Return result
    return res.json({
      grid,
      winAmount,
      winningLines,
      newBalance:   finalBalance,
      serverSeed,   // revealed AFTER the spin (provably fair)
      clientSeed,
      nonce,
    });
  } catch (err) {
    return handleError(res, err);
  }
};

// ─── GET /api/v1/games/slots/jackpot ─────────────────────────────────────────
export const getJackpot = async (req, res) => {
  try {
    const redis      = getRedis();
    const jackpotKey = 'jackpot:slots';
    const exists     = await redis.exists(jackpotKey);
    if (!exists) await redis.set(jackpotKey, '1000000');
    const raw = await redis.get(jackpotKey);
    return res.json({ jackpot: parseFloat(raw) });
  } catch (err) {
    return handleError(res, err);
  }
};
