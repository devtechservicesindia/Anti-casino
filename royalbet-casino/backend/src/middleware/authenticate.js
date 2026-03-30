/**
 * middleware/authenticate.js
 * Verifies JWT access token from Authorization header.
 * Attaches decoded user payload to req.user.
 */

import jwt from 'jsonwebtoken';

export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[Auth Debug] Missing or invalid auth header:', authHeader);
    return res.status(401).json({ error: 'Unauthorised' });
  }

  const token = authHeader.slice(7); // strip 'Bearer '

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, email, role }
    next();
  } catch (err) {
    console.log('[Auth Debug] JWT verify error:', err.message, 'Token:', token);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Unauthorised' });
  }
};
