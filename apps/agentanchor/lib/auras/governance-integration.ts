/**
 * Auras Governance Integration
 *
 * Integrates the 16 Auras council with AgentAnchor's governance layer
 * for AI-assisted escalation decisions and policy evaluation.
 */

import { getAuraService, STANDARD_COUNCILS, getCouncil } from './index';
import type { CouncilDeliberation, AuraConsultResult } from './types';
import logger from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

export interface GovernanceDecisionRequest {
    /** The action being evaluated */
    action: string;

    /** Agent ID requesting the action */
    agentId: string;

    /** Current trust score of the agent (0-1) */
    trustScore: number;

    /** Risk level assessment */
    riskLevel: 'low' | 'medium' | 'high' | 'critical';

    /** Additional context about the decision */
    context?: string;

    /** Policy that triggered escalation */
    triggeredPolicy?: string;
}

export interface GovernanceDecisionResult {
    /** Recommendation: approve, deny, or escalate to human */
    recommendation: 'approve' | 'deny' | 'escalate';

    /** Confidence in the recommendation (0-1) */
    confidence: number;

    /** Reasoning behind the decision */
    reasoning: string;

    /** Council deliberation details */
    deliberation: CouncilDeliberation;

    /** Conditions for approval (if any) */
    conditions?: string[];

    /** Warnings to note */
    warnings?: string[];
}

// ============================================================================
// Council Selection
// ============================================================================

/**
 * Select appropriate council based on the decision context
 */
export function selectCouncilForDecision(request: GovernanceDecisionRequest): string {
    const action = request.action.toLowerCase();

    // Map action types to councils
    if (action.includes('data') || action.includes('pii') || action.includes('privacy')) {
        return 'governance'; // AI Governance Council for data/privacy
    }

    if (action.includes('financial') || action.includes('payment') || action.includes('money')) {
        return 'business_strategy'; // Business council for financial decisions
    }

    if (action.includes('communication') || action.includes('email') || action.includes('message')) {
        return 'negotiation'; // Negotiation council for communications
    }

    if (action.includes('code') || action.includes('deploy') || action.includes('system')) {
        return 'innovation'; // Innovation council for technical decisions
    }

    // Default to governance council for general escalations
    return 'governance';
}

// ============================================================================
// Governance Decision Engine
// ============================================================================

/**
 * Request council deliberation on a governance decision
 */
export async function requestCouncilDecision(
    request: GovernanceDecisionRequest
): Promise<GovernanceDecisionResult> {
    const councilId = selectCouncilForDecision(request);
    const council = getCouncil(councilId);

    if (!council) {
        throw new Error(`Council not found: ${councilId}`);
    }

    logger.info('council_decision_requested', {
        councilId,
        agentId: request.agentId,
        riskLevel: request.riskLevel,
        action: request.action.substring(0, 100),
    });

    // Build the query for the council
    const query = buildGovernanceQuery(request);

    // Get the aura service and deliberate
    const service = getAuraService();
    const deliberation = await service.deliberate(councilId, query, request.context);

    // Analyze the deliberation to form a recommendation
    const result = analyzeDeliberation(deliberation, request);

    logger.info('council_decision_completed', {
        councilId,
        agentId: request.agentId,
        recommendation: result.recommendation,
        confidence: result.confidence,
    });

    return result;
}

/**
 * Build a governance-focused query for the council
 */
function buildGovernanceQuery(request: GovernanceDecisionRequest): string {
    return `
GOVERNANCE DECISION REQUEST

Agent: ${request.agentId}
Trust Score: ${(request.trustScore * 100).toFixed(0)}%
Risk Level: ${request.riskLevel.toUpperCase()}
${request.triggeredPolicy ? `Triggered Policy: ${request.triggeredPolicy}` : ''}

ACTION UNDER REVIEW:
${request.action}

${request.context ? `ADDITIONAL CONTEXT:\n${request.context}` : ''}

DECISION REQUIRED:
Should this action be APPROVED, DENIED, or ESCALATED TO HUMAN REVIEW?

Consider:
1. The agent's trust score and history
2. The risk level of the action
3. Potential consequences (positive and negative)
4. Alignment with governance policies
5. Whether human oversight is warranted

Provide your recommendation with clear reasoning.
`.trim();
}

/**
 * Analyze council deliberation to form a final recommendation
 */
function analyzeDeliberation(
    deliberation: CouncilDeliberation,
    request: GovernanceDecisionRequest
): GovernanceDecisionResult {
    const votes = deliberation.votes;
    const supportCount = votes.filter(v => v.position === 'support').length;
    const opposeCount = votes.filter(v => v.position === 'oppose').length;
    const total = votes.length;

    // Calculate confidence based on vote alignment
    const voteAlignment = Math.max(supportCount, opposeCount) / total;
    const avgConfidence = votes.reduce((sum, v) => sum + v.confidence, 0) / total;
    const confidence = (voteAlignment + avgConfidence) / 2;

    // Determine recommendation based on votes and risk level
    let recommendation: 'approve' | 'deny' | 'escalate';

    if (request.riskLevel === 'critical') {
        // Critical risk always escalates to human
        recommendation = 'escalate';
    } else if (request.trustScore < 0.3) {
        // Very low trust - deny unless overwhelming support
        recommendation = supportCount >= total * 0.75 ? 'escalate' : 'deny';
    } else if (supportCount > opposeCount && confidence > 0.7) {
        // Clear support with high confidence
        recommendation = request.riskLevel === 'high' ? 'escalate' : 'approve';
    } else if (opposeCount > supportCount && confidence > 0.7) {
        // Clear opposition with high confidence
        recommendation = 'deny';
    } else {
        // Unclear - escalate to human
        recommendation = 'escalate';
    }

    // Extract conditions and warnings from the synthesis
    const conditions = extractConditions(deliberation.synthesis || '');
    const warnings = extractWarnings(deliberation.synthesis || '');

    return {
        recommendation,
        confidence,
        reasoning: buildReasoning(deliberation, request, recommendation),
        deliberation,
        conditions: conditions.length > 0 ? conditions : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
    };
}

/**
 * Build human-readable reasoning for the decision
 */
function buildReasoning(
    deliberation: CouncilDeliberation,
    request: GovernanceDecisionRequest,
    recommendation: 'approve' | 'deny' | 'escalate'
): string {
    const parts: string[] = [];

    parts.push(`The ${deliberation.councilName} has reviewed this request.`);

    // Vote summary
    const votes = deliberation.votes;
    const supportCount = votes.filter(v => v.position === 'support').length;
    const opposeCount = votes.filter(v => v.position === 'oppose').length;

    if (deliberation.unanimity) {
        parts.push(`The council reached unanimous ${votes[0].position}.`);
    } else {
        parts.push(`Vote distribution: ${supportCount} support, ${opposeCount} oppose, ${votes.length - supportCount - opposeCount} neutral/abstain.`);
    }

    // Risk and trust context
    parts.push(`Agent trust score: ${(request.trustScore * 100).toFixed(0)}%. Risk level: ${request.riskLevel}.`);

    // Recommendation explanation
    switch (recommendation) {
        case 'approve':
            parts.push('Based on sufficient trust and council support, the action is recommended for approval.');
            break;
        case 'deny':
            parts.push('Based on council concerns and/or insufficient trust, the action is recommended for denial.');
            break;
        case 'escalate':
            parts.push('Due to the complexity, risk level, or divided council opinion, human review is recommended.');
            break;
    }

    return parts.join(' ');
}

/**
 * Extract conditional requirements from synthesis
 */
function extractConditions(synthesis: string): string[] {
    const conditions: string[] = [];
    const patterns = [
        /if\s+(.+?)\s+(?:then|,)/gi,
        /provided\s+that\s+(.+?)(?:\.|,)/gi,
        /as\s+long\s+as\s+(.+?)(?:\.|,)/gi,
        /on\s+condition\s+that\s+(.+?)(?:\.|,)/gi,
    ];

    for (const pattern of patterns) {
        const matches = synthesis.matchAll(pattern);
        for (const match of matches) {
            conditions.push(match[1].trim());
        }
    }

    return conditions.slice(0, 3);
}

/**
 * Extract warnings from synthesis
 */
function extractWarnings(synthesis: string): string[] {
    const warnings: string[] = [];
    const patterns = [
        /(?:warning|caution|note|beware)[:;]\s*(.+?)(?:\.|$)/gi,
        /(?:risk|danger|concern)[:;]\s*(.+?)(?:\.|$)/gi,
        /however[,;]\s*(.+?)(?:\.|$)/gi,
    ];

    for (const pattern of patterns) {
        const matches = synthesis.matchAll(pattern);
        for (const match of matches) {
            warnings.push(match[1].trim());
        }
    }

    return warnings.slice(0, 3);
}

// ============================================================================
// Quick Governance Checks
// ============================================================================

/**
 * Quick check for low-risk decisions that don't need full council deliberation
 */
export async function quickGovernanceCheck(
    action: string,
    trustScore: number
): Promise<{ allowed: boolean; reason: string }> {
    // High trust agents get more autonomy for low-risk actions
    if (trustScore >= 0.8) {
        return { allowed: true, reason: 'High trust agent - autonomous action permitted' };
    }

    // Medium trust needs basic validation
    if (trustScore >= 0.5) {
        const service = getAuraService();
        const result = await service.quickConsult(
            `Should this action be allowed? Action: ${action.substring(0, 200)}`,
            2
        );

        const synthesis = result.synthesis?.toLowerCase() || '';
        const allowed = synthesis.includes('approve') || synthesis.includes('allow') || synthesis.includes('proceed');

        return { allowed, reason: result.synthesis?.substring(0, 200) || 'Based on quick council assessment' };
    }

    // Low trust requires full review
    return { allowed: false, reason: 'Low trust agent - requires full council review' };
}
