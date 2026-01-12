/**
 * Portable Trust Credential Verification API
 * GET - Verify a credential (FR160-162)
 *
 * This is a PUBLIC endpoint - no authentication required
 * Rate limited to prevent abuse
 *
 * Epic 15: Portable Trust Credentials (MOAT BUILDER)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyCredential, type VerificationResult } from '@/lib/credentials'
import { headers } from 'next/headers'

// Rate limit configuration
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const RATE_LIMIT_FREE = 100 // 100 requests per hour for free tier

// In-memory rate limiting (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const record = rateLimitStore.get(ip)

  if (!record || record.resetAt < now) {
    // New window
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return { allowed: true, remaining: RATE_LIMIT_FREE - 1, resetAt: now + RATE_LIMIT_WINDOW_MS }
  }

  if (record.count >= RATE_LIMIT_FREE) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt }
  }

  record.count++
  return { allowed: true, remaining: RATE_LIMIT_FREE - record.count, resetAt: record.resetAt }
}

export async function GET(request: NextRequest) {
  const headersList = await headers()
  const forwardedFor = headersList.get('x-forwarded-for')
  const ip = forwardedFor?.split(',')[0] || 'unknown'
  const userAgent = headersList.get('user-agent') || ''

  // Check rate limit (FR162)
  const rateLimit = checkRateLimit(ip)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        message: 'Too many verification requests. Please try again later or upgrade to a paid tier.',
        resetAt: new Date(rateLimit.resetAt).toISOString(),
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': RATE_LIMIT_FREE.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.floor(rateLimit.resetAt / 1000).toString(),
          'Retry-After': Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString(),
        },
      }
    )
  }

  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header. Use: Authorization: Bearer <ptc_token>' },
        { status: 400 }
      )
    }

    const token = authHeader.slice(7) // Remove 'Bearer ' prefix

    const supabase = createClient()

    // Verify the credential (FR160-161)
    const result: VerificationResult = await verifyCredential(token, {
      // Check revocation list
      checkRevocation: async (jwtId: string) => {
        const { data } = await supabase
          .from('credential_revocations')
          .select('id')
          .eq('jwt_id', jwtId)
          .single()
        return !!data
      },
      // Check current trust score for staleness
      getCurrentTrustScore: async (agentId: string) => {
        const { data } = await supabase
          .from('agents')
          .select('trust_score')
          .eq('id', agentId)
          .single()
        return data?.trust_score ?? null
      },
    })

    // Log verification (for analytics)
    await supabase.from('verification_log').insert({
      jwt_id: result.agentId ? token.slice(-20) : null, // Store partial for reference
      agent_id: result.agentId,
      request_ip: ip,
      user_agent: userAgent.slice(0, 255),
      result: result.valid ? 'valid' : result.errorCode || 'invalid',
      error_code: result.errorCode,
    })

    // Build response with rate limit headers
    const responseHeaders = {
      'X-RateLimit-Limit': RATE_LIMIT_FREE.toString(),
      'X-RateLimit-Remaining': rateLimit.remaining.toString(),
      'X-RateLimit-Reset': Math.floor(rateLimit.resetAt / 1000).toString(),
    }

    if (!result.valid) {
      return NextResponse.json(
        {
          valid: false,
          error: result.error,
          error_code: result.errorCode,
          verification_timestamp: new Date().toISOString(),
        },
        { status: 200, headers: responseHeaders }
      )
    }

    return NextResponse.json(
      {
        valid: true,
        agent_id: result.agentId,
        trust_score: result.trustScore,
        trust_tier: result.trustTier,
        verification_timestamp: new Date().toISOString(),
        truth_chain_verified: result.truthChainVerified,
        credential_expires_in: result.expiresIn,
        warnings: result.warnings.length > 0 ? result.warnings : undefined,
      },
      { status: 200, headers: responseHeaders }
    )
  } catch (error: any) {
    console.error('Credential verification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
