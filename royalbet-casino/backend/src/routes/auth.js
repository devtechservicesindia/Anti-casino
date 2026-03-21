/**
 * routes/auth.js
 * All auth routes — prefixed /api/v1/auth in src/index.js
 *
 * Rate limit:  5 req / 15 min / IP (applies to every route here)
 * Validation:  Joi schema via validate() middleware
 * Auth check:  authenticate middleware on protected routes only
 */

import { Router } from 'express';
import Joi from 'joi';

import { authRateLimiter } from '../middleware/rateLimiter.js';
import { validate }        from '../middleware/validate.js';
import { authenticate }    from '../middleware/authenticate.js';
import * as ctrl           from '../controllers/authController.js';

const router = Router();

// Apply rate limiter to every route in this router
router.use(authRateLimiter);

// ─── Joi Schemas ─────────────────────────────────────────────────────────────

const registerSchema = Joi.object({
  name:     Joi.string().trim().min(2).max(80).required(),
  email:    Joi.string().email().lowercase().required(),
  phone:    Joi.string().pattern(/^\+?[0-9]{10,15}$/).required()
              .messages({ 'string.pattern.base': 'phone must be 10-15 digits' }),
  password: Joi.string().min(8).max(128)
              .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
              .required()
              .messages({ 'string.pattern.base': 'Password must contain upper, lower, and digit' }),
});

const verifyOtpSchema = Joi.object({
  phone: Joi.string().pattern(/^\+?[0-9]{10,15}$/).required(),
  otp:   Joi.string().pattern(/^\d{6}$/).required()
            .messages({ 'string.pattern.base': 'OTP must be exactly 6 digits' }),
});

const loginSchema = Joi.object({
  emailOrPhone: Joi.string().required(),
  password:     Joi.string().required(),
});

const googleSchema = Joi.object({
  googleToken: Joi.string().required(),
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

/** POST /api/v1/auth/register */
router.post('/register',     validate(registerSchema),  ctrl.register);

/** POST /api/v1/auth/verify-otp */
router.post('/verify-otp',   validate(verifyOtpSchema), ctrl.verifyOtp);

/** POST /api/v1/auth/login */
router.post('/login',        validate(loginSchema),     ctrl.login);

/** POST /api/v1/auth/google */
router.post('/google',       validate(googleSchema),    ctrl.googleLogin);

/** POST /api/v1/auth/refresh-token */
router.post('/refresh-token', validate(refreshSchema),  ctrl.refreshToken);

/** POST /api/v1/auth/logout — requires valid access token */
router.post('/logout', authenticate, ctrl.logout);

export default router;
