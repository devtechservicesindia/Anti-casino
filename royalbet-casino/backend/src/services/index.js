// services/index.js – service layer barrel
// Services contain all business logic and interact with Prisma / Redis / external APIs.
// Planned services:
//   auth.service.js        – JWT generation, OTP via Twilio, Google OAuth verification
//   user.service.js        – profile CRUD, KYC, GCS file upload
//   game.service.js        – bet validation, RNG, RTP calculation
//   wallet.service.js      – balance management, transaction ledger
//   payment.service.js     – Razorpay order creation & verification
//   redis.service.js       – session cache, rate-limit counters, game state pub/sub
