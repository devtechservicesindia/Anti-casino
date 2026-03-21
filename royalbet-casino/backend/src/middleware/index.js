// middleware/index.js – Express middleware barrel
// Planned middleware:
//   auth.middleware.js       – verifyAccessToken, verifyRefreshToken, requireRole
//   rateLimit.middleware.js  – per-IP and per-user rate limiting via express-rate-limit
//   validate.middleware.js   – Joi / express-validator request validation wrapper
//   upload.middleware.js     – multer config for KYC / avatar uploads
//   error.middleware.js      – centralised async error handler
