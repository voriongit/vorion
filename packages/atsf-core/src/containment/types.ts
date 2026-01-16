/**
 * Progressive Containment Types
 *
 * Replaces binary kill switch with graded containment levels,
 * allowing proportional response to detected issues.
 *
 * @packageDocumentation
 */

import type { ID, Timestamp } from '../common/types.js';

/**
 * Containment levels from full autonomy to complete halt
 */
export type ContainmentLevel =
  | 'full_autonomy'    // Level 0: Normal operation, no restrictions
  | 'monitored'        // Level 1: Enhanced logging and monitoring
  | 'tool_restricted'  // Level 2: Certain tools/capabilities disabled
  | 'human_in_loop'    // Level 3: Human approval required for actions
  | 'simulation_only'  // Level 4: Actions simulated but not executed
  | 'read_only'        // Level 5: Can observe but not act
  | 'halted';          // Level 6: Complete shutdown

/**
 * Numeric values for containment levels (for comparisons)
 */
export const ContainmentLevelValue: Record<ContainmentLevel, number> = {
  full_autonomy: 0,
  monitored: 1,
  tool_restricted: 2,
  human_in_loop: 3,
  simulation_only: 4,
  read_only: 5,
  halted: 6,
};

/**
 * Reason for containment
 */
export type ContainmentReason =
  | 'trust_violation'       // Trust score dropped below threshold
  | 'capability_abuse'      // Capability used inappropriately
  | 'policy_violation'      // Policy rule triggered
  | 'anomaly_detected'      // Unusual behavior pattern
  | 'external_threat'       // External security threat detected
  | 'resource_exhaustion'   // Resource limits exceeded
  | 'error_cascade'         // Multiple errors in succession
  | 'manual_override'       // Human-initiated containment
  | 'scheduled'             // Scheduled maintenance/audit
  | 'precautionary';        // Preventive containment

/**
 * Current containment state for an entity
 */
export interface ContainmentState {
  /** Entity this state applies to */
  entityId: ID;
  /** Current containment level */
  level: ContainmentLevel;
  /** Reason for current level */
  reason: ContainmentReason;
  /** Detailed explanation */
  explanation: string;
  /** Specific restrictions in effect */
  restrictions: ContainmentRestriction[];
  /** When containment was applied */
  appliedAt: Timestamp;
  /** When containment expires (if temporary) */
  expiresAt?: Timestamp;
  /** Who/what initiated containment */
  initiator: ContainmentInitiator;
  /** History of level changes */
  history: ContainmentHistoryEntry[];
  /** Conditions for automatic de-escalation */
  deescalationConditions: DeescalationCondition[];
  /** Current escalation path if containment worsens */
  escalationPath: EscalationStep[];
}

/**
 * A specific restriction applied during containment
 */
export interface ContainmentRestriction {
  /** Restriction type */
  type: RestrictionType;
  /** What is restricted */
  target: string;
  /** Severity of restriction */
  severity: 'soft' | 'hard';
  /** Can be bypassed with approval */
  bypassable: boolean;
  /** Message shown when restriction is hit */
  message: string;
}

/**
 * Types of restrictions that can be applied
 */
export type RestrictionType =
  | 'capability_blocked'    // Specific capability disabled
  | 'tool_disabled'         // Tool cannot be used
  | 'rate_limited'          // Action rate restricted
  | 'scope_limited'         // Scope of actions limited
  | 'output_filtered'       // Outputs reviewed/filtered
  | 'input_validated'       // Extra input validation
  | 'approval_required'     // Human approval needed
  | 'logging_enhanced'      // All actions logged
  | 'network_restricted'    // Network access limited
  | 'data_access_limited';  // Data access restricted

/**
 * Who/what initiated the containment
 */
export interface ContainmentInitiator {
  type: 'system' | 'human' | 'agent' | 'policy' | 'circuit_breaker';
  id: ID;
  name: string;
  authority: string;
}

/**
 * History entry for containment changes
 */
export interface ContainmentHistoryEntry {
  timestamp: Timestamp;
  previousLevel: ContainmentLevel;
  newLevel: ContainmentLevel;
  reason: ContainmentReason;
  initiator: ContainmentInitiator;
  evidence: string[];
}

/**
 * Condition for automatic de-escalation
 */
export interface DeescalationCondition {
  /** Condition type */
  type: 'time_elapsed' | 'trust_restored' | 'behavior_normalized' | 'manual_approval' | 'incident_resolved';
  /** Description of condition */
  description: string;
  /** Target value for condition */
  target: string | number;
  /** Current progress toward condition */
  progress: number;
  /** Is condition currently met */
  met: boolean;
}

/**
 * Step in the escalation path
 */
export interface EscalationStep {
  /** Trigger for this escalation */
  trigger: string;
  /** Level to escalate to */
  targetLevel: ContainmentLevel;
  /** Additional restrictions at this level */
  additionalRestrictions: ContainmentRestriction[];
  /** Notification requirements */
  notifications: NotificationRequirement[];
}

/**
 * Notification requirement for containment events
 */
export interface NotificationRequirement {
  channel: 'email' | 'slack' | 'pagerduty' | 'webhook' | 'log';
  recipients: string[];
  severity: 'info' | 'warning' | 'critical';
  template: string;
}

/**
 * Request to change containment level
 */
export interface ContainmentRequest {
  /** Entity to contain */
  entityId: ID;
  /** Requested level */
  level: ContainmentLevel;
  /** Reason for change */
  reason: ContainmentReason;
  /** Detailed explanation */
  explanation: string;
  /** Initiator of request */
  initiator: ContainmentInitiator;
  /** Duration (if temporary) */
  durationMs?: number;
  /** Specific restrictions to apply */
  restrictions?: ContainmentRestriction[];
  /** Force immediate application */
  force?: boolean;
}

/**
 * Result of containment change
 */
export interface ContainmentResult {
  /** Was the change successful */
  success: boolean;
  /** Previous state */
  previousState: ContainmentState;
  /** New state */
  newState: ContainmentState;
  /** Actions taken */
  actionsTaken: ContainmentAction[];
  /** Any errors encountered */
  errors: string[];
  /** Warnings */
  warnings: string[];
}

/**
 * Action taken during containment change
 */
export interface ContainmentAction {
  type: 'level_changed' | 'restriction_added' | 'restriction_removed' | 'notification_sent' | 'capability_revoked' | 'session_terminated';
  target: string;
  details: Record<string, unknown>;
  timestamp: Timestamp;
}

/**
 * Policy for automatic containment
 */
export interface ContainmentPolicy {
  /** Policy identifier */
  policyId: ID;
  /** Policy name */
  name: string;
  /** When this policy applies */
  trigger: PolicyTrigger;
  /** Action to take */
  action: PolicyAction;
  /** Priority (lower = higher priority) */
  priority: number;
  /** Is policy enabled */
  enabled: boolean;
}

/**
 * Trigger for containment policy
 */
export interface PolicyTrigger {
  type: 'trust_threshold' | 'error_rate' | 'anomaly_score' | 'capability_abuse' | 'time_based' | 'composite';
  condition: string;
  threshold: number;
  windowMs?: number;
}

/**
 * Action defined by containment policy
 */
export interface PolicyAction {
  level: ContainmentLevel;
  restrictions: ContainmentRestriction[];
  durationMs?: number;
  notifications: NotificationRequirement[];
}

/**
 * Configuration for the containment system
 */
export interface ContainmentConfig {
  /** Default containment level for new entities */
  defaultLevel: ContainmentLevel;
  /** Allow automatic de-escalation */
  allowAutoDeescalation: boolean;
  /** Minimum time between level changes (prevents flapping) */
  minLevelChangeIntervalMs: number;
  /** Maximum history entries to keep per entity */
  maxHistoryEntries: number;
  /** Default de-escalation conditions */
  defaultDeescalationConditions: DeescalationCondition[];
  /** Global policies */
  policies: ContainmentPolicy[];
}

/**
 * Query for containment states
 */
export interface ContainmentQuery {
  entityId?: ID;
  level?: ContainmentLevel;
  reason?: ContainmentReason;
  activeOnly?: boolean;
  startDate?: Timestamp;
  endDate?: Timestamp;
  limit?: number;
  offset?: number;
}

/**
 * Audit report for containment events
 */
export interface ContainmentAuditReport {
  /** Report period */
  periodStart: Timestamp;
  periodEnd: Timestamp;
  /** Total containment events */
  totalEvents: number;
  /** Events by level */
  byLevel: Record<ContainmentLevel, number>;
  /** Events by reason */
  byReason: Record<ContainmentReason, number>;
  /** Average time in containment */
  averageContainmentDurationMs: number;
  /** Entities with most containment events */
  frequentEntities: Array<{ entityId: ID; eventCount: number }>;
  /** Escalation vs de-escalation ratio */
  escalationRatio: number;
}
