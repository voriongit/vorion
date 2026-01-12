/**
 * Password Reset API Route with Rate Limiting
 *
 * Provides server-side password reset request with abuse protection
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { catchErrors, ValidationError } from '@/lib/errors'
import { checkRateLimit, authPasswordResetRateLimit, getRateLimitHeaders } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const ResetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export const POST = catchErrors(async (req: NextRequest) => {
  // Get client IP for rate limiting
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown'

  // Check rate limit by IP
  const rateLimitResult = await checkRateLimit(ip, authPasswordResetRateLimit, '/api/auth/reset-password')

  if (!rateLimitResult.success) {
    logger.warn({
      type: 'auth_rate_limit',
      action: 'password_reset',
      ip,
      remaining: rateLimitResult.remaining,
    })

    return NextResponse.json(
      { error: 'Too many password reset requests. Please try again later.' },
      {
        status: 429,
        headers: getRateLimitHeaders(rateLimitResult),
      }
    )
  }

  // Parse and validate request body
  const body = await req.json()
  const parseResult = ResetPasswordSchema.safeParse(body)

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors[0].message)
  }

  const { email } = parseResult.data

  // Create Supabase admin client for server-side auth
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Request password reset
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
  })

  if (error) {
    logger.warn({
      type: 'auth_failed',
      action: 'password_reset',
      email: email.substring(0, 3) + '***', // Partial email for privacy
      ip,
      error: error.message,
    })

    // Don't reveal if email exists or not for security
    // Always return success to prevent email enumeration
  }

  logger.info({
    type: 'auth_request',
    action: 'password_reset',
    email: email.substring(0, 3) + '***',
  })

  // Always return success to prevent email enumeration attacks
  return NextResponse.json(
    {
      success: true,
      message: 'If an account with that email exists, we have sent a password reset link.',
    },
    { headers: getRateLimitHeaders(rateLimitResult) }
  )
})
