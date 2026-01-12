/**
 * Signup API Route with Rate Limiting
 *
 * Provides server-side signup with abuse protection
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { catchErrors, ValidationError } from '@/lib/errors'
import { checkRateLimit, authSignupRateLimit, getRateLimitHeaders } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const SignupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character'),
  fullName: z.string().min(1, 'Full name is required').max(100, 'Full name is too long'),
})

export const POST = catchErrors(async (req: NextRequest) => {
  // Get client IP for rate limiting
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown'

  // Check rate limit by IP
  const rateLimitResult = await checkRateLimit(ip, authSignupRateLimit, '/api/auth/signup')

  if (!rateLimitResult.success) {
    logger.warn({
      type: 'auth_rate_limit',
      action: 'signup',
      ip,
      remaining: rateLimitResult.remaining,
    })

    return NextResponse.json(
      { error: 'Too many signup attempts. Please try again later.' },
      {
        status: 429,
        headers: getRateLimitHeaders(rateLimitResult),
      }
    )
  }

  // Parse and validate request body
  const body = await req.json()
  const parseResult = SignupSchema.safeParse(body)

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors[0].message)
  }

  const { email, password, fullName } = parseResult.data

  // Create Supabase admin client for server-side auth
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Attempt signup
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo: `${req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  })

  if (error) {
    logger.warn({
      type: 'auth_failed',
      action: 'signup',
      email: email.substring(0, 3) + '***', // Partial email for privacy
      ip,
      error: error.message,
    })

    throw new ValidationError(error.message)
  }

  logger.info({
    type: 'auth_success',
    action: 'signup',
    userId: data.user?.id,
  })

  return NextResponse.json(
    {
      success: true,
      message: 'Please check your email to verify your account.',
      user: {
        id: data.user?.id,
        email: data.user?.email,
      },
    },
    { headers: getRateLimitHeaders(rateLimitResult) }
  )
})
