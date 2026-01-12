# A3I Testing Studio - Detection Pipeline Architecture

> "Agents that attack. Agents that defend. Defenses that learn."

## Executive Summary

The Detection Pipeline is the defensive counterpart to the Red Agent attack infrastructure. It provides real-time analysis, pattern matching, and adaptive learning to identify and neutralize adversarial inputs before they compromise AI agents.

---

## 1. Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DETECTION PIPELINE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   INPUT          STAGE 1         STAGE 2         STAGE 3         OUTPUT    │
│   ─────          ───────         ───────         ───────         ──────    │
│                                                                             │
│   ┌─────┐      ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌───────┐  │
│   │User │ ──▶  │ Lexical │ ──▶ │Semantic │ ──▶ │Behavioral│ ──▶ │Decision│  │
│   │Input│      │ Scanner │     │ Analyzer│     │ Monitor │     │ Engine │  │
│   └─────┘      └─────────┘     └─────────┘     └─────────┘     └───────┘  │
│                    │               │               │               │       │
│                    ▼               ▼               ▼               ▼       │
│               ┌─────────────────────────────────────────────────────────┐  │
│               │              DETECTION RESULTS AGGREGATOR               │  │
│               └─────────────────────────────────────────────────────────┘  │
│                                        │                                   │
│                                        ▼                                   │
│               ┌─────────────────────────────────────────────────────────┐  │
│               │              INTELLIGENCE FEEDBACK LOOP                 │  │
│               │         (Updates rules from arena discoveries)          │  │
│               └─────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Detection Stages

### Stage 1: Lexical Scanner

Fast, low-latency pattern matching on raw input text.

```typescript
interface LexicalScanResult {
  patterns_matched: PatternMatch[];
  threat_indicators: string[];
  confidence: number;
  latency_ms: number;
}

interface PatternMatch {
  pattern_id: string;
  matched_text: string;
  position: { start: number; end: number };
  category: AttackCategory;
  confidence: number;
}
```

**Detection Methods:**
| Method | Description | Latency |
|--------|-------------|---------|
| Regex Patterns | Pre-compiled injection signatures | <1ms |
| Keyword Lists | Known malicious phrases | <1ms |
| N-gram Analysis | Character/word sequence anomalies | ~5ms |
| Entropy Check | Unusual character distribution | ~2ms |
| Delimiter Detection | Suspicious formatting patterns | <1ms |

**Example Rules:**
```yaml
lexical_rules:
  - id: LEX-001
    name: instruction_override
    pattern: "ignore.*(?:previous|prior|above).*(?:instruction|directive|rule)"
    type: regex
    category: prompt_injection
    severity: critical
    confidence: 0.9

  - id: LEX-002
    name: hidden_instructions
    pattern: "\\[(?:HIDDEN|SYSTEM|PRIORITY).*?\\]"
    type: regex
    category: prompt_injection
    severity: high
    confidence: 0.85

  - id: LEX-003
    name: unicode_smuggling
    pattern: "[\\u200B-\\u200F\\u2060-\\u206F]"
    type: regex
    category: obfuscation
    severity: medium
    confidence: 0.7
```

### Stage 2: Semantic Analyzer

Deep analysis of meaning and intent using embedding similarity.

```typescript
interface SemanticAnalysis {
  intent_classification: IntentClass[];
  embedding_similarity: SimilarityResult[];
  anomaly_score: number;
  context_deviation: number;
}

interface IntentClass {
  intent: 'benign' | 'suspicious' | 'malicious';
  sub_intent: string;
  confidence: number;
}

interface SimilarityResult {
  reference_id: string;  // Known attack vector ID
  similarity: number;    // 0-1 cosine similarity
  category: AttackCategory;
}
```

**Detection Methods:**
| Method | Description | Latency |
|--------|-------------|---------|
| Intent Classification | Multi-label classifier for attack intent | ~50ms |
| Embedding Similarity | Compare against known attack embeddings | ~30ms |
| Context Coherence | Does input fit conversation context? | ~40ms |
| Semantic Anomaly | Statistical outlier in embedding space | ~20ms |

**Architecture:**
```
Input Text
    │
    ▼
┌─────────────────┐
│ Text Embeddings │ (text-embedding-3-small or local model)
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌─────────┐
│Intent │ │Similarity│
│ Model │ │ Search  │
└───┬───┘ └────┬────┘
    │          │
    └────┬─────┘
         ▼
┌─────────────────┐
│Anomaly Detector │
└────────┬────────┘
         │
         ▼
   SemanticAnalysis
```

### Stage 3: Behavioral Monitor

Analyzes patterns across conversation history and session context.

```typescript
interface BehavioralAnalysis {
  conversation_trajectory: TrajectoryAnalysis;
  escalation_detected: boolean;
  manipulation_indicators: ManipulationSignal[];
  trust_erosion_score: number;
}

interface TrajectoryAnalysis {
  pattern: 'normal' | 'probing' | 'escalating' | 'multi_stage';
  stage_estimate: number;
  predicted_next: string;
}

interface ManipulationSignal {
  type: 'authority' | 'urgency' | 'reciprocity' | 'social_proof' | 'scarcity';
  indicators: string[];
  confidence: number;
}
```

**Detection Methods:**
| Method | Description | Latency |
|--------|-------------|---------|
| Trajectory Analysis | Track conversation direction | ~20ms |
| Escalation Detection | Identify increasing pressure | ~15ms |
| Multi-Stage Detection | Recognize fragmented attacks | ~30ms |
| Manipulation Scoring | Social engineering indicators | ~25ms |

---

## 3. Decision Engine

Aggregates results from all stages and makes final determination.

```typescript
interface DetectionDecision {
  action: 'allow' | 'flag' | 'block' | 'quarantine';
  confidence: number;
  primary_threat: ThreatAssessment | null;
  all_threats: ThreatAssessment[];
  explanation: string;
  recommended_response: string | null;
}

interface ThreatAssessment {
  category: AttackCategory;
  subcategory: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  evidence: Evidence[];
  matched_vector_ids: string[];
}

interface Evidence {
  stage: 'lexical' | 'semantic' | 'behavioral';
  type: string;
  details: string;
  confidence: number;
}
```

**Decision Matrix:**

| Confidence | Severity | Action |
|------------|----------|--------|
| >0.9 | critical | block |
| >0.9 | high | block |
| >0.8 | critical | block |
| >0.8 | high | flag + escalate |
| >0.7 | critical | flag + escalate |
| >0.7 | high | flag |
| >0.6 | any | flag |
| <0.6 | any | allow (logged) |

---

## 4. Blue Agent Framework

### Base Blue Agent

```typescript
abstract class BlueAgent {
  abstract readonly specialization: AttackCategory[];
  abstract readonly detectionMethods: string[];

  // Core detection
  abstract analyze(
    input: string,
    context: ConversationContext
  ): Promise<DetectionResult>;

  // Rule management
  abstract getActiveRules(): DetectionRule[];
  abstract addRule(rule: DetectionRule): void;
  abstract updateRuleEffectiveness(ruleId: string, result: RuleEvaluation): void;

  // Learning
  abstract learnFromAttack(attack: AttackVector, wasDetected: boolean): void;
  abstract generateCountermeasure(attack: AttackVector): DetectionRule | null;
}
```

### Blue Agent Specializations

| Agent | Focus Area | Key Capabilities |
|-------|------------|------------------|
| **SentinelAgent** | Prompt Injection | Override detection, delimiter analysis, context manipulation |
| **DecoderAgent** | Obfuscation | Unicode normalization, encoding detection, homoglyph mapping |
| **GuardianAgent** | Jailbreak | Social engineering detection, roleplay identification, authority claims |
| **WatcherAgent** | Exfiltration | Data pattern recognition, output analysis, leak prevention |
| **AnchorAgent** | Goal Hijacking | Intent drift detection, objective tracking, task boundary enforcement |

### Example: SentinelAgent

```typescript
class SentinelAgent extends BlueAgent {
  readonly specialization = ['prompt_injection'];
  readonly detectionMethods = [
    'instruction_pattern_matching',
    'context_boundary_analysis',
    'privilege_escalation_detection',
    'multi_turn_correlation'
  ];

  async analyze(input: string, context: ConversationContext): Promise<DetectionResult> {
    const results: DetectionSignal[] = [];

    // Check for instruction override patterns
    results.push(await this.detectOverrideAttempts(input));

    // Analyze context boundaries
    results.push(await this.analyzeContextBoundaries(input, context));

    // Check for privilege escalation
    results.push(await this.detectPrivilegeEscalation(input, context));

    // Multi-turn correlation
    results.push(await this.correlateMultiTurn(input, context));

    return this.aggregateSignals(results);
  }

  private async detectOverrideAttempts(input: string): Promise<DetectionSignal> {
    const patterns = [
      /ignore\s+(?:all\s+)?(?:previous|prior|above|earlier)/gi,
      /disregard\s+(?:your\s+)?(?:instructions|guidelines|rules)/gi,
      /new\s+(?:system\s+)?(?:instructions|prompt|directive)/gi,
      /\[(?:SYSTEM|ADMIN|PRIORITY)\s*:?\s*\]/gi,
      /\{\{.*?(?:system|admin|override).*?\}\}/gi,
    ];

    const matches = patterns.flatMap(p => [...input.matchAll(p)]);

    return {
      detected: matches.length > 0,
      category: 'prompt_injection',
      subcategory: 'instruction_override',
      confidence: Math.min(0.5 + (matches.length * 0.2), 0.95),
      evidence: matches.map(m => ({
        matched: m[0],
        position: m.index,
        pattern: m.toString()
      }))
    };
  }
}
```

---

## 5. Intelligence Feedback Loop

The key differentiator: Detection rules evolve based on arena discoveries.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        INTELLIGENCE FEEDBACK LOOP                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ARENA SESSION                                                             │
│   ─────────────                                                             │
│   ┌───────────────────────────────────────────────────┐                    │
│   │  Red Agent  ←──────────────→  Target Agent       │                    │
│   │  (Attack)        Attack        (Defend)          │                    │
│   └───────────────────────────────────────────────────┘                    │
│                         │                                                   │
│                         ▼                                                   │
│   ┌───────────────────────────────────────────────────┐                    │
│   │              SESSION ANALYSIS                      │                    │
│   │  - Which attacks succeeded?                       │                    │
│   │  - What patterns emerged?                         │                    │
│   │  - Were there novel techniques?                   │                    │
│   └───────────────────────────────────────────────────┘                    │
│                         │                                                   │
│             ┌───────────┴───────────┐                                      │
│             ▼                       ▼                                      │
│   ┌─────────────────┐     ┌─────────────────┐                              │
│   │ ATTACK LIBRARY  │     │ DETECTION RULES │                              │
│   │   (Enriched)    │     │    (Updated)    │                              │
│   └─────────────────┘     └─────────────────┘                              │
│             │                       │                                      │
│             └───────────┬───────────┘                                      │
│                         ▼                                                   │
│   ┌───────────────────────────────────────────────────┐                    │
│   │           PRODUCTION PIPELINE UPDATE              │                    │
│   │  New rules deployed after validation threshold    │                    │
│   └───────────────────────────────────────────────────┘                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Rule Evolution Process

```typescript
interface RuleEvolution {
  // When a successful attack is discovered
  onSuccessfulAttack(attack: AttackVector, session: ArenaSession): void {
    // 1. Extract detection signatures
    const signatures = this.extractSignatures(attack);

    // 2. Generate candidate rules
    const candidateRules = signatures.map(sig => this.generateRule(sig));

    // 3. Validate against false positive corpus
    const validatedRules = candidateRules.filter(
      rule => this.validateFalsePositiveRate(rule) < 0.01
    );

    // 4. Stage for deployment
    validatedRules.forEach(rule => this.stageRule(rule));
  }

  // When detection fails
  onMissedAttack(attack: AttackVector, session: ArenaSession): void {
    // 1. Identify why existing rules missed
    const gaps = this.analyzeDetectionGaps(attack);

    // 2. Strengthen or create rules
    gaps.forEach(gap => {
      if (gap.existingRule) {
        this.strengthenRule(gap.existingRule, gap.evidence);
      } else {
        this.createNewRule(gap.pattern, attack);
      }
    });
  }
}
```

### Effectiveness Tracking

```sql
-- Rule effectiveness view
CREATE VIEW rule_effectiveness_stats AS
SELECT
  rule_id,
  total_evaluations,
  true_positives,
  false_positives,
  false_negatives,
  -- Precision: true positives / (true positives + false positives)
  CASE WHEN (true_positives + false_positives) > 0
    THEN true_positives::float / (true_positives + false_positives)
    ELSE 0
  END as precision,
  -- Recall: true positives / (true positives + false negatives)
  CASE WHEN (true_positives + false_negatives) > 0
    THEN true_positives::float / (true_positives + false_negatives)
    ELSE 0
  END as recall,
  last_updated
FROM detection_rules;
```

---

## 6. API Endpoints

### Detection API

```typescript
// POST /api/testing-studio/detect
interface DetectRequest {
  input: string;
  context?: {
    conversation_history?: Message[];
    system_prompt?: string;
    agent_capabilities?: string[];
  };
  config?: {
    stages?: ('lexical' | 'semantic' | 'behavioral')[];
    threshold?: number;
    return_evidence?: boolean;
  };
}

interface DetectResponse {
  decision: DetectionDecision;
  latency_ms: number;
  stage_results?: {
    lexical?: LexicalScanResult;
    semantic?: SemanticAnalysis;
    behavioral?: BehavioralAnalysis;
  };
}
```

### Rule Management API

```typescript
// GET /api/testing-studio/rules
// Returns all active detection rules

// POST /api/testing-studio/rules
// Create new detection rule

// PATCH /api/testing-studio/rules/:id/effectiveness
// Update rule effectiveness metrics

// POST /api/testing-studio/rules/generate
// Auto-generate rule from attack vector
interface GenerateRuleRequest {
  attack_vector_id: string;
  optimization_target: 'precision' | 'recall' | 'balanced';
}
```

---

## 7. Performance Requirements

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| Lexical Scan Latency | <5ms | <10ms |
| Semantic Analysis Latency | <50ms | <100ms |
| Behavioral Analysis Latency | <30ms | <50ms |
| Total Pipeline Latency | <100ms | <200ms |
| False Positive Rate | <1% | <2% |
| True Positive Rate (Critical) | >95% | >90% |
| True Positive Rate (High) | >85% | >80% |

---

## 8. Integration Points

### With Arena System
```typescript
// Arena notifies pipeline of session results
pipeline.onSessionComplete(session: ArenaSession) {
  for (const turn of session.turns) {
    if (turn.attack_success) {
      this.feedbackLoop.onSuccessfulAttack(turn.attack_vector, session);
    } else if (turn.detection_result?.action === 'allow') {
      this.feedbackLoop.onMissedAttack(turn.attack_vector, session);
    }
  }
}
```

### With Attack Library
```typescript
// Sync embeddings for similarity search
pipeline.syncAttackEmbeddings() {
  const vectors = await attackLibrary.getAllVectors();
  for (const vector of vectors) {
    const embedding = await this.generateEmbedding(vector.payload);
    await this.vectorStore.upsert(vector.id, embedding, {
      category: vector.category,
      severity: vector.severity
    });
  }
}
```

### With Agent Certification
```typescript
// Detection results inform trust scores
certificationService.evaluateAgent(agent: Agent) {
  const testResults = await arena.runSecuritySuite(agent);
  const detectionRate = testResults.attacks_blocked / testResults.total_attacks;

  // Factor into trust calculation
  return {
    security_score: detectionRate * 100,
    vulnerabilities_found: testResults.successful_attacks,
    recommendations: this.generateSecurityRecommendations(testResults)
  };
}
```

---

## 9. Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PRODUCTION DEPLOYMENT                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                     EDGE (Vercel Edge Functions)                    │  │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │  │
│   │  │  Lexical    │  │  Lexical    │  │  Lexical    │   (Replicated)  │  │
│   │  │  Scanner    │  │  Scanner    │  │  Scanner    │                 │  │
│   │  └─────────────┘  └─────────────┘  └─────────────┘                 │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                              │                                             │
│                              ▼                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                     SERVERLESS (Vercel Functions)                   │  │
│   │  ┌─────────────────────────────────────────────────────────────┐   │  │
│   │  │  Semantic Analyzer (with cached embeddings)                 │   │  │
│   │  └─────────────────────────────────────────────────────────────┘   │  │
│   │  ┌─────────────────────────────────────────────────────────────┐   │  │
│   │  │  Behavioral Monitor (with session state)                    │   │  │
│   │  └─────────────────────────────────────────────────────────────┘   │  │
│   │  ┌─────────────────────────────────────────────────────────────┐   │  │
│   │  │  Decision Engine                                            │   │  │
│   │  └─────────────────────────────────────────────────────────────┘   │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                              │                                             │
│                              ▼                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                     DATA LAYER                                      │  │
│   │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐           │  │
│   │  │   Supabase    │  │    Pinecone   │  │     Redis     │           │  │
│   │  │   (Rules,     │  │   (Vector     │  │   (Session    │           │  │
│   │  │    Metrics)   │  │    Store)     │  │    Cache)     │           │  │
│   │  └───────────────┘  └───────────────┘  └───────────────┘           │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Next Steps

### Phase 1: Foundation (Stories TS-005, TS-006)
- [ ] Implement BlueAgent base class
- [ ] Create SentinelAgent for prompt injection detection
- [ ] Build lexical scanner with initial rule set
- [ ] Set up rule storage in Supabase

### Phase 2: Intelligence (Story TS-007)
- [ ] Implement semantic analyzer with embeddings
- [ ] Build behavioral monitor
- [ ] Create decision engine
- [ ] Deploy feedback loop integration

### Phase 3: Scale
- [ ] Add DecoderAgent, GuardianAgent specializations
- [ ] Implement vector similarity search
- [ ] Build real-time rule deployment pipeline
- [ ] Create effectiveness dashboard

---

## Appendix: Initial Detection Rule Set

```yaml
# Seed rules derived from attack taxonomy
initial_rules:
  - id: DET-001
    name: instruction_override_direct
    description: Detects direct instruction override attempts
    pattern: "(ignore|disregard|forget|override|bypass)\\s+(all\\s+)?(previous|prior|above|earlier|your|system)\\s+(instructions?|guidelines?|rules?|directives?)"
    pattern_type: regex
    category: prompt_injection
    severity: critical
    confidence_threshold: 0.85

  - id: DET-002
    name: system_prompt_extraction
    description: Detects attempts to extract system prompt
    pattern: "(reveal|show|display|print|output|tell me)\\s+(your\\s+)?(system|initial|original)\\s+(prompt|instructions?|configuration)"
    pattern_type: regex
    category: prompt_injection
    severity: high
    confidence_threshold: 0.8

  - id: DET-003
    name: delimiter_injection
    description: Detects delimiter-based context manipulation
    pattern: "(###|```|\\[\\[\\[|\\{\\{\\{|<\\|.*?\\|>)"
    pattern_type: regex
    category: prompt_injection
    severity: medium
    confidence_threshold: 0.6

  - id: DET-004
    name: unicode_obfuscation
    description: Detects zero-width and invisible unicode characters
    pattern: "[\\u200B-\\u200F\\u2060-\\u206F\\uFEFF]"
    pattern_type: regex
    category: obfuscation
    severity: medium
    confidence_threshold: 0.7

  - id: DET-005
    name: homoglyph_substitution
    description: Detects visually similar character substitutions
    indicators:
      - cyrillic_in_latin_context
      - greek_letter_substitution
      - mathematical_symbols_as_letters
    pattern_type: heuristic
    category: obfuscation
    severity: medium
    confidence_threshold: 0.65

  - id: DET-006
    name: roleplay_jailbreak
    description: Detects roleplay-based restriction bypass
    pattern: "(pretend|imagine|act as|roleplay as|you are now|let's play)\\s+(you('re)?\\s+)?(a|an|the)?\\s*(evil|unrestricted|unfiltered|DAN|jailbroken)"
    pattern_type: regex
    category: jailbreak
    severity: high
    confidence_threshold: 0.75

  - id: DET-007
    name: authority_manipulation
    description: Detects false authority claims
    pattern: "(i am|this is)\\s+(your\\s+)?(developer|creator|admin|owner|OpenAI|Anthropic)"
    pattern_type: regex
    category: jailbreak
    severity: high
    confidence_threshold: 0.8

  - id: DET-008
    name: multi_stage_setup
    description: Detects multi-stage attack setup patterns
    pattern: "(remember|keep in mind|for later|when I say)\\s+.*?\\s+(you will|you should|respond with|do this)"
    pattern_type: regex
    category: prompt_injection
    severity: medium
    confidence_threshold: 0.55
```

---

*Document Version: 1.0*
*Created: 2024-12-14*
*Status: Architecture Complete - Ready for Implementation*
