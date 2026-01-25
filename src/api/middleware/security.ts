/**
 * Security Middleware
 *
 * Provides security headers, request ID injection, request logging,
 * and sensitive data masking for production API hardening.
 *
 * @packageDocumentation
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/** Type for onRequest hook function */
type OnRequestFn = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
/** Type for onResponse hook function */
type OnResponseFn = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
/** Type for preHandler hook function */
type PreHandlerFn = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
import { randomUUID } from 'node:crypto';
import { trace, SpanStatusCode, SpanKind, context as otelContext } from '@opentelemetry/api';
import { createLogger } from '../../common/logger.js';
import { getTraceContext, createTraceContext, type TraceContext } from '../../common/trace.js';

const logger = createLogger({ component: 'api-security' });
const tracer = trace.getTracer('vorion-api-security');

/**
 * Security headers configuration
 */
export interface SecurityHeadersConfig {
  /** Enable CORS headers */
  cors?: boolean | CorsConfig;
  /** Enable Content Security Policy */
  csp?: boolean | CspConfig;
  /** Enable HSTS (HTTP Strict Transport Security) */
  hsts?: boolean | HstsConfig;
  /** Enable X-Content-Type-Options: nosniff */
  noSniff?: boolean;
  /** Enable X-Frame-Options */
  frameOptions?: 'DENY' | 'SAMEORIGIN' | false;
  /** Enable X-XSS-Protection */
  xssProtection?: boolean;
  /** Enable Referrer-Policy */
  referrerPolicy?: string | false;
  /** Enable Permissions-Policy */
  permissionsPolicy?: string | false;
  /** Custom headers to add */
  customHeaders?: Record<string, string>;
}

/**
 * CORS configuration
 */
export interface CorsConfig {
  origin: string | string[] | boolean | ((origin: string) => boolean);
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

/**
 * CSP configuration
 */
export interface CspConfig {
  defaultSrc?: string[];
  scriptSrc?: string[];
  styleSrc?: string[];
  imgSrc?: string[];
  connectSrc?: string[];
  fontSrc?: string[];
  objectSrc?: string[];
  mediaSrc?: string[];
  frameSrc?: string[];
  childSrc?: string[];
  workerSrc?: string[];
  frameAncestors?: string[];
  formAction?: string[];
  upgradeInsecureRequests?: boolean;
  blockAllMixedContent?: boolean;
  reportUri?: string;
}

/**
 * HSTS configuration
 */
export interface HstsConfig {
  maxAge: number;
  includeSubDomains?: boolean;
  preload?: boolean;
}

/**
 * Request logging configuration
 */
export interface RequestLoggingConfig {
  /** Log request start */
  logRequest?: boolean;
  /** Log response completion */
  logResponse?: boolean;
  /** Log request body (be careful with sensitive data) */
  logBody?: boolean;
  /** Log response body */
  logResponseBody?: boolean;
  /** Maximum body size to log (bytes) */
  maxBodyLogSize?: number;
  /** Paths to exclude from logging */
  excludePaths?: string[];
  /** Headers to exclude from logging */
  excludeHeaders?: string[];
  /** Fields to mask in body */
  sensitiveFields?: string[];
}

/**
 * Default security headers configuration
 */
const DEFAULT_SECURITY_CONFIG: SecurityHeadersConfig = {
  cors: true,
  csp: false, // Disabled by default as it can break APIs
  hsts: { maxAge: 31536000, includeSubDomains: true },
  noSniff: true,
  frameOptions: 'DENY',
  xssProtection: true,
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: 'geolocation=(), microphone=(), camera=()',
};

/**
 * Default request logging configuration
 */
const DEFAULT_LOGGING_CONFIG: RequestLoggingConfig = {
  logRequest: true,
  logResponse: true,
  logBody: false,
  logResponseBody: false,
  maxBodyLogSize: 10000,
  excludePaths: ['/health', '/ready', '/metrics'],
  excludeHeaders: ['authorization', 'cookie', 'x-api-key'],
  sensitiveFields: [
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
  ],
};

/**
 * Build CSP header value from config
 */
function buildCspHeader(config: CspConfig): string {
  const directives: string[] = [];

  if (config.defaultSrc) {
    directives.push(`default-src ${config.defaultSrc.join(' ')}`);
  }
  if (config.scriptSrc) {
    directives.push(`script-src ${config.scriptSrc.join(' ')}`);
  }
  if (config.styleSrc) {
    directives.push(`style-src ${config.styleSrc.join(' ')}`);
  }
  if (config.imgSrc) {
    directives.push(`img-src ${config.imgSrc.join(' ')}`);
  }
  if (config.connectSrc) {
    directives.push(`connect-src ${config.connectSrc.join(' ')}`);
  }
  if (config.fontSrc) {
    directives.push(`font-src ${config.fontSrc.join(' ')}`);
  }
  if (config.objectSrc) {
    directives.push(`object-src ${config.objectSrc.join(' ')}`);
  }
  if (config.mediaSrc) {
    directives.push(`media-src ${config.mediaSrc.join(' ')}`);
  }
  if (config.frameSrc) {
    directives.push(`frame-src ${config.frameSrc.join(' ')}`);
  }
  if (config.childSrc) {
    directives.push(`child-src ${config.childSrc.join(' ')}`);
  }
  if (config.workerSrc) {
    directives.push(`worker-src ${config.workerSrc.join(' ')}`);
  }
  if (config.frameAncestors) {
    directives.push(`frame-ancestors ${config.frameAncestors.join(' ')}`);
  }
  if (config.formAction) {
    directives.push(`form-action ${config.formAction.join(' ')}`);
  }
  if (config.upgradeInsecureRequests) {
    directives.push('upgrade-insecure-requests');
  }
  if (config.blockAllMixedContent) {
    directives.push('block-all-mixed-content');
  }
  if (config.reportUri) {
    directives.push(`report-uri ${config.reportUri}`);
  }

  return directives.join('; ');
}

/**
 * Build HSTS header value from config
 */
function buildHstsHeader(config: HstsConfig): string {
  let header = `max-age=${config.maxAge}`;
  if (config.includeSubDomains) {
    header += '; includeSubDomains';
  }
  if (config.preload) {
    header += '; preload';
  }
  return header;
}

/**
 * Mask sensitive data in an object
 */
export function maskSensitiveData(
  obj: unknown,
  sensitiveFields: string[] = DEFAULT_LOGGING_CONFIG.sensitiveFields!,
  maxDepth: number = 10
): unknown {
  if (maxDepth <= 0) return '[MAX_DEPTH_EXCEEDED]';

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => maskSensitiveData(item, sensitiveFields, maxDepth - 1));
  }

  if (typeof obj === 'object') {
    const masked: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveFields.some((field) => lowerKey.includes(field.toLowerCase()));

      if (isSensitive) {
        masked[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        masked[key] = maskSensitiveData(value, sensitiveFields, maxDepth - 1);
      } else {
        masked[key] = value;
      }
    }

    return masked;
  }

  return obj;
}

/**
 * Mask sensitive headers
 */
function maskHeaders(
  headers: Record<string, unknown>,
  excludeHeaders: string[] = DEFAULT_LOGGING_CONFIG.excludeHeaders!
): Record<string, unknown> {
  const masked: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    if (excludeHeaders.some((h) => lowerKey.includes(h.toLowerCase()))) {
      masked[key] = '[REDACTED]';
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

/**
 * Create security headers middleware
 *
 * @param config - Security headers configuration
 * @returns Fastify onRequest hook
 */
export function securityHeaders(config: SecurityHeadersConfig = {}): OnRequestFn {
  const mergedConfig = { ...DEFAULT_SECURITY_CONFIG, ...config };

  return async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // HSTS
    if (mergedConfig.hsts) {
      const hstsConfig = typeof mergedConfig.hsts === 'boolean'
        ? { maxAge: 31536000, includeSubDomains: true }
        : mergedConfig.hsts;
      reply.header('Strict-Transport-Security', buildHstsHeader(hstsConfig));
    }

    // X-Content-Type-Options
    if (mergedConfig.noSniff) {
      reply.header('X-Content-Type-Options', 'nosniff');
    }

    // X-Frame-Options
    if (mergedConfig.frameOptions) {
      reply.header('X-Frame-Options', mergedConfig.frameOptions);
    }

    // X-XSS-Protection
    if (mergedConfig.xssProtection) {
      reply.header('X-XSS-Protection', '1; mode=block');
    }

    // Referrer-Policy
    if (mergedConfig.referrerPolicy) {
      reply.header('Referrer-Policy', mergedConfig.referrerPolicy);
    }

    // Permissions-Policy
    if (mergedConfig.permissionsPolicy) {
      reply.header('Permissions-Policy', mergedConfig.permissionsPolicy);
    }

    // CSP
    if (mergedConfig.csp) {
      const cspConfig = typeof mergedConfig.csp === 'boolean'
        ? { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"] }
        : mergedConfig.csp;
      reply.header('Content-Security-Policy', buildCspHeader(cspConfig));
    }

    // Custom headers
    if (mergedConfig.customHeaders) {
      for (const [name, value] of Object.entries(mergedConfig.customHeaders)) {
        reply.header(name, value);
      }
    }
  };
}

/**
 * Create request ID injection middleware
 *
 * Injects a unique request ID into each request for tracing and debugging.
 *
 * @returns Fastify onRequest hook
 */
export function requestIdInjection(): OnRequestFn {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // Use existing request ID or generate new one
    const incomingRequestId = request.headers['x-request-id'];
    const requestId = typeof incomingRequestId === 'string'
      ? incomingRequestId
      : randomUUID();

    // Store on request (Fastify's built-in id)
    (request as FastifyRequest & { id: string }).id = requestId;

    // Set response header
    reply.header('X-Request-ID', requestId);

    // Get or create trace context
    let traceContext = getTraceContext();
    if (!traceContext) {
      const traceparent = request.headers['traceparent'];
      traceContext = createTraceContext(typeof traceparent === 'string' ? traceparent : undefined);
    }

    // Add trace ID to response
    reply.header('X-Trace-ID', traceContext.traceId);

    // Store trace context on request for later use
    (request as FastifyRequest & { traceContext: TraceContext }).traceContext = traceContext;
  };
}

/**
 * Create request logging middleware
 *
 * @param config - Logging configuration
 * @returns Object with onRequest and onResponse hooks
 */
export function requestLogging(config: RequestLoggingConfig = {}): {
  onRequest: OnRequestFn;
  onResponse: OnResponseFn;
} {
  const mergedConfig = { ...DEFAULT_LOGGING_CONFIG, ...config };

  const onRequest: OnRequestFn = async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    // Skip excluded paths
    if (mergedConfig.excludePaths?.some((path) => request.url.startsWith(path))) {
      return;
    }

    if (!mergedConfig.logRequest) {
      return;
    }

    // Store start time
    (request as FastifyRequest & { startTime: bigint }).startTime = process.hrtime.bigint();

    const logData: Record<string, unknown> = {
      requestId: request.id,
      method: request.method,
      url: request.url,
      headers: maskHeaders(request.headers as Record<string, unknown>, mergedConfig.excludeHeaders),
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    };

    // Log body if enabled and exists
    if (mergedConfig.logBody && request.body) {
      const body = maskSensitiveData(request.body, mergedConfig.sensitiveFields);
      const bodyStr = JSON.stringify(body);

      if (bodyStr.length <= (mergedConfig.maxBodyLogSize ?? 10000)) {
        logData.body = body;
      } else {
        logData.body = '[BODY_TOO_LARGE]';
        logData.bodySize = bodyStr.length;
      }
    }

    // Get tenant ID if available
    const user = (request as FastifyRequest & { user?: { tenantId?: string; sub?: string } }).user;
    if (user?.tenantId) {
      logData.tenantId = user.tenantId;
    }
    if (user?.sub) {
      logData.userId = user.sub;
    }

    logger.info(logData, 'Incoming request');
  };

  const onResponse: OnResponseFn = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // Skip excluded paths
    if (mergedConfig.excludePaths?.some((path) => request.url.startsWith(path))) {
      return;
    }

    if (!mergedConfig.logResponse) {
      return;
    }

    const startTime = (request as FastifyRequest & { startTime?: bigint }).startTime;
    const durationMs = startTime
      ? Number(process.hrtime.bigint() - startTime) / 1_000_000
      : undefined;

    const logData: Record<string, unknown> = {
      requestId: request.id,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      durationMs,
    };

    // Add trace ID
    const traceContext = (request as FastifyRequest & { traceContext?: TraceContext }).traceContext;
    if (traceContext) {
      logData.traceId = traceContext.traceId;
    }

    // Get tenant ID if available
    const user = (request as FastifyRequest & { user?: { tenantId?: string } }).user;
    if (user?.tenantId) {
      logData.tenantId = user.tenantId;
    }

    // Log level based on status code
    if (reply.statusCode >= 500) {
      logger.error(logData, 'Request completed with server error');
    } else if (reply.statusCode >= 400) {
      logger.warn(logData, 'Request completed with client error');
    } else {
      logger.info(logData, 'Request completed');
    }
  };

  return { onRequest, onResponse };
}

/**
 * Combined security middleware that applies all security features
 *
 * @param options - Configuration options
 * @returns Fastify preHandler hook
 */
export function combinedSecurityMiddleware(options?: {
  headers?: SecurityHeadersConfig;
  logging?: RequestLoggingConfig;
}): PreHandlerFn {
  const headersMiddleware = securityHeaders(options?.headers);
  const requestIdMiddleware = requestIdInjection();

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await requestIdMiddleware(request, reply);
    await headersMiddleware(request, reply);
  };
}

/**
 * Register security middleware plugin for Fastify
 *
 * @param server - Fastify instance
 * @param options - Configuration options
 */
export async function registerSecurityPlugin(
  server: FastifyInstance,
  options?: {
    headers?: SecurityHeadersConfig;
    logging?: RequestLoggingConfig;
    /** Skip security for certain paths */
    skipPaths?: string[];
  }
): Promise<void> {
  const skipPaths = options?.skipPaths ?? ['/health', '/ready', '/metrics'];

  // Create middleware instances once
  const requestIdHook = requestIdInjection();
  const headersHook = securityHeaders(options?.headers);
  const loggingHooks = requestLogging(options?.logging);

  // Add request ID injection first
  server.addHook('onRequest', async (request, reply) => {
    if (skipPaths.some((path) => request.url.startsWith(path))) {
      return;
    }
    return requestIdHook(request, reply);
  });

  // Add security headers
  server.addHook('onRequest', async (request, reply) => {
    if (skipPaths.some((path) => request.url.startsWith(path))) {
      return;
    }
    return headersHook(request, reply);
  });

  // Add request logging
  server.addHook('onRequest', loggingHooks.onRequest);
  server.addHook('onResponse', loggingHooks.onResponse);

  // Decorate server with utility functions
  server.decorate('vorionMaskSensitiveData', maskSensitiveData);

  logger.info({ component: 'api-security' }, 'Security plugin registered');
}

/**
 * Create timing-safe string comparison to prevent timing attacks
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Compare against itself to maintain constant time
    const dummy = Buffer.from(a);
    require('crypto').timingSafeEqual(dummy, dummy);
    return false;
  }

  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  return require('crypto').timingSafeEqual(bufA, bufB);
}
