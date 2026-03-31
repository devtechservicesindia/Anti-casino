/**
 * services/redisService.js
 * Singleton ioredis client — imported by any service that needs Redis.
 * Redis is OPTIONAL in development. If REDIS_URL is not set or Redis is
 * unavailable, a no-op stub is returned so the server still starts.
 */

import Redis from 'ioredis';

let redisClient = null;
let redisAvailable = false;

// No-op stub: used when Redis is not configured / unreachable.
// This covers every Redis command used anywhere in the codebase.
const noopPipeline = {
  incr: () => noopPipeline,
  expire: () => noopPipeline,
  set: () => noopPipeline,
  setex: () => noopPipeline,
  get: () => noopPipeline,
  del: () => noopPipeline,
  exists: () => noopPipeline,
  ttl: () => noopPipeline,
  hset: () => noopPipeline,
  hget: () => noopPipeline,
  hdel: () => noopPipeline,
  hgetall: () => noopPipeline,
  zadd: () => noopPipeline,
  zrange: () => noopPipeline,
  zrevrange: () => noopPipeline,
  zrangebyscore: () => noopPipeline,
  zrem: () => noopPipeline,
  exec: async () => [],
};

const noopRedis = {
  // String ops
  get:    async () => null,
  set:    async () => 'OK',
  setex:  async () => 'OK',
  del:    async () => 0,
  exists: async () => 0,
  incr:   async () => 1,
  incrby: async () => 1,
  decr:   async () => 0,
  decrby: async () => 0,
  // Expiry
  expire: async () => 1,
  expireat: async () => 1,
  ttl:    async () => -1,
  pttl:   async () => -1,
  persist: async () => 0,
  // Hash ops
  hset:   async () => 1,
  hget:   async () => null,
  hmget:  async () => [],
  hmset:  async () => 'OK',
  hgetall: async () => null,
  hdel:   async () => 0,
  hexists: async () => 0,
  hkeys:  async () => [],
  hvals:  async () => [],
  hlen:   async () => 0,
  // Set ops
  sadd:   async () => 1,
  srem:   async () => 0,
  smembers: async () => [],
  sismember: async () => 0,
  // Sorted set ops — extended (ioredis-specific method names)
  zadd:   async () => 1,
  zrem:   async () => 0,
  zscore: async () => null,
  zrange: async () => [],
  zrevrange: async () => [],
  zrangebyscore: async () => [],
  zrevrangebyscore: async () => [],
  zrangeWithScores: async () => [],          // ioredis returns [{value,score}]
  zrevrangeWithScores: async () => [],       // used by leaderboardService
  zrank:  async () => null,
  zrevrank: async () => null,
  zcard:  async () => 0,
  zincrby: async () => '0',
  incrbyfloat: async () => '0',              // used by slotsController
  setnx:  async () => 1,
  // List ops
  lpush:  async () => 1,
  rpush:  async () => 1,
  lrange: async () => [],
  llen:   async () => 0,
  // Misc
  keys:   async () => [],
  scan:   async () => ['0', []],
  type:   async () => 'none',
  rename: async () => 'OK',
  // Pipeline / multi
  pipeline: () => noopPipeline,
  multi:    () => noopPipeline,
  // Connection
  quit:   async () => 'OK',
  ping:   async () => 'PONG',
  // Event emitter (no-op)
  on:     () => noopRedis,
  once:   () => noopRedis,
  off:    () => noopRedis,
  emit:   () => false,
  // Status
  status: 'ready',
};


export function getRedis() {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[Redis] REDIS_URL not set — running without Redis (dev mode). Some features (rate-limiting, token blocklist) will be skipped.');
      }
      redisClient = noopRedis;
      return redisClient;
    }

    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 2) {
          console.warn('[Redis] Could not connect — continuing without Redis.');
          redisClient = noopRedis;
          return null; // stop retrying
        }
        return Math.min(times * 200, 1000);
      },
    });

    client.on('connect', () => {
      redisAvailable = true;
      console.log('[Redis] Connected');
    });
    client.on('error', (err) => {
      if (redisAvailable) console.error('[Redis] Error:', err.message);
    });
    client.on('reconnecting', () => console.warn('[Redis] Reconnecting…'));

    redisClient = client;
  }
  return redisClient;
}

export async function disconnectRedis() {
  if (redisClient && redisClient !== noopRedis) {
    await redisClient.quit();
    redisClient = null;
  }
}

