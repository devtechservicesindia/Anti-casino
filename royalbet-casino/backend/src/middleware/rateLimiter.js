/**
 * middleware/rateLimiter.js
 *
 * authRateLimiter  — 5 req / 15 min / IP on auth routes (login, register, OTP)
 * walletRateLimiter — 30 req / 1 min / IP on wallet routes (create-order, verify-payment)
 * spinRateLimiter  — 60 req / 1 min / IP on game spin routes
 */

import rateLimit from 'express-rate-limit';

// ── Auth routes — strict (prevents brute-force attacks) ──────────────────────
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP. Please try again after 15 minutes.',
  },
  keyGenerator: (req) => req.ip,
});

// ── Wallet routes — moderate (prevents payment abuse) ─────────────────────────
export const walletRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many wallet requests. Please slow down.',
  },
  keyGenerator: (req) => req.ip,
});

// ── Game/spin routes — generous (prevents automation, allows real play) ────────
export const spinRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Spinning too fast. Please wait a moment.',
  },
  keyGenerator: (req) => req.ip,
});
