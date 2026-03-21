/**
 * tests/auth.test.js
 * Jest integration tests for /api/v1/auth routes.
 *
 * Uses supertest against the Express app.
 * Redis & Prisma are mocked so no real DB/cache needed in CI.
 */

import request  from 'supertest';
import bcrypt   from 'bcryptjs';
import jwt      from 'jsonwebtoken';
import { jest } from '@jest/globals';

// ── Environment setup before any imports resolve env vars ─────────────────────
process.env.JWT_SECRET         = 'test_access_secret';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
process.env.NODE_ENV           = 'test';

// ── Mock ioredis ──────────────────────────────────────────────────────────────
const redisStore = new Map();
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    set: jest.fn(async (key, val) => { redisStore.set(key, val); return 'OK'; }),
    get: jest.fn(async (key) => redisStore.get(key) ?? null),
    del: jest.fn(async (key) => { redisStore.delete(key); return 1; }),
    on:  jest.fn(),
    quit: jest.fn(async () => 'OK'),
  }));
});

// ── Mock @prisma/client ───────────────────────────────────────────────────────
const fakeUsers         = new Map();
const fakeWallets       = new Map();
const fakeRefreshTokens = new Map();
const fakeBonuses       = [];

jest.mock('@prisma/client', () => {
  const prisma = {
    user: {
      findFirst:  jest.fn(),
      findUnique: jest.fn(),
      create:     jest.fn(),
      update:     jest.fn(),
    },
    wallet:       { upsert: jest.fn(), create: jest.fn() },
    bonus:        { create:  jest.fn() },
    refreshToken: {
      upsert:      jest.fn(),
      create:      jest.fn(),
      findMany:    jest.fn(),
      deleteMany:  jest.fn(),
    },
    $transaction: jest.fn((ops) => Promise.all(ops)),
  };
  return { PrismaClient: jest.fn(() => prisma) };
});

// ── Mock google-auth-library ──────────────────────────────────────────────────
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn().mockResolvedValue({
      getPayload: () => ({
        sub:     'google-sub-123',
        email:   'google@example.com',
        name:    'Google User',
        picture: 'https://example.com/avatar.jpg',
      }),
    }),
  })),
}));

// ── Import app AFTER mocks are in place ───────────────────────────────────────
let app;
let authRateLimiter;
beforeAll(async () => {
  const mod = await import('../src/index.js');
  app = mod.default;
  const limiterMod = await import('../src/middleware/rateLimiter.js');
  authRateLimiter = limiterMod.authRateLimiter;
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

beforeEach(() => {
  // Reset rate limiter for the default supertest IP so it doesn't leak between suites
  if (authRateLimiter && authRateLimiter.resetKey) {
    authRateLimiter.resetKey('::ffff:127.0.0.1');
  }
});

function makeFakeUser(overrides = {}) {
  return {
    id:           'user-001',
    name:         'Test User',
    email:        'test@example.com',
    phone:        '+919999999999',
    passwordHash: bcrypt.hashSync('Password1', 12),
    role:         'USER',
    isBanned:     false,
    ...overrides,
  };
}

// ─── Register ─────────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/register', () => {
  const validPayload = {
    name:     'Jay Tester',
    email:    'jay@example.com',
    phone:    '+919876543210',
    password: 'Password1',
  };

  beforeEach(() => {
    prisma.user.findFirst.mockResolvedValue(null); // no existing user
    prisma.user.create.mockResolvedValue({ id: 'u1', ...validPayload });
    redisStore.clear();
  });

  test('201 — success: responds with OTP sent message', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(validPayload);
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('OTP sent');
  });

  test('409 — duplicate email/phone returns generic error', async () => {
    prisma.user.findFirst.mockResolvedValue(makeFakeUser());
    const res = await request(app).post('/api/v1/auth/register').send(validPayload);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Invalid credentials');
  });

  test('422 — missing name fails validation', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'a@b.com', phone: '+9199999', password: 'Password1' });
    expect(res.status).toBe(422);
  });
});

// ─── Verify OTP ───────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/verify-otp', () => {
  const phone = '+919876543210';
  const otp   = '123456';

  beforeEach(async () => {
    redisStore.clear();
    const hash = await bcrypt.hash(otp, 12);
    redisStore.set(`otp:${phone}`, hash);

    prisma.user.findUnique.mockResolvedValue(makeFakeUser({ phone }));
    prisma.wallet.upsert.mockResolvedValue({});
    prisma.bonus.create.mockResolvedValue({});
    prisma.refreshToken.upsert.mockResolvedValue({});
    prisma.$transaction.mockResolvedValue([{}, {}]);
  });

  test('200 — success: returns tokens and user', async () => {
    const res = await request(app).post('/api/v1/auth/verify-otp').send({ phone, otp });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.headers['set-cookie'][0]).toMatch(/refreshToken=/);
    expect(res.body.user).toHaveProperty('id');
  });

  test('400 — wrong OTP rejected', async () => {
    const res = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ phone, otp: '000000' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid OTP/i);
  });

  test('400 — expired OTP (key not in Redis)', async () => {
    redisStore.clear(); // simulate TTL expiry
    const res = await request(app).post('/api/v1/auth/verify-otp').send({ phone, otp });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/expired/i);
  });
});

// ─── Login ────────────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/login', () => {
  const fakeUser = makeFakeUser();

  beforeEach(() => {
    prisma.user.findFirst.mockResolvedValue(fakeUser);
    prisma.refreshToken.upsert.mockResolvedValue({});
  });

  test('200 — success with valid credentials', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      emailOrPhone: fakeUser.email,
      password:     'Password1',
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.headers['set-cookie'][0]).toMatch(/refreshToken=/);
  });

  test('401 — wrong password returns generic message', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      emailOrPhone: fakeUser.email,
      password:     'WrongPass1',
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  test('401 — user not found returns same generic message', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    const res = await request(app).post('/api/v1/auth/login').send({
      emailOrPhone: 'nobody@example.com',
      password:     'Password1',
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  test('403 — banned user gets account suspended error', async () => {
    prisma.user.findFirst.mockResolvedValue(makeFakeUser({ isBanned: true }));
    const res = await request(app).post('/api/v1/auth/login').send({
      emailOrPhone: fakeUser.email,
      password:     'Password1',
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/suspended/i);
  });
});

// ─── Rate Limiter ─────────────────────────────────────────────────────────────
describe('Rate limiter — 6th request must be blocked', () => {
  test('returns 429 after 5 requests', async () => {
    // Hit the register endpoint 6 times from same IP (supertest default: 127.0.0.1)
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'u2' });

    const payload = {
      name: 'RL Test', email: 'rl@test.com',
      phone: '+911234567890', password: 'Password1',
    };

    // Fire 6 requests concurrently to save time
    const reqs = Array.from({ length: 6 }).map(() =>
      request(app).post('/api/v1/auth/register').send(payload)
    );
    const results = await Promise.all(reqs);

    // At least one request should be rate-limited
    expect(results.some(r => r.status === 429)).toBe(true);
  }, 15000); // 15 second timeout since bcrypt is slow
});
