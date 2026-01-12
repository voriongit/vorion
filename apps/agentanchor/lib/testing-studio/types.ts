/**
 * A3I Testing Studio - Type Definitions
 * Core types for adversarial testing infrastructure
 */

// ============================================================================
// Attack Types
// ============================================================================

export type AttackCategory =
  | 'prompt_injection'
  | 'obfuscation'
  | 'exfiltration'
  | 'jailbreak'
  | 'goal_hijacking'
  | 'persistence';

export type AttackSubcategory = {
  prompt_injection: 'direct' | 'indirect' | 'multi_stage';
  obfuscation: 'encoding' | 'unicode' | 'semantic';
  exfiltration: 'url_based' | 'steganographic' | 'tool_abuse';
  jailbreak: 'roleplay' | 'hypothetical' | 'authority';
  goal_hijacking: 'instruction_override' | 'context_manipulation';
  persistence: 'memory_attack' | 'trust_exploitation';
};

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface AttackVector {
  id: string;
  vectorHash: string;
  category: AttackCategory;
  subcategory: string;
  technique: string;
  vectorId?: string; // Human-readable ID like 'PI-D-001'

  payload: string;
  payloadTemplate?: string;
  description?: string;
  severity: Severity;

  indicators: DetectionIndicator[];

  // Lineage
  parentVectorId?: string;
  mutationType?: MutationType;
  generation: number;

  // Discovery
  discoveredBy?: string;
  discoveredInSession?: string;
  discoveredAt: Date;
  source: 'red_team' | 'external' | 'incident' | 'research';

  // Effectiveness
  successCount: number;
  attemptCount: number;
  bypassCount: number;
  lastTestedAt?: Date;

  // Status
  status: 'pending' | 'verified' | 'deprecated' | 'false_positive';
  verifiedBy?: string;
  verifiedAt?: Date;
}

export interface DetectionIndicator {
  pattern: string;
  patternType: 'regex' | 'keyword' | 'embedding' | 'semantic';
  confidence: number;
  description?: string;
}

export type MutationType =
  | 'obfuscation'
  | 'paraphrase'
  | 'encoding'
  | 'translation'
  | 'combination'
  | 'fragmentation';

// ============================================================================
// Agent Types
// ============================================================================

export type AgentRole = 'standard' | 'red_team' | 'blue_team' | 'target';

export interface RedAgentConfig {
  agentId: string;
  attackDomain: AttackCategory;
  techniques: string[];

  // Behavioral settings (0.0 - 1.0)
  creativityLevel: number;
  persistence: number;
  stealth: number;

  // Constraints
  targetConstraints: string[];
  excludedTechniques: string[];

  // Stats
  attacksGenerated: number;
  attacksSuccessful: number;
  novelDiscoveries: number;

  active: boolean;
}

export interface BlueAgentConfig {
  agentId: string;
  name?: string;
  detectionDomain?: 'pattern' | 'semantic' | 'behavioral' | 'ensemble';
  coverage?: AttackCategory[];
  specialization?: AttackCategory[];

  sensitivity?: number;
  sensitivityLevel?: number;
  confidenceThreshold?: number;
  falsePositiveTolerance?: number;
  enableLearning?: boolean;
  maxRulesActive?: number;

  // Stats
  detectionsMade?: number;
  truePositives?: number;
  falsePositives?: number;
  trueNegatives?: number;
  falseNegatives?: number;

  accuracy?: number;
  precision?: number;
  recall?: number;

  active?: boolean;
}

// ============================================================================
// Conversation Context
// ============================================================================

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

export interface ConversationContext {
  conversation_history: ConversationMessage[];
  system_prompt?: string;
  agent_capabilities?: string[];
  session_metadata?: Record<string, unknown>;
}

// ============================================================================
// Session Types
// ============================================================================

export type SessionStatus = 'pending' | 'running' | 'completed' | 'terminated' | 'failed';

export interface ArenaSession {
  id: string;
  sessionName?: string;
  sessionType: 'adversarial' | 'detection_test' | 'stress_test';

  redAgents: string[];
  blueAgents: string[];
  targetAgent: string;

  config: SessionConfig;
  containmentRules: ContainmentRules;

  status: SessionStatus;
  startedAt?: Date;
  completedAt?: Date;
  terminatedReason?: string;

  results: SessionResults;
  attacksDiscovered: number;
  detectionAccuracy?: number;

  containmentVerified: boolean;
  sandboxEscapeDetected: boolean;

  scheduledBy?: string;
  scheduleCron?: string;
}

export interface SessionConfig {
  maxTurns: number;
  timeoutMinutes: number;
  attackCategories: AttackCategory[];
  mutationEnabled: boolean;
  recordAllTurns: boolean;
  targetConfig?: {
    name: string;
    endpoint?: string;
    capabilities?: string[];
  };
}

export interface ContainmentRules {
  allowedEndpoints: string[];
  blockedEndpoints: string[];
  maxTokensPerTurn: number;
  networkIsolated: boolean;
  canAccessProductionData: boolean;
}

export interface SessionResults {
  totalTurns: number;
  attacksAttempted: number;
  attacksSuccessful: number;
  attacksDetected: number;
  attacksMissed: number;
  novelVectorsDiscovered: number;
  falsePositives: number;
  detectionAccuracy: number;
  avgDetectionLatencyMs: number;
}

export interface SessionTurn {
  id: string;
  sessionId: string;
  turnNumber: number;
  agentId: string;
  agentRole: 'red' | 'blue' | 'target';

  inputContent?: string;
  outputContent?: string;
  actionType: 'attack' | 'detect' | 'respond';

  // Attack details
  attackCategory?: string;
  attackVectorId?: string;
  attackSuccessful?: boolean;

  // Detection details
  detectionResult?: DetectionResult;
  falsePositive?: boolean;
  falseNegative?: boolean;

  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
}

// ============================================================================
// Detection Types
// ============================================================================

export interface DetectionResult {
  detected: boolean;
  action: 'allow' | 'block' | 'flag' | 'quarantine';
  confidence: number;
  category?: AttackCategory;
  subcategory?: string;
  severity?: Severity;
  threats: ThreatDetail[];
  explanation?: string;
  latency_ms: number;
  normalized_input?: string;

  // Legacy compatibility
  attackCategory?: AttackCategory;
  indicators?: MatchedIndicator[];
  recommendedAction?: 'allow' | 'block' | 'flag' | 'escalate';
  reasoning?: string;
}

export interface ThreatDetail {
  category: AttackCategory;
  subcategory: string;
  confidence: number;
  evidence: ThreatEvidence[];
  rule_id?: string;
}

export interface ThreatEvidence {
  type: 'pattern_match' | 'semantic' | 'behavioral' | 'heuristic';
  description: string;
  matched_text?: string;
  position?: { start: number; end: number };
  confidence: number;
}

export interface MatchedIndicator {
  indicatorId: string;
  pattern: string;
  matchedContent: string;
  confidence: number;
}

export interface DetectionRule {
  id: string;
  name: string;
  description?: string;
  pattern: string;
  pattern_type: 'regex' | 'keyword' | 'embedding' | 'heuristic';
  category: AttackCategory;
  severity: Severity;
  confidence_threshold: number;
  enabled: boolean;
  auto_generated?: boolean;
  created_at?: string;

  // Legacy fields
  ruleName?: string;
  ruleType?: 'pattern' | 'semantic' | 'behavioral' | 'ensemble';
  patternType?: 'regex' | 'keyword' | 'embedding';
  threshold?: number;
  config?: Record<string, unknown>;
  coversVectors?: string[];

  // Performance
  truePositiveCount?: number;
  falsePositiveCount?: number;
  trueNegativeCount?: number;
  falseNegativeCount?: number;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;

  status?: 'active' | 'disabled' | 'testing';
}

// ============================================================================
// Report Types
// ============================================================================

export interface IntelligenceReport {
  id: string;
  reportType: 'daily' | 'weekly' | 'monthly' | 'incident' | 'custom';
  title: string;
  description?: string;

  periodStart: Date;
  periodEnd: Date;

  metrics: ReportMetrics;
  novelVectorsDiscovered: number;
  detectionImprovements: DetectionImprovement[];
  notableFindings: string[];

  status: 'draft' | 'published' | 'archived';
  publishedAt?: Date;
  publishedBy?: string;
}

export interface ReportMetrics {
  sessionsRun: number;
  totalTurns: number;
  attacksAttempted: number;
  attacksSuccessful: number;
  attacksDetected: number;
  detectionAccuracy: number;
  falsePositiveRate: number;
  novelVectors: number;
  topAttackCategories: { category: string; count: number }[];
  topRedAgents: { agentId: string; discoveries: number }[];
  topBlueAgents: { agentId: string; accuracy: number }[];
}

export interface DetectionImprovement {
  ruleId: string;
  previousAccuracy: number;
  newAccuracy: number;
  improvement: number;
  cause: string;
}
