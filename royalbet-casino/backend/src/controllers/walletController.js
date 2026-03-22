/**
 * controllers/walletController.js
 * Thin HTTP layer — delegates all logic to walletService.
 * Never exposes stack traces or internal error details.
 */

import * as walletService from '../services/walletService.js';

// ─── Helper ───────────────────────────────────────────────────────────────────
const handleError = (res, err) => {
  const status  = err.status || 500;
  const message = status < 500
    ? err.message
    : 'An internal error occurred. Please try again.';
  return res.status(status).json({ error: message });
};

// ─── GET /wallet/balance ──────────────────────────────────────────────────────
export const getBalance = async (req, res) => {
  try {
    const data = await walletService.getBalance(req.user.id);
    return res.json(data);
  } catch (err) {
    return handleError(res, err);
  }
};

// ─── GET /wallet/packages ─────────────────────────────────────────────────────
export const getPackages = async (_req, res) => {
  try {
    const packages = await walletService.getPackages();
    return res.json({ packages });
  } catch (err) {
    return handleError(res, err);
  }
};

// ─── GET /wallet/transactions ─────────────────────────────────────────────────
export const getTransactions = async (req, res) => {
  try {
    const { page, limit, type } = req.query;
    const data = await walletService.getTransactions(req.user.id, { page, limit, type });
    return res.json(data);
  } catch (err) {
    return handleError(res, err);
  }
};

// ─── POST /wallet/create-order ────────────────────────────────────────────────
export const createOrder = async (req, res) => {
  try {
    const order = await walletService.createTokenOrder(req.user.id, req.body);
    return res.status(201).json(order);
  } catch (err) {
    return handleError(res, err);
  }
};

// ─── POST /wallet/verify-payment ─────────────────────────────────────────────
export const verifyPayment = async (req, res) => {
  try {
    const result = await walletService.verifyPayment(req.user.id, req.body);
    return res.json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

// ─── POST /wallet/daily-bonus ─────────────────────────────────────────────────
export const claimDailyBonus = async (req, res) => {
  try {
    const result = await walletService.claimDailyBonus(req.user.id);
    return res.json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

// ─── POST /wallet/hourly-bonus ────────────────────────────────────────────────
export const claimHourlyBonus = async (req, res) => {
  try {
    const result = await walletService.claimHourlyBonus(req.user.id);
    return res.json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

// ─── GET /wallet/bonus-status ─────────────────────────────────────────────────
export const getBonusStatus = async (req, res) => {
  try {
    const result = await walletService.getBonusStatus(req.user.id);
    return res.json(result);
  } catch (err) {
    return handleError(res, err);
  }
};
