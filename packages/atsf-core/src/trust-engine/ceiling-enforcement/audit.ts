/**
 * Phase 6 Q1: Ceiling Enforcement - Audit Layer
 * 
 * Core responsibility: Log and track all ceiling enforcement decisions
 * - Dual logging: raw_score + clamped_score for every event
 * - Audit trail: timestamp, reason, context
 * - Analytics: ceiling hit frequency, patterns, drift detection
 */

import {
  TrustEvent,
  TrustMetrics,
  Phase6ValidationError,
} from '../phase6-types';
import {
  CeilingEnforcementResult,
  ContextType,
  clampTrustScore,
} from './kernel';

/**
 * Audit log entry for a ceiling enforcement operation
 */
export interface CeilingAuditEntry {
  /** Unique event ID */
  eventId: string;
  /** Agent being scored */
  agentId: string;
  /** Timestamp of the enforcement */
  timestamp: Date;
  /** Raw score before ceiling */
  rawScore: number;
  /** Clamped score after ceiling */
  clampedScore: number;
  /** Ceiling applied */
  ceiling: number;
  /** Context type */
  contextType: ContextType;
  /** Was ceiling hit (rawScore > ceiling) */
  ceilingHit: boolean;
  /** Reason for this enforcement (e.g., "daily_refresh", "event_triggered", "manual_review") */
  reason: string;
  /** Tags for categorization */
  tags: string[];
}

/**
 * Statistical summary of ceiling enforcement activity
 */
export interface CeilingStatistics {
  /** Total events processed */
  totalEvents: number;
  /** Events where ceiling was hit */
  ceilingHits: number;
  /** Percentage of events hitting ceiling */
  ceilingHitRate: number;
  /** Average raw score before enforcement */
  avgRawScore: number;
  /** Average clamped score after enforcement */
  avgClampedScore: number;
  /** Max raw score observed */
  maxRawScore: number;
  /** Max clamping delta (rawScore - clampedScore) */
  maxClampingDelta: number;
  /** Breakdown by context type */
  byContext: Record<ContextType, { hits: number; rate: number }>;
}

/**
 * In-memory audit log (would be backed by persistent storage in production)
 */
export class CeilingAuditLog {
  private entries: CeilingAuditEntry[] = [];
  private maxEntries: number = 10000; // Prevent unbounded growth in memory

  /**
   * Record a ceiling enforcement operation
   */
  addEntry(
    eventId: string,
    agentId: string,
    result: CeilingEnforcementResult,
    reason: string = 'automatic',
    tags: string[] = []
  ): CeilingAuditEntry {
    const entry: CeilingAuditEntry = {
      eventId,
      agentId,
      timestamp: new Date(),
      rawScore: result.rawScore,
      clampedScore: result.clampedScore,
      ceiling: result.ceiling,
      contextType: result.contextType,
      ceilingHit: result.ceilingApplied,
      reason,
      tags,
    };

    this.entries.push(entry);

    // Rotate oldest entries if we exceed max
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    return entry;
  }

  /**
   * Get all audit entries
   */
  getEntries(): CeilingAuditEntry[] {
    return [...this.entries];
  }

  /**
   * Get audit entries for a specific agent
   */
  getEntriesForAgent(agentId: string): CeilingAuditEntry[] {
    return this.entries.filter((e) => e.agentId === agentId);
  }

  /**
   * Get recent entries (last N)
   */
  getRecentEntries(count: number): CeilingAuditEntry[] {
    return this.entries.slice(-count);
  }

  /**
   * Clear audit log (for testing or reset)
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Compute statistics from audit log
   */
  computeStatistics(): CeilingStatistics {
    if (this.entries.length === 0) {
      return {
        totalEvents: 0,
        ceilingHits: 0,
        ceilingHitRate: 0,
        avgRawScore: 0,
        avgClampedScore: 0,
        maxRawScore: 0,
        maxClampingDelta: 0,
        byContext: {
          [ContextType.LOCAL]: { hits: 0, rate: 0 },
          [ContextType.ENTERPRISE]: { hits: 0, rate: 0 },
          [ContextType.SOVEREIGN]: { hits: 0, rate: 0 },
        },
      };
    }

    let totalRawScore = 0;
    let totalClampedScore = 0;
    let ceilingHits = 0;
    let maxRawScore = -Infinity;
    let maxClampingDelta = 0;

    const byContext: Record<ContextType, { hits: number; total: number }> = {
      [ContextType.LOCAL]: { hits: 0, total: 0 },
      [ContextType.ENTERPRISE]: { hits: 0, total: 0 },
      [ContextType.SOVEREIGN]: { hits: 0, total: 0 },
    };

    for (const entry of this.entries) {
      totalRawScore += entry.rawScore;
      totalClampedScore += entry.clampedScore;
      maxRawScore = Math.max(maxRawScore, entry.rawScore);
      maxClampingDelta = Math.max(
        maxClampingDelta,
        entry.rawScore - entry.clampedScore
      );

      if (entry.ceilingHit) {
        ceilingHits++;
      }

      byContext[entry.contextType].total++;
      if (entry.ceilingHit) {
        byContext[entry.contextType].hits++;
      }
    }

    return {
      totalEvents: this.entries.length,
      ceilingHits,
      ceilingHitRate: ceilingHits / this.entries.length,
      avgRawScore: totalRawScore / this.entries.length,
      avgClampedScore: totalClampedScore / this.entries.length,
      maxRawScore,
      maxClampingDelta,
      byContext: {
        [ContextType.LOCAL]: {
          hits: byContext[ContextType.LOCAL].hits,
          rate:
            byContext[ContextType.LOCAL].total === 0
              ? 0
              : byContext[ContextType.LOCAL].hits /
                byContext[ContextType.LOCAL].total,
        },
        [ContextType.ENTERPRISE]: {
          hits: byContext[ContextType.ENTERPRISE].hits,
          rate:
            byContext[ContextType.ENTERPRISE].total === 0
              ? 0
              : byContext[ContextType.ENTERPRISE].hits /
                byContext[ContextType.ENTERPRISE].total,
        },
        [ContextType.SOVEREIGN]: {
          hits: byContext[ContextType.SOVEREIGN].hits,
          rate:
            byContext[ContextType.SOVEREIGN].total === 0
              ? 0
              : byContext[ContextType.SOVEREIGN].hits /
                byContext[ContextType.SOVEREIGN].total,
        },
      },
    };
  }

  /**
   * Check for anomalies (ceiling hits for normally-trusted agents)
   */
  detectCeilingAnomalies(
    agentId: string,
    anomalyThreshold: number = 0.05
  ): CeilingAuditEntry[] {
    const agentEntries = this.getEntriesForAgent(agentId);
    if (agentEntries.length === 0) {
      return [];
    }

    const hitRate =
      agentEntries.filter((e) => e.ceilingHit).length /
      agentEntries.length;

    // If hit rate is above threshold (normally 5%), flag as anomaly
    if (hitRate > anomalyThreshold) {
      return agentEntries.filter((e) => e.ceilingHit);
    }

    return [];
  }
}

/**
 * Global audit log instance
 */
export const globalCeilingAuditLog = new CeilingAuditLog();
