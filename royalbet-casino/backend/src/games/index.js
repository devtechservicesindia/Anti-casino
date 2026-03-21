// games/index.js – Server-side game logic modules
// All RNG and payout logic lives here; results are verified server-side before
// any funds are credited. The frontend (PixiJS) is for display only.
//
// Planned modules:
//   slots.game.js    – Slot machine RNG, payline evaluation, RTP enforcement
//   roulette.game.js – Roulette outcome generation, bet type resolution
//   crash.game.js    – Crash game multiplier curve, cashout handling
