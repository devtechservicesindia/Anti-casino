/**
 * backend/src/middleware/requireAdmin.js
 * Must be used AFTER authenticate middleware.
 * Checks req.user.role === 'ADMIN', else returns 403.
 */

export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};
