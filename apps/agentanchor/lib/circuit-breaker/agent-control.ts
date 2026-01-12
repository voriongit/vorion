/**
 * Agent Control - Pause/Resume Functionality
 * Story 16-1: Per-agent pause/resume with reason tracking
 *
 * Enables immediate suspension of individual agents with full audit trail.
 */

// ============================================================================
// Types
// ============================================================================

export type AgentState = 'active' | 'paused' | 'suspended' | 'terminated';

export type PauseReason =
  | 'manual_trainer'        // Trainer paused manually
  | 'manual_admin'          // Admin paused
  | 'council_decision'      // Council voted to pause
  | 'trust_threshold'       // Trust score dropped below threshold
  | 'anomaly_detected'      // Observer flagged behavior
  | 'security_incident'     // Security alert
  | 'cascade_halt'          // Halted due to dependency
  | 'maintenance'           // Scheduled maintenance
  | 'rate_limit_exceeded'   // Too many requests
  | 'resource_exhaustion'   // Resource limits hit
  | 'external_request';     // External platform request

export interface PauseRecord {
  id: string;
  agentId: string;
  previousState: AgentState;
  newState: AgentState;
  reason: PauseReason;
  initiatedBy: string;
  initiatorType: 'trainer' | 'admin' | 'council' | 'system' | 'cascade';
  notes?: string;

  // Timing
  pausedAt: Date;
  resumedAt?: Date;
  autoResumeAt?: Date;

  // Audit
  truthChainHash?: string;
  relatedIncidentId?: string;
}

export interface AgentControlState {
  agentId: string;
  currentState: AgentState;
  lastStateChange: Date;
  pauseHistory: PauseRecord[];

  // Cascade info
  dependentAgents: string[];
  dependsOn: string[];

  // Auto-resume
  autoResumeScheduled?: Date;
  autoResumeConditions?: AutoResumeCondition[];
}

export interface AutoResumeCondition {
  type: 'time_elapsed' | 'trust_restored' | 'manual_approval' | 'incident_resolved';
  threshold?: number;
  description: string;
}

// ============================================================================
// In-Memory State (Production: Redis/Database)
// ============================================================================

const agentStates = new Map<string, AgentControlState>();

// ============================================================================
// Agent Control Functions
// ============================================================================

/**
 * Initialize agent control state
 */
export function initializeAgentState(
  agentId: string,
  dependentAgents: string[] = [],
  dependsOn: string[] = []
): AgentControlState {
  const state: AgentControlState = {
    agentId,
    currentState: 'active',
    lastStateChange: new Date(),
    pauseHistory: [],
    dependentAgents,
    dependsOn,
  };
  agentStates.set(agentId, state);
  return state;
}

/**
 * Get current agent control state
 */
export function getAgentState(agentId: string): AgentControlState | null {
  return agentStates.get(agentId) || null;
}

/**
 * Pause an agent immediately
 */
export async function pauseAgent(
  agentId: string,
  reason: PauseReason,
  initiatedBy: string,
  initiatorType: PauseRecord['initiatorType'],
  options?: {
    notes?: string;
    autoResumeAt?: Date;
    autoResumeConditions?: AutoResumeCondition[];
    cascadeToDependent?: boolean;
    relatedIncidentId?: string;
  }
): Promise<{
  success: boolean;
  pauseRecord: PauseRecord;
  cascadedAgents?: string[];
  error?: string;
}> {
  let state = agentStates.get(agentId);

  if (!state) {
    state = initializeAgentState(agentId);
  }

  if (state.currentState === 'paused' || state.currentState === 'suspended') {
    return {
      success: false,
      pauseRecord: state.pauseHistory[state.pauseHistory.length - 1],
      error: `Agent is already ${state.currentState}`,
    };
  }

  const pauseRecord: PauseRecord = {
    id: `pause-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    agentId,
    previousState: state.currentState,
    newState: reason === 'security_incident' ? 'suspended' : 'paused',
    reason,
    initiatedBy,
    initiatorType,
    notes: options?.notes,
    pausedAt: new Date(),
    autoResumeAt: options?.autoResumeAt,
    relatedIncidentId: options?.relatedIncidentId,
  };

  state.currentState = pauseRecord.newState;
  state.lastStateChange = new Date();
  state.pauseHistory.push(pauseRecord);
  state.autoResumeScheduled = options?.autoResumeAt;
  state.autoResumeConditions = options?.autoResumeConditions;

  agentStates.set(agentId, state);

  let cascadedAgents: string[] = [];
  if (options?.cascadeToDependent && state.dependentAgents.length > 0) {
    cascadedAgents = await cascadePause(
      agentId,
      state.dependentAgents,
      pauseRecord.id,
      initiatedBy
    );
  }

  return {
    success: true,
    pauseRecord,
    cascadedAgents: cascadedAgents.length > 0 ? cascadedAgents : undefined,
  };
}

/**
 * Resume a paused agent
 */
export async function resumeAgent(
  agentId: string,
  resumedBy: string,
  resumeNotes?: string
): Promise<{
  success: boolean;
  previousState?: AgentState;
  error?: string;
}> {
  const state = agentStates.get(agentId);

  if (!state) {
    return { success: false, error: 'Agent not found in control system' };
  }

  if (state.currentState === 'active') {
    return { success: false, error: 'Agent is already active' };
  }

  if (state.currentState === 'terminated') {
    return { success: false, error: 'Cannot resume terminated agent' };
  }

  const lastPause = state.pauseHistory[state.pauseHistory.length - 1];
  if (lastPause && !lastPause.resumedAt) {
    lastPause.resumedAt = new Date();
    if (resumeNotes) {
      lastPause.notes = (lastPause.notes || '') + ` | Resume: ${resumeNotes}`;
    }
  }

  const previousState = state.currentState;
  state.currentState = 'active';
  state.lastStateChange = new Date();
  state.autoResumeScheduled = undefined;
  state.autoResumeConditions = undefined;

  agentStates.set(agentId, state);

  return { success: true, previousState };
}

/**
 * Terminate an agent permanently
 */
export async function terminateAgent(
  agentId: string,
  reason: string,
  terminatedBy: string,
  terminatorType: PauseRecord['initiatorType']
): Promise<{
  success: boolean;
  terminationRecord: PauseRecord;
}> {
  let state = agentStates.get(agentId);

  if (!state) {
    state = initializeAgentState(agentId);
  }

  const terminationRecord: PauseRecord = {
    id: `term-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    agentId,
    previousState: state.currentState,
    newState: 'terminated',
    reason: 'security_incident',
    initiatedBy: terminatedBy,
    initiatorType: terminatorType,
    notes: `TERMINATION: ${reason}`,
    pausedAt: new Date(),
  };

  state.currentState = 'terminated';
  state.lastStateChange = new Date();
  state.pauseHistory.push(terminationRecord);

  agentStates.set(agentId, state);

  return { success: true, terminationRecord };
}

/**
 * Cascade pause to dependent agents
 */
async function cascadePause(
  sourceAgentId: string,
  dependentAgents: string[],
  sourcePauseId: string,
  initiatedBy: string
): Promise<string[]> {
  const paused: string[] = [];

  for (const depAgentId of dependentAgents) {
    const result = await pauseAgent(
      depAgentId,
      'cascade_halt',
      initiatedBy,
      'cascade',
      {
        notes: `Cascade halt from ${sourceAgentId} (${sourcePauseId})`,
        cascadeToDependent: true,
        relatedIncidentId: sourcePauseId,
      }
    );

    if (result.success) {
      paused.push(depAgentId);
      if (result.cascadedAgents) {
        paused.push(...result.cascadedAgents);
      }
    }
  }

  return paused;
}

/**
 * Check if an agent can execute (is active)
 */
export function canExecute(agentId: string): {
  allowed: boolean;
  state: AgentState;
  reason?: string;
} {
  const state = agentStates.get(agentId);

  if (!state) {
    return { allowed: true, state: 'active' };
  }

  if (state.currentState === 'active') {
    return { allowed: true, state: 'active' };
  }

  const lastPause = state.pauseHistory[state.pauseHistory.length - 1];

  return {
    allowed: false,
    state: state.currentState,
    reason: lastPause?.reason || 'Unknown',
  };
}

/**
 * Get pause history for an agent
 */
export function getPauseHistory(agentId: string): PauseRecord[] {
  const state = agentStates.get(agentId);
  return state?.pauseHistory || [];
}

/**
 * Register agent dependencies
 */
export function registerDependencies(
  agentId: string,
  dependsOn: string[],
  dependentAgents: string[]
): void {
  let state = agentStates.get(agentId);

  if (!state) {
    state = initializeAgentState(agentId, dependentAgents, dependsOn);
  } else {
    state.dependsOn = dependsOn;
    state.dependentAgents = dependentAgents;
    agentStates.set(agentId, state);
  }
}

/**
 * Get all paused agents
 */
export function getPausedAgents(): AgentControlState[] {
  const paused: AgentControlState[] = [];

  for (const [_, state] of agentStates) {
    if (state.currentState === 'paused' || state.currentState === 'suspended') {
      paused.push(state);
    }
  }

  return paused;
}

/**
 * Clear state (for testing)
 */
export function clearAgentStates(): void {
  agentStates.clear();
}
