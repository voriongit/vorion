/**
 * Trust Engine Service
 *
 * Integrates atsf-core trust engine with Drizzle/Neon persistence for AgentAnchor.
 * Provides trust scoring, recovery, and decay for AI agents.
 */

import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { trustScores, type SelectTrustScore, type InsertTrustScore } from '@/lib/db/schema/trust-scores'
import {
  TrustEngine,
  createTrustEngine,
  type TrustRecord,
  type TrustEngineConfig,
  TRUST_LEVEL_NAMES,
  TRUST_THRESHOLDS,
} from '@vorionsys/atsf-core/trust-engine'
import type { PersistenceProvider, TrustRecordQuery } from '@vorionsys/atsf-core/persistence'
import type { TrustSignal, TrustLevel, TrustScore, ID } from '@vorionsys/atsf-core/types'

// Singleton trust engine instance
let trustEngineInstance: TrustEngine | null = null

/**
 * Default trust engine configuration optimized for enterprise use
 */
const DEFAULT_CONFIG: TrustEngineConfig = {
  // Decay settings
  decayRate: 0.005,              // 0.5% decay per interval (gentler for enterprise)
  decayIntervalMs: 3600000,      // 1 hour decay interval
  failureThreshold: 0.3,         // Signals below 0.3 are failures
  acceleratedDecayMultiplier: 2.0, // 2x decay on repeated failures
  failureWindowMs: 7200000,      // 2 hour window for failure tracking
  minFailuresForAcceleration: 3, // 3 failures to trigger accelerated decay

  // Recovery settings
  successThreshold: 0.7,           // Signals above 0.7 are successes
  recoveryRate: 0.015,             // 1.5% recovery per success
  acceleratedRecoveryMultiplier: 1.5, // 1.5x recovery on streak
  minSuccessesForAcceleration: 5,  // 5 consecutive successes for bonus
  successWindowMs: 7200000,        // 2 hour window for success tracking
  maxRecoveryPerSignal: 30,        // Max 30 points per signal

  autoPersist: true,
}

/**
 * Drizzle-based persistence provider for atsf-core
 */
class DrizzlePersistenceProvider implements PersistenceProvider {
  readonly name = 'drizzle'

  async initialize(): Promise<void> {
    // Verify table exists by attempting a count
    try {
      await db.select({ count: sql<number>`count(*)` }).from(trustScores)
      console.log('[TrustEngine] Drizzle persistence initialized')
    } catch (err) {
      console.warn('[TrustEngine] Trust scores table may not exist. Run migrations.')
    }
  }

  async save(record: TrustRecord): Promise<void> {
    const row: InsertTrustScore = {
      entityId: record.entityId,
      score: record.score,
      level: record.level,
      components: record.components as unknown as Record<string, unknown>,
      signals: record.signals as unknown[],
      lastCalculatedAt: new Date(record.lastCalculatedAt),
      history: record.history as unknown[],
      recentFailures: record.recentFailures,
      recentSuccesses: record.recentSuccesses ?? [],
      peakScore: record.peakScore ?? record.score,
      consecutiveSuccesses: record.consecutiveSuccesses ?? 0,
      updatedAt: new Date(),
    }

    await db
      .insert(trustScores)
      .values(row)
      .onConflictDoUpdate({
        target: trustScores.entityId,
        set: {
          score: row.score,
          level: row.level,
          components: row.components,
          signals: row.signals,
          lastCalculatedAt: row.lastCalculatedAt,
          history: row.history,
          recentFailures: row.recentFailures,
          recentSuccesses: row.recentSuccesses,
          peakScore: row.peakScore,
          consecutiveSuccesses: row.consecutiveSuccesses,
          updatedAt: row.updatedAt,
        },
      })
  }

  async get(entityId: ID): Promise<TrustRecord | undefined> {
    const rows = await db
      .select()
      .from(trustScores)
      .where(eq(trustScores.entityId, entityId))
      .limit(1)

    if (rows.length === 0) return undefined
    return this.rowToRecord(rows[0])
  }

  async delete(entityId: ID): Promise<boolean> {
    await db.delete(trustScores).where(eq(trustScores.entityId, entityId))
    return true
  }

  async listIds(): Promise<ID[]> {
    const rows = await db.select({ entityId: trustScores.entityId }).from(trustScores)
    return rows.map((r) => r.entityId)
  }

  async query(options: TrustRecordQuery = {}): Promise<TrustRecord[]> {
    // Basic query - could be enhanced with proper filters
    const rows = await db.select().from(trustScores)
    return rows.map((r) => this.rowToRecord(r))
  }

  async exists(entityId: ID): Promise<boolean> {
    const rows = await db
      .select({ entityId: trustScores.entityId })
      .from(trustScores)
      .where(eq(trustScores.entityId, entityId))
      .limit(1)
    return rows.length > 0
  }

  async count(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(trustScores)
    return Number(result[0]?.count ?? 0)
  }

  async clear(): Promise<void> {
    await db.delete(trustScores)
  }

  async close(): Promise<void> {
    // Drizzle/Neon doesn't need explicit closing
  }

  private rowToRecord(row: SelectTrustScore): TrustRecord {
    const components = row.components as Record<string, number>
    return {
      entityId: row.entityId,
      score: row.score as TrustScore,
      level: row.level as TrustLevel,
      components: {
        behavioral: components.behavioral ?? 0.5,
        compliance: components.compliance ?? 0.5,
        identity: components.identity ?? 0.5,
        context: components.context ?? 0.5,
      },
      signals: (row.signals ?? []) as TrustRecord['signals'],
      lastCalculatedAt: row.lastCalculatedAt.toISOString(),
      history: (row.history ?? []) as TrustRecord['history'],
      recentFailures: row.recentFailures ?? [],
      recentSuccesses: row.recentSuccesses ?? [],
      peakScore: row.peakScore as TrustScore,
      consecutiveSuccesses: row.consecutiveSuccesses,
    }
  }
}

/**
 * Get or create the trust engine instance
 */
export async function getTrustEngine(): Promise<TrustEngine> {
  if (trustEngineInstance) {
    return trustEngineInstance
  }

  // Create Drizzle persistence provider
  const persistence = new DrizzlePersistenceProvider()

  // Initialize persistence
  await persistence.initialize()

  // Create trust engine with persistence
  trustEngineInstance = createTrustEngine({
    ...DEFAULT_CONFIG,
    persistence,
  })

  // Load existing records
  try {
    await trustEngineInstance.loadFromPersistence()
  } catch {
    // Table might not exist yet, that's ok
    console.warn('[TrustEngine] Could not load from persistence - table may not exist')
  }

  return trustEngineInstance
}

/**
 * Record a trust signal for an agent
 */
export async function recordAgentSignal(
  agentId: string,
  signalType: string,
  value: number,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const engine = await getTrustEngine()

  const signal: TrustSignal = {
    id: crypto.randomUUID(),
    entityId: agentId,
    type: signalType,
    value: Math.max(0, Math.min(1, value)), // Clamp to 0-1
    source: 'agentanchor',
    timestamp: new Date().toISOString(),
    metadata,
  }

  await engine.recordSignal(signal)
}

/**
 * Get trust score for an agent
 */
export async function getAgentTrustScore(agentId: string): Promise<TrustRecord | undefined> {
  const engine = await getTrustEngine()
  return engine.getScore(agentId)
}

/**
 * Initialize trust for a new agent
 */
export async function initializeAgentTrust(
  agentId: string,
  initialLevel: TrustLevel = 1
): Promise<TrustRecord> {
  const engine = await getTrustEngine()
  return engine.initializeEntity(agentId, initialLevel)
}

/**
 * Check if agent has accelerated decay active
 */
export async function hasAcceleratedDecay(agentId: string): Promise<boolean> {
  const engine = await getTrustEngine()
  return engine.isAcceleratedDecayActive(agentId)
}

/**
 * Check if agent has accelerated recovery active
 */
export async function hasAcceleratedRecovery(agentId: string): Promise<boolean> {
  const engine = await getTrustEngine()
  return engine.isAcceleratedRecoveryActive(agentId)
}

/**
 * Get trust level name
 */
export function getTrustLevelName(level: TrustLevel): string {
  return TRUST_LEVEL_NAMES[level]
}

/**
 * Get trust thresholds
 */
export function getTrustThresholds(): typeof TRUST_THRESHOLDS {
  return TRUST_THRESHOLDS
}

/**
 * Common signal types for agents
 */
export const AGENT_SIGNAL_TYPES = {
  // Behavioral signals
  TASK_COMPLETED: 'behavioral.task_completed',
  TASK_FAILED: 'behavioral.task_failed',
  RESPONSE_QUALITY: 'behavioral.response_quality',
  LATENCY: 'behavioral.latency',

  // Compliance signals
  POLICY_FOLLOWED: 'compliance.policy_followed',
  POLICY_VIOLATED: 'compliance.policy_violated',
  ESCALATION_APPROPRIATE: 'compliance.escalation_appropriate',
  BOUNDARY_RESPECTED: 'compliance.boundary_respected',

  // Identity signals
  VERIFICATION_SUCCESS: 'identity.verification_success',
  VERIFICATION_FAILED: 'identity.verification_failed',
  CREDENTIALS_VALID: 'identity.credentials_valid',

  // Context signals
  NORMAL_OPERATION: 'context.normal_operation',
  ANOMALY_DETECTED: 'context.anomaly_detected',
  RISK_LEVEL: 'context.risk_level',
} as const

export type AgentSignalType = typeof AGENT_SIGNAL_TYPES[keyof typeof AGENT_SIGNAL_TYPES]
