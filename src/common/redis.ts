/**
 * Redis connection management
 */

import IORedis, { type Redis, type RedisOptions } from 'ioredis';
import { getConfig } from './config.js';
import { createLogger } from './logger.js';

const redisLogger = createLogger({ component: 'redis' });

let redisClient: Redis | null = null;

export function getRedis(): Redis {
  if (!redisClient) {
    const config = getConfig();
    const redisOptions: RedisOptions = {
      host: config.redis.host,
      port: config.redis.port,
      db: config.redis.db,
      lazyConnect: false,
    };

    // Only include password if defined
    if (config.redis.password) {
      redisOptions.password = config.redis.password;
    }

    redisClient = new IORedis(redisOptions);

    redisClient.on('error', (error) => {
      redisLogger.error({ error }, 'Redis connection error');
    });

    redisClient.on('connect', () => {
      redisLogger.info('Redis connected');
    });
  }

  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

/**
 * Check Redis health by running a PING command.
 * Returns true if Redis is healthy, false otherwise.
 */
export async function checkRedisHealth(): Promise<{
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const client = getRedis();
  const start = performance.now();

  try {
    const result = await client.ping();
    const latencyMs = Math.round(performance.now() - start);

    if (result === 'PONG') {
      return { healthy: true, latencyMs };
    }
    return { healthy: false, latencyMs, error: `Unexpected response: ${result}` };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      healthy: false,
      latencyMs,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
