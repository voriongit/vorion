/**
 * Phase 6 Security Middleware
 *
 * OWASP-compliant security middleware for Phase 6 Trust Engine APIs.
 * Implements protection against common web vulnerabilities.
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// =============================================================================
// TYPES
// =============================================================================

export interface SecurityConfig {
  /** Enable CSRF protection */
  csrf: boolean
  /** Enable XSS protection headers */
  xss: boolean
  /** Enable clickjacking protection */
  clickjacking: boolean
  /** Enable content type sniffing protection */
  noSniff: boolean
  /** Enable HSTS */
  hsts: boolean
  /** HSTS max age in seconds */
  hstsMaxAge: number
  /** Allowed origins for CORS */
  allowedOrigins: string[]
  /** Enable request size limiting */
  requestSizeLimit: boolean
  /** Max request body size in bytes */
  maxRequestSize: number
  /** Enable SQL injection detection */
  sqlInjectionDetection: boolean
  /** Enable path traversal detection */
  pathTraversalDetection: boolean
}

export interface SecurityResult {
  allowed: boolean
  reason?: string
  code?: string
}

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  csrf: true,
  xss: true,
  clickjacking: true,
  noSniff: true,
  hsts: true,
  hstsMaxAge: 31536000, // 1 year
  allowedOrigins: [],
  requestSizeLimit: true,
  maxRequestSize: 1024 * 1024, // 1MB
  sqlInjectionDetection: true,
  pathTraversalDetection: true,
}

// =============================================================================
// SECURITY HEADERS
// =============================================================================

/**
 * Generate security headers
 */
export function getSecurityHeaders(config: SecurityConfig = DEFAULT_SECURITY_CONFIG): Headers {
  const headers = new Headers()

  // XSS Protection
  if (config.xss) {
    headers.set('X-XSS-Protection', '1; mode=block')
    headers.set('X-Content-Type-Options', 'nosniff')
  }

  // Clickjacking Protection
  if (config.clickjacking) {
    headers.set('X-Frame-Options', 'DENY')
    headers.set('Content-Security-Policy', "frame-ancestors 'none'")
  }

  // Content Type Sniffing
  if (config.noSniff) {
    headers.set('X-Content-Type-Options', 'nosniff')
  }

  // HSTS
  if (config.hsts) {
    headers.set(
      'Strict-Transport-Security',
      `max-age=${config.hstsMaxAge}; includeSubDomains; preload`
    )
  }

  // Additional security headers
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  headers.set('X-Permitted-Cross-Domain-Policies', 'none')
  headers.set('X-Download-Options', 'noopen')

  // CSP for API responses
  headers.set(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
  )

  return headers
}

// =============================================================================
// INPUT VALIDATION
// =============================================================================

/**
 * SQL injection patterns to detect
 */
const SQL_INJECTION_PATTERNS = [
  /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
  /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
  /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
  /((\%27)|(\'))union/i,
  /exec(\s|\+)+(s|x)p\w+/i,
  /UNION(\s+)ALL(\s+)SELECT/i,
  /UNION(\s+)SELECT/i,
  /INSERT(\s+)INTO/i,
  /DELETE(\s+)FROM/i,
  /DROP(\s+)TABLE/i,
  /UPDATE(\s+)\w+(\s+)SET/i,
]

/**
 * Path traversal patterns to detect
 */
const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//,
  /\.\.\\/,
  /%2e%2e%2f/i,
  /%2e%2e\//i,
  /\.%2e\//i,
  /%2e\.\//i,
  /\.\.%2f/i,
  /%2e%2e%5c/i,
  /etc\/passwd/i,
  /etc\/shadow/i,
  /windows\/system32/i,
]

/**
 * XSS patterns to detect
 */
const XSS_PATTERNS = [
  /<script[^>]*>[\s\S]*?<\/script>/gi,
  /<script[^>]*>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe[^>]*>/gi,
  /<object[^>]*>/gi,
  /<embed[^>]*>/gi,
  /<link[^>]*>/gi,
  /<meta[^>]*>/gi,
  /data:text\/html/gi,
  /vbscript:/gi,
]

/**
 * Check for SQL injection attempts
 */
export function detectSQLInjection(input: string): boolean {
  return SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(input))
}

/**
 * Check for path traversal attempts
 */
export function detectPathTraversal(input: string): boolean {
  return PATH_TRAVERSAL_PATTERNS.some((pattern) => pattern.test(input))
}

/**
 * Check for XSS attempts
 */
export function detectXSS(input: string): boolean {
  return XSS_PATTERNS.some((pattern) => pattern.test(input))
}

/**
 * Sanitize input by removing dangerous patterns
 */
export function sanitizeInput(input: string): string {
  let sanitized = input

  // Remove potential XSS
  XSS_PATTERNS.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, '')
  })

  // Encode HTML entities
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')

  return sanitized
}

/**
 * Validate request input for security threats
 */
export function validateInput(
  input: unknown,
  config: SecurityConfig = DEFAULT_SECURITY_CONFIG
): SecurityResult {
  if (input === null || input === undefined) {
    return { allowed: true }
  }

  const stringified = typeof input === 'string' ? input : JSON.stringify(input)

  // SQL Injection detection
  if (config.sqlInjectionDetection && detectSQLInjection(stringified)) {
    return {
      allowed: false,
      reason: 'Potential SQL injection detected',
      code: 'SQL_INJECTION',
    }
  }

  // Path traversal detection
  if (config.pathTraversalDetection && detectPathTraversal(stringified)) {
    return {
      allowed: false,
      reason: 'Potential path traversal detected',
      code: 'PATH_TRAVERSAL',
    }
  }

  // XSS detection
  if (config.xss && detectXSS(stringified)) {
    return {
      allowed: false,
      reason: 'Potential XSS attack detected',
      code: 'XSS_ATTACK',
    }
  }

  return { allowed: true }
}

// =============================================================================
// CSRF PROTECTION
// =============================================================================

const CSRF_TOKEN_LENGTH = 32
const CSRF_COOKIE_NAME = 'phase6_csrf_token'
const CSRF_HEADER_NAME = 'X-CSRF-Token'

/**
 * Generate CSRF token
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex')
}

/**
 * Validate CSRF token
 */
export function validateCSRFToken(
  request: NextRequest,
  config: SecurityConfig = DEFAULT_SECURITY_CONFIG
): SecurityResult {
  if (!config.csrf) {
    return { allowed: true }
  }

  // Skip CSRF for safe methods
  const safeMetho = ['GET', 'HEAD', 'OPTIONS']
  if (safeMetho.includes(request.method)) {
    return { allowed: true }
  }

  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value
  const headerToken = request.headers.get(CSRF_HEADER_NAME)

  if (!cookieToken || !headerToken) {
    return {
      allowed: false,
      reason: 'Missing CSRF token',
      code: 'CSRF_MISSING',
    }
  }

  // Constant-time comparison to prevent timing attacks
  const tokensMatch = crypto.timingSafeEqual(
    Buffer.from(cookieToken),
    Buffer.from(headerToken)
  )

  if (!tokensMatch) {
    return {
      allowed: false,
      reason: 'Invalid CSRF token',
      code: 'CSRF_INVALID',
    }
  }

  return { allowed: true }
}

// =============================================================================
// CORS
// =============================================================================

/**
 * Validate CORS origin
 */
export function validateCORS(
  request: NextRequest,
  config: SecurityConfig = DEFAULT_SECURITY_CONFIG
): SecurityResult {
  const origin = request.headers.get('Origin')

  // No origin header (same-origin request)
  if (!origin) {
    return { allowed: true }
  }

  // Allow all origins if none specified
  if (config.allowedOrigins.length === 0) {
    return { allowed: true }
  }

  // Check if origin is allowed
  const isAllowed = config.allowedOrigins.some((allowed) => {
    if (allowed === '*') return true
    if (allowed === origin) return true
    // Support wildcard subdomains
    if (allowed.startsWith('*.')) {
      const domain = allowed.slice(2)
      return origin.endsWith(domain)
    }
    return false
  })

  if (!isAllowed) {
    return {
      allowed: false,
      reason: 'Origin not allowed',
      code: 'CORS_ORIGIN',
    }
  }

  return { allowed: true }
}

// =============================================================================
// REQUEST SIZE LIMITING
// =============================================================================

/**
 * Check request size
 */
export async function validateRequestSize(
  request: NextRequest,
  config: SecurityConfig = DEFAULT_SECURITY_CONFIG
): Promise<SecurityResult> {
  if (!config.requestSizeLimit) {
    return { allowed: true }
  }

  const contentLength = request.headers.get('Content-Length')

  if (contentLength) {
    const size = parseInt(contentLength, 10)
    if (size > config.maxRequestSize) {
      return {
        allowed: false,
        reason: `Request body too large (${size} bytes, max ${config.maxRequestSize} bytes)`,
        code: 'REQUEST_TOO_LARGE',
      }
    }
  }

  return { allowed: true }
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

/**
 * Security middleware for Phase 6 endpoints
 */
export async function securityMiddleware(
  request: NextRequest,
  config: SecurityConfig = DEFAULT_SECURITY_CONFIG
): Promise<NextResponse | null> {
  // Validate CORS
  const corsResult = validateCORS(request, config)
  if (!corsResult.allowed) {
    return NextResponse.json(
      { error: corsResult.reason, code: corsResult.code },
      { status: 403 }
    )
  }

  // Validate CSRF
  const csrfResult = validateCSRFToken(request, config)
  if (!csrfResult.allowed) {
    return NextResponse.json(
      { error: csrfResult.reason, code: csrfResult.code },
      { status: 403 }
    )
  }

  // Validate request size
  const sizeResult = await validateRequestSize(request, config)
  if (!sizeResult.allowed) {
    return NextResponse.json(
      { error: sizeResult.reason, code: sizeResult.code },
      { status: 413 }
    )
  }

  // Validate request body
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      const body = await request.clone().text()
      if (body) {
        const inputResult = validateInput(body, config)
        if (!inputResult.allowed) {
          return NextResponse.json(
            { error: inputResult.reason, code: inputResult.code },
            { status: 400 }
          )
        }
      }
    } catch {
      // Body couldn't be read, continue
    }
  }

  // Validate query parameters
  const url = new URL(request.url)
  for (const [key, value] of url.searchParams) {
    const keyResult = validateInput(key, config)
    if (!keyResult.allowed) {
      return NextResponse.json(
        { error: `Invalid parameter name: ${keyResult.reason}`, code: keyResult.code },
        { status: 400 }
      )
    }

    const valueResult = validateInput(value, config)
    if (!valueResult.allowed) {
      return NextResponse.json(
        { error: `Invalid parameter value: ${valueResult.reason}`, code: valueResult.code },
        { status: 400 }
      )
    }
  }

  return null
}

/**
 * Add security headers to response
 */
export function addSecurityHeaders(
  response: NextResponse,
  config: SecurityConfig = DEFAULT_SECURITY_CONFIG
): NextResponse {
  const securityHeaders = getSecurityHeaders(config)

  securityHeaders.forEach((value, key) => {
    response.headers.set(key, value)
  })

  return response
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  middleware: securityMiddleware,
  headers: getSecurityHeaders,
  addHeaders: addSecurityHeaders,
  validate: {
    input: validateInput,
    cors: validateCORS,
    csrf: validateCSRFToken,
    size: validateRequestSize,
  },
  detect: {
    sqlInjection: detectSQLInjection,
    pathTraversal: detectPathTraversal,
    xss: detectXSS,
  },
  csrf: {
    generate: generateCSRFToken,
    validate: validateCSRFToken,
  },
  sanitize: sanitizeInput,
}
