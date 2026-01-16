/**
 * Decision Provenance Types
 *
 * Provides complete traceability for AI governance decisions.
 * This turns ATSF into a court-defensible reasoning system.
 *
 * @packageDocumentation
 */

import type { ID, Timestamp, TrustLevel, TrustScore, ControlAction } from '../common/types.js';

/**
 * A rule that was considered during decision-making
 */
export interface RuleConsidered {
  ruleId: ID;
  ruleName: string;
  namespace: string;
  priority: number;
  /** Whether this rule matched the input conditions */
  matched: boolean;
  /** Why the rule matched or didn't match */
  matchReason: string;
  /** Time spent evaluating this rule */
  evaluationMs: number;
}

/**
 * A rule that was actually applied to the decision
 */
export interface RuleApplied {
  ruleId: ID;
  ruleName: string;
  namespace: string;
  priority: number;
  /** The action this rule dictated */
  dictatedAction: ControlAction;
  /** Whether this rule's action was used in the final decision */
  usedInFinal: boolean;
  /** Why this rule's action was/wasn't used */
  selectionReason: string;
  /** Evidence that triggered this rule */
  triggeringEvidence: EvidenceItem[];
}

/**
 * A causal chain showing the reasoning path
 */
export interface CausalChain {
  chainId: ID;
  /** Starting point of reasoning */
  trigger: TriggerEvent;
  /** Steps in the causal chain */
  steps: CausalStep[];
  /** Final outcome of this chain */
  outcome: ChainOutcome;
  /** Confidence in this chain's validity */
  confidence: number;
  /** Why this chain was or wasn't dominant */
  dominanceReason?: string;
}

/**
 * A single step in a causal chain
 */
export interface CausalStep {
  stepNumber: number;
  /** What was evaluated */
  input: string;
  /** What rule/logic was applied */
  operation: string;
  /** What resulted */
  output: string;
  /** Evidence supporting this step */
  evidence: EvidenceItem[];
  /** Confidence in this step */
  confidence: number;
}

/**
 * Outcome of a causal chain
 */
export interface ChainOutcome {
  action: ControlAction;
  /** Risk level determined */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  /** Any modifications to the original intent */
  modifications?: string[];
}

/**
 * Event that triggered the decision process
 */
export interface TriggerEvent {
  eventType: 'intent_submitted' | 'escalation_response' | 'policy_change' | 'trust_update' | 'manual_review';
  eventId: ID;
  timestamp: Timestamp;
  source: string;
  payload: Record<string, unknown>;
}

/**
 * Evidence item supporting a decision
 */
export interface EvidenceItem {
  type: 'input' | 'computed' | 'codepath' | 'external' | 'historical';
  /** Pointer to the evidence source */
  pointer: string;
  /** Human-readable summary */
  summary: string;
  /** Confidence in this evidence */
  confidence: number;
  /** When this evidence was collected */
  collectedAt: Timestamp;
}

/**
 * A counterfactual that was considered but rejected
 */
export interface CounterfactualRejected {
  /** What alternative was considered */
  alternative: string;
  /** What action that alternative would have produced */
  wouldHaveProduced: ControlAction;
  /** Why it was rejected */
  rejectionReason: string;
  /** Evidence against this alternative */
  contraryEvidence: EvidenceItem[];
  /** Confidence that rejection was correct */
  rejectionConfidence: number;
}

/**
 * Security layer result in the provenance chain
 */
export interface LayerResult {
  layerId: string;
  layerName: string;
  tier: string;
  /** Whether this layer passed */
  passed: boolean;
  /** Action recommended by this layer */
  action: ControlAction;
  /** Confidence in this layer's result */
  confidence: number;
  /** Details from this layer */
  details: Record<string, unknown>;
  /** Time spent in this layer */
  durationMs: number;
}

/**
 * Decision Provenance Object (DPO)
 *
 * Complete record of why a decision was made, including all rules
 * considered, causal chains evaluated, and counterfactuals rejected.
 */
export interface DecisionProvenance {
  /** Unique identifier for this provenance record */
  decisionId: ID;

  /** The event that triggered this decision */
  triggerEvent: TriggerEvent;

  /** Entity this decision applies to */
  entityId: ID;
  entityTrustScore: TrustScore;
  entityTrustLevel: TrustLevel;

  /** Intent being evaluated */
  intentId: ID;
  intentGoal: string;

  /** All rules that were considered */
  rulesConsidered: RuleConsidered[];

  /** Rules that were actually applied */
  rulesApplied: RuleApplied[];

  /** Causal chains that were evaluated */
  causalChainsEvaluated: CausalChain[];

  /** The winning causal chain */
  dominantChain: CausalChain;

  /** Security layers traversed */
  layerResults: LayerResult[];

  /** Overall confidence in this decision (0-1) */
  confidenceScore: number;

  /** Alternatives that were considered but rejected */
  counterfactualsRejected: CounterfactualRejected[];

  /** All evidence collected */
  evidence: EvidenceItem[];

  /** Assumptions made during reasoning */
  assumptions: string[];

  /** Conditions that would invalidate this decision */
  invalidityConditions: string[];

  /** Final action taken */
  finalAction: ControlAction;

  /** Explanation of final decision */
  finalExplanation: string;

  /** Total processing time */
  totalDurationMs: number;

  /** When decision was made */
  decidedAt: Timestamp;

  /** Version of the decision engine */
  engineVersion: string;

  /** Hash of this provenance record for integrity */
  provenanceHash: string;
}

/**
 * Request to create a provenance record
 */
export interface ProvenanceRequest {
  triggerEvent: TriggerEvent;
  entityId: ID;
  entityTrustScore: TrustScore;
  entityTrustLevel: TrustLevel;
  intentId: ID;
  intentGoal: string;
}

/**
 * Query options for provenance records
 */
export interface ProvenanceQuery {
  entityId?: ID;
  intentId?: ID;
  decisionId?: ID;
  finalAction?: ControlAction;
  minConfidence?: number;
  startDate?: Timestamp;
  endDate?: Timestamp;
  limit?: number;
  offset?: number;
}
