import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // TODO: Implement actual authentication with Supabase
    // For now, simulate login

    // In production, this would:
    // 1. Verify email exists
    // 2. Check password against hash
    // 3. Generate JWT token
    // 4. Set session cookie
    // 5. Return user data

    console.log('Login attempt:', { email })

    // Simulate demo login
    if (email === 'demo@aurais.net' && password === 'demo1234') {
      return NextResponse.json({
        success: true,
        user: {
          id: 'demo-user',
          name: 'Demo User',
          email: 'demo@aurais.net',
          plan: 'pro',
        },
        token: 'demo-token-' + Date.now(),
      })
    }

    // For development, allow any login
    return NextResponse.json({
      success: true,
      user: {
        id: 'user-' + Date.now(),
        name: 'Test User',
        email,
        plan: 'core',
      },
      token: 'dev-token-' + Date.now(),
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
