/**
 * Test Webhook Endpoint
 * Epic 8: Story 8-3 Webhooks (FR146)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { sendTestWebhook } from '@/lib/api'

/**
 * POST /api/webhooks/[id]/test
 * Send a test webhook
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient({ cookies })

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await sendTestWebhook(params.id, user.id)

    if (result.success) {
      return NextResponse.json({
        success: true,
        status: result.status,
        message: 'Test webhook sent successfully',
      })
    } else {
      return NextResponse.json({
        success: false,
        status: result.status,
        error: result.error,
      })
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
