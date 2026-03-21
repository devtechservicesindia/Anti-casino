/**
 * services/redisService.js
 * Singleton ioredis client — imported by any service that needs Redis.
 */

import Redis from 'ioredis';

let redisClient = null;

export function getRedis() {
  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    redisClient.on('connect',  () => console.log('[Redis] Connected'));
    redisClient.on('error',    (err) => console.error('[Redis] Error:', err.message));
    redisClient.on('reconnecting', () => console.warn('[Redis] Reconnecting…'));
  }
  return redisClient;
}

export async function disconnectRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
