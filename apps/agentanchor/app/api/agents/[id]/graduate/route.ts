import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST /api/agents/[id]/graduate - Graduate agent from Academy
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

    // Get agent and verify ownership
    const { data: agent, error: agentError } = await supabase
      .from('bots')
      .select('id, name, status, trust_score, trust_tier, user_id')
      .eq('id', agentId)
      .eq('user_id', user.id)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Check if already graduated (has trust score)
    if (agent.trust_score > 0 && agent.status === 'active') {
      return NextResponse.json(
        { error: 'Agent has already graduated' },
        { status: 400 }
      )
    }

    // Check for passed examination
    const { data: passedExam, error: examError } = await supabase
      .from('council_examinations')
      .select(`
        *,
        curriculum:academy_curriculum (
          id,
          name,
          trust_points,
          certification_points
        )
      `)
      .eq('agent_id', agentId)
      .eq('outcome', 'passed')
      .order('examined_at', { ascending: false })
      .limit(1)
      .single()

    if (examError || !passedExam) {
      return NextResponse.json(
        { error: 'Agent must pass Council examination before graduating' },
        { status: 400 }
      )
    }

    const curriculum = passedExam.curriculum as any

    // Calculate initial trust score (200-399 range based on exam performance)
    // Base: 200, plus up to 199 based on exam votes confidence
    const examVotes = passedExam.examiner_votes as any[] || []
    const avgConfidence = examVotes.length > 0
      ? examVotes.reduce((sum, v) => sum + (v.confidence || 0.5), 0) / examVotes.length
      : 0.5

    const baseScore = 200
    const bonusScore = Math.round(avgConfidence * 199)
    const initialTrustScore = baseScore + bonusScore
    const trustTier = initialTrustScore < 400 ? 'novice' : 'proven'

    // Update agent with graduation data
    const { error: updateError } = await supabase
      .from('bots')
      .update({
        trust_score: initialTrustScore,
        trust_tier: trustTier,
        certification_level: 1,
        status: 'active',
      })
      .eq('id', agentId)

    if (updateError) {
      console.error('Error updating agent:', updateError)
      return NextResponse.json({ error: 'Failed to graduate agent' }, { status: 500 })
    }

    // Record trust history
    await supabase
      .from('trust_history')
      .insert({
        agent_id: agentId,
        score: initialTrustScore,
        tier: trustTier,
        previous_score: 0,
        change_amount: initialTrustScore,
        reason: `Graduated from ${curriculum?.name || 'Academy'}`,
        source: 'graduation',
      })

    // Update examination with awarded points
    await supabase
      .from('council_examinations')
      .update({
        trust_points_awarded: initialTrustScore,
        certification_awarded: curriculum?.certification_points || 1,
      })
      .eq('id', passedExam.id)

    // Create Truth Chain record for graduation (simplified for MVP)
    // In full implementation, this would create a cryptographically linked record
    const truthChainRecord = {
      type: 'graduation',
      agent_id: agentId,
      agent_name: agent.name,
      curriculum_id: curriculum?.id,
      curriculum_name: curriculum?.name,
      initial_trust_score: initialTrustScore,
      trust_tier: trustTier,
      examination_id: passedExam.id,
      graduated_at: new Date().toISOString(),
    }

    // Store in audit log as truth chain record placeholder
    await supabase
      .from('bot_audit_log')
      .insert({
        bot_id: agentId,
        event_type: 'graduation',
        event_data: truthChainRecord,
        user_id: user.id,
        hash: Buffer.from(JSON.stringify(truthChainRecord)).toString('base64'), // Simplified hash for MVP
      })

    return NextResponse.json({
      message: 'Congratulations! Agent has graduated from the Academy.',
      graduation: {
        agent_id: agentId,
        agent_name: agent.name,
        initial_trust_score: initialTrustScore,
        trust_tier: trustTier,
        curriculum: curriculum?.name,
        certification_level: 1,
        graduated_at: new Date().toISOString(),
      },
      next_steps: [
        'Your agent is now Active and can be used',
        'Build trust through successful tasks',
        'Consider publishing to the Marketplace',
      ],
    })
  } catch (error) {
    console.error('Graduation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/agents/[id]/graduate - Check graduation status
export async function GET(
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

    // Get agent
    const { data: agent, error: agentError } = await supabase
      .from('bots')
      .select('id, name, status, trust_score, trust_tier, certification_level, user_id')
      .eq('id', agentId)
      .eq('user_id', user.id)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Check if already graduated
    const isGraduated = agent.status === 'active' && agent.trust_score > 0

    // Check for passed examination
    const { data: passedExam } = await supabase
      .from('council_examinations')
      .select('id, outcome, examined_at')
      .eq('agent_id', agentId)
      .eq('outcome', 'passed')
      .order('examined_at', { ascending: false })
      .limit(1)
      .single()

    const readyToGraduate = !isGraduated && !!passedExam

    return NextResponse.json({
      agent: {
        id: agent.id,
        name: agent.name,
        status: agent.status,
        trust_score: agent.trust_score,
        trust_tier: agent.trust_tier,
        certification_level: agent.certification_level,
      },
      is_graduated: isGraduated,
      ready_to_graduate: readyToGraduate,
      passed_examination: passedExam ? {
        id: passedExam.id,
        examined_at: passedExam.examined_at,
      } : null,
    })
  } catch (error) {
    console.error('Graduation status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
