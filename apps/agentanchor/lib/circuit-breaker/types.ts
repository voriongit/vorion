/**
 * Circuit Breaker Types
 *
 * Story 16-1: Agent Pause/Resume
 * Council Priority #3 (39 points)
 */

// =============================================================================
// Pause Reasons
// =============================================================================

export type PauseReason =
  | 'investigation'     // Under investigation for policy violation
  | 'maintenance'       // Trainer-requested maintenance pause
  | 'consumer_request'  // Consumer reported issue
  | 'circuit_breaker'   // Automatic circuit breaker triggered
  | 'cascade_halt'      // Paused due to dependent agent pause
  | 'emergency_stop'    // Global kill switch activation
  | 'other';            // Other reason (requires notes)

export const PAUSE_REASON_LABELS: Record<PauseReason, string> = {
  investigation: 'Under Investigation',
  maintenance: 'Scheduled Maintenance',
  consumer_request: 'Consumer Request',
  circuit_breaker: 'Circuit Breaker',
  cascade_halt: 'Cascade Halt',
  emergency_stop: 'Emergency Stop',
  other: 'Other',
};

// =============================================================================
// Circuit Breaker Event Types
// =============================================================================

export type CircuitBreakerEventType =
  | 'pause'
  | 'resume'
  | 'cascade_halt'
  | 'emergency_stop'
  | 'auto_resume';

// =============================================================================
// Interfaces
// =============================================================================

export interface AgentPauseState {
  agentId: string;
  isPaused: boolean;
  pauseReason?: PauseReason;
  pausedAt?: Date;
  pausedBy?: string;
  pauseNotes?: string;
  pauseExpiresAt?: Date;
}

export interface CircuitBreakerEvent {
  id: string;
  agentId: string;
  eventType: CircuitBreakerEventType;
  reason?: PauseReason;
  notes?: string;
  triggeredBy?: string;
  triggeredBySystem: boolean;
  parentAgentId?: string;
  truthChainHash?: string;
  createdAt: Date;
}

export interface PauseAgentRequest {
  agentId: string;
  reason: PauseReason;
  notes?: string;
  expiresAt?: Date;
  cascadeToDependent?: boolean;
}

export interface ResumeAgentRequest {
  agentId: string;
  notes?: string;
}

export interface PauseAgentResult {
  success: boolean;
  agentId: string;
  event?: CircuitBreakerEvent;
  cascadedAgents?: string[];
  error?: string;
}

export interface ResumeAgentResult {
  success: boolean;
  agentId: string;
  event?: CircuitBreakerEvent;
  error?: string;
}

// =============================================================================
// Global Kill Switch
// =============================================================================

export type KillSwitchScope =
  | 'all'                           // All agents
  | `tier:${string}`                // Specific trust tier
  | `specialization:${string}`;     // Specific specialization

export interface KillSwitchState {
  id: string;
  isActive: boolean;
  activatedAt?: Date;
  activatedBy?: string;
  reason?: string;
  scope: KillSwitchScope;
  deactivatedAt?: Date;
  deactivatedBy?: string;
}

export interface ActivateKillSwitchRequest {
  reason: string;
  scope?: KillSwitchScope;
}

export interface DeactivateKillSwitchRequest {
  notes?: string;
}

// =============================================================================
// Agent Dependencies
// =============================================================================

export interface AgentDependency {
  id: string;
  agentId: string;
  dependsOnAgentId: string;
  dependencyType: string;
  createdAt: Date;
}
