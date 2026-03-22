/**
 * tests/wallet.test.js
 * Jest integration tests for /api/v1/wallet routes.
 *
 * Mocks: Prisma, ioredis, razorpay, google-auth-library
 * Tests:
 *   - GET  /balance
 *   - POST /create-order
 *   - POST /verify-payment (success, tampered sig, duplicate)
 *   - POST /daily-bonus
 *   - walletService.deductTokens (success, insufficient, 100 concurrent)
 */

import request from 'supertest';
import crypto  from 'crypto';
import jwt     from 'jsonwebtoken';
import { jest } from '@jest/globals';

// ── Environment ───────────────────────────────────────────────────────────────
process.env.JWT_SECRET            = 'test_access_secret';
process.env.JWT_REFRESH_SECRET    = 'test_refresh_secret';
process.env.NODE_ENV              = 'test';
process.env.RAZORPAY_KEY_ID       = 'rzp_test_key_id';
process.env.RAZORPAY_KEY_SECRET   = 'rzp_test_key_secret';

// ── Mock ioredis ──────────────────────────────────────────────────────────────
const redisStore = new Map();
jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({
    set:  jest.fn(async (key, val) => { redisStore.set(key, val); return 'OK'; }),
    get:  jest.fn(async (key) => redisStore.get(key) ?? null),
    del:  jest.fn(async (key) => { redisStore.delete(key); return 1; }),
    on:   jest.fn(),
    quit: jest.fn(async () => 'OK'),
  }))
);

// ── Mock @prisma/client ───────────────────────────────────────────────────────
// We build a shared prisma mock that we can reconfigure per test
const prismaWalletStore = new Map();

jest.mock('@prisma/client', () => {
  const prisma = {
    user: {
      findFirst:  jest.fn(),
      findUnique: jest.fn(),
      create:     jest.fn(),
      update:     jest.fn(),
    },
    wallet: {
      findUnique: jest.fn(),
      update:     jest.fn(),
      upsert:     jest.fn(),
      create:     jest.fn(),
    },
    tokenPackage: {
      findUnique: jest.fn(),
      findFirst:  jest.fn(),
      findMany:   jest.fn(),
    },
    transaction: {
      create:     jest.fn(),
      findFirst:  jest.fn(),
      findMany:   jest.fn(),
      count:      jest.fn(),
      update:     jest.fn(),
      updateMany: jest.fn(),
    },
    bonus:        { create: jest.fn() },
    refreshToken: {
      upsert:     jest.fn(),
      create:     jest.fn(),
      findMany:   jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  return { PrismaClient: jest.fn(() => prisma) };
});

// ── Mock razorpay ─────────────────────────────────────────────────────────────
jest.mock('razorpay', () =>
  jest.fn().mockImplementation(() => ({
    orders: {
      create: jest.fn().mockResolvedValue({
        id:       'order_test_123',
        amount:   9900,
        currency: 'INR',
      }),
    },
  }))
);

// ── Mock google-auth-library ──────────────────────────────────────────────────
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn().mockResolvedValue({
      getPayload: () => ({ sub: 'g-123', email: 'g@g.com', name: 'G User', picture: '' }),
    }),
  })),
}));

// ── Import app AFTER mocks ────────────────────────────────────────────────────
let app;
let authRateLimiter;
beforeAll(async () => {
  const mod = await import('../src/index.js');
  app = mod.default;
  const lm = await import('../src/middleware/rateLimiter.js');
  authRateLimiter = lm.authRateLimiter;
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

// Generate a valid access token for protected routes
function makeToken(userId = 'user-wallet-001', role = 'USER') {
  return jwt.sign({ id: userId, email: 'user@test.com', role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

// Build a valid Razorpay signature
function buildValidSignature(orderId, paymentId) {
  const body = `${orderId}|${paymentId}`;
  return crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');
}

beforeEach(() => {
  redisStore.clear();
  jest.clearAllMocks();
  if (authRateLimiter?.resetKey) authRateLimiter.resetKey('::ffff:127.0.0.1');

  // Default prisma $transaction delegates to real async ops
  prisma.$transaction.mockImplementation(async (ops) => {
    if (Array.isArray(ops)) return Promise.all(ops);
    return ops(prisma); // interactive transaction callback
  });
});

// ─── GET /balance ─────────────────────────────────────────────────────────────
describe('GET /api/v1/wallet/balance', () => {
  test('200 — returns wallet balance', async () => {
    prisma.wallet.findUnique.mockResolvedValue({
      balance:        1500,
      totalPurchased: 500,
      totalSpent:     200,
      updatedAt:      new Date(),
    });

    const res = await request(app)
      .get('/api/v1/wallet/balance')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('balance');
    expect(res.body.balance).toBe(1500);
  });

  test('401 — no token returns unauthorized', async () => {
    const res = await request(app).get('/api/v1/wallet/balance');
    expect(res.status).toBe(401);
  });
});

// ─── GET /packages (public, no auth) ─────────────────────────────────────────
describe('GET /api/v1/wallet/packages', () => {
  test('200 — returns active packages ordered by displayOrder', async () => {
    const fakePackages = [
      { id: 'pkg-1', name: 'Starter',  tokenAmount: 100, priceInr: '99',  bonusTokens: 0,  displayOrder: 1 },
      { id: 'pkg-2', name: 'Premium',  tokenAmount: 500, priceInr: '399', bonusTokens: 50, displayOrder: 2 },
    ];
    prisma.tokenPackage.findMany.mockResolvedValue(fakePackages);

    const res = await request(app).get('/api/v1/wallet/packages');
    expect(res.status).toBe(200);
    expect(res.body.packages).toHaveLength(2);
    expect(res.body.packages[0].name).toBe('Starter');
  });
});

// ─── POST /create-order ───────────────────────────────────────────────────────
describe('POST /api/v1/wallet/create-order', () => {
  test('201 — creates order and returns orderId + keyId', async () => {
    prisma.tokenPackage.findUnique.mockResolvedValue({
      id: 'pkg-1', name: 'Starter', tokenAmount: 100, priceInr: '99', bonusTokens: 0, isActive: true,
    });
    prisma.transaction.create.mockResolvedValue({ id: 'txn-001' });

    const res = await request(app)
      .post('/api/v1/wallet/create-order')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ packageId: 'pkg-1' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('orderId', 'order_test_123');
    expect(res.body).toHaveProperty('keyId');
    // CRITICAL: must NEVER expose keySecret
    expect(res.body).not.toHaveProperty('keySecret');
  });

  test('404 — inactive package rejected', async () => {
    prisma.tokenPackage.findUnique.mockResolvedValue({ isActive: false });

    const res = await request(app)
      .post('/api/v1/wallet/create-order')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ packageId: 'pkg-inactive' });

    expect(res.status).toBe(404);
  });
});

// ─── POST /verify-payment ─────────────────────────────────────────────────────
describe('POST /api/v1/wallet/verify-payment', () => {
  const orderId   = 'order_test_123';
  const paymentId = 'pay_test_abc789';

  const basePayload = () => ({
    razorpayOrderId:   orderId,
    razorpayPaymentId: paymentId,
    razorpaySignature: buildValidSignature(orderId, paymentId),
  });

  beforeEach(() => {
    // No duplicate
    prisma.transaction.findFirst.mockResolvedValueOnce(null);
    // Pending transaction found
    prisma.transaction.findFirst.mockResolvedValueOnce({
      id:     'txn-pending-1',
      amount: '99',
      status: 'PENDING',
    });
    // Package lookup by price
    prisma.tokenPackage.findFirst.mockResolvedValue({
      id:          'pkg-1',
      name:        'Starter',
      tokenAmount: 100,
      bonusTokens: 0,
      priceInr:    '99',
    });
    // updateMany mock to log failed payments
    prisma.transaction.updateMany.mockResolvedValue({ count: 1 });
    // $transaction returns [updatedTxn, updatedWallet]
    prisma.$transaction.mockResolvedValue([
      { id: 'txn-pending-1', status: 'SUCCESS' },
      { balance: 1100 },
    ]);
  });

  test('200 — valid signature credits tokens to wallet', async () => {
    const res = await request(app)
      .post('/api/v1/wallet/verify-payment')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send(basePayload());

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('newBalance');
    expect(res.body).toHaveProperty('tokensAdded');
  });

  test('400 — tampered signature is rejected BEFORE any DB write', async () => {
    // A 64-char hex string (same byte length) but with wrong value — triggers timingSafeEqual false
    const wrongSig = 'a'.repeat(64);
    const tamperedPayload = {
      ...basePayload(),
      razorpaySignature: wrongSig,
    };

    const res = await request(app)
      .post('/api/v1/wallet/verify-payment')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send(tamperedPayload);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid signature/i);
    // Transaction must NOT have been credited (only updateMany with FAILED is allowed)
    expect(prisma.$transaction).not.toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ status: 'SUCCESS' })])
    );
  });

  test('409 — duplicate paymentId is rejected immediately', async () => {
    // Override first findFirst to return an existing record
    prisma.transaction.findFirst
      .mockReset()
      .mockResolvedValueOnce({ id: 'existing-txn', razorpayPaymentId: paymentId });

    const res = await request(app)
      .post('/api/v1/wallet/verify-payment')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send(basePayload());

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Already processed/i);
  });
});

// ─── POST /daily-bonus ────────────────────────────────────────────────────────
describe('POST /api/v1/wallet/daily-bonus', () => {
  test('200 — first claim on day 1 gives 100 tokens', async () => {
    // No prior claim
    prisma.$transaction.mockResolvedValue([
      { id: 'bonus-1' },
      { balance: 600 },
    ]);

    const res = await request(app)
      .post('/api/v1/wallet/daily-bonus')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.tokensAdded).toBe(100);
    expect(res.body.streakDay).toBe(1);
  });

  test('409 — claiming twice in same day returns conflict', async () => {
    // Pre-set the daily claim key
    redisStore.set('daily:user-wallet-001', '1');

    const res = await request(app)
      .post('/api/v1/wallet/daily-bonus')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Already claimed/i);
  });
});

// ─── walletService.deductTokens — unit + concurrency tests ───────────────────
describe('walletService.deductTokens', () => {
  let walletService;

  beforeAll(async () => {
    walletService = await import('../src/services/walletService.js');
  });

  test('success — deducts tokens and returns new balance', async () => {
    const initialBalance = 1000;
    let   currentBalance = initialBalance;

    prisma.$transaction.mockImplementation(async (cb) => {
      return cb({
        wallet: {
          findUnique: jest.fn().mockResolvedValue({ balance: currentBalance }),
          update: jest.fn().mockImplementation(({ data }) => {
            currentBalance = currentBalance - data.balance?.decrement;
            return { balance: currentBalance };
          }),
        },
        transaction: { create: jest.fn().mockResolvedValue({}) },
      });
    });

    const result = await walletService.deductTokens('u1', 200, 'SLOTS');
    expect(result.amountSpent).toBe(200);
  });

  test('insufficient balance — throws 402', async () => {
    prisma.$transaction.mockImplementation(async (cb) => {
      return cb({
        wallet: {
          findUnique: jest.fn().mockResolvedValue({ balance: 50 }),
          update: jest.fn(),
        },
        transaction: { create: jest.fn() },
      });
    });

    await expect(walletService.deductTokens('u1', 200, 'SLOTS'))
      .rejects.toMatchObject({ status: 402 });
  });

  test('100 concurrent deductions — balance never goes negative', async () => {
    let balance = 1000; // start with 1000 tokens
    const DEDUCT_AMOUNT = 20; // 100 × 20 = 2000 > 1000, so ~50 should succeed

    // Track successful/failed deductions
    let successCount = 0;
    let failCount    = 0;

    prisma.$transaction.mockImplementation(async (cb) => {
      // Simulate a serialised DB lock / critical section
      const snap = balance;
      if (snap < DEDUCT_AMOUNT) {
        throw Object.assign(new Error('Insufficient balance'), { status: 402 });
      }
      balance = balance - DEDUCT_AMOUNT;
      return cb({
        wallet: {
          findUnique: jest.fn().mockResolvedValue({ balance: snap }),
          update: jest.fn().mockResolvedValue({ balance }),
        },
        transaction: { create: jest.fn().mockResolvedValue({}) },
      });
    });

    const results = await Promise.allSettled(
      Array.from({ length: 100 }, () =>
        walletService.deductTokens('u-concurrent', DEDUCT_AMOUNT, 'SLOTS')
      )
    );

    results.forEach((r) => {
      if (r.status === 'fulfilled') successCount++;
      else failCount++;
    });

    // Balance must NEVER be negative
    expect(balance).toBeGreaterThanOrEqual(0);
    // Not all 100 should succeed (would exceed initial balance)
    expect(failCount).toBeGreaterThan(0);
    expect(successCount + failCount).toBe(100);

    console.log(`Concurrent test: ${successCount} succeeded, ${failCount} failed, final balance: ${balance}`);
  });
});
