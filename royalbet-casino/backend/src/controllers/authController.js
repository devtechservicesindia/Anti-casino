/**
 * controllers/authController.js
 * Thin HTTP layer — delegates all logic to authService.
 * Never exposes stack traces or internal error details.
 */

import * as authService from '../services/authService.js';

// ─── Helper ───────────────────────────────────────────────────────────────────
const handleError = (res, err) => {
  const status = err.status || 500;
  // Never expose internals in production
  const message =
    status < 500
      ? err.message
      : 'An internal error occurred. Please try again.';
  return res.status(status).json({ error: message });
};

// ─── Register ─────────────────────────────────────────────────────────────────
export const register = async (req, res) => {
  try {
    const result = await authService.register(req.body);
    return res.status(201).json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

// ─── Verify OTP ───────────────────────────────────────────────────────────────
export const verifyOtp = async (req, res) => {
  try {
    const result = await authService.verifyOtp(req.body);
    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

// ─── Login ────────────────────────────────────────────────────────────────────
export const login = async (req, res) => {
  try {
    const result = await authService.login(req.body);
    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

// ─── Google OAuth ─────────────────────────────────────────────────────────────
export const googleLogin = async (req, res) => {
  try {
    const result = await authService.googleLogin(req.body);
    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

// ─── Refresh Token ────────────────────────────────────────────────────────────
export const refreshToken = async (req, res) => {
  try {
    const result = await authService.refreshAccessToken(req.body);
    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

// ─── Logout (protected) ───────────────────────────────────────────────────────
export const logout = async (req, res) => {
  try {
    const token    = req.headers.authorization?.slice(7);
    const tokenExp = req.user?.exp; // from JWT payload via authenticate middleware
    await authService.logout({ userId: req.user.id, token, tokenExp });
    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    return handleError(res, err);
  }
};
