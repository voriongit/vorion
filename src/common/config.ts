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

  app: z.object({
    name: z.string().default('vorion'),
    version: z.string().default('0.1.0'),
    environment: z.string().default('development'),
  }),

  telemetry: z.object({
    enabled: z.coerce.boolean().default(false),
    serviceName: z.string().default('vorion-intent'),
    otlpEndpoint: z.string().default('http://localhost:4318/v1/traces'),
    otlpHeaders: z.record(z.string()).default({}),
    sampleRate: z.coerce.number().min(0).max(1).default(1.0),
  }),

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

  intent: z.object({
    defaultNamespace: z.string().default('default'),
    namespaceRouting: z.record(z.string(), z.string()).default({}),
    dedupeTtlSeconds: z.coerce.number().default(600),
    sensitivePaths: z.array(z.string()).default([
      'password',
      'secret',
      'token',
      'apiKey',
      'api_key',
      'accessToken',
      'access_token',
      'refreshToken',
      'refresh_token',
      'credential',
      'ssn',
      'socialSecurityNumber',
      'creditCard',
      'credit_card',
      'cardNumber',
      'card_number',
      'cvv',
      'pin',
      'privateKey',
      'private_key',
    ]),
    defaultMaxInFlight: z.coerce.number().default(1000),
    tenantMaxInFlight: z.record(z.coerce.number()).default({}),
    // Queue configuration
    queueConcurrency: z.coerce.number().default(5),
    jobTimeoutMs: z.coerce.number().default(30000),
    maxRetries: z.coerce.number().default(3),
    retryBackoffMs: z.coerce.number().default(1000),
    eventRetentionDays: z.coerce.number().default(90),
    // Encryption at rest
    encryptContext: z.coerce.boolean().default(true),
    // Trust gates: minimum trust level required per intent type
    trustGates: z.record(z.coerce.number().min(0).max(4)).default({}),
    defaultMinTrustLevel: z.coerce.number().min(0).max(4).default(0),
    // Re-validate trust at decision stage
    revalidateTrustAtDecision: z.coerce.boolean().default(true),
    // GDPR compliance
    softDeleteRetentionDays: z.coerce.number().default(30),
    // Escalation settings
    escalationTimeout: z.string().default('PT1H'), // ISO 8601 duration (1 hour)
    escalationDefaultRecipient: z.string().default('governance-team'),
    // Scheduled jobs
    cleanupCronSchedule: z.string().default('0 2 * * *'), // 2 AM daily
    timeoutCheckCronSchedule: z.string().default('*/5 * * * *'), // Every 5 minutes
  }),

  encryption: z.object({
    key: z.string().min(32).optional(),
    algorithm: z.string().default('aes-256-gcm'),
  }).default({}),
});

export type Config = z.infer<typeof configSchema>;

/**
 * Load configuration from environment
 */
export function loadConfig(): Config {
  return configSchema.parse({
    env: process.env['VORION_ENV'],
    logLevel: process.env['VORION_LOG_LEVEL'],

    app: {
      name: process.env['VORION_APP_NAME'],
      version: process.env['VORION_APP_VERSION'],
      environment: process.env['VORION_ENV'],
    },

    telemetry: {
      enabled: process.env['VORION_TELEMETRY_ENABLED'],
      serviceName: process.env['VORION_TELEMETRY_SERVICE_NAME'],
      otlpEndpoint: process.env['VORION_OTLP_ENDPOINT'],
      otlpHeaders: parseJsonRecord(process.env['VORION_OTLP_HEADERS']),
      sampleRate: process.env['VORION_TELEMETRY_SAMPLE_RATE'],
    },

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
      secret: process.env['VORION_JWT_SECRET'] ?? 'development-secret-change-in-production',
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

    intent: {
      defaultNamespace: process.env['VORION_INTENT_DEFAULT_NAMESPACE'],
      namespaceRouting: parseJsonRecord(process.env['VORION_INTENT_NAMESPACE_ROUTING']),
      dedupeTtlSeconds: process.env['VORION_INTENT_DEDUPE_TTL'],
      sensitivePaths: parseList(process.env['VORION_INTENT_SENSITIVE_PATHS']),
      defaultMaxInFlight: process.env['VORION_INTENT_DEFAULT_MAX_IN_FLIGHT'],
      tenantMaxInFlight: parseNumberRecord(
        process.env['VORION_INTENT_TENANT_LIMITS']
      ),
      queueConcurrency: process.env['VORION_INTENT_QUEUE_CONCURRENCY'],
      jobTimeoutMs: process.env['VORION_INTENT_JOB_TIMEOUT_MS'],
      maxRetries: process.env['VORION_INTENT_MAX_RETRIES'],
      retryBackoffMs: process.env['VORION_INTENT_RETRY_BACKOFF_MS'],
      eventRetentionDays: process.env['VORION_INTENT_EVENT_RETENTION_DAYS'],
      encryptContext: process.env['VORION_INTENT_ENCRYPT_CONTEXT'],
      trustGates: parseNumberRecord(process.env['VORION_INTENT_TRUST_GATES']),
      defaultMinTrustLevel: process.env['VORION_INTENT_DEFAULT_MIN_TRUST_LEVEL'],
      revalidateTrustAtDecision: process.env['VORION_INTENT_REVALIDATE_TRUST'],
      softDeleteRetentionDays: process.env['VORION_INTENT_SOFT_DELETE_RETENTION_DAYS'],
      escalationTimeout: process.env['VORION_INTENT_ESCALATION_TIMEOUT'],
      escalationDefaultRecipient: process.env['VORION_INTENT_ESCALATION_RECIPIENT'],
      cleanupCronSchedule: process.env['VORION_INTENT_CLEANUP_CRON'],
      timeoutCheckCronSchedule: process.env['VORION_INTENT_TIMEOUT_CHECK_CRON'],
    },

    encryption: {
      key: process.env['VORION_ENCRYPTION_KEY'],
      algorithm: process.env['VORION_ENCRYPTION_ALGORITHM'],
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

function parseJsonRecord(value: string | undefined | null) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as Record<string, string>;
    }
    return {};
  } catch {
    return {};
  }
}

function parseList(value: string | undefined | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseNumberRecord(value: string | undefined | null) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === 'object' && parsed !== null) {
      const result: Record<string, number> = {};
      for (const [key, val] of Object.entries(parsed)) {
        const num = Number(val);
        if (!Number.isNaN(num)) {
          result[key] = num;
        }
      }
      return result;
    }
    return {};
  } catch {
    return {};
  }
}
