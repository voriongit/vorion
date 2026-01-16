/**
 * Multi-Agent Trust Arbitration Engine
 *
 * Resolves trust conflicts between agents using weighted voting,
 * consensus building, and cross-agent confidence decay.
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import type { ID, TrustLevel, ControlAction } from '../common/types.js';
import type {
  ArbitrationAgent,
  ArbitrationVote,
  TrustConflict,
  ArbitrationResult,
  ArbitrationDecision,
  ArbitrationRound,
  ArbitrationMethod,
  ArbitrationConfig,
  ArbitrationRequest,
  ArbitrationQuery,
  ConfidenceDecayRecord,
  DecayFactor,
  ConsensusMetrics,
  AgentRole,
} from './types.js';

export * from './types.js';

const logger = createLogger({ component: 'trust-arbitration' });

/**
 * Default arbitration configuration
 */
const DEFAULT_CONFIG: ArbitrationConfig = {
  defaultMethod: 'weighted_majority',
  maxRounds: 3,
  timeoutMs: 30000,
  minConsensusLevel: 0.6,
  enableConfidenceDecay: true,
  disagreementDecayRate: 0.1,
  minDecisionConfidence: 0.5,
  roleWeights: {
    primary: 1.0,
    validator: 0.9,
    specialist: 0.85,
    supervisor: 1.2,
    executor: 0.7,
    observer: 0.3,
  },
  trustWeights: {
    0: 0.2,
    1: 0.4,
    2: 0.6,
    3: 0.8,
    4: 0.95,
    5: 1.0,
  },
};

/**
 * Trust Arbitration Engine
 */
export class TrustArbitrationEngine {
  private config: ArbitrationConfig;
  private history: Map<ID, ArbitrationResult> = new Map();
  private agents: Map<ID, ArbitrationAgent> = new Map();

  constructor(config: Partial<ArbitrationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Register an agent for arbitration
   */
  registerAgent(agent: ArbitrationAgent): void {
    // Calculate voting weight
    const roleWeight = this.config.roleWeights[agent.role] ?? 1.0;
    const trustWeight = this.config.trustWeights[agent.trustLevel] ?? 0.5;
    const accuracyWeight = agent.historicalAccuracy;

    agent.votingWeight = roleWeight * trustWeight * accuracyWeight;

    this.agents.set(agent.agentId, agent);
    logger.debug({ agentId: agent.agentId, votingWeight: agent.votingWeight }, 'Agent registered for arbitration');
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: ID): void {
    this.agents.delete(agentId);
  }

  /**
   * Get a registered agent
   */
  getAgent(agentId: ID): ArbitrationAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Arbitrate a trust conflict
   */
  async arbitrate(request: ArbitrationRequest): Promise<ArbitrationResult> {
    const startTime = Date.now();
    const resultId = crypto.randomUUID();

    logger.info(
      {
        conflictId: request.conflict.conflictId,
        conflictType: request.conflict.conflictType,
        agentCount: request.conflict.agents.length,
        urgency: request.urgency,
      },
      'Starting trust arbitration'
    );

    const method = request.preferredMethod ?? this.config.defaultMethod;

    let result: ArbitrationResult;

    switch (method) {
      case 'weighted_majority':
        result = await this.arbitrateWeightedMajority(resultId, request);
        break;
      case 'unanimous_required':
        result = await this.arbitrateUnanimous(resultId, request);
        break;
      case 'supervisor_override':
        result = await this.arbitrateSupervisorOverride(resultId, request);
        break;
      case 'consensus_building':
        result = await this.arbitrateConsensusBuilding(resultId, request);
        break;
      case 'escalate_human':
        result = await this.arbitrateEscalateHuman(resultId, request);
        break;
      case 'default_deny':
      default:
        result = await this.arbitrateDefaultDeny(resultId, request);
        break;
    }

    result.durationMs = Date.now() - startTime;
    result.completedAt = new Date().toISOString();

    // Store result
    this.history.set(resultId, result);

    // Update agent accuracy based on result
    this.updateAgentAccuracy(result);

    logger.info(
      {
        resultId,
        conflictId: request.conflict.conflictId,
        decision: result.decision.action,
        confidence: result.decision.confidence,
        consensusReached: result.decision.consensusReached,
        durationMs: result.durationMs,
      },
      'Trust arbitration completed'
    );

    return result;
  }

  /**
   * Weighted majority voting
   */
  private async arbitrateWeightedMajority(
    resultId: ID,
    request: ArbitrationRequest
  ): Promise<ArbitrationResult> {
    const votes = this.collectVotes(request.conflict);
    const confidenceDecay = this.applyConfidenceDecay(votes, request.conflict);

    // Calculate weighted scores for each action
    const weightedScores = new Map<ControlAction, number>();
    const voteCounts = new Map<ControlAction, number>();

    for (const vote of votes) {
      const agent = this.agents.get(vote.agentId);
      const weight = agent?.votingWeight ?? 1.0;
      const decayedConfidence = confidenceDecay.final.get(vote.agentId) ?? vote.confidence;

      const currentScore = weightedScores.get(vote.action) ?? 0;
      weightedScores.set(vote.action, currentScore + weight * decayedConfidence);

      const currentCount = voteCounts.get(vote.action) ?? 0;
      voteCounts.set(vote.action, currentCount + 1);
    }

    // Find winning action
    let winningAction: ControlAction = 'deny';
    let maxScore = 0;

    for (const [action, score] of weightedScores) {
      if (score > maxScore) {
        maxScore = score;
        winningAction = action;
      }
    }

    // Calculate consensus metrics
    const totalWeight = Array.from(weightedScores.values()).reduce((a, b) => a + b, 0);
    const consensusLevel = maxScore / totalWeight;

    const decision = this.createDecision(votes, winningAction, consensusLevel, confidenceDecay);
    const consensusMetrics = this.calculateConsensusMetrics(votes, decision, []);

    return {
      resultId,
      conflictId: request.conflict.conflictId,
      method: 'weighted_majority',
      decision,
      votes,
      rounds: [
        {
          roundNumber: 1,
          votes,
          intermediateResult: {
            leadingAction: winningAction,
            voteCount: Object.fromEntries(voteCounts) as Record<ControlAction, number>,
            weightedScore: Object.fromEntries(weightedScores) as Record<ControlAction, number>,
            consensusLevel,
          },
          feedback: [],
          timestamp: new Date().toISOString(),
        },
      ],
      confidenceDecay,
      consensusMetrics,
      completedAt: new Date().toISOString(),
      durationMs: 0,
    };
  }

  /**
   * Unanimous voting (all must agree)
   */
  private async arbitrateUnanimous(
    resultId: ID,
    request: ArbitrationRequest
  ): Promise<ArbitrationResult> {
    const votes = this.collectVotes(request.conflict);
    const confidenceDecay = this.applyConfidenceDecay(votes, request.conflict);

    // Check if all votes agree
    const actions = new Set(votes.map((v) => v.action));
    const unanimous = actions.size === 1 && votes.length > 0;

    const winningAction: ControlAction = unanimous
      ? votes[0]!.action
      : 'escalate'; // Escalate if no unanimity

    const consensusLevel = unanimous ? 1.0 : 0;

    const decision = this.createDecision(votes, winningAction, consensusLevel, confidenceDecay);
    decision.explanation = unanimous
      ? `Unanimous agreement on ${winningAction}`
      : `No unanimity reached (${actions.size} different positions) - escalating`;

    return {
      resultId,
      conflictId: request.conflict.conflictId,
      method: 'unanimous_required',
      decision,
      votes,
      rounds: [
        {
          roundNumber: 1,
          votes,
          intermediateResult: {
            leadingAction: winningAction,
            voteCount: {} as Record<ControlAction, number>,
            weightedScore: {} as Record<ControlAction, number>,
            consensusLevel,
          },
          feedback: [],
          timestamp: new Date().toISOString(),
        },
      ],
      confidenceDecay,
      consensusMetrics: this.calculateConsensusMetrics(votes, decision, []),
      completedAt: new Date().toISOString(),
      durationMs: 0,
    };
  }

  /**
   * Supervisor override - supervisor agent makes final call
   */
  private async arbitrateSupervisorOverride(
    resultId: ID,
    request: ArbitrationRequest
  ): Promise<ArbitrationResult> {
    const votes = this.collectVotes(request.conflict);
    const confidenceDecay = this.applyConfidenceDecay(votes, request.conflict);

    // Find supervisor vote
    const supervisorVote = votes.find((v) => {
      const agent = this.agents.get(v.agentId);
      return agent?.role === 'supervisor';
    });

    const winningAction: ControlAction = supervisorVote?.action ?? 'escalate';
    const consensusLevel = supervisorVote ? 1.0 : 0;

    const decision = this.createDecision(votes, winningAction, consensusLevel, confidenceDecay);
    decision.explanation = supervisorVote
      ? `Supervisor override: ${supervisorVote.reasoning}`
      : 'No supervisor available - escalating';

    return {
      resultId,
      conflictId: request.conflict.conflictId,
      method: 'supervisor_override',
      decision,
      votes,
      rounds: [
        {
          roundNumber: 1,
          votes,
          intermediateResult: {
            leadingAction: winningAction,
            voteCount: {} as Record<ControlAction, number>,
            weightedScore: {} as Record<ControlAction, number>,
            consensusLevel,
          },
          feedback: [],
          timestamp: new Date().toISOString(),
        },
      ],
      confidenceDecay,
      consensusMetrics: this.calculateConsensusMetrics(votes, decision, []),
      completedAt: new Date().toISOString(),
      durationMs: 0,
    };
  }

  /**
   * Consensus building - iterative discussion
   */
  private async arbitrateConsensusBuilding(
    resultId: ID,
    request: ArbitrationRequest
  ): Promise<ArbitrationResult> {
    const rounds: ArbitrationRound[] = [];
    let currentVotes = this.collectVotes(request.conflict);
    let consensusLevel = 0;
    let winningAction: ControlAction = 'deny';

    for (let round = 1; round <= this.config.maxRounds; round++) {
      // Calculate current consensus
      const actionCounts = new Map<ControlAction, number>();
      for (const vote of currentVotes) {
        const count = actionCounts.get(vote.action) ?? 0;
        actionCounts.set(vote.action, count + 1);
      }

      // Find leading action
      let maxCount = 0;
      for (const [action, count] of actionCounts) {
        if (count > maxCount) {
          maxCount = count;
          winningAction = action;
        }
      }

      consensusLevel = maxCount / currentVotes.length;

      rounds.push({
        roundNumber: round,
        votes: [...currentVotes],
        intermediateResult: {
          leadingAction: winningAction,
          voteCount: Object.fromEntries(actionCounts) as Record<ControlAction, number>,
          weightedScore: {} as Record<ControlAction, number>,
          consensusLevel,
        },
        feedback: [],
        timestamp: new Date().toISOString(),
      });

      // Check if consensus reached
      if (consensusLevel >= this.config.minConsensusLevel) {
        break;
      }

      // Simulate agents updating their votes based on discussion
      // In real implementation, this would involve actual agent communication
      currentVotes = this.simulateVoteAdjustment(currentVotes, winningAction);
    }

    const confidenceDecay = this.applyConfidenceDecay(currentVotes, request.conflict);
    const decision = this.createDecision(currentVotes, winningAction, consensusLevel, confidenceDecay);

    return {
      resultId,
      conflictId: request.conflict.conflictId,
      method: 'consensus_building',
      decision,
      votes: currentVotes,
      rounds,
      confidenceDecay,
      consensusMetrics: this.calculateConsensusMetrics(currentVotes, decision, rounds),
      completedAt: new Date().toISOString(),
      durationMs: 0,
    };
  }

  /**
   * Escalate to human decision-maker
   */
  private async arbitrateEscalateHuman(
    resultId: ID,
    request: ArbitrationRequest
  ): Promise<ArbitrationResult> {
    const votes = this.collectVotes(request.conflict);
    const confidenceDecay = this.applyConfidenceDecay(votes, request.conflict);

    const decision: ArbitrationDecision = {
      action: 'escalate',
      confidence: 1.0,
      consensusReached: false,
      agreeingAgents: [],
      disagreeingAgents: votes.map((v) => v.agentId),
      abstainingAgents: [],
      explanation: 'Conflict escalated to human decision-maker for resolution',
      invalidityConditions: ['Human decision received', 'Timeout exceeded'],
    };

    return {
      resultId,
      conflictId: request.conflict.conflictId,
      method: 'escalate_human',
      decision,
      votes,
      rounds: [],
      confidenceDecay,
      consensusMetrics: this.calculateConsensusMetrics(votes, decision, []),
      completedAt: new Date().toISOString(),
      durationMs: 0,
    };
  }

  /**
   * Default to deny (most restrictive)
   */
  private async arbitrateDefaultDeny(
    resultId: ID,
    request: ArbitrationRequest
  ): Promise<ArbitrationResult> {
    const votes = this.collectVotes(request.conflict);
    const confidenceDecay = this.applyConfidenceDecay(votes, request.conflict);

    const decision: ArbitrationDecision = {
      action: 'deny',
      confidence: 1.0,
      consensusReached: false,
      agreeingAgents: votes.filter((v) => v.action === 'deny').map((v) => v.agentId),
      disagreeingAgents: votes.filter((v) => v.action !== 'deny').map((v) => v.agentId),
      abstainingAgents: [],
      explanation: 'Conflict resolved by defaulting to most restrictive action (deny)',
      invalidityConditions: [],
    };

    return {
      resultId,
      conflictId: request.conflict.conflictId,
      method: 'default_deny',
      decision,
      votes,
      rounds: [],
      confidenceDecay,
      consensusMetrics: this.calculateConsensusMetrics(votes, decision, []),
      completedAt: new Date().toISOString(),
      durationMs: 0,
    };
  }

  /**
   * Collect votes from initial positions
   */
  private collectVotes(conflict: TrustConflict): ArbitrationVote[] {
    return Array.from(conflict.initialPositions.values());
  }

  /**
   * Apply confidence decay based on disagreement
   */
  private applyConfidenceDecay(
    votes: ArbitrationVote[],
    _conflict: TrustConflict
  ): ConfidenceDecayRecord {
    const initial = new Map<ID, number>();
    const final = new Map<ID, number>();
    const decayFactors: DecayFactor[] = [];

    // Initialize
    for (const vote of votes) {
      initial.set(vote.agentId, vote.confidence);
      final.set(vote.agentId, vote.confidence);
    }

    if (!this.config.enableConfidenceDecay) {
      return { initial, final, decayFactors, totalDecayPercent: 0 };
    }

    // Apply cross-agent disagreement decay
    const actionGroups = new Map<ControlAction, ID[]>();
    for (const vote of votes) {
      const group = actionGroups.get(vote.action) ?? [];
      group.push(vote.agentId);
      actionGroups.set(vote.action, group);
    }

    // If there's disagreement, reduce confidence of minority positions
    if (actionGroups.size > 1) {
      let maxGroupSize = 0;
      let majorityAction: ControlAction = 'deny';

      for (const [action, agents] of actionGroups) {
        if (agents.length > maxGroupSize) {
          maxGroupSize = agents.length;
          majorityAction = action;
        }
      }

      // Decay minority positions
      for (const [action, agents] of actionGroups) {
        if (action !== majorityAction) {
          const decayAmount = this.config.disagreementDecayRate;
          for (const agentId of agents) {
            const current = final.get(agentId) ?? 0;
            final.set(agentId, Math.max(0, current - decayAmount));
          }

          decayFactors.push({
            type: 'cross_agent_disagreement',
            affectedAgents: agents,
            decayAmount,
            reason: `Minority position on ${action} vs majority ${majorityAction}`,
          });
        }
      }
    }

    // Apply historical accuracy decay
    for (const vote of votes) {
      const agent = this.agents.get(vote.agentId);
      if (agent && agent.historicalAccuracy < 0.8) {
        const decayAmount = (1 - agent.historicalAccuracy) * 0.1;
        const current = final.get(vote.agentId) ?? 0;
        final.set(vote.agentId, Math.max(0, current - decayAmount));

        decayFactors.push({
          type: 'historical_inaccuracy',
          affectedAgents: [vote.agentId],
          decayAmount,
          reason: `Historical accuracy of ${(agent.historicalAccuracy * 100).toFixed(1)}%`,
        });
      }
    }

    // Calculate total decay
    let totalInitial = 0;
    let totalFinal = 0;
    for (const agentId of initial.keys()) {
      totalInitial += initial.get(agentId) ?? 0;
      totalFinal += final.get(agentId) ?? 0;
    }
    const totalDecayPercent = totalInitial > 0 ? ((totalInitial - totalFinal) / totalInitial) * 100 : 0;

    return { initial, final, decayFactors, totalDecayPercent };
  }

  /**
   * Create the final decision
   */
  private createDecision(
    votes: ArbitrationVote[],
    action: ControlAction,
    consensusLevel: number,
    confidenceDecay: ConfidenceDecayRecord
  ): ArbitrationDecision {
    const agreeing = votes.filter((v) => v.action === action);
    const disagreeing = votes.filter((v) => v.action !== action);

    // Calculate confidence from agreeing agents with decay applied
    let totalConfidence = 0;
    for (const vote of agreeing) {
      totalConfidence += confidenceDecay.final.get(vote.agentId) ?? vote.confidence;
    }
    const avgConfidence = agreeing.length > 0 ? totalConfidence / agreeing.length : 0;

    const consensusReached = consensusLevel >= this.config.minConsensusLevel;

    return {
      action,
      confidence: avgConfidence,
      consensusReached,
      agreeingAgents: agreeing.map((v) => v.agentId),
      disagreeingAgents: disagreeing.map((v) => v.agentId),
      abstainingAgents: [],
      explanation: this.generateExplanation(votes, action, consensusLevel, consensusReached),
      invalidityConditions: this.generateInvalidityConditions(votes, action),
    };
  }

  /**
   * Generate explanation for decision
   */
  private generateExplanation(
    votes: ArbitrationVote[],
    action: ControlAction,
    consensusLevel: number,
    consensusReached: boolean
  ): string {
    const agreeing = votes.filter((v) => v.action === action);
    const reasons = agreeing.map((v) => v.reasoning).join('; ');

    if (consensusReached) {
      return `Consensus reached (${(consensusLevel * 100).toFixed(1)}%) on ${action}: ${reasons}`;
    } else {
      return `Majority position (${(consensusLevel * 100).toFixed(1)}%) for ${action}: ${reasons}`;
    }
  }

  /**
   * Generate conditions that would invalidate the decision
   */
  private generateInvalidityConditions(votes: ArbitrationVote[], _action: ControlAction): string[] {
    const conditions: string[] = [];

    // Conditions based on concerns from voting agents
    for (const vote of votes) {
      for (const concern of vote.concerns) {
        if (!conditions.includes(concern)) {
          conditions.push(concern);
        }
      }
    }

    // Add standard conditions
    conditions.push('Trust scores of participating agents change significantly');
    conditions.push('New evidence emerges contradicting the decision');

    return conditions;
  }

  /**
   * Calculate consensus metrics
   */
  private calculateConsensusMetrics(
    votes: ArbitrationVote[],
    decision: ArbitrationDecision,
    rounds: ArbitrationRound[]
  ): ConsensusMetrics {
    // Calculate vote entropy
    const actionCounts = new Map<ControlAction, number>();
    for (const vote of votes) {
      const count = actionCounts.get(vote.action) ?? 0;
      actionCounts.set(vote.action, count + 1);
    }

    let entropy = 0;
    const total = votes.length;
    for (const count of actionCounts.values()) {
      const p = count / total;
      if (p > 0) {
        entropy -= p * Math.log2(p);
      }
    }

    // Find strongest dissent
    let strongestDissent: ConsensusMetrics['strongestDissent'] = undefined;
    const disagreeing = votes.filter((v) => v.action !== decision.action);
    if (disagreeing.length > 0) {
      const strongest = disagreeing.reduce((max, v) => (v.confidence > max.confidence ? v : max));
      strongestDissent = {
        agentId: strongest.agentId,
        originalVote: strongest.action,
        confidence: strongest.confidence,
        reason: strongest.reasoning,
      };
    }

    return {
      agreementLevel: decision.agreeingAgents.length / votes.length,
      voteEntropy: entropy,
      roundsRequired: rounds.length || 1,
      votesChanged: rounds.length > 1, // Simplified - actual impl would track changes
      strongestDissent,
    };
  }

  /**
   * Simulate vote adjustment in consensus building
   */
  private simulateVoteAdjustment(
    votes: ArbitrationVote[],
    leadingAction: ControlAction
  ): ArbitrationVote[] {
    return votes.map((vote) => {
      // Low-confidence voters tend to move toward consensus
      if (vote.confidence < 0.5 && vote.action !== leadingAction) {
        return {
          ...vote,
          action: leadingAction,
          confidence: vote.confidence * 0.9, // Reduce confidence when changing position
          reasoning: `Adjusted to consensus position: ${vote.reasoning}`,
        };
      }
      return vote;
    });
  }

  /**
   * Update agent accuracy based on arbitration result
   */
  private updateAgentAccuracy(result: ArbitrationResult): void {
    // In a real implementation, this would be updated based on
    // long-term outcome tracking. For now, we update based on
    // whether the agent's vote matched the final decision.
    for (const vote of result.votes) {
      const agent = this.agents.get(vote.agentId);
      if (!agent) continue;

      const matched = vote.action === result.decision.action;
      const adjustment = matched ? 0.01 : -0.01;

      agent.historicalAccuracy = Math.max(0, Math.min(1, agent.historicalAccuracy + adjustment));
      agent.participationCount++;

      // Recalculate voting weight
      const roleWeight = this.config.roleWeights[agent.role] ?? 1.0;
      const trustWeight = this.config.trustWeights[agent.trustLevel] ?? 0.5;
      agent.votingWeight = roleWeight * trustWeight * agent.historicalAccuracy;
    }
  }

  /**
   * Query arbitration history
   */
  async query(query: ArbitrationQuery): Promise<ArbitrationResult[]> {
    let results = Array.from(this.history.values());

    if (query.agentId) {
      results = results.filter((r) =>
        r.votes.some((v) => v.agentId === query.agentId)
      );
    }

    if (query.conflictType) {
      // Would need conflict info stored in result
    }

    if (query.method) {
      results = results.filter((r) => r.method === query.method);
    }

    if (query.consensusReached !== undefined) {
      results = results.filter((r) => r.decision.consensusReached === query.consensusReached);
    }

    if (query.startDate) {
      results = results.filter((r) => r.completedAt >= query.startDate!);
    }

    if (query.endDate) {
      results = results.filter((r) => r.completedAt <= query.endDate!);
    }

    // Sort by completion time (newest first)
    results.sort((a, b) => b.completedAt.localeCompare(a.completedAt));

    // Apply pagination
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 100;
    return results.slice(offset, offset + limit);
  }

  /**
   * Get arbitration statistics
   */
  getStats(): {
    totalArbitrations: number;
    byMethod: Record<ArbitrationMethod, number>;
    consensusRate: number;
    averageDurationMs: number;
    agentCount: number;
  } {
    const results = Array.from(this.history.values());

    const byMethod: Record<ArbitrationMethod, number> = {
      weighted_majority: 0,
      unanimous_required: 0,
      supervisor_override: 0,
      consensus_building: 0,
      escalate_human: 0,
      default_deny: 0,
    };

    let consensusCount = 0;
    let totalDuration = 0;

    for (const result of results) {
      byMethod[result.method]++;
      if (result.decision.consensusReached) consensusCount++;
      totalDuration += result.durationMs;
    }

    return {
      totalArbitrations: results.length,
      byMethod,
      consensusRate: results.length > 0 ? consensusCount / results.length : 0,
      averageDurationMs: results.length > 0 ? totalDuration / results.length : 0,
      agentCount: this.agents.size,
    };
  }
}

/**
 * Create a new trust arbitration engine
 */
export function createTrustArbitrationEngine(
  config?: Partial<ArbitrationConfig>
): TrustArbitrationEngine {
  return new TrustArbitrationEngine(config);
}

/**
 * Helper to create an arbitration agent
 */
export function createArbitrationAgent(
  agentId: ID,
  name: string,
  options: {
    trustScore: number;
    trustLevel: TrustLevel;
    role: AgentRole;
    historicalAccuracy?: number;
  }
): ArbitrationAgent {
  return {
    agentId,
    name,
    trustScore: options.trustScore,
    trustLevel: options.trustLevel,
    role: options.role,
    historicalAccuracy: options.historicalAccuracy ?? 0.8,
    participationCount: 0,
    votingWeight: 0, // Will be calculated on registration
  };
}

/**
 * Helper to create a trust conflict
 */
export function createTrustConflict(
  conflictType: TrustConflict['conflictType'],
  subject: TrustConflict['subject'],
  agents: ArbitrationAgent[],
  initialPositions: ArbitrationVote[]
): TrustConflict {
  const positionsMap = new Map<ID, ArbitrationVote>();
  for (const vote of initialPositions) {
    positionsMap.set(vote.agentId, vote);
  }

  return {
    conflictId: crypto.randomUUID(),
    conflictType,
    subject,
    agents,
    initialPositions: positionsMap,
    detectedAt: new Date().toISOString(),
    severity: 'medium',
  };
}
