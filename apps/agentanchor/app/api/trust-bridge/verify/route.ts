/**
 * Trust Bridge - Verification API
 *
 * GET /api/trust-bridge/verify - Verify a Trust Bridge Credential
 *
 * Headers:
 *   X-Trust-Credential: <JWT token>
 *   OR
 *   Authorization: Bearer <JWT token>
 *
 * Response:
 * {
 *   valid: boolean,
 *   agent_id?: string,
 *   trust_score?: number,
 *   tier?: string,
 *   origin_platform?: string,
 *   restrictions?: string[],
 *   certified_until?: string,
 *   council_reviewed?: boolean,
 *   test_summary?: { tests_passed, tests_total, certification_date },
 *   error?: string,
 *   error_code?: string,
 *   warnings?: string[]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyCredential, getPublicJWKS } from '@/lib/trust-bridge/credentials';

// Rate limiting (simple in-memory, use Redis in production)
const rateLimitStore: Map<string, { count: number; resetAt: number }> = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_RATE_LIMIT = 100; // Free tier

function checkRateLimit(clientId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const existing = rateLimitStore.get(clientId);

  if (!existing || existing.resetAt < now) {
    rateLimitStore.set(clientId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: DEFAULT_RATE_LIMIT - 1 };
  }

  if (existing.count >= DEFAULT_RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  existing.count++;
  return { allowed: true, remaining: DEFAULT_RATE_LIMIT - existing.count };
}

export async function GET(request: NextRequest) {
  // Get client identifier for rate limiting
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                   request.headers.get('x-real-ip') ||
                   'unknown';

  // Check rate limit
  const rateCheck = checkRateLimit(clientIp);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      {
        valid: false,
        error: 'Rate limit exceeded. Upgrade to Pro for higher limits.',
        error_code: 'rate_limited',
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': DEFAULT_RATE_LIMIT.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.ceil(Date.now() / 1000 + 3600).toString(),
        },
      }
    );
  }

  // Get token from header
  let token = request.headers.get('x-trust-credential');

  // Fall back to Authorization header
  if (!token) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  // Check query parameter as last resort
  if (!token) {
    token = request.nextUrl.searchParams.get('credential');
  }

  if (!token) {
    return NextResponse.json(
      {
        valid: false,
        error: 'No credential provided. Use X-Trust-Credential header or Authorization: Bearer <token>',
        error_code: 'missing_credential',
      },
      {
        status: 400,
        headers: {
          'X-RateLimit-Limit': DEFAULT_RATE_LIMIT.toString(),
          'X-RateLimit-Remaining': rateCheck.remaining.toString(),
        },
      }
    );
  }

  // Verify the credential
  const result = await verifyCredential(token);

  // Add rate limit headers to response
  const headers = {
    'X-RateLimit-Limit': DEFAULT_RATE_LIMIT.toString(),
    'X-RateLimit-Remaining': rateCheck.remaining.toString(),
  };

  if (!result.valid) {
    return NextResponse.json(result, { status: 401, headers });
  }

  return NextResponse.json(result, { headers });
}

// POST - Batch verification
export async function POST(request: NextRequest) {
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

  try {
    const body = await request.json();
    const tokens: string[] = body.credentials || [];

    if (!Array.isArray(tokens) || tokens.length === 0) {
      return NextResponse.json(
        { error: 'No credentials provided. Send { credentials: string[] }' },
        { status: 400 }
      );
    }

    if (tokens.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 credentials per batch request' },
        { status: 400 }
      );
    }

    // Check rate limit (each token counts as one request)
    for (let i = 0; i < tokens.length; i++) {
      const rateCheck = checkRateLimit(clientIp);
      if (!rateCheck.allowed) {
        return NextResponse.json(
          {
            error: 'Rate limit exceeded during batch verification',
            processed: i,
            total: tokens.length,
          },
          { status: 429 }
        );
      }
    }

    // Verify all credentials
    const results = await Promise.all(
      tokens.map(async (token) => {
        const result = await verifyCredential(token);
        return {
          token_preview: token.substring(0, 20) + '...',
          ...result,
        };
      })
    );

    return NextResponse.json({
      success: true,
      count: results.length,
      results,
      summary: {
        valid: results.filter(r => r.valid).length,
        invalid: results.filter(r => !r.valid).length,
      },
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
