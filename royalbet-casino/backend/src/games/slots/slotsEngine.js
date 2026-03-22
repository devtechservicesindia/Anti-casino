/**
 * backend/src/games/slots/slotsEngine.js
 *
 * Provably fair 3×3 slot machine engine.
 *
 * RNG CONTRACT (implementd exactly as specified):
 *   msg  = serverSeed:clientSeed:nonce:reelIndex
 *   hash = HMAC-SHA256(key=serverSeed, data=msg).hex()
 *   val  = parseInt(hash.slice(0,8), 16) % 1000
 *   Walk weighted array → symbolIndex
 */

import crypto from 'crypto';

// ─── Symbol definitions ────────────────────────────────────────────────────────
// Index 0-7 are premium. Index 8 is the generic "low" bucket that fills the
// remaining 390 probability weight.
export const SYMBOLS = [
  { id: 0, name: 'Diamond', weight: 20  },
  { id: 1, name: 'Star',    weight: 40  },
  { id: 2, name: 'Seven',   weight: 50  },
  { id: 3, name: 'Crown',   weight: 60  },
  { id: 4, name: 'Cherry',  weight: 100 },
  { id: 5, name: 'Bell',    weight: 100 },
  { id: 6, name: 'Lemon',   weight: 120 },
  { id: 7, name: 'Orange',  weight: 120 },
  { id: 8, name: 'Generic', weight: 390 }, // fills the remaining 390
];

// Validate total weight = 1000
const TOTAL_WEIGHT = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
if (TOTAL_WEIGHT !== 1000) {
  throw new Error(`Symbol weights must sum to 1000, got ${TOTAL_WEIGHT}`);
}

// Pre-compute cumulative thresholds for fast lookup
const THRESHOLDS = SYMBOLS.map((_, i) => 
  SYMBOLS.slice(0, i + 1).reduce((s, sym) => s + sym.weight, 0)
);

// ─── Payout table  ────────────────────────────────────────────────────────────
// Multipliers applied to betAmount
export const PAYOUT_3X = {
  0: 50,  // Diamond
  1: 20,  // Star
  2: 15,  // Seven
  3: 10,  // Crown
  4: 5,   // Cherry
  5: 3,   // Bell
  6: 2,   // Lemon
  7: 2,   // Orange
  8: 1.5, // Generic (Needed to boost base mathematical RTP up to the required 94-98% band)
};

// 2 matching on centre row only
export const PAYOUT_2X = 1.5;

// ─── Paylines [row][col] indices ──────────────────────────────────────────────
export const PAYLINES = [
  { name: 'centre', positions: [[1,0],[1,1],[1,2]] },
  { name: 'top',    positions: [[0,0],[0,1],[0,2]] },
  { name: 'bottom', positions: [[2,0],[2,1],[2,2]] },
];

// ─── Core RNG ─────────────────────────────────────────────────────────────────
/**
 * Provably fair symbol generator – EXACTLY as specified.
 *
 * @param {string} serverSeed
 * @param {string} clientSeed
 * @param {number} nonce
 * @param {number} reelIndex  0-8 (row * 3 + col)
 * @returns {number} symbolIndex 0-8
 */
export function generateSymbol(serverSeed, clientSeed, nonce, reelIndex) {
  const msg  = `${serverSeed}:${clientSeed}:${nonce}:${reelIndex}`;
  const hash = crypto
    .createHmac('sha256', serverSeed)
    .update(msg)
    .digest('hex');

  const val = parseInt(hash.slice(0, 8), 16) % 1000;

  // Walk weighted thresholds to find symbol
  for (let i = 0; i < THRESHOLDS.length; i++) {
    if (val < THRESHOLDS[i]) return i;
  }
  return SYMBOLS.length - 1; // fallback (should never reach here)
}

// ─── Grid generation ──────────────────────────────────────────────────────────
/**
 * Generate a 3×3 grid using provably fair RNG.
 * reelIndex = row * 3 + col  (0-8)
 *
 * @returns {number[][]} 3×3 grid of symbol indices
 */
export function generateGrid(serverSeed, clientSeed, nonce) {
  return Array.from({ length: 3 }, (_, row) =>
    Array.from({ length: 3 }, (_, col) =>
      generateSymbol(serverSeed, clientSeed, nonce, row * 3 + col)
    )
  );
}

// ─── Payline evaluation ───────────────────────────────────────────────────────
/**
 * Evaluate all 3 paylines against the grid.
 *
 * @param {number[][]} grid  3×3 symbol indices
 * @param {number} betAmount
 * @returns {{ winAmount: number, winningLines: Array }}
 */
export function evaluatePaylines(grid, betAmount) {
  let totalWin = 0;
  const winningLines = [];

  for (const payline of PAYLINES) {
    const symbols = payline.positions.map(([r, c]) => grid[r][c]);
    const [a, b, c] = symbols;

    let lineMultiplier = 0;
    let lineType = null;

    if (a === b && b === c) {
      // 3 of a kind
      lineMultiplier = PAYOUT_3X[a] ?? 0;
      lineType = lineMultiplier > 0 ? `3x ${SYMBOLS[a].name}` : null;
    } else if (payline.name === 'centre') {
      // Only centre row awards 2-match bonus
      if (a === b || b === c || a === c) {
        lineMultiplier = PAYOUT_2X;
        const matchSym = (a === b) ? a : (b === c ? b : a);
        lineType = `2x ${SYMBOLS[matchSym].name}`;
      }
    }

    if (lineMultiplier > 0) {
      const win = +(betAmount * lineMultiplier).toFixed(2);
      totalWin += win;
      winningLines.push({
        payline: payline.name,
        symbols,
        type: lineType,
        multiplier: lineMultiplier,
        win,
      });
    }
  }

  return { winAmount: +totalWin.toFixed(2), winningLines };
}

/**
 * Full spin — returns everything needed for the API response.
 */
export function spin({ serverSeed, clientSeed, nonce, betAmount }) {
  const grid = generateGrid(serverSeed, clientSeed, nonce);
  const { winAmount, winningLines } = evaluatePaylines(grid, betAmount);
  return { grid, winAmount, winningLines };
}
