/**
 * Global Kill Switch
 * Story 16-2: Platform-wide emergency stop (admin only)
 *
 * Enables immediate halt of ALL agent activity across the platform.
 * Only accessible by platform administrators with proper authorization.
 */

import { pauseAgent, type PauseReason, type AgentState } from './agent-control';

// ============================================================================
// Types
// ============================================================================

export type KillSwitchLevel =
  | 'partial'     // Pause specific categories
  | 'platform'    // Pause all non-critical agents
  | 'critical'    // Pause ALL agents including system
  | 'lockdown';   // Full platform lockdown, no new actions

export type KillSwitchTrigger =
  | 'manual_admin'
  | 'security_breach'
  | 'anomaly_cascade'
  | 'external_threat'
  | 'regulatory_order'
  | 'infrastructure_failure'
  | 'automated_threshold';

export interface KillSwitchEvent {
  id: string;
  level: KillSwitchLevel;
  trigger: KillSwitchTrigger;
  activatedBy: string;
  activatedAt: Date;
  deactivatedAt?: Date;
  deactivatedBy?: string;

  // Scope
  affectedCategories?: string[];
  exemptAgents?: string[];

  // Impact
  agentsPaused: number;
  agentsExempt: number;

  // Audit
  reason: string;
  notes?: string;
  truthChainHash?: string;
  incidentId?: string;

  // Authorization
  authorizationCode?: string;
  secondaryApprover?: string;
}

export interface KillSwitchState {
  active: boolean;
  level?: KillSwitchLevel;
  currentEvent?: KillSwitchEvent;
  history: KillSwitchEvent[];

  // Quick status
  lastActivation?: Date;
  totalActivations: number;
  avgDurationMs?: number;
}

// ============================================================================
// Global State
// ============================================================================

let globalKillSwitchState: KillSwitchState = {
  active: false,
  history: [],
  totalActivations: 0,
};

// Agent registry for kill switch (populated by agent registration)
const registeredAgents = new Map<string, {
  category: string;
  critical: boolean;
  exemptFromKillSwitch: boolean;
}>();

// ============================================================================
// Kill Switch Functions
// ============================================================================

/**
 * Check if kill switch is active
 */
export function isKillSwitchActive(): boolean {
  return globalKillSwitchState.active;
}

/**
 * Get current kill switch state
 */
export function getKillSwitchState(): KillSwitchState {
  return { ...globalKillSwitchState };
}

/**
 * Register an agent with the kill switch system
 */
export function registerAgentForKillSwitch(
  agentId: string,
  category: string,
  options?: {
    critical?: boolean;
    exemptFromKillSwitch?: boolean;
  }
): void {
  registeredAgents.set(agentId, {
    category,
    critical: options?.critical ?? false,
    exemptFromKillSwitch: options?.exemptFromKillSwitch ?? false,
  });
}

/**
 * Activate the global kill switch
 */
export async function activateKillSwitch(
  level: KillSwitchLevel,
  trigger: KillSwitchTrigger,
  activatedBy: string,
  options: {
    reason: string;
    notes?: string;
    affectedCategories?: string[];
    exemptAgents?: string[];
    authorizationCode?: string;
    secondaryApprover?: string;
    incidentId?: string;
  }
): Promise<{
  success: boolean;
  event?: KillSwitchEvent;
  agentsPaused: string[];
  agentsExempt: string[];
  error?: string;
}> {
  // Validate authorization for higher levels
  if (level === 'critical' || level === 'lockdown') {
    if (!options.authorizationCode) {
      return {
        success: false,
        agentsPaused: [],
        agentsExempt: [],
        error: 'Authorization code required for critical/lockdown level',
      };
    }
    if (level === 'lockdown' && !options.secondaryApprover) {
      return {
        success: false,
        agentsPaused: [],
        agentsExempt: [],
        error: 'Secondary approver required for lockdown level',
      };
    }
  }

  // Check if already active
  if (globalKillSwitchState.active) {
    return {
      success: false,
      agentsPaused: [],
      agentsExempt: [],
      error: `Kill switch already active at level: ${globalKillSwitchState.level}`,
    };
  }

  const agentsToPause: string[] = [];
  const agentsToExempt: string[] = [];

  // Determine which agents to pause based on level
  for (const [agentId, config] of registeredAgents) {
    // Check exemptions
    if (options.exemptAgents?.includes(agentId)) {
      agentsToExempt.push(agentId);
      continue;
    }

    if (config.exemptFromKillSwitch && level !== 'lockdown') {
      agentsToExempt.push(agentId);
      continue;
    }

    // Level-specific logic
    switch (level) {
      case 'partial':
        if (options.affectedCategories?.includes(config.category)) {
          agentsToPause.push(agentId);
        } else {
          agentsToExempt.push(agentId);
        }
        break;

      case 'platform':
        if (!config.critical) {
          agentsToPause.push(agentId);
        } else {
          agentsToExempt.push(agentId);
        }
        break;

      case 'critical':
      case 'lockdown':
        agentsToPause.push(agentId);
        break;
    }
  }

  // Execute pause on all targeted agents
  const pauseReason: PauseReason = 'security_incident';
  for (const agentId of agentsToPause) {
    await pauseAgent(
      agentId,
      pauseReason,
      activatedBy,
      'admin',
      {
        notes: `KILL SWITCH [${level}]: ${options.reason}`,
        relatedIncidentId: options.incidentId,
      }
    );
  }

  // Create event record
  const event: KillSwitchEvent = {
    id: `ks-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    level,
    trigger,
    activatedBy,
    activatedAt: new Date(),
    affectedCategories: options.affectedCategories,
    exemptAgents: agentsToExempt,
    agentsPaused: agentsToPause.length,
    agentsExempt: agentsToExempt.length,
    reason: options.reason,
    notes: options.notes,
    authorizationCode: options.authorizationCode,
    secondaryApprover: options.secondaryApprover,
    incidentId: options.incidentId,
  };

  // Update global state
  globalKillSwitchState = {
    active: true,
    level,
    currentEvent: event,
    history: [...globalKillSwitchState.history, event],
    lastActivation: new Date(),
    totalActivations: globalKillSwitchState.totalActivations + 1,
  };

  return {
    success: true,
    event,
    agentsPaused: agentsToPause,
    agentsExempt: agentsToExempt,
  };
}

/**
 * Deactivate the global kill switch
 */
export async function deactivateKillSwitch(
  deactivatedBy: string,
  options?: {
    notes?: string;
    authorizationCode?: string;
  }
): Promise<{
  success: boolean;
  event?: KillSwitchEvent;
  durationMs?: number;
  error?: string;
}> {
  if (!globalKillSwitchState.active || !globalKillSwitchState.currentEvent) {
    return {
      success: false,
      error: 'Kill switch is not active',
    };
  }

  const event = globalKillSwitchState.currentEvent;

  // Require authorization for critical/lockdown deactivation
  if (event.level === 'critical' || event.level === 'lockdown') {
    if (!options?.authorizationCode) {
      return {
        success: false,
        error: 'Authorization code required to deactivate critical/lockdown level',
      };
    }
  }

  // Update event
  event.deactivatedAt = new Date();
  event.deactivatedBy = deactivatedBy;
  if (options?.notes) {
    event.notes = (event.notes || '') + ` | Deactivation: ${options.notes}`;
  }

  const durationMs = event.deactivatedAt.getTime() - event.activatedAt.getTime();

  // Calculate average duration
  const completedEvents = globalKillSwitchState.history.filter(e => e.deactivatedAt);
  const totalDuration = completedEvents.reduce((sum, e) => {
    return sum + (e.deactivatedAt!.getTime() - e.activatedAt.getTime());
  }, 0);
  const avgDuration = completedEvents.length > 0
    ? totalDuration / completedEvents.length
    : durationMs;

  // Update global state
  globalKillSwitchState = {
    active: false,
    level: undefined,
    currentEvent: undefined,
    history: globalKillSwitchState.history,
    lastActivation: globalKillSwitchState.lastActivation,
    totalActivations: globalKillSwitchState.totalActivations,
    avgDurationMs: avgDuration,
  };

  // Note: Agents must be manually resumed or auto-resume after kill switch deactivation

  return {
    success: true,
    event,
    durationMs,
  };
}

/**
 * Check if an agent should be blocked by kill switch
 */
export function isBlockedByKillSwitch(agentId: string): {
  blocked: boolean;
  level?: KillSwitchLevel;
  reason?: string;
} {
  if (!globalKillSwitchState.active) {
    return { blocked: false };
  }

  const config = registeredAgents.get(agentId);
  const event = globalKillSwitchState.currentEvent!;

  // Check if explicitly exempt
  if (event.exemptAgents?.includes(agentId)) {
    return { blocked: false };
  }

  // Check category exemption for partial kill switch
  if (event.level === 'partial' && event.affectedCategories) {
    if (!config || !event.affectedCategories.includes(config.category)) {
      return { blocked: false };
    }
  }

  // Check critical agent exemption for platform level
  if (event.level === 'platform' && config?.critical) {
    return { blocked: false };
  }

  // Otherwise, blocked
  return {
    blocked: true,
    level: event.level,
    reason: event.reason,
  };
}

/**
 * Get kill switch history
 */
export function getKillSwitchHistory(): KillSwitchEvent[] {
  return [...globalKillSwitchState.history];
}

/**
 * Reset kill switch state (for testing)
 */
export function resetKillSwitchState(): void {
  globalKillSwitchState = {
    active: false,
    history: [],
    totalActivations: 0,
  };
  registeredAgents.clear();
}
