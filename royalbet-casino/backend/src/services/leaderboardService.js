/**
 * backend/src/services/leaderboardService.js
 *
 * Redis sorted set leaderboard + hourly DB sync.
 *
 * Redis keys (scores = cumulative winnings):
 *   lb:daily:{gameType}    — resets daily (24h TTL)
 *   lb:weekly:{gameType}   — resets weekly (7d TTL)
 *   lb:alltime             — never resets
 *
 * '{gameType}' can be: SLOTS, ROULETTE, BLACKJACK, CRASH, POKER, ALL
 *
 * After every win, call recordWin(userId, gameType, winAmount)
 */

import { getRedis } from './redisService.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const GAME_TYPES = ['SLOTS', 'ROULETTE', 'BLACKJACK', 'CRASH', 'POKER'];
const PAGE_SIZE  = 20;

// TTLs (seconds)
const DAILY_TTL  = 86_400;       // 24 hours
const WEEKLY_TTL = 604_800;      // 7 days

// ─── Key helpers ──────────────────────────────────────────────────────────────
function dailyKey(gameType)  { return `lb:daily:${gameType}`; }
function weeklyKey(gameType) { return `lb:weekly:${gameType}`; }
const ALLTIME_KEY = 'lb:alltime';

// ─── Record a win ─────────────────────────────────────────────────────────────
/**
 * Called after every game win. Atomically increments the player's score.
 * @param {string} userId
 * @param {string} gameType  — ONE of GAME_TYPES
 * @param {number} winAmount — raw win amount (not net profit)
 */
export async function recordWin(userId, gameType, winAmount) {
  if (!winAmount || winAmount <= 0) return;
  const redis = getRedis();
  const amount = Number(winAmount);

  const keys = [
    dailyKey(gameType),
    weeklyKey(gameType),
    dailyKey('ALL'),
    weeklyKey('ALL'),
    ALLTIME_KEY,
  ];

  const pipe = redis.pipeline ? redis.pipeline() : null;

  if (pipe) {
    for (const key of keys) {
      pipe.zadd(key, { incr: true }, amount, userId);
    }
    // Set TTL on the keys if they don't have one yet
    pipe.expire(dailyKey(gameType), DAILY_TTL);
    pipe.expire(weeklyKey(gameType), WEEKLY_TTL);
    pipe.expire(dailyKey('ALL'), DAILY_TTL);
    pipe.expire(weeklyKey('ALL'), WEEKLY_TTL);
    await pipe.exec();
  } else {
    // Fallback: sequential (ioredis also supports pipeline)
    for (const key of keys) {
      await redis.zadd(key, { incr: true }, amount, userId);
    }
    await redis.expire(dailyKey(gameType), DAILY_TTL);
    await redis.expire(weeklyKey(gameType), WEEKLY_TTL);
    await redis.expire(dailyKey('ALL'), DAILY_TTL);
    await redis.expire(weeklyKey('ALL'), WEEKLY_TTL);
  }
}

// ─── Get leaderboard page ─────────────────────────────────────────────────────
/**
 * @param {string} period    — 'daily' | 'weekly' | 'alltime'
 * @param {string} gameType  — 'ALL' | 'SLOTS' | 'ROULETTE' | ...
 * @param {number} page      — 1-indexed
 * @param {string} [myUserId]
 * @returns {{ entries, myRank, myScore, totalCount }}
 */
export async function getLeaderboard(period, gameType, page = 1, myUserId = null) {
  const redis = getRedis();
  const key = resolveKey(period, gameType);

  const offset = (page - 1) * PAGE_SIZE;
  const end    = offset + PAGE_SIZE - 1;

  // ZREVRANGE with scores
  const rawEntries = await redis.zrevrangeWithScores(key, offset, end);
  const totalCount = await redis.zcard(key);

  // Fetch usernames + avatars from DB
  const userIds = rawEntries.map(e => e.value);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, avatarUrl: true },
  });
  const userMap = new Map(users.map(u => [u.id, u]));

  const entries = rawEntries.map((e, idx) => ({
    rank:     offset + idx + 1,
    userId:   e.value,
    username: userMap.get(e.value)?.name || 'Unknown',
    avatar:   userMap.get(e.value)?.avatarUrl || null,
    winnings: Math.round(e.score),
  }));

  // My rank
  let myRank = null;
  let myScore = null;
  if (myUserId) {
    const rankRaw = await redis.zrevrank(key, myUserId);
    const scoreRaw = await redis.zscore(key, myUserId);
    if (rankRaw !== null) {
      myRank  = rankRaw + 1;
      myScore = Math.round(Number(scoreRaw));
    }
  }

  return { entries, myRank, myScore, totalCount, page, pageSize: PAGE_SIZE };
}

// ─── Get my ranks across all periods ──────────────────────────────────────────
export async function getMyRanks(userId) {
  const redis  = getRedis();
  const result = {};

  for (const period of ['daily', 'weekly', 'alltime']) {
    result[period] = {};
    for (const gt of ['ALL', ...GAME_TYPES]) {
      const key     = resolveKey(period, gt);
      const rankRaw = await redis.zrevrank(key, userId);
      const score   = await redis.zscore(key, userId);
      result[period][gt] = {
        rank:     rankRaw !== null ? rankRaw + 1 : null,
        winnings: score ? Math.round(Number(score)) : 0,
      };
    }
  }
  return result;
}

// ─── Hourly DB sync (called from setInterval) ─────────────────────────────────
export async function syncLeaderboardToDB() {
  const redis = getRedis();

  for (const period of ['daily', 'weekly', 'alltime']) {
    for (const gt of ['ALL', ...GAME_TYPES]) {
      const key = resolveKey(period, gt);
      const top100 = await redis.zrevrangeWithScores(key, 0, 99);

      for (let i = 0; i < top100.length; i++) {
        const { value: userId, score } = top100[i];
        const prismaPeriod = period === 'alltime' ? 'ALLTIME' : period.toUpperCase();

        await prisma.leaderboardEntry.upsert({
          where: {
            userId_gameType_period: { userId, gameType: gt, period: prismaPeriod },
          },
          update: {
            totalWinnings: Number(score),
            rank: i + 1,
          },
          create: {
            userId,
            gameType:      gt,
            period:        prismaPeriod,
            totalWinnings: Number(score),
            rank:          i + 1,
          },
        });
      }
    }
  }

  console.log('[Leaderboard] DB sync complete:', new Date().toISOString());
}

// ─── Start hourly sync cron ───────────────────────────────────────────────────
export function startLeaderboardSync() {
  const ONE_HOUR = 60 * 60 * 1000;
  setInterval(() => syncLeaderboardToDB().catch(console.error), ONE_HOUR);
  console.log('[Leaderboard] Hourly DB sync scheduled');
}

// ─── Key resolver ─────────────────────────────────────────────────────────────
function resolveKey(period, gameType) {
  const gt = (gameType || 'ALL').toUpperCase();
  switch (period.toLowerCase()) {
    case 'daily':   return dailyKey(gt);
    case 'weekly':  return weeklyKey(gt);
    case 'alltime': return ALLTIME_KEY;       // alltime is all-games only
    default:        return dailyKey('ALL');
  }
}
