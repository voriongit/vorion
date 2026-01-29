import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    // Validate required fields
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // In production, this would:
    // 1. Check if email exists in database
    // 2. Generate a secure reset token
    // 3. Store token with expiration (e.g., 1 hour)
    // 4. Send email with reset link containing token
    // 5. Return success (always return success to prevent email enumeration)

    console.log('Password reset requested for:', email)

    // Always return success to prevent email enumeration attacks
    // Even if the email doesn't exist in the system, we respond the same way
    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
