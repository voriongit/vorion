/**
 * HITL (Human-in-the-Loop) Service
 *
 * Story 16-5: Proof Accumulation Tracker
 * Story 16-6: HITL Fade Logic
 *
 * Council Priority #2 (42 points)
 *
 * Implements graduated automation based on human-agent agreement rates.
 * As trust builds through consistent agreement, human oversight fades.
 */

import { createClient } from '@/lib/supabase/server';
import { createRecord as createTruthChainRecord } from '@/lib/truth-chain/truth-chain-service';
import {
  ProofRecord,
  ProofAccumulation,
  HITLPhase,
  HITLFadeConfig,
  HITLReviewRequest,
  RecordProofRequest,
  CheckReviewRequiredRequest,
  CheckReviewRequiredResult,
  HITL_PHASE_THRESHOLDS,
  HITL_PHASE_CONFIG,
  DEFAULT_FADE_CONFIG,
} from './types';

// =============================================================================
// HITL Service
// =============================================================================

export class HITLService {

  // ===========================================================================
  // Proof Accumulation (Story 16-5)
  // ===========================================================================

  /**
   * Record a proof of human-agent agreement/disagreement
   */
  static async recordProof(request: RecordProofRequest): Promise<ProofRecord | null> {
    const supabase = await createClient();

    const agreed = !request.humanDecision ||
      request.agentDecision.toLowerCase() === request.humanDecision.toLowerCase();

    const proofRecord = {
      agent_id: request.agentId,
      action_type: request.actionType,
      risk_level: request.riskLevel,
      agent_decision: request.agentDecision,
      human_decision: request.humanDecision,
      agreed,
      reviewed_by: request.reviewedBy,
      reviewed_at: request.reviewedBy ? new Date().toISOString() : null,
    };

    const { data, error } = await supabase
      .from('hitl_proof_records')
      .insert(proofRecord)
      .select()
      .single();

    if (error) {
      console.error('Error recording proof:', error);
      return null;
    }

    // Update accumulation
    await this.updateAccumulation(request.agentId, request.actionType);

    // Record to truth chain for significant events
    if (!agreed) {
      await this.recordToTruthChain('hitl_disagreement', request.agentId, {
        actionType: request.actionType,
        agentDecision: request.agentDecision,
        humanDecision: request.humanDecision,
        riskLevel: request.riskLevel,
      });
    }

    return {
      id: data.id,
      agentId: data.agent_id,
      actionType: data.action_type,
      riskLevel: data.risk_level,
      agentDecision: data.agent_decision,
      humanDecision: data.human_decision,
      agreed: data.agreed,
      reviewedBy: data.reviewed_by,
      reviewedAt: data.reviewed_at ? new Date(data.reviewed_at) : undefined,
      createdAt: new Date(data.created_at),
    };
  }

  /**
   * Get proof accumulation for an agent
   */
  static async getAccumulation(
    agentId: string,
    actionType?: string
  ): Promise<ProofAccumulation[]> {
    const supabase = await createClient();

    let query = supabase
      .from('hitl_accumulation')
      .select('*')
      .eq('agent_id', agentId);

    if (actionType) {
      query = query.eq('action_type', actionType);
    }

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }

    return data.map(d => ({
      agentId: d.agent_id,
      actionType: d.action_type,
      totalReviews: d.total_reviews,
      agreedCount: d.agreed_count,
      disagreedCount: d.disagreed_count,
      agreementRate: d.agreement_rate,
      currentPhase: d.current_phase as HITLPhase,
      lastUpdated: new Date(d.last_updated),
    }));
  }

  /**
   * Update accumulation after a new proof record
   */
  private static async updateAccumulation(
    agentId: string,
    actionType: string
  ): Promise<void> {
    const supabase = await createClient();

    // Get proof records for the rolling window
    const windowDays = DEFAULT_FADE_CONFIG.windowDays;
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - windowDays);

    const { data: proofs, error: proofsError } = await supabase
      .from('hitl_proof_records')
      .select('agreed')
      .eq('agent_id', agentId)
      .eq('action_type', actionType)
      .gte('created_at', windowStart.toISOString());

    if (proofsError || !proofs) {
      return;
    }

    const totalReviews = proofs.length;
    const agreedCount = proofs.filter(p => p.agreed).length;
    const disagreedCount = totalReviews - agreedCount;
    const agreementRate = totalReviews > 0 ? (agreedCount / totalReviews) * 100 : 0;

    // Determine current phase based on agreement rate
    const currentPhase = this.determinePhase(agreementRate, totalReviews);

    // Upsert accumulation record
    const { error: upsertError } = await supabase
      .from('hitl_accumulation')
      .upsert({
        agent_id: agentId,
        action_type: actionType,
        total_reviews: totalReviews,
        agreed_count: agreedCount,
        disagreed_count: disagreedCount,
        agreement_rate: agreementRate,
        current_phase: currentPhase,
        last_updated: new Date().toISOString(),
      }, {
        onConflict: 'agent_id,action_type',
      });

    if (upsertError) {
      console.error('Error updating accumulation:', upsertError);
    }
  }

  // ===========================================================================
  // HITL Fade Logic (Story 16-6)
  // ===========================================================================

  /**
   * Determine current HITL phase based on agreement rate
   */
  static determinePhase(agreementRate: number, totalReviews: number): HITLPhase {
    // Need minimum reviews before reducing oversight
    if (totalReviews < DEFAULT_FADE_CONFIG.minimumReviews) {
      return 'full_review';
    }

    if (agreementRate >= HITL_PHASE_THRESHOLDS.autonomous.min) {
      return 'autonomous';
    }
    if (agreementRate >= HITL_PHASE_THRESHOLDS.exception_only.min) {
      return 'exception_only';
    }
    if (agreementRate >= HITL_PHASE_THRESHOLDS.spot_check.min) {
      return 'spot_check';
    }
    return 'full_review';
  }

  /**
   * Check if human review is required for an action
   */
  static async checkReviewRequired(
    request: CheckReviewRequiredRequest
  ): Promise<CheckReviewRequiredResult> {
    // Critical risk always requires review
    if (request.riskLevel === 'critical') {
      return {
        required: true,
        phase: 'full_review',
        reason: 'Critical risk actions always require human review',
      };
    }

    // Get current accumulation
    const accumulation = await this.getAccumulation(request.agentId, request.actionType);

    if (accumulation.length === 0) {
      // No history - require full review
      return {
        required: true,
        phase: 'full_review',
        reason: 'No prior history for this action type',
      };
    }

    const accum = accumulation[0];
    const phaseConfig = HITL_PHASE_CONFIG[accum.currentPhase];

    // Check based on phase configuration
    if (accum.currentPhase === 'full_review') {
      return {
        required: true,
        phase: 'full_review',
        reason: `In full review phase (${accum.agreementRate.toFixed(1)}% agreement)`,
        agreementRate: accum.agreementRate,
      };
    }

    if (accum.currentPhase === 'autonomous') {
      return {
        required: false,
        phase: 'autonomous',
        reason: `Autonomous operation (${accum.agreementRate.toFixed(1)}% agreement)`,
        agreementRate: accum.agreementRate,
      };
    }

    // Spot check or exception only - use probability
    const shouldReview = Math.random() < phaseConfig.reviewProbability;

    // High risk gets reviewed more often
    const adjustedShouldReview = request.riskLevel === 'high'
      ? shouldReview || Math.random() < 0.5
      : shouldReview;

    return {
      required: adjustedShouldReview,
      phase: accum.currentPhase,
      reason: adjustedShouldReview
        ? `Random selection in ${phaseConfig.name} phase`
        : `Auto-approved in ${phaseConfig.name} phase`,
      agreementRate: accum.agreementRate,
    };
  }

  /**
   * Get fade configuration for an agent/action
   */
  static async getFadeConfig(
    agentId: string,
    actionType: string
  ): Promise<HITLFadeConfig> {
    const accumulation = await this.getAccumulation(agentId, actionType);

    return {
      agentId,
      actionType,
      currentPhase: accumulation.length > 0 ? accumulation[0].currentPhase : 'full_review',
      ...DEFAULT_FADE_CONFIG,
    };
  }

  /**
   * Get HITL status summary for an agent
   */
  static async getAgentHITLStatus(agentId: string): Promise<{
    actionTypes: { type: string; phase: HITLPhase; agreementRate: number }[];
    overallPhase: HITLPhase;
    averageAgreementRate: number;
  }> {
    const accumulation = await this.getAccumulation(agentId);

    if (accumulation.length === 0) {
      return {
        actionTypes: [],
        overallPhase: 'full_review',
        averageAgreementRate: 0,
      };
    }

    const actionTypes = accumulation.map(a => ({
      type: a.actionType,
      phase: a.currentPhase,
      agreementRate: a.agreementRate,
    }));

    const avgRate = accumulation.reduce((sum, a) => sum + a.agreementRate, 0) / accumulation.length;

    // Overall phase is the most restrictive
    const phases: HITLPhase[] = ['full_review', 'spot_check', 'exception_only', 'autonomous'];
    const lowestPhaseIndex = Math.min(
      ...accumulation.map(a => phases.indexOf(a.currentPhase))
    );

    return {
      actionTypes,
      overallPhase: phases[lowestPhaseIndex],
      averageAgreementRate: avgRate,
    };
  }

  // ===========================================================================
  // Review Requests
  // ===========================================================================

  /**
   * Create a review request
   */
  static async createReviewRequest(
    agentId: string,
    actionType: string,
    actionData: Record<string, unknown>,
    agentDecision: string,
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<HITLReviewRequest | null> {
    const supabase = await createClient();

    // Set expiry based on risk level
    const expiresAt = new Date();
    switch (riskLevel) {
      case 'critical':
        expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour
        break;
      case 'high':
        expiresAt.setHours(expiresAt.getHours() + 4); // 4 hours
        break;
      case 'medium':
        expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours
        break;
      default:
        expiresAt.setHours(expiresAt.getHours() + 72); // 3 days
    }

    const { data, error } = await supabase
      .from('hitl_review_requests')
      .insert({
        agent_id: agentId,
        action_type: actionType,
        action_data: actionData,
        agent_decision: agentDecision,
        risk_level: riskLevel,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating review request:', error);
      return null;
    }

    return {
      id: data.id,
      agentId: data.agent_id,
      actionType: data.action_type,
      actionData: data.action_data,
      agentDecision: data.agent_decision,
      riskLevel: data.risk_level,
      status: data.status,
      expiresAt: new Date(data.expires_at),
      createdAt: new Date(data.created_at),
    };
  }

  /**
   * Submit a review decision
   */
  static async submitReview(
    reviewId: string,
    decision: 'approved' | 'rejected' | 'modified',
    humanDecision: string,
    humanNotes: string | undefined,
    reviewedBy: string
  ): Promise<boolean> {
    const supabase = await createClient();

    // Get the review request
    const { data: request, error: fetchError } = await supabase
      .from('hitl_review_requests')
      .select('*')
      .eq('id', reviewId)
      .single();

    if (fetchError || !request) {
      return false;
    }

    // Update the review request
    const { error: updateError } = await supabase
      .from('hitl_review_requests')
      .update({
        status: decision,
        human_decision: humanDecision,
        human_notes: humanNotes,
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', reviewId);

    if (updateError) {
      console.error('Error updating review request:', updateError);
      return false;
    }

    // Record proof
    await this.recordProof({
      agentId: request.agent_id,
      actionType: request.action_type,
      riskLevel: request.risk_level,
      agentDecision: request.agent_decision,
      humanDecision,
      reviewedBy,
    });

    return true;
  }

  /**
   * Get pending review requests for an agent
   */
  static async getPendingReviews(agentId?: string): Promise<HITLReviewRequest[]> {
    const supabase = await createClient();

    let query = supabase
      .from('hitl_review_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (agentId) {
      query = query.eq('agent_id', agentId);
    }

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }

    return data.map(d => ({
      id: d.id,
      agentId: d.agent_id,
      actionType: d.action_type,
      actionData: d.action_data,
      agentDecision: d.agent_decision,
      riskLevel: d.risk_level,
      status: d.status,
      humanDecision: d.human_decision,
      humanNotes: d.human_notes,
      reviewedBy: d.reviewed_by,
      reviewedAt: d.reviewed_at ? new Date(d.reviewed_at) : undefined,
      expiresAt: d.expires_at ? new Date(d.expires_at) : undefined,
      createdAt: new Date(d.created_at),
    }));
  }

  // ===========================================================================
  // Truth Chain Integration
  // ===========================================================================

  private static async recordToTruthChain(
    action: string,
    agentId: string,
    data: Record<string, unknown>
  ): Promise<void> {
    try {
      await createTruthChainRecord({
        record_type: 'circuit_breaker', // Reuse type for governance events
        agent_id: agentId,
        data: { action, ...data, source: 'hitl-service' },
      });
    } catch (error) {
      console.error('Failed to record to truth chain:', error);
    }
  }
}

export default HITLService;
