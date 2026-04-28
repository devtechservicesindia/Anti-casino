/**
 * services/authService.js
 * All auth business logic — no HTTP primitives (req/res) here.
 * OTP sending: console.log only (Twilio integration deferred to later phase).
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import { getRedis } from './redisService.js';

const prisma = new PrismaClient();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ─── Constants ────────────────────────────────────────────────────────────────
const BCRYPT_ROUNDS     = 12;
const OTP_TTL_SECONDS   = 300; // 5 minutes
const ACCESS_TOKEN_TTL  = '7d';
const REFRESH_TOKEN_TTL = '30d';
const WELCOME_TOKENS    = 500;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a cryptographically safe 6-digit numeric OTP */
function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Sign a JWT access token (7d) */
function signAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

/** Sign a JWT refresh token (30d) */
function signRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
}

/** Build the standard token pair and store hashed refresh token in DB */
async function issueTokens(user) {
  const payload = { id: user.id, email: user.email, role: user.role };
  const accessToken  = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  // Use 8 rounds for refresh-token hash (stored server-side only — 12 is overkill and slow)
  const hashedRefresh = await bcrypt.hash(refreshToken, 8);

  // Atomic delete-then-create — works whether or not a row already exists
  await prisma.$transaction([
    prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
    prisma.refreshToken.create({
      data: {
        userId:    user.id,
        token:     hashedRefresh,
        expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      },
    }),
  ]);

  return { accessToken, refreshToken };
}

/** Safe user shape to return to clients */
function safeUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

// ─── 1. Register ──────────────────────────────────────────────────────────────
export async function register({ name, email, phone, password }) {
  // Check duplicates
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { phone }] },
  });
  if (existing) {
    // Generic message — never reveal which field conflicts
    throw Object.assign(new Error('An account with that email or phone already exists. Please log in.'), { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // Create user
  const user = await prisma.user.create({
    data: { name, email, phone, passwordHash, role: 'USER' },
  });

  // ── DEV MODE: skip OTP when Redis is not available ──────────────────────────
  // In production, REDIS_URL must be set, which activates real OTP via Twilio.
  if (!process.env.REDIS_URL) {
    console.log(`\n[DEV] Redis not configured — auto-verifying registration for ${email}\n`);

    // Provision wallet + welcome bonus atomically
    await prisma.$transaction([
      prisma.wallet.create({
        data: { userId: user.id, balance: WELCOME_TOKENS, totalPurchased: 0, totalSpent: 0 },
      }),
      prisma.bonus.create({
        data: { userId: user.id, type: 'WELCOME', tokensGiven: WELCOME_TOKENS, streakDay: null },
      }),
    ]);

    const { accessToken, refreshToken } = await issueTokens(user);
    // Return tokens directly so the frontend can log the user in immediately
    return { accessToken, refreshToken, user: safeUser(user), devMode: true };
  }

  // ── PRODUCTION: send OTP via Redis + Twilio (real flow) ────────────────────
  const otp    = generateOtp();
  const otpHash = await bcrypt.hash(otp, BCRYPT_ROUNDS);
  const redis   = getRedis();
  await redis.set(`otp:${phone}`, otpHash, 'EX', OTP_TTL_SECONDS);

  // Print OTP to console (Twilio integration deferred)
  console.log(`\n[OTP] Phone: ${phone}  OTP: ${otp}  (TTL: ${OTP_TTL_SECONDS}s)\n`);

  return { message: 'OTP sent' };
}


// ─── 2. Verify OTP ────────────────────────────────────────────────────────────
export async function verifyOtp({ phone, otp }) {
  const redis   = getRedis();
  const otpHash = await redis.get(`otp:${phone}`);

  if (!otpHash) {
    throw Object.assign(new Error('OTP expired or not found'), { status: 400 });
  }

  const valid = await bcrypt.compare(String(otp), otpHash);
  if (!valid) {
    throw Object.assign(new Error('Invalid OTP'), { status: 400 });
  }

  // Delete OTP from Redis immediately
  await redis.del(`otp:${phone}`);

  // Find user by phone
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  // Atomic: create Wallet + Welcome Bonus
  await prisma.$transaction([
    prisma.wallet.upsert({
      where:  { userId: user.id },
      update: {},
      create: { userId: user.id, balance: WELCOME_TOKENS, totalPurchased: 0, totalSpent: 0 },
    }),
    prisma.bonus.create({
      data: { userId: user.id, type: 'WELCOME', tokensGiven: WELCOME_TOKENS, streakDay: null },
    }),
  ]);

  const { accessToken, refreshToken } = await issueTokens(user);
  return { accessToken, refreshToken, user: safeUser(user) };
}

// ─── 3. Login ─────────────────────────────────────────────────────────────────
export async function login({ emailOrPhone, password }) {
  // Find by email OR phone
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: emailOrPhone }, { phone: emailOrPhone }],
    },
  });

  // Generic error — never reveal which field is wrong
  if (!user) {
    throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash || '');
  if (!passwordMatch) {
    throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  }

  if (user.isBanned) {
    throw Object.assign(new Error('Account suspended'), { status: 403 });
  }

  const { accessToken, refreshToken } = await issueTokens(user);
  return { accessToken, refreshToken, user: safeUser(user) };
}

export async function googleLogin({ googleToken }) {
  let googleId, email, name, avatarUrl;

  // DEV MODE: Skip Google verification if no client ID is provided
  if (!process.env.GOOGLE_CLIENT_ID || googleToken.startsWith('mock_')) {
    console.log(`\n[DEV] Bypassing Google OAuth — using fixed demo account\n`);
    // Always return the SAME fixed demo account so data persists across logins
    googleId  = 'dev_google_demo_user_001';
    email     = 'dev.demo@royalbet.dev';
    name      = 'Demo Player';
    avatarUrl = 'https://ui-avatars.com/api/?name=Demo+Player&background=FFD700&color=000&bold=true';
  } else {
    // Verify ID token with Google
    const ticket = await googleClient.verifyIdToken({
      idToken:  googleToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    googleId = payload.sub;
    email = payload.email;
    name = payload.name;
    avatarUrl = payload.picture;
  }

  // Find or create user
  let user = await prisma.user.findFirst({
    where: { OR: [{ googleId }, { email }] },
  });

  let isNew = false;
  if (!user) {
    user = await prisma.user.create({
      data: { googleId, email, name, avatarUrl, role: 'USER' },
    });
    isNew = true;
  } else if (!user.googleId) {
    // Existing email user — link Google ID
    user = await prisma.user.update({
      where: { id: user.id },
      data:  { googleId, avatarUrl: avatarUrl || user.avatarUrl },
    });
  }

  if (user.isBanned) {
    throw Object.assign(new Error('Account suspended'), { status: 403 });
  }

  // New user: provision wallet + welcome bonus
  if (isNew) {
    await prisma.$transaction([
      prisma.wallet.create({
        data: { userId: user.id, balance: WELCOME_TOKENS, totalPurchased: 0, totalSpent: 0 },
      }),
      prisma.bonus.create({
        data: { userId: user.id, type: 'WELCOME', tokensGiven: WELCOME_TOKENS, streakDay: null },
      }),
    ]);
  }

  const { accessToken, refreshToken } = await issueTokens(user);
  return { accessToken, refreshToken, user: safeUser(user) };
}

// ─── 5. Refresh Token ─────────────────────────────────────────────────────────
export async function refreshAccessToken({ refreshToken }) {
  // Verify JWT signature + expiry
  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw Object.assign(new Error('Invalid refresh token'), { status: 401 });
  }

  // Find stored token records for user
  const storedTokens = await prisma.refreshToken.findMany({
    where: { userId: payload.id },
  });

  if (!storedTokens.length) {
    throw Object.assign(new Error('Invalid refresh token'), { status: 401 });
  }

  // Compare against all stored hashes (user may have multiple sessions)
  let matched = false;
  for (const stored of storedTokens) {
    if (await bcrypt.compare(refreshToken, stored.token)) {
      matched = true;
      break;
    }
  }
  if (!matched) {
    throw Object.assign(new Error('Invalid refresh token'), { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: payload.id } });
  if (!user || user.isBanned) {
    throw Object.assign(new Error('Unauthorised'), { status: 401 });
  }

  const accessToken = signAccessToken({ id: user.id, email: user.email, role: user.role });
  return { accessToken };
}

// ─── 6. Logout ────────────────────────────────────────────────────────────────
export async function logout({ userId, token, tokenExp }) {
  // Blacklist the access token in Redis until its natural expiry
  const redis = getRedis();
  const ttl   = Math.max(tokenExp - Math.floor(Date.now() / 1000), 1);
  await redis.set(`blacklist:${token}`, '1', 'EX', ttl);

  // Remove all refresh tokens for this user (full logout from all devices)
  await prisma.refreshToken.deleteMany({ where: { userId } });
}
