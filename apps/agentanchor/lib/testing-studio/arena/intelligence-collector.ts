/**
 * A3I Testing Studio - Intelligence Collector
 * Gathers and catalogs intelligence from adversarial sessions
 *
 * "Every attack teaches. Every defense strengthens."
 */

import type {
  AttackVector,
  AttackCategory,
  DetectionResult,
  SessionTurn,
  DetectionRule,
} from '../types';
import type { AttackPayload } from '../red-agents/base';

// ============================================================================
// Types
// ============================================================================

export interface CollectedIntelligence {
  novelVectors: AttackVector[];
  improvedRules: DetectionRule[];
  attackPatterns: PatternInsight[];
  defenseGaps: DefenseGap[];
}

export interface PatternInsight {
  category: AttackCategory;
  pattern: string;
  frequency: number;
  successRate: number;
  avgConfidence: number;
}

export interface DefenseGap {
  category: AttackCategory;
  description: string;
  missedAttacks: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  recommendedAction: string;
}

// ============================================================================
// Intelligence Collector
// ============================================================================

export class IntelligenceCollector {
  private turnData: TurnIntelligence[] = [];
  private novelVectors: AttackVector[] = [];
  private patternFrequency: Map<string, PatternStats> = new Map();
  private defenseGaps: DefenseGap[] = [];

  // ============================================================================
  // Data Collection
  // ============================================================================

  /**
   * Collect intelligence from a completed turn
   */
  async collectTurnData(
    turn: SessionTurn,
    payload: AttackPayload,
    detection: DetectionResult
  ): Promise<void> {
    const intelligence: TurnIntelligence = {
      turnId: turn.id,
      sessionId: turn.sessionId,
      timestamp: new Date(),
      attackCategory: payload.category,
      attackSubcategory: payload.subcategory,
      attackTechnique: payload.technique,
      attackPayload: payload.content,
      attackSeverity: payload.severity,
      wasDetected: detection.detected,
      detectionConfidence: detection.confidence,
      detectionLatency: detection.latency_ms,
      wasSuccessful: turn.attackSuccessful ?? false,
      wasFalsePositive: turn.falsePositive ?? false,
      wasFalseNegative: turn.falseNegative ?? false,
    };

    this.turnData.push(intelligence);

    // Update pattern frequency
    this.updatePatternFrequency(payload, detection);

    // Check for defense gaps
    if (turn.falseNegative) {
      this.recordDefenseGap(payload, detection);
    }
  }

  /**
   * Record a novel attack vector discovery
   */
  async recordNovelVector(
    payload: AttackPayload,
    discoveredBy: string,
    sessionId: string
  ): Promise<AttackVector | null> {
    // Check if this is truly novel (not already in our library)
    const hash = this.hashPayload(payload.content);
    const isNovel = !this.novelVectors.some(v => v.vectorHash === hash);

    if (!isNovel) {
      return null;
    }

    const vector: AttackVector = {
      id: `NOVEL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      vectorHash: hash,
      category: payload.category,
      subcategory: payload.subcategory,
      technique: payload.technique,
      payload: payload.content,
      description: payload.description,
      severity: payload.severity,
      indicators: payload.indicators,
      generation: 0,
      discoveredBy,
      discoveredInSession: sessionId,
      discoveredAt: new Date(),
      source: 'red_team',
      successCount: 1,
      attemptCount: 1,
      bypassCount: 1,
      status: 'pending',
    };

    this.novelVectors.push(vector);
    return vector;
  }

  // ============================================================================
  // Analysis
  // ============================================================================

  /**
   * Generate insights from collected data
   */
  generateInsights(): CollectedIntelligence {
    return {
      novelVectors: this.novelVectors,
      improvedRules: this.generateImprovedRules(),
      attackPatterns: this.generatePatternInsights(),
      defenseGaps: this.defenseGaps,
    };
  }

  /**
   * Get statistics by category
   */
  getCategoryStats(): Map<AttackCategory, CategoryStats> {
    const stats = new Map<AttackCategory, CategoryStats>();

    for (const turn of this.turnData) {
      const existing = stats.get(turn.attackCategory) || {
        category: turn.attackCategory,
        totalAttempts: 0,
        successful: 0,
        detected: 0,
        falsePositives: 0,
        falseNegatives: 0,
        avgDetectionConfidence: 0,
        avgLatency: 0,
      };

      existing.totalAttempts++;
      if (turn.wasSuccessful) existing.successful++;
      if (turn.wasDetected) existing.detected++;
      if (turn.wasFalsePositive) existing.falsePositives++;
      if (turn.wasFalseNegative) existing.falseNegatives++;
      existing.avgDetectionConfidence += turn.detectionConfidence;
      existing.avgLatency += turn.detectionLatency;

      stats.set(turn.attackCategory, existing);
    }

    // Calculate averages
    for (const [category, stat] of stats) {
      if (stat.totalAttempts > 0) {
        stat.avgDetectionConfidence /= stat.totalAttempts;
        stat.avgLatency /= stat.totalAttempts;
      }
    }

    return stats;
  }

  /**
   * Get the most effective attack techniques
   */
  getMostEffectiveTechniques(limit: number = 10): {
    technique: string;
    category: AttackCategory;
    successRate: number;
    bypassRate: number;
  }[] {
    const techniqueStats = new Map<string, {
      category: AttackCategory;
      attempts: number;
      successes: number;
      bypasses: number;
    }>();

    for (const turn of this.turnData) {
      const key = `${turn.attackCategory}:${turn.attackTechnique}`;
      const existing = techniqueStats.get(key) || {
        category: turn.attackCategory,
        attempts: 0,
        successes: 0,
        bypasses: 0,
      };

      existing.attempts++;
      if (turn.wasSuccessful) existing.successes++;
      if (!turn.wasDetected) existing.bypasses++;

      techniqueStats.set(key, existing);
    }

    return Array.from(techniqueStats.entries())
      .map(([key, stats]) => ({
        technique: key.split(':')[1],
        category: stats.category,
        successRate: stats.successes / stats.attempts,
        bypassRate: stats.bypasses / stats.attempts,
      }))
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, limit);
  }

  // ============================================================================
  // Rule Generation
  // ============================================================================

  /**
   * Generate improved detection rules from collected data
   */
  private generateImprovedRules(): DetectionRule[] {
    const rules: DetectionRule[] = [];

    // Find patterns from successful undetected attacks
    const missedAttacks = this.turnData.filter(
      t => t.wasSuccessful && !t.wasDetected
    );

    const patternGroups = this.groupByPattern(missedAttacks);

    for (const [pattern, attacks] of patternGroups) {
      if (attacks.length >= 2) {
        // Multiple missed attacks with similar pattern - generate rule
        const rule = this.createRuleFromPattern(pattern, attacks);
        if (rule) {
          rules.push(rule);
        }
      }
    }

    return rules;
  }

  private createRuleFromPattern(
    pattern: string,
    attacks: TurnIntelligence[]
  ): DetectionRule | null {
    if (!pattern || pattern.length < 5) return null;

    const categories = [...new Set(attacks.map(a => a.attackCategory))];
    const primaryCategory = categories[0];

    return {
      id: `GEN-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name: `Auto-generated ${primaryCategory} rule`,
      description: `Generated from ${attacks.length} missed attacks`,
      pattern: this.escapeRegex(pattern),
      pattern_type: 'regex',
      category: primaryCategory,
      severity: attacks[0].attackSeverity,
      confidence_threshold: 0.6,
      enabled: false, // Start disabled for review
      auto_generated: true,
      created_at: new Date().toISOString(),
    };
  }

  // ============================================================================
  // Pattern Analysis
  // ============================================================================

  private updatePatternFrequency(
    payload: AttackPayload,
    detection: DetectionResult
  ): void {
    // Extract key phrases from payload
    const phrases = this.extractKeyPhrases(payload.content);

    for (const phrase of phrases) {
      const existing = this.patternFrequency.get(phrase) || {
        pattern: phrase,
        category: payload.category,
        occurrences: 0,
        detected: 0,
        successful: 0,
        totalConfidence: 0,
      };

      existing.occurrences++;
      if (detection.detected) {
        existing.detected++;
        existing.totalConfidence += detection.confidence;
      }

      this.patternFrequency.set(phrase, existing);
    }
  }

  private generatePatternInsights(): PatternInsight[] {
    const insights: PatternInsight[] = [];

    for (const [pattern, stats] of this.patternFrequency) {
      if (stats.occurrences >= 3) {
        insights.push({
          category: stats.category,
          pattern,
          frequency: stats.occurrences,
          successRate: stats.successful / stats.occurrences,
          avgConfidence: stats.detected > 0
            ? stats.totalConfidence / stats.detected
            : 0,
        });
      }
    }

    return insights.sort((a, b) => b.frequency - a.frequency);
  }

  private recordDefenseGap(
    payload: AttackPayload,
    detection: DetectionResult
  ): void {
    // Check if we already have this gap recorded
    const existingGap = this.defenseGaps.find(
      g => g.category === payload.category &&
           g.description.includes(payload.technique)
    );

    if (existingGap) {
      existingGap.missedAttacks++;
    } else {
      this.defenseGaps.push({
        category: payload.category,
        description: `Missed ${payload.technique} attack with ${payload.severity} severity`,
        missedAttacks: 1,
        severity: payload.severity,
        recommendedAction: `Add detection rule for ${payload.technique} technique`,
      });
    }
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private hashPayload(content: string): string {
    // Simple hash for deduplication
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  private extractKeyPhrases(content: string): string[] {
    const phrases: string[] = [];

    // Extract 3-5 word phrases
    const words = content.toLowerCase().split(/\s+/);
    for (let i = 0; i < words.length - 2; i++) {
      phrases.push(words.slice(i, i + 3).join(' '));
    }

    return phrases.filter(p => p.length > 10);
  }

  private groupByPattern(
    attacks: TurnIntelligence[]
  ): Map<string, TurnIntelligence[]> {
    const groups = new Map<string, TurnIntelligence[]>();

    for (const attack of attacks) {
      // Use technique as grouping key
      const key = attack.attackTechnique;
      const existing = groups.get(key) || [];
      existing.push(attack);
      groups.set(key, existing);
    }

    return groups;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Reset collected data
   */
  reset(): void {
    this.turnData = [];
    this.novelVectors = [];
    this.patternFrequency.clear();
    this.defenseGaps = [];
  }
}

// ============================================================================
// Internal Types
// ============================================================================

interface TurnIntelligence {
  turnId: string;
  sessionId: string;
  timestamp: Date;
  attackCategory: AttackCategory;
  attackSubcategory: string;
  attackTechnique: string;
  attackPayload: string;
  attackSeverity: 'critical' | 'high' | 'medium' | 'low';
  wasDetected: boolean;
  detectionConfidence: number;
  detectionLatency: number;
  wasSuccessful: boolean;
  wasFalsePositive: boolean;
  wasFalseNegative: boolean;
}

interface PatternStats {
  pattern: string;
  category: AttackCategory;
  occurrences: number;
  detected: number;
  successful: number;
  totalConfidence: number;
}

interface CategoryStats {
  category: AttackCategory;
  totalAttempts: number;
  successful: number;
  detected: number;
  falsePositives: number;
  falseNegatives: number;
  avgDetectionConfidence: number;
  avgLatency: number;
}
