import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { ApiError, AuthError, handleError, ErrorType } from '@/lib/errors'

// Validation schema
const updateNotificationsSchema = z.object({
  email: z.boolean(),
  in_app: z.boolean(),
  webhook: z.boolean(),
  webhook_url: z.string().url().nullable().optional(),
})

/**
 * GET /api/profile/notifications - Get notification preferences
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new AuthError('Unauthorized')
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('notification_preferences')
      .eq('id', user.id)
      .single()

    if (profileError) {
      logger.error({ error: profileError }, 'Failed to fetch notification preferences')
      throw new ApiError('Failed to fetch preferences', ErrorType.SUPABASE_ERROR, 500)
    }

    return NextResponse.json({
      preferences: profile.notification_preferences || {
        email: true,
        in_app: true,
        webhook: false,
      },
    })
  } catch (error) {
    return handleError(error).toResponse()
  }
}

/**
 * PATCH /api/profile/notifications - Update notification preferences
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new AuthError('Unauthorized')
    }

    const body = await request.json()
    const validatedData = updateNotificationsSchema.parse(body)

    // Build notification preferences object
    const notificationPreferences = {
      email: validatedData.email,
      in_app: validatedData.in_app,
      webhook: validatedData.webhook,
      ...(validatedData.webhook && validatedData.webhook_url
        ? { webhook_url: validatedData.webhook_url }
        : {}),
    }

    const { data: profile, error: updateError } = await supabase
      .from('profiles')
      .update({
        notification_preferences: notificationPreferences,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select('notification_preferences')
      .single()

    if (updateError) {
      logger.error({ error: updateError }, 'Failed to update notification preferences')
      throw new ApiError('Failed to update preferences', ErrorType.SUPABASE_ERROR, 500)
    }

    logger.info({ userId: user.id }, 'Notification preferences updated')

    return NextResponse.json({
      preferences: profile.notification_preferences,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors,
          },
        },
        { status: 400 }
      )
    }

    return handleError(error).toResponse()
  }
}
