/**
 * backend/src/services/achievementService.js
 *
 * Achievement engine for RoyalBet Casino.
 *
 * ACHIEVEMENTS:
 *   FIRST_GAME    totalGamesPlayed >= 1
 *   HIGH_ROLLER   any single bet >= 1000
 *   BIG_WIN       any single win >= 5000
 *   STREAK_7      loginStreak >= 7 days
 *   CENTURY       totalGamesPlayed >= 100
 *   DIAMOND_HIT   3x Diamond in slots metadata
 *   REFER_KING    total referrals >= 5
 *   POKER_WIN     win a poker tournament (passed explicitly)
 *
 * Call checkAchievements(userId, triggerType, context) after:
 *   - Every game session end     triggerType: 'GAME_END'
 *   - Every token purchase       triggerType: 'PURCHASE'
 *   - Every login                triggerType: 'LOGIN'
 *   - Explicit poker win         triggerType: 'POKER_WIN'
 *
 * context: { betAmount?, winAmount?, gameType?, metadata?, streak? }
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Achievement definitions (seeded to DB on first run) ──────────────────────
export const ACHIEVEMENT_DEFS = [
  {
    name:           'FIRST_GAME',
    description:    'Play your first casino game',
    icon:           '🎮',
    conditionType:  'totalGamesPlayed',
    conditionValue: 1,
  },
  {
    name:           'HIGH_ROLLER',
    description:    'Place a single bet of 1,000 tokens or more',
    icon:           '💸',
    conditionType:  'singleBet',
    conditionValue: 1000,
  },
  {
    name:           'BIG_WIN',
    description:    'Win 5,000+ tokens in a single game',
    icon:           '🤑',
    conditionType:  'singleWin',
    conditionValue: 5000,
  },
  {
    name:           'STREAK_7',
    description:    'Log in 7 days in a row',
    icon:           '🔥',
    conditionType:  'loginStreak',
    conditionValue: 7,
  },
  {
    name:           'CENTURY',
    description:    'Play 100 casino games',
    icon:           '💯',
    conditionType:  'totalGamesPlayed',
    conditionValue: 100,
  },
  {
    name:           'DIAMOND_HIT',
    description:    'Land 3x Diamonds on the slots',
    icon:           '💎',
    conditionType:  'diamondHit',
    conditionValue: 1,
  },
  {
    name:           'REFER_KING',
    description:    'Successfully refer 5 friends',
    icon:           '👑',
    conditionType:  'totalReferrals',
    conditionValue: 5,
  },
  {
    name:           'POKER_WIN',
    description:    'Win a poker tournament',
    icon:           '♠️',
    conditionType:  'pokerWin',
    conditionValue: 1,
  },
];

// ─── One-time seed on startup ──────────────────────────────────────────────────
export async function seedAchievements() {
  for (const def of ACHIEVEMENT_DEFS) {
    await prisma.achievement.upsert({
      where:  { name: def.name },
      update: { description: def.description, icon: def.icon },
      create: def,
    });
  }
  console.log('[Achievements] Seeded', ACHIEVEMENT_DEFS.length, 'achievements');
}

// ─── Unlock helper ────────────────────────────────────────────────────────────
/**
 * Award an achievement to a user if not already earned.
 * @returns {boolean} true if newly unlocked
 */
async function unlock(userId, achievementName, io) {
  const achievement = await prisma.achievement.findUnique({ where: { name: achievementName } });
  if (!achievement) return false;

  // Skip if already earned
  const existing = await prisma.userAchievement.findUnique({
    where: { userId_achievementId: { userId, achievementId: achievement.id } },
  });
  if (existing) return false;

  await prisma.userAchievement.create({
    data: { userId, achievementId: achievement.id },
  });

  // Emit Socket.IO event to the specific user's room
  if (io) {
    io.to(`user:${userId}`).emit('achievement:unlocked', {
      name:        achievement.name,
      description: achievement.description,
      icon:        achievement.icon,
    });
  }

  console.log(`[Achievement] Unlocked "${achievementName}" for user ${userId}`);
  return true;
}

// ─── Main check function ──────────────────────────────────────────────────────
/**
 * @param {string} userId
 * @param {'GAME_END'|'PURCHASE'|'LOGIN'|'POKER_WIN'} triggerType
 * @param {object} context
 * @param {import('socket.io').Server} [io]
 */
export async function checkAchievements(userId, triggerType, context = {}, io = null) {
  try {
    // ── GAME_END trigger ──────────────────────────────────────────────────
    if (triggerType === 'GAME_END') {
      const { betAmount = 0, winAmount = 0, gameType, metadata } = context;

      // Total games played
      const totalGames = await prisma.gameSession.count({ where: { userId } });
      if (totalGames >= 1)   await unlock(userId, 'FIRST_GAME', io);
      if (totalGames >= 100) await unlock(userId, 'CENTURY', io);

      // Single bet >= 1000
      if (Number(betAmount) >= 1000) {
        await unlock(userId, 'HIGH_ROLLER', io);
      }

      // Single win >= 5000
      if (Number(winAmount) >= 5000) {
        await unlock(userId, 'BIG_WIN', io);
      }

      // Diamond hit in slots — metadata.winningLines contains symbols
      if (gameType === 'SLOTS' && metadata) {
        const meta = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
        const grid = meta?.grid || [];
        // Check if any row has 3 diamonds (symbol 'D' or '💎' or 'DIAMOND')
        const flatGrid = grid.flat ? grid.flat() : [];
        const diamondCount = flatGrid.filter(s =>
          typeof s === 'string'
            ? s.toUpperCase().includes('DIAM') || s === '💎'
            : s?.name?.toUpperCase().includes('DIAM') || s?.symbol === '💎'
        ).length;
        if (diamondCount >= 3) await unlock(userId, 'DIAMOND_HIT', io);
      }
    }

    // ── PURCHASE trigger ─────────────────────────────────────────────────
    if (triggerType === 'PURCHASE') {
      // referral bonus trigger is handled externally, but we check no achievements here
      // (currently no purchase-specific achievements beyond referral)
    }

    // ── LOGIN trigger ─────────────────────────────────────────────────────
    if (triggerType === 'LOGIN') {
      const { streak = 0 } = context;
      if (streak >= 7) await unlock(userId, 'STREAK_7', io);
    }

    // ── POKER_WIN trigger (tournament win) ────────────────────────────────
    if (triggerType === 'POKER_WIN') {
      await unlock(userId, 'POKER_WIN', io);
    }

    // ── REFER_KING — check on any trigger ────────────────────────────────
    const referralCount = await prisma.referral.count({ where: { referrerId: userId, bonusGiven: true } });
    if (referralCount >= 5) await unlock(userId, 'REFER_KING', io);

  } catch (err) {
    // Achievements are non-critical — never block main flow
    console.error('[Achievement] checkAchievements error:', err.message);
  }
}
