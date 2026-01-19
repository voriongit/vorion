/**
 * Security Middleware - Unit Tests
 * Epic 9: Production Hardening
 * Story 9.5: Rate Limiting & Security Headers
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import {
    corsMiddleware,
    rateLimitMiddleware,
    securityHeadersMiddleware,
    requestSizeLimitMiddleware,
    requestIdMiddleware,
    createSecurityMiddleware,
    sanitizeString,
    sanitizeHtml,
    hashToken,
    timingSafeCompare,
} from './security.js';

// ============================================================================
// Test Helpers
// ============================================================================

function createTestApp() {
    const app = new Hono();
    return app;
}

describe('Security Middleware', () => {
    // ========================================================================
    // CORS Middleware Tests
    // ========================================================================

    describe('CORS Middleware', () => {
        it('allows requests from configured origins', async () => {
            const app = createTestApp();
            app.use('*', corsMiddleware({
                allowedOrigins: ['http://localhost:3000'],
            }));
            app.get('/test', (c) => c.json({ ok: true }));

            const res = await app.request('/test', {
                headers: { Origin: 'http://localhost:3000' },
            });

            expect(res.status).toBe(200);
            expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
        });

        it('supports wildcard origins', async () => {
            const app = createTestApp();
            app.use('*', corsMiddleware({
                allowedOrigins: ['https://*.vercel.app'],
            }));
            app.get('/test', (c) => c.json({ ok: true }));

            const res = await app.request('/test', {
                headers: { Origin: 'https://my-app.vercel.app' },
            });

            expect(res.status).toBe(200);
            expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://my-app.vercel.app');
        });

        it('handles preflight OPTIONS requests', async () => {
            const app = createTestApp();
            app.use('*', corsMiddleware({
                allowedOrigins: ['http://localhost:3000'],
            }));
            app.get('/test', (c) => c.json({ ok: true }));

            const res = await app.request('/test', {
                method: 'OPTIONS',
                headers: { Origin: 'http://localhost:3000' },
            });

            expect(res.status).toBe(204);
            expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET');
        });

        it('sets credentials header when configured', async () => {
            const app = createTestApp();
            app.use('*', corsMiddleware({
                allowedOrigins: ['http://localhost:3000'],
                credentials: true,
            }));
            app.get('/test', (c) => c.json({ ok: true }));

            const res = await app.request('/test', {
                headers: { Origin: 'http://localhost:3000' },
            });

            expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
        });
    });

    // ========================================================================
    // Rate Limiting Middleware Tests
    // ========================================================================

    describe('Rate Limiting Middleware', () => {
        it('allows requests under the limit', async () => {
            const app = createTestApp();
            app.use('*', rateLimitMiddleware({
                windowMs: 60000,
                maxRequests: 100,
            }));
            app.get('/test', (c) => c.json({ ok: true }));

            const res = await app.request('/test');

            expect(res.status).toBe(200);
            expect(res.headers.get('X-RateLimit-Limit')).toBe('100');
            expect(res.headers.get('X-RateLimit-Remaining')).toBe('99');
        });

        it('returns 429 when rate limit exceeded', async () => {
            const app = createTestApp();
            app.use('*', rateLimitMiddleware({
                windowMs: 60000,
                maxRequests: 2,
            }));
            app.get('/test', (c) => c.json({ ok: true }));

            // Make requests up to the limit
            await app.request('/test');
            await app.request('/test');

            // This should be rate limited
            const res = await app.request('/test');

            expect(res.status).toBe(429);
            const body = await res.json();
            expect(body.error).toContain('Too many requests');
        });

        it('uses higher limit for authenticated requests', async () => {
            const app = createTestApp();
            app.use('*', rateLimitMiddleware({
                windowMs: 60000,
                maxRequests: 10,
                maxAuthenticatedRequests: 100,
            }));
            app.get('/test', (c) => c.json({ ok: true }));

            const res = await app.request('/test', {
                headers: { Authorization: 'Bearer test-token' },
            });

            expect(res.status).toBe(200);
            expect(res.headers.get('X-RateLimit-Limit')).toBe('100');
            expect(res.headers.get('X-RateLimit-Policy')).toBe('authenticated');
        });

        it('uses lower limit for unauthenticated requests', async () => {
            const app = createTestApp();
            app.use('*', rateLimitMiddleware({
                windowMs: 60000,
                maxRequests: 10,
                maxAuthenticatedRequests: 100,
            }));
            app.get('/test', (c) => c.json({ ok: true }));

            const res = await app.request('/test');

            expect(res.status).toBe(200);
            expect(res.headers.get('X-RateLimit-Limit')).toBe('10');
            expect(res.headers.get('X-RateLimit-Policy')).toBe('public');
        });

        it('skips configured paths', async () => {
            const app = createTestApp();
            app.use('*', rateLimitMiddleware({
                windowMs: 60000,
                maxRequests: 1,
                skipPaths: ['/health'],
            }));
            app.get('/health', (c) => c.json({ ok: true }));

            // Multiple requests to skip path should all succeed
            await app.request('/health');
            await app.request('/health');
            const res = await app.request('/health');

            expect(res.status).toBe(200);
        });

        it('includes Retry-After header on 429', async () => {
            const app = createTestApp();
            app.use('*', rateLimitMiddleware({
                windowMs: 60000,
                maxRequests: 1,
            }));
            app.get('/test', (c) => c.json({ ok: true }));

            await app.request('/test');
            const res = await app.request('/test');

            expect(res.status).toBe(429);
            expect(res.headers.get('Retry-After')).toBeDefined();
        });
    });

    // ========================================================================
    // Security Headers Middleware Tests
    // ========================================================================

    describe('Security Headers Middleware', () => {
        it('sets Content-Security-Policy header', async () => {
            const app = createTestApp();
            app.use('*', securityHeadersMiddleware());
            app.get('/test', (c) => c.json({ ok: true }));

            const res = await app.request('/test');

            expect(res.headers.get('Content-Security-Policy')).toBeDefined();
        });

        it('sets Strict-Transport-Security header', async () => {
            const app = createTestApp();
            app.use('*', securityHeadersMiddleware());
            app.get('/test', (c) => c.json({ ok: true }));

            const res = await app.request('/test');

            expect(res.headers.get('Strict-Transport-Security')).toContain('max-age=');
        });

        it('sets X-Frame-Options header', async () => {
            const app = createTestApp();
            app.use('*', securityHeadersMiddleware());
            app.get('/test', (c) => c.json({ ok: true }));

            const res = await app.request('/test');

            expect(res.headers.get('X-Frame-Options')).toBe('DENY');
        });

        it('sets X-Content-Type-Options header', async () => {
            const app = createTestApp();
            app.use('*', securityHeadersMiddleware());
            app.get('/test', (c) => c.json({ ok: true }));

            const res = await app.request('/test');

            expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
        });

        it('sets X-XSS-Protection header', async () => {
            const app = createTestApp();
            app.use('*', securityHeadersMiddleware());
            app.get('/test', (c) => c.json({ ok: true }));

            const res = await app.request('/test');

            expect(res.headers.get('X-XSS-Protection')).toBe('1; mode=block');
        });

        it('sets Referrer-Policy header', async () => {
            const app = createTestApp();
            app.use('*', securityHeadersMiddleware());
            app.get('/test', (c) => c.json({ ok: true }));

            const res = await app.request('/test');

            expect(res.headers.get('Referrer-Policy')).toBeDefined();
        });

        it('sets Permissions-Policy header', async () => {
            const app = createTestApp();
            app.use('*', securityHeadersMiddleware());
            app.get('/test', (c) => c.json({ ok: true }));

            const res = await app.request('/test');

            expect(res.headers.get('Permissions-Policy')).toContain('camera=()');
        });

        it('allows custom CSP configuration', async () => {
            const app = createTestApp();
            app.use('*', securityHeadersMiddleware({
                contentSecurityPolicy: "default-src 'none'",
            }));
            app.get('/test', (c) => c.json({ ok: true }));

            const res = await app.request('/test');

            expect(res.headers.get('Content-Security-Policy')).toBe("default-src 'none'");
        });
    });

    // ========================================================================
    // Request Size Limit Middleware Tests
    // ========================================================================

    describe('Request Size Limit Middleware', () => {
        it('allows requests with acceptable body size', async () => {
            const app = createTestApp();
            app.use('*', requestSizeLimitMiddleware({
                maxBodySize: 1024 * 1024, // 1MB
            }));
            app.post('/test', (c) => c.json({ ok: true }));

            const res = await app.request('/test', {
                method: 'POST',
                headers: { 'Content-Length': '100' },
                body: JSON.stringify({ data: 'small' }),
            });

            expect(res.status).toBe(200);
        });

        it('rejects requests exceeding body size limit', async () => {
            const app = createTestApp();
            app.use('*', requestSizeLimitMiddleware({
                maxBodySize: 100, // 100 bytes
            }));
            app.post('/test', (c) => c.json({ ok: true }));

            const res = await app.request('/test', {
                method: 'POST',
                headers: { 'Content-Length': '10000' },
            });

            expect(res.status).toBe(413);
            const body = await res.json();
            expect(body.error).toBe('Payload Too Large');
        });

        it('rejects requests with URL exceeding limit', async () => {
            const app = createTestApp();
            app.use('*', requestSizeLimitMiddleware({
                maxUrlLength: 50,
            }));
            app.get('/test', (c) => c.json({ ok: true }));

            const longPath = '/test?' + 'a'.repeat(100);
            const res = await app.request(longPath);

            expect(res.status).toBe(414);
            const body = await res.json();
            expect(body.error).toBe('URI Too Long');
        });

        it('skips configured paths', async () => {
            const app = createTestApp();
            app.use('*', requestSizeLimitMiddleware({
                maxBodySize: 100,
                skipPaths: ['/upload'],
            }));
            app.post('/upload', (c) => c.json({ ok: true }));

            const res = await app.request('/upload', {
                method: 'POST',
                headers: { 'Content-Length': '10000' },
            });

            expect(res.status).toBe(200);
        });
    });

    // ========================================================================
    // Request ID Middleware Tests
    // ========================================================================

    describe('Request ID Middleware', () => {
        it('generates request ID if not provided', async () => {
            const app = createTestApp();
            app.use('*', requestIdMiddleware());
            app.get('/test', (c) => c.json({ ok: true }));

            const res = await app.request('/test');

            expect(res.headers.get('X-Request-ID')).toBeDefined();
            expect(res.headers.get('X-Request-ID')).toMatch(/^[a-f0-9-]{36}$/);
        });

        it('uses provided request ID', async () => {
            const app = createTestApp();
            app.use('*', requestIdMiddleware());
            app.get('/test', (c) => c.json({ ok: true }));

            const res = await app.request('/test', {
                headers: { 'X-Request-ID': 'custom-id-123' },
            });

            expect(res.headers.get('X-Request-ID')).toBe('custom-id-123');
        });
    });

    // ========================================================================
    // Combined Security Middleware Tests
    // ========================================================================

    describe('Combined Security Middleware', () => {
        it('applies all security layers', async () => {
            const app = createTestApp();
            app.use('*', createSecurityMiddleware({
                cors: { allowedOrigins: ['http://localhost:3000'] },
                rateLimit: { maxRequests: 100 },
            }));
            app.get('/test', (c) => c.json({ ok: true }));

            const res = await app.request('/test', {
                headers: { Origin: 'http://localhost:3000' },
            });

            expect(res.status).toBe(200);
            expect(res.headers.get('X-Request-ID')).toBeDefined();
            expect(res.headers.get('X-RateLimit-Limit')).toBeDefined();
            expect(res.headers.get('Content-Security-Policy')).toBeDefined();
        });
    });

    // ========================================================================
    // Utility Function Tests
    // ========================================================================

    describe('Security Utilities', () => {
        describe('sanitizeString', () => {
            it('removes HTML tags', () => {
                expect(sanitizeString('<script>alert(1)</script>')).toBe('scriptalert(1)/script');
            });

            it('truncates to max length', () => {
                const long = 'a'.repeat(2000);
                expect(sanitizeString(long, 100).length).toBe(100);
            });

            it('trims whitespace', () => {
                expect(sanitizeString('  hello  ')).toBe('hello');
            });
        });

        describe('sanitizeHtml', () => {
            it('escapes HTML entities', () => {
                expect(sanitizeHtml('<script>')).toBe('&lt;script&gt;');
                expect(sanitizeHtml('"test"')).toBe('&quot;test&quot;');
            });
        });

        describe('hashToken', () => {
            it('produces consistent hash', () => {
                const hash1 = hashToken('test-token');
                const hash2 = hashToken('test-token');
                expect(hash1).toBe(hash2);
            });

            it('produces different hash for different input', () => {
                const hash1 = hashToken('token-1');
                const hash2 = hashToken('token-2');
                expect(hash1).not.toBe(hash2);
            });
        });

        describe('timingSafeCompare', () => {
            it('returns true for equal strings', () => {
                expect(timingSafeCompare('secret', 'secret')).toBe(true);
            });

            it('returns false for different strings', () => {
                expect(timingSafeCompare('secret', 'different')).toBe(false);
            });

            it('returns false for different length strings', () => {
                expect(timingSafeCompare('short', 'muchlonger')).toBe(false);
            });

            it('handles non-string input', () => {
                expect(timingSafeCompare(null as any, 'test')).toBe(false);
                expect(timingSafeCompare('test', undefined as any)).toBe(false);
            });
        });
    });
});
