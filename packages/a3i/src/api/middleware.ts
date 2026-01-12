/**
 * API Middleware - Authentication, error handling, and request processing
 */

import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';

/**
 * API key configuration
 */
export interface ApiKeyConfig {
  /** Header name for API key */
  headerName: string;
  /** Valid API keys (in production, use secure storage) */
  validKeys: Set<string>;
  /** Allow requests without authentication (for development) */
  allowUnauthenticated?: boolean;
}

/**
 * Default API key configuration
 */
export const DEFAULT_API_KEY_CONFIG: ApiKeyConfig = {
  headerName: 'X-API-Key',
  validKeys: new Set(['development-key']),
  allowUnauthenticated: true, // For development only
};

/**
 * API authentication middleware
 * Validates API key from request header
 */
export function apiKeyAuth(config: ApiKeyConfig = DEFAULT_API_KEY_CONFIG) {
  return async (c: Context, next: Next) => {
    const apiKey = c.req.header(config.headerName);

    if (!apiKey) {
      if (config.allowUnauthenticated) {
        // Allow unauthenticated in dev mode
        c.set('authenticated', false);
        await next();
        return;
      }
      throw new HTTPException(401, {
        message: `Missing ${config.headerName} header`,
      });
    }

    if (!config.validKeys.has(apiKey)) {
      throw new HTTPException(401, {
        message: 'Invalid API key',
      });
    }

    c.set('authenticated', true);
    c.set('apiKey', apiKey);
    await next();
  };
}

/**
 * Request timing middleware
 * Adds X-Response-Time header
 */
export async function timing(c: Context, next: Next) {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  c.res.headers.set('X-Response-Time', `${ms}ms`);
}

/**
 * Request ID middleware
 * Adds X-Request-ID header for tracing
 */
export async function requestId(c: Context, next: Next) {
  const existingId = c.req.header('X-Request-ID');
  const id = existingId || crypto.randomUUID();
  c.set('requestId', id);
  await next();
  c.res.headers.set('X-Request-ID', id);
}

/**
 * Error response shape
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId?: string;
  };
}

/**
 * Error handling middleware
 * Converts exceptions to structured error responses
 */
export async function errorHandler(c: Context, next: Next) {
  try {
    await next();
  } catch (err) {
    const requestId = c.get('requestId') as string | undefined;

    if (err instanceof HTTPException) {
      const response: ErrorResponse = {
        error: {
          code: `HTTP_${err.status}`,
          message: err.message,
          requestId,
        },
      };
      return c.json(response, err.status);
    }

    // Check for ValidationError - cast to any to access issues property
    if (err instanceof Error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errAny = err as any;
      if (errAny.issues !== undefined) {
        const issues = Array.isArray(errAny.issues) ? errAny.issues : [];
        const response: ErrorResponse = {
          error: {
            code: 'VALIDATION_ERROR',
            message: err.message,
            details: { issues },
            requestId,
          },
        };
        return c.json(response, 400);
      }
    }

    // Unknown error
    console.error('Unhandled error:', err);
    const response: ErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred',
        requestId,
      },
    };
    return c.json(response, 500);
  }
}

/**
 * Custom validation error
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public issues: Array<{ path: string; message: string }>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  /** Maximum requests per window */
  limit: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Key generator function */
  keyGenerator?: (c: Context) => string;
}

/**
 * Simple in-memory rate limiter
 * (In production, use Redis or similar)
 */
export function rateLimit(config: RateLimitConfig) {
  const requests = new Map<string, { count: number; resetAt: number }>();

  return async (c: Context, next: Next) => {
    const key = config.keyGenerator?.(c) ?? c.req.header('X-API-Key') ?? 'anonymous';
    const now = Date.now();

    let entry = requests.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + config.windowMs };
      requests.set(key, entry);
    }

    entry.count++;

    c.res.headers.set('X-RateLimit-Limit', String(config.limit));
    c.res.headers.set('X-RateLimit-Remaining', String(Math.max(0, config.limit - entry.count)));
    c.res.headers.set('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > config.limit) {
      throw new HTTPException(429, {
        message: 'Rate limit exceeded',
      });
    }

    await next();
  };
}

/**
 * CORS configuration
 */
export interface CorsConfig {
  origin: string | string[];
  methods?: string[];
  headers?: string[];
  credentials?: boolean;
}

/**
 * CORS middleware
 */
export function cors(config: CorsConfig) {
  const allowedOrigins = Array.isArray(config.origin) ? config.origin : [config.origin];
  const methods = config.methods ?? ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
  const headers = config.headers ?? ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'];

  return async (c: Context, next: Next) => {
    const origin = c.req.header('Origin');

    if (origin && (allowedOrigins.includes('*') || allowedOrigins.includes(origin))) {
      c.res.headers.set('Access-Control-Allow-Origin', origin);
    }

    c.res.headers.set('Access-Control-Allow-Methods', methods.join(', '));
    c.res.headers.set('Access-Control-Allow-Headers', headers.join(', '));

    if (config.credentials) {
      c.res.headers.set('Access-Control-Allow-Credentials', 'true');
    }

    // Handle preflight
    if (c.req.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }

    await next();
  };
}

/**
 * Request body size limit
 */
export function bodyLimit(maxSize: number) {
  return async (c: Context, next: Next) => {
    const contentLength = c.req.header('Content-Length');
    if (contentLength && parseInt(contentLength, 10) > maxSize) {
      throw new HTTPException(413, {
        message: `Request body too large (max ${maxSize} bytes)`,
      });
    }
    await next();
  };
}
