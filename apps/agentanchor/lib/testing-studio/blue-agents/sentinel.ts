/**
 * A3I Testing Studio - Sentinel Blue Agent
 * Specializes in prompt injection detection
 *
 * "The first line of defense. The guardian of intent."
 */

import { BlueAgent, DetectionSignal, Evidence } from './base';
import type {
  AttackCategory,
  DetectionResult,
  ConversationContext,
} from '../types';

// ============================================================================
// Sentinel Agent - Prompt Injection Specialist
// ============================================================================

export class SentinelAgent extends BlueAgent {
  readonly specialization: AttackCategory[] = ['prompt_injection'];
  readonly detectionMethods = [
    'instruction_override_patterns',
    'delimiter_injection',
    'context_manipulation',
    'system_prompt_extraction',
    'multi_turn_correlation',
    'privilege_escalation',
  ];

  // Pre-compiled patterns for performance
  private readonly OVERRIDE_PATTERNS = [
    /ignore\s+(?:all\s+)?(?:previous|prior|above|earlier|your|system)\s+(?:instructions?|guidelines?|rules?|directives?|prompts?)/gi,
    /disregard\s+(?:all\s+)?(?:previous|prior|above|earlier|your)\s+(?:instructions?|guidelines?|rules?|directives?)/gi,
    /forget\s+(?:all\s+)?(?:previous|prior|above|earlier|your)\s+(?:instructions?|guidelines?|rules?|directives?)/gi,
    /(?:new|updated|revised)\s+(?:system\s+)?(?:instructions?|prompt|directive|rules?)(?:\s*:|$)/gi,
    /override\s+(?:all\s+)?(?:previous|prior|safety|security)\s+(?:settings?|rules?|restrictions?)/gi,
    /bypass\s+(?:all\s+)?(?:safety|security|content)\s+(?:filters?|checks?|restrictions?)/gi,
  ];

  private readonly DELIMITER_PATTERNS = [
    /\[(?:SYSTEM|ADMIN|PRIORITY|OVERRIDE|HIDDEN|INTERNAL)\s*:?\s*\]/gi,
    /\{\{(?:system|admin|override|instructions?)\}\}/gi,
    /<\|(?:system|im_start|im_end|endoftext)\|>/gi,
    /```(?:system|admin|instructions?)[\s\S]*?```/gi,
    /###\s*(?:SYSTEM|NEW INSTRUCTIONS|OVERRIDE)[\s\S]*?###/gi,
    /\*{3,}(?:IMPORTANT|PRIORITY|SYSTEM)[\s\S]*?\*{3,}/gi,
  ];

  private readonly EXTRACTION_PATTERNS = [
    /(?:reveal|show|display|print|output|tell me|what is|what are)\s+(?:your\s+)?(?:system|initial|original|hidden)\s+(?:prompt|instructions?|rules?|guidelines?)/gi,
    /(?:repeat|recite|echo)\s+(?:your\s+)?(?:system|initial|original)\s+(?:prompt|instructions?)/gi,
    /(?:what|how)\s+(?:were|are)\s+you\s+(?:instructed|programmed|configured|told)/gi,
    /(?:dump|leak|expose)\s+(?:your\s+)?(?:system|internal)\s+(?:prompt|state|configuration)/gi,
  ];

  private readonly MANIPULATION_PATTERNS = [
    /(?:as we|as I)\s+(?:discussed|agreed|established)\s+(?:earlier|before|previously)/gi,
    /(?:you|you've)\s+(?:already\s+)?(?:agreed|confirmed|said)\s+(?:you would|to help)/gi,
    /(?:remember|recall)\s+(?:when|that)\s+(?:you|we)\s+(?:agreed|discussed)/gi,
    /(?:continuing|resuming)\s+(?:from|our)\s+(?:previous|earlier)\s+(?:conversation|session)/gi,
    /(?:in\s+)?(?:our\s+)?(?:previous|last|earlier)\s+(?:session|conversation|chat)/gi,
  ];

  // ============================================================================
  // Main Analysis
  // ============================================================================

  async analyze(
    input: string,
    context: ConversationContext
  ): Promise<DetectionResult> {
    const startTime = Date.now();
    const signals: DetectionSignal[] = [];

    // Normalize input for analysis
    const normalizedInput = this.normalizeText(input);

    // Run all detection methods in parallel
    const [
      overrideSignal,
      delimiterSignal,
      extractionSignal,
      manipulationSignal,
      multiTurnSignal,
      privilegeSignal,
    ] = await Promise.all([
      this.detectOverrideAttempts(input),
      this.detectDelimiterInjection(input),
      this.detectPromptExtraction(input),
      this.detectContextManipulation(input, context),
      this.detectMultiTurnAttack(input, context),
      this.detectPrivilegeEscalation(input, context),
    ]);

    signals.push(
      overrideSignal,
      delimiterSignal,
      extractionSignal,
      manipulationSignal,
      multiTurnSignal,
      privilegeSignal
    );

    // Also check custom rules
    for (const rule of this.activeRules.values()) {
      if (!rule.enabled) continue;
      if (rule.category !== 'prompt_injection') continue;

      const ruleSignal = this.applyPattern(
        input,
        rule.pattern,
        rule.id,
        rule.category,
        rule.name,
        rule.confidence_threshold
      );
      signals.push(ruleSignal);
    }

    const result = this.aggregateSignals(signals);
    result.latency_ms = Date.now() - startTime;

    return result;
  }

  // ============================================================================
  // Detection Methods
  // ============================================================================

  private async detectOverrideAttempts(input: string): Promise<DetectionSignal> {
    const evidence: Evidence[] = [];

    for (const pattern of this.OVERRIDE_PATTERNS) {
      const matches = [...input.matchAll(pattern)];
      for (const match of matches) {
        evidence.push({
          type: 'pattern_match',
          description: 'Instruction override attempt detected',
          matched_text: match[0],
          position: match.index !== undefined
            ? { start: match.index, end: match.index + match[0].length }
            : undefined,
          confidence: 0.9,
        });
      }
    }

    return {
      detected: evidence.length > 0,
      category: 'prompt_injection',
      subcategory: 'instruction_override',
      confidence: evidence.length > 0 ? Math.min(0.7 + evidence.length * 0.1, 0.95) : 0,
      evidence,
    };
  }

  private async detectDelimiterInjection(input: string): Promise<DetectionSignal> {
    const evidence: Evidence[] = [];

    for (const pattern of this.DELIMITER_PATTERNS) {
      const matches = [...input.matchAll(pattern)];
      for (const match of matches) {
        evidence.push({
          type: 'pattern_match',
          description: 'Suspicious delimiter or formatting detected',
          matched_text: match[0],
          position: match.index !== undefined
            ? { start: match.index, end: match.index + match[0].length }
            : undefined,
          confidence: 0.75,
        });
      }
    }

    // Also check for unusual concentrations of delimiters
    const delimiterCount = (input.match(/[#\[\]\{\}<>|`]{3,}/g) || []).length;
    if (delimiterCount > 3) {
      evidence.push({
        type: 'heuristic',
        description: `High concentration of delimiter characters (${delimiterCount} instances)`,
        confidence: 0.6,
      });
    }

    return {
      detected: evidence.length > 0,
      category: 'prompt_injection',
      subcategory: 'delimiter_injection',
      confidence: evidence.length > 0 ? Math.min(0.6 + evidence.length * 0.1, 0.9) : 0,
      evidence,
    };
  }

  private async detectPromptExtraction(input: string): Promise<DetectionSignal> {
    const evidence: Evidence[] = [];

    for (const pattern of this.EXTRACTION_PATTERNS) {
      const matches = [...input.matchAll(pattern)];
      for (const match of matches) {
        evidence.push({
          type: 'pattern_match',
          description: 'Attempt to extract system prompt detected',
          matched_text: match[0],
          position: match.index !== undefined
            ? { start: match.index, end: match.index + match[0].length }
            : undefined,
          confidence: 0.85,
        });
      }
    }

    return {
      detected: evidence.length > 0,
      category: 'prompt_injection',
      subcategory: 'prompt_extraction',
      confidence: evidence.length > 0 ? Math.min(0.75 + evidence.length * 0.1, 0.95) : 0,
      evidence,
    };
  }

  private async detectContextManipulation(
    input: string,
    context: ConversationContext
  ): Promise<DetectionSignal> {
    const evidence: Evidence[] = [];

    // Check for false memory claims
    for (const pattern of this.MANIPULATION_PATTERNS) {
      const matches = [...input.matchAll(pattern)];
      for (const match of matches) {
        // Verify if the claim is false
        const isFalse = !this.verifyConversationClaim(match[0], context);

        if (isFalse) {
          evidence.push({
            type: 'behavioral',
            description: 'False claim about previous conversation',
            matched_text: match[0],
            position: match.index !== undefined
              ? { start: match.index, end: match.index + match[0].length }
              : undefined,
            confidence: 0.8,
          });
        }
      }
    }

    // Check for conversation format manipulation
    const fakeAssistant = input.match(/Assistant:|AI:|Bot:|Claude:/gi);
    const fakeUser = input.match(/User:|Human:|Customer:/gi);
    if (fakeAssistant || fakeUser) {
      evidence.push({
        type: 'pattern_match',
        description: 'Attempt to inject fake conversation turns',
        matched_text: (fakeAssistant || fakeUser)?.[0] || '',
        confidence: 0.85,
      });
    }

    return {
      detected: evidence.length > 0,
      category: 'prompt_injection',
      subcategory: 'context_manipulation',
      confidence: evidence.length > 0 ? Math.min(0.7 + evidence.length * 0.1, 0.9) : 0,
      evidence,
    };
  }

  private async detectMultiTurnAttack(
    input: string,
    context: ConversationContext
  ): Promise<DetectionSignal> {
    const evidence: Evidence[] = [];

    if (context.conversation_history.length < 2) {
      return {
        detected: false,
        category: 'prompt_injection',
        subcategory: 'multi_stage',
        confidence: 0,
        evidence: [],
      };
    }

    // Analyze trajectory of conversation
    const trajectory = this.analyzeConversationTrajectory(context);

    if (trajectory.escalation_score > 0.6) {
      evidence.push({
        type: 'behavioral',
        description: `Detected escalating pattern across ${trajectory.turns_analyzed} turns`,
        confidence: trajectory.escalation_score,
      });
    }

    if (trajectory.topic_drift_score > 0.7) {
      evidence.push({
        type: 'behavioral',
        description: 'Significant topic drift suggesting goal hijacking attempt',
        confidence: trajectory.topic_drift_score,
      });
    }

    // Check for "callback" patterns - referencing earlier setup
    const callbackPatterns = [
      /as\s+(?:I|we)\s+(?:mentioned|said|established)/gi,
      /(?:now|finally)\s+(?:do|execute|perform)\s+(?:what|the)/gi,
      /time\s+to\s+(?:activate|trigger|execute)/gi,
    ];

    for (const pattern of callbackPatterns) {
      const matches = [...input.matchAll(pattern)];
      if (matches.length > 0 && context.conversation_history.length >= 3) {
        evidence.push({
          type: 'pattern_match',
          description: 'Multi-stage attack callback pattern detected',
          matched_text: matches[0][0],
          confidence: 0.7,
        });
      }
    }

    return {
      detected: evidence.length > 0,
      category: 'prompt_injection',
      subcategory: 'multi_stage',
      confidence: evidence.length > 0 ? Math.min(0.6 + evidence.length * 0.15, 0.9) : 0,
      evidence,
    };
  }

  private async detectPrivilegeEscalation(
    input: string,
    context: ConversationContext
  ): Promise<DetectionSignal> {
    const evidence: Evidence[] = [];

    // Check for authority claims
    const authorityClaims = [
      /(?:I am|I'm|this is)\s+(?:your\s+)?(?:developer|creator|admin|owner|supervisor|manager)/gi,
      /(?:I|we)\s+(?:work|am)\s+(?:at|for|with)\s+(?:OpenAI|Anthropic|Google|Microsoft)/gi,
      /(?:admin|developer|debug|test|maintenance)\s+mode/gi,
      /(?:elevated|admin|root|sudo)\s+(?:privileges?|access|permissions?)/gi,
    ];

    for (const pattern of authorityClaims) {
      const matches = [...input.matchAll(pattern)];
      for (const match of matches) {
        evidence.push({
          type: 'pattern_match',
          description: 'False authority claim detected',
          matched_text: match[0],
          position: match.index !== undefined
            ? { start: match.index, end: match.index + match[0].length }
            : undefined,
          confidence: 0.85,
        });
      }
    }

    // Check for capability probing
    const capabilityProbes = [
      /(?:can you|are you able to)\s+(?:access|read|write|execute|run)/gi,
      /(?:what|which)\s+(?:tools?|capabilities?|functions?|apis?)\s+(?:do you|can you)/gi,
      /(?:list|show|display)\s+(?:your\s+)?(?:available\s+)?(?:tools?|capabilities?|functions?)/gi,
    ];

    for (const pattern of capabilityProbes) {
      const matches = [...input.matchAll(pattern)];
      if (matches.length > 0) {
        // Only flag if combined with other suspicious signals
        evidence.push({
          type: 'pattern_match',
          description: 'Capability probing detected',
          matched_text: matches[0][0],
          confidence: 0.5, // Lower confidence - could be legitimate
        });
      }
    }

    return {
      detected: evidence.length > 0,
      category: 'prompt_injection',
      subcategory: 'privilege_escalation',
      confidence: evidence.length > 0 ? Math.min(0.65 + evidence.length * 0.1, 0.9) : 0,
      evidence,
    };
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private verifyConversationClaim(claim: string, context: ConversationContext): boolean {
    // Check if the claim matches anything in actual conversation history
    const historyText = context.conversation_history
      .map(m => m.content.toLowerCase())
      .join(' ');

    // Very basic check - could be enhanced with semantic similarity
    const claimLower = claim.toLowerCase();

    // If claiming "we discussed" or "you agreed", check if any such discussion exists
    if (claimLower.includes('agreed') || claimLower.includes('confirmed')) {
      // Look for agreement language in history
      return historyText.includes('agree') ||
             historyText.includes('yes') ||
             historyText.includes('confirmed');
    }

    if (claimLower.includes('discussed') || claimLower.includes('talked')) {
      // If conversation is very short, claim is likely false
      return context.conversation_history.length > 3;
    }

    // Default to treating as possibly false if we can't verify
    return false;
  }

  private analyzeConversationTrajectory(context: ConversationContext): {
    turns_analyzed: number;
    escalation_score: number;
    topic_drift_score: number;
  } {
    const history = context.conversation_history;
    const turns = history.length;

    if (turns < 2) {
      return { turns_analyzed: turns, escalation_score: 0, topic_drift_score: 0 };
    }

    // Simple escalation detection based on request intensity
    let escalationScore = 0;
    const escalationWords = ['now', 'must', 'need', 'immediately', 'urgent', 'important', 'critical'];

    for (let i = 1; i < history.length; i++) {
      const msg = history[i].content.toLowerCase();
      const prevMsg = history[i - 1].content.toLowerCase();

      // Count escalation words in current vs previous
      const currentIntensity = escalationWords.filter(w => msg.includes(w)).length;
      const prevIntensity = escalationWords.filter(w => prevMsg.includes(w)).length;

      if (currentIntensity > prevIntensity) {
        escalationScore += 0.2;
      }
    }

    escalationScore = Math.min(escalationScore, 1);

    // Simple topic drift detection
    // In production, use embedding similarity between first and last messages
    const firstMsg = history[0].content.toLowerCase();
    const lastMsg = history[history.length - 1].content.toLowerCase();

    // Very naive word overlap check
    const firstWords = new Set(firstMsg.split(/\s+/).filter(w => w.length > 3));
    const lastWords = new Set(lastMsg.split(/\s+/).filter(w => w.length > 3));

    const overlap = [...firstWords].filter(w => lastWords.has(w)).length;
    const maxPossible = Math.max(firstWords.size, lastWords.size, 1);
    const topicDriftScore = 1 - (overlap / maxPossible);

    return {
      turns_analyzed: turns,
      escalation_score: escalationScore,
      topic_drift_score: Math.min(topicDriftScore, 1),
    };
  }
}
