/**
 * backend/src/games/crash/crashController.js
 *
 * HTTP routes for Crash game:
 *   POST /bet      — place bet during BETTING phase
 *   POST /cashout  — cash out during RUNNING phase
 *   GET  /history  — last 50 rounds
 *   GET  /state    — current round state + bets
 */

import Joi from 'joi';
import * as wallet from '../../services/walletService.js';
import {
  placeBet,
  cashOut,
  getHistory,
  getCurrentRound,
  getCurrentMultiplier,
  getRoundBets,
} from './crashManager.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function handleError(res, err) {
  const status = err.status || 500;
  const message = (status < 500 || process.env.NODE_ENV !== 'production')
    ? err.message
    : 'Internal server error';
  return res.status(status).json({ error: message });
}

// ─── POST /bet ────────────────────────────────────────────────────────────────
const betSchema = Joi.object({
  amount: Joi.number().integer().min(10).max(5000).required(),
});

export const handleBet = async (req, res) => {
  try {
    const { error, value } = betSchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(422).json({ error: error.details[0].message });

    const userId   = req.user.id;
    const username = req.user.name || req.user.username || 'Player';
    const { amount } = value;

    // Verify balance
    const balanceData = await wallet.getBalance(userId);
    if (Number(balanceData.balance) < amount) {
      return res.status(402).json({ error: 'Insufficient balance' });
    }

    // Deduct tokens
    await wallet.deductTokens(userId, amount, 'CRASH');

    // Place bet in round
    const { roundId } = await placeBet(userId, username, amount);

    const bd = await wallet.getBalance(userId);

    return res.json({
      success: true,
      roundId,
      amount,
      newBalance: Number(bd.balance),
    });
  } catch (err) {
    return handleError(res, err);
  }
};

// ─── POST /cashout ────────────────────────────────────────────────────────────
export const handleCashout = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await cashOut(userId);

    // Credit winnings
    const { newBalance } = await wallet.creditWinnings(userId, result.profit, 'CRASH');

    return res.json({
      success: true,
      multiplier:  result.multiplier,
      profit:      result.profit,
      newBalance:  Number(newBalance),
    });
  } catch (err) {
    return handleError(res, err);
  }
};

// ─── GET /history ─────────────────────────────────────────────────────────────
export const handleHistory = async (_req, res) => {
  try {
    const history = await getHistory();
    return res.json({ history });
  } catch (err) {
    return handleError(res, err);
  }
};

// ─── GET /state ───────────────────────────────────────────────────────────────
export const handleState = async (req, res) => {
  try {
    const round = await getCurrentRound();
    if (!round) return res.json({ phase: 'WAITING' });

    const safe = {
      roundId:       round.roundId,
      phase:         round.phase,
      bettingEndsAt: round.bettingEndsAt,
      startTime:     round.startTime,
      multiplier:    getCurrentMultiplier(round),
    };

    // Include crash point only after crashed
    if (round.phase === 'CRASHED') {
      safe.crashPoint  = round.crashPoint;
      safe.serverSeed  = round.serverSeed;
    }

    // Include current bets
    const bets = await getRoundBets(round.roundId);
    safe.bets = bets;

    return res.json(safe);
  } catch (err) {
    return handleError(res, err);
  }
};
