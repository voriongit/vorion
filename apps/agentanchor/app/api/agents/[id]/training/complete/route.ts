import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const completeModuleSchema = z.object({
  enrollmentId: z.string().uuid(),
  moduleId: z.string(),
  score: z.number().min(0).max(100).optional(),
})

// POST /api/agents/[id]/training/complete - Complete a module
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const agentId = params.id
    const body = await request.json()

    const validation = completeModuleSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid input', details: validation.error.errors }, { status: 400 })
    }

    const { enrollmentId, moduleId, score } = validation.data

    // Get enrollment and verify ownership
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('academy_enrollments')
      .select(`
        *,
        curriculum:academy_curriculum (id, modules, trust_points, certification_points),
        agent:bots!inner (id, user_id, trust_score)
      `)
      .eq('id', enrollmentId)
      .eq('agent_id', agentId)
      .single()

    if (enrollmentError || !enrollment) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
    }

    if ((enrollment.agent as any).user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const modules = (enrollment.curriculum as any)?.modules || []
    const progress = enrollment.progress as any
    const modulesCompleted = progress?.modules_completed || []

    // Verify module exists
    const moduleIndex = modules.findIndex((m: any) => m.id === moduleId)
    if (moduleIndex === -1) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 })
    }

    // Check if already completed
    if (modulesCompleted.includes(moduleId)) {
      return NextResponse.json({ error: 'Module already completed' }, { status: 400 })
    }

    // Verify this is the current module or an available one
    const isCurrentModule = progress?.current_module === moduleId
    const previousCompleted = moduleIndex === 0 || modulesCompleted.includes(modules[moduleIndex - 1]?.id)

    if (!isCurrentModule && !previousCompleted) {
      return NextResponse.json({ error: 'Module not available yet' }, { status: 400 })
    }

    // Update progress
    const newModulesCompleted = [...modulesCompleted, moduleId]
    const newScores = { ...(progress?.scores || {}), [moduleId]: score || 100 }

    // Determine next module
    const nextModule = modules[moduleIndex + 1]
    const isAllComplete = newModulesCompleted.length === modules.length

    const newProgress = {
      ...progress,
      modules_completed: newModulesCompleted,
      current_module: isAllComplete ? null : (nextModule?.id || null),
      scores: newScores,
      attempts: (progress?.attempts || 0) + 1,
    }

    // Calculate final score if all complete
    const updates: any = {
      progress: newProgress,
    }

    if (isAllComplete) {
      const avgScore = Object.values(newScores).reduce((a: number, b: any) => a + b, 0) / Object.values(newScores).length
      updates.final_score = Math.round(avgScore as number)
      updates.completed_at = new Date().toISOString()
      updates.status = 'completed'
    }

    // Update enrollment
    const { error: updateError } = await supabase
      .from('academy_enrollments')
      .update(updates)
      .eq('id', enrollmentId)

    if (updateError) {
      console.error('Error updating enrollment:', updateError)
      return NextResponse.json({ error: 'Failed to complete module' }, { status: 500 })
    }

    // If curriculum completed, award trust points and update agent
    let trustAwarded = 0
    if (isAllComplete) {
      const curriculum = enrollment.curriculum as any
      trustAwarded = curriculum?.trust_points || 50
      const currentTrust = (enrollment.agent as any)?.trust_score || 0
      const newTrust = Math.min(1000, currentTrust + trustAwarded)

      // Update agent trust score
      await supabase
        .from('bots')
        .update({ trust_score: newTrust })
        .eq('id', agentId)

      // Record trust history
      await supabase
        .from('trust_history')
        .insert({
          agent_id: agentId,
          score: newTrust,
          tier: calculateTrustTier(newTrust),
          previous_score: currentTrust,
          change_amount: trustAwarded,
          reason: `Completed curriculum: ${curriculum?.name || 'Unknown'}`,
          source: 'academy_complete',
        })
    }

    return NextResponse.json({
      message: isAllComplete ? 'Curriculum completed!' : 'Module completed',
      module_completed: moduleId,
      next_module: nextModule?.id || null,
      progress: newProgress,
      curriculum_completed: isAllComplete,
      trust_awarded: trustAwarded,
      ready_for_exam: isAllComplete,
    })
  } catch (error) {
    console.error('Complete module error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to calculate trust tier
function calculateTrustTier(score: number): string {
  if (score < 200) return 'untrusted'
  if (score < 400) return 'novice'
  if (score < 600) return 'proven'
  if (score < 800) return 'trusted'
  if (score < 900) return 'elite'
  return 'legendary'
}
