/**
 * Centralized Configuration Management
 *
 * Single source of truth for all environment variables and configuration.
 * Uses Zod for runtime validation to catch configuration errors early.
 */

import { z } from 'zod'

/**
 * Get URL configuration based on environment
 * Centralizes all domain-related URLs for easy management
 */
function getUrls() {
  const env = process.env.NEXT_PUBLIC_ENV || process.env.NODE_ENV || 'development'
  const isProduction = env === 'production'

  // Base URLs from environment or defaults
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || (isProduction ? 'https://app.agentanchorai.com' : 'http://localhost:3000')
  const marketingUrl = process.env.NEXT_PUBLIC_MARKETING_URL || (isProduction ? 'https://agentanchorai.com' : 'http://localhost:3001')
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || appUrl
  const docsUrl = process.env.NEXT_PUBLIC_DOCS_URL || `${marketingUrl}/docs`

  return {
    app: appUrl,
    marketing: marketingUrl,
    api: apiUrl,
    docs: docsUrl,
    // Derived URLs for services
    verify: `${marketingUrl}/verify`,
    badges: `${marketingUrl}/badges`,
    apiBadges: `${appUrl}/api/badges`,
    jwks: `${appUrl}/.well-known/jwks.json`,
    // Issuer for JWT tokens
    issuer: marketingUrl,
    apiIssuer: apiUrl.replace('app.', 'api.'),
    // Support contacts
    supportEmail: process.env.SUPPORT_EMAIL || 'support@agentanchorai.com',
    enterpriseEmail: process.env.ENTERPRISE_EMAIL || 'enterprise@agentanchorai.com',
  }
}

/**
 * Determine CORS origins based on environment.
 * - In production/staging: requires explicit CORS_ORIGINS or uses APP_URL
 * - In development: allows localhost origins
 * - Never defaults to '*' in production
 */
function getCorsOrigins(): string[] {
  // If explicitly set, use that
  if (process.env.CORS_ORIGINS) {
    return process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  }

  const env = process.env.NEXT_PUBLIC_ENV || process.env.NODE_ENV || 'development'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  // Production/staging: require explicit origins or derive from APP_URL
  if (env === 'production' || env === 'staging') {
    if (appUrl) {
      // Include the app URL and common subdomains
      const url = new URL(appUrl)
      return [
        appUrl,
        `https://${url.hostname}`,
        `https://app.${url.hostname}`,
      ]
    }
    // Fallback for production: derive from URL config
    const urls = getUrls()
    return [
      urls.marketing,
      urls.app,
      urls.marketing.replace('://', '://www.'),
    ]
  }

  // Development: allow localhost and common dev origins
  return [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    ...(appUrl ? [appUrl] : []),
  ]
}

const configSchema = z.object({
  // Environment
  env: z.enum(['development', 'staging', 'production']).default('development'),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),

  // URLs (centralized domain configuration)
  urls: z.object({
    app: z.string().url(),
    marketing: z.string().url(),
    api: z.string().url(),
    docs: z.string().url(),
    verify: z.string().url(),
    badges: z.string().url(),
    apiBadges: z.string().url(),
    jwks: z.string().url(),
    issuer: z.string().url(),
    apiIssuer: z.string().url(),
    supportEmail: z.string().email(),
    enterpriseEmail: z.string().email(),
  }),

  // Application
  app: z.object({
    name: z.string().default('AgentAnchor'),
    url: z.string().url().optional(),
    port: z.number().default(3000),
  }),

  // Supabase (Auth only)
  supabase: z.object({
    url: z.string().url(),
    anonKey: z.string().min(1),
    serviceRoleKey: z.string().min(1),
  }),

  // Database (Neon PostgreSQL)
  database: z
    .object({
      url: z.string().min(1),
      urlUnpooled: z.string().optional(),
    })
    .optional(),

  // Pusher (Realtime)
  pusher: z
    .object({
      appId: z.string().min(1),
      key: z.string().min(1),
      secret: z.string().min(1),
      cluster: z.string().min(1),
    })
    .optional(),

  // Anthropic
  anthropic: z.object({
    apiKey: z.string().min(1),
    defaultModel: z.string().default('claude-3-5-sonnet-20241022'),
    maxTokens: z.number().default(4096),
    temperature: z.number().min(0).max(2).default(1.0),
  }),

  // Rate Limiting (Upstash Redis)
  rateLimit: z.object({
    enabled: z.boolean().default(true),
    redis: z
      .object({
        url: z.string().url(),
        token: z.string().min(1),
      })
      .optional(),
  }),

  // Monitoring
  monitoring: z.object({
    sentry: z
      .object({
        dsn: z.string().url(),
        environment: z.string(),
        tracesSampleRate: z.number().min(0).max(1).default(0.1),
      })
      .optional(),
    logLevel: z
      .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
      .default('info'),
  }),

  // Feature Flags
  features: z.object({
    mcpServers: z.boolean().default(false),
    teamChat: z.boolean().default(false),
    publicBots: z.boolean().default(true),
    apiKeys: z.boolean().default(false),
  }),

  // Security
  security: z.object({
    corsOrigins: z.array(z.string()),
    rateLimitPerMinute: z.number().default(60),
    maxRequestSize: z.string().default('1mb'),
  }),
})

type Config = z.infer<typeof configSchema>

/**
 * Parse and validate environment variables
 */
function parseConfig(): Config {
  const rawConfig = {
    env: process.env.NEXT_PUBLIC_ENV || process.env.NODE_ENV || 'development',
    nodeEnv: process.env.NODE_ENV || 'development',

    // Centralized URL configuration
    urls: getUrls(),

    app: {
      name: process.env.NEXT_PUBLIC_APP_NAME || 'AgentAnchor',
      url: process.env.NEXT_PUBLIC_APP_URL,
      port: parseInt(process.env.PORT || '3000', 10),
    },

    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    },

    database: process.env.DATABASE_URL
      ? {
          url: process.env.DATABASE_URL,
          urlUnpooled: process.env.DATABASE_URL_UNPOOLED,
        }
      : undefined,

    pusher: process.env.PUSHER_APP_ID
      ? {
          appId: process.env.PUSHER_APP_ID,
          key: process.env.PUSHER_KEY!,
          secret: process.env.PUSHER_SECRET!,
          cluster: process.env.PUSHER_CLUSTER!,
        }
      : undefined,

    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY!,
      defaultModel:
        process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-3-5-sonnet-20241022',
      maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || '4096', 10),
      temperature: parseFloat(process.env.ANTHROPIC_TEMPERATURE || '1.0'),
    },

    rateLimit: {
      enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
      redis: process.env.UPSTASH_REDIS_REST_URL
        ? {
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN!,
          }
        : undefined,
    },

    monitoring: {
      sentry: process.env.SENTRY_DSN
        ? {
            dsn: process.env.SENTRY_DSN,
            environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
            tracesSampleRate: parseFloat(
              process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'
            ),
          }
        : undefined,
      logLevel: (process.env.LOG_LEVEL || 'info') as any,
    },

    features: {
      mcpServers: process.env.FEATURE_MCP_SERVERS === 'true',
      teamChat: process.env.FEATURE_TEAM_CHAT === 'true',
      publicBots: process.env.FEATURE_PUBLIC_BOTS !== 'false',
      apiKeys: process.env.FEATURE_API_KEYS === 'true',
    },

    security: {
      corsOrigins: getCorsOrigins(),
      rateLimitPerMinute: parseInt(
        process.env.RATE_LIMIT_PER_MINUTE || '60',
        10
      ),
      maxRequestSize: process.env.MAX_REQUEST_SIZE || '1mb',
    },
  }

  try {
    return configSchema.parse(rawConfig)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid configuration:')
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`)
      })
      throw new Error('Configuration validation failed')
    }
    throw error
  }
}

/**
 * Singleton config instance
 */
export const config = parseConfig()

/**
 * Helper functions
 */
export const isDevelopment = config.env === 'development'
export const isProduction = config.env === 'production'
export const isStaging = config.env === 'staging'
export const isTest = config.nodeEnv === 'test'

/**
 * Centralized URL configuration - use this instead of hardcoding URLs
 * Example: import { urls } from '@/lib/config'
 *          const verifyUrl = `${urls.verify}/${certificateId}`
 */
export const urls = config.urls

/**
 * Validate required environment variables are set
 */
export function validateRequiredEnv() {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ANTHROPIC_API_KEY',
  ]

  const missing = required.filter((key) => !process.env[key])

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    )
  }
}

/**
 * Get configuration value by path
 */
export function getConfig<K extends keyof Config>(key: K): Config[K] {
  return config[key]
}

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof Config['features']): boolean {
  return config.features[feature]
}

/**
 * Export config as default
 */
export default config
