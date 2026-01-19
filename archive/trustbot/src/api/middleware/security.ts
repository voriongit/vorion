/**
 * Security Middleware
 *
 * Provides comprehensive security middleware for the API:
 * - CORS with origin restrictions
 * - Rate limiting
 * - Security headers
 * - Request validation
 * - Timing attack protection
 */

import { Context, Next } from 'hono';
import { createHash, timingSafeEqual } from 'crypto';
import { OAuth2Client } from 'google-auth-library';

// ============================================================================
// Types
// ============================================================================

export interface CORSConfig {
    allowedOrigins: string[];
    allowedMethods: string[];
    allowedHeaders: string[];
    exposeHeaders: string[];
    credentials: boolean;
    maxAge: number;
}

export interface RateLimitConfig {
    windowMs: number;      // Time window in milliseconds
    maxRequests: number;   // Max requests per window for unauthenticated
    maxAuthenticatedRequests?: number;  // Max requests for authenticated users
    keyGenerator?: (c: Context) => string;  // Custom key generator
    skipFailedRequests?: boolean;
    skipPaths?: string[];  // Paths to skip rate limiting
    message?: string;
}

export interface RequestSizeLimitConfig {
    maxBodySize: number;   // Max body size in bytes
    maxUrlLength: number;  // Max URL length
    skipPaths?: string[];  // Paths to skip size limiting
}

export interface SecurityHeadersConfig {
    contentSecurityPolicy?: string;
    strictTransportSecurity?: boolean;
    xFrameOptions?: 'DENY' | 'SAMEORIGIN';
    xContentTypeOptions?: boolean;
    referrerPolicy?: string;
}

// ============================================================================
// Default Configurations
// ============================================================================

const DEFAULT_CORS_CONFIG: CORSConfig = {
    allowedOrigins: [
        // Local development
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://localhost:3003',
        'http://localhost:3005',
        'http://localhost:5173',  // Vite dev server
        'http://localhost:5174',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:5173',
        // Production - Vercel frontend
        'https://web-626.vercel.app',
        'https://web-banquetai.vercel.app',
        'https://*.vercel.app',
        // Production - Fly.io API (for same-origin)
        'https://aurais-api.fly.dev',
    ],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-API-Key'],
    exposeHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    credentials: true,
    maxAge: 86400, // 24 hours
};

const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 100,     // 100 requests per minute for unauthenticated
    maxAuthenticatedRequests: 1000,  // 1000 requests per minute for authenticated
    message: 'Too many requests, please try again later.',
};

const DEFAULT_REQUEST_SIZE_CONFIG: RequestSizeLimitConfig = {
    maxBodySize: 1024 * 1024,  // 1MB max body size
    maxUrlLength: 2048,        // 2KB max URL length
    skipPaths: ['/api/upload'], // Skip for upload endpoints
};

const DEFAULT_SECURITY_HEADERS: SecurityHeadersConfig = {
    contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
    strictTransportSecurity: true,
    xFrameOptions: 'DENY',
    xContentTypeOptions: true,
    referrerPolicy: 'strict-origin-when-cross-origin',
};

// ============================================================================
// Rate Limiter Store
// ============================================================================

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

class RateLimitStore {
    private store: Map<string, RateLimitEntry> = new Map();
    private cleanupInterval: ReturnType<typeof setInterval>;

    constructor() {
        // Cleanup expired entries every minute
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    }

    get(key: string): RateLimitEntry | undefined {
        return this.store.get(key);
    }

    set(key: string, entry: RateLimitEntry): void {
        this.store.set(key, entry);
    }

    increment(key: string, windowMs: number): RateLimitEntry {
        const now = Date.now();
        const existing = this.store.get(key);

        if (!existing || existing.resetTime <= now) {
            // Start new window
            const entry = { count: 1, resetTime: now + windowMs };
            this.store.set(key, entry);
            return entry;
        }

        // Increment existing
        existing.count++;
        return existing;
    }

    private cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.store.entries()) {
            if (entry.resetTime <= now) {
                this.store.delete(key);
            }
        }
    }

    destroy(): void {
        clearInterval(this.cleanupInterval);
        this.store.clear();
    }
}

const rateLimitStore = new RateLimitStore();

// ============================================================================
// CORS Middleware
// ============================================================================

export function corsMiddleware(config: Partial<CORSConfig> = {}) {
    const cfg = { ...DEFAULT_CORS_CONFIG, ...config };

    // Add production origins from environment
    if (process.env.ALLOWED_ORIGINS) {
        cfg.allowedOrigins.push(...process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()));
    }

    return async (c: Context, next: Next): Promise<Response | void> => {
        const origin = c.req.header('Origin') || '';

        // Check if origin is allowed
        const isAllowed = cfg.allowedOrigins.some(allowed => {
            if (allowed === '*') return true;
            if (allowed === origin) return true;
            // Support wildcard subdomains (e.g., "https://*.vercel.app" or "*.vercel.app")
            if (allowed.includes('*')) {
                // Convert wildcard pattern to regex
                const pattern = allowed
                    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')  // Escape regex chars except *
                    .replace(/\*/g, '.*');  // Replace * with .*
                const regex = new RegExp(`^${pattern}$`);
                return regex.test(origin);
            }
            return false;
        });

        if (origin && isAllowed) {
            c.header('Access-Control-Allow-Origin', origin);
        } else if (origin) {
            // Log blocked origin for monitoring
            console.warn(`CORS blocked origin: ${origin}`);
        }

        c.header('Access-Control-Allow-Methods', cfg.allowedMethods.join(', '));
        c.header('Access-Control-Allow-Headers', cfg.allowedHeaders.join(', '));
        c.header('Access-Control-Expose-Headers', cfg.exposeHeaders.join(', '));
        c.header('Access-Control-Max-Age', cfg.maxAge.toString());

        if (cfg.credentials) {
            c.header('Access-Control-Allow-Credentials', 'true');
        }

        // Handle preflight - must include CORS headers in response
        if (c.req.method === 'OPTIONS') {
            const headers: Record<string, string> = {
                'Access-Control-Allow-Methods': cfg.allowedMethods.join(', '),
                'Access-Control-Allow-Headers': cfg.allowedHeaders.join(', '),
                'Access-Control-Expose-Headers': cfg.exposeHeaders.join(', '),
                'Access-Control-Max-Age': cfg.maxAge.toString(),
            };
            if (origin && isAllowed) {
                headers['Access-Control-Allow-Origin'] = origin;
            }
            if (cfg.credentials) {
                headers['Access-Control-Allow-Credentials'] = 'true';
            }
            return new Response(null, { status: 204, headers });
        }

        await next();
    };
}

// ============================================================================
// Rate Limiting Middleware
// ============================================================================

export function rateLimitMiddleware(config: Partial<RateLimitConfig> = {}) {
    const cfg = { ...DEFAULT_RATE_LIMIT_CONFIG, ...config };

    const keyGenerator = cfg.keyGenerator || ((c: Context) => {
        // Use IP + optional token for rate limiting
        const ip = c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ||
                   c.req.header('X-Real-IP') ||
                   'unknown';
        const token = c.req.header('Authorization')?.slice(0, 20) || '';
        return `${ip}:${token}`;
    });

    return async (c: Context, next: Next): Promise<Response | void> => {
        // Skip rate limiting for specified paths
        const path = c.req.path;
        if (cfg.skipPaths?.some(p => path === p || path.startsWith(p))) {
            await next();
            return;
        }

        const key = keyGenerator(c);
        const entry = rateLimitStore.increment(key, cfg.windowMs);

        // Determine if request is authenticated (higher limit)
        const isAuthenticated = !!c.req.header('Authorization');
        const maxRequests = isAuthenticated && cfg.maxAuthenticatedRequests
            ? cfg.maxAuthenticatedRequests
            : cfg.maxRequests;

        // Set rate limit headers
        c.header('X-RateLimit-Limit', maxRequests.toString());
        c.header('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count).toString());
        c.header('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000).toString());
        c.header('X-RateLimit-Policy', isAuthenticated ? 'authenticated' : 'public');

        if (entry.count > maxRequests) {
            c.header('Retry-After', Math.ceil((entry.resetTime - Date.now()) / 1000).toString());
            return c.json({
                error: cfg.message,
                retryAfter: Math.ceil((entry.resetTime - Date.now()) / 1000),
                limit: maxRequests,
                policy: isAuthenticated ? 'authenticated' : 'public',
            }, 429);
        }

        await next();
    };
}

// ============================================================================
// Security Headers Middleware
// ============================================================================

export function securityHeadersMiddleware(config: Partial<SecurityHeadersConfig> = {}) {
    const cfg = { ...DEFAULT_SECURITY_HEADERS, ...config };

    return async (c: Context, next: Next) => {
        // Content Security Policy
        if (cfg.contentSecurityPolicy) {
            c.header('Content-Security-Policy', cfg.contentSecurityPolicy);
        }

        // HTTPS enforcement
        if (cfg.strictTransportSecurity) {
            c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        // Prevent clickjacking
        if (cfg.xFrameOptions) {
            c.header('X-Frame-Options', cfg.xFrameOptions);
        }

        // Prevent MIME type sniffing
        if (cfg.xContentTypeOptions) {
            c.header('X-Content-Type-Options', 'nosniff');
        }

        // Control referrer information
        if (cfg.referrerPolicy) {
            c.header('Referrer-Policy', cfg.referrerPolicy);
        }

        // Additional security headers
        c.header('X-XSS-Protection', '1; mode=block');
        c.header('X-Permitted-Cross-Domain-Policies', 'none');
        c.header('X-Download-Options', 'noopen');
        c.header('X-DNS-Prefetch-Control', 'off');
        c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

        await next();
    };
}

// ============================================================================
// Request Size Limit Middleware
// ============================================================================

export function requestSizeLimitMiddleware(config: Partial<RequestSizeLimitConfig> = {}) {
    const cfg = { ...DEFAULT_REQUEST_SIZE_CONFIG, ...config };

    return async (c: Context, next: Next): Promise<Response | void> => {
        const path = c.req.path;

        // Skip for specified paths
        if (cfg.skipPaths?.some(p => path === p || path.startsWith(p))) {
            await next();
            return;
        }

        // Check URL length
        const url = c.req.url;
        if (url.length > cfg.maxUrlLength) {
            return c.json({
                error: 'URI Too Long',
                message: `URL exceeds maximum length of ${cfg.maxUrlLength} characters`,
            }, 414);
        }

        // Check Content-Length header for body size
        const contentLength = c.req.header('Content-Length');
        if (contentLength) {
            const size = parseInt(contentLength, 10);
            if (size > cfg.maxBodySize) {
                return c.json({
                    error: 'Payload Too Large',
                    message: `Request body exceeds maximum size of ${Math.round(cfg.maxBodySize / 1024)}KB`,
                    maxSize: cfg.maxBodySize,
                }, 413);
            }
        }

        await next();
    };
}

// ============================================================================
// Request ID Middleware
// ============================================================================

export function requestIdMiddleware() {
    return async (c: Context, next: Next) => {
        const requestId = c.req.header('X-Request-ID') || crypto.randomUUID();
        c.header('X-Request-ID', requestId);
        c.set('requestId', requestId);
        await next();
    };
}

// ============================================================================
// Timing-Safe Comparison
// ============================================================================

export function timingSafeCompare(a: string, b: string): boolean {
    if (typeof a !== 'string' || typeof b !== 'string') {
        return false;
    }

    const aBuffer = Buffer.from(a);
    const bBuffer = Buffer.from(b);

    if (aBuffer.length !== bBuffer.length) {
        // Compare with dummy to prevent timing attacks
        timingSafeEqual(aBuffer, aBuffer);
        return false;
    }

    return timingSafeEqual(aBuffer, bBuffer);
}

// ============================================================================
// Secure Key Generation
// ============================================================================

export function generateSecureKey(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const randomBytes = new Uint8Array(length);
    crypto.getRandomValues(randomBytes);
    return Array.from(randomBytes)
        .map(b => chars[b % chars.length])
        .join('');
}

export function generateMasterKey(): string {
    // Generate a cryptographically secure master key
    // Format: XXXX-XXXX-XXXX-XXXX (16 chars + dashes)
    const segments: string[] = [];
    for (let i = 0; i < 4; i++) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing chars
        const segment = Array.from(crypto.getRandomValues(new Uint8Array(4)))
            .map(b => chars[b % chars.length])
            .join('');
        segments.push(segment);
    }
    return segments.join('-');
}

// ============================================================================
// Hash Functions
// ============================================================================

export function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

export function hashPassword(password: string, salt: string): string {
    return createHash('sha256').update(password + salt).digest('hex');
}

// ============================================================================
// Input Sanitization
// ============================================================================

export function sanitizeString(input: string, maxLength: number = 1000): string {
    if (typeof input !== 'string') return '';
    return input
        .slice(0, maxLength)
        .replace(/[<>]/g, '') // Remove potential HTML
        .trim();
}

export function sanitizeHtml(input: string): string {
    if (typeof input !== 'string') return '';
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ============================================================================
// Combined Security Middleware
// ============================================================================

export function createSecurityMiddleware(options: {
    cors?: Partial<CORSConfig>;
    rateLimit?: Partial<RateLimitConfig>;
    headers?: Partial<SecurityHeadersConfig>;
    requestSize?: Partial<RequestSizeLimitConfig>;
} = {}) {
    const corsHandler = corsMiddleware(options.cors);
    const rateLimitHandler = rateLimitMiddleware(options.rateLimit);
    const headersHandler = securityHeadersMiddleware(options.headers);
    const requestSizeHandler = requestSizeLimitMiddleware(options.requestSize);
    const requestIdHandler = requestIdMiddleware();

    return async (c: Context, next: Next) => {
        await requestIdHandler(c, async () => {
            await headersHandler(c, async () => {
                await requestSizeHandler(c, async () => {
                    await corsHandler(c, async () => {
                        await rateLimitHandler(c, next);
                    });
                });
            });
        });
    };
}

// ============================================================================
// Google OAuth Token Verification
// ============================================================================

export interface GoogleUser {
    email: string;
    name: string;
    picture?: string;
    sub: string; // Google user ID
}

// Cache for verified tokens (5 minute TTL)
const tokenCache = new Map<string, { user: GoogleUser; expiresAt: number }>();

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function verifyGoogleToken(token: string): Promise<GoogleUser | null> {
    // Check cache first
    const cached = tokenCache.get(token);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.user;
    }

    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        if (!payload) return null;

        const user: GoogleUser = {
            email: payload.email || '',
            name: payload.name || '',
            picture: payload.picture,
            sub: payload.sub,
        };

        // Cache for 5 minutes
        tokenCache.set(token, { user, expiresAt: Date.now() + 5 * 60 * 1000 });

        return user;
    } catch (error) {
        console.error('Google token verification failed:', error);
        return null;
    }
}

export interface GoogleAuthConfig {
    skipPaths?: string[]; // Paths that don't require auth
    optional?: boolean;   // If true, continues without auth but sets user if present
}

export function googleAuthMiddleware(config: GoogleAuthConfig = {}) {
    const skipPaths = config.skipPaths || ['/health', '/'];

    return async (c: Context, next: Next): Promise<Response | void> => {
        const path = c.req.path;

        // Skip auth for specified paths
        if (skipPaths.some(p => path === p || path.startsWith(p + '/'))) {
            await next();
            return;
        }

        // Get token from Authorization header
        const authHeader = c.req.header('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

        if (!token) {
            if (config.optional) {
                await next();
                return;
            }
            return c.json({ error: 'Authorization required' }, 401);
        }

        const user = await verifyGoogleToken(token);

        if (!user) {
            if (config.optional) {
                await next();
                return;
            }
            return c.json({ error: 'Invalid or expired token' }, 401);
        }

        // Set user on context for route handlers
        c.set('user', user);
        await next();
    };
}
