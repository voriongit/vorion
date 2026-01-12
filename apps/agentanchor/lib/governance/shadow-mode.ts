/**
 * Shadow Mode - Parallel execution for agent training
 *
 * Shadow agents run alongside certified agents, processing real data
 * but with outputs discarded and compared for quality assurance.
 * This enables "training in production" without blocking or risk.
 */

import {
  AgentRuntimeContext,
  AgentStatus,
  TrustContext,
  AuditEvent,
} from './types';

// =============================================================================
// Shadow Mode Types
// =============================================================================

export interface ShadowExecution {
  id: string;
  shadowAgentId: string;
  certifiedAgentId: string;
  input: string;
  shadowOutput: string;
  certifiedOutput: string;
  matchScore: number; // 0-100 similarity
  timestamp: Date;
  discarded: boolean; // Shadow output was not sent to user
}

export interface ShadowMetrics {
  agentId: string;
  totalExecutions: number;
  matchRate: number; // Percentage matching certified agent
  averageMatchScore: number;
  readyForGraduation: boolean;
  graduationThreshold: number;
  executionsNeeded: number;
}

export interface ShadowConfig {
  graduationThreshold: number; // Match rate needed (default 95%)
  minimumExecutions: number;   // Min runs before graduation (default 100)
  comparisonWindow: number;    // Days to consider (default 7)
  autoGraduate: boolean;       // Auto-promote when ready
}

const DEFAULT_SHADOW_CONFIG: ShadowConfig = {
  graduationThreshold: 95,
  minimumExecutions: 100,
  comparisonWindow: 7,
  autoGraduate: false, // Require manual review by default
};

// =============================================================================
// Shadow Mode Manager
// =============================================================================

export class ShadowModeManager {
  private executions: Map<string, ShadowExecution[]> = new Map();
  private config: ShadowConfig;

  constructor(config: Partial<ShadowConfig> = {}) {
    this.config = { ...DEFAULT_SHADOW_CONFIG, ...config };
  }

  /**
   * Check if an agent should run in shadow mode
   */
  shouldRunShadow(context: AgentRuntimeContext): boolean {
    return context.agentStatus === 'training' || context.agentStatus === 'examination';
  }

  /**
   * Get the certified agent to compare against
   * Returns null if no certified agent available for comparison
   */
  async getCertifiedAgent(
    shadowAgentId: string,
    specialization: string
  ): Promise<string | null> {
    // In production, this would query the database for a certified agent
    // with matching specialization
    // For now, return null to indicate shadow-only mode
    return null;
  }

  /**
   * Record a shadow execution for comparison
   */
  recordExecution(execution: ShadowExecution): void {
    const existing = this.executions.get(execution.shadowAgentId) || [];
    existing.push(execution);

    // Keep only executions within the comparison window
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.config.comparisonWindow);

    const filtered = existing.filter(e => e.timestamp >= cutoff);
    this.executions.set(execution.shadowAgentId, filtered);
  }

  /**
   * Calculate similarity between shadow and certified outputs
   */
  calculateMatchScore(shadowOutput: string, certifiedOutput: string): number {
    if (shadowOutput === certifiedOutput) return 100;
    if (!shadowOutput || !certifiedOutput) return 0;

    // Simple Jaccard similarity on words
    const shadowWords = new Set(shadowOutput.toLowerCase().split(/\s+/));
    const certifiedWords = new Set(certifiedOutput.toLowerCase().split(/\s+/));

    const intersection = new Set([...shadowWords].filter(w => certifiedWords.has(w)));
    const union = new Set([...shadowWords, ...certifiedWords]);

    if (union.size === 0) return 100;
    return Math.round((intersection.size / union.size) * 100);
  }

  /**
   * Get metrics for a shadow agent
   */
  getMetrics(agentId: string): ShadowMetrics {
    const executions = this.executions.get(agentId) || [];
    const totalExecutions = executions.length;

    if (totalExecutions === 0) {
      return {
        agentId,
        totalExecutions: 0,
        matchRate: 0,
        averageMatchScore: 0,
        readyForGraduation: false,
        graduationThreshold: this.config.graduationThreshold,
        executionsNeeded: this.config.minimumExecutions,
      };
    }

    const matchingExecutions = executions.filter(
      e => e.matchScore >= this.config.graduationThreshold
    );
    const matchRate = (matchingExecutions.length / totalExecutions) * 100;
    const averageMatchScore =
      executions.reduce((sum, e) => sum + e.matchScore, 0) / totalExecutions;

    const readyForGraduation =
      totalExecutions >= this.config.minimumExecutions &&
      matchRate >= this.config.graduationThreshold;

    return {
      agentId,
      totalExecutions,
      matchRate: Math.round(matchRate * 100) / 100,
      averageMatchScore: Math.round(averageMatchScore * 100) / 100,
      readyForGraduation,
      graduationThreshold: this.config.graduationThreshold,
      executionsNeeded: Math.max(0, this.config.minimumExecutions - totalExecutions),
    };
  }

  /**
   * Check if agent is ready for graduation
   */
  isReadyForGraduation(agentId: string): boolean {
    return this.getMetrics(agentId).readyForGraduation;
  }

  /**
   * Graduate an agent from shadow to examination/active
   */
  async graduateAgent(agentId: string): Promise<{
    success: boolean;
    newStatus: AgentStatus;
    reason: string;
  }> {
    const metrics = this.getMetrics(agentId);

    if (!metrics.readyForGraduation) {
      return {
        success: false,
        newStatus: 'training',
        reason: `Not ready: ${metrics.matchRate}% match rate (need ${this.config.graduationThreshold}%), ${metrics.executionsNeeded} more executions needed`,
      };
    }

    // Clear execution history after graduation
    this.executions.delete(agentId);

    return {
      success: true,
      newStatus: 'examination', // Move to council examination
      reason: `Graduated with ${metrics.matchRate}% match rate over ${metrics.totalExecutions} executions`,
    };
  }
}

// =============================================================================
// Shadow Execution Flow
// =============================================================================

export interface ShadowRunResult {
  shadowOutput: string;
  certifiedOutput: string | null;
  matchScore: number | null;
  shouldDiscard: boolean;
  useOutput: 'shadow' | 'certified' | 'none';
}

/**
 * Execute a shadow comparison run
 *
 * This runs the shadow agent and optionally a certified agent in parallel,
 * compares their outputs, and decides which (if any) to return to the user.
 */
export async function executeShadowRun(
  manager: ShadowModeManager,
  shadowContext: AgentRuntimeContext,
  input: string,
  shadowExecutor: (ctx: AgentRuntimeContext, input: string) => Promise<string>,
  certifiedExecutor?: (agentId: string, input: string) => Promise<string>
): Promise<ShadowRunResult> {
  const startTime = Date.now();

  // Always run the shadow agent
  const shadowOutput = await shadowExecutor(shadowContext, input);

  // Try to get a certified agent for comparison
  const certifiedAgentId = await manager.getCertifiedAgent(
    shadowContext.agentId,
    shadowContext.persona.specialization
  );

  let certifiedOutput: string | null = null;
  let matchScore: number | null = null;

  // If we have a certified agent and executor, run comparison
  if (certifiedAgentId && certifiedExecutor) {
    certifiedOutput = await certifiedExecutor(certifiedAgentId, input);
    matchScore = manager.calculateMatchScore(shadowOutput, certifiedOutput);

    // Record the execution for metrics
    manager.recordExecution({
      id: `shadow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      shadowAgentId: shadowContext.agentId,
      certifiedAgentId,
      input,
      shadowOutput,
      certifiedOutput,
      matchScore,
      timestamp: new Date(),
      discarded: true, // Shadow output is always discarded in comparison mode
    });
  }

  // Decide which output to use
  // - If shadow agent is in 'examination' status and no certified agent, use shadow output
  // - If in 'training' with certified comparison, always use certified
  // - If in 'training' without certified, discard (shadow-only training)

  let useOutput: 'shadow' | 'certified' | 'none';
  let shouldDiscard: boolean;

  if (shadowContext.agentStatus === 'examination') {
    // Examination mode: shadow output goes to user for council review
    useOutput = 'shadow';
    shouldDiscard = false;
  } else if (certifiedOutput) {
    // Training with comparison: use certified output
    useOutput = 'certified';
    shouldDiscard = true; // Shadow output discarded
  } else {
    // Training without comparison: don't send any output
    useOutput = 'none';
    shouldDiscard = true;
  }

  return {
    shadowOutput,
    certifiedOutput,
    matchScore,
    shouldDiscard,
    useOutput,
  };
}

// =============================================================================
// Status Transition Helpers
// =============================================================================

export const SHADOW_STATUS_FLOW: Record<AgentStatus, AgentStatus | null> = {
  draft: 'training',
  training: 'examination', // Via shadow graduation
  examination: 'active',   // Via council approval
  active: null,            // Terminal (can suspend/retire)
  suspended: 'active',     // Can be reinstated
  retired: null,           // Terminal
};

export function getNextStatus(current: AgentStatus): AgentStatus | null {
  return SHADOW_STATUS_FLOW[current];
}

export function canEnterShadowMode(status: AgentStatus): boolean {
  return status === 'draft' || status === 'training';
}

// =============================================================================
// Singleton Manager Instance
// =============================================================================

let shadowManager: ShadowModeManager | null = null;

export function getShadowManager(config?: Partial<ShadowConfig>): ShadowModeManager {
  if (!shadowManager) {
    shadowManager = new ShadowModeManager(config);
  }
  return shadowManager;
}

export function resetShadowManager(): void {
  shadowManager = null;
}
