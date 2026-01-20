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
    /** Separate rate limit for bulk operations (default: 10 requests per minute) */
    bulkRateLimit: z.coerce.number().default(10),
  }),

  health: z.object({
    // Per-check timeout (database, redis individual checks)
    checkTimeoutMs: z.coerce.number().default(5000),
    // Overall /ready endpoint timeout
    readyTimeoutMs: z.coerce.number().default(10000),
    // Liveness check timeout
    livenessTimeoutMs: z.coerce.number().default(1000),
  }),

  database: z.object({
    host: z.string().default('localhost'),
    port: z.coerce.number().default(5432),
    name: z.string().default('vorion'),
    user: z.string().default('vorion'),
    password: z.string().default(''),
    poolMin: z.coerce.number().min(1).default(10),
    poolMax: z.coerce.number().min(1).default(50),
    poolIdleTimeoutMs: z.coerce.number().min(0).default(10000),
    poolConnectionTimeoutMs: z.coerce.number().min(0).default(5000),
    metricsIntervalMs: z.coerce.number().min(1000).default(5000),
    /**
     * Default statement timeout for database queries in milliseconds.
     * Queries exceeding this timeout will be cancelled by PostgreSQL.
     * Default: 30000 (30 seconds)
     */
    statementTimeoutMs: z.coerce.number().min(1000).max(600000).default(30000),
    /**
     * Extended timeout for long-running queries (reports, exports) in milliseconds.
     * Default: 120000 (2 minutes)
     */
    longQueryTimeoutMs: z.coerce.number().min(1000).max(600000).default(120000),
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
    requireJti: z.coerce.boolean().default(false),
  }).refine(
    (jwt) => {
      const env = process.env['VORION_ENV'] || 'development';
      const isInsecureDefault = jwt.secret === 'development-secret-change-in-production';
      // Block insecure default in production/staging
      if ((env === 'production' || env === 'staging') && isInsecureDefault) {
        return false;
      }
      return true;
    },
    { message: 'VORION_JWT_SECRET must be set to a secure value in production/staging' }
  ),

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
    /**
     * HMAC secret for secure deduplication hash computation.
     * REQUIRED in production/staging to prevent hash prediction attacks.
     * Generate with: openssl rand -base64 32
     */
    dedupeSecret: z.string().min(32).optional(),
    /**
     * Timestamp window for deduplication in seconds.
     * Hashes are computed with a time bucket to prevent replay attacks
     * while allowing legitimate retries within the window.
     * Default: 300 seconds (5 minutes)
     */
    dedupeTimestampWindowSeconds: z.coerce.number().min(60).max(3600).default(300),
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
    // Graceful shutdown timeout in milliseconds
    // Maximum time to wait for in-flight requests and workers to complete during shutdown
    shutdownTimeoutMs: z.coerce.number().min(5000).max(300000).default(30000),
    // Rate limiting configuration per intent type
    rateLimits: z.object({
      default: z.object({
        limit: z.coerce.number().min(1).default(100),
        windowSeconds: z.coerce.number().min(1).default(60),
      }).default({}),
      highRisk: z.object({
        limit: z.coerce.number().min(1).default(10),
        windowSeconds: z.coerce.number().min(1).default(60),
      }).default({}),
      dataExport: z.object({
        limit: z.coerce.number().min(1).default(5),
        windowSeconds: z.coerce.number().min(1).default(60),
      }).default({}),
      adminAction: z.object({
        limit: z.coerce.number().min(1).default(20),
        windowSeconds: z.coerce.number().min(1).default(60),
      }).default({}),
    }).default({}),
    // Policy evaluation circuit breaker configuration (legacy - prefer circuitBreaker.policyEngine)
    policyCircuitBreaker: z.object({
      /** Number of consecutive failures before opening the circuit (default: 5) */
      failureThreshold: z.coerce.number().min(1).max(100).default(5),
      /** Time in milliseconds before attempting to close the circuit (default: 30000) */
      resetTimeoutMs: z.coerce.number().min(1000).max(300000).default(30000),
    }).default({}),
  }),

  // Per-service circuit breaker configuration
  circuitBreaker: z.object({
    database: z.object({
      /** Number of failures before opening the circuit (default: 5) */
      failureThreshold: z.coerce.number().min(1).max(100).default(5),
      /** Time in ms before attempting to close the circuit (default: 30000) */
      resetTimeoutMs: z.coerce.number().min(1000).max(600000).default(30000),
      /** Maximum attempts in half-open state before reopening (default: 3) */
      halfOpenMaxAttempts: z.coerce.number().min(1).max(20).default(3),
      /** Time window in ms to monitor for failures (default: 60000) */
      monitorWindowMs: z.coerce.number().min(1000).max(600000).default(60000),
    }).default({}),
    redis: z.object({
      /** Number of failures before opening the circuit (default: 10) */
      failureThreshold: z.coerce.number().min(1).max(100).default(10),
      /** Time in ms before attempting to close the circuit (default: 10000) */
      resetTimeoutMs: z.coerce.number().min(1000).max(600000).default(10000),
      /** Maximum attempts in half-open state before reopening (default: 5) */
      halfOpenMaxAttempts: z.coerce.number().min(1).max(20).default(5),
      /** Time window in ms to monitor for failures (default: 30000) */
      monitorWindowMs: z.coerce.number().min(1000).max(600000).default(30000),
    }).default({}),
    webhook: z.object({
      /** Number of failures before opening the circuit (default: 3) */
      failureThreshold: z.coerce.number().min(1).max(100).default(3),
      /** Time in ms before attempting to close the circuit (default: 60000) */
      resetTimeoutMs: z.coerce.number().min(1000).max(600000).default(60000),
      /** Maximum attempts in half-open state before reopening (default: 2) */
      halfOpenMaxAttempts: z.coerce.number().min(1).max(20).default(2),
      /** Time window in ms to monitor for failures (default: 120000) */
      monitorWindowMs: z.coerce.number().min(1000).max(600000).default(120000),
    }).default({}),
    policyEngine: z.object({
      /** Number of failures before opening the circuit (default: 5) */
      failureThreshold: z.coerce.number().min(1).max(100).default(5),
      /** Time in ms before attempting to close the circuit (default: 15000) */
      resetTimeoutMs: z.coerce.number().min(1000).max(600000).default(15000),
      /** Maximum attempts in half-open state before reopening (default: 3) */
      halfOpenMaxAttempts: z.coerce.number().min(1).max(20).default(3),
      /** Time window in ms to monitor for failures (default: 60000) */
      monitorWindowMs: z.coerce.number().min(1000).max(600000).default(60000),
    }).default({}),
    trustEngine: z.object({
      /** Number of failures before opening the circuit (default: 5) */
      failureThreshold: z.coerce.number().min(1).max(100).default(5),
      /** Time in ms before attempting to close the circuit (default: 15000) */
      resetTimeoutMs: z.coerce.number().min(1000).max(600000).default(15000),
      /** Maximum attempts in half-open state before reopening (default: 3) */
      halfOpenMaxAttempts: z.coerce.number().min(1).max(20).default(3),
      /** Time window in ms to monitor for failures (default: 60000) */
      monitorWindowMs: z.coerce.number().min(1000).max(600000).default(60000),
    }).default({}),
  }).default({}),

  webhook: z.object({
    // HTTP request timeout for webhook delivery (default: 10s, min: 1s, max: 60s)
    timeoutMs: z.coerce.number().min(1000).max(60000).default(10000),
    // Number of retry attempts for failed webhook deliveries
    retryAttempts: z.coerce.number().min(0).max(10).default(3),
    // Base delay between retries in milliseconds (exponential backoff applied)
    retryDelayMs: z.coerce.number().min(100).max(30000).default(1000),
    // Allow DNS changes between registration and delivery (default: false for security)
    // When false, webhooks are blocked if the resolved IP changes (DNS rebinding protection)
    allowDnsChange: z.coerce.boolean().default(false),
    // Circuit breaker: number of consecutive failures before opening circuit (default: 5)
    circuitFailureThreshold: z.coerce.number().min(1).max(100).default(5),
    // Circuit breaker: time in ms to wait before trying again when circuit is open (default: 5 min)
    circuitResetTimeoutMs: z.coerce.number().min(1000).max(3600000).default(300000),
  }),

  audit: z.object({
    // Enterprise compliance: 365 days (1 year) minimum retention
    // For financial compliance (SOX, etc.), consider 2555 days (7 years)
    retentionDays: z.coerce.number().min(30).default(365),
    // Enable archival instead of hard delete for compliance
    archiveEnabled: z.coerce.boolean().default(true),
    // Move records to archived state after this many days
    archiveAfterDays: z.coerce.number().min(1).default(90),
    // Batch size for cleanup operations
    cleanupBatchSize: z.coerce.number().min(100).max(10000).default(1000),
  }),

  encryption: z.object({
    /**
     * Dedicated encryption key for data at rest (required in production/staging)
     * MUST be at least 32 characters. Generate with: openssl rand -base64 32
     */
    key: z.string().min(32).optional(),
    /**
     * Salt for PBKDF2 key derivation (required in production/staging)
     * MUST be at least 16 characters. Generate with: openssl rand -base64 16
     */
    salt: z.string().min(16).optional(),
    algorithm: z.string().default('aes-256-gcm'),
    /**
     * PBKDF2 iterations - higher is more secure but slower
     * Minimum 100,000 recommended by OWASP
     */
    pbkdf2Iterations: z.coerce.number().min(10000).default(100000),
    /**
     * Key derivation version for future algorithm changes
     * v1 = SHA-256 (legacy, insecure)
     * v2 = PBKDF2-SHA512 (current)
     */
    kdfVersion: z.coerce.number().min(1).max(2).default(2),
  }).default({}),
}).superRefine((config, ctx) => {
  const env = config.env;
  const isProductionOrStaging = env === 'production' || env === 'staging';

  // Validate encryption key is set when encryption is enabled
  if (config.intent.encryptContext && !config.encryption.key) {
    if (isProductionOrStaging) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'VORION_ENCRYPTION_KEY must be set when encryption is enabled in production/staging',
        path: ['encryption', 'key'],
      });
    }
  }

  // Validate encryption salt is set when using PBKDF2 (v2) in production
  if (config.encryption.kdfVersion === 2 && !config.encryption.salt) {
    if (isProductionOrStaging) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'VORION_ENCRYPTION_SALT must be set when using PBKDF2 key derivation in production/staging',
        path: ['encryption', 'salt'],
      });
    }
  }

  // Warn if encryption key is set but fallback to v1 (insecure) in production
  if (isProductionOrStaging && config.encryption.kdfVersion === 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'VORION_ENCRYPTION_KDF_VERSION=1 (legacy SHA-256) is insecure. Migrate to version 2 (PBKDF2-SHA512)',
      path: ['encryption', 'kdfVersion'],
    });
  }

  // Validate database pool settings
  if (config.database.poolMin > config.database.poolMax) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Database poolMin cannot exceed poolMax',
      path: ['database', 'poolMin'],
    });
  }

  // Validate retention settings
  if (config.intent.softDeleteRetentionDays > config.intent.eventRetentionDays) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'softDeleteRetentionDays cannot exceed eventRetentionDays',
      path: ['intent', 'softDeleteRetentionDays'],
    });
  }

  // Validate audit archive settings
  if (config.audit.archiveAfterDays >= config.audit.retentionDays) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'audit.archiveAfterDays must be less than audit.retentionDays',
      path: ['audit', 'archiveAfterDays'],
    });
  }

  // Validate dedupe secret is set in production/staging (security requirement)
  if (isProductionOrStaging && !config.intent.dedupeSecret) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'VORION_DEDUPE_SECRET must be set in production/staging to prevent hash prediction attacks',
      path: ['intent', 'dedupeSecret'],
    });
  }
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
      bulkRateLimit: process.env['VORION_API_BULK_RATE_LIMIT'],
    },

    health: {
      checkTimeoutMs: process.env['VORION_HEALTH_CHECK_TIMEOUT_MS'],
      readyTimeoutMs: process.env['VORION_READY_CHECK_TIMEOUT_MS'],
      livenessTimeoutMs: process.env['VORION_LIVENESS_CHECK_TIMEOUT_MS'],
    },

    database: {
      host: process.env['VORION_DB_HOST'],
      port: process.env['VORION_DB_PORT'],
      name: process.env['VORION_DB_NAME'],
      user: process.env['VORION_DB_USER'],
      password: process.env['VORION_DB_PASSWORD'],
      poolMin: process.env['VORION_DB_POOL_MIN'],
      poolMax: process.env['VORION_DB_POOL_MAX'],
      poolIdleTimeoutMs: process.env['VORION_DB_POOL_IDLE_TIMEOUT'],
      poolConnectionTimeoutMs: process.env['VORION_DB_POOL_CONNECTION_TIMEOUT'],
      metricsIntervalMs: process.env['VORION_DB_METRICS_INTERVAL_MS'],
      statementTimeoutMs: process.env['VORION_DB_STATEMENT_TIMEOUT_MS'],
      longQueryTimeoutMs: process.env['VORION_DB_LONG_QUERY_TIMEOUT_MS'],
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
      requireJti: process.env['VORION_JWT_REQUIRE_JTI'],
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
      dedupeSecret: process.env['VORION_DEDUPE_SECRET'],
      dedupeTimestampWindowSeconds: process.env['VORION_DEDUPE_TIMESTAMP_WINDOW_SECONDS'],
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
      shutdownTimeoutMs: process.env['VORION_SHUTDOWN_TIMEOUT_MS'],
      rateLimits: {
        default: {
          limit: process.env['VORION_RATELIMIT_DEFAULT_LIMIT'],
          windowSeconds: process.env['VORION_RATELIMIT_DEFAULT_WINDOW'],
        },
        highRisk: {
          limit: process.env['VORION_RATELIMIT_HIGH_RISK_LIMIT'],
          windowSeconds: process.env['VORION_RATELIMIT_HIGH_RISK_WINDOW'],
        },
        dataExport: {
          limit: process.env['VORION_RATELIMIT_DATA_EXPORT_LIMIT'],
          windowSeconds: process.env['VORION_RATELIMIT_DATA_EXPORT_WINDOW'],
        },
        adminAction: {
          limit: process.env['VORION_RATELIMIT_ADMIN_ACTION_LIMIT'],
          windowSeconds: process.env['VORION_RATELIMIT_ADMIN_ACTION_WINDOW'],
        },
      },
      policyCircuitBreaker: {
        failureThreshold: process.env['VORION_POLICY_CIRCUIT_FAILURE_THRESHOLD'],
        resetTimeoutMs: process.env['VORION_POLICY_CIRCUIT_RESET_TIMEOUT_MS'],
      },
    },

    circuitBreaker: {
      database: {
        failureThreshold: process.env['VORION_CB_DATABASE_FAILURE_THRESHOLD'],
        resetTimeoutMs: process.env['VORION_CB_DATABASE_RESET_TIMEOUT_MS'],
        halfOpenMaxAttempts: process.env['VORION_CB_DATABASE_HALF_OPEN_MAX_ATTEMPTS'],
        monitorWindowMs: process.env['VORION_CB_DATABASE_MONITOR_WINDOW_MS'],
      },
      redis: {
        failureThreshold: process.env['VORION_CB_REDIS_FAILURE_THRESHOLD'],
        resetTimeoutMs: process.env['VORION_CB_REDIS_RESET_TIMEOUT_MS'],
        halfOpenMaxAttempts: process.env['VORION_CB_REDIS_HALF_OPEN_MAX_ATTEMPTS'],
        monitorWindowMs: process.env['VORION_CB_REDIS_MONITOR_WINDOW_MS'],
      },
      webhook: {
        failureThreshold: process.env['VORION_CB_WEBHOOK_FAILURE_THRESHOLD'],
        resetTimeoutMs: process.env['VORION_CB_WEBHOOK_RESET_TIMEOUT_MS'],
        halfOpenMaxAttempts: process.env['VORION_CB_WEBHOOK_HALF_OPEN_MAX_ATTEMPTS'],
        monitorWindowMs: process.env['VORION_CB_WEBHOOK_MONITOR_WINDOW_MS'],
      },
      policyEngine: {
        failureThreshold: process.env['VORION_CB_POLICY_ENGINE_FAILURE_THRESHOLD'],
        resetTimeoutMs: process.env['VORION_CB_POLICY_ENGINE_RESET_TIMEOUT_MS'],
        halfOpenMaxAttempts: process.env['VORION_CB_POLICY_ENGINE_HALF_OPEN_MAX_ATTEMPTS'],
        monitorWindowMs: process.env['VORION_CB_POLICY_ENGINE_MONITOR_WINDOW_MS'],
      },
      trustEngine: {
        failureThreshold: process.env['VORION_CB_TRUST_ENGINE_FAILURE_THRESHOLD'],
        resetTimeoutMs: process.env['VORION_CB_TRUST_ENGINE_RESET_TIMEOUT_MS'],
        halfOpenMaxAttempts: process.env['VORION_CB_TRUST_ENGINE_HALF_OPEN_MAX_ATTEMPTS'],
        monitorWindowMs: process.env['VORION_CB_TRUST_ENGINE_MONITOR_WINDOW_MS'],
      },
    },

    webhook: {
      timeoutMs: process.env['VORION_WEBHOOK_TIMEOUT_MS'],
      retryAttempts: process.env['VORION_WEBHOOK_RETRY_ATTEMPTS'],
      retryDelayMs: process.env['VORION_WEBHOOK_RETRY_DELAY_MS'],
      allowDnsChange: process.env['VORION_WEBHOOK_ALLOW_DNS_CHANGE'],
      circuitFailureThreshold: process.env['VORION_WEBHOOK_CIRCUIT_FAILURE_THRESHOLD'],
      circuitResetTimeoutMs: process.env['VORION_WEBHOOK_CIRCUIT_RESET_TIMEOUT_MS'],
    },

    audit: {
      retentionDays: process.env['VORION_AUDIT_RETENTION_DAYS'],
      archiveEnabled: process.env['VORION_AUDIT_ARCHIVE_ENABLED'],
      archiveAfterDays: process.env['VORION_AUDIT_ARCHIVE_AFTER_DAYS'],
      cleanupBatchSize: process.env['VORION_AUDIT_CLEANUP_BATCH_SIZE'],
    },

    encryption: {
      key: process.env['VORION_ENCRYPTION_KEY'],
      salt: process.env['VORION_ENCRYPTION_SALT'],
      algorithm: process.env['VORION_ENCRYPTION_ALGORITHM'],
      pbkdf2Iterations: process.env['VORION_ENCRYPTION_PBKDF2_ITERATIONS'],
      kdfVersion: process.env['VORION_ENCRYPTION_KDF_VERSION'],
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
