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
    if (result.refreshToken) {
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });
    }
    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

// ─── Login ────────────────────────────────────────────────────────────────────
export const login = async (req, res) => {
  try {
    const result = await authService.login(req.body);
    if (result.refreshToken) {
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });
    }
    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

// ─── Google OAuth ─────────────────────────────────────────────────────────────
export const googleLogin = async (req, res) => {
  try {
    const result = await authService.googleLogin(req.body);
    if (result.refreshToken) {
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });
    }
    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

// ─── Refresh Token ────────────────────────────────────────────────────────────
export const refreshToken = async (req, res) => {
  try {
    // Check cookies first, fallback to body
    const tokenInput = req.cookies?.refreshToken || req.body.refreshToken;
    const authServiceInput = typeof req.body === 'object' && req.body.refreshToken ? req.body : { refreshToken: tokenInput };
    
    if (!tokenInput) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const ObjectInputWithToken = { ...req.body, refreshToken: tokenInput }; // if auth service takes object

    const result = await authService.refreshAccessToken(ObjectInputWithToken);
    if (result.refreshToken) {
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });
    }
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
    
    // Pass refresh token too if needed by service
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    
    await authService.logout({ userId: req.user.id, token, tokenExp, refreshToken });

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    return handleError(res, err);
  }
};
