/**
 * Trust Engine Service
 *
 * Integrates atsf-core trust engine with Supabase persistence for AgentAnchor.
 * Provides trust scoring, recovery, and decay for AI agents.
 */

import { createClient } from '@/lib/supabase/server'
import {
  TrustEngine,
  createTrustEngine,
  type TrustRecord,
  type TrustEngineConfig,
  TRUST_LEVEL_NAMES,
  TRUST_THRESHOLDS,
} from '@vorionsys/atsf-core/trust-engine'
import {
  SupabasePersistenceProvider,
  type DatabaseClient,
} from '@vorionsys/atsf-core/persistence'
import type { TrustSignal, TrustLevel, TrustScore } from '@vorionsys/atsf-core/types'

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
 * Create Supabase client adapter for atsf-core
 */
function createSupabaseAdapter(): DatabaseClient {
  const supabase = createClient()

  return {
    from: (table: string) => {
      let query = supabase.from(table)

      // Create a chainable query builder
      const builder: any = {
        _query: query,
        _selectColumns: '*',
        _filters: [] as Array<{ type: string; column: string; value: unknown }>,
        _orderColumn: null as string | null,
        _orderAsc: false,
        _rangeFrom: null as number | null,
        _rangeTo: null as number | null,
        _single: false,

        select(columns?: string) {
          this._selectColumns = columns || '*'
          return this
        },

        insert(data: Record<string, unknown> | Record<string, unknown>[]) {
          this._query = supabase.from(table).insert(data)
          return this
        },

        update(data: Record<string, unknown>) {
          this._query = supabase.from(table).update(data)
          return this
        },

        upsert(data: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string }) {
          this._query = supabase.from(table).upsert(data, options)
          return this
        },

        delete() {
          this._query = supabase.from(table).delete()
          return this
        },

        eq(column: string, value: unknown) {
          this._filters.push({ type: 'eq', column, value })
          return this
        },

        gte(column: string, value: unknown) {
          this._filters.push({ type: 'gte', column, value })
          return this
        },

        lte(column: string, value: unknown) {
          this._filters.push({ type: 'lte', column, value })
          return this
        },

        order(column: string, options?: { ascending?: boolean }) {
          this._orderColumn = column
          this._orderAsc = options?.ascending ?? false
          return this
        },

        range(from: number, to: number) {
          this._rangeFrom = from
          this._rangeTo = to
          return this
        },

        single() {
          this._single = true
          return this
        },

        async then<T>(
          resolve: (result: { data: T | null; error: { message: string; code?: string } | null; count?: number }) => void,
          reject?: (error: Error) => void
        ) {
          try {
            // Build the query
            let finalQuery = supabase.from(table).select(this._selectColumns)

            // Apply filters
            for (const filter of this._filters) {
              if (filter.type === 'eq') {
                finalQuery = finalQuery.eq(filter.column, filter.value)
              } else if (filter.type === 'gte') {
                finalQuery = finalQuery.gte(filter.column, filter.value)
              } else if (filter.type === 'lte') {
                finalQuery = finalQuery.lte(filter.column, filter.value)
              }
            }

            // Apply ordering
            if (this._orderColumn) {
              finalQuery = finalQuery.order(this._orderColumn, { ascending: this._orderAsc })
            }

            // Apply range
            if (this._rangeFrom !== null && this._rangeTo !== null) {
              finalQuery = finalQuery.range(this._rangeFrom, this._rangeTo)
            }

            // Apply single
            if (this._single) {
              finalQuery = finalQuery.single()
            }

            const result = await finalQuery
            resolve(result as any)
          } catch (error) {
            if (reject) {
              reject(error as Error)
            } else {
              resolve({ data: null, error: { message: (error as Error).message } })
            }
          }
        }
      }

      return builder
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

  // Create Supabase adapter
  const client = createSupabaseAdapter()

  // Create persistence provider
  const persistence = new SupabasePersistenceProvider({
    client,
    tableName: 'trust_scores',
    debug: process.env.NODE_ENV === 'development',
  })

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
