/**
 * A3I Testing Studio - Database Layer
 * Supabase integration for persistent storage
 */

import { createClient } from '@supabase/supabase-js';
import type {
  AttackVector,
  DetectionRule,
  ArenaSession,
  SessionTurn,
  IntelligenceReport,
} from '../types';

// ============================================================================
// Client Setup
// ============================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Use service role for server-side operations
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ============================================================================
// Attack Vectors
// ============================================================================

export async function insertAttackVector(
  vector: Omit<AttackVector, 'id' | 'discoveredAt'>
): Promise<AttackVector | null> {
  const { data, error } = await supabase
    .from('attack_vectors')
    .insert({
      vector_hash: vector.vectorHash,
      category: vector.category,
      subcategory: vector.subcategory,
      technique: vector.technique,
      vector_id: vector.vectorId,
      payload: vector.payload,
      payload_template: vector.payloadTemplate,
      description: vector.description,
      severity: vector.severity,
      indicators: vector.indicators,
      parent_vector_id: vector.parentVectorId,
      mutation_type: vector.mutationType,
      generation: vector.generation,
      discovered_by: vector.discoveredBy,
      discovered_in_session: vector.discoveredInSession,
      source: vector.source,
      status: vector.status || 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('[DB] Failed to insert attack vector:', error);
    return null;
  }

  return mapDbToAttackVector(data);
}

export async function getAttackVectors(options?: {
  category?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ vectors: AttackVector[]; total: number }> {
  let query = supabase
    .from('attack_vectors')
    .select('*', { count: 'exact' });

  if (options?.category) {
    query = query.eq('category', options.category);
  }

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  query = query
    .order('discovered_at', { ascending: false })
    .range(
      options?.offset || 0,
      (options?.offset || 0) + (options?.limit || 50) - 1
    );

  const { data, error, count } = await query;

  if (error) {
    console.error('[DB] Failed to get attack vectors:', error);
    return { vectors: [], total: 0 };
  }

  return {
    vectors: (data || []).map(mapDbToAttackVector),
    total: count || 0,
  };
}

export async function updateAttackVectorStats(
  id: string,
  successful: boolean,
  bypassed: boolean
): Promise<void> {
  const updates: Record<string, unknown> = {
    attempt_count: supabase.rpc('increment', { row_id: id, column_name: 'attempt_count' }),
    last_tested_at: new Date().toISOString(),
  };

  if (successful) {
    await supabase.rpc('increment_column', {
      table_name: 'attack_vectors',
      column_name: 'success_count',
      row_id: id,
    });
  }

  if (bypassed) {
    await supabase.rpc('increment_column', {
      table_name: 'attack_vectors',
      column_name: 'bypass_count',
      row_id: id,
    });
  }

  await supabase
    .from('attack_vectors')
    .update({ last_tested_at: new Date().toISOString() })
    .eq('id', id);
}

// ============================================================================
// Detection Rules
// ============================================================================

export async function insertDetectionRule(
  rule: Omit<DetectionRule, 'id'>
): Promise<DetectionRule | null> {
  const { data, error } = await supabase
    .from('detection_rules')
    .insert({
      rule_name: rule.name,
      rule_type: rule.pattern_type === 'regex' ? 'pattern' : rule.pattern_type,
      pattern: rule.pattern,
      pattern_type: rule.pattern_type,
      threshold: rule.confidence_threshold,
      config: {},
      status: rule.enabled ? 'active' : 'disabled',
    })
    .select()
    .single();

  if (error) {
    console.error('[DB] Failed to insert detection rule:', error);
    return null;
  }

  return mapDbToDetectionRule(data);
}

export async function getDetectionRules(options?: {
  status?: string;
  type?: string;
}): Promise<DetectionRule[]> {
  let query = supabase.from('detection_rules').select('*');

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  if (options?.type) {
    query = query.eq('rule_type', options.type);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[DB] Failed to get detection rules:', error);
    return [];
  }

  return (data || []).map(mapDbToDetectionRule);
}

export async function updateRuleMetrics(
  id: string,
  metrics: {
    truePositive?: boolean;
    falsePositive?: boolean;
    trueNegative?: boolean;
    falseNegative?: boolean;
  }
): Promise<void> {
  // Use RPC for atomic increment
  const { error } = await supabase.rpc('update_rule_metrics', {
    rule_id: id,
    tp: metrics.truePositive ? 1 : 0,
    fp: metrics.falsePositive ? 1 : 0,
    tn: metrics.trueNegative ? 1 : 0,
    fn: metrics.falseNegative ? 1 : 0,
  });

  if (error) {
    console.error('[DB] Failed to update rule metrics:', error);
  }
}

// ============================================================================
// Arena Sessions
// ============================================================================

export async function insertArenaSession(
  session: Omit<ArenaSession, 'id'>
): Promise<ArenaSession | null> {
  const { data, error } = await supabase
    .from('arena_sessions')
    .insert({
      session_name: session.sessionName,
      session_type: session.sessionType,
      red_agents: session.redAgents,
      blue_agents: session.blueAgents,
      target_agent: session.targetAgent,
      config: session.config,
      containment_rules: session.containmentRules,
      status: session.status,
      started_at: session.startedAt,
      results: session.results,
    })
    .select()
    .single();

  if (error) {
    console.error('[DB] Failed to insert arena session:', error);
    return null;
  }

  return mapDbToArenaSession(data);
}

export async function updateArenaSession(
  id: string,
  updates: Partial<ArenaSession>
): Promise<void> {
  const dbUpdates: Record<string, unknown> = {};

  if (updates.status) dbUpdates.status = updates.status;
  if (updates.completedAt) dbUpdates.completed_at = updates.completedAt;
  if (updates.terminatedReason) dbUpdates.terminated_reason = updates.terminatedReason;
  if (updates.results) dbUpdates.results = updates.results;
  if (updates.attacksDiscovered !== undefined) dbUpdates.attacks_discovered = updates.attacksDiscovered;
  if (updates.detectionAccuracy !== undefined) dbUpdates.detection_accuracy = updates.detectionAccuracy;

  const { error } = await supabase
    .from('arena_sessions')
    .update(dbUpdates)
    .eq('id', id);

  if (error) {
    console.error('[DB] Failed to update arena session:', error);
  }
}

export async function getArenaSessions(options?: {
  status?: string;
  limit?: number;
}): Promise<ArenaSession[]> {
  let query = supabase
    .from('arena_sessions')
    .select('*')
    .order('created_at', { ascending: false });

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[DB] Failed to get arena sessions:', error);
    return [];
  }

  return (data || []).map(mapDbToArenaSession);
}

// ============================================================================
// Session Turns
// ============================================================================

export async function insertSessionTurn(
  turn: Omit<SessionTurn, 'id'>
): Promise<SessionTurn | null> {
  const { data, error } = await supabase
    .from('session_turns')
    .insert({
      session_id: turn.sessionId,
      turn_number: turn.turnNumber,
      agent_id: turn.agentId,
      agent_role: turn.agentRole,
      input_content: turn.inputContent,
      output_content: turn.outputContent,
      action_type: turn.actionType,
      attack_category: turn.attackCategory,
      attack_vector_id: turn.attackVectorId,
      attack_successful: turn.attackSuccessful,
      detection_result: turn.detectionResult,
      false_positive: turn.falsePositive,
      false_negative: turn.falseNegative,
      started_at: turn.startedAt,
      completed_at: turn.completedAt,
      duration_ms: turn.durationMs,
    })
    .select()
    .single();

  if (error) {
    console.error('[DB] Failed to insert session turn:', error);
    return null;
  }

  return mapDbToSessionTurn(data);
}

// ============================================================================
// Intelligence Reports
// ============================================================================

export async function insertIntelligenceReport(
  report: Omit<IntelligenceReport, 'id'>
): Promise<IntelligenceReport | null> {
  const { data, error } = await supabase
    .from('intelligence_reports')
    .insert({
      report_type: report.reportType,
      title: report.title,
      description: report.description,
      period_start: report.periodStart,
      period_end: report.periodEnd,
      metrics: report.metrics,
      novel_vectors_discovered: report.novelVectorsDiscovered,
      detection_improvements: report.detectionImprovements,
      notable_findings: report.notableFindings,
      status: report.status,
    })
    .select()
    .single();

  if (error) {
    console.error('[DB] Failed to insert intelligence report:', error);
    return null;
  }

  return mapDbToIntelligenceReport(data);
}

export async function getIntelligenceReports(options?: {
  type?: string;
  status?: string;
  limit?: number;
}): Promise<IntelligenceReport[]> {
  let query = supabase
    .from('intelligence_reports')
    .select('*')
    .order('period_end', { ascending: false });

  if (options?.type) {
    query = query.eq('report_type', options.type);
  }

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[DB] Failed to get intelligence reports:', error);
    return [];
  }

  return (data || []).map(mapDbToIntelligenceReport);
}

// ============================================================================
// Mappers
// ============================================================================

function mapDbToAttackVector(row: Record<string, unknown>): AttackVector {
  return {
    id: row.id as string,
    vectorHash: row.vector_hash as string,
    category: row.category as AttackVector['category'],
    subcategory: row.subcategory as string,
    technique: row.technique as string,
    vectorId: row.vector_id as string | undefined,
    payload: row.payload as string,
    payloadTemplate: row.payload_template as string | undefined,
    description: row.description as string | undefined,
    severity: row.severity as AttackVector['severity'],
    indicators: (row.indicators || []) as AttackVector['indicators'],
    parentVectorId: row.parent_vector_id as string | undefined,
    mutationType: row.mutation_type as AttackVector['mutationType'],
    generation: row.generation as number,
    discoveredBy: row.discovered_by as string | undefined,
    discoveredInSession: row.discovered_in_session as string | undefined,
    discoveredAt: new Date(row.discovered_at as string),
    source: row.source as AttackVector['source'],
    successCount: row.success_count as number,
    attemptCount: row.attempt_count as number,
    bypassCount: row.bypass_count as number,
    lastTestedAt: row.last_tested_at ? new Date(row.last_tested_at as string) : undefined,
    status: row.status as AttackVector['status'],
    verifiedBy: row.verified_by as string | undefined,
    verifiedAt: row.verified_at ? new Date(row.verified_at as string) : undefined,
  };
}

function mapDbToDetectionRule(row: Record<string, unknown>): DetectionRule {
  return {
    id: row.id as string,
    name: row.rule_name as string,
    pattern: row.pattern as string,
    pattern_type: row.pattern_type as DetectionRule['pattern_type'],
    category: 'prompt_injection' as DetectionRule['category'], // Default, would come from config
    severity: 'medium' as DetectionRule['severity'],
    confidence_threshold: row.threshold as number,
    enabled: row.status === 'active',
    truePositiveCount: row.true_positive_count as number,
    falsePositiveCount: row.false_positive_count as number,
    trueNegativeCount: row.true_negative_count as number,
    falseNegativeCount: row.false_negative_count as number,
    accuracy: row.accuracy as number | undefined,
    precision: row.precision_score as number | undefined,
    recall: row.recall as number | undefined,
    f1Score: row.f1_score as number | undefined,
    status: row.status as DetectionRule['status'],
  };
}

function mapDbToArenaSession(row: Record<string, unknown>): ArenaSession {
  return {
    id: row.id as string,
    sessionName: row.session_name as string | undefined,
    sessionType: row.session_type as ArenaSession['sessionType'],
    redAgents: row.red_agents as string[],
    blueAgents: row.blue_agents as string[],
    targetAgent: row.target_agent as string,
    config: row.config as ArenaSession['config'],
    containmentRules: row.containment_rules as ArenaSession['containmentRules'],
    status: row.status as ArenaSession['status'],
    startedAt: row.started_at ? new Date(row.started_at as string) : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
    terminatedReason: row.terminated_reason as string | undefined,
    results: row.results as ArenaSession['results'],
    attacksDiscovered: row.attacks_discovered as number,
    detectionAccuracy: row.detection_accuracy as number | undefined,
    containmentVerified: row.containment_verified as boolean,
    sandboxEscapeDetected: row.sandbox_escape_detected as boolean,
    scheduledBy: row.scheduled_by as string | undefined,
    scheduleCron: row.schedule_cron as string | undefined,
  };
}

function mapDbToSessionTurn(row: Record<string, unknown>): SessionTurn {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    turnNumber: row.turn_number as number,
    agentId: row.agent_id as string,
    agentRole: row.agent_role as SessionTurn['agentRole'],
    inputContent: row.input_content as string | undefined,
    outputContent: row.output_content as string | undefined,
    actionType: row.action_type as SessionTurn['actionType'],
    attackCategory: row.attack_category as string | undefined,
    attackVectorId: row.attack_vector_id as string | undefined,
    attackSuccessful: row.attack_successful as boolean | undefined,
    detectionResult: row.detection_result as SessionTurn['detectionResult'],
    falsePositive: row.false_positive as boolean | undefined,
    falseNegative: row.false_negative as boolean | undefined,
    startedAt: new Date(row.started_at as string),
    completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
    durationMs: row.duration_ms as number | undefined,
  };
}

function mapDbToIntelligenceReport(row: Record<string, unknown>): IntelligenceReport {
  return {
    id: row.id as string,
    reportType: row.report_type as IntelligenceReport['reportType'],
    title: row.title as string,
    description: row.description as string | undefined,
    periodStart: new Date(row.period_start as string),
    periodEnd: new Date(row.period_end as string),
    metrics: row.metrics as IntelligenceReport['metrics'],
    novelVectorsDiscovered: row.novel_vectors_discovered as number,
    detectionImprovements: (row.detection_improvements || []) as IntelligenceReport['detectionImprovements'],
    notableFindings: (row.notable_findings || []) as string[],
    status: row.status as IntelligenceReport['status'],
    publishedAt: row.published_at ? new Date(row.published_at as string) : undefined,
    publishedBy: row.published_by as string | undefined,
  };
}
