import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { ApiError, AuthError, handleError, ErrorType } from '@/lib/errors'

// Validation schemas
const updateProfileSchema = z.object({
  role: z.enum(['trainer', 'consumer', 'both']).optional(),
  fullName: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().optional().nullable(),
  storefrontName: z.string().min(1).max(100).optional().nullable(),
  storefrontBio: z.string().max(500).optional().nullable(),
  onboardingCompleted: z.boolean().optional(),
})

/**
 * GET /api/profile - Get current user's profile
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new AuthError('Unauthorized')
    }

    // Get profile from database (user.id = profile.id in Supabase)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError) {
      // If profile doesn't exist, create one
      if (profileError.code === 'PGRST116') {
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email!,
            full_name: user.user_metadata?.full_name || null,
          })
          .select()
          .single()

        if (createError) {
          logger.error({ error: createError }, 'Failed to create profile')
          throw new ApiError('Failed to create profile', ErrorType.SUPABASE_ERROR, 500)
        }

        return NextResponse.json({ profile: newProfile })
      }

      logger.error({ error: profileError }, 'Failed to fetch profile')
      throw new ApiError('Failed to fetch profile', ErrorType.SUPABASE_ERROR, 500)
    }

    return NextResponse.json({ profile })
  } catch (error) {
    return handleError(error).toResponse()
  }
}

/**
 * PATCH /api/profile - Update current user's profile
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new AuthError('Unauthorized')
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = updateProfileSchema.parse(body)

    // Build update object with snake_case keys for database
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (validatedData.role !== undefined) {
      updateData.role = validatedData.role
    }
    if (validatedData.fullName !== undefined) {
      updateData.full_name = validatedData.fullName
    }
    if (validatedData.avatarUrl !== undefined) {
      updateData.avatar_url = validatedData.avatarUrl
    }
    if (validatedData.storefrontName !== undefined) {
      updateData.storefront_name = validatedData.storefrontName
    }
    if (validatedData.storefrontBio !== undefined) {
      updateData.storefront_bio = validatedData.storefrontBio
    }

    // Update or create profile (user.id = profile.id in Supabase)
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    let profile

    if (existingProfile) {
      // Update existing profile
      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id)
        .select()
        .single()

      if (updateError) {
        logger.error({ error: updateError }, 'Failed to update profile')
        throw new ApiError('Failed to update profile', ErrorType.SUPABASE_ERROR, 500)
      }

      profile = updatedProfile
    } else {
      // Create new profile
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email!,
          full_name: validatedData.fullName || user.user_metadata?.full_name || null,
          ...updateData,
        })
        .select()
        .single()

      if (createError) {
        logger.error({ error: createError }, 'Failed to create profile')
        throw new ApiError('Failed to create profile', ErrorType.SUPABASE_ERROR, 500)
      }

      profile = newProfile
    }

    logger.info({ userId: user.id, updates: Object.keys(validatedData) }, 'Profile updated')

    return NextResponse.json({ profile })
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
