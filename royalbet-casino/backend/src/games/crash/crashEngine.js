/**
 * backend/src/games/crash/crashEngine.js
 *
 * Provably fair crash point generation.
 *
 * FORMULA (implement exactly):
 *   serverSeed = crypto.randomBytes(32).toString('hex')
 *   hash = HMAC-SHA256(serverSeed, roundId.toString()).hex()
 *   h = parseInt(hash.slice(0,8), 16)
 *   crashPoint = Math.max(1.00, (0.99 / (1 - h / 0xFFFFFFFF)))
 *   Cap at 1000x maximum.
 */

import crypto from 'crypto';

/**
 * Generate a new server seed for a round.
 * @returns {string} 64-char hex string
 */
export function generateServerSeed() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Compute crash point from serverSeed + roundId.
 * @param {string} serverSeed
 * @param {number|string} roundId
 * @returns {number} crash multiplier (1.00 – 1000.00)
 */
export function computeCrashPoint(serverSeed, roundId) {
  const hash = crypto
    .createHmac('sha256', serverSeed)
    .update(roundId.toString())
    .digest('hex');

  const h = parseInt(hash.slice(0, 8), 16);
  const raw = 0.99 / (1 - h / 0xFFFFFFFF);
  const capped = Math.min(raw, 1000);
  const crashPoint = Math.max(1.00, capped);

  // Round to 2 decimal places
  return +crashPoint.toFixed(2);
}

/**
 * Compute the current multiplier for a running round.
 * Uses exponential growth: multiplier = e^(t * SPEED)
 * where t = elapsed seconds since start.
 *
 * @param {number} elapsedMs — milliseconds since round started
 * @returns {number} current multiplier (2 decimal places)
 */
export function getMultiplierAtTime(elapsedMs) {
  const SPEED = 0.00006; // growth rate per ms (~6% per second)
  const multiplier = Math.pow(Math.E, SPEED * elapsedMs);
  return +multiplier.toFixed(2);
}

/**
 * Compute time (ms) at which a given multiplier is reached.
 * Inverse of getMultiplierAtTime.
 *
 * @param {number} targetMultiplier
 * @returns {number} milliseconds
 */
export function getTimeForMultiplier(targetMultiplier) {
  const SPEED = 0.00006;
  return Math.log(targetMultiplier) / SPEED;
}
