import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // List of protected routes that require authentication
  const protectedRoutes = [
    '/dashboard',
    '/bots',
    '/teams',
    '/chat',
    '/orchestrator',
    '/mcp',
    '/settings',
    '/collaborate',
    '/conversations',
  ]

  const isProtectedRoute = protectedRoutes.some(route =>
    req.nextUrl.pathname.startsWith(route)
  )

  // Protect dashboard and other authenticated routes
  if (isProtectedRoute) {
    if (!session) {
      return NextResponse.redirect(new URL('/auth/login', req.url))
    }
  }

  // Protect onboarding routes - must be logged in
  if (req.nextUrl.pathname.startsWith('/onboarding')) {
    if (!session) {
      return NextResponse.redirect(new URL('/auth/login', req.url))
    }
  }

  // Redirect to dashboard if already logged in (from auth pages)
  if (req.nextUrl.pathname.startsWith('/auth')) {
    if (session) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  // Add security headers
  const headers = new Headers(res.headers)

  // Prevent clickjacking
  headers.set('X-Frame-Options', 'DENY')

  // Prevent MIME type sniffing
  headers.set('X-Content-Type-Options', 'nosniff')

  // XSS Protection
  headers.set('X-XSS-Protection', '1; mode=block')

  // Referrer Policy
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Permissions Policy
  headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  )

  // Content Security Policy
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.vercel-insights.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ]
  headers.set('Content-Security-Policy', cspDirectives.join('; '))

  // HSTS (HTTP Strict Transport Security) - production only
  if (process.env.NODE_ENV === 'production') {
    headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  })
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/bots/:path*',
    '/teams/:path*',
    '/chat/:path*',
    '/orchestrator/:path*',
    '/mcp/:path*',
    '/auth/:path*',
    '/onboarding/:path*',
    '/settings/:path*',
    '/collaborate/:path*',
    '/conversations/:path*',
  ],
}
