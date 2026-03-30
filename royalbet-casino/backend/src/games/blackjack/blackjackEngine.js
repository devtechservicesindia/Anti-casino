/**
 * backend/src/games/blackjack/blackjackEngine.js
 *
 * Provably fair Blackjack engine — European rules.
 *
 * RULES:
 *   - 6-deck shoe (312 cards), reshuffled per session
 *   - Dealer hits on soft 16, stands on hard 17+
 *   - Blackjack (Ace + 10-value on first 2 cards) pays 3:2
 *   - Double down allowed on any first 2 cards
 *   - Split pairs once only (max 2 hands)
 *   - No insurance, no surrender
 *
 * RNG:
 *   HMAC-SHA256 shuffle — Fisher-Yates with deterministic random bytes.
 */

import crypto from 'crypto';

// ─── Card Constants ───────────────────────────────────────────────────────────
export const SUITS  = ['♠', '♥', '♦', '♣'];
export const RANKS  = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const RANK_VALUES = {
  'A': 11, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10,
};

// ─── Game States ──────────────────────────────────────────────────────────────
export const STATES = {
  BETTING:     'BETTING',
  DEALING:     'DEALING',
  PLAYER_TURN: 'PLAYER_TURN',
  DEALER_TURN: 'DEALER_TURN',
  RESOLVED:    'RESOLVED',
};

// ─── Build a 6-deck shoe ──────────────────────────────────────────────────────
export function buildShoe(numDecks = 6) {
  const shoe = [];
  for (let d = 0; d < numDecks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        shoe.push({ rank, suit });
      }
    }
  }
  return shoe;
}

// ─── HMAC-SHA256 deterministic shuffle (Fisher-Yates) ─────────────────────────
/**
 * Shuffle using HMAC-SHA256 derived random bytes.
 * For each swap index i (n-1 → 1), generate a deterministic random j ∈ [0,i].
 *
 * @param {Array} arr      Array to shuffle in-place
 * @param {string} serverSeed
 * @param {string} clientSeed
 * @param {number} nonce
 * @returns {Array} shuffled array (same reference)
 */
export function deterministicShuffle(arr, serverSeed, clientSeed, nonce) {
  const n = arr.length;
  // Generate enough random bytes for the whole shuffle
  // We need one 4-byte value per swap step → (n-1) * 4 bytes
  // We'll generate them in chunks of 32 bytes (one HMAC produces 32 bytes)
  const needed = (n - 1) * 4;
  const chunks = Math.ceil(needed / 32);
  let randomBytes = Buffer.alloc(0);

  for (let c = 0; c < chunks; c++) {
    const msg  = `${serverSeed}:${clientSeed}:${nonce}:shuffle:${c}`;
    const hash = crypto.createHmac('sha256', serverSeed).update(msg).digest();
    randomBytes = Buffer.concat([randomBytes, hash]);
  }

  // Fisher-Yates from the end
  for (let i = n - 1; i > 0; i--) {
    const byteOffset = (n - 1 - i) * 4;
    const rand = randomBytes.readUInt32BE(byteOffset);
    const j = rand % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

// ─── Hand Evaluation ──────────────────────────────────────────────────────────
/**
 * Calculate the best total for a hand, handling soft aces correctly.
 *
 * @param {{ rank: string, suit: string }[]} hand
 * @returns {{ total: number, soft: boolean, busted: boolean }}
 */
export function evaluateHand(hand) {
  let total = 0;
  let aces  = 0;

  for (const card of hand) {
    total += RANK_VALUES[card.rank];
    if (card.rank === 'A') aces++;
  }

  // Convert aces from 11 to 1 as needed
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return {
    total,
    soft:   aces > 0,  // still have at least one ace counted as 11
    busted: total > 21,
  };
}

// ─── Blackjack Check ──────────────────────────────────────────────────────────
/**
 * True only if first 2 cards are Ace + 10-value card.
 */
export function isBlackjack(hand) {
  if (hand.length !== 2) return false;
  const hasAce = hand.some(c => c.rank === 'A');
  const hasTen = hand.some(c => RANK_VALUES[c.rank] === 10);
  return hasAce && hasTen;
}

// ─── Can Split ────────────────────────────────────────────────────────────────
export function canSplit(hand) {
  if (hand.length !== 2) return false;
  return RANK_VALUES[hand[0].rank] === RANK_VALUES[hand[1].rank];
}

// ─── Dealer AI ────────────────────────────────────────────────────────────────
/**
 * Dealer hits on soft 16 or less, stands on hard 17+.
 * Returns true if dealer should hit.
 */
export function dealerShouldHit(hand) {
  const { total, soft } = evaluateHand(hand);
  // Hits on soft 16 or below, stands on soft 17+
  if (soft && total <= 16) return true;
  // Hits on hard 16 or below
  if (!soft && total < 17) return true;
  return false;
}

// ─── Resolve Outcome ──────────────────────────────────────────────────────────
/**
 * Determine outcome for a single player hand against dealer.
 *
 * @param {{ rank: string, suit: string }[]} playerHand
 * @param {{ rank: string, suit: string }[]} dealerHand
 * @param {number} betAmount
 * @param {boolean} isDoubled — was this hand doubled?
 * @returns {{ outcome: string, payout: number }}
 *   outcome: 'BLACKJACK' | 'WIN' | 'LOSS' | 'PUSH' | 'BUST'
 *   payout: total returned to player (0 on loss/bust)
 */
export function resolveHand(playerHand, dealerHand, betAmount, isDoubled = false) {
  const effectiveBet     = isDoubled ? betAmount * 2 : betAmount;
  const player           = evaluateHand(playerHand);
  const dealer           = evaluateHand(dealerHand);
  const playerBJ         = isBlackjack(playerHand);
  const dealerBJ         = isBlackjack(dealerHand);

  // Both blackjack → push
  if (playerBJ && dealerBJ) {
    return { outcome: 'PUSH', payout: effectiveBet };
  }

  // Player blackjack → 3:2 (only on non-doubled, non-split natural)
  if (playerBJ && !isDoubled) {
    return { outcome: 'BLACKJACK', payout: effectiveBet + effectiveBet * 1.5 };
  }

  // Dealer blackjack → player loses
  if (dealerBJ) {
    return { outcome: 'LOSS', payout: 0 };
  }

  // Player busted (already handled before dealer plays, but safety)
  if (player.busted) {
    return { outcome: 'BUST', payout: 0 };
  }

  // Dealer busted
  if (dealer.busted) {
    return { outcome: 'WIN', payout: effectiveBet * 2 };
  }

  // Compare totals
  if (player.total > dealer.total) {
    return { outcome: 'WIN', payout: effectiveBet * 2 };
  }
  if (player.total < dealer.total) {
    return { outcome: 'LOSS', payout: 0 };
  }

  // Equal → push
  return { outcome: 'PUSH', payout: effectiveBet };
}

// ─── Create Initial Game Session ──────────────────────────────────────────────
/**
 * Creates the initial game state object stored in Redis.
 */
export function createGameState(userId, betAmount, serverSeed, clientSeed, nonce) {
  // Build and shuffle shoe
  const shoe = buildShoe(6);
  deterministicShuffle(shoe, serverSeed, clientSeed, nonce);

  // Deal: player card, dealer card, player card, dealer card
  const playerHand = [shoe.pop(), shoe.pop()];
  // Dealer gets 2 cards but second is initially hidden
  const dealerHand = [shoe.pop(), shoe.pop()];

  const state = {
    userId,
    betAmount,
    shoe,
    playerHands: [playerHand],   // array of hands (for split support)
    dealerHand,
    activeHandIndex: 0,          // which player hand is active
    handBets: [betAmount],       // bet per hand
    handDoubled: [false],        // doubled flag per hand
    handStood: [false],          // stood flag per hand
    isSplit: false,
    phase: STATES.PLAYER_TURN,
    outcomes: [],                // filled on RESOLVED
    totalPayout: 0,
    serverSeed,
    clientSeed,
    nonce,
    createdAt: Date.now(),
  };

  // Check for immediate blackjack (player or dealer)
  const playerBJ = isBlackjack(playerHand);
  const dealerBJ = isBlackjack(dealerHand);

  if (playerBJ || dealerBJ) {
    // Go straight to resolution
    state.phase = STATES.RESOLVED;
    const result = resolveHand(playerHand, dealerHand, betAmount, false);
    state.outcomes = [result];
    state.totalPayout = result.payout;
  }

  return state;
}

// ─── Deal one card to a hand ──────────────────────────────────────────────────
export function dealCard(gameState, handIndex = 0) {
  const card = gameState.shoe.pop();
  gameState.playerHands[handIndex].push(card);
  return card;
}
