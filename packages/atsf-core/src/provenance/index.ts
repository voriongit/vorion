/**
 * Decision Provenance Service
 *
 * Creates and manages Decision Provenance Objects (DPOs) that provide
 * complete traceability for AI governance decisions.
 *
 * @packageDocumentation
 */

import { createLogger } from '../common/logger.js';
import type { ID, ControlAction } from '../common/types.js';
import type {
  DecisionProvenance,
  ProvenanceRequest,
  ProvenanceQuery,
  TriggerEvent,
  RuleConsidered,
  RuleApplied,
  CausalChain,
  CausalStep,
  ChainOutcome,
  LayerResult,
  EvidenceItem,
  CounterfactualRejected,
} from './types.js';

export * from './types.js';

const logger = createLogger({ component: 'provenance' });

/**
 * Builder for constructing Decision Provenance Objects incrementally
 */
export class ProvenanceBuilder {
  private provenance: Partial<DecisionProvenance>;
  private startTime: number;

  constructor(request: ProvenanceRequest) {
    this.startTime = Date.now();
    this.provenance = {
      decisionId: crypto.randomUUID(),
      triggerEvent: request.triggerEvent,
      entityId: request.entityId,
      entityTrustScore: request.entityTrustScore,
      entityTrustLevel: request.entityTrustLevel,
      intentId: request.intentId,
      intentGoal: request.intentGoal,
      rulesConsidered: [],
      rulesApplied: [],
      causalChainsEvaluated: [],
      layerResults: [],
      evidence: [],
      counterfactualsRejected: [],
      assumptions: [],
      invalidityConditions: [],
      engineVersion: '1.0.0',
    };
  }

  /**
   * Add a rule that was considered
   */
  addRuleConsidered(rule: RuleConsidered): this {
    this.provenance.rulesConsidered!.push(rule);
    return this;
  }

  /**
   * Add a rule that was applied
   */
  addRuleApplied(rule: RuleApplied): this {
    this.provenance.rulesApplied!.push(rule);
    return this;
  }

  /**
   * Add a causal chain that was evaluated
   */
  addCausalChain(chain: CausalChain): this {
    this.provenance.causalChainsEvaluated!.push(chain);
    return this;
  }

  /**
   * Set the dominant causal chain
   */
  setDominantChain(chain: CausalChain): this {
    this.provenance.dominantChain = chain;
    return this;
  }

  /**
   * Add a security layer result
   */
  addLayerResult(result: LayerResult): this {
    this.provenance.layerResults!.push(result);
    return this;
  }

  /**
   * Add evidence
   */
  addEvidence(evidence: EvidenceItem): this {
    this.provenance.evidence!.push(evidence);
    return this;
  }

  /**
   * Add a rejected counterfactual
   */
  addCounterfactualRejected(counterfactual: CounterfactualRejected): this {
    this.provenance.counterfactualsRejected!.push(counterfactual);
    return this;
  }

  /**
   * Add an assumption
   */
  addAssumption(assumption: string): this {
    this.provenance.assumptions!.push(assumption);
    return this;
  }

  /**
   * Add an invalidity condition
   */
  addInvalidityCondition(condition: string): this {
    this.provenance.invalidityConditions!.push(condition);
    return this;
  }

  /**
   * Set the final decision
   */
  setFinalDecision(
    action: ControlAction,
    explanation: string,
    confidence: number
  ): this {
    this.provenance.finalAction = action;
    this.provenance.finalExplanation = explanation;
    this.provenance.confidenceScore = confidence;
    return this;
  }

  /**
   * Build the final provenance record
   */
  async build(): Promise<DecisionProvenance> {
    const now = new Date().toISOString();
    const duration = Date.now() - this.startTime;

    const provenance: DecisionProvenance = {
      decisionId: this.provenance.decisionId!,
      triggerEvent: this.provenance.triggerEvent!,
      entityId: this.provenance.entityId!,
      entityTrustScore: this.provenance.entityTrustScore!,
      entityTrustLevel: this.provenance.entityTrustLevel!,
      intentId: this.provenance.intentId!,
      intentGoal: this.provenance.intentGoal!,
      rulesConsidered: this.provenance.rulesConsidered!,
      rulesApplied: this.provenance.rulesApplied!,
      causalChainsEvaluated: this.provenance.causalChainsEvaluated!,
      dominantChain: this.provenance.dominantChain!,
      layerResults: this.provenance.layerResults!,
      confidenceScore: this.provenance.confidenceScore ?? 0,
      counterfactualsRejected: this.provenance.counterfactualsRejected!,
      evidence: this.provenance.evidence!,
      assumptions: this.provenance.assumptions!,
      invalidityConditions: this.provenance.invalidityConditions!,
      finalAction: this.provenance.finalAction ?? 'deny',
      finalExplanation: this.provenance.finalExplanation ?? 'No explanation provided',
      totalDurationMs: duration,
      decidedAt: now,
      engineVersion: this.provenance.engineVersion!,
      provenanceHash: '', // Will be calculated
    };

    // Calculate hash for integrity
    provenance.provenanceHash = await calculateProvenanceHash(provenance);

    return provenance;
  }
}

/**
 * Service for managing Decision Provenance Objects
 */
export class ProvenanceService {
  private records: Map<ID, DecisionProvenance> = new Map();
  private byIntent: Map<ID, ID[]> = new Map(); // intentId -> decisionIds
  private byEntity: Map<ID, ID[]> = new Map(); // entityId -> decisionIds

  /**
   * Create a new provenance builder
   */
  createBuilder(request: ProvenanceRequest): ProvenanceBuilder {
    return new ProvenanceBuilder(request);
  }

  /**
   * Store a completed provenance record
   */
  async store(provenance: DecisionProvenance): Promise<void> {
    this.records.set(provenance.decisionId, provenance);

    // Index by intent
    const intentDecisions = this.byIntent.get(provenance.intentId) ?? [];
    intentDecisions.push(provenance.decisionId);
    this.byIntent.set(provenance.intentId, intentDecisions);

    // Index by entity
    const entityDecisions = this.byEntity.get(provenance.entityId) ?? [];
    entityDecisions.push(provenance.decisionId);
    this.byEntity.set(provenance.entityId, entityDecisions);

    logger.info(
      {
        decisionId: provenance.decisionId,
        intentId: provenance.intentId,
        entityId: provenance.entityId,
        action: provenance.finalAction,
        confidence: provenance.confidenceScore,
        rulesApplied: provenance.rulesApplied.length,
        chainsEvaluated: provenance.causalChainsEvaluated.length,
      },
      'Provenance record stored'
    );
  }

  /**
   * Get a provenance record by decision ID
   */
  async get(decisionId: ID): Promise<DecisionProvenance | undefined> {
    return this.records.get(decisionId);
  }

  /**
   * Get all provenance records for an intent
   */
  async getByIntent(intentId: ID): Promise<DecisionProvenance[]> {
    const decisionIds = this.byIntent.get(intentId) ?? [];
    return decisionIds
      .map((id) => this.records.get(id))
      .filter((p): p is DecisionProvenance => p !== undefined);
  }

  /**
   * Get all provenance records for an entity
   */
  async getByEntity(entityId: ID): Promise<DecisionProvenance[]> {
    const decisionIds = this.byEntity.get(entityId) ?? [];
    return decisionIds
      .map((id) => this.records.get(id))
      .filter((p): p is DecisionProvenance => p !== undefined);
  }

  /**
   * Query provenance records
   */
  async query(query: ProvenanceQuery): Promise<DecisionProvenance[]> {
    let results = Array.from(this.records.values());

    if (query.decisionId) {
      results = results.filter((p) => p.decisionId === query.decisionId);
    }

    if (query.entityId) {
      results = results.filter((p) => p.entityId === query.entityId);
    }

    if (query.intentId) {
      results = results.filter((p) => p.intentId === query.intentId);
    }

    if (query.finalAction) {
      results = results.filter((p) => p.finalAction === query.finalAction);
    }

    if (query.minConfidence !== undefined) {
      results = results.filter((p) => p.confidenceScore >= query.minConfidence!);
    }

    if (query.startDate) {
      results = results.filter((p) => p.decidedAt >= query.startDate!);
    }

    if (query.endDate) {
      results = results.filter((p) => p.decidedAt <= query.endDate!);
    }

    // Sort by decision time (newest first)
    results.sort((a, b) => b.decidedAt.localeCompare(a.decidedAt));

    // Apply pagination
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 100;
    return results.slice(offset, offset + limit);
  }

  /**
   * Verify a provenance record's integrity
   */
  async verify(decisionId: ID): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    const provenance = this.records.get(decisionId);
    if (!provenance) {
      return { valid: false, issues: ['Provenance record not found'] };
    }

    const issues: string[] = [];

    // Verify hash
    const expectedHash = await calculateProvenanceHash({
      ...provenance,
      provenanceHash: '',
    });

    if (provenance.provenanceHash !== expectedHash) {
      issues.push('Hash mismatch - record may have been tampered');
    }

    // Verify logical consistency
    if (provenance.rulesApplied.length === 0 && provenance.finalAction !== 'deny') {
      issues.push('Non-deny action with no rules applied');
    }

    if (!provenance.dominantChain && provenance.causalChainsEvaluated.length > 0) {
      issues.push('Causal chains evaluated but no dominant chain selected');
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Get decision path - the full reasoning trace
   */
  async getDecisionPath(decisionId: ID): Promise<{
    trigger: TriggerEvent;
    layers: LayerResult[];
    rulesApplied: RuleApplied[];
    dominantChain: CausalChain;
    finalAction: ControlAction;
    explanation: string;
  } | null> {
    const provenance = this.records.get(decisionId);
    if (!provenance) return null;

    return {
      trigger: provenance.triggerEvent,
      layers: provenance.layerResults,
      rulesApplied: provenance.rulesApplied,
      dominantChain: provenance.dominantChain,
      finalAction: provenance.finalAction,
      explanation: provenance.finalExplanation,
    };
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalRecords: number;
    byAction: Record<ControlAction, number>;
    averageConfidence: number;
    averageDurationMs: number;
  } {
    const records = Array.from(this.records.values());
    const byAction: Record<ControlAction, number> = {
      allow: 0,
      deny: 0,
      escalate: 0,
      limit: 0,
      monitor: 0,
      terminate: 0,
    };

    let totalConfidence = 0;
    let totalDuration = 0;

    for (const record of records) {
      byAction[record.finalAction]++;
      totalConfidence += record.confidenceScore;
      totalDuration += record.totalDurationMs;
    }

    return {
      totalRecords: records.length,
      byAction,
      averageConfidence: records.length > 0 ? totalConfidence / records.length : 0,
      averageDurationMs: records.length > 0 ? totalDuration / records.length : 0,
    };
  }
}

/**
 * Calculate SHA-256 hash for a provenance record
 */
async function calculateProvenanceHash(
  provenance: Omit<DecisionProvenance, 'provenanceHash'> & { provenanceHash?: string }
): Promise<string> {
  const { provenanceHash: _, ...dataToHash } = provenance;
  const data = JSON.stringify(dataToHash);
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create a new provenance service instance
 */
export function createProvenanceService(): ProvenanceService {
  return new ProvenanceService();
}

/**
 * Helper to create a causal step
 */
export function createCausalStep(
  stepNumber: number,
  input: string,
  operation: string,
  output: string,
  confidence: number,
  evidence: EvidenceItem[] = []
): CausalStep {
  return {
    stepNumber,
    input,
    operation,
    output,
    evidence,
    confidence,
  };
}

/**
 * Helper to create a causal chain
 */
export function createCausalChain(
  trigger: TriggerEvent,
  steps: CausalStep[],
  outcome: ChainOutcome,
  confidence: number
): CausalChain {
  return {
    chainId: crypto.randomUUID(),
    trigger,
    steps,
    outcome,
    confidence,
  };
}
