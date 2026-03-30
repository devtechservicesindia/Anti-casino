/**
 * backend/src/games/roulette/rouletteEngine.js
 *
 * Provably fair European Roulette engine (37 pockets: 0–36).
 *
 * RNG CONTRACT (same scheme as slots):
 *   msg  = serverSeed:clientSeed:nonce
 *   hash = HMAC-SHA256(key=serverSeed, data=msg).hex()
 *   winningNumber = parseInt(hash.slice(0,8), 16) % 37
 */

import crypto from 'crypto';

// ─── Layout Constants ─────────────────────────────────────────────────────────
export const RED_NUMBERS  = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
export const BLACK_NUMBERS = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];
export const GREEN_NUMBERS = [0];

// Column definitions (standard European layout)
export const COLUMN_1 = [1,4,7,10,13,16,19,22,25,28,31,34];   // bottom row
export const COLUMN_2 = [2,5,8,11,14,17,20,23,26,29,32,35];   // middle row
export const COLUMN_3 = [3,6,9,12,15,18,21,24,27,30,33,36];   // top row

// Dozen definitions
export const DOZEN_1 = Array.from({ length: 12 }, (_, i) => i + 1);   // 1-12
export const DOZEN_2 = Array.from({ length: 12 }, (_, i) => i + 13);  // 13-24
export const DOZEN_3 = Array.from({ length: 12 }, (_, i) => i + 25);  // 25-36

// ─── Bet type → required numbers count & payout multiplier ────────────────────
export const BET_TYPES = {
  straight:  { count: 1,  payout: 35 },
  split:     { count: 2,  payout: 17 },
  street:    { count: 3,  payout: 11 },
  corner:    { count: 4,  payout: 8  },
  dozen:     { count: 12, payout: 2  },
  column:    { count: 12, payout: 2  },
  red_black: { count: 18, payout: 1  },
  odd_even:  { count: 18, payout: 1  },
  low_high:  { count: 18, payout: 1  },
};

// ─── Bet Validation ───────────────────────────────────────────────────────────
/**
 * Validates a single bet object.
 * @param {{ type: string, numbers: number[], amount: number }} bet
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateBet(bet) {
  const spec = BET_TYPES[bet.type];
  if (!spec) {
    return { valid: false, error: `Unknown bet type: ${bet.type}` };
  }

  if (!Array.isArray(bet.numbers) || bet.numbers.length !== spec.count) {
    return { valid: false, error: `${bet.type} requires exactly ${spec.count} number(s), got ${bet.numbers?.length}` };
  }

  // Every number must be 0–36 integer
  for (const n of bet.numbers) {
    if (!Number.isInteger(n) || n < 0 || n > 36) {
      return { valid: false, error: `Invalid number: ${n}. Must be 0–36.` };
    }
  }

  // No duplicates within a single bet
  if (new Set(bet.numbers).size !== bet.numbers.length) {
    return { valid: false, error: 'Duplicate numbers in bet' };
  }

  if (typeof bet.amount !== 'number' || bet.amount <= 0) {
    return { valid: false, error: 'Bet amount must be a positive number' };
  }

  return { valid: true };
}

// ─── Core RNG ─────────────────────────────────────────────────────────────────
/**
 * Generate a winning number 0–36 via HMAC-SHA256.
 *
 * @param {string} serverSeed
 * @param {string} clientSeed
 * @param {number} nonce
 * @returns {number} 0–36
 */
export function generateWinningNumber(serverSeed, clientSeed, nonce) {
  const msg  = `${serverSeed}:${clientSeed}:${nonce}`;
  const hash = crypto
    .createHmac('sha256', serverSeed)
    .update(msg)
    .digest('hex');

  return parseInt(hash.slice(0, 8), 16) % 37;
}

// ─── Pocket colour helper ─────────────────────────────────────────────────────
/**
 * @param {number} n  0–36
 * @returns {'red'|'black'|'green'}
 */
export function getColor(n) {
  if (n === 0) return 'green';
  return RED_NUMBERS.includes(n) ? 'red' : 'black';
}

// ─── Evaluate Bets ────────────────────────────────────────────────────────────
/**
 * Evaluate an array of bets against the winning number.
 *
 * @param {{ type: string, numbers: number[], amount: number }[]} bets
 * @param {number} winningNumber  0–36
 * @returns {{ totalWin: number, betResults: Array }}
 */
export function evaluateBets(bets, winningNumber) {
  let totalWin = 0;
  const betResults = [];

  for (const bet of bets) {
    const spec = BET_TYPES[bet.type];
    const isWin = bet.numbers.includes(winningNumber);

    let win = 0;
    if (isWin) {
      win = +(bet.amount * spec.payout).toFixed(2);
      // Payout is profit, so total returned = amount + win.
      // But in roulette convention "35:1" means you get 35× your bet PLUS your bet back.
      // Our API credits winnings (profit + original stake) for consistency.
      win = +(bet.amount + bet.amount * spec.payout).toFixed(2);
    }

    totalWin += win;

    betResults.push({
      type:    bet.type,
      numbers: bet.numbers,
      amount:  bet.amount,
      payout:  isWin ? spec.payout : 0,
      win,
    });
  }

  return { totalWin: +totalWin.toFixed(2), betResults };
}
