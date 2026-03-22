/**
 * backend/tests/slots.test.js
 *
 * Statistical and correctness tests for the provably fair slots engine.
 *
 * REQUIREMENTS:
 *  ✓ 1,000,000 spins — RTP must be 94%–98%
 *  ✓ Symbol distribution within 1% of weighted probabilities
 *  ✓ Same seed+nonce always returns same result (determinism)
 *  ✓ Balance never goes negative under any bet scenario
 */

import { describe, test, expect } from '@jest/globals';
import crypto from 'crypto';
import { generateSymbol, generateGrid, evaluatePaylines, spin, SYMBOLS } from '../src/games/slots/slotsEngine.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const randHex = () => crypto.randomBytes(32).toString('hex');

// ─── 1. Determinism ───────────────────────────────────────────────────────────
describe('Provably Fair — Determinism', () => {
  test('same serverSeed + clientSeed + nonce + reelIndex always returns same symbol', () => {
    const seed   = 'fixed_server_seed_for_test';
    const client = 'fixed_client_seed';
    const nonce  = 42;

    const results = Array.from({ length: 10 }, () =>
      generateSymbol(seed, client, nonce, 0)
    );
    // All 10 calls must return the identical value
    expect(new Set(results).size).toBe(1);
  });

  test('different nonce yields different grid (with overwhelming probability)', () => {
    const seed   = randHex();
    const client = 'test_client';

    const grid1 = generateGrid(seed, client, 1);
    const grid2 = generateGrid(seed, client, 2);

    // Extremely unlikely to be equal across all 9 cells
    const g1flat = grid1.flat();
    const g2flat = grid2.flat();
    expect(g1flat).not.toEqual(g2flat);
  });

  test('full spin result is reproduced from the same inputs', () => {
    const serverSeed = 'reproducible_server_seed_abc123';
    const clientSeed = 'reproducible_client_xyz';
    const nonce      = 7;
    const betAmount  = 100;

    const r1 = spin({ serverSeed, clientSeed, nonce, betAmount });
    const r2 = spin({ serverSeed, clientSeed, nonce, betAmount });

    expect(r1.grid).toEqual(r2.grid);
    expect(r1.winAmount).toBe(r2.winAmount);
    expect(r1.winningLines).toEqual(r2.winningLines);
  });
});

// ─── 2. Payout sanity checks ──────────────────────────────────────────────────
describe('Payline Evaluation', () => {
  test('3x Diamond centre row pays 50x bet', () => {
    // grid[row][col]: row 1 (centre) = all Diamond (0)
    const grid = [
      [8, 7, 6],
      [0, 0, 0],
      [8, 6, 7],
    ];
    const { winAmount, winningLines } = evaluatePaylines(grid, 100);
    // 3x Diamond = 50x × 100 = 5000
    expect(winAmount).toBe(5000);
    expect(winningLines.some(l => l.payline === 'centre' && l.multiplier === 50)).toBe(true);
  });

  test('3x Lemon on top row pays 2x bet', () => {
    const grid = [
      [6, 6, 6],
      [8, 7, 6],
      [8, 6, 7],
    ];
    const { winAmount } = evaluatePaylines(grid, 50);
    // top-row 3x Lemon = 2x × 50 = 100
    expect(winAmount).toBe(100);
  });

  test('2 matching on centre only pays 1.5x bet', () => {
    const grid = [
      [8, 7, 6],
      [3, 3, 8],   // Crown, Crown, Generic — 2-match on centre
      [8, 6, 7],
    ];
    const { winAmount } = evaluatePaylines(grid, 100);
    expect(winAmount).toBe(150);
  });

  test('2 matching on top row does NOT award 1.5x', () => {
    const grid = [
      [0, 0, 8],   // 2 Diamonds on top — not awarded
      [8, 7, 6],
      [8, 6, 7],
    ];
    const { winAmount } = evaluatePaylines(grid, 100);
    expect(winAmount).toBe(0);
  });

  test('no match returns 0', () => {
    const grid = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
    ];
    const { winAmount } = evaluatePaylines(grid, 100);
    expect(winAmount).toBe(0);
  });

  test('multiple winning lines accumulate correctly', () => {
    // centre 3x Star (20x) + top 3x Bell (3x) + bottom 3x Orange (2x)
    const grid = [
      [5, 5, 5], // top: Bell ×3
      [1, 1, 1], // centre: Star ×3
      [7, 7, 7], // bottom: Orange ×3
    ];
    const { winAmount } = evaluatePaylines(grid, 100);
    // (20 + 3 + 2) × 100 = 2500
    expect(winAmount).toBe(2500);
  });
});

// ─── 3. Balance safety ────────────────────────────────────────────────────────
describe('Balance Safety', () => {
  test('balance never goes negative across all bet levels', () => {
    const betAmounts = [10, 50, 100, 250, 500];
    for (const betAmount of betAmounts) {
      let balance = betAmount; // start with exactly enough for one spin
      // Spin once; worst case: lose entire bet
      const result = spin({ serverSeed: randHex(), clientSeed: 'safe', nonce: 1, betAmount });
      balance -= betAmount;
      balance += result.winAmount;
      // Even if we lost, balance should be >= 0 (we started with exactly betAmount)
      expect(balance).toBeGreaterThanOrEqual(0);
    }
  });

  test('winAmount is always >= 0', () => {
    for (let i = 0; i < 1000; i++) {
      const { winAmount } = spin({ serverSeed: randHex(), clientSeed: 'c', nonce: i, betAmount: 100 });
      expect(winAmount).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─── 4. Symbol Distribution (within 1% of expected weight) ───────────────────
describe('Symbol Distribution — 1,000,000 spins', () => {
  const SPINS = 1_000_000;
  const BET   = 100;

  // Run the simulation once and cache results (shared across tests)
  const symbolCounts = new Array(SYMBOLS.length).fill(0);
  let totalWagered = 0;
  let totalWon     = 0;

  // Run the million spins (Node.js sync — takes ~8-10s on most machines)
  beforeAll(() => {
    const seed   = 'statistical_server_seed_v1';
    const client = 'statistical_client_seed_v1';
    for (let nonce = 0; nonce < SPINS; nonce++) {
      const grid = generateGrid(seed, client, nonce);
      // Count every cell
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          symbolCounts[grid[r][c]]++;
        }
      }
      const { winAmount } = evaluatePaylines(grid, BET);
      totalWagered += BET;
      totalWon     += winAmount;
    }
  }, 120_000); // 2-minute timeout for the monte carlo

  test('each symbol appears within ±1% of its expected proportion', () => {
    const totalCells = SPINS * 9; // 9 cells per spin
    for (const sym of SYMBOLS) {
      const expectedPct = sym.weight / 1000;      // e.g. Diamond = 0.02
      const actualPct   = symbolCounts[sym.id] / totalCells;
      const tolerance   = 0.01; // ±1 percentage point

      expect(actualPct).toBeGreaterThanOrEqual(expectedPct - tolerance);
      expect(actualPct).toBeLessThanOrEqual(expectedPct + tolerance);
    }
  });

  test('RTP is between 94% and 98%', () => {
    const rtp = totalWon / totalWagered; // e.g. 0.9645 = 96.45%
    console.log(`RTP over ${SPINS.toLocaleString()} spins: ${(rtp * 100).toFixed(3)}%`);
    expect(rtp).toBeGreaterThanOrEqual(0.94);
    expect(rtp).toBeLessThanOrEqual(0.98);
  });
}, 120_000);
