/**
 * routes/wallet.js
 * Wallet API routes.
 * All routes except GET /packages require JWT authentication.
 */

import { Router } from 'express';
import { authenticate }   from '../middleware/authenticate.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import {
  getBalance,
  getPackages,
  getTransactions,
  createOrder,
  verifyPayment,
  claimDailyBonus,
  claimHourlyBonus,
  getBonusStatus,
} from '../controllers/walletController.js';

const router = Router();

// ── Public ────────────────────────────────────────────────────────────────────
// GET /api/v1/wallet/packages — no auth required (marketing page)
router.get('/packages', getPackages);

// ── All routes below require valid JWT ────────────────────────────────────────
router.use(authenticate);

// GET  /api/v1/wallet/balance
router.get('/balance', getBalance);

// GET  /api/v1/wallet/transactions?page=1&limit=10&type=all
router.get('/transactions', getTransactions);

// POST /api/v1/wallet/create-order
router.post('/create-order', createOrder);

// POST /api/v1/wallet/verify-payment
router.post('/verify-payment', verifyPayment);

// POST /api/v1/wallet/daily-bonus
router.post('/daily-bonus', claimDailyBonus);

// POST /api/v1/wallet/hourly-bonus
router.post('/hourly-bonus', claimHourlyBonus);

// GET /api/v1/wallet/bonus-status
router.get('/bonus-status', getBonusStatus);

export default router;
