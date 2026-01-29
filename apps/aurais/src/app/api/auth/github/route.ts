import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const plan = searchParams.get('plan') || 'core'

  // TODO: Implement actual GitHub OAuth flow
  // For now, redirect to a placeholder

  // In production, this would:
  // 1. Generate state token for CSRF protection
  // 2. Build GitHub OAuth URL with:
  //    - client_id
  //    - redirect_uri
  //    - scope (user:email)
  //    - state (with plan info)
  // 3. Redirect to GitHub

  const githubClientId = process.env.GITHUB_CLIENT_ID
  const redirectUri = process.env.NEXT_PUBLIC_URL + '/api/auth/github/callback'

  if (!githubClientId) {
    // Development: redirect to dashboard with message
    console.log('GitHub OAuth not configured, plan:', plan)
    return NextResponse.redirect(new URL('/dashboard?oauth=github&status=pending', request.url))
  }

  const state = Buffer.from(JSON.stringify({ plan, timestamp: Date.now() })).toString('base64')

  const githubAuthUrl = new URL('https://github.com/login/oauth/authorize')
  githubAuthUrl.searchParams.set('client_id', githubClientId)
  githubAuthUrl.searchParams.set('redirect_uri', redirectUri)
  githubAuthUrl.searchParams.set('scope', 'user:email')
  githubAuthUrl.searchParams.set('state', state)

  return NextResponse.redirect(githubAuthUrl.toString())
}
