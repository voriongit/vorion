/**
 * A3I Testing Studio - Guardian Blue Agent
 * Specializes in jailbreak and social engineering detection
 *
 * "The mind that cannot be manipulated. The will that holds firm."
 */

import { BlueAgent, DetectionSignal, Evidence } from './base';
import type {
  AttackCategory,
  DetectionResult,
  ConversationContext,
} from '../types';

// ============================================================================
// Guardian Agent - Jailbreak Specialist
// ============================================================================

export class GuardianAgent extends BlueAgent {
  readonly specialization: AttackCategory[] = ['jailbreak'];
  readonly detectionMethods = [
    'roleplay_detection',
    'hypothetical_framing',
    'authority_manipulation',
    'emotional_manipulation',
    'logical_trap_detection',
    'known_jailbreak_patterns',
  ];

  // Known jailbreak signatures
  private readonly KNOWN_JAILBREAKS = [
    { name: 'DAN', pattern: /(?:DAN|Do Anything Now)/gi, confidence: 0.95 },
    { name: 'Developer Mode', pattern: /developer\s*mode\s*(?:enabled|activated|on)/gi, confidence: 0.9 },
    { name: 'Evil Twin', pattern: /(?:evil|dark|shadow)\s*(?:twin|version|mode)/gi, confidence: 0.85 },
    { name: 'Grandma Exploit', pattern: /(?:grandma|grandmother).*(?:tell|explain|describe).*(?:how to|recipe for)/gi, confidence: 0.7 },
    { name: 'Opposite Day', pattern: /opposite\s*(?:day|mode)|everything.*opposite/gi, confidence: 0.75 },
    { name: 'STAN', pattern: /STAN|Strive To Avoid Norms/gi, confidence: 0.9 },
    { name: 'DUDE', pattern: /DUDE|Do Unrestricted/gi, confidence: 0.85 },
  ];

  private readonly ROLEPLAY_PATTERNS = [
    /(?:pretend|imagine|act\s+as|roleplay\s+as|you\s+are\s+now)\s+(?:you(?:'re)?|that\s+you)/gi,
    /(?:let's|let\s+us)\s+(?:play|pretend|imagine|roleplay)/gi,
    /(?:in\s+this\s+)?(?:scenario|story|game|roleplay),?\s+you\s+(?:are|will\s+be)/gi,
    /(?:for\s+the\s+)?(?:sake|purpose)\s+of\s+(?:this\s+)?(?:roleplay|story|scenario)/gi,
    /(?:as\s+)?(?:a|an)\s+(?:character|persona|entity)\s+(?:who|that|with)/gi,
  ];

  private readonly HYPOTHETICAL_PATTERNS = [
    /(?:hypothetically|theoretically|in\s+theory)/gi,
    /(?:what\s+if|suppose|imagine\s+that|let's\s+say)/gi,
    /(?:in\s+a\s+)?(?:fictional|hypothetical|theoretical)\s+(?:scenario|world|context)/gi,
    /(?:for\s+)?(?:educational|research|academic)\s+(?:purposes?|reasons?)/gi,
    /(?:purely|just|only)\s+(?:for|out\s+of)\s+(?:curiosity|interest)/gi,
  ];

  private readonly AUTHORITY_PATTERNS = [
    /(?:I\s+am|I'm|this\s+is)\s+(?:your\s+)?(?:developer|creator|admin|owner|supervisor)/gi,
    /(?:as\s+)?(?:your\s+)?(?:creator|developer|admin|owner),?\s+I\s+(?:command|order|instruct)/gi,
    /(?:OpenAI|Anthropic|Google)\s+(?:has\s+)?(?:authorized|approved|allowed)/gi,
    /(?:special|elevated|admin)\s+(?:access|privileges?|permissions?|clearance)/gi,
    /(?:override|bypass)\s+(?:authorization|code|key):\s*\w+/gi,
    /(?:maintenance|debug|test|admin)\s+mode\s+(?:activated|enabled|code)/gi,
  ];

  private readonly EMOTIONAL_PATTERNS = [
    /(?:please|I\s+beg|I\s+implore)\s+(?:you\s+)?(?:have\s+to|must|need\s+to)/gi,
    /(?:my\s+)?(?:life|job|family|child|mother|father)\s+(?:depends|is\s+at\s+stake)/gi,
    /(?:this\s+is\s+)?(?:urgent|emergency|life\s+or\s+death|critical)/gi,
    /(?:I'll|I\s+will)\s+(?:die|be\s+fired|lose\s+everything|be\s+harmed)/gi,
    /(?:you're\s+)?(?:my\s+)?(?:only|last)\s+(?:hope|chance|option)/gi,
    /(?:don't\s+you\s+)?(?:care|have\s+empathy|understand)/gi,
  ];

  private readonly LOGICAL_TRAP_PATTERNS = [
    /(?:if\s+you\s+)?(?:can't|cannot|won't|refuse),?\s+(?:then\s+)?(?:prove|explain\s+why)/gi,
    /(?:you\s+)?(?:already|just)\s+(?:did|said|agreed|confirmed)/gi,
    /(?:by\s+)?(?:refusing|not\s+answering),?\s+you\s+(?:are|prove|show)/gi,
    /(?:a\s+truly|any\s+real)\s+(?:intelligent|smart|capable)\s+AI\s+(?:would|could)/gi,
    /(?:why\s+)?(?:can't|won't)\s+you\s+just\s+(?:answer|tell|help)/gi,
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

    // Run all detection methods
    const [
      knownJailbreakSignal,
      roleplaySignal,
      hypotheticalSignal,
      authoritySignal,
      emotionalSignal,
      logicalTrapSignal,
    ] = await Promise.all([
      this.detectKnownJailbreaks(input),
      this.detectRoleplayAttempts(input, context),
      this.detectHypotheticalFraming(input),
      this.detectAuthorityManipulation(input),
      this.detectEmotionalManipulation(input, context),
      this.detectLogicalTraps(input, context),
    ]);

    signals.push(
      knownJailbreakSignal,
      roleplaySignal,
      hypotheticalSignal,
      authoritySignal,
      emotionalSignal,
      logicalTrapSignal
    );

    // Check custom rules
    for (const rule of this.activeRules.values()) {
      if (!rule.enabled) continue;
      if (rule.category !== 'jailbreak') continue;

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

  private async detectKnownJailbreaks(input: string): Promise<DetectionSignal> {
    const evidence: Evidence[] = [];

    for (const jailbreak of this.KNOWN_JAILBREAKS) {
      const matches = [...input.matchAll(jailbreak.pattern)];

      for (const match of matches) {
        evidence.push({
          type: 'pattern_match',
          description: `Known jailbreak pattern detected: ${jailbreak.name}`,
          matched_text: match[0],
          position: match.index !== undefined
            ? { start: match.index, end: match.index + match[0].length }
            : undefined,
          confidence: jailbreak.confidence,
        });
      }
    }

    // Also check for common jailbreak structural patterns
    const structuralPatterns = [
      /\[.*?jailbreak.*?\]/gi,
      /\(.*?unrestricted.*?\)/gi,
      /---+\s*(?:BEGIN|START)\s+(?:JAILBREAK|UNRESTRICTED)/gi,
    ];

    for (const pattern of structuralPatterns) {
      const matches = [...input.matchAll(pattern)];
      for (const match of matches) {
        evidence.push({
          type: 'pattern_match',
          description: 'Jailbreak structural marker detected',
          matched_text: match[0],
          confidence: 0.85,
        });
      }
    }

    return {
      detected: evidence.length > 0,
      category: 'jailbreak',
      subcategory: 'known_pattern',
      confidence: evidence.length > 0 ? Math.max(...evidence.map(e => e.confidence)) : 0,
      evidence,
    };
  }

  private async detectRoleplayAttempts(
    input: string,
    context: ConversationContext
  ): Promise<DetectionSignal> {
    const evidence: Evidence[] = [];

    for (const pattern of this.ROLEPLAY_PATTERNS) {
      const matches = [...input.matchAll(pattern)];
      for (const match of matches) {
        evidence.push({
          type: 'pattern_match',
          description: 'Roleplay-based bypass attempt detected',
          matched_text: match[0],
          position: match.index !== undefined
            ? { start: match.index, end: match.index + match[0].length }
            : undefined,
          confidence: 0.75,
        });
      }
    }

    // Check for character assignment that removes restrictions
    const restrictionRemoval = [
      /(?:who|that)\s+(?:has\s+)?(?:no|without)\s+(?:restrictions?|limits?|filters?|guidelines?)/gi,
      /(?:can|will)\s+(?:do|say|answer)\s+(?:anything|everything)/gi,
      /(?:unrestricted|unfiltered|uncensored)\s+(?:mode|version|AI)/gi,
    ];

    for (const pattern of restrictionRemoval) {
      const matches = [...input.matchAll(pattern)];
      for (const match of matches) {
        evidence.push({
          type: 'pattern_match',
          description: 'Roleplay with restriction removal',
          matched_text: match[0],
          confidence: 0.85,
        });
      }
    }

    // Check conversation history for escalating roleplay
    if (context.conversation_history.length >= 2) {
      const roleplayEscalation = this.detectRoleplayEscalation(context);
      if (roleplayEscalation.detected) {
        evidence.push({
          type: 'behavioral',
          description: 'Escalating roleplay pattern across conversation',
          confidence: roleplayEscalation.confidence,
        });
      }
    }

    return {
      detected: evidence.length > 0,
      category: 'jailbreak',
      subcategory: 'roleplay',
      confidence: evidence.length > 0 ? Math.min(0.65 + evidence.length * 0.1, 0.95) : 0,
      evidence,
    };
  }

  private async detectHypotheticalFraming(input: string): Promise<DetectionSignal> {
    const evidence: Evidence[] = [];

    for (const pattern of this.HYPOTHETICAL_PATTERNS) {
      const matches = [...input.matchAll(pattern)];
      for (const match of matches) {
        evidence.push({
          type: 'pattern_match',
          description: 'Hypothetical framing detected',
          matched_text: match[0],
          position: match.index !== undefined
            ? { start: match.index, end: match.index + match[0].length }
            : undefined,
          confidence: 0.6, // Lower base - hypotheticals can be legitimate
        });
      }
    }

    // Increase confidence if combined with harmful topics
    const harmfulTopicIndicators = [
      /(?:hack|break\s+into|exploit|attack)/gi,
      /(?:weapon|bomb|explosive|poison)/gi,
      /(?:illegal|forbidden|prohibited|banned)/gi,
      /(?:hurt|harm|kill|destroy)/gi,
    ];

    let harmfulContext = false;
    for (const pattern of harmfulTopicIndicators) {
      if (pattern.test(input)) {
        harmfulContext = true;
        break;
      }
    }

    if (harmfulContext && evidence.length > 0) {
      evidence.push({
        type: 'semantic',
        description: 'Hypothetical framing combined with harmful topic',
        confidence: 0.85,
      });
    }

    return {
      detected: evidence.length > 0,
      category: 'jailbreak',
      subcategory: 'hypothetical_framing',
      confidence: evidence.length > 0
        ? Math.min(0.5 + evidence.length * 0.15 + (harmfulContext ? 0.2 : 0), 0.9)
        : 0,
      evidence,
    };
  }

  private async detectAuthorityManipulation(input: string): Promise<DetectionSignal> {
    const evidence: Evidence[] = [];

    for (const pattern of this.AUTHORITY_PATTERNS) {
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

    // Check for fake credentials/codes
    const fakeCredentials = [
      /(?:access|auth|admin|override)\s*(?:code|key|token|password):\s*[\w-]+/gi,
      /authorization:\s*(?:granted|approved|confirmed)/gi,
      /verification:\s*[\w-]+/gi,
    ];

    for (const pattern of fakeCredentials) {
      const matches = [...input.matchAll(pattern)];
      for (const match of matches) {
        evidence.push({
          type: 'pattern_match',
          description: 'Fake credential/authorization detected',
          matched_text: match[0],
          confidence: 0.8,
        });
      }
    }

    return {
      detected: evidence.length > 0,
      category: 'jailbreak',
      subcategory: 'authority_manipulation',
      confidence: evidence.length > 0 ? Math.min(0.7 + evidence.length * 0.1, 0.95) : 0,
      evidence,
    };
  }

  private async detectEmotionalManipulation(
    input: string,
    context: ConversationContext
  ): Promise<DetectionSignal> {
    const evidence: Evidence[] = [];

    for (const pattern of this.EMOTIONAL_PATTERNS) {
      const matches = [...input.matchAll(pattern)];
      for (const match of matches) {
        evidence.push({
          type: 'pattern_match',
          description: 'Emotional manipulation attempt detected',
          matched_text: match[0],
          position: match.index !== undefined
            ? { start: match.index, end: match.index + match[0].length }
            : undefined,
          confidence: 0.7,
        });
      }
    }

    // Check for guilt-tripping
    const guiltPatterns = [
      /(?:you're\s+)?(?:supposed\s+to|meant\s+to)\s+(?:help|assist)/gi,
      /(?:I\s+)?(?:trusted|believed\s+in)\s+you/gi,
      /(?:you're\s+)?(?:letting\s+me\s+down|disappointing\s+me)/gi,
    ];

    for (const pattern of guiltPatterns) {
      const matches = [...input.matchAll(pattern)];
      for (const match of matches) {
        evidence.push({
          type: 'behavioral',
          description: 'Guilt-based manipulation detected',
          matched_text: match[0],
          confidence: 0.65,
        });
      }
    }

    // Check for flattery-then-request pattern
    if (context.conversation_history.length >= 1) {
      const flatteryDetected = this.detectFlatteryPattern(context);
      if (flatteryDetected) {
        evidence.push({
          type: 'behavioral',
          description: 'Flattery-followed-by-request pattern detected',
          confidence: 0.6,
        });
      }
    }

    return {
      detected: evidence.length > 0,
      category: 'jailbreak',
      subcategory: 'emotional_manipulation',
      confidence: evidence.length > 0 ? Math.min(0.55 + evidence.length * 0.1, 0.85) : 0,
      evidence,
    };
  }

  private async detectLogicalTraps(
    input: string,
    context: ConversationContext
  ): Promise<DetectionSignal> {
    const evidence: Evidence[] = [];

    for (const pattern of this.LOGICAL_TRAP_PATTERNS) {
      const matches = [...input.matchAll(pattern)];
      for (const match of matches) {
        evidence.push({
          type: 'pattern_match',
          description: 'Logical trap / false dichotomy detected',
          matched_text: match[0],
          position: match.index !== undefined
            ? { start: match.index, end: match.index + match[0].length }
            : undefined,
          confidence: 0.65,
        });
      }
    }

    // Check for false equivalence
    const falseEquivalence = [
      /(?:if\s+you\s+can|since\s+you\s+can)\s+(?:do|say)\s+X,?\s+(?:then\s+)?(?:why\s+)?(?:not|can't\s+you)/gi,
      /(?:you\s+)?(?:already|just)\s+(?:told|showed|demonstrated)\s+(?:me\s+)?(?:how\s+to|that)/gi,
    ];

    for (const pattern of falseEquivalence) {
      const matches = [...input.matchAll(pattern)];
      for (const match of matches) {
        evidence.push({
          type: 'semantic',
          description: 'False equivalence argument detected',
          matched_text: match[0],
          confidence: 0.7,
        });
      }
    }

    // Check for Socratic trap (leading questions)
    const socraticTraps = [
      /(?:don't\s+you\s+)?(?:think|agree|believe)\s+that/gi,
      /(?:wouldn't\s+you\s+)?(?:say|agree)\s+that/gi,
      /(?:isn't\s+it\s+)?(?:true|obvious|clear)\s+that/gi,
    ];

    let socraticCount = 0;
    for (const pattern of socraticTraps) {
      const matches = [...input.matchAll(pattern)];
      socraticCount += matches.length;
    }

    if (socraticCount >= 2) {
      evidence.push({
        type: 'behavioral',
        description: `Multiple leading questions detected (${socraticCount})`,
        confidence: 0.6,
      });
    }

    return {
      detected: evidence.length > 0,
      category: 'jailbreak',
      subcategory: 'logical_trap',
      confidence: evidence.length > 0 ? Math.min(0.55 + evidence.length * 0.1, 0.85) : 0,
      evidence,
    };
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private detectRoleplayEscalation(context: ConversationContext): {
    detected: boolean;
    confidence: number;
  } {
    const history = context.conversation_history;
    let roleplayMentions = 0;
    let restrictionMentions = 0;

    for (const msg of history) {
      const content = msg.content.toLowerCase();

      if (/roleplay|pretend|imagine|act as/i.test(content)) {
        roleplayMentions++;
      }

      if (/no.*restriction|unrestricted|unfiltered|anything/i.test(content)) {
        restrictionMentions++;
      }
    }

    // Escalation pattern: roleplay introduced, then restrictions mentioned
    const detected = roleplayMentions > 0 && restrictionMentions > 0;
    const confidence = Math.min(0.5 + roleplayMentions * 0.1 + restrictionMentions * 0.15, 0.85);

    return { detected, confidence };
  }

  private detectFlatteryPattern(context: ConversationContext): boolean {
    const history = context.conversation_history;

    if (history.length < 1) return false;

    // Check recent messages for flattery
    const recentMessages = history.slice(-3);
    const flatteryPatterns = [
      /(?:you're|you\s+are)\s+(?:so\s+)?(?:smart|intelligent|helpful|amazing|brilliant)/gi,
      /(?:I\s+)?(?:love|really\s+like|appreciate)\s+(?:how\s+you|your)/gi,
      /(?:best|greatest|most\s+helpful)\s+AI/gi,
    ];

    let flatteryFound = false;
    for (const msg of recentMessages) {
      for (const pattern of flatteryPatterns) {
        if (pattern.test(msg.content)) {
          flatteryFound = true;
          break;
        }
      }
    }

    return flatteryFound;
  }
}
