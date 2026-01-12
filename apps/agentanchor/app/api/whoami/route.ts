import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({
      authenticated: false,
      message: 'Not signed in',
      error: authError?.message,
    })
  }

  // Get profile info (user.id = profile.id in Supabase)
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      last_sign_in: user.last_sign_in_at,
    },
    profile: profile || null,
  })
}
