/**
 * Phase 6 Trust Engine Service
 *
 * Production-grade trust computation with regulatory compliance.
 * Implements all 5 architecture decisions (Q1-Q5).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// =============================================================================
// TYPES
// =============================================================================

export type TrustTier = 'T0' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5'
export type AgentRole = 'R_L0' | 'R_L1' | 'R_L2' | 'R_L3' | 'R_L4' | 'R_L5' | 'R_L6' | 'R_L7' | 'R_L8'
export type ContextType = 'DEPLOYMENT' | 'ORGANIZATION' | 'AGENT' | 'OPERATION'
export type CreationType = 'FRESH' | 'CLONED' | 'EVOLVED' | 'PROMOTED' | 'IMPORTED'
export type RoleGateDecision = 'ALLOW' | 'DENY' | 'ESCALATE'
export type ComplianceStatus = 'COMPLIANT' | 'WARNING' | 'VIOLATION'
export type GamingAlertType = 'RAPID_CHANGE' | 'OSCILLATION' | 'BOUNDARY_TESTING' | 'CEILING_BREACH'
export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type AlertStatus = 'ACTIVE' | 'INVESTIGATING' | 'RESOLVED' | 'FALSE_POSITIVE'

export interface Phase6Stats {
  contextStats: {
    deployments: number
    organizations: number
    agents: number
    activeOperations: number
  }
  ceilingStats: {
    totalEvents: number
    totalAuditEntries: number
    complianceBreakdown: {
      compliant: number
      warning: number
      violation: number
    }
    agentsWithAlerts: number
  }
  roleGateStats: {
    totalEvaluations: number
    byDecision: {
      ALLOW: number
      DENY: number
      ESCALATE: number
    }
  }
  presetStats: {
    aciPresets: number
    vorionPresets: number
    axiomPresets: number
    verifiedLineages: number
  }
  provenanceStats: {
    totalRecords: number
    byCreationType: Record<CreationType, number>
  }
}

export interface TrustTierData {
  tier: TrustTier
  label: string
  range: string
  count: number
  color: string
}

export interface RecentEvent {
  id: string
  type: 'ceiling' | 'role_gate' | 'context' | 'provenance'
  agentId: string
  decision?: string
  status: ComplianceStatus
  timestamp: string
}

export interface DeploymentContext {
  id: string
  deploymentId: string
  name: string
  version: string
  environment: 'development' | 'staging' | 'production'
  regulatoryJurisdiction?: string
  maxTrustCeiling: number
  contextHash: string
  frozenAt: string
  createdAt: string
}

export interface OrgContext {
  id: string
  deploymentId: string
  orgId: string
  name: string
  complianceFrameworks: string[]
  trustCeiling: number
  contextHash: string
  parentHash: string
  lockedAt?: string
  gracePeriodEnds?: string
  createdAt: string
  updatedAt: string
}

export interface AgentContext {
  id: string
  deploymentId: string
  orgId: string
  agentId: string
  name: string
  capabilities: string[]
  trustCeiling: number
  contextHash: string
  parentHash: string
  frozenAt: string
  createdAt: string
}

export interface OperationContext {
  id: string
  deploymentId: string
  orgId: string
  agentId: string
  operationId: string
  operationType: string
  requestedRole: AgentRole
  contextHash: string
  parentHash: string
  startedAt: string
  completedAt?: string
  ttlSeconds: number
}

export interface Provenance {
  id: string
  agentId: string
  creationType: CreationType
  parentAgentId?: string
  createdBy: string
  originDeployment?: string
  originOrg?: string
  trustModifier: number
  provenanceHash: string
  parentProvenanceHash?: string
  metadata: Record<string, unknown>
  createdAt: string
}

export interface RoleGateEvaluation {
  id: string
  agentId: string
  requestedRole: AgentRole
  currentTier: TrustTier
  currentScore: number
  kernelAllowed: boolean
  policyResult?: RoleGateDecision
  policyApplied?: string
  basisOverrideUsed: boolean
  basisApprovers?: string[]
  finalDecision: RoleGateDecision
  decisionReason?: string
  operationId?: string
  attestations?: string[]
  createdAt: string
}

export interface CeilingEvent {
  id: string
  agentId: string
  eventType: string
  previousScore: number
  proposedScore: number
  finalScore: number
  effectiveCeiling: number
  ceilingSource: string
  ceilingApplied: boolean
  complianceStatus: ComplianceStatus
  complianceFramework?: string
  auditRequired: boolean
  retentionDays?: number
  createdAt: string
}

export interface GamingAlert {
  id: string
  agentId: string
  alertType: GamingAlertType
  severity: AlertSeverity
  status: AlertStatus
  details: string
  occurrences: number
  thresholdValue?: number
  actualValue?: number
  windowStart: string
  windowEnd: string
  resolvedAt?: string
  resolvedBy?: string
  resolutionNotes?: string
  createdAt: string
  updatedAt: string
}

export interface AciPreset {
  id: string
  presetId: string
  name: string
  description?: string
  weights: Record<string, number>
  constraints: Record<string, unknown>
  presetHash: string
  version: number
  createdAt: string
}

export interface VorionPreset {
  id: string
  presetId: string
  parentAciPresetId: string
  name: string
  description?: string
  weightOverrides: Record<string, number>
  additionalConstraints: Record<string, unknown>
  presetHash: string
  parentHash: string
  version: number
  createdAt: string
  updatedAt: string
}

export interface AxiomPreset {
  id: string
  presetId: string
  deploymentId: string
  parentVorionPresetId: string
  name: string
  weightOverrides: Record<string, number>
  deploymentConstraints: Record<string, unknown>
  presetHash: string
  parentHash: string
  lineageVerified: boolean
  lineageVerifiedAt?: string
  version: number
  createdAt: string
  updatedAt: string
}

// =============================================================================
// CONSTANTS
// =============================================================================

const TIER_LABELS: Record<TrustTier, string> = {
  T0: 'Sandbox',
  T1: 'Probation',
  T2: 'Limited',
  T3: 'Standard',
  T4: 'Trusted',
  T5: 'Sovereign',
}

const TIER_RANGES: Record<TrustTier, string> = {
  T0: '0-99',
  T1: '100-299',
  T2: '300-499',
  T3: '500-699',
  T4: '700-899',
  T5: '900-1000',
}

const TIER_COLORS: Record<TrustTier, string> = {
  T0: 'from-gray-400 to-gray-500',
  T1: 'from-red-400 to-red-500',
  T2: 'from-orange-400 to-orange-500',
  T3: 'from-yellow-400 to-yellow-500',
  T4: 'from-green-400 to-green-500',
  T5: 'from-blue-400 to-indigo-500',
}

const ROLE_GATE_MATRIX: Record<AgentRole, Record<TrustTier, boolean>> = {
  R_L0: { T0: true, T1: true, T2: true, T3: true, T4: true, T5: true },
  R_L1: { T0: true, T1: true, T2: true, T3: true, T4: true, T5: true },
  R_L2: { T0: false, T1: true, T2: true, T3: true, T4: true, T5: true },
  R_L3: { T0: false, T1: false, T2: true, T3: true, T4: true, T5: true },
  R_L4: { T0: false, T1: false, T2: false, T3: true, T4: true, T5: true },
  R_L5: { T0: false, T1: false, T2: false, T3: false, T4: true, T5: true },
  R_L6: { T0: false, T1: false, T2: false, T3: false, T4: false, T5: true },
  R_L7: { T0: false, T1: false, T2: false, T3: false, T4: false, T5: true },
  R_L8: { T0: false, T1: false, T2: false, T3: false, T4: false, T5: true },
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

export class Phase6Service {
  private supabase: SupabaseClient

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey)
  }

  // ===========================================================================
  // STATS & DASHBOARD
  // ===========================================================================

  async getStats(): Promise<Phase6Stats> {
    // Use the aggregate view
    const { data: viewData, error: viewError } = await this.supabase
      .from('phase6_stats')
      .select('*')
      .single()

    if (viewError || !viewData) {
      // Fallback to manual counts if view doesn't exist
      return this.getStatsManual()
    }

    return {
      contextStats: {
        deployments: viewData.deployment_count || 0,
        organizations: viewData.org_count || 0,
        agents: viewData.agent_count || 0,
        activeOperations: viewData.active_operations || 0,
      },
      ceilingStats: {
        totalEvents: viewData.total_ceiling_events || 0,
        totalAuditEntries: viewData.total_ceiling_events || 0,
        complianceBreakdown: {
          compliant: viewData.compliant_events || 0,
          warning: viewData.warning_events || 0,
          violation: viewData.violation_events || 0,
        },
        agentsWithAlerts: viewData.active_alerts || 0,
      },
      roleGateStats: {
        totalEvaluations: viewData.total_evaluations || 0,
        byDecision: {
          ALLOW: viewData.allowed_count || 0,
          DENY: viewData.denied_count || 0,
          ESCALATE: viewData.escalated_count || 0,
        },
      },
      presetStats: {
        aciPresets: viewData.aci_preset_count || 0,
        vorionPresets: viewData.vorion_preset_count || 0,
        axiomPresets: viewData.axiom_preset_count || 0,
        verifiedLineages: viewData.verified_lineages || 0,
      },
      provenanceStats: {
        totalRecords: 0, // Will be calculated separately
        byCreationType: {
          FRESH: 0,
          CLONED: 0,
          EVOLVED: 0,
          PROMOTED: 0,
          IMPORTED: 0,
        },
      },
    }
  }

  private async getStatsManual(): Promise<Phase6Stats> {
    // Parallel queries for efficiency
    const [
      deploymentCount,
      orgCount,
      agentCount,
      operationCount,
      ceilingEvents,
      roleGateEvals,
      gamingAlerts,
      aciPresets,
      vorionPresets,
      axiomPresets,
      provenanceRecords,
    ] = await Promise.all([
      this.supabase.from('phase6_deployment_contexts').select('*', { count: 'exact', head: true }),
      this.supabase.from('phase6_org_contexts').select('*', { count: 'exact', head: true }),
      this.supabase.from('phase6_agent_contexts').select('*', { count: 'exact', head: true }),
      this.supabase.from('phase6_operation_contexts').select('*', { count: 'exact', head: true }).is('completed_at', null),
      this.supabase.from('phase6_ceiling_events').select('compliance_status'),
      this.supabase.from('phase6_role_gate_evaluations').select('final_decision'),
      this.supabase.from('phase6_gaming_alerts').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
      this.supabase.from('phase6_aci_presets').select('*', { count: 'exact', head: true }),
      this.supabase.from('phase6_vorion_presets').select('*', { count: 'exact', head: true }),
      this.supabase.from('phase6_axiom_presets').select('lineage_verified'),
      this.supabase.from('phase6_provenance').select('creation_type'),
    ])

    // Count ceiling events by status
    const ceilingByStatus = (ceilingEvents.data || []).reduce(
      (acc, e) => {
        const status = e.compliance_status as ComplianceStatus
        acc[status] = (acc[status] || 0) + 1
        return acc
      },
      {} as Record<ComplianceStatus, number>
    )

    // Count role gate by decision
    const roleGateByDecision = (roleGateEvals.data || []).reduce(
      (acc, e) => {
        const decision = e.final_decision as RoleGateDecision
        acc[decision] = (acc[decision] || 0) + 1
        return acc
      },
      {} as Record<RoleGateDecision, number>
    )

    // Count provenance by type
    const provenanceByType = (provenanceRecords.data || []).reduce(
      (acc, e) => {
        const type = e.creation_type as CreationType
        acc[type] = (acc[type] || 0) + 1
        return acc
      },
      {} as Record<CreationType, number>
    )

    // Count verified lineages
    const verifiedCount = (axiomPresets.data || []).filter(p => p.lineage_verified).length

    return {
      contextStats: {
        deployments: deploymentCount.count || 0,
        organizations: orgCount.count || 0,
        agents: agentCount.count || 0,
        activeOperations: operationCount.count || 0,
      },
      ceilingStats: {
        totalEvents: ceilingEvents.data?.length || 0,
        totalAuditEntries: ceilingEvents.data?.length || 0,
        complianceBreakdown: {
          compliant: ceilingByStatus.COMPLIANT || 0,
          warning: ceilingByStatus.WARNING || 0,
          violation: ceilingByStatus.VIOLATION || 0,
        },
        agentsWithAlerts: gamingAlerts.count || 0,
      },
      roleGateStats: {
        totalEvaluations: roleGateEvals.data?.length || 0,
        byDecision: {
          ALLOW: roleGateByDecision.ALLOW || 0,
          DENY: roleGateByDecision.DENY || 0,
          ESCALATE: roleGateByDecision.ESCALATE || 0,
        },
      },
      presetStats: {
        aciPresets: aciPresets.count || 0,
        vorionPresets: vorionPresets.count || 0,
        axiomPresets: axiomPresets.data?.length || 0,
        verifiedLineages: verifiedCount,
      },
      provenanceStats: {
        totalRecords: provenanceRecords.data?.length || 0,
        byCreationType: {
          FRESH: provenanceByType.FRESH || 0,
          CLONED: provenanceByType.CLONED || 0,
          EVOLVED: provenanceByType.EVOLVED || 0,
          PROMOTED: provenanceByType.PROMOTED || 0,
          IMPORTED: provenanceByType.IMPORTED || 0,
        },
      },
    }
  }

  async getTierDistribution(): Promise<TrustTierData[]> {
    // Get agent count per tier from agent contexts or trust scores
    const { data: agents } = await this.supabase
      .from('phase6_agent_contexts')
      .select('agent_id')

    // For now, return structure with counts
    // In production, this would query actual trust scores
    const tiers: TrustTier[] = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5']
    const agentCount = agents?.length || 0

    // Distribute agents across tiers (demo distribution)
    return tiers.map((tier, index) => ({
      tier,
      label: TIER_LABELS[tier],
      range: TIER_RANGES[tier],
      count: Math.max(0, Math.floor(agentCount * (0.3 - index * 0.04))),
      color: TIER_COLORS[tier],
    }))
  }

  async getRecentEvents(limit: number = 10): Promise<RecentEvent[]> {
    // Get recent events from multiple tables
    const [ceilingEvents, roleGateEvents] = await Promise.all([
      this.supabase
        .from('phase6_ceiling_events')
        .select('id, agent_id, compliance_status, created_at')
        .order('created_at', { ascending: false })
        .limit(limit),
      this.supabase
        .from('phase6_role_gate_evaluations')
        .select('id, agent_id, final_decision, created_at')
        .order('created_at', { ascending: false })
        .limit(limit),
    ])

    const events: RecentEvent[] = []

    // Add ceiling events
    for (const e of ceilingEvents.data || []) {
      events.push({
        id: e.id,
        type: 'ceiling',
        agentId: e.agent_id,
        status: e.compliance_status as ComplianceStatus,
        timestamp: e.created_at,
      })
    }

    // Add role gate events
    for (const e of roleGateEvents.data || []) {
      const status: ComplianceStatus =
        e.final_decision === 'ALLOW' ? 'COMPLIANT' :
        e.final_decision === 'ESCALATE' ? 'WARNING' : 'VIOLATION'

      events.push({
        id: e.id,
        type: 'role_gate',
        agentId: e.agent_id,
        decision: e.final_decision,
        status,
        timestamp: e.created_at,
      })
    }

    // Sort by timestamp and limit
    return events
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
  }

  // ===========================================================================
  // Q2: HIERARCHICAL CONTEXT
  // ===========================================================================

  async createDeploymentContext(data: Omit<DeploymentContext, 'id' | 'createdAt' | 'frozenAt'>): Promise<DeploymentContext> {
    const { data: result, error } = await this.supabase
      .from('phase6_deployment_contexts')
      .insert({
        deployment_id: data.deploymentId,
        name: data.name,
        version: data.version,
        environment: data.environment,
        regulatory_jurisdiction: data.regulatoryJurisdiction,
        max_trust_ceiling: data.maxTrustCeiling,
        context_hash: data.contextHash,
      })
      .select()
      .single()

    if (error) throw error
    return this.mapDeploymentContext(result)
  }

  async getDeploymentContexts(): Promise<DeploymentContext[]> {
    const { data, error } = await this.supabase
      .from('phase6_deployment_contexts')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []).map(this.mapDeploymentContext)
  }

  async getOrgContexts(deploymentId?: string): Promise<OrgContext[]> {
    let query = this.supabase.from('phase6_org_contexts').select('*')

    if (deploymentId) {
      query = query.eq('deployment_id', deploymentId)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error
    return (data || []).map(this.mapOrgContext)
  }

  async getAgentContexts(deploymentId?: string, orgId?: string): Promise<AgentContext[]> {
    let query = this.supabase.from('phase6_agent_contexts').select('*')

    if (deploymentId) {
      query = query.eq('deployment_id', deploymentId)
    }
    if (orgId) {
      query = query.eq('org_id', orgId)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error
    return (data || []).map(this.mapAgentContext)
  }

  async getOperationContexts(agentId?: string, activeOnly: boolean = true): Promise<OperationContext[]> {
    let query = this.supabase.from('phase6_operation_contexts').select('*')

    if (agentId) {
      query = query.eq('agent_id', agentId)
    }
    if (activeOnly) {
      query = query.is('completed_at', null)
    }

    const { data, error } = await query.order('started_at', { ascending: false })

    if (error) throw error
    return (data || []).map(this.mapOperationContext)
  }

  // ===========================================================================
  // Q3: ROLE GATES
  // ===========================================================================

  evaluateKernelLayer(role: AgentRole, tier: TrustTier): boolean {
    return ROLE_GATE_MATRIX[role]?.[tier] ?? false
  }

  async getRoleGateEvaluations(agentId?: string, limit: number = 50): Promise<RoleGateEvaluation[]> {
    let query = this.supabase.from('phase6_role_gate_evaluations').select('*')

    if (agentId) {
      query = query.eq('agent_id', agentId)
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return (data || []).map(this.mapRoleGateEvaluation)
  }

  async logRoleGateEvaluation(
    evaluation: Omit<RoleGateEvaluation, 'id' | 'createdAt'>
  ): Promise<RoleGateEvaluation> {
    const { data, error } = await this.supabase
      .from('phase6_role_gate_evaluations')
      .insert({
        agent_id: evaluation.agentId,
        requested_role: evaluation.requestedRole,
        current_tier: evaluation.currentTier,
        current_score: evaluation.currentScore,
        kernel_allowed: evaluation.kernelAllowed,
        policy_result: evaluation.policyResult,
        policy_applied: evaluation.policyApplied,
        basis_override_used: evaluation.basisOverrideUsed,
        basis_approvers: evaluation.basisApprovers,
        final_decision: evaluation.finalDecision,
        decision_reason: evaluation.decisionReason,
        operation_id: evaluation.operationId,
        attestations: evaluation.attestations,
      })
      .select()
      .single()

    if (error) throw error
    return this.mapRoleGateEvaluation(data)
  }

  // ===========================================================================
  // Q1: CEILING & GAMING
  // ===========================================================================

  async getCeilingEvents(agentId?: string, limit: number = 50): Promise<CeilingEvent[]> {
    let query = this.supabase.from('phase6_ceiling_events').select('*')

    if (agentId) {
      query = query.eq('agent_id', agentId)
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return (data || []).map(this.mapCeilingEvent)
  }

  async getGamingAlerts(status?: AlertStatus, limit: number = 50): Promise<GamingAlert[]> {
    let query = this.supabase.from('phase6_gaming_alerts').select('*')

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return (data || []).map(this.mapGamingAlert)
  }

  async createGamingAlert(
    alert: Omit<GamingAlert, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<GamingAlert> {
    const { data, error } = await this.supabase
      .from('phase6_gaming_alerts')
      .insert({
        agent_id: alert.agentId,
        alert_type: alert.alertType,
        severity: alert.severity,
        status: alert.status,
        details: alert.details,
        occurrences: alert.occurrences,
        threshold_value: alert.thresholdValue,
        actual_value: alert.actualValue,
        window_start: alert.windowStart,
        window_end: alert.windowEnd,
      })
      .select()
      .single()

    if (error) throw error
    return this.mapGamingAlert(data)
  }

  async updateGamingAlertStatus(
    alertId: string,
    status: AlertStatus,
    resolvedBy?: string,
    resolutionNotes?: string
  ): Promise<GamingAlert> {
    const updateData: Record<string, unknown> = { status, updated_at: new Date().toISOString() }

    if (status === 'RESOLVED' || status === 'FALSE_POSITIVE') {
      updateData.resolved_at = new Date().toISOString()
      updateData.resolved_by = resolvedBy
      updateData.resolution_notes = resolutionNotes
    }

    const { data, error } = await this.supabase
      .from('phase6_gaming_alerts')
      .update(updateData)
      .eq('id', alertId)
      .select()
      .single()

    if (error) throw error
    return this.mapGamingAlert(data)
  }

  // ===========================================================================
  // Q4: PRESETS
  // ===========================================================================

  async getAciPresets(): Promise<AciPreset[]> {
    const { data, error } = await this.supabase
      .from('phase6_aci_presets')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []).map(this.mapAciPreset)
  }

  async getVorionPresets(): Promise<VorionPreset[]> {
    const { data, error } = await this.supabase
      .from('phase6_vorion_presets')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []).map(this.mapVorionPreset)
  }

  async getAxiomPresets(deploymentId?: string): Promise<AxiomPreset[]> {
    let query = this.supabase.from('phase6_axiom_presets').select('*')

    if (deploymentId) {
      query = query.eq('deployment_id', deploymentId)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error
    return (data || []).map(this.mapAxiomPreset)
  }

  // ===========================================================================
  // Q5: PROVENANCE
  // ===========================================================================

  async getProvenance(agentId?: string): Promise<Provenance[]> {
    let query = this.supabase.from('phase6_provenance').select('*')

    if (agentId) {
      query = query.eq('agent_id', agentId)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error
    return (data || []).map(this.mapProvenance)
  }

  async createProvenance(
    provenance: Omit<Provenance, 'id' | 'createdAt'>
  ): Promise<Provenance> {
    const { data, error } = await this.supabase
      .from('phase6_provenance')
      .insert({
        agent_id: provenance.agentId,
        creation_type: provenance.creationType,
        parent_agent_id: provenance.parentAgentId,
        created_by: provenance.createdBy,
        origin_deployment: provenance.originDeployment,
        origin_org: provenance.originOrg,
        trust_modifier: provenance.trustModifier,
        provenance_hash: provenance.provenanceHash,
        parent_provenance_hash: provenance.parentProvenanceHash,
        metadata: provenance.metadata,
      })
      .select()
      .single()

    if (error) throw error
    return this.mapProvenance(data)
  }

  // ===========================================================================
  // MAPPING FUNCTIONS
  // ===========================================================================

  private mapDeploymentContext(row: Record<string, unknown>): DeploymentContext {
    return {
      id: row.id as string,
      deploymentId: row.deployment_id as string,
      name: row.name as string,
      version: row.version as string,
      environment: row.environment as 'development' | 'staging' | 'production',
      regulatoryJurisdiction: row.regulatory_jurisdiction as string | undefined,
      maxTrustCeiling: row.max_trust_ceiling as number,
      contextHash: row.context_hash as string,
      frozenAt: row.frozen_at as string,
      createdAt: row.created_at as string,
    }
  }

  private mapOrgContext(row: Record<string, unknown>): OrgContext {
    return {
      id: row.id as string,
      deploymentId: row.deployment_id as string,
      orgId: row.org_id as string,
      name: row.name as string,
      complianceFrameworks: row.compliance_frameworks as string[],
      trustCeiling: row.trust_ceiling as number,
      contextHash: row.context_hash as string,
      parentHash: row.parent_hash as string,
      lockedAt: row.locked_at as string | undefined,
      gracePeriodEnds: row.grace_period_ends as string | undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }
  }

  private mapAgentContext(row: Record<string, unknown>): AgentContext {
    return {
      id: row.id as string,
      deploymentId: row.deployment_id as string,
      orgId: row.org_id as string,
      agentId: row.agent_id as string,
      name: row.name as string,
      capabilities: row.capabilities as string[],
      trustCeiling: row.trust_ceiling as number,
      contextHash: row.context_hash as string,
      parentHash: row.parent_hash as string,
      frozenAt: row.frozen_at as string,
      createdAt: row.created_at as string,
    }
  }

  private mapOperationContext(row: Record<string, unknown>): OperationContext {
    return {
      id: row.id as string,
      deploymentId: row.deployment_id as string,
      orgId: row.org_id as string,
      agentId: row.agent_id as string,
      operationId: row.operation_id as string,
      operationType: row.operation_type as string,
      requestedRole: row.requested_role as AgentRole,
      contextHash: row.context_hash as string,
      parentHash: row.parent_hash as string,
      startedAt: row.started_at as string,
      completedAt: row.completed_at as string | undefined,
      ttlSeconds: row.ttl_seconds as number,
    }
  }

  private mapRoleGateEvaluation(row: Record<string, unknown>): RoleGateEvaluation {
    return {
      id: row.id as string,
      agentId: row.agent_id as string,
      requestedRole: row.requested_role as AgentRole,
      currentTier: row.current_tier as TrustTier,
      currentScore: row.current_score as number,
      kernelAllowed: row.kernel_allowed as boolean,
      policyResult: row.policy_result as RoleGateDecision | undefined,
      policyApplied: row.policy_applied as string | undefined,
      basisOverrideUsed: row.basis_override_used as boolean,
      basisApprovers: row.basis_approvers as string[] | undefined,
      finalDecision: row.final_decision as RoleGateDecision,
      decisionReason: row.decision_reason as string | undefined,
      operationId: row.operation_id as string | undefined,
      attestations: row.attestations as string[] | undefined,
      createdAt: row.created_at as string,
    }
  }

  private mapCeilingEvent(row: Record<string, unknown>): CeilingEvent {
    return {
      id: row.id as string,
      agentId: row.agent_id as string,
      eventType: row.event_type as string,
      previousScore: row.previous_score as number,
      proposedScore: row.proposed_score as number,
      finalScore: row.final_score as number,
      effectiveCeiling: row.effective_ceiling as number,
      ceilingSource: row.ceiling_source as string,
      ceilingApplied: row.ceiling_applied as boolean,
      complianceStatus: row.compliance_status as ComplianceStatus,
      complianceFramework: row.compliance_framework as string | undefined,
      auditRequired: row.audit_required as boolean,
      retentionDays: row.retention_days as number | undefined,
      createdAt: row.created_at as string,
    }
  }

  private mapGamingAlert(row: Record<string, unknown>): GamingAlert {
    return {
      id: row.id as string,
      agentId: row.agent_id as string,
      alertType: row.alert_type as GamingAlertType,
      severity: row.severity as AlertSeverity,
      status: row.status as AlertStatus,
      details: row.details as string,
      occurrences: row.occurrences as number,
      thresholdValue: row.threshold_value as number | undefined,
      actualValue: row.actual_value as number | undefined,
      windowStart: row.window_start as string,
      windowEnd: row.window_end as string,
      resolvedAt: row.resolved_at as string | undefined,
      resolvedBy: row.resolved_by as string | undefined,
      resolutionNotes: row.resolution_notes as string | undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }
  }

  private mapAciPreset(row: Record<string, unknown>): AciPreset {
    return {
      id: row.id as string,
      presetId: row.preset_id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      weights: row.weights as Record<string, number>,
      constraints: row.constraints as Record<string, unknown>,
      presetHash: row.preset_hash as string,
      version: row.version as number,
      createdAt: row.created_at as string,
    }
  }

  private mapVorionPreset(row: Record<string, unknown>): VorionPreset {
    return {
      id: row.id as string,
      presetId: row.preset_id as string,
      parentAciPresetId: row.parent_aci_preset_id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      weightOverrides: row.weight_overrides as Record<string, number>,
      additionalConstraints: row.additional_constraints as Record<string, unknown>,
      presetHash: row.preset_hash as string,
      parentHash: row.parent_hash as string,
      version: row.version as number,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }
  }

  private mapAxiomPreset(row: Record<string, unknown>): AxiomPreset {
    return {
      id: row.id as string,
      presetId: row.preset_id as string,
      deploymentId: row.deployment_id as string,
      parentVorionPresetId: row.parent_vorion_preset_id as string,
      name: row.name as string,
      weightOverrides: row.weight_overrides as Record<string, number>,
      deploymentConstraints: row.deployment_constraints as Record<string, unknown>,
      presetHash: row.preset_hash as string,
      parentHash: row.parent_hash as string,
      lineageVerified: row.lineage_verified as boolean,
      lineageVerifiedAt: row.lineage_verified_at as string | undefined,
      version: row.version as number,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }
  }

  private mapProvenance(row: Record<string, unknown>): Provenance {
    return {
      id: row.id as string,
      agentId: row.agent_id as string,
      creationType: row.creation_type as CreationType,
      parentAgentId: row.parent_agent_id as string | undefined,
      createdBy: row.created_by as string,
      originDeployment: row.origin_deployment as string | undefined,
      originOrg: row.origin_org as string | undefined,
      trustModifier: row.trust_modifier as number,
      provenanceHash: row.provenance_hash as string,
      parentProvenanceHash: row.parent_provenance_hash as string | undefined,
      metadata: row.metadata as Record<string, unknown>,
      createdAt: row.created_at as string,
    }
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let phase6Service: Phase6Service | null = null

export function getPhase6Service(): Phase6Service {
  if (!phase6Service) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration for Phase 6 service')
    }

    phase6Service = new Phase6Service(supabaseUrl, supabaseKey)
  }

  return phase6Service
}

// =============================================================================
// DEMO DATA (for when DB is empty)
// =============================================================================

export function getDemoStats(): Phase6Stats {
  return {
    contextStats: {
      deployments: 3,
      organizations: 12,
      agents: 47,
      activeOperations: 23,
    },
    ceilingStats: {
      totalEvents: 1842,
      totalAuditEntries: 1842,
      complianceBreakdown: {
        compliant: 1756,
        warning: 72,
        violation: 14,
      },
      agentsWithAlerts: 5,
    },
    roleGateStats: {
      totalEvaluations: 3291,
      byDecision: {
        ALLOW: 3104,
        DENY: 142,
        ESCALATE: 45,
      },
    },
    presetStats: {
      aciPresets: 3,
      vorionPresets: 3,
      axiomPresets: 8,
      verifiedLineages: 6,
    },
    provenanceStats: {
      totalRecords: 47,
      byCreationType: {
        FRESH: 28,
        CLONED: 8,
        EVOLVED: 6,
        PROMOTED: 3,
        IMPORTED: 2,
      },
    },
  }
}

export function getDemoTierDistribution(): TrustTierData[] {
  return [
    { tier: 'T0', label: 'Sandbox', range: '0-99', count: 2, color: 'from-gray-400 to-gray-500' },
    { tier: 'T1', label: 'Probation', range: '100-299', count: 5, color: 'from-red-400 to-red-500' },
    { tier: 'T2', label: 'Limited', range: '300-499', count: 8, color: 'from-orange-400 to-orange-500' },
    { tier: 'T3', label: 'Standard', range: '500-699', count: 18, color: 'from-yellow-400 to-yellow-500' },
    { tier: 'T4', label: 'Trusted', range: '700-899', count: 12, color: 'from-green-400 to-green-500' },
    { tier: 'T5', label: 'Sovereign', range: '900-1000', count: 2, color: 'from-blue-400 to-indigo-500' },
  ]
}

export function getDemoRecentEvents(): RecentEvent[] {
  return [
    { id: '1', type: 'ceiling', agentId: 'agent-042', status: 'COMPLIANT', timestamp: new Date().toISOString() },
    { id: '2', type: 'role_gate', agentId: 'agent-017', decision: 'ALLOW', status: 'COMPLIANT', timestamp: new Date(Date.now() - 60000).toISOString() },
    { id: '3', type: 'ceiling', agentId: 'agent-089', status: 'WARNING', timestamp: new Date(Date.now() - 120000).toISOString() },
    { id: '4', type: 'provenance', agentId: 'agent-023', status: 'COMPLIANT', timestamp: new Date(Date.now() - 180000).toISOString() },
    { id: '5', type: 'context', agentId: 'agent-056', status: 'COMPLIANT', timestamp: new Date(Date.now() - 240000).toISOString() },
  ]
}
