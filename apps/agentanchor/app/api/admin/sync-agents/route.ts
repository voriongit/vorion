import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { logger } from '@/lib/logger'
import { AuthError, ApiError, handleError, ErrorType } from '@/lib/errors'
import agentSeedData from '@/data/seeds/ai-workforce-agents.json'

interface SeedAgent {
  name: string
  description: string
  system_prompt: string
  model?: string
  trust_score?: number
  config?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

/**
 * POST /api/admin/sync-agents - Sync agents from seed file to database
 *
 * Query params:
 *   - mode: 'upsert' (default) | 'insert-only' | 'dry-run'
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // Verify authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new AuthError('Unauthorized')
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      throw new ApiError('Profile not found', ErrorType.NOT_FOUND, 404)
    }

    // Parse options from query or body
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') || 'upsert'
    const isDryRun = mode === 'dry-run'

    // Load agents from seed file
    const agents: SeedAgent[] = agentSeedData.agents || []

    if (agents.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No agents in seed file',
        stats: { total: 0, imported: 0, updated: 0, skipped: 0, errors: 0 }
      })
    }

    // Get existing agents for this user
    const { data: existingAgents } = await supabase
      .from('agents')
      .select('id, name')
      .eq('owner_id', profile.id)

    const existingByName = new Map(
      (existingAgents || []).map(a => [a.name, a.id])
    )

    let imported = 0
    let updated = 0
    let skipped = 0
    let errors = 0
    const errorDetails: string[] = []

    for (const agent of agents) {
      try {
        const existingId = existingByName.get(agent.name)

        if (existingId) {
          // Agent exists
          if (mode === 'insert-only') {
            skipped++
            continue
          }

          if (!isDryRun) {
            // Update existing agent
            const { error: updateError } = await supabase
              .from('agents')
              .update({
                description: agent.description,
                system_prompt: agent.system_prompt,
                model: agent.model || 'claude-sonnet-4-20250514',
                trust_score: agent.trust_score || 400,
                config: agent.config || {},
                metadata: agent.metadata || {},
                updated_at: new Date().toISOString()
              })
              .eq('id', existingId)

            if (updateError) {
              throw updateError
            }
          }
          updated++
        } else {
          // New agent
          if (!isDryRun) {
            const { error: insertError } = await supabase
              .from('agents')
              .insert({
                owner_id: profile.id,
                name: agent.name,
                description: agent.description,
                system_prompt: agent.system_prompt,
                model: agent.model || 'claude-sonnet-4-20250514',
                status: 'active',
                trust_score: agent.trust_score || 400,
                config: agent.config || {},
                metadata: agent.metadata || {},
                graduated_at: new Date().toISOString()
              })

            if (insertError) {
              throw insertError
            }
          }
          imported++
        }
      } catch (err) {
        errors++
        const errMsg = err instanceof Error ? err.message : String(err)
        if (errorDetails.length < 5) {
          errorDetails.push(`${agent.name}: ${errMsg}`)
        }
      }
    }

    logger.info({
      userId: user.id,
      mode,
      stats: { total: agents.length, imported, updated, skipped, errors }
    }, 'Agent sync completed')

    return NextResponse.json({
      success: true,
      message: isDryRun ? 'Dry run completed' : 'Sync completed',
      mode,
      stats: {
        total: agents.length,
        imported,
        updated,
        skipped,
        errors
      },
      ...(errorDetails.length > 0 && { errorDetails })
    })

  } catch (error) {
    return handleError(error).toResponse()
  }
}

/**
 * GET /api/admin/sync-agents - Get sync status and agent counts
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new AuthError('Unauthorized')
    }

    // Count agents in seed file
    const seedAgents: SeedAgent[] = agentSeedData.agents || []
    const seedCount = seedAgents.length

    // Count user's agents in database
    const { count: dbCount } = await supabase
      .from('agents')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', user.id)

    // Find agents only in seed (not yet imported)
    const { data: existingAgents } = await supabase
      .from('agents')
      .select('name')
      .eq('owner_id', user.id)

    const existingNames = new Set((existingAgents || []).map(a => a.name))
    const pendingImport = seedAgents.filter(a => !existingNames.has(a.name))

    return NextResponse.json({
      seedFile: {
        path: 'data/seeds/ai-workforce-agents.json',
        count: seedCount
      },
      database: {
        count: dbCount || 0
      },
      sync: {
        pendingImport: pendingImport.length,
        inSync: pendingImport.length === 0,
        pendingAgents: pendingImport.slice(0, 10).map(a => a.name)
      }
    })

  } catch (error) {
    return handleError(error).toResponse()
  }
}
