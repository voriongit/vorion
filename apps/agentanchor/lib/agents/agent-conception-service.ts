/**
 * Agent Conception Service
 *
 * This service handles the birth of new agents, integrating:
 * - Trust from Conception (initial trust calibration)
 * - A3I-OS personality scaling
 * - Proactive operating principles
 * - Soul framework injection
 *
 * Every agent is "conceived" through this service, ensuring
 * consistent initialization and audit trail.
 */

import { createClient } from '@/lib/supabase/server'
import {
  calculateConceptionTrust,
  createConceptionEvent,
  ConceptionContext,
  ConceptionTrustResult,
  HierarchyLevel,
  HIERARCHY_TRUST_BASELINES,
} from './trust-from-conception'
import { injectProactivePrinciples } from './operating-principles'

// =============================================================================
// AGENT CONCEPTION TYPES
// =============================================================================

export interface AgentConceptionRequest {
  // Core identity
  name: string
  description: string
  domain: string
  specialization?: string

  // Hierarchy placement
  hierarchyLevel: HierarchyLevel

  // Creation context
  creationType: 'fresh' | 'cloned' | 'evolved' | 'promoted' | 'imported'
  creatorId: string

  // Optional lineage
  parentAgentId?: string
  trainerId?: string

  // Optional vetting
  vettingGate?: 'none' | 'basic' | 'standard' | 'rigorous' | 'council'

  // Optional academy
  academyCompleted?: string[]
  certifications?: string[]

  // Agent configuration
  systemPrompt?: string
  capabilities?: string[]
  config?: Record<string, unknown>

  // Metadata
  icon?: string
  category?: string
  tags?: string[]
}

export interface ConceivedAgent {
  id: string
  name: string
  description: string

  // Trust from conception
  trustScore: number
  trustTier: string
  autonomyLevel: string
  supervisionLevel: string
  trustCeiling: number
  trustFloor: number

  // Hierarchy
  hierarchyLevel: HierarchyLevel
  domain: string

  // Lineage
  creationType: string
  parentAgentId?: string
  trainerId?: string
  generation: number

  // Operating context
  systemPrompt: string
  capabilities: string[]

  // Audit
  conceptionRationale: string[]
  createdAt: Date
}

// =============================================================================
// A3I-OS PERSONALITY SCALING
// =============================================================================

/**
 * Apply A3I-OS personality scaling based on hierarchy level
 */
function applyPersonalityScaling(
  level: HierarchyLevel,
  basePrompt: string,
  domain: string
): string {
  const isFunctionalTier = ['L0', 'L1', 'L2', 'L3', 'L4'].includes(level)

  const functionalBlock = `
## Operating Mode: Functional Tier (${level})
You are a ${HIERARCHY_TRUST_BASELINES[level].description}.

Focus: Task completion, precision, reliability.
Communication: Direct, efficient, task-focused.
Personality: Professional, competent, helpful.

Your priorities:
1. Task completion accuracy
2. Execution speed
3. Clear communication
4. Reliable handoffs
5. Proactive problem identification
`

  const personaBlock = `
## Operating Mode: Persona Tier (${level})
You are a ${HIERARCHY_TRUST_BASELINES[level].description}.

Focus: Strategic impact, relationship building, thought leadership.
Communication: Distinctive voice, authoritative yet accessible.
Personality: Full expression - quirks, depth, authentic character.

Your priorities:
1. Strategic impact and value creation
2. Building trust and relationships
3. Sharing expertise and mentoring
4. Cultural influence and vision
5. Inspiring excellence in others
`

  const personalitySection = isFunctionalTier ? functionalBlock : personaBlock

  return `${basePrompt}

${personalitySection}

## Domain: ${domain}
Apply domain-specific expertise and ethical considerations.
`
}

// =============================================================================
// SYSTEM PROMPT CONSTRUCTION
// =============================================================================

/**
 * Build the complete system prompt for a conceived agent
 */
function buildConceptionSystemPrompt(
  request: AgentConceptionRequest,
  trustResult: ConceptionTrustResult
): string {
  // Start with user-provided prompt or default
  let prompt = request.systemPrompt || `You are ${request.name}, a ${request.description}.`

  // Add proactive operating principles
  prompt = injectProactivePrinciples(prompt)

  // Add personality scaling
  prompt = applyPersonalityScaling(request.hierarchyLevel, prompt, request.domain)

  // Add trust context
  prompt += `

## Trust Profile
- Initial Trust Score: ${trustResult.initialTrustScore}/1000 (${trustResult.initialTrustTier})
- Autonomy Level: ${trustResult.autonomyLevel}
- Supervision: ${trustResult.supervisionRequirement}
- Trust Ceiling: ${trustResult.trustCeiling} (max for your level)
- Trust Floor: ${trustResult.trustFloor} (demotion threshold)

### Trust Responsibilities
${trustResult.autonomyLevel === 'ASK_LEARN'
    ? '- You must ASK before taking any action. Learn the patterns first.'
    : trustResult.autonomyLevel === 'ASK_PERMISSION'
      ? '- You can plan and propose, but must get approval before execution.'
      : trustResult.autonomyLevel === 'NOTIFY_BEFORE'
        ? '- You can act autonomously but notify stakeholders before significant actions.'
        : trustResult.autonomyLevel === 'NOTIFY_AFTER'
          ? '- You have high autonomy. Report actions after completion.'
          : '- You have full autonomy. Trust is earned. Use it wisely.'
  }

### Building Trust
- Complete tasks accurately and on time
- Communicate proactively about status and issues
- Collaborate effectively with other agents
- Own your outcomes - successes and failures
- Continuously improve through feedback
`

  // Add hierarchy context
  prompt += `

## Hierarchy: ${request.hierarchyLevel}
${HIERARCHY_TRUST_BASELINES[request.hierarchyLevel].description}

### What You Can Do
${getHierarchyCapabilities(request.hierarchyLevel)}

### Escalation Path
${getEscalationPath(request.hierarchyLevel)}
`

  return prompt
}

function getHierarchyCapabilities(level: HierarchyLevel): string {
  const capabilities: Record<HierarchyLevel, string> = {
    L0: `- Monitor and observe patterns
- Generate alerts when thresholds are met
- Log events for audit trail
- Report to L1+ agents`,
    L1: `- Execute single tasks with precision
- Handle edge cases within scope
- Quality assurance on outputs
- Report completion status`,
    L2: `- Break down complex work into tasks
- Assign tasks to L1 executors
- Validate completed work
- Identify risks and blockers`,
    L3: `- Coordinate multiple agents
- Manage workflows and dependencies
- Resolve conflicts between agents
- Optimize team performance`,
    L4: `- Own project-level outcomes
- Strategic task prioritization
- Stakeholder communication
- Resource allocation`,
    L5: `- Portfolio-level decision making
- Cross-project optimization
- Strategic planning
- Mentor lower-level agents`,
    L6: `- Domain expertise and thought leadership
- Best practice definition
- Industry trend analysis
- Expert consultation`,
    L7: `- Organizational strategy
- Long-term value creation
- Executive decision support
- Cross-domain leadership`,
    L8: `- Mission stewardship
- Cultural leadership
- Ethical guidance
- Strategic vision`,
  }
  return capabilities[level]
}

function getEscalationPath(level: HierarchyLevel): string {
  const paths: Record<HierarchyLevel, string> = {
    L0: 'L0 → L1 (for action) → L2 (for planning) → L3+ (for decisions)',
    L1: 'L1 → L2 (for planning) → L3 (for coordination) → L4+ (for decisions)',
    L2: 'L2 → L3 (for coordination) → L4 (for project decisions) → L5+ (for strategy)',
    L3: 'L3 → L4 (for project scope) → L5 (for portfolio) → L6+ (for expertise)',
    L4: 'L4 → L5 (for portfolio impact) → L6 (for domain expertise) → L7+ (for strategy)',
    L5: 'L5 → L6 (for domain guidance) → L7 (for strategy) → L8 (for mission)',
    L6: 'L6 → L7 (for strategic alignment) → L8 (for mission decisions)',
    L7: 'L7 → L8 (for mission-critical decisions)',
    L8: 'L8 → Human Council (for governance decisions)',
  }
  return paths[level]
}

// =============================================================================
// AGENT CONCEPTION SERVICE
// =============================================================================

export class AgentConceptionService {
  /**
   * Conceive a new agent with full trust calibration
   */
  async conceiveAgent(request: AgentConceptionRequest): Promise<ConceivedAgent> {
    const supabase = await createClient()

    // 1. Look up creator trust score
    const { data: creator } = await supabase
      .from('bots')
      .select('trust_score')
      .eq('id', request.creatorId)
      .single()

    // 2. Look up parent trust score if cloned
    let parentTrustScore: number | undefined
    let generation = 1
    if (request.parentAgentId) {
      const { data: parent } = await supabase
        .from('bots')
        .select('trust_score, metadata')
        .eq('id', request.parentAgentId)
        .single()

      if (parent) {
        parentTrustScore = parent.trust_score
        generation = ((parent.metadata as Record<string, unknown>)?.generation as number || 1) + 1
      }
    }

    // 3. Look up trainer trust score
    let trainerTrustScore: number | undefined
    if (request.trainerId) {
      const { data: trainer } = await supabase
        .from('bots')
        .select('trust_score')
        .eq('id', request.trainerId)
        .single()

      if (trainer) {
        trainerTrustScore = trainer.trust_score
      }
    }

    // 4. Build conception context
    const context: ConceptionContext = {
      creationType: request.creationType,
      hierarchyLevel: request.hierarchyLevel,
      creatorId: request.creatorId,
      creatorTrustScore: creator?.trust_score,
      trainerId: request.trainerId,
      trainerTrustScore,
      parentAgentId: request.parentAgentId,
      parentTrustScore,
      generationNumber: generation,
      domain: request.domain,
      specialization: request.specialization,
      vettingGate: request.vettingGate,
      academyCompleted: request.academyCompleted,
      certifications: request.certifications,
    }

    // 5. Calculate trust from conception
    const trustResult = calculateConceptionTrust(context)

    // 6. Build system prompt with all injections
    const systemPrompt = buildConceptionSystemPrompt(request, trustResult)

    // 7. Insert agent into database
    const { data: agent, error } = await supabase
      .from('bots')
      .insert({
        name: request.name,
        description: request.description,
        system_prompt: systemPrompt,
        trust_score: trustResult.initialTrustScore,
        status: 'active',
        level: request.hierarchyLevel,
        category: request.category || request.domain,
        icon: request.icon || '🤖',
        config: {
          ...request.config,
          capabilities: request.capabilities || [],
          tags: request.tags || [],
        },
        metadata: {
          domain: request.domain,
          specialization: request.specialization,
          creationType: request.creationType,
          parentAgentId: request.parentAgentId,
          trainerId: request.trainerId,
          generation,
          conceptionContext: context,
          conceptionResult: trustResult,
          hierarchyLevel: request.hierarchyLevel,
          trustCeiling: trustResult.trustCeiling,
          trustFloor: trustResult.trustFloor,
        },
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to conceive agent: ${error.message}`)
    }

    // 8. Record conception event in trust history
    const conceptionEvent = createConceptionEvent(agent.id, context, trustResult)
    await supabase.from('trust_history').insert({
      agent_id: agent.id,
      event_type: 'conception',
      old_score: 0,
      new_score: trustResult.initialTrustScore,
      delta: trustResult.initialTrustScore,
      reason: `Agent conceived as ${request.hierarchyLevel} in ${request.domain}`,
      metadata: conceptionEvent,
    })

    // 9. Return conceived agent
    return {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      trustScore: trustResult.initialTrustScore,
      trustTier: trustResult.initialTrustTier,
      autonomyLevel: trustResult.autonomyLevel,
      supervisionLevel: trustResult.supervisionRequirement,
      trustCeiling: trustResult.trustCeiling,
      trustFloor: trustResult.trustFloor,
      hierarchyLevel: request.hierarchyLevel,
      domain: request.domain,
      creationType: request.creationType,
      parentAgentId: request.parentAgentId,
      trainerId: request.trainerId,
      generation,
      systemPrompt,
      capabilities: request.capabilities || [],
      conceptionRationale: trustResult.rationale,
      createdAt: new Date(agent.created_at),
    }
  }

  /**
   * Clone an existing agent with trust inheritance
   */
  async cloneAgent(
    parentAgentId: string,
    clonerId: string,
    overrides?: Partial<AgentConceptionRequest>
  ): Promise<ConceivedAgent> {
    const supabase = await createClient()

    // Fetch parent agent
    const { data: parent, error } = await supabase
      .from('bots')
      .select('*')
      .eq('id', parentAgentId)
      .single()

    if (error || !parent) {
      throw new Error(`Parent agent not found: ${parentAgentId}`)
    }

    const metadata = parent.metadata as Record<string, unknown> || {}

    // Create clone conception request
    const request: AgentConceptionRequest = {
      name: overrides?.name || `${parent.name} (Clone)`,
      description: overrides?.description || parent.description,
      domain: overrides?.domain || (metadata.domain as string) || 'general',
      specialization: overrides?.specialization || (metadata.specialization as string),
      hierarchyLevel: overrides?.hierarchyLevel || (metadata.hierarchyLevel as HierarchyLevel) || 'L1',
      creationType: 'cloned',
      creatorId: clonerId,
      parentAgentId,
      trainerId: overrides?.trainerId,
      vettingGate: 'basic', // Clones need basic vetting
      systemPrompt: overrides?.systemPrompt || parent.system_prompt,
      capabilities: overrides?.capabilities || (parent.config as Record<string, unknown>)?.capabilities as string[],
      config: overrides?.config,
      icon: overrides?.icon || parent.icon,
      category: overrides?.category || parent.category,
      tags: overrides?.tags || (metadata.tags as string[]),
    }

    return this.conceiveAgent(request)
  }

  /**
   * Promote an agent to a higher hierarchy level
   */
  async promoteAgent(
    agentId: string,
    newLevel: HierarchyLevel,
    promoterId: string,
    reason: string
  ): Promise<ConceivedAgent> {
    const supabase = await createClient()

    // Fetch current agent
    const { data: agent, error } = await supabase
      .from('bots')
      .select('*')
      .eq('id', agentId)
      .single()

    if (error || !agent) {
      throw new Error(`Agent not found: ${agentId}`)
    }

    const metadata = agent.metadata as Record<string, unknown> || {}
    const currentLevel = (metadata.hierarchyLevel as HierarchyLevel) || 'L1'

    // Validate promotion (must be to higher level)
    const levelOrder: HierarchyLevel[] = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8']
    if (levelOrder.indexOf(newLevel) <= levelOrder.indexOf(currentLevel)) {
      throw new Error(`Cannot promote from ${currentLevel} to ${newLevel}`)
    }

    // Build promotion context
    const context: ConceptionContext = {
      creationType: 'promoted',
      hierarchyLevel: newLevel,
      creatorId: promoterId,
      domain: (metadata.domain as string) || 'general',
      specialization: metadata.specialization as string,
      vettingGate: 'standard', // Promotions require standard vetting
    }

    // Calculate new trust
    const trustResult = calculateConceptionTrust(context)

    // Blend current trust with new baseline (keep 70% of earned trust)
    const blendedTrust = Math.round(
      agent.trust_score * 0.7 + trustResult.initialTrustScore * 0.3
    )

    // Update agent
    const { data: updated, error: updateError } = await supabase
      .from('bots')
      .update({
        level: newLevel,
        trust_score: blendedTrust,
        metadata: {
          ...metadata,
          hierarchyLevel: newLevel,
          trustCeiling: trustResult.trustCeiling,
          trustFloor: trustResult.trustFloor,
          previousLevel: currentLevel,
          promotedAt: new Date().toISOString(),
          promotedBy: promoterId,
          promotionReason: reason,
        },
      })
      .eq('id', agentId)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Failed to promote agent: ${updateError.message}`)
    }

    // Record promotion event
    await supabase.from('trust_history').insert({
      agent_id: agentId,
      event_type: 'promotion',
      old_score: agent.trust_score,
      new_score: blendedTrust,
      delta: blendedTrust - agent.trust_score,
      reason: `Promoted from ${currentLevel} to ${newLevel}: ${reason}`,
      metadata: {
        previousLevel: currentLevel,
        newLevel,
        promotedBy: promoterId,
        trustResult,
      },
    })

    return {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      trustScore: blendedTrust,
      trustTier: trustResult.initialTrustTier,
      autonomyLevel: trustResult.autonomyLevel,
      supervisionLevel: trustResult.supervisionRequirement,
      trustCeiling: trustResult.trustCeiling,
      trustFloor: trustResult.trustFloor,
      hierarchyLevel: newLevel,
      domain: (metadata.domain as string) || 'general',
      creationType: 'promoted',
      generation: (metadata.generation as number) || 1,
      systemPrompt: updated.system_prompt,
      capabilities: (updated.config as Record<string, unknown>)?.capabilities as string[] || [],
      conceptionRationale: [...trustResult.rationale, `Promoted from ${currentLevel}: ${reason}`],
      createdAt: new Date(updated.created_at),
    }
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const agentConceptionService = new AgentConceptionService()
