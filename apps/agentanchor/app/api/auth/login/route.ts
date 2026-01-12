/**
 * Login API Route with Rate Limiting
 *
 * Provides server-side login with brute force protection
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { catchErrors, AuthError, ValidationError } from '@/lib/errors'
import { checkRateLimit, authLoginRateLimit, getRateLimitHeaders } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const POST = catchErrors(async (req: NextRequest) => {
  // Get client IP for rate limiting
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown'

  // Check rate limit by IP
  const rateLimitResult = await checkRateLimit(ip, authLoginRateLimit, '/api/auth/login')

  if (!rateLimitResult.success) {
    logger.warn({
      type: 'auth_rate_limit',
      action: 'login',
      ip,
      remaining: rateLimitResult.remaining,
    })

    return NextResponse.json(
      { error: 'Too many login attempts. Please try again later.' },
      {
        status: 429,
        headers: getRateLimitHeaders(rateLimitResult),
      }
    )
  }

  // Parse and validate request body
  const body = await req.json()
  const parseResult = LoginSchema.safeParse(body)

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors[0].message)
  }

  const { email, password } = parseResult.data

  // Create Supabase admin client for server-side auth
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Attempt login
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    logger.warn({
      type: 'auth_failed',
      action: 'login',
      email: email.substring(0, 3) + '***', // Partial email for privacy
      ip,
      error: error.message,
    })

    throw new AuthError(error.message)
  }

  logger.info({
    type: 'auth_success',
    action: 'login',
    userId: data.user?.id,
  })

  return NextResponse.json(
    {
      success: true,
      user: {
        id: data.user?.id,
        email: data.user?.email,
      },
      session: data.session,
    },
    { headers: getRateLimitHeaders(rateLimitResult) }
  )
})
