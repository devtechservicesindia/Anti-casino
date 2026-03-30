/**
 * backend/src/games/poker/pokerEngine.js
 *
 * Deck management and hand evaluation for Texas Hold'em.
 *
 * HAND RANKINGS (highest to lowest):
 *   Royal Flush > Straight Flush > Four of a Kind > Full House
 *   > Flush > Straight > Three of a Kind > Two Pair > Pair > High Card
 *
 * RNG: HMAC-SHA256 Fisher-Yates shuffle (same scheme as Blackjack).
 */

import crypto from 'crypto';

// ─── Card Constants ───────────────────────────────────────────────────────────
export const SUITS = ['s', 'h', 'd', 'c']; // spades, hearts, diamonds, clubs
export const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
export const RANK_VALUE = {
  '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14,
};

// Hand rank tiers (higher = better)
export const HAND_RANKS = {
  HIGH_CARD:       0,
  PAIR:            1,
  TWO_PAIR:        2,
  THREE_OF_A_KIND: 3,
  STRAIGHT:        4,
  FLUSH:           5,
  FULL_HOUSE:      6,
  FOUR_OF_A_KIND:  7,
  STRAIGHT_FLUSH:  8,
  ROYAL_FLUSH:     9,
};

export const HAND_NAMES = {
  0: 'High Card',
  1: 'Pair',
  2: 'Two Pair',
  3: 'Three of a Kind',
  4: 'Straight',
  5: 'Flush',
  6: 'Full House',
  7: 'Four of a Kind',
  8: 'Straight Flush',
  9: 'Royal Flush',
};

// ─── Build a standard 52-card deck ────────────────────────────────────────────
export function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

// ─── HMAC-SHA256 deterministic shuffle (Fisher-Yates) ─────────────────────────
export function shuffleDeck(deck, serverSeed, clientSeed, nonce) {
  const n = deck.length;
  const needed = (n - 1) * 4;
  const chunks = Math.ceil(needed / 32);
  let randomBytes = Buffer.alloc(0);

  for (let c = 0; c < chunks; c++) {
    const msg  = `${serverSeed}:${clientSeed}:${nonce}:pokershuffle:${c}`;
    const hash = crypto.createHmac('sha256', serverSeed).update(msg).digest();
    randomBytes = Buffer.concat([randomBytes, hash]);
  }

  for (let i = n - 1; i > 0; i--) {
    const byteOffset = (n - 1 - i) * 4;
    const rand = randomBytes.readUInt32BE(byteOffset);
    const j = rand % (i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

// ─── Deal cards from top of deck ──────────────────────────────────────────────
export function dealCards(deck, count) {
  return deck.splice(0, count);
}

// ─── Hand Evaluation ──────────────────────────────────────────────────────────

/**
 * Generate all C(n,5) combinations from an array.
 */
function combinations(arr, k) {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map(c => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

/**
 * Evaluate a 5-card hand.
 * @param {{ rank: string, suit: string }[]} cards — exactly 5 cards
 * @returns {{ tier: number, kickers: number[], name: string }}
 */
function evaluate5(cards) {
  const values = cards.map(c => RANK_VALUE[c.rank]).sort((a, b) => b - a);
  const suits  = cards.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);

  // Check straight (including A-low: A,2,3,4,5)
  let isStraight = false;
  let straightHigh = 0;

  // Normal straight check
  const unique = [...new Set(values)].sort((a, b) => b - a);
  if (unique.length >= 5) {
    for (let i = 0; i <= unique.length - 5; i++) {
      if (unique[i] - unique[i + 4] === 4) {
        isStraight = true;
        straightHigh = unique[i];
        break;
      }
    }
    // A-low straight: A,5,4,3,2
    if (!isStraight && unique.includes(14) && unique.includes(5) &&
        unique.includes(4) && unique.includes(3) && unique.includes(2)) {
      isStraight = true;
      straightHigh = 5; // 5-high straight
    }
  }

  // Count ranks
  const counts = {};
  for (const v of values) {
    counts[v] = (counts[v] || 0) + 1;
  }
  const groups = Object.entries(counts)
    .map(([val, cnt]) => ({ val: Number(val), cnt }))
    .sort((a, b) => b.cnt - a.cnt || b.val - a.val);

  // Royal Flush
  if (isFlush && isStraight && straightHigh === 14) {
    return { tier: HAND_RANKS.ROYAL_FLUSH, kickers: [14], name: HAND_NAMES[9] };
  }

  // Straight Flush
  if (isFlush && isStraight) {
    return { tier: HAND_RANKS.STRAIGHT_FLUSH, kickers: [straightHigh], name: HAND_NAMES[8] };
  }

  // Four of a Kind
  if (groups[0].cnt === 4) {
    const quad = groups[0].val;
    const kicker = groups[1].val;
    return { tier: HAND_RANKS.FOUR_OF_A_KIND, kickers: [quad, kicker], name: HAND_NAMES[7] };
  }

  // Full House
  if (groups[0].cnt === 3 && groups[1].cnt === 2) {
    return { tier: HAND_RANKS.FULL_HOUSE, kickers: [groups[0].val, groups[1].val], name: HAND_NAMES[6] };
  }

  // Flush
  if (isFlush) {
    return { tier: HAND_RANKS.FLUSH, kickers: values, name: HAND_NAMES[5] };
  }

  // Straight
  if (isStraight) {
    return { tier: HAND_RANKS.STRAIGHT, kickers: [straightHigh], name: HAND_NAMES[4] };
  }

  // Three of a Kind
  if (groups[0].cnt === 3) {
    const trips = groups[0].val;
    const kickers = groups.filter(g => g.cnt === 1).map(g => g.val).sort((a, b) => b - a);
    return { tier: HAND_RANKS.THREE_OF_A_KIND, kickers: [trips, ...kickers], name: HAND_NAMES[3] };
  }

  // Two Pair
  if (groups[0].cnt === 2 && groups[1].cnt === 2) {
    const high = Math.max(groups[0].val, groups[1].val);
    const low  = Math.min(groups[0].val, groups[1].val);
    const kicker = groups[2].val;
    return { tier: HAND_RANKS.TWO_PAIR, kickers: [high, low, kicker], name: HAND_NAMES[2] };
  }

  // Pair
  if (groups[0].cnt === 2) {
    const pair = groups[0].val;
    const kickers = groups.filter(g => g.cnt === 1).map(g => g.val).sort((a, b) => b - a);
    return { tier: HAND_RANKS.PAIR, kickers: [pair, ...kickers], name: HAND_NAMES[1] };
  }

  // High Card
  return { tier: HAND_RANKS.HIGH_CARD, kickers: values, name: HAND_NAMES[0] };
}

/**
 * Find the best 5-card hand from 7 cards (2 hole + 5 community).
 * @param {{ rank: string, suit: string }[]} holeCards  — 2 cards
 * @param {{ rank: string, suit: string }[]} community  — 3-5 cards
 * @returns {{ tier: number, kickers: number[], name: string, bestCards: object[] }}
 */
export function evaluateBestHand(holeCards, community) {
  const allCards = [...holeCards, ...community];
  const combos = combinations(allCards, 5);

  let best = null;

  for (const combo of combos) {
    const result = evaluate5(combo);
    if (!best || compareHands(result, best) > 0) {
      best = { ...result, bestCards: combo };
    }
  }

  return best;
}

/**
 * Compare two evaluated hands. Returns >0 if a wins, <0 if b wins, 0 if tie.
 */
export function compareHands(a, b) {
  if (a.tier !== b.tier) return a.tier - b.tier;
  // Compare kickers in order
  for (let i = 0; i < Math.min(a.kickers.length, b.kickers.length); i++) {
    if (a.kickers[i] !== b.kickers[i]) return a.kickers[i] - b.kickers[i];
  }
  return 0;
}

/**
 * Determine winners among multiple players.
 * @param {{ userId: string, holeCards: object[], ... }[]} players
 * @param {object[]} community
 * @returns {{ winners: string[], handName: string, hands: Map }}
 */
export function determineWinners(players, community) {
  const hands = new Map();

  for (const p of players) {
    const result = evaluateBestHand(p.holeCards, community);
    hands.set(p.userId, result);
  }

  // Find best hand
  let bestResult = null;
  for (const [, result] of hands) {
    if (!bestResult || compareHands(result, bestResult) > 0) {
      bestResult = result;
    }
  }

  // Find all players tied with best
  const winners = [];
  for (const [userId, result] of hands) {
    if (compareHands(result, bestResult) === 0) {
      winners.push(userId);
    }
  }

  return { winners, handName: bestResult.name, hands };
}
