/**
 * Redis connection management
 */

import IORedis, { type Redis, type RedisOptions } from 'ioredis';
import { getConfig } from './config.js';
import { createLogger } from './logger.js';
import { withTimeout } from './timeout.js';

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
 *
 * @param timeoutMs - Optional timeout in milliseconds (defaults to config value)
 */
export async function checkRedisHealth(timeoutMs?: number): Promise<{
  healthy: boolean;
  latencyMs?: number;
  error?: string;
  timedOut?: boolean;
}> {
  const client = getRedis();
  const config = getConfig();
  const timeout = timeoutMs ?? config.health.checkTimeoutMs;
  const start = performance.now();

  try {
    const result = await withTimeout(
      client.ping(),
      timeout,
      'Redis health check timed out'
    );
    const latencyMs = Math.round(performance.now() - start);

    if (result === 'PONG') {
      return { healthy: true, latencyMs };
    }
    return { healthy: false, latencyMs, error: `Unexpected response: ${String(result)}` };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - start);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isTimeout = errorMessage.includes('timed out');

    if (isTimeout) {
      redisLogger.warn({ latencyMs, timeoutMs: timeout }, 'Redis health check timed out');
    }

    return {
      healthy: false,
      latencyMs,
      error: errorMessage,
      timedOut: isTimeout,
    };
  }
}
