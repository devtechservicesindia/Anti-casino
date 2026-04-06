/**
 * backend/src/games/roulette/rouletteController.js
 *
 * Handles POST /api/v1/games/roulette/spin
 */

import crypto           from 'crypto';
import Joi              from 'joi';
import { PrismaClient } from '@prisma/client';
import { getRedis }     from '../../services/redisService.js';
import * as wallet      from '../../services/walletService.js';
import {
  validateBet,
  generateWinningNumber,
  evaluateBets,
  getColor,
} from './rouletteEngine.js';

const prisma = new PrismaClient();

// ─── Joi validation schema ────────────────────────────────────────────────────
const betItemSchema = Joi.object({
  type:    Joi.string().valid(
    'straight','split','street','corner',
    'dozen','column','red_black','odd_even','low_high'
  ).required(),
  numbers: Joi.array().items(Joi.number().integer().min(0).max(36)).required(),
  amount:  Joi.number().integer().min(1).required(),
});

const spinSchema = Joi.object({
  bets: Joi.array().items(betItemSchema).min(1).max(50).required(),
});

// ─── Helper ───────────────────────────────────────────────────────────────────
function handleError(res, err) {
  const status = err.status || 500;
  const message = (status < 500 || process.env.NODE_ENV !== 'production')
    ? err.message
    : 'Internal server error';
  return res.status(status).json({ error: message });
}

// ─── POST /api/v1/games/roulette/spin ─────────────────────────────────────────
export const handleSpin = async (req, res) => {
  try {
    // STEP 1: Validate request body
    const { error, value } = spinSchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(422).json({ error: error.details[0].message });

    const { bets } = value;

    // STEP 2: Validate every individual bet using engine rules
    for (const bet of bets) {
      const result = validateBet(bet);
      if (!result.valid) {
        return res.status(422).json({ error: result.error });
      }
    }

    // STEP 3: Calculate total bet
    const totalBet = bets.reduce((sum, b) => sum + b.amount, 0);
    const userId   = req.user.id;
    const redis    = getRedis();

    // STEP 4: Verify wallet balance BEFORE deducting
    const balanceData    = await wallet.getBalance(userId);
    const currentBalance = Number(balanceData.balance);
    if (currentBalance < totalBet) {
      return res.status(402).json({ error: 'Insufficient balance' });
    }

    // STEP 5: Atomically deduct total bet
    const { newBalance: balanceAfterBet } = await wallet.deductTokens(userId, totalBet, 'ROULETTE');

    // STEP 6: Generate server seed
    const serverSeed = crypto.randomBytes(32).toString('hex');

    // STEP 7: Get or generate client seed from Redis
    const clientSeedKey = `client:${userId}`;
    let clientSeed = await redis.get(clientSeedKey);
    if (!clientSeed) {
      clientSeed = crypto.randomBytes(16).toString('hex');
      await redis.set(clientSeedKey, clientSeed);
    }

    // STEP 8: Increment nonce
    const nonceKey = `nonce:${userId}`;
    const nonce    = await redis.incr(nonceKey);

    // STEP 9: Generate winning number
    const winningNumber = generateWinningNumber(serverSeed, clientSeed, nonce);

    // STEP 10: Evaluate all bets
    const { totalWin, betResults } = evaluateBets(bets, winningNumber);

    // STEP 11: Credit winnings if any
    let finalBalance = Number(balanceAfterBet);
    if (totalWin > 0) {
      const { newBalance } = await wallet.creditWinnings(userId, totalWin, 'ROULETTE');
      finalBalance = Number(newBalance);
    }

    // STEP 12: Save GameSession to DB
    await prisma.gameSession.create({
      data: {
        userId,
        gameType: 'ROULETTE',
        betAmount: totalBet,
        winAmount: totalWin,
        result:   totalWin > totalBet ? 'WIN' : (totalWin > 0 ? 'PARTIAL' : 'LOSS'),
        metadata:  JSON.stringify({
          winningNumber,
          color: getColor(winningNumber),
          bets,
          betResults,
          serverSeed,
          clientSeed,
          nonce,
        }),
      },
    });

    // STEP 13: Return result
    return res.json({
      winningNumber,
      color:      getColor(winningNumber),
      totalWin,
      newBalance: finalBalance,
      betResults,
      serverSeed,
      clientSeed,
      nonce,
    });
  } catch (err) {
    return handleError(res, err);
  }
};
