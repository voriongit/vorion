/**
 * Multi-Agent Trust Arbitration Types
 *
 * Handles trust conflicts between agents using weighted voting,
 * cross-agent confidence decay, and consensus mechanisms.
 *
 * @packageDocumentation
 */

import type { ID, TrustLevel, TrustScore, ControlAction, Timestamp } from '../common/types.js';

/**
 * An agent participating in trust arbitration
 */
export interface ArbitrationAgent {
  /** Unique agent identifier */
  agentId: ID;
  /** Agent name */
  name: string;
  /** Agent's current trust score */
  trustScore: TrustScore;
  /** Agent's trust level */
  trustLevel: TrustLevel;
  /** Agent's role in the system */
  role: AgentRole;
  /** Historical accuracy of this agent's assessments */
  historicalAccuracy: number;
  /** Number of arbitrations this agent has participated in */
  participationCount: number;
  /** Current voting weight (calculated) */
  votingWeight: number;
}

/**
 * Agent roles that affect voting weight
 */
export type AgentRole =
  | 'primary'      // Main decision-making agent
  | 'validator'    // Verifies other agents' outputs
  | 'specialist'   // Domain-specific expertise
  | 'supervisor'   // Oversight role
  | 'executor'     // Carries out actions
  | 'observer';    // Read-only monitoring

/**
 * A vote cast by an agent during arbitration
 */
export interface ArbitrationVote {
  /** Agent casting the vote */
  agentId: ID;
  /** Proposed action */
  action: ControlAction;
  /** Confidence in this vote (0-1) */
  confidence: number;
  /** Reasoning for the vote */
  reasoning: string;
  /** Evidence supporting the vote */
  evidence: VoteEvidence[];
  /** Concerns or caveats */
  concerns: string[];
  /** When the vote was cast */
  timestamp: Timestamp;
}

/**
 * Evidence supporting a vote
 */
export interface VoteEvidence {
  type: 'data' | 'rule' | 'history' | 'external' | 'inference';
  source: string;
  summary: string;
  confidence: number;
}

/**
 * A trust conflict requiring arbitration
 */
export interface TrustConflict {
  /** Unique conflict identifier */
  conflictId: ID;
  /** Type of conflict */
  conflictType: ConflictType;
  /** Subject of the conflict (entity, action, or resource) */
  subject: ConflictSubject;
  /** Agents involved in the conflict */
  agents: ArbitrationAgent[];
  /** Initial positions of each agent */
  initialPositions: Map<ID, ArbitrationVote>;
  /** When the conflict was detected */
  detectedAt: Timestamp;
  /** Severity of the conflict */
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Types of conflicts that can arise
 */
export type ConflictType =
  | 'action_disagreement'      // Agents disagree on what action to take
  | 'trust_assessment'         // Agents disagree on entity trust level
  | 'capability_scope'         // Agents disagree on capability permissions
  | 'risk_evaluation'          // Agents disagree on risk level
  | 'resource_allocation'      // Agents compete for resources
  | 'priority_conflict';       // Agents disagree on task priority

/**
 * Subject of a conflict
 */
export interface ConflictSubject {
  type: 'entity' | 'action' | 'resource' | 'intent';
  id: ID;
  description: string;
  context: Record<string, unknown>;
}

/**
 * Result of trust arbitration
 */
export interface ArbitrationResult {
  /** Unique result identifier */
  resultId: ID;
  /** Conflict that was arbitrated */
  conflictId: ID;
  /** Resolution method used */
  method: ArbitrationMethod;
  /** Final decision */
  decision: ArbitrationDecision;
  /** All votes cast */
  votes: ArbitrationVote[];
  /** Voting rounds (if iterative) */
  rounds: ArbitrationRound[];
  /** Confidence decay applied */
  confidenceDecay: ConfidenceDecayRecord;
  /** Consensus metrics */
  consensusMetrics: ConsensusMetrics;
  /** When arbitration completed */
  completedAt: Timestamp;
  /** Total time spent */
  durationMs: number;
}

/**
 * Methods for resolving conflicts
 */
export type ArbitrationMethod =
  | 'weighted_majority'    // Weighted voting based on trust/accuracy
  | 'unanimous_required'   // All agents must agree
  | 'supervisor_override'  // Supervisor agent makes final call
  | 'consensus_building'   // Iterative discussion to reach consensus
  | 'escalate_human'       // Escalate to human decision-maker
  | 'default_deny';        // Default to most restrictive action

/**
 * The final arbitration decision
 */
export interface ArbitrationDecision {
  /** Chosen action */
  action: ControlAction;
  /** Confidence in the decision (0-1) */
  confidence: number;
  /** Whether consensus was reached */
  consensusReached: boolean;
  /** Agents that agreed with the decision */
  agreeingAgents: ID[];
  /** Agents that disagreed */
  disagreeingAgents: ID[];
  /** Agents that abstained */
  abstainingAgents: ID[];
  /** Explanation of the decision */
  explanation: string;
  /** Conditions that would invalidate this decision */
  invalidityConditions: string[];
}

/**
 * A round of arbitration voting
 */
export interface ArbitrationRound {
  roundNumber: number;
  votes: ArbitrationVote[];
  intermediateResult: {
    leadingAction: ControlAction;
    voteCount: Record<ControlAction, number>;
    weightedScore: Record<ControlAction, number>;
    consensusLevel: number;
  };
  feedback: AgentFeedback[];
  timestamp: Timestamp;
}

/**
 * Feedback provided between rounds
 */
export interface AgentFeedback {
  fromAgent: ID;
  toAgent: ID;
  feedbackType: 'support' | 'challenge' | 'question' | 'information';
  content: string;
}

/**
 * Record of confidence decay applied
 */
export interface ConfidenceDecayRecord {
  /** Initial confidence levels */
  initial: Map<ID, number>;
  /** Final confidence levels after decay */
  final: Map<ID, number>;
  /** Decay factors applied */
  decayFactors: DecayFactor[];
  /** Total decay percentage */
  totalDecayPercent: number;
}

/**
 * A factor contributing to confidence decay
 */
export interface DecayFactor {
  type: DecayFactorType;
  affectedAgents: ID[];
  decayAmount: number;
  reason: string;
}

/**
 * Types of factors that cause confidence decay
 */
export type DecayFactorType =
  | 'cross_agent_disagreement'  // Agents disagreeing reduces confidence
  | 'historical_inaccuracy'    // Past mistakes reduce confidence
  | 'role_mismatch'            // Acting outside assigned role
  | 'evidence_conflict'        // Conflicting evidence presented
  | 'time_pressure'            // Rushed decision
  | 'uncertainty_propagation'; // Uncertainty from upstream agents

/**
 * Metrics about the consensus process
 */
export interface ConsensusMetrics {
  /** Agreement level (0-1) */
  agreementLevel: number;
  /** Entropy of vote distribution */
  voteEntropy: number;
  /** Number of rounds needed */
  roundsRequired: number;
  /** Did any agent change their vote? */
  votesChanged: boolean;
  /** Strongest dissent */
  strongestDissent?: {
    agentId: ID;
    originalVote: ControlAction;
    confidence: number;
    reason: string;
  };
}

/**
 * Configuration for the arbitration engine
 */
export interface ArbitrationConfig {
  /** Default method for resolving conflicts */
  defaultMethod: ArbitrationMethod;
  /** Maximum rounds for consensus building */
  maxRounds: number;
  /** Timeout for arbitration in ms */
  timeoutMs: number;
  /** Minimum consensus level to accept (0-1) */
  minConsensusLevel: number;
  /** Whether to apply confidence decay */
  enableConfidenceDecay: boolean;
  /** Decay rate per disagreement */
  disagreementDecayRate: number;
  /** Minimum confidence to accept a decision */
  minDecisionConfidence: number;
  /** Role weights for voting */
  roleWeights: Record<AgentRole, number>;
  /** Trust level weights for voting */
  trustWeights: Record<TrustLevel, number>;
}

/**
 * Request to initiate arbitration
 */
export interface ArbitrationRequest {
  conflict: TrustConflict;
  preferredMethod?: ArbitrationMethod;
  urgency: 'low' | 'normal' | 'high' | 'critical';
  context?: Record<string, unknown>;
}

/**
 * Query for arbitration history
 */
export interface ArbitrationQuery {
  agentId?: ID;
  conflictType?: ConflictType;
  method?: ArbitrationMethod;
  startDate?: Timestamp;
  endDate?: Timestamp;
  consensusReached?: boolean;
  limit?: number;
  offset?: number;
}
