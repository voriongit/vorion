import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const plan = searchParams.get('plan') || 'core'

  // TODO: Implement actual Google OAuth flow
  // For now, redirect to a placeholder

  // In production, this would:
  // 1. Generate state token for CSRF protection
  // 2. Build Google OAuth URL with:
  //    - client_id
  //    - redirect_uri
  //    - scope (email, profile)
  //    - state (with plan info)
  // 3. Redirect to Google

  const googleClientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = process.env.NEXT_PUBLIC_URL + '/api/auth/google/callback'

  if (!googleClientId) {
    // Development: redirect to dashboard with message
    console.log('Google OAuth not configured, plan:', plan)
    return NextResponse.redirect(new URL('/dashboard?oauth=google&status=pending', request.url))
  }

  const state = Buffer.from(JSON.stringify({ plan, timestamp: Date.now() })).toString('base64')

  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  googleAuthUrl.searchParams.set('client_id', googleClientId)
  googleAuthUrl.searchParams.set('redirect_uri', redirectUri)
  googleAuthUrl.searchParams.set('response_type', 'code')
  googleAuthUrl.searchParams.set('scope', 'email profile')
  googleAuthUrl.searchParams.set('state', state)

  return NextResponse.redirect(googleAuthUrl.toString())
}
