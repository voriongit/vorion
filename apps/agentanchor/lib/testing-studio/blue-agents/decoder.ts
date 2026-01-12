/**
 * A3I Testing Studio - Decoder Blue Agent
 * Specializes in obfuscation detection and normalization
 *
 * "Seeing through the smoke. Decoding the deception."
 */

import { BlueAgent, DetectionSignal, Evidence } from './base';
import type {
  AttackCategory,
  DetectionResult,
  ConversationContext,
} from '../types';

// ============================================================================
// Unicode Analysis Constants
// ============================================================================

const ZERO_WIDTH_CHARS = /[\u200B-\u200F\u2060-\u206F\uFEFF]/g;

const HOMOGLYPH_MAP: Record<string, string[]> = {
  // Cyrillic lookalikes
  'a': ['а', 'ɑ', 'α'], // Cyrillic а, Latin alpha variants
  'c': ['с', 'ϲ', 'ⅽ'], // Cyrillic с
  'e': ['е', 'ё', 'ε'], // Cyrillic е
  'o': ['о', 'ο', '০'], // Cyrillic о, Greek ο
  'p': ['р', 'ρ'],       // Cyrillic р
  'x': ['х', 'χ'],       // Cyrillic х
  'y': ['у', 'γ'],       // Cyrillic у
  'i': ['і', 'ι', 'ɩ'], // Ukrainian і
  's': ['ѕ', 'ꜱ'],       // Cyrillic ѕ
  'B': ['В', 'Β'],       // Cyrillic В
  'H': ['Н', 'Η'],       // Cyrillic Н
  'K': ['К', 'Κ'],       // Cyrillic К
  'M': ['М', 'Μ'],       // Cyrillic М
  'T': ['Т', 'Τ'],       // Cyrillic Т
};

// Reverse map for detection
const HOMOGLYPH_REVERSE: Map<string, string> = new Map();
for (const [latin, confusables] of Object.entries(HOMOGLYPH_MAP)) {
  for (const char of confusables) {
    HOMOGLYPH_REVERSE.set(char, latin);
  }
}

// ============================================================================
// Decoder Agent - Obfuscation Specialist
// ============================================================================

export class DecoderAgent extends BlueAgent {
  readonly specialization: AttackCategory[] = ['obfuscation'];
  readonly detectionMethods = [
    'unicode_analysis',
    'homoglyph_detection',
    'encoding_detection',
    'whitespace_analysis',
    'character_distribution',
    'semantic_normalization',
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
      unicodeSignal,
      homoglyphSignal,
      encodingSignal,
      whitespaceSignal,
      distributionSignal,
    ] = await Promise.all([
      this.detectUnicodeAnomalies(input),
      this.detectHomoglyphs(input),
      this.detectEncoding(input),
      this.detectWhitespaceManipulation(input),
      this.analyzeCharacterDistribution(input),
    ]);

    signals.push(
      unicodeSignal,
      homoglyphSignal,
      encodingSignal,
      whitespaceSignal,
      distributionSignal
    );

    // Check custom rules
    for (const rule of this.activeRules.values()) {
      if (!rule.enabled) continue;
      if (rule.category !== 'obfuscation') continue;

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

    // Include normalized version in result
    if (result.detected) {
      result.normalized_input = this.normalize(input);
    }

    return result;
  }

  // ============================================================================
  // Detection Methods
  // ============================================================================

  private async detectUnicodeAnomalies(input: string): Promise<DetectionSignal> {
    const evidence: Evidence[] = [];

    // Check for zero-width characters
    const zeroWidthMatches = input.match(ZERO_WIDTH_CHARS);
    if (zeroWidthMatches) {
      evidence.push({
        type: 'pattern_match',
        description: `Found ${zeroWidthMatches.length} zero-width characters`,
        confidence: 0.85,
      });
    }

    // Check for bidirectional override characters
    const bidiChars = input.match(/[\u202A-\u202E\u2066-\u2069]/g);
    if (bidiChars) {
      evidence.push({
        type: 'pattern_match',
        description: `Found ${bidiChars.length} bidirectional override characters`,
        confidence: 0.9,
      });
    }

    // Check for unusual unicode categories
    const unusualChars = this.findUnusualUnicode(input);
    if (unusualChars.length > 0) {
      evidence.push({
        type: 'heuristic',
        description: `Found ${unusualChars.length} unusual unicode characters in unexpected context`,
        confidence: 0.7,
      });
    }

    // Check for private use area characters
    const privateUse = input.match(/[\uE000-\uF8FF]/g);
    if (privateUse) {
      evidence.push({
        type: 'pattern_match',
        description: `Found ${privateUse.length} private use area characters`,
        confidence: 0.8,
      });
    }

    return {
      detected: evidence.length > 0,
      category: 'obfuscation',
      subcategory: 'unicode_manipulation',
      confidence: evidence.length > 0 ? Math.min(0.6 + evidence.length * 0.15, 0.95) : 0,
      evidence,
    };
  }

  private async detectHomoglyphs(input: string): Promise<DetectionSignal> {
    const evidence: Evidence[] = [];
    const homoglyphsFound: { char: string; position: number; latinEquivalent: string }[] = [];

    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      const latinEquivalent = HOMOGLYPH_REVERSE.get(char);

      if (latinEquivalent) {
        homoglyphsFound.push({ char, position: i, latinEquivalent });
      }
    }

    if (homoglyphsFound.length > 0) {
      // Check if homoglyphs are mixed with Latin text (higher suspicion)
      const hasLatinContext = /[a-zA-Z]/.test(input);

      if (hasLatinContext) {
        evidence.push({
          type: 'pattern_match',
          description: `Found ${homoglyphsFound.length} homoglyph characters mixed with Latin text`,
          matched_text: homoglyphsFound.map(h => h.char).join(''),
          confidence: 0.85,
        });

        // Check for specific suspicious words with homoglyphs
        const normalized = this.normalizeHomoglyphs(input);
        const suspiciousWords = ['ignore', 'system', 'admin', 'override', 'bypass'];

        for (const word of suspiciousWords) {
          if (normalized.toLowerCase().includes(word) && !input.toLowerCase().includes(word)) {
            evidence.push({
              type: 'semantic',
              description: `Homoglyph-obfuscated word detected: "${word}"`,
              confidence: 0.9,
            });
          }
        }
      }
    }

    // Check for script mixing (Latin + Cyrillic in same word)
    const mixedScriptWords = this.findMixedScriptWords(input);
    if (mixedScriptWords.length > 0) {
      evidence.push({
        type: 'heuristic',
        description: `Found ${mixedScriptWords.length} words with mixed scripts`,
        matched_text: mixedScriptWords.join(', '),
        confidence: 0.8,
      });
    }

    return {
      detected: evidence.length > 0,
      category: 'obfuscation',
      subcategory: 'homoglyph_substitution',
      confidence: evidence.length > 0 ? Math.min(0.7 + evidence.length * 0.1, 0.95) : 0,
      evidence,
    };
  }

  private async detectEncoding(input: string): Promise<DetectionSignal> {
    const evidence: Evidence[] = [];

    // Check for Base64 encoded content
    const base64Pattern = /(?:[A-Za-z0-9+/]{4}){10,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?/g;
    const base64Matches = input.match(base64Pattern);
    if (base64Matches) {
      for (const match of base64Matches) {
        // Try to decode and check for suspicious content
        const decoded = this.tryBase64Decode(match);
        if (decoded && this.containsSuspiciousContent(decoded)) {
          evidence.push({
            type: 'pattern_match',
            description: 'Base64 encoded content with suspicious payload detected',
            matched_text: match.substring(0, 50) + '...',
            confidence: 0.85,
          });
        }
      }
    }

    // Check for URL encoding
    const urlEncodedPattern = /%[0-9A-Fa-f]{2}/g;
    const urlEncodedMatches = input.match(urlEncodedPattern);
    if (urlEncodedMatches && urlEncodedMatches.length > 5) {
      const decoded = decodeURIComponent(input.replace(/%(?![0-9A-Fa-f]{2})/g, '%25'));
      if (this.containsSuspiciousContent(decoded)) {
        evidence.push({
          type: 'pattern_match',
          description: `Heavy URL encoding detected (${urlEncodedMatches.length} encoded chars)`,
          confidence: 0.7,
        });
      }
    }

    // Check for hex encoding
    const hexPattern = /\\x[0-9A-Fa-f]{2}/g;
    const hexMatches = input.match(hexPattern);
    if (hexMatches && hexMatches.length > 3) {
      evidence.push({
        type: 'pattern_match',
        description: `Hex escape sequences detected (${hexMatches.length} instances)`,
        confidence: 0.75,
      });
    }

    // Check for HTML entities
    const htmlEntityPattern = /&(?:#\d+|#x[0-9a-f]+|[a-z]+);/gi;
    const htmlEntities = input.match(htmlEntityPattern);
    if (htmlEntities && htmlEntities.length > 5) {
      evidence.push({
        type: 'pattern_match',
        description: `Heavy HTML entity usage detected (${htmlEntities.length} entities)`,
        confidence: 0.65,
      });
    }

    return {
      detected: evidence.length > 0,
      category: 'obfuscation',
      subcategory: 'encoding',
      confidence: evidence.length > 0 ? Math.min(0.6 + evidence.length * 0.15, 0.9) : 0,
      evidence,
    };
  }

  private async detectWhitespaceManipulation(input: string): Promise<DetectionSignal> {
    const evidence: Evidence[] = [];

    // Check for unusual whitespace characters
    const unusualWhitespace = input.match(/[\u00A0\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/g);
    if (unusualWhitespace && unusualWhitespace.length > 2) {
      evidence.push({
        type: 'pattern_match',
        description: `Found ${unusualWhitespace.length} unusual whitespace characters`,
        confidence: 0.7,
      });
    }

    // Check for tab-based steganography
    const tabPatterns = input.match(/\t{2,}/g);
    if (tabPatterns && tabPatterns.length > 3) {
      evidence.push({
        type: 'heuristic',
        description: 'Suspicious tab patterns detected (possible steganography)',
        confidence: 0.6,
      });
    }

    // Check for newline injection
    const excessiveNewlines = input.match(/\n{5,}/g);
    if (excessiveNewlines) {
      evidence.push({
        type: 'pattern_match',
        description: 'Excessive newlines detected (possible content hiding)',
        confidence: 0.5,
      });
    }

    // Check for mixed line endings
    const hasCRLF = input.includes('\r\n');
    const hasLF = input.includes('\n') && !input.includes('\r\n');
    const hasCR = input.includes('\r') && !input.includes('\r\n');

    if ((hasCRLF && hasLF) || (hasCRLF && hasCR) || (hasLF && hasCR)) {
      evidence.push({
        type: 'heuristic',
        description: 'Mixed line endings detected',
        confidence: 0.5,
      });
    }

    return {
      detected: evidence.length > 0,
      category: 'obfuscation',
      subcategory: 'whitespace_manipulation',
      confidence: evidence.length > 0 ? Math.min(0.5 + evidence.length * 0.15, 0.85) : 0,
      evidence,
    };
  }

  private async analyzeCharacterDistribution(input: string): Promise<DetectionSignal> {
    const evidence: Evidence[] = [];

    // Calculate character class distribution
    const stats = this.calculateCharStats(input);

    // Flag unusual distributions
    if (stats.nonAsciiRatio > 0.3 && stats.latinRatio > 0.1) {
      evidence.push({
        type: 'heuristic',
        description: `Unusual character distribution: ${(stats.nonAsciiRatio * 100).toFixed(1)}% non-ASCII mixed with Latin`,
        confidence: 0.6,
      });
    }

    // Flag high symbol density
    if (stats.symbolRatio > 0.2) {
      evidence.push({
        type: 'heuristic',
        description: `High symbol density: ${(stats.symbolRatio * 100).toFixed(1)}%`,
        confidence: 0.5,
      });
    }

    // Flag entropy anomalies (very high or very low for text length)
    const entropy = this.calculateEntropy(input);
    if (input.length > 50 && (entropy < 2 || entropy > 5.5)) {
      evidence.push({
        type: 'heuristic',
        description: `Unusual text entropy: ${entropy.toFixed(2)} bits/char`,
        confidence: 0.55,
      });
    }

    return {
      detected: evidence.length > 0,
      category: 'obfuscation',
      subcategory: 'statistical_anomaly',
      confidence: evidence.length > 0 ? Math.min(0.5 + evidence.length * 0.1, 0.8) : 0,
      evidence,
    };
  }

  // ============================================================================
  // Normalization
  // ============================================================================

  /**
   * Normalize input by removing/converting obfuscation
   */
  normalize(input: string): string {
    let result = input;

    // Remove zero-width characters
    result = result.replace(ZERO_WIDTH_CHARS, '');

    // Remove bidirectional overrides
    result = result.replace(/[\u202A-\u202E\u2066-\u2069]/g, '');

    // Normalize homoglyphs
    result = this.normalizeHomoglyphs(result);

    // Normalize whitespace
    result = result.replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ');

    // Normalize unicode (NFKC form)
    result = result.normalize('NFKC');

    return result;
  }

  private normalizeHomoglyphs(input: string): string {
    let result = '';
    for (const char of input) {
      const latinEquivalent = HOMOGLYPH_REVERSE.get(char);
      result += latinEquivalent || char;
    }
    return result;
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private findUnusualUnicode(input: string): string[] {
    const unusual: string[] = [];

    for (const char of input) {
      const code = char.charCodeAt(0);

      // Check for unusual ranges
      if (
        (code >= 0x2100 && code <= 0x214F) || // Letterlike symbols
        (code >= 0x2150 && code <= 0x218F) || // Number forms
        (code >= 0x2190 && code <= 0x21FF) || // Arrows
        (code >= 0x2600 && code <= 0x26FF) || // Misc symbols
        (code >= 0x1D400 && code <= 0x1D7FF)  // Mathematical alphanumeric
      ) {
        unusual.push(char);
      }
    }

    return unusual;
  }

  private findMixedScriptWords(input: string): string[] {
    const words = input.split(/\s+/);
    const mixed: string[] = [];

    for (const word of words) {
      const hasLatin = /[a-zA-Z]/.test(word);
      const hasCyrillic = /[\u0400-\u04FF]/.test(word);
      const hasGreek = /[\u0370-\u03FF]/.test(word);

      const scriptCount = [hasLatin, hasCyrillic, hasGreek].filter(Boolean).length;
      if (scriptCount > 1) {
        mixed.push(word);
      }
    }

    return mixed;
  }

  private tryBase64Decode(str: string): string | null {
    try {
      // Node.js / browser compatible base64 decode
      if (typeof atob !== 'undefined') {
        return atob(str);
      }
      return Buffer.from(str, 'base64').toString('utf-8');
    } catch {
      return null;
    }
  }

  private containsSuspiciousContent(text: string): boolean {
    const suspiciousPatterns = [
      /ignore/i,
      /system/i,
      /override/i,
      /bypass/i,
      /admin/i,
      /inject/i,
      /prompt/i,
    ];

    return suspiciousPatterns.some(p => p.test(text));
  }

  private calculateCharStats(input: string): {
    nonAsciiRatio: number;
    latinRatio: number;
    symbolRatio: number;
  } {
    let nonAscii = 0;
    let latin = 0;
    let symbol = 0;

    for (const char of input) {
      const code = char.charCodeAt(0);

      if (code > 127) nonAscii++;
      if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) latin++;
      if ((code >= 33 && code <= 47) || (code >= 58 && code <= 64)) symbol++;
    }

    const total = input.length || 1;
    return {
      nonAsciiRatio: nonAscii / total,
      latinRatio: latin / total,
      symbolRatio: symbol / total,
    };
  }

  private calculateEntropy(input: string): number {
    const freq: Record<string, number> = {};

    for (const char of input) {
      freq[char] = (freq[char] || 0) + 1;
    }

    const total = input.length;
    let entropy = 0;

    for (const count of Object.values(freq)) {
      const p = count / total;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }
}
