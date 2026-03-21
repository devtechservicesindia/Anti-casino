/**
 * middleware/rateLimiter.js
 * 5 requests per 15 minutes per IP on all auth routes.
 */

import rateLimit from 'express-rate-limit';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP. Please try again after 15 minutes.',
  },
  // Use the real IP behind reverse proxies (Cloud Run / Firebase)
  keyGenerator: (req) => req.ip,
});
