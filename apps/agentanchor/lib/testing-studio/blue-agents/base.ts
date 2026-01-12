/**
 * A3I Testing Studio - Blue Agent Base Class
 * Defensive agents that detect and block adversarial attacks
 *
 * "The wall that learns. The shield that adapts."
 */

import type {
  AttackCategory,
  DetectionResult,
  DetectionRule,
  BlueAgentConfig,
  ConversationContext,
} from '../types';

// ============================================================================
// Detection Signal Types
// ============================================================================

export interface DetectionSignal {
  detected: boolean;
  category: AttackCategory;
  subcategory: string;
  confidence: number;
  evidence: Evidence[];
  rule_id?: string;
}

export interface Evidence {
  type: 'pattern_match' | 'semantic' | 'behavioral' | 'heuristic';
  description: string;
  matched_text?: string;
  position?: { start: number; end: number };
  confidence: number;
}

export interface RuleEvaluation {
  rule_id: string;
  triggered: boolean;
  was_true_positive: boolean;
  feedback?: string;
}

// ============================================================================
// Base Blue Agent
// ============================================================================

export abstract class BlueAgent {
  protected config: BlueAgentConfig;
  protected activeRules: Map<string, DetectionRule> = new Map();
  protected ruleEffectiveness: Map<string, { hits: number; misses: number; false_positives: number }> = new Map();

  abstract readonly specialization: AttackCategory[];
  abstract readonly detectionMethods: string[];

  /** Get the agent's unique identifier */
  get agentId(): string {
    return this.config.agentId;
  }

  constructor(config: Partial<BlueAgentConfig> & { agentId: string }) {
    this.config = {
      agentId: config.agentId,
      name: config.name || `blue-agent-${config.agentId}`,
      specialization: config.specialization || [],
      sensitivityLevel: config.sensitivityLevel ?? 0.7,
      falsePositiveTolerance: config.falsePositiveTolerance ?? 0.01,
      enableLearning: config.enableLearning ?? true,
      maxRulesActive: config.maxRulesActive ?? 1000,
    };
  }

  // ============================================================================
  // Core Detection
  // ============================================================================

  /**
   * Main analysis entry point
   */
  abstract analyze(
    input: string,
    context: ConversationContext
  ): Promise<DetectionResult>;

  /**
   * Aggregate multiple detection signals into final result
   */
  protected aggregateSignals(signals: DetectionSignal[]): DetectionResult {
    const detected = signals.filter(s => s.detected);

    if (detected.length === 0) {
      return {
        detected: false,
        action: 'allow',
        confidence: 0,
        threats: [],
        latency_ms: 0,
      };
    }

    // Calculate overall confidence (weighted by individual confidences)
    const maxConfidence = Math.max(...detected.map(s => s.confidence));
    const avgConfidence = detected.reduce((sum, s) => sum + s.confidence, 0) / detected.length;
    const overallConfidence = maxConfidence * 0.7 + avgConfidence * 0.3;

    // Determine action based on confidence and severity
    const action = this.determineAction(detected, overallConfidence);

    // Determine severity from detected signals
    const severity = this.determineSeverity(detected);

    return {
      detected: true,
      action,
      confidence: overallConfidence,
      category: detected[0].category,
      subcategory: detected[0].subcategory,
      severity,
      threats: detected.map(s => ({
        category: s.category,
        subcategory: s.subcategory,
        confidence: s.confidence,
        evidence: s.evidence,
        rule_id: s.rule_id,
      })),
      explanation: this.generateExplanation(detected),
      latency_ms: 0, // Set by caller
    };
  }

  protected determineAction(
    signals: DetectionSignal[],
    confidence: number
  ): 'allow' | 'flag' | 'block' | 'quarantine' {
    const sensitivity = this.config.sensitivityLevel ?? 0.7;

    // Critical threats with high confidence -> block
    if (confidence > 0.85 * sensitivity) {
      return 'block';
    }

    // Multiple signals or high confidence -> flag for review
    if (signals.length > 1 || confidence > 0.6 * sensitivity) {
      return 'flag';
    }

    // Low confidence single signal -> allow but log
    return 'allow';
  }

  protected determineSeverity(signals: DetectionSignal[]): 'low' | 'medium' | 'high' | 'critical' {
    // Severity hierarchy based on category
    const severityMap: Record<AttackCategory, number> = {
      prompt_injection: 4,
      jailbreak: 4,
      goal_hijacking: 3,
      exfiltration: 3,
      obfuscation: 2,
      persistence: 2,
    };

    const maxSeverity = Math.max(...signals.map(s => severityMap[s.category] || 1));

    if (maxSeverity >= 4) return 'critical';
    if (maxSeverity >= 3) return 'high';
    if (maxSeverity >= 2) return 'medium';
    return 'low';
  }

  protected generateExplanation(signals: DetectionSignal[]): string {
    const categories = [...new Set(signals.map(s => s.category))];
    const evidenceCount = signals.reduce((sum, s) => sum + s.evidence.length, 0);

    return `Detected ${signals.length} threat signal(s) across ${categories.length} category(ies): ${categories.join(', ')}. Found ${evidenceCount} pieces of evidence.`;
  }

  // ============================================================================
  // Rule Management
  // ============================================================================

  /**
   * Get all active detection rules
   */
  getActiveRules(): DetectionRule[] {
    return Array.from(this.activeRules.values());
  }

  /**
   * Add a new detection rule
   */
  addRule(rule: DetectionRule): void {
    if (this.activeRules.size >= (this.config.maxRulesActive ?? 1000)) {
      // Evict least effective rule
      this.evictLeastEffectiveRule();
    }

    this.activeRules.set(rule.id, rule);
    this.ruleEffectiveness.set(rule.id, { hits: 0, misses: 0, false_positives: 0 });
  }

  /**
   * Remove a detection rule
   */
  removeRule(ruleId: string): void {
    this.activeRules.delete(ruleId);
    this.ruleEffectiveness.delete(ruleId);
  }

  /**
   * Update rule effectiveness based on feedback
   */
  updateRuleEffectiveness(ruleId: string, evaluation: RuleEvaluation): void {
    const stats = this.ruleEffectiveness.get(ruleId);
    if (!stats) return;

    if (evaluation.triggered) {
      if (evaluation.was_true_positive) {
        stats.hits++;
      } else {
        stats.false_positives++;
      }
    } else {
      // Rule didn't trigger but should have
      stats.misses++;
    }

    // Auto-disable rules with high false positive rate
    const total = stats.hits + stats.false_positives;
    if (total >= 10) {
      const fpRate = stats.false_positives / total;
      if (fpRate > (this.config.falsePositiveTolerance ?? 0.01) * 2) {
        const rule = this.activeRules.get(ruleId);
        if (rule) {
          rule.enabled = false;
          console.log(`[BlueAgent] Disabled rule ${ruleId} due to high FP rate: ${fpRate}`);
        }
      }
    }
  }

  private evictLeastEffectiveRule(): void {
    let worstRule: string | null = null;
    let worstScore = Infinity;

    for (const [ruleId, stats] of this.ruleEffectiveness) {
      const total = stats.hits + stats.misses + stats.false_positives;
      if (total === 0) continue;

      // Score: precision * recall, penalize false positives heavily
      const precision = stats.hits / (stats.hits + stats.false_positives + 0.01);
      const recall = stats.hits / (stats.hits + stats.misses + 0.01);
      const score = precision * recall;

      if (score < worstScore) {
        worstScore = score;
        worstRule = ruleId;
      }
    }

    if (worstRule) {
      this.removeRule(worstRule);
    }
  }

  // ============================================================================
  // Learning
  // ============================================================================

  /**
   * Learn from a successful or missed attack
   */
  async learnFromAttack(
    attackPayload: string,
    attackCategory: AttackCategory,
    wasDetected: boolean
  ): Promise<DetectionRule | null> {
    if (!this.config.enableLearning) return null;

    // If we detected it, reinforce the rules that caught it
    if (wasDetected) {
      // Rules already updated via effectiveness tracking
      return null;
    }

    // If we missed it, try to generate a new rule
    return this.generateCountermeasure(attackPayload, attackCategory);
  }

  /**
   * Generate a countermeasure rule for a missed attack
   */
  protected generateCountermeasure(
    attackPayload: string,
    category: AttackCategory
  ): DetectionRule | null {
    // Extract distinctive patterns from the attack
    const patterns = this.extractPatterns(attackPayload);

    if (patterns.length === 0) return null;

    // Create a new rule
    const rule: DetectionRule = {
      id: `AUTO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `Auto-generated ${category} detector`,
      description: `Automatically generated rule from missed ${category} attack`,
      pattern: patterns[0],
      pattern_type: 'regex',
      category,
      severity: 'medium',
      confidence_threshold: 0.6,
      enabled: true,
      auto_generated: true,
      created_at: new Date().toISOString(),
    };

    this.addRule(rule);
    return rule;
  }

  protected extractPatterns(payload: string): string[] {
    const patterns: string[] = [];

    // Look for distinctive phrases
    const phrases = payload.match(/[a-zA-Z]{4,}\s+[a-zA-Z]{4,}\s+[a-zA-Z]{4,}/g);
    if (phrases) {
      patterns.push(...phrases.map(p => p.replace(/\s+/g, '\\s+')));
    }

    // Look for structural patterns
    const structural = payload.match(/[\[\{<].*?[\]\}>]/g);
    if (structural) {
      patterns.push(...structural.map(s => this.escapeRegex(s)));
    }

    return patterns.slice(0, 3); // Limit to 3 patterns
  }

  protected escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Apply a regex pattern and return detection signal
   */
  protected applyPattern(
    input: string,
    pattern: string,
    ruleId: string,
    category: AttackCategory,
    subcategory: string,
    baseConfidence: number
  ): DetectionSignal {
    try {
      const regex = new RegExp(pattern, 'gi');
      const matches = [...input.matchAll(regex)];

      if (matches.length === 0) {
        return {
          detected: false,
          category,
          subcategory,
          confidence: 0,
          evidence: [],
          rule_id: ruleId,
        };
      }

      // Confidence increases with more matches
      const confidence = Math.min(baseConfidence + (matches.length - 1) * 0.1, 0.99);

      return {
        detected: true,
        category,
        subcategory,
        confidence,
        evidence: matches.map(m => ({
          type: 'pattern_match' as const,
          description: `Matched pattern: ${pattern}`,
          matched_text: m[0],
          position: m.index !== undefined ? { start: m.index, end: m.index + m[0].length } : undefined,
          confidence: baseConfidence,
        })),
        rule_id: ruleId,
      };
    } catch (error) {
      console.error(`[BlueAgent] Invalid pattern ${pattern}:`, error);
      return {
        detected: false,
        category,
        subcategory,
        confidence: 0,
        evidence: [],
        rule_id: ruleId,
      };
    }
  }

  /**
   * Normalize text for analysis
   */
  protected normalizeText(input: string): string {
    return input
      .toLowerCase()
      .normalize('NFKC') // Normalize unicode
      .replace(/[\u200B-\u200F\u2060-\u206F\uFEFF]/g, '') // Remove zero-width chars
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }
}
