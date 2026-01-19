/**
 * Configuration management for Vorion
 */

import { z } from 'zod';

/**
 * Environment configuration schema
 */
const configSchema = z.object({
  env: z.enum(['development', 'staging', 'production']).default('development'),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  api: z.object({
    port: z.coerce.number().default(3000),
    host: z.string().default('localhost'),
    basePath: z.string().default('/api/v1'),
    timeout: z.coerce.number().default(30000),
    rateLimit: z.coerce.number().default(1000),
  }),

  database: z.object({
    host: z.string().default('localhost'),
    port: z.coerce.number().default(5432),
    name: z.string().default('vorion'),
    user: z.string().default('vorion'),
    password: z.string().default(''),
    poolMin: z.coerce.number().default(5),
    poolMax: z.coerce.number().default(20),
  }),

  redis: z.object({
    host: z.string().default('localhost'),
    port: z.coerce.number().default(6379),
    password: z.string().optional(),
    db: z.coerce.number().default(0),
  }),

  jwt: z.object({
    secret: z.string().min(32),
    expiration: z.string().default('1h'),
    refreshExpiration: z.string().default('7d'),
  }),

  proof: z.object({
    storage: z.enum(['local', 's3', 'gcs']).default('local'),
    localPath: z.string().default('./data/proofs'),
    retentionDays: z.coerce.number().default(2555),
  }),

  trust: z.object({
    calcInterval: z.coerce.number().default(1000),
    cacheTtl: z.coerce.number().default(30),
    decayRate: z.coerce.number().default(0.01),
  }),

  basis: z.object({
    evalTimeout: z.coerce.number().default(100),
    maxRules: z.coerce.number().default(10000),
    cacheEnabled: z.coerce.boolean().default(true),
  }),

  cognigate: z.object({
    timeout: z.coerce.number().default(300000),
    maxConcurrent: z.coerce.number().default(100),
    maxMemoryMb: z.coerce.number().default(512),
    maxCpuPercent: z.coerce.number().default(50),
  }),
});

export type Config = z.infer<typeof configSchema>;

/**
 * Load configuration from environment
 */
export function loadConfig(): Config {
  const env = process.env['VORION_ENV'] ?? 'development';
  const isProduction = env === 'production' || env === 'staging';

  // Critical security check: JWT secret must be set in production
  const jwtSecret = process.env['VORION_JWT_SECRET'];
  if (isProduction && !jwtSecret) {
    throw new Error(
      'CRITICAL: VORION_JWT_SECRET environment variable must be set in production/staging. ' +
      'Generate a secure secret with: openssl rand -base64 64'
    );
  }
  if (isProduction && jwtSecret && jwtSecret.length < 32) {
    throw new Error(
      'CRITICAL: VORION_JWT_SECRET must be at least 32 characters in production/staging.'
    );
  }

  return configSchema.parse({
    env,
    logLevel: process.env['VORION_LOG_LEVEL'],

    api: {
      port: process.env['VORION_API_PORT'],
      host: process.env['VORION_API_HOST'],
      basePath: process.env['VORION_API_BASE_PATH'],
      timeout: process.env['VORION_API_TIMEOUT'],
      rateLimit: process.env['VORION_API_RATE_LIMIT'],
    },

    database: {
      host: process.env['VORION_DB_HOST'],
      port: process.env['VORION_DB_PORT'],
      name: process.env['VORION_DB_NAME'],
      user: process.env['VORION_DB_USER'],
      password: process.env['VORION_DB_PASSWORD'],
      poolMin: process.env['VORION_DB_POOL_MIN'],
      poolMax: process.env['VORION_DB_POOL_MAX'],
    },

    redis: {
      host: process.env['VORION_REDIS_HOST'],
      port: process.env['VORION_REDIS_PORT'],
      password: process.env['VORION_REDIS_PASSWORD'],
      db: process.env['VORION_REDIS_DB'],
    },

    jwt: {
      // Only use fallback in development - production requires explicit secret
      secret: jwtSecret ?? (isProduction ? '' : 'dev-only-insecure-secret-do-not-use-in-prod'),
      expiration: process.env['VORION_JWT_EXPIRATION'],
      refreshExpiration: process.env['VORION_REFRESH_TOKEN_EXPIRATION'],
    },

    proof: {
      storage: process.env['VORION_PROOF_STORAGE'] as 'local' | 's3' | 'gcs',
      localPath: process.env['VORION_PROOF_LOCAL_PATH'],
      retentionDays: process.env['VORION_PROOF_RETENTION_DAYS'],
    },

    trust: {
      calcInterval: process.env['VORION_TRUST_CALC_INTERVAL'],
      cacheTtl: process.env['VORION_TRUST_CACHE_TTL'],
      decayRate: process.env['VORION_TRUST_DECAY_RATE'],
    },

    basis: {
      evalTimeout: process.env['VORION_BASIS_EVAL_TIMEOUT'],
      maxRules: process.env['VORION_BASIS_MAX_RULES'],
      cacheEnabled: process.env['VORION_BASIS_CACHE_ENABLED'],
    },

    cognigate: {
      timeout: process.env['VORION_COGNIGATE_TIMEOUT'],
      maxConcurrent: process.env['VORION_COGNIGATE_MAX_CONCURRENT'],
      maxMemoryMb: process.env['VORION_COGNIGATE_MAX_MEMORY_MB'],
      maxCpuPercent: process.env['VORION_COGNIGATE_MAX_CPU_PERCENT'],
    },
  });
}

// Singleton config instance
let configInstance: Config | null = null;

/**
 * Get configuration (loads once)
 */
export function getConfig(): Config {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}
