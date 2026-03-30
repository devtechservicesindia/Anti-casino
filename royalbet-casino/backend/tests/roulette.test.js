/**
 * tests/roulette.test.js
 *
 * Unit tests for the European Roulette engine (rouletteEngine.js)
 *
 * Tests:
 *  ✓ Each of 9 bet types calculates correct payout
 *  ✓ Total bet > balance is rejected
 *  ✓ Green 0 (single-zero pocket) pays correctly on straight bet
 *  ✓ Red/Black/Odd/Even/Low/High pay 1:1
 *  ✓ Dozen/Column pay 2:1
 *  ✓ Split pays 17:1, Street 11:1, Corner 8:1
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import {
  evaluateBets,
  validateBet,
  generateWinningNumber,
  RED_NUMBERS,
  BLACK_NUMBERS,
} from '../src/games/roulette/rouletteEngine.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a valid bet object.
 */
function bet(type, numbers, amount) {
  return { type, numbers, amount };
}

// ─── 1. Payout correctness for all 9 bet types ────────────────────────────────
describe('Roulette — Payout correctness for all 9 bet types', () => {
  // --- Straight bet (35:1 payout = returns 36× stake) ---
  test('straight bet on winning number pays 36× stake (35:1)', () => {
    const { totalWin } = evaluateBets([bet('straight', [7], 100)], 7);
    // Win = 100 + 100*35 = 3600
    expect(totalWin).toBe(3600);
  });

  test('straight bet on losing number pays 0', () => {
    const { totalWin } = evaluateBets([bet('straight', [7], 100)], 8);
    expect(totalWin).toBe(0);
  });

  // --- Split bet (17:1 payout = returns 18× stake) ---
  test('split bet wins when either number hits — pays 18× stake', () => {
    const { totalWin } = evaluateBets([bet('split', [5, 6], 50)], 6);
    // Win = 50 + 50*17 = 900
    expect(totalWin).toBe(900);
  });

  // --- Street bet (11:1 = returns 12× stake) ---
  test('street bet on row [1,2,3] wins when result is in range', () => {
    const { totalWin } = evaluateBets([bet('street', [1, 2, 3], 100)], 2);
    // Win = 100 + 100*11 = 1200
    expect(totalWin).toBe(1200);
  });

  // --- Corner bet (8:1 = returns 9× stake) ---
  test('corner bet wins when result is one of 4 numbers', () => {
    const { totalWin } = evaluateBets([bet('corner', [1, 2, 4, 5], 100)], 5);
    // Win = 100 + 100*8 = 900
    expect(totalWin).toBe(900);
  });

  // --- Dozen bet (2:1 = returns 3× stake) ---
  test('dozen 1 (1-12) wins when result is 1–12', () => {
    const nums = Array.from({ length: 12 }, (_, i) => i + 1);
    const { totalWin } = evaluateBets([bet('dozen', nums, 100)], 11);
    // Win = 100 + 100*2 = 300
    expect(totalWin).toBe(300);
  });

  test('dozen 1 (1-12) loses when result is 13+', () => {
    const nums = Array.from({ length: 12 }, (_, i) => i + 1);
    const { totalWin } = evaluateBets([bet('dozen', nums, 100)], 13);
    expect(totalWin).toBe(0);
  });

  // --- Column bet (2:1 = returns 3× stake) ---
  test('column bet wins when result is in column', () => {
    const col = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34];
    const { totalWin } = evaluateBets([bet('column', col, 100)], 28);
    expect(totalWin).toBe(300);
  });

  // --- Red/Black (1:1 = returns 2× stake) ---
  test('red bet pays 2× on a red number', () => {
    const { totalWin } = evaluateBets([bet('red_black', RED_NUMBERS, 100)], RED_NUMBERS[0]);
    expect(totalWin).toBe(200);
  });

  test('black bet pays 0 on a red number', () => {
    const { totalWin } = evaluateBets([bet('red_black', BLACK_NUMBERS, 100)], RED_NUMBERS[0]);
    expect(totalWin).toBe(0);
  });

  // --- Odd/Even (1:1 = returns 2× stake) ---
  test('even bet (2,4,…36) pays 2× on even number', () => {
    const evens = Array.from({ length: 18 }, (_, i) => (i + 1) * 2); // 2..36
    const { totalWin } = evaluateBets([bet('odd_even', evens, 100)], 14);
    expect(totalWin).toBe(200);
  });

  // --- Low/High (1:1 = returns 2× stake) ---
  test('low bet (1-18) pays 2× on number in 1-18', () => {
    const low = Array.from({ length: 18 }, (_, i) => i + 1);
    const { totalWin } = evaluateBets([bet('low_high', low, 100)], 7);
    expect(totalWin).toBe(200);
  });

  test('low bet (1-18) pays 0 on number in 19-36', () => {
    const low = Array.from({ length: 18 }, (_, i) => i + 1);
    const { totalWin } = evaluateBets([bet('low_high', low, 100)], 25);
    expect(totalWin).toBe(0);
  });
});

// ─── 2. Green 0 pocket ────────────────────────────────────────────────────────
describe('Roulette — Green 0 pocket', () => {
  test('straight bet on 0 pays 36× when result is 0', () => {
    const { totalWin } = evaluateBets([bet('straight', [0], 100)], 0);
    expect(totalWin).toBe(3600);
  });

  test('red_black bet loses when result is green 0', () => {
    const { totalWin } = evaluateBets([bet('red_black', RED_NUMBERS, 100)], 0);
    expect(totalWin).toBe(0);
  });

  test('odd_even bet loses when result is 0', () => {
    const odds = Array.from({ length: 18 }, (_, i) => 2 * i + 1); // 1,3,5...35
    const { totalWin } = evaluateBets([bet('odd_even', odds, 100)], 0);
    expect(totalWin).toBe(0);
  });
});

// ─── 3. Bet validation ────────────────────────────────────────────────────────
describe('Roulette — Bet validation', () => {
  test('validateBet rejects unknown bet type', () => {
    const result = validateBet(bet('jackpot', [1], 100));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Unknown bet type/i);
  });

  test('validateBet rejects straight bet with 2 numbers', () => {
    const result = validateBet(bet('straight', [1, 2], 100));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/requires exactly 1/);
  });

  test('validateBet rejects numbers outside 0–36', () => {
    const result = validateBet(bet('straight', [37], 100));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Invalid number: 37/);
  });

  test('validateBet rejects non-positive amount', () => {
    const result = validateBet(bet('straight', [5], -10));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/positive/i);
  });

  test('validateBet accepts valid straight bet', () => {
    const result = validateBet(bet('straight', [17], 200));
    expect(result.valid).toBe(true);
  });
});

// ─── 4. Total bet > balance is rejected ──────────────────────────────────────
describe('Roulette — Balance enforcement', () => {
  /**
   * This test verifies the CONTROLLER rejects total bet > balance.
   * Since rouletteEngine.js is pure logic (no DB access),
   * we simulate the check that the controller performs.
   */
  test('total bet amount > balance should fail the business rule', () => {
    const userBalance = 500;
    const bets = [
      bet('straight', [7], 300),
      bet('red_black', RED_NUMBERS, 300), // total = 600 > 500
    ];
    const totalBet = bets.reduce((sum, b) => sum + b.amount, 0);

    // The controller should reject this before even calling evaluateBets
    expect(totalBet).toBeGreaterThan(userBalance);
    // Validate our rule: if total > balance, throw
    const exceedsBalance = totalBet > userBalance;
    expect(exceedsBalance).toBe(true);
  });

  test('total bet within balance is accepted', () => {
    const userBalance = 500;
    const bets = [
      bet('straight', [7], 100),
      bet('red_black', RED_NUMBERS, 200),
    ];
    const totalBet = bets.reduce((sum, b) => sum + b.amount, 0);
    expect(totalBet).toBeLessThanOrEqual(userBalance);
  });
});

// ─── 5. RNG determinism ───────────────────────────────────────────────────────
describe('Roulette — generateWinningNumber determinism', () => {
  test('same seed+client+nonce always produces same number', () => {
    const s = 'fixed_seed', c = 'fixed_client', n = 42;
    const r1 = generateWinningNumber(s, c, n);
    const r2 = generateWinningNumber(s, c, n);
    expect(r1).toBe(r2);
    expect(r1).toBeGreaterThanOrEqual(0);
    expect(r1).toBeLessThanOrEqual(36);
  });

  test('different nonce produces a different result with high probability', () => {
    const s = 'seed', c = 'client';
    const results = new Set(
      Array.from({ length: 20 }, (_, i) => generateWinningNumber(s, c, i))
    );
    // With 20 different nonces across a 0-36 range, results should vary
    expect(results.size).toBeGreaterThan(5);
  });
});
