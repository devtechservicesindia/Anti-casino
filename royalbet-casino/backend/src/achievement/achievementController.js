/**
 * backend/src/achievement/achievementController.js
 *
 * GET /api/v1/achievements/me
 *   → earned UserAchievements + all Achievement definitions (locked ones too)
 *   → return { earned:[...], locked:[...] }
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const handleMe = async (req, res) => {
  try {
    const userId = req.user.id;

    // All achievement defs
    const allAchievements = await prisma.achievement.findMany({
      orderBy: { conditionValue: 'asc' },
    });

    // User's earned achievements
    const userAchievements = await prisma.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true, earnedAt: true },
    });
    const earnedIds = new Map(userAchievements.map(ua => [ua.achievementId, ua.earnedAt]));

    const earned = [];
    const locked = [];

    for (const ach of allAchievements) {
      const entry = {
        id:             ach.id,
        name:           ach.name,
        description:    ach.description,
        icon:           ach.icon,
        conditionType:  ach.conditionType,
        conditionValue: ach.conditionValue,
      };
      if (earnedIds.has(ach.id)) {
        earned.push({ ...entry, earnedAt: earnedIds.get(ach.id) });
      } else {
        locked.push(entry);
      }
    }

    return res.json({ earned, locked });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
