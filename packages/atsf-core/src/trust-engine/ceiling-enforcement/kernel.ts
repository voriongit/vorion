/**
 * Phase 6 Q1: Ceiling Enforcement - Kernel Layer
 * 
 * Core responsibility: Apply ceiling enforcement at kernel level (0-1000 scale)
 * - Receives raw trust scores (any numeric value)
 * - Clamps to 0-1000 based on context ceiling
 * - Preserves raw score for audit trail (ceilingApplied flag)
 * - <1ms latency target
 */

import { TrustEvent, TrustMetrics, CONTEXT_CEILINGS } from '../phase6-types';

/**
 * Context-based ceiling levels (from CONTEXT_CEILINGS)
 */
export enum ContextType {
  LOCAL = 'local',        // 0-700: Restricted to test environments
  ENTERPRISE = 'enterprise', // 0-900: Approved for business operations
  SOVEREIGN = 'sovereign',   // 0-1000: External systems, regulatory domains
}

/**
 * Result of ceiling enforcement operation
 */
export interface CeilingEnforcementResult {
  /** Original raw score (unclamped) */
  rawScore: number;
  /** Clamped score (post-ceiling) */
  clampedScore: number;
  /** Ceiling that was applied */
  ceiling: number;
  /** Whether clamping occurred (rawScore !== clampedScore) */
  ceilingApplied: boolean;
  /** Context type that determined the ceiling */
  contextType: ContextType;
}

/**
 * Get ceiling value for a context type
 * 
 * @param contextType - The context (local/enterprise/sovereign)
 * @returns The ceiling value (700/900/1000)
 */
export function getCeilingForContext(contextType: ContextType): number {
  switch (contextType) {
    case ContextType.LOCAL:
      return CONTEXT_CEILINGS.local;
    case ContextType.ENTERPRISE:
      return CONTEXT_CEILINGS.enterprise;
    case ContextType.SOVEREIGN:
      return CONTEXT_CEILINGS.sovereign;
    default:
      throw new Error(`Unknown context type: ${contextType}`);
  }
}

/**
 * Clamp a raw score to the ceiling for a given context
 * 
 * This is the core Q1 enforcement: kernel-level ceiling with dual logging
 * - Raw score always preserved (for analytics)
 * - Clamped score enforced at runtime (for authorization decisions)
 * - Flag indicates whether ceiling was applied
 * 
 * @param rawScore - The unprocessed trust score (may be >1000 or <0)
 * @param contextType - The context determining the ceiling
 * @returns CeilingEnforcementResult with raw/clamped scores and flags
 * 
 * @example
 * const result = clampTrustScore(1050, ContextType.ENTERPRISE);
 * // { rawScore: 1050, clampedScore: 900, ceiling: 900, ceilingApplied: true, contextType: 'enterprise' }
 */
export function clampTrustScore(
  rawScore: number,
  contextType: ContextType
): CeilingEnforcementResult {
  // Validate inputs
  if (!Number.isFinite(rawScore)) {
    throw new Error(`Invalid raw score: ${rawScore}`);
  }
  if (!Object.values(ContextType).includes(contextType)) {
    throw new Error(`Invalid context type: ${contextType}`);
  }

  const ceiling = getCeilingForContext(contextType);
  
  // Clamp to [0, ceiling]
  const clampedScore = Math.max(0, Math.min(rawScore, ceiling));
  
  return {
    rawScore,
    clampedScore,
    ceiling,
    ceilingApplied: rawScore !== clampedScore,
    contextType,
  };
}

/**
 * Apply ceiling enforcement to a TrustEvent
 * 
 * This wraps clampTrustScore and populates the event's score and ceilingApplied fields
 * 
 * @param event - The trust event to enforce ceiling on
 * @param contextType - The context determining the ceiling
 * @returns The modified TrustEvent with score clamped and ceilingApplied set
 */
export function applyCeilingEnforcement(
  event: TrustEvent,
  contextType: ContextType
): TrustEvent {
  const result = clampTrustScore(event.rawScore, contextType);
  
  return {
    ...event,
    score: result.clampedScore,
    ceilingApplied: result.ceilingApplied,
  };
}

/**
 * Validate that a score complies with its context ceiling
 * 
 * This is used for assertions/validation - checking that a score
 * was properly clamped before being used in authorization decisions
 * 
 * @param score - The score to validate
 * @param contextType - The context that should be limiting the score
 * @returns true if score ≤ ceiling for this context
 */
export function validateScoreForContext(
  score: number,
  contextType: ContextType
): boolean {
  const ceiling = getCeilingForContext(contextType);
  return score >= 0 && score <= ceiling;
}

/**
 * Get the effective autonomy tier based on clamped score
 * 
 * Maps the clamped score (after ceiling enforcement) to a tier level.
 * This is used downstream (in role-gates, context-policy) to determine
 * what operations are allowed.
 * 
 * Tier mapping:
 * - T0: 0-100 (Sandbox)
 * - T1: 100-300 (Monitored)
 * - T2: 300-500 (Supervised)
 * - T3: 500-700 (Autonomous)
 * - T4: 700-900 (Sovereign)
 * - T5: 900-1000 (Verified)
 * 
 * @param clampedScore - Score after ceiling enforcement
 * @returns Tier number 0-5
 */
export function getTierFromScore(clampedScore: number): number {
  if (clampedScore < 0 || clampedScore > 1000) {
    throw new Error(`Score out of range: ${clampedScore}`);
  }
  
  if (clampedScore < 100) return 0;
  if (clampedScore < 300) return 1;
  if (clampedScore < 500) return 2;
  if (clampedScore < 700) return 3;
  if (clampedScore < 900) return 4;
  return 5;
}

/**
 * Compute the effective authorization tier
 * 
 * This combines:
 * 1. The clamped trust score (from ceiling enforcement)
 * 2. The context ceiling
 * 
 * Result is the minimum tier that respects both constraints.
 * 
 * @param clampedScore - Score after ceiling enforcement
 * @param contextType - Context that limited the score
 * @returns Effective tier 0-5
 */
export function getEffectiveAuthorizationTier(
  clampedScore: number,
  contextType: ContextType
): number {
  // Validate that score respects the context ceiling
  if (!validateScoreForContext(clampedScore, contextType)) {
    throw new Error(
      `Score ${clampedScore} violates ceiling for context ${contextType}`
    );
  }
  
  return getTierFromScore(clampedScore);
}
