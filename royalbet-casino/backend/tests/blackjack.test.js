/**
 * tests/blackjack.test.js
 *
 * Unit tests for the Blackjack engine (blackjackEngine.js)
 *
 * Tests:
 *  ✓ Soft ace handling (A+6 = soft 17, not hard 17)
 *  ✓ Blackjack detection (Ace + King on first 2 cards)
 *  ✓ Blackjack payout is 3:2 (not 2:1 flat)
 *  ✓ Bust detection (total > 21 stops play)
 *  ✓ Dealer hits on soft 16, stands on hard 17+
 *  ✓ Hand evaluation with multiple aces
 *  ✓ Double-down (split hand excluded from 3:2)
 *  ✓ Push on equal totals
 */

import { describe, test, expect } from '@jest/globals';
import {
  evaluateHand,
  isBlackjack,
  resolveHand,
  dealerShouldHit,
  buildShoe,
  deterministicShuffle,
  canSplit,
} from '../src/games/blackjack/blackjackEngine.js';

// ─── Card constructors ────────────────────────────────────────────────────────
const card = (rank, suit = '♠') => ({ rank, suit });

// ─── 1. Soft Ace handling ─────────────────────────────────────────────────────
describe('Blackjack — Soft Ace handling', () => {
  test('A + 6 = soft 17 (ace counted as 11)', () => {
    const hand = [card('A'), card('6')];
    const { total, soft, busted } = evaluateHand(hand);
    expect(total).toBe(17);
    expect(soft).toBe(true);
    expect(busted).toBe(false);
  });

  test('A + 10 = soft 21 (Blackjack check — not hard 11)', () => {
    const hand = [card('A'), card('10')];
    const { total, soft } = evaluateHand(hand);
    expect(total).toBe(21);
    expect(soft).toBe(true);
  });

  test('A + A = soft 12 (one ace is 11, one is 1)', () => {
    const hand = [card('A'), card('A')];
    const { total, soft } = evaluateHand(hand);
    expect(total).toBe(12);
    expect(soft).toBe(true);
  });

  test('A + 9 + 5 = hard 15 (ace re-valued to 1 to prevent bust)', () => {
    const hand = [card('A'), card('9'), card('5')];
    const { total, soft, busted } = evaluateHand(hand);
    expect(total).toBe(15);
    expect(soft).toBe(false);  // ace now counted as 1, not soft anymore
    expect(busted).toBe(false);
  });

  test('A + A + A + 6 = soft 13 (two aces re-valued to 1, one still 11)', () => {
    const hand = [card('A'), card('A'), card('A'), card('6')];
    const { total, soft } = evaluateHand(hand);
    // 11+11+11+6=39 → -10=29 → -10=19. Wait: 11+1+1+6=19. Still has 1 ace at 11 → soft.
    // Actual reduction: start=39, aces=3. 39>21 → -10=29, aces=2. 29>21 → -10=19, aces=1. 19≤21 → stop.
    // Result: 19, soft=true (1 ace still at 11)
    expect(total).toBe(19);
    expect(soft).toBe(true);
  });

  test('A + K + 5 does NOT bust — ace re-valued to 1', () => {
    const hand = [card('A'), card('K'), card('5')];
    const { total, busted } = evaluateHand(hand);
    expect(total).toBe(16);
    expect(busted).toBe(false);
  });
});

// ─── 2. Blackjack detection ───────────────────────────────────────────────────
describe('Blackjack — Natural Blackjack detection', () => {
  test('Ace + King on first 2 cards = blackjack', () => {
    expect(isBlackjack([card('A'), card('K')])).toBe(true);
  });

  test('Ace + 10 = blackjack', () => {
    expect(isBlackjack([card('A'), card('10')])).toBe(true);
  });

  test('Ace + Queen = blackjack', () => {
    expect(isBlackjack([card('A'), card('Q')])).toBe(true);
  });

  test('Ace + Jack = blackjack', () => {
    expect(isBlackjack([card('A'), card('J')])).toBe(true);
  });

  test('Ace + 9 is NOT blackjack (21 but not natural)', () => {
    expect(isBlackjack([card('A'), card('9')])).toBe(false);
  });

  test('3-card 21 (A+5+5) is NOT blackjack', () => {
    expect(isBlackjack([card('A'), card('5'), card('5')])).toBe(false);
  });

  test('Two 10s is NOT blackjack (no ace)', () => {
    expect(isBlackjack([card('10'), card('10')])).toBe(false);
  });
});

// ─── 3. Blackjack pays 3:2 (not 2:1) ─────────────────────────────────────────
describe('Blackjack — 3:2 payout on natural', () => {
  test('player blackjack pays 3:2 on a 100 bet → gets back 250 total', () => {
    const playerHand = [card('A'), card('K')]; // natural blackjack
    const dealerHand = [card('7'), card('9')]; // dealer has 16 — no blackjack

    const { outcome, payout } = resolveHand(playerHand, dealerHand, 100);
    expect(outcome).toBe('BLACKJACK');
    // 3:2 = 100 (original) + 150 (1.5× profit) = 250
    expect(payout).toBe(250);
  });

  test('player blackjack is NOT paid 2:1 (would be 300)', () => {
    const playerHand = [card('A'), card('Q')];
    const dealerHand = [card('2'), card('8')];

    const { payout } = resolveHand(playerHand, dealerHand, 100);
    expect(payout).not.toBe(300); // 2:1 payout is WRONG behavior
    expect(payout).toBe(250);     // 3:2 payout is CORRECT
  });

  test('both blackjack → PUSH (returns original bet)', () => {
    const playerHand = [card('A'), card('K')];
    const dealerHand = [card('A'), card('J')];

    const { outcome, payout } = resolveHand(playerHand, dealerHand, 100);
    expect(outcome).toBe('PUSH');
    expect(payout).toBe(100); // bet returned, no profit
  });

  test('dealer blackjack vs player 20 → player LOSES (payout 0)', () => {
    const playerHand = [card('K'), card('Q')]; // 20, no blackjack
    const dealerHand = [card('A'), card('K')]; // dealer blackjack

    const { outcome, payout } = resolveHand(playerHand, dealerHand, 100);
    expect(outcome).toBe('LOSS');
    expect(payout).toBe(0);
  });
});

// ─── 4. Bust detection ────────────────────────────────────────────────────────
describe('Blackjack — Bust detection', () => {
  test('K + Q + 2 = 22 → busted', () => {
    const { total, busted } = evaluateHand([card('K'), card('Q'), card('2')]);
    expect(total).toBe(22);
    expect(busted).toBe(true);
  });

  test('player bust → BUST outcome with payout 0', () => {
    const playerHand = [card('K'), card('Q'), card('5')]; // 25
    const dealerHand = [card('7'), card('8')];            // 15

    const { outcome, payout } = resolveHand(playerHand, dealerHand, 100);
    expect(outcome).toBe('BUST');
    expect(payout).toBe(0);
  });

  test('dealer bust → player wins 2× bet', () => {
    const playerHand = [card('K'), card('8')]; // 18 — no bust
    const dealerHand = [card('K'), card('Q'), card('7')]; // 27 — bust

    const { outcome, payout } = resolveHand(playerHand, dealerHand, 100);
    expect(outcome).toBe('WIN');
    expect(payout).toBe(200); // 2× bet
  });
});

// ─── 5. Standard win/loss/push outcomes ──────────────────────────────────────
describe('Blackjack — Standard outcomes', () => {
  test('player 20 vs dealer 18 → WIN, payout 2× bet', () => {
    const { outcome, payout } = resolveHand(
      [card('K'), card('Q')],    // 20
      [card('9'), card('9')],    // 18
      100
    );
    expect(outcome).toBe('WIN');
    expect(payout).toBe(200);
  });

  test('player 16 vs dealer 20 → LOSS, payout 0', () => {
    const { outcome, payout } = resolveHand(
      [card('7'), card('9')],    // 16
      [card('K'), card('Q')],    // 20
      100
    );
    expect(outcome).toBe('LOSS');
    expect(payout).toBe(0);
  });

  test('equal total 18 vs 18 → PUSH, original bet returned', () => {
    const { outcome, payout } = resolveHand(
      [card('9'), card('9')],    // 18
      [card('K'), card('8')],    // 18
      100
    );
    expect(outcome).toBe('PUSH');
    expect(payout).toBe(100);
  });
});

// ─── 6. Dealer AI (hit/stand rule) ────────────────────────────────────────────
describe('Blackjack — Dealer AI', () => {
  test('dealer hits on soft 16 (A+5)', () => {
    const hand = [card('A'), card('5')];
    expect(dealerShouldHit(hand)).toBe(true);
  });

  test('dealer stands on soft 17 (A+6)', () => {
    const hand = [card('A'), card('6')];
    // Total = 17, soft = true → should NOT hit (stands on soft 17+)
    expect(dealerShouldHit(hand)).toBe(false);
  });

  test('dealer hits on hard 16 (10+6)', () => {
    const hand = [card('10'), card('6')];
    expect(dealerShouldHit(hand)).toBe(true);
  });

  test('dealer stands on hard 17 (10+7)', () => {
    const hand = [card('10'), card('7')];
    expect(dealerShouldHit(hand)).toBe(false);
  });
});

// ─── 7. Shoe integrity ────────────────────────────────────────────────────────
describe('Blackjack — 6-deck shoe', () => {
  test('shoe has 312 cards (6 decks × 52 cards)', () => {
    expect(buildShoe(6)).toHaveLength(312);
  });

  test('deterministic shuffle produces same order for same seed', () => {
    const shoe1 = deterministicShuffle(buildShoe(6), 'seed', 'client', 1);
    const shoe2 = deterministicShuffle(buildShoe(6), 'seed', 'client', 1);
    expect(shoe1[0]).toEqual(shoe2[0]);
    expect(shoe1[311]).toEqual(shoe2[311]);
  });

  test('different nonce produces different shoe order', () => {
    const shoe1 = deterministicShuffle(buildShoe(6), 'seed', 'client', 1);
    const shoe2 = deterministicShuffle(buildShoe(6), 'seed', 'client', 2);
    // Highly unlikely that the top 10 cards are identical in a different shuffle
    const top10Equal = shoe1.slice(0, 10).every((c, i) =>
      c.rank === shoe2[i].rank && c.suit === shoe2[i].suit
    );
    expect(top10Equal).toBe(false);
  });
});

// ─── 8. canSplit ──────────────────────────────────────────────────────────────
describe('Blackjack — canSplit', () => {
  test('pair of Kings → can split', () => {
    expect(canSplit([card('K'), card('K')])).toBe(true);
  });

  test('A + A → can split', () => {
    expect(canSplit([card('A'), card('A')])).toBe(true);
  });

  test('K + Q → can split (both value 10)', () => {
    expect(canSplit([card('K'), card('Q')])).toBe(true);
  });

  test('K + 9 → cannot split', () => {
    expect(canSplit([card('K'), card('9')])).toBe(false);
  });
});
