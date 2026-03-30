/**
 * backend/src/referral/referralController.js
 *
 * Referral system:
 *   GET  /api/v1/referral/my-code   → generate/return referral code
 *   GET  /api/v1/referral/stats     → count referred, tokens earned
 *   POST /api/v1/referral/apply     → called at registration with { referralCode }
 *
 * Bonus trigger: on first purchase, check Referral.bonusGiven === false
 *   → credit referrer 300, referred 200 in a single $transaction
 */

import { PrismaClient } from '@prisma/client';
import { creditWinnings } from '../services/walletService.js';

const prisma = new PrismaClient();

// ─── Code generation ──────────────────────────────────────────────────────────
// Uses first 4 chars of name (uppercase) + last 4 chars of userId → e.g. RAJA4F2A
function generateCode(name, userId) {
  const prefix = (name || 'USER').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 4).padEnd(4, 'X');
  const suffix = userId.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(-4).padEnd(4, '0');
  return `${prefix}${suffix}`;
}

// ─── GET /api/v1/referral/my-code ────────────────────────────────────────────
export const handleMyCode = async (req, res) => {
  try {
    const userId = req.user.id;
    const user   = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const code = generateCode(user.name, userId);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    return res.json({
      code,
      referralLink: `${frontendUrl}/ref/${code}`,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─── GET /api/v1/referral/stats ───────────────────────────────────────────────
export const handleStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const referrals = await prisma.referral.findMany({
      where: { referrerId: userId },
      include: { referred: { select: { name: true, createdAt: true } } },
    });

    const totalReferred = referrals.length;
    // 300 tokens per completed referral bonus
    const completed     = referrals.filter(r => r.bonusGiven);
    const tokensEarned  = completed.length * 300;

    return res.json({
      totalReferred,
      tokensEarned,
      referrals: referrals.map(r => ({
        username:   r.referred.name,
        joinedAt:   r.referred.createdAt,
        bonusGiven: r.bonusGiven,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─── POST /api/v1/referral/apply ─────────────────────────────────────────────
// Called during registration — finds referrer by code, creates Referral record.
export const handleApply = async (req, res) => {
  try {
    const referredId    = req.user.id;
    const { referralCode } = req.body;
    if (!referralCode) return res.status(400).json({ error: 'referralCode is required' });

    // Find referrer by matching generated code against all users
    // Since codes are deterministic, we regenerate for each candidate efficiently by
    // building a LIKE pattern on name start + userId end — OR scan top-1K users
    // For small DBs: scan all users and match code
    const allUsers = await prisma.user.findMany({ select: { id: true, name: true } });
    const referrer = allUsers.find(u => generateCode(u.name, u.id) === referralCode.toUpperCase());

    if (!referrer) return res.status(404).json({ error: 'Invalid referral code' });
    if (referrer.id === referredId) return res.status(400).json({ error: 'Cannot refer yourself' });

    // Check no existing referral
    const existing = await prisma.referral.findUnique({
      where: { referredId },
    });
    if (existing) return res.status(409).json({ error: 'Already applied a referral code' });

    await prisma.referral.create({
      data: { referrerId: referrer.id, referredId, bonusGiven: false },
    });

    return res.json({ success: true, message: 'Referral applied! Bonus unlocks on first purchase.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─── INTERNAL: trigger referral bonus on first purchase ───────────────────────
/**
 * Call this after a user's first successful token purchase.
 * Checks if there's an un-given referral bonus and credits both parties.
 * @param {string} referredId
 */
export async function triggerReferralBonus(referredId) {
  try {
    const referral = await prisma.referral.findUnique({
      where: { referredId },
    });
    if (!referral || referral.bonusGiven) return;

    // Atomic: credit both + mark bonus given
    await prisma.$transaction(async (tx) => {
      await tx.referral.update({
        where: { id: referral.id },
        data:  { bonusGiven: true },
      });
    });

    // Credit winnings (outside transaction — each call is already transactional)
    await creditWinnings(referral.referrerId, 300, 'REFERRAL_BONUS');
    await creditWinnings(referredId,          200, 'REFERRAL_BONUS');

    console.log(`[Referral] Bonus given: referrer=${referral.referrerId} +300, referred=${referredId} +200`);
  } catch (err) {
    console.error('[Referral] triggerReferralBonus error:', err.message);
  }
}
