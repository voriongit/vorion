/**
 * Truth Chain Logging for Circuit Breaker Events
 * Story 16-4: All halts recorded immutably on Truth Chain
 *
 * Every pause, resume, kill switch activation, and cascade event
 * is permanently recorded for audit and accountability.
 */

import { createHash } from 'crypto';
import type { PauseRecord, AgentState } from './agent-control';
import type { KillSwitchEvent } from './global-kill-switch';
import type { CascadeEvent } from './cascade-halt';

// ============================================================================
// Types
// ============================================================================

export type CircuitBreakerEventType =
  | 'agent_pause'
  | 'agent_resume'
  | 'agent_terminate'
  | 'kill_switch_activate'
  | 'kill_switch_deactivate'
  | 'cascade_halt'
  | 'cascade_complete';

export interface CircuitBreakerTruthChainEntry {
  id: string;
  eventType: CircuitBreakerEventType;
  timestamp: Date;

  // Source
  initiatedBy: string;
  initiatorType: string;

  // Target
  targetAgentId?: string;
  targetAgentIds?: string[];

  // Event details
  reason: string;
  details: Record<string, unknown>;

  // Chain integrity
  previousHash: string;
  hash: string;
  blockHeight: number;

  // Signatures
  systemSignature: string;
  witnessSignature?: string;
}

export interface TruthChainState {
  latestHash: string;
  latestBlockHeight: number;
  entries: CircuitBreakerTruthChainEntry[];
}

// ============================================================================
// Truth Chain State
// ============================================================================

const GENESIS_HASH = '0'.repeat(64);

let truthChainState: TruthChainState = {
  latestHash: GENESIS_HASH,
  latestBlockHeight: 0,
  entries: [],
};

// ============================================================================
// Hashing Functions
// ============================================================================

/**
 * Calculate hash for a truth chain entry
 */
function calculateHash(entry: Omit<CircuitBreakerTruthChainEntry, 'hash'>): string {
  const data = JSON.stringify({
    id: entry.id,
    eventType: entry.eventType,
    timestamp: entry.timestamp.toISOString(),
    initiatedBy: entry.initiatedBy,
    initiatorType: entry.initiatorType,
    targetAgentId: entry.targetAgentId,
    targetAgentIds: entry.targetAgentIds,
    reason: entry.reason,
    details: entry.details,
    previousHash: entry.previousHash,
    blockHeight: entry.blockHeight,
  });

  return createHash('sha256').update(data).digest('hex');
}

/**
 * Create system signature for entry
 */
function createSystemSignature(hash: string): string {
  // In production, this would use HSM or secure key management
  const signatureData = `A3I-CB-SIGN:${hash}:${Date.now()}`;
  return createHash('sha256').update(signatureData).digest('hex').substring(0, 32);
}

// ============================================================================
// Logging Functions
// ============================================================================

/**
 * Log agent pause to truth chain
 */
export function logAgentPause(pauseRecord: PauseRecord): CircuitBreakerTruthChainEntry {
  return addEntry({
    eventType: 'agent_pause',
    initiatedBy: pauseRecord.initiatedBy,
    initiatorType: pauseRecord.initiatorType,
    targetAgentId: pauseRecord.agentId,
    reason: pauseRecord.reason,
    details: {
      previousState: pauseRecord.previousState,
      newState: pauseRecord.newState,
      notes: pauseRecord.notes,
      autoResumeAt: pauseRecord.autoResumeAt?.toISOString(),
      relatedIncidentId: pauseRecord.relatedIncidentId,
    },
  });
}

/**
 * Log agent resume to truth chain
 */
export function logAgentResume(
  agentId: string,
  resumedBy: string,
  previousState: AgentState,
  notes?: string
): CircuitBreakerTruthChainEntry {
  return addEntry({
    eventType: 'agent_resume',
    initiatedBy: resumedBy,
    initiatorType: 'manual',
    targetAgentId: agentId,
    reason: 'Agent resumed',
    details: {
      previousState,
      notes,
    },
  });
}

/**
 * Log agent termination to truth chain
 */
export function logAgentTerminate(
  terminationRecord: PauseRecord
): CircuitBreakerTruthChainEntry {
  return addEntry({
    eventType: 'agent_terminate',
    initiatedBy: terminationRecord.initiatedBy,
    initiatorType: terminationRecord.initiatorType,
    targetAgentId: terminationRecord.agentId,
    reason: 'Agent terminated',
    details: {
      previousState: terminationRecord.previousState,
      notes: terminationRecord.notes,
    },
  });
}

/**
 * Log kill switch activation to truth chain
 */
export function logKillSwitchActivate(
  event: KillSwitchEvent
): CircuitBreakerTruthChainEntry {
  return addEntry({
    eventType: 'kill_switch_activate',
    initiatedBy: event.activatedBy,
    initiatorType: 'admin',
    targetAgentIds: [], // Will be filled by cascade
    reason: event.reason,
    details: {
      level: event.level,
      trigger: event.trigger,
      affectedCategories: event.affectedCategories,
      exemptAgents: event.exemptAgents,
      agentsPaused: event.agentsPaused,
      agentsExempt: event.agentsExempt,
      authorizationCode: event.authorizationCode ? '[REDACTED]' : undefined,
      secondaryApprover: event.secondaryApprover,
      incidentId: event.incidentId,
    },
  });
}

/**
 * Log kill switch deactivation to truth chain
 */
export function logKillSwitchDeactivate(
  event: KillSwitchEvent,
  durationMs: number
): CircuitBreakerTruthChainEntry {
  return addEntry({
    eventType: 'kill_switch_deactivate',
    initiatedBy: event.deactivatedBy || 'unknown',
    initiatorType: 'admin',
    reason: 'Kill switch deactivated',
    details: {
      level: event.level,
      trigger: event.trigger,
      activatedAt: event.activatedAt.toISOString(),
      durationMs,
      agentsPaused: event.agentsPaused,
      notes: event.notes,
    },
  });
}

/**
 * Log cascade halt initiation to truth chain
 */
export function logCascadeHalt(event: CascadeEvent): CircuitBreakerTruthChainEntry {
  return addEntry({
    eventType: 'cascade_halt',
    initiatedBy: 'system',
    initiatorType: 'cascade',
    targetAgentId: event.sourceAgentId,
    targetAgentIds: event.agentsHalted,
    reason: event.sourceReason,
    details: {
      agentsHalted: event.agentsHalted,
      agentsDegraded: event.agentsDegraded,
      agentsNotified: event.agentsNotified,
      totalDepth: event.totalDepth,
      cascadePath: event.cascadePath,
    },
  });
}

/**
 * Log cascade completion to truth chain
 */
export function logCascadeComplete(
  event: CascadeEvent
): CircuitBreakerTruthChainEntry {
  return addEntry({
    eventType: 'cascade_complete',
    initiatedBy: 'system',
    initiatorType: 'cascade',
    targetAgentId: event.sourceAgentId,
    reason: 'Cascade halt completed',
    details: {
      totalAffected: event.totalAffected,
      totalDepth: event.totalDepth,
      durationMs: event.completedAt
        ? event.completedAt.getTime() - event.triggeredAt.getTime()
        : 0,
    },
  });
}

// ============================================================================
// Core Truth Chain Functions
// ============================================================================

/**
 * Add entry to truth chain
 */
function addEntry(
  data: Omit<CircuitBreakerTruthChainEntry, 'id' | 'timestamp' | 'previousHash' | 'hash' | 'blockHeight' | 'systemSignature'>
): CircuitBreakerTruthChainEntry {
  const entry: Omit<CircuitBreakerTruthChainEntry, 'hash'> = {
    id: `cb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    previousHash: truthChainState.latestHash,
    blockHeight: truthChainState.latestBlockHeight + 1,
    systemSignature: '', // Will be set after hash
    ...data,
  };

  const hash = calculateHash(entry);
  const systemSignature = createSystemSignature(hash);

  const fullEntry: CircuitBreakerTruthChainEntry = {
    ...entry,
    hash,
    systemSignature,
  };

  // Update chain state
  truthChainState.latestHash = hash;
  truthChainState.latestBlockHeight = fullEntry.blockHeight;
  truthChainState.entries.push(fullEntry);

  // In production: persist to database and broadcast
  console.log(`[TRUTH CHAIN] Block ${fullEntry.blockHeight}: ${fullEntry.eventType} - ${fullEntry.reason}`);

  return fullEntry;
}

/**
 * Verify truth chain integrity
 */
export function verifyChainIntegrity(): {
  valid: boolean;
  errors: string[];
  lastValidBlock: number;
} {
  const errors: string[] = [];
  let lastValidBlock = 0;

  for (let i = 0; i < truthChainState.entries.length; i++) {
    const entry = truthChainState.entries[i];

    // Check hash
    const { hash, ...entryWithoutHash } = entry;
    const calculatedHash = calculateHash(entryWithoutHash);
    if (calculatedHash !== hash) {
      errors.push(`Block ${entry.blockHeight}: Hash mismatch`);
      continue;
    }

    // Check previous hash linkage
    if (i === 0) {
      if (entry.previousHash !== GENESIS_HASH) {
        errors.push(`Block ${entry.blockHeight}: Invalid genesis previous hash`);
        continue;
      }
    } else {
      const previousEntry = truthChainState.entries[i - 1];
      if (entry.previousHash !== previousEntry.hash) {
        errors.push(`Block ${entry.blockHeight}: Previous hash doesn't match`);
        continue;
      }
    }

    // Check block height
    if (entry.blockHeight !== i + 1) {
      errors.push(`Block ${entry.blockHeight}: Invalid block height (expected ${i + 1})`);
      continue;
    }

    lastValidBlock = entry.blockHeight;
  }

  return {
    valid: errors.length === 0,
    errors,
    lastValidBlock,
  };
}

/**
 * Get truth chain entries for an agent
 */
export function getAgentTruthChainHistory(
  agentId: string
): CircuitBreakerTruthChainEntry[] {
  return truthChainState.entries.filter(
    entry =>
      entry.targetAgentId === agentId ||
      entry.targetAgentIds?.includes(agentId)
  );
}

/**
 * Get truth chain entries by type
 */
export function getEntriesByType(
  eventType: CircuitBreakerEventType
): CircuitBreakerTruthChainEntry[] {
  return truthChainState.entries.filter(entry => entry.eventType === eventType);
}

/**
 * Get truth chain entries in time range
 */
export function getEntriesInRange(
  startTime: Date,
  endTime: Date
): CircuitBreakerTruthChainEntry[] {
  return truthChainState.entries.filter(
    entry => entry.timestamp >= startTime && entry.timestamp <= endTime
  );
}

/**
 * Get current truth chain state
 */
export function getTruthChainState(): TruthChainState {
  return { ...truthChainState };
}

/**
 * Get entry by hash
 */
export function getEntryByHash(
  hash: string
): CircuitBreakerTruthChainEntry | null {
  return truthChainState.entries.find(entry => entry.hash === hash) || null;
}

/**
 * Export truth chain for external verification
 */
export function exportTruthChain(): {
  genesisHash: string;
  latestHash: string;
  blockCount: number;
  entries: CircuitBreakerTruthChainEntry[];
  exportedAt: string;
  exportSignature: string;
} {
  const exportData = {
    genesisHash: GENESIS_HASH,
    latestHash: truthChainState.latestHash,
    blockCount: truthChainState.latestBlockHeight,
    entries: truthChainState.entries,
    exportedAt: new Date().toISOString(),
    exportSignature: '',
  };

  // Sign the export
  const exportHash = createHash('sha256')
    .update(JSON.stringify(exportData))
    .digest('hex');
  exportData.exportSignature = createSystemSignature(exportHash);

  return exportData;
}

/**
 * Reset truth chain (for testing only)
 */
export function resetTruthChain(): void {
  truthChainState = {
    latestHash: GENESIS_HASH,
    latestBlockHeight: 0,
    entries: [],
  };
}
