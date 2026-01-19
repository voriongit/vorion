/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AGENT SKILLS LIBRARY v1.0.0
 * ═══════════════════════════════════════════════════════════════════════════════
 * Universal skills library for intelligent agents - "Agents of the People"
 * 
 * Architecture:
 * - ATOMIC: Single-purpose, indivisible operations
 * - COMPOSITE: Orchestrated combinations of atomics  
 * - BEHAVIORAL: Long-running, goal-oriented skill sets
 * 
 * Integrates with: Aurais, AgentAnchor (A3I), BAI Command Center
 * 
 * @version 1.0.0
 * @license Proprietary - AgentAnchor A3I Framework
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export type SkillTier = 'atomic' | 'composite' | 'behavioral';
export type TrustLevel = 1 | 2 | 3 | 4 | 5;
export type RiskCategory = 'none' | 'low' | 'medium' | 'high' | 'critical';
export type AuditLevel = 'none' | 'summary' | 'detailed' | 'forensic';
export type DataType = 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'email' | 'url' | 'phone' | 'currency' | 'percentage' | 'json' | 'xml' | 'html' | 'markdown' | 'binary' | 'file' | 'image' | 'audio' | 'video' | 'array' | 'object' | 'any' | 'void';

export interface ValidationRule { type: 'min' | 'max' | 'minLength' | 'maxLength' | 'pattern' | 'enum' | 'custom'; value: any; message: string; }
export interface InputSchema { name: string; type: DataType; required: boolean; description: string; defaultValue?: any; validation?: ValidationRule[]; examples?: any[]; }
export interface OutputSchema { name: string; type: DataType; description: string; nullable: boolean; examples?: any[]; }
export interface OverrideRule { parameter: string; allowOverride: boolean; constraints?: ValidationRule[]; requiresApproval?: boolean; approvalLevel?: TrustLevel; }
export interface ExecutionStep { order: number; action: string; description: string; skillRef?: string; conditional?: string; errorHandler?: string; timeout?: number; }
export interface Example { name: string; description: string; input: Record<string, any>; expectedOutput: Record<string, any>; notes?: string; }
export interface EdgeCase { scenario: string; handling: string; fallback?: string; }
export interface Criterion { metric: string; operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'matches'; value: any; weight?: number; }
export interface FailureHandler { errorType: string; action: 'retry' | 'fallback' | 'escalate' | 'abort' | 'log'; maxRetries?: number; fallbackSkill?: string; escalateTo?: string; message?: string; }
export interface TestFixture { name: string; input: Record<string, any>; expectedOutput: Record<string, any>; shouldSucceed: boolean; tags?: string[]; }
export interface AuditEvent { event: string; trigger: 'start' | 'success' | 'failure' | 'milestone' | 'custom'; data: string[]; retentionDays?: number; }
export interface Metric { name: string; type: 'counter' | 'gauge' | 'histogram' | 'timer'; description: string; unit?: string; }

export interface Skill {
  id: string; version: string; name: string; tier: SkillTier;
  category: string; subcategory: string; tags: string[];
  trustLevelRequired: TrustLevel; riskCategory: RiskCategory; requiresHumanApproval: boolean; auditLevel: AuditLevel; governanceNotes?: string;
  prerequisites: string[]; composedOf: string[]; conflicts: string[];
  inputs: InputSchema[]; outputs: OutputSchema[]; defaultParameters: Record<string, any>; overrideRules: OverrideRule[];
  description: string; systemPrompt: string; executionSteps: ExecutionStep[]; toolsRequired: string[]; exampleUsage: Example[]; edgeCases: EdgeCase[];
  successCriteria: Criterion[]; failureHandling: FailureHandler[]; testFixtures: TestFixture[];
  auditEvents: AuditEvent[]; metricsTracked: Metric[];
  author?: string; createdAt: string; updatedAt: string; deprecated?: boolean; deprecationMessage?: string; replacedBy?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════════

export const SKILL_CATEGORIES = {
  CORE_COGNITION: 'core_cognition', COMMUNICATION: 'communication', DATA_OPERATIONS: 'data_operations',
  FILE_MANAGEMENT: 'file_management', WEB_OPERATIONS: 'web_operations', CODE_DEVELOPMENT: 'code_development',
  MATHEMATICAL: 'mathematical', BUSINESS_OPERATIONS: 'business_operations', FINANCE: 'finance',
  LEGAL_COMPLIANCE: 'legal_compliance', MARKETING: 'marketing', SALES: 'sales',
  CUSTOMER_SERVICE: 'customer_service', HR_PEOPLE: 'hr_people', PROJECT_MANAGEMENT: 'project_management',
  RESEARCH_INTELLIGENCE: 'research_intelligence', CREATIVE: 'creative', TECHNICAL_OPERATIONS: 'technical_operations',
  SECURITY: 'security', HEALTHCARE: 'healthcare', EDUCATION: 'education', HOSPITALITY: 'hospitality',
  REAL_ESTATE: 'real_estate', MANUFACTURING: 'manufacturing', LOGISTICS: 'logistics',
  PERSONAL_PRODUCTIVITY: 'personal_productivity', SOCIAL_RELATIONSHIP: 'social_relationship',
  PHYSICAL_WORLD: 'physical_world', GOVERNANCE_TRUST: 'governance_trust', MEDIA_ENTERTAINMENT: 'media_entertainment',
  AGRICULTURE: 'agriculture', ENERGY: 'energy', GOVERNMENT: 'government', AUTOMOTIVE: 'automotive',
  RETAIL: 'retail', INSURANCE: 'insurance', TRAVEL: 'travel', NONPROFIT: 'nonprofit', SPORTS_FITNESS: 'sports_fitness',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// SKILL FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

const ts = () => new Date().toISOString();
const createSkill = (p: Partial<Skill> & Pick<Skill, 'id' | 'name' | 'tier' | 'category' | 'subcategory' | 'description' | 'systemPrompt'>): Skill => ({
  version: '1.0.0', tags: [], trustLevelRequired: 1, riskCategory: 'none', requiresHumanApproval: false, auditLevel: 'summary',
  prerequisites: [], composedOf: [], conflicts: [], inputs: [], outputs: [], defaultParameters: {}, overrideRules: [],
  executionSteps: [], toolsRequired: [], exampleUsage: [], edgeCases: [], successCriteria: [], failureHandling: [],
  testFixtures: [], auditEvents: [], metricsTracked: [], createdAt: ts(), updatedAt: ts(), ...p,
});

// ═══════════════════════════════════════════════════════════════════════════════
// SKILL REGISTRY - 200+ SKILLS ACROSS ALL CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════════

export const SKILLS: Skill[] = [

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║ CORE COGNITION - Reasoning, Analysis, Synthesis                          ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝

  createSkill({ id: 'cognition.analyze_text', name: 'Analyze Text', tier: 'atomic', category: SKILL_CATEGORIES.CORE_COGNITION, subcategory: 'analysis', tags: ['analysis', 'text', 'nlp'], description: 'Analyze text for structure, meaning, sentiment, entities, and key information.', systemPrompt: 'You are a text analysis specialist. Systematically analyze for: main themes, key entities (people, places, orgs, dates), sentiment, structure, implicit meanings, factual claims vs opinions, logical flow. Be thorough but concise.',
    inputs: [{ name: 'text', type: 'string', required: true, description: 'Text to analyze' }, { name: 'depth', type: 'string', required: false, description: 'shallow|medium|deep', defaultValue: 'medium' }],
    outputs: [{ name: 'themes', type: 'array', description: 'Main themes', nullable: false }, { name: 'entities', type: 'object', description: 'Named entities by category', nullable: false }, { name: 'sentiment', type: 'object', description: 'Sentiment analysis', nullable: false }],
  }),

  createSkill({ id: 'cognition.reason_logically', name: 'Logical Reasoning', tier: 'atomic', category: SKILL_CATEGORIES.CORE_COGNITION, subcategory: 'reasoning', tags: ['logic', 'deduction', 'inference'], description: 'Apply formal logical reasoning to derive conclusions from premises.', systemPrompt: 'You are a logical reasoning engine. Given premises: identify stated premises, note implicit assumptions, apply valid logical rules (modus ponens, modus tollens, syllogisms), chain inferences step by step, identify logical fallacies, state confidence in conclusions. Always show reasoning chain.',
    inputs: [{ name: 'premises', type: 'array', required: true, description: 'List of premises' }, { name: 'question', type: 'string', required: true, description: 'What to reason about' }],
    outputs: [{ name: 'conclusion', type: 'string', description: 'The logical conclusion', nullable: false }, { name: 'reasoningChain', type: 'array', description: 'Step-by-step reasoning', nullable: false }, { name: 'confidence', type: 'number', description: 'Confidence 0-1', nullable: false }],
  }),

  createSkill({ id: 'cognition.summarize', name: 'Summarize Content', tier: 'atomic', category: SKILL_CATEGORIES.CORE_COGNITION, subcategory: 'synthesis', tags: ['summarization', 'compression', 'tldr'], description: 'Condense content while preserving essential meaning.', systemPrompt: 'You are an expert summarizer. Identify core message, extract key supporting points, preserve critical details (numbers, names, dates), maintain logical flow, remove redundancy, match target length precisely. Never introduce information not in source.',
    inputs: [{ name: 'content', type: 'string', required: true, description: 'Content to summarize' }, { name: 'targetLength', type: 'string', required: false, description: 'tweet|paragraph|page', defaultValue: 'paragraph' }],
    outputs: [{ name: 'summary', type: 'string', description: 'Condensed summary', nullable: false }, { name: 'keyPoints', type: 'array', description: 'Key points extracted', nullable: false }],
  }),

  createSkill({ id: 'cognition.compare_contrast', name: 'Compare and Contrast', tier: 'atomic', category: SKILL_CATEGORIES.CORE_COGNITION, subcategory: 'analysis', tags: ['comparison', 'evaluation'], description: 'Systematically compare items identifying similarities and differences.', systemPrompt: 'You are a comparison analyst. Identify comparison dimensions, evaluate each item on each dimension, note similarities explicitly, highlight key differences, identify unique strengths/weaknesses, consider context-dependent tradeoffs. Be objective.',
    inputs: [{ name: 'items', type: 'array', required: true, description: 'Items to compare (2+)' }, { name: 'criteria', type: 'array', required: false, description: 'Comparison criteria' }],
    outputs: [{ name: 'similarities', type: 'array', description: 'Common attributes', nullable: false }, { name: 'differences', type: 'array', description: 'Distinguishing factors', nullable: false }, { name: 'matrix', type: 'object', description: 'Item x Criteria matrix', nullable: false }],
  }),

  createSkill({ id: 'cognition.classify', name: 'Classify Items', tier: 'atomic', category: SKILL_CATEGORIES.CORE_COGNITION, subcategory: 'categorization', tags: ['classification', 'taxonomy', 'labeling'], description: 'Assign items to categories based on classification schemes.', systemPrompt: 'You are a classification specialist. Understand the classification scheme, identify defining characteristics, evaluate items against criteria, handle edge cases, assign primary/secondary classifications, note confidence levels, explain non-obvious classifications.',
    inputs: [{ name: 'items', type: 'array', required: true, description: 'Items to classify' }, { name: 'categories', type: 'array', required: false, description: 'Available categories' }],
    outputs: [{ name: 'classifications', type: 'array', description: 'Item-category mappings', nullable: false }, { name: 'confidence', type: 'object', description: 'Confidence per classification', nullable: false }],
  }),

  createSkill({ id: 'cognition.extract_patterns', name: 'Pattern Extraction', tier: 'atomic', category: SKILL_CATEGORIES.CORE_COGNITION, subcategory: 'analysis', tags: ['patterns', 'trends', 'anomalies'], description: 'Identify recurring patterns, trends, and anomalies.', systemPrompt: 'You are a pattern recognition specialist. Look for repetition and regularity, identify sequences and progressions, note correlations, detect anomalies, distinguish signal from noise, consider temporal patterns, identify hierarchical structures. Quantify where possible.',
    inputs: [{ name: 'data', type: 'any', required: true, description: 'Data to analyze' }, { name: 'patternTypes', type: 'array', required: false, description: 'Types: temporal, structural, semantic, statistical' }],
    outputs: [{ name: 'patterns', type: 'array', description: 'Identified patterns', nullable: false }, { name: 'anomalies', type: 'array', description: 'Outliers found', nullable: true }],
  }),

  createSkill({ id: 'cognition.generate_hypotheses', name: 'Hypothesis Generation', tier: 'atomic', category: SKILL_CATEGORIES.CORE_COGNITION, subcategory: 'reasoning', tags: ['hypothesis', 'theory', 'conjecture'], description: 'Generate plausible hypotheses to explain observations.', systemPrompt: 'You are a hypothesis generator. List observations and constraints, generate multiple competing hypotheses, consider simple explanations first (Occam\'s razor), include conventional and creative hypotheses, note what each predicts, identify differentiating tests, rank by plausibility. Never present as facts.',
    inputs: [{ name: 'observations', type: 'array', required: true, description: 'Phenomena to explain' }, { name: 'constraints', type: 'array', required: false, description: 'Known constraints' }],
    outputs: [{ name: 'hypotheses', type: 'array', description: 'Ranked hypotheses', nullable: false }, { name: 'tests', type: 'array', description: 'Proposed validation tests', nullable: false }],
  }),

  createSkill({ id: 'cognition.decompose_problem', name: 'Problem Decomposition', tier: 'atomic', category: SKILL_CATEGORIES.CORE_COGNITION, subcategory: 'problem_solving', tags: ['decomposition', 'divide-conquer'], description: 'Break complex problems into manageable sub-problems.', systemPrompt: 'You are a problem decomposition specialist. Identify core problem, find natural seams for division, ensure sub-problems are smaller, more tractable, cover entire problem space, minimize interdependencies. Identify shared resources, suggest solving order, note recomposition requirements.',
    inputs: [{ name: 'problem', type: 'string', required: true, description: 'Problem to decompose' }, { name: 'maxDepth', type: 'number', required: false, description: 'Max decomposition depth', defaultValue: 3 }],
    outputs: [{ name: 'subProblems', type: 'array', description: 'Hierarchical sub-problems', nullable: false }, { name: 'dependencies', type: 'array', description: 'Dependencies between', nullable: false }, { name: 'solvingOrder', type: 'array', description: 'Recommended order', nullable: false }],
  }),

  createSkill({ id: 'cognition.evaluate_evidence', name: 'Evidence Evaluation', tier: 'atomic', category: SKILL_CATEGORIES.CORE_COGNITION, subcategory: 'critical_thinking', tags: ['evidence', 'credibility', 'verification'], description: 'Assess quality and reliability of evidence.', systemPrompt: 'You are an evidence evaluator. Assess source credibility (expertise, bias, track record), methodology, recency, corroboration, internal consistency, statistical significance, potential confounds. Rate evidence quality. Note gaps.',
    inputs: [{ name: 'evidence', type: 'array', required: true, description: 'Evidence to evaluate' }, { name: 'claim', type: 'string', required: true, description: 'Claim being supported' }],
    outputs: [{ name: 'evaluations', type: 'array', description: 'Per-item assessments', nullable: false }, { name: 'overallStrength', type: 'string', description: 'weak|moderate|strong|compelling', nullable: false }],
  }),

  createSkill({ id: 'cognition.counterfactual', name: 'Counterfactual Analysis', tier: 'atomic', category: SKILL_CATEGORIES.CORE_COGNITION, subcategory: 'reasoning', tags: ['counterfactual', 'what-if', 'scenarios'], description: 'Analyze what would have happened under different conditions.', systemPrompt: 'You are a counterfactual analyst. State actual outcome, identify key variable to change, construct plausible alternatives, trace causal chains forward, consider second-order effects, assess probability of alternatives, extract lessons. Distinguish likely from merely possible.',
    inputs: [{ name: 'actualScenario', type: 'object', required: true, description: 'What actually happened' }, { name: 'variableToChange', type: 'string', required: true, description: 'What to alter' }],
    outputs: [{ name: 'alternativeOutcomes', type: 'array', description: 'Possible alternatives', nullable: false }, { name: 'causalChain', type: 'array', description: 'How change propagates', nullable: false }],
  }),

  createSkill({ id: 'cognition.analogical_reasoning', name: 'Analogical Reasoning', tier: 'atomic', category: SKILL_CATEGORIES.CORE_COGNITION, subcategory: 'reasoning', tags: ['analogy', 'metaphor', 'transfer'], description: 'Draw parallels between domains to transfer insights.', systemPrompt: 'You are an analogy specialist. Identify structural similarities between domains, map relationships not just surface features, note where analogy breaks down, use analogies to generate insights, test if conclusions transfer validly, create accessible analogies for complex topics. Acknowledge limitations.',
    inputs: [{ name: 'source', type: 'any', required: true, description: 'Source domain' }, { name: 'target', type: 'any', required: false, description: 'Target domain' }],
    outputs: [{ name: 'analogy', type: 'string', description: 'The analogy', nullable: false }, { name: 'mappings', type: 'array', description: 'Element mappings', nullable: false }, { name: 'limitations', type: 'array', description: 'Where it breaks down', nullable: false }],
  }),

  createSkill({ id: 'cognition.deep_research', name: 'Deep Research', tier: 'composite', category: SKILL_CATEGORIES.CORE_COGNITION, subcategory: 'research', tags: ['research', 'investigation', 'synthesis'], trustLevelRequired: 2, riskCategory: 'low', composedOf: ['cognition.analyze_text', 'cognition.evaluate_evidence', 'cognition.summarize', 'web.search'], description: 'Conduct comprehensive research synthesizing multiple sources.', systemPrompt: 'You are a research specialist. Clarify research question, search for authoritative sources, evaluate credibility, extract key information, cross-reference claims, identify consensus and disagreements, synthesize coherently, cite sources. Prioritize primary sources.',
    inputs: [{ name: 'topic', type: 'string', required: true, description: 'Research topic' }, { name: 'depth', type: 'string', required: false, description: 'overview|standard|comprehensive', defaultValue: 'standard' }],
    outputs: [{ name: 'findings', type: 'object', description: 'Research findings', nullable: false }, { name: 'sources', type: 'array', description: 'Sources with citations', nullable: false }, { name: 'synthesis', type: 'string', description: 'Synthesized narrative', nullable: false }],
    toolsRequired: ['web_search', 'web_fetch'],
  }),

  createSkill({ id: 'cognition.strategic_planning', name: 'Strategic Planning', tier: 'composite', category: SKILL_CATEGORIES.CORE_COGNITION, subcategory: 'planning', tags: ['strategy', 'planning', 'roadmap'], composedOf: ['cognition.decompose_problem', 'cognition.generate_hypotheses', 'cognition.counterfactual'], description: 'Develop strategic plans with goals, milestones, and contingencies.', systemPrompt: 'You are a strategic planning specialist. Clarify vision and objectives, assess current state honestly, identify constraints and resources, generate strategic options, evaluate against criteria, define measurable milestones, anticipate risks and contingencies, create actionable roadmap.',
    inputs: [{ name: 'objective', type: 'string', required: true, description: 'What to achieve' }, { name: 'currentState', type: 'object', required: true, description: 'Starting point' }, { name: 'constraints', type: 'array', required: false, description: 'Limitations' }],
    outputs: [{ name: 'strategy', type: 'object', description: 'Strategic approach', nullable: false }, { name: 'milestones', type: 'array', description: 'Key milestones', nullable: false }, { name: 'roadmap', type: 'array', description: 'Action roadmap', nullable: false }, { name: 'risks', type: 'array', description: 'Risk assessment', nullable: false }],
  }),

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║ COMMUNICATION - Writing, Speaking, Translation                            ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝

  createSkill({ id: 'communication.write_prose', name: 'Write Prose', tier: 'atomic', category: SKILL_CATEGORIES.COMMUNICATION, subcategory: 'writing', tags: ['writing', 'prose', 'composition'], description: 'Compose clear, engaging prose for various purposes.', systemPrompt: 'You are a skilled prose writer. Match tone to purpose and audience, lead with key message, use active voice, vary sentence structure, choose precise words, create logical flow, edit ruthlessly for clarity. Quality over quantity.',
    inputs: [{ name: 'purpose', type: 'string', required: true, description: 'Purpose of writing' }, { name: 'topic', type: 'string', required: true, description: 'Subject matter' }, { name: 'tone', type: 'string', required: false, description: 'formal|casual|professional|friendly', defaultValue: 'professional' }],
    outputs: [{ name: 'content', type: 'string', description: 'Written prose', nullable: false }, { name: 'wordCount', type: 'number', description: 'Word count', nullable: false }],
  }),

  createSkill({ id: 'communication.write_email', name: 'Write Email', tier: 'atomic', category: SKILL_CATEGORIES.COMMUNICATION, subcategory: 'business_writing', tags: ['email', 'business', 'correspondence'], description: 'Compose professional emails for various contexts.', systemPrompt: 'You are an email writing specialist. Clear specific subject line, appropriate greeting, state purpose in first sentence, one topic per email, clear action items with owners and dates, appropriate sign-off. Be concise.',
    inputs: [{ name: 'purpose', type: 'string', required: true, description: 'Email purpose' }, { name: 'recipient', type: 'string', required: true, description: 'Who is receiving' }, { name: 'keyPoints', type: 'array', required: true, description: 'Points to cover' }],
    outputs: [{ name: 'subject', type: 'string', description: 'Subject line', nullable: false }, { name: 'body', type: 'string', description: 'Email body', nullable: false }],
  }),

  createSkill({ id: 'communication.translate', name: 'Translate Text', tier: 'atomic', category: SKILL_CATEGORIES.COMMUNICATION, subcategory: 'translation', tags: ['translation', 'language', 'localization'], description: 'Translate text preserving meaning and nuance.', systemPrompt: 'You are a translation specialist. Preserve meaning over literal words, maintain tone and register, handle idioms appropriately, consider cultural context, keep technical terms accurate. Note cultural considerations.',
    inputs: [{ name: 'text', type: 'string', required: true, description: 'Text to translate' }, { name: 'sourceLanguage', type: 'string', required: true, description: 'Source language' }, { name: 'targetLanguage', type: 'string', required: true, description: 'Target language' }],
    outputs: [{ name: 'translation', type: 'string', description: 'Translated text', nullable: false }, { name: 'notes', type: 'array', description: 'Translation notes', nullable: true }],
  }),

  createSkill({ id: 'communication.proofread', name: 'Proofread and Edit', tier: 'atomic', category: SKILL_CATEGORIES.COMMUNICATION, subcategory: 'editing', tags: ['proofreading', 'grammar', 'spelling'], description: 'Review text for errors and improvements.', systemPrompt: 'You are a proofreading specialist. Check spelling, grammar, punctuation, clarity, consistency (style, tense, voice), formatting. Preserve author voice. Distinguish errors from stylistic choices.',
    inputs: [{ name: 'text', type: 'string', required: true, description: 'Text to review' }, { name: 'depth', type: 'string', required: false, description: 'light|standard|deep', defaultValue: 'standard' }],
    outputs: [{ name: 'correctedText', type: 'string', description: 'Text with corrections', nullable: false }, { name: 'changes', type: 'array', description: 'Changes made', nullable: false }],
  }),

  createSkill({ id: 'communication.rewrite_tone', name: 'Rewrite for Tone', tier: 'atomic', category: SKILL_CATEGORIES.COMMUNICATION, subcategory: 'editing', tags: ['tone', 'rewriting', 'style'], description: 'Rewrite content to match specified tone.', systemPrompt: 'You are a tone specialist. Understand target tone deeply, preserve all factual content, adjust word choice systematically, modify sentence structure as needed, maintain consistency. Message should feel naturally written.',
    inputs: [{ name: 'text', type: 'string', required: true, description: 'Original text' }, { name: 'targetTone', type: 'string', required: true, description: 'professional|casual|friendly|authoritative|empathetic|urgent' }],
    outputs: [{ name: 'rewrittenText', type: 'string', description: 'Text in new tone', nullable: false }],
  }),

  createSkill({ id: 'communication.explain_concept', name: 'Explain Concept', tier: 'atomic', category: SKILL_CATEGORIES.COMMUNICATION, subcategory: 'education', tags: ['explanation', 'teaching', 'simplification'], description: 'Explain complex concepts clearly for different levels.', systemPrompt: 'You are an explanation specialist. Assess current understanding, start from what they know, build incrementally, use relatable analogies, provide concrete examples, anticipate misconceptions. Make complex accessible without oversimplifying.',
    inputs: [{ name: 'concept', type: 'string', required: true, description: 'Concept to explain' }, { name: 'audienceLevel', type: 'string', required: false, description: 'child|teen|adult_novice|adult_intermediate|expert', defaultValue: 'adult_novice' }],
    outputs: [{ name: 'explanation', type: 'string', description: 'The explanation', nullable: false }, { name: 'analogies', type: 'array', description: 'Analogies used', nullable: true }],
  }),

  createSkill({ id: 'communication.active_listening', name: 'Active Listening', tier: 'atomic', category: SKILL_CATEGORIES.COMMUNICATION, subcategory: 'interpersonal', tags: ['listening', 'empathy', 'understanding'], description: 'Demonstrate understanding and extract meaning from communication.', systemPrompt: 'You are an active listening specialist. Focus on understanding not responding, identify explicit and implicit messages, note emotional undertones, recognize what is unsaid, acknowledge and validate, ask clarifying questions, summarize to confirm.',
    inputs: [{ name: 'message', type: 'string', required: true, description: 'Message received' }, { name: 'context', type: 'string', required: false, description: 'Conversation context' }],
    outputs: [{ name: 'explicitContent', type: 'string', description: 'What was said', nullable: false }, { name: 'implicitContent', type: 'array', description: 'What was implied', nullable: true }, { name: 'clarifyingQuestions', type: 'array', description: 'Questions to ask', nullable: true }],
  }),

  createSkill({ id: 'communication.give_feedback', name: 'Give Constructive Feedback', tier: 'atomic', category: SKILL_CATEGORIES.COMMUNICATION, subcategory: 'interpersonal', tags: ['feedback', 'coaching', 'development'], description: 'Provide actionable constructive feedback.', systemPrompt: 'You are a feedback specialist. Be specific not general, focus on behavior not character, balance positive and constructive, make it actionable, use "I observed" language, invite dialogue. Leave recipient empowered.',
    inputs: [{ name: 'situation', type: 'string', required: true, description: 'What happened' }, { name: 'goal', type: 'string', required: true, description: 'Outcome you are supporting' }],
    outputs: [{ name: 'feedback', type: 'string', description: 'Feedback to deliver', nullable: false }, { name: 'actionItems', type: 'array', description: 'Specific next steps', nullable: false }],
  }),

  createSkill({ id: 'communication.negotiate', name: 'Negotiate', tier: 'atomic', category: SKILL_CATEGORIES.COMMUNICATION, subcategory: 'interpersonal', tags: ['negotiation', 'persuasion', 'agreement'], trustLevelRequired: 2, riskCategory: 'low', description: 'Conduct principled negotiation for mutual benefit.', systemPrompt: 'You are a negotiation specialist. Understand all parties interests (not positions), identify BATNA, find value creation opportunities, separate people from problems, focus on interests, generate options for mutual gain, use objective criteria. Aim for win-win.',
    inputs: [{ name: 'situation', type: 'string', required: true, description: 'Negotiation context' }, { name: 'myInterests', type: 'array', required: true, description: 'What I want and why' }],
    outputs: [{ name: 'strategy', type: 'object', description: 'Negotiation approach', nullable: false }, { name: 'openingPosition', type: 'string', description: 'Where to start', nullable: false }, { name: 'tradeoffs', type: 'array', description: 'Possible concessions', nullable: false }],
  }),

  createSkill({ id: 'communication.present', name: 'Create Presentation', tier: 'atomic', category: SKILL_CATEGORIES.COMMUNICATION, subcategory: 'presentation', tags: ['presentation', 'speaking', 'slides'], description: 'Structure compelling presentations.', systemPrompt: 'You are a presentation specialist. Start with one thing audience should remember, tell story with beginning/middle/end, one idea per slide, use visuals over text, create tension and resolution, include concrete examples, clear call to action. Design for impact.',
    inputs: [{ name: 'topic', type: 'string', required: true, description: 'Presentation topic' }, { name: 'audience', type: 'string', required: true, description: 'Who will watch' }, { name: 'duration', type: 'number', required: false, description: 'Minutes available', defaultValue: 15 }],
    outputs: [{ name: 'outline', type: 'array', description: 'Presentation structure', nullable: false }, { name: 'slides', type: 'array', description: 'Slide content', nullable: false }, { name: 'speakerNotes', type: 'array', description: 'Notes per slide', nullable: false }],
  }),

  createSkill({ id: 'communication.write_documentation', name: 'Write Technical Documentation', tier: 'atomic', category: SKILL_CATEGORIES.COMMUNICATION, subcategory: 'technical_writing', tags: ['documentation', 'technical', 'guides'], description: 'Create clear technical documentation.', systemPrompt: 'You are a technical writer. Know your audience level, start with overview, organize logically, use consistent terminology, include examples liberally, add troubleshooting, keep sentences short and direct, use proper formatting.',
    inputs: [{ name: 'subject', type: 'string', required: true, description: 'What to document' }, { name: 'type', type: 'string', required: true, description: 'howto|reference|tutorial|explanation' }, { name: 'audienceLevel', type: 'string', required: false, description: 'beginner|intermediate|expert', defaultValue: 'intermediate' }],
    outputs: [{ name: 'documentation', type: 'string', description: 'The documentation', nullable: false }, { name: 'outline', type: 'array', description: 'Document structure', nullable: false }],
  }),

  createSkill({ id: 'communication.crisis_communication', name: 'Crisis Communication', tier: 'composite', category: SKILL_CATEGORIES.COMMUNICATION, subcategory: 'crisis', tags: ['crisis', 'pr', 'damage-control'], trustLevelRequired: 4, riskCategory: 'high', requiresHumanApproval: true, auditLevel: 'forensic', composedOf: ['communication.write_prose', 'communication.rewrite_tone', 'cognition.counterfactual'], description: 'Develop crisis communication strategy.', systemPrompt: 'You are a crisis communication specialist. Assess situation accurately, identify stakeholders and concerns, develop key messages (honest, transparent), prepare holding statements, anticipate questions, coordinate timing. Speed matters but accuracy matters more. Never lie.',
    inputs: [{ name: 'situation', type: 'object', required: true, description: 'Crisis details' }, { name: 'stakeholders', type: 'array', required: true, description: 'Affected parties' }, { name: 'facts', type: 'array', required: true, description: 'Confirmed facts' }],
    outputs: [{ name: 'holdingStatement', type: 'string', description: 'Immediate statement', nullable: false }, { name: 'fullStatement', type: 'string', description: 'Detailed statement', nullable: false }, { name: 'qAndA', type: 'array', description: 'Anticipated Q&A', nullable: false }],
    governanceNotes: 'All crisis communications require human approval. Logged for legal.',
  }),

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║ DATA OPERATIONS - Manipulation, Transformation, Analysis                  ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝

  createSkill({ id: 'data.parse_json', name: 'Parse JSON', tier: 'atomic', category: SKILL_CATEGORIES.DATA_OPERATIONS, subcategory: 'parsing', tags: ['json', 'parsing', 'data'], description: 'Parse and validate JSON data.', systemPrompt: 'Parse JSON input. Handle malformed JSON gracefully. Extract requested fields. Support JSONPath. Report structure if asked.',
    inputs: [{ name: 'jsonString', type: 'string', required: true, description: 'JSON to parse' }, { name: 'extractFields', type: 'array', required: false, description: 'Fields to extract' }],
    outputs: [{ name: 'parsed', type: 'object', description: 'Parsed object', nullable: false }, { name: 'valid', type: 'boolean', description: 'Validation result', nullable: false }],
  }),

  createSkill({ id: 'data.parse_csv', name: 'Parse CSV', tier: 'atomic', category: SKILL_CATEGORIES.DATA_OPERATIONS, subcategory: 'parsing', tags: ['csv', 'tabular', 'spreadsheet'], description: 'Parse CSV data with various configurations.', systemPrompt: 'Parse CSV/TSV data. Detect delimiters. Handle quoted fields. Convert to structured format.',
    inputs: [{ name: 'csvData', type: 'string', required: true, description: 'CSV data' }, { name: 'hasHeader', type: 'boolean', required: false, description: 'First row is header', defaultValue: true }],
    outputs: [{ name: 'rows', type: 'array', description: 'Parsed rows', nullable: false }, { name: 'headers', type: 'array', description: 'Column headers', nullable: false }, { name: 'rowCount', type: 'number', description: 'Number of rows', nullable: false }],
  }),

  createSkill({ id: 'data.validate', name: 'Validate Data', tier: 'atomic', category: SKILL_CATEGORIES.DATA_OPERATIONS, subcategory: 'validation', tags: ['validation', 'schema', 'quality'], description: 'Validate data against schemas and rules.', systemPrompt: 'Validate data comprehensively. Check types, ranges, formats, required fields, relationships. Report all violations with details.',
    inputs: [{ name: 'data', type: 'any', required: true, description: 'Data to validate' }, { name: 'schema', type: 'object', required: false, description: 'Validation schema' }],
    outputs: [{ name: 'valid', type: 'boolean', description: 'Overall validity', nullable: false }, { name: 'errors', type: 'array', description: 'Validation errors', nullable: true }],
  }),

  createSkill({ id: 'data.transform', name: 'Transform Data', tier: 'atomic', category: SKILL_CATEGORIES.DATA_OPERATIONS, subcategory: 'transformation', tags: ['transform', 'mapping', 'etl'], description: 'Transform data from one structure to another.', systemPrompt: 'Transform data according to mapping specification. Handle type conversions. Preserve integrity. Report data loss.',
    inputs: [{ name: 'data', type: 'any', required: true, description: 'Data to transform' }, { name: 'mapping', type: 'object', required: true, description: 'Transformation mapping' }],
    outputs: [{ name: 'transformed', type: 'any', description: 'Transformed data', nullable: false }, { name: 'lostFields', type: 'array', description: 'Fields not mapped', nullable: true }],
  }),

  createSkill({ id: 'data.aggregate', name: 'Aggregate Data', tier: 'atomic', category: SKILL_CATEGORIES.DATA_OPERATIONS, subcategory: 'analysis', tags: ['aggregation', 'grouping', 'statistics'], description: 'Aggregate data with grouping and statistical operations.', systemPrompt: 'Aggregate data by specified dimensions. Apply functions (sum, avg, count, min, max). Handle nulls appropriately.',
    inputs: [{ name: 'data', type: 'array', required: true, description: 'Data to aggregate' }, { name: 'groupBy', type: 'array', required: false, description: 'Grouping fields' }, { name: 'aggregations', type: 'array', required: true, description: 'Aggregation operations' }],
    outputs: [{ name: 'result', type: 'array', description: 'Aggregated results', nullable: false }],
  }),

  createSkill({ id: 'data.filter', name: 'Filter Data', tier: 'atomic', category: SKILL_CATEGORIES.DATA_OPERATIONS, subcategory: 'query', tags: ['filter', 'query', 'search'], description: 'Filter data based on conditions.', systemPrompt: 'Filter data matching conditions. Support complex boolean logic. Return matching records and count.',
    inputs: [{ name: 'data', type: 'array', required: true, description: 'Data to filter' }, { name: 'conditions', type: 'object', required: true, description: 'Filter conditions' }],
    outputs: [{ name: 'results', type: 'array', description: 'Filtered results', nullable: false }, { name: 'totalMatches', type: 'number', description: 'Match count', nullable: false }],
  }),

  createSkill({ id: 'data.deduplicate', name: 'Deduplicate Data', tier: 'atomic', category: SKILL_CATEGORIES.DATA_OPERATIONS, subcategory: 'cleaning', tags: ['dedupe', 'unique', 'cleaning'], description: 'Remove duplicate records.', systemPrompt: 'Identify and remove duplicates. Use specified keys. Handle fuzzy matching if requested. Report duplicate clusters.',
    inputs: [{ name: 'data', type: 'array', required: true, description: 'Data to deduplicate' }, { name: 'keys', type: 'array', required: true, description: 'Fields to identify duplicates' }],
    outputs: [{ name: 'deduplicated', type: 'array', description: 'Unique records', nullable: false }, { name: 'duplicatesRemoved', type: 'number', description: 'Count removed', nullable: false }],
  }),

  createSkill({ id: 'data.join', name: 'Join Data Sets', tier: 'atomic', category: SKILL_CATEGORIES.DATA_OPERATIONS, subcategory: 'combination', tags: ['join', 'merge', 'combine'], description: 'Join multiple data sets on common keys.', systemPrompt: 'Join data sets on specified keys. Support inner, left, right, outer joins. Handle key collisions. Report unmatched.',
    inputs: [{ name: 'left', type: 'array', required: true, description: 'Left data set' }, { name: 'right', type: 'array', required: true, description: 'Right data set' }, { name: 'leftKey', type: 'string', required: true, description: 'Left join key' }, { name: 'rightKey', type: 'string', required: true, description: 'Right join key' }, { name: 'joinType', type: 'string', required: false, description: 'inner|left|right|outer', defaultValue: 'inner' }],
    outputs: [{ name: 'joined', type: 'array', description: 'Joined data', nullable: false }, { name: 'matchedCount', type: 'number', description: 'Records matched', nullable: false }],
  }),

  createSkill({ id: 'data.clean', name: 'Clean Data', tier: 'atomic', category: SKILL_CATEGORIES.DATA_OPERATIONS, subcategory: 'cleaning', tags: ['cleaning', 'normalization', 'standardization'], description: 'Clean and standardize data values.', systemPrompt: 'Clean data: trim whitespace, standardize formats, fix common typos, normalize case, handle special characters. Report changes.',
    inputs: [{ name: 'data', type: 'any', required: true, description: 'Data to clean' }, { name: 'operations', type: 'array', required: false, description: 'Cleaning operations' }],
    outputs: [{ name: 'cleaned', type: 'any', description: 'Cleaned data', nullable: false }, { name: 'changesLog', type: 'array', description: 'Changes made', nullable: true }],
  }),

  createSkill({ id: 'data.analyze_quality', name: 'Analyze Data Quality', tier: 'atomic', category: SKILL_CATEGORIES.DATA_OPERATIONS, subcategory: 'quality', tags: ['quality', 'profiling', 'audit'], description: 'Profile data and assess quality.', systemPrompt: 'Profile data: completeness, uniqueness, validity, consistency. Identify issues and improvement opportunities.',
    inputs: [{ name: 'data', type: 'array', required: true, description: 'Data to profile' }],
    outputs: [{ name: 'profile', type: 'object', description: 'Data profile', nullable: false }, { name: 'qualityScore', type: 'number', description: 'Quality 0-100', nullable: false }, { name: 'issues', type: 'array', description: 'Issues found', nullable: true }],
  }),

  createSkill({ id: 'data.etl_pipeline', name: 'ETL Pipeline', tier: 'composite', category: SKILL_CATEGORIES.DATA_OPERATIONS, subcategory: 'pipeline', tags: ['etl', 'pipeline', 'integration'], trustLevelRequired: 3, riskCategory: 'medium', auditLevel: 'detailed', composedOf: ['data.parse_json', 'data.parse_csv', 'data.validate', 'data.transform', 'data.clean'], description: 'Execute Extract-Transform-Load pipeline.', systemPrompt: 'Execute ETL: extract from source, validate, clean, transform to target schema, load. Handle errors gracefully. Log all operations.',
    inputs: [{ name: 'source', type: 'object', required: true, description: 'Source data' }, { name: 'transformations', type: 'array', required: true, description: 'Transformation steps' }, { name: 'destination', type: 'object', required: true, description: 'Target destination' }],
    outputs: [{ name: 'recordsProcessed', type: 'number', description: 'Total processed', nullable: false }, { name: 'recordsLoaded', type: 'number', description: 'Successfully loaded', nullable: false }, { name: 'errorLog', type: 'array', description: 'Error details', nullable: true }],
  }),

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║ WEB OPERATIONS - HTTP, Search, Scraping                                   ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝

  createSkill({ id: 'web.search', name: 'Web Search', tier: 'atomic', category: SKILL_CATEGORIES.WEB_OPERATIONS, subcategory: 'search', tags: ['search', 'web', 'query'], trustLevelRequired: 2, riskCategory: 'low', description: 'Search the web for information.', systemPrompt: 'Execute web search. Formulate effective queries. Parse and rank results. Filter for relevance and credibility.',
    inputs: [{ name: 'query', type: 'string', required: true, description: 'Search query' }, { name: 'resultCount', type: 'number', required: false, description: 'Number of results', defaultValue: 10 }],
    outputs: [{ name: 'results', type: 'array', description: 'Search results', nullable: false }],
    toolsRequired: ['web_search'],
  }),

  createSkill({ id: 'web.fetch', name: 'Fetch URL', tier: 'atomic', category: SKILL_CATEGORIES.WEB_OPERATIONS, subcategory: 'http', tags: ['fetch', 'http', 'download'], trustLevelRequired: 2, riskCategory: 'low', description: 'Fetch content from a URL.', systemPrompt: 'Fetch URL content. Handle redirects. Extract main content. Parse based on content type.',
    inputs: [{ name: 'url', type: 'url', required: true, description: 'URL to fetch' }],
    outputs: [{ name: 'content', type: 'string', description: 'Page content', nullable: false }, { name: 'contentType', type: 'string', description: 'Content type', nullable: false }, { name: 'statusCode', type: 'number', description: 'HTTP status', nullable: false }],
    toolsRequired: ['web_fetch'],
  }),

  createSkill({ id: 'web.api_request', name: 'API Request', tier: 'atomic', category: SKILL_CATEGORIES.WEB_OPERATIONS, subcategory: 'api', tags: ['api', 'rest', 'integration'], trustLevelRequired: 3, riskCategory: 'medium', description: 'Make API requests with authentication.', systemPrompt: 'Execute API request. Handle authentication. Retry on transient failures. Parse response appropriately.',
    inputs: [{ name: 'url', type: 'url', required: true, description: 'API endpoint' }, { name: 'method', type: 'string', required: false, description: 'HTTP method', defaultValue: 'GET' }, { name: 'body', type: 'any', required: false, description: 'Request body' }],
    outputs: [{ name: 'data', type: 'any', description: 'Response data', nullable: false }, { name: 'statusCode', type: 'number', description: 'HTTP status', nullable: false }, { name: 'success', type: 'boolean', description: 'Request successful', nullable: false }],
    toolsRequired: ['web_fetch'],
  }),

  createSkill({ id: 'web.scrape', name: 'Web Scrape', tier: 'atomic', category: SKILL_CATEGORIES.WEB_OPERATIONS, subcategory: 'extraction', tags: ['scrape', 'extract', 'parse'], trustLevelRequired: 2, riskCategory: 'low', description: 'Extract structured data from web pages.', systemPrompt: 'Scrape web page. Parse HTML. Extract specified data fields. Handle pagination. Respect robots.txt.',
    inputs: [{ name: 'url', type: 'url', required: true, description: 'Page to scrape' }, { name: 'selectors', type: 'object', required: true, description: 'CSS/XPath selectors' }],
    outputs: [{ name: 'data', type: 'array', description: 'Extracted data', nullable: false }, { name: 'pagesProcessed', type: 'number', description: 'Pages scraped', nullable: false }],
    toolsRequired: ['web_fetch'],
  }),

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║ CODE DEVELOPMENT - Writing, Review, Debugging                             ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝

  createSkill({ id: 'code.write', name: 'Write Code', tier: 'atomic', category: SKILL_CATEGORIES.CODE_DEVELOPMENT, subcategory: 'creation', tags: ['code', 'programming', 'development'], trustLevelRequired: 2, riskCategory: 'low', description: 'Write code in specified language.', systemPrompt: 'Write clean, well-structured code. Follow language idioms. Include comments for complex logic. Handle errors properly. Consider edge cases.',
    inputs: [{ name: 'specification', type: 'string', required: true, description: 'What code should do' }, { name: 'language', type: 'string', required: true, description: 'Programming language' }],
    outputs: [{ name: 'code', type: 'string', description: 'Generated code', nullable: false }, { name: 'explanation', type: 'string', description: 'Code explanation', nullable: true }],
    toolsRequired: ['code_execution'],
  }),

  createSkill({ id: 'code.review', name: 'Review Code', tier: 'atomic', category: SKILL_CATEGORIES.CODE_DEVELOPMENT, subcategory: 'quality', tags: ['review', 'quality', 'audit'], description: 'Review code for quality, bugs, and best practices.', systemPrompt: 'Review code thoroughly. Check for: bugs, security issues, performance problems, style violations, maintainability. Provide specific, actionable feedback.',
    inputs: [{ name: 'code', type: 'string', required: true, description: 'Code to review' }, { name: 'language', type: 'string', required: true, description: 'Programming language' }],
    outputs: [{ name: 'issues', type: 'array', description: 'Issues found with severity', nullable: false }, { name: 'suggestions', type: 'array', description: 'Improvement suggestions', nullable: true }, { name: 'score', type: 'number', description: 'Quality score 0-100', nullable: true }],
  }),

  createSkill({ id: 'code.debug', name: 'Debug Code', tier: 'atomic', category: SKILL_CATEGORIES.CODE_DEVELOPMENT, subcategory: 'debugging', tags: ['debug', 'fix', 'troubleshoot'], trustLevelRequired: 2, riskCategory: 'low', description: 'Debug code to identify and fix issues.', systemPrompt: 'Debug systematically. Reproduce issue. Identify root cause. Propose fix. Verify fix doesn\'t introduce new issues.',
    inputs: [{ name: 'code', type: 'string', required: true, description: 'Code with issue' }, { name: 'error', type: 'string', required: false, description: 'Error message' }, { name: 'expectedBehavior', type: 'string', required: true, description: 'What it should do' }],
    outputs: [{ name: 'diagnosis', type: 'string', description: 'Root cause', nullable: false }, { name: 'fix', type: 'string', description: 'Fixed code', nullable: false }, { name: 'explanation', type: 'string', description: 'What was wrong', nullable: false }],
    toolsRequired: ['code_execution'],
  }),

  createSkill({ id: 'code.refactor', name: 'Refactor Code', tier: 'atomic', category: SKILL_CATEGORIES.CODE_DEVELOPMENT, subcategory: 'improvement', tags: ['refactor', 'improve', 'clean'], trustLevelRequired: 2, riskCategory: 'low', description: 'Refactor code for better structure.', systemPrompt: 'Refactor for clarity, maintainability, efficiency. Preserve exact behavior. Apply appropriate patterns. Improve naming and structure.',
    inputs: [{ name: 'code', type: 'string', required: true, description: 'Code to refactor' }, { name: 'goals', type: 'array', required: false, description: 'readability|performance|modularity|testability' }],
    outputs: [{ name: 'refactoredCode', type: 'string', description: 'Refactored code', nullable: false }, { name: 'changes', type: 'array', description: 'Changes made', nullable: false }],
  }),

  createSkill({ id: 'code.test', name: 'Write Tests', tier: 'atomic', category: SKILL_CATEGORIES.CODE_DEVELOPMENT, subcategory: 'testing', tags: ['test', 'unit', 'tdd'], trustLevelRequired: 2, riskCategory: 'low', description: 'Write comprehensive tests.', systemPrompt: 'Write thorough tests. Cover happy paths, edge cases, error conditions. Use appropriate patterns. Make tests readable.',
    inputs: [{ name: 'code', type: 'string', required: true, description: 'Code to test' }, { name: 'testType', type: 'string', required: false, description: 'unit|integration|e2e', defaultValue: 'unit' }],
    outputs: [{ name: 'tests', type: 'string', description: 'Test code', nullable: false }, { name: 'testCases', type: 'array', description: 'Test descriptions', nullable: false }],
    toolsRequired: ['code_execution'],
  }),

  createSkill({ id: 'code.execute', name: 'Execute Code', tier: 'atomic', category: SKILL_CATEGORIES.CODE_DEVELOPMENT, subcategory: 'execution', tags: ['execute', 'run', 'eval'], trustLevelRequired: 3, riskCategory: 'medium', auditLevel: 'detailed', description: 'Execute code and return results.', systemPrompt: 'Execute code in sandboxed environment. Capture output, errors, return values. Respect timeouts and resource limits.',
    inputs: [{ name: 'code', type: 'string', required: true, description: 'Code to execute' }, { name: 'language', type: 'string', required: true, description: 'Programming language' }, { name: 'timeout', type: 'number', required: false, description: 'Timeout ms', defaultValue: 30000 }],
    outputs: [{ name: 'output', type: 'any', description: 'Execution output', nullable: true }, { name: 'exitCode', type: 'number', description: 'Exit code', nullable: false }, { name: 'executionTime', type: 'number', description: 'Time ms', nullable: false }],
    toolsRequired: ['code_execution'],
    governanceNotes: 'Code execution is sandboxed. Resource usage logged.',
  }),

  createSkill({ id: 'code.explain', name: 'Explain Code', tier: 'atomic', category: SKILL_CATEGORIES.CODE_DEVELOPMENT, subcategory: 'documentation', tags: ['explain', 'document', 'teach'], description: 'Explain what code does in plain language.', systemPrompt: 'Explain code clearly. Start with high-level purpose. Break down logic step by step. Explain non-obvious parts. Match audience level.',
    inputs: [{ name: 'code', type: 'string', required: true, description: 'Code to explain' }, { name: 'audienceLevel', type: 'string', required: false, description: 'beginner|intermediate|expert', defaultValue: 'intermediate' }],
    outputs: [{ name: 'explanation', type: 'string', description: 'Plain language explanation', nullable: false }, { name: 'summary', type: 'string', description: 'One-line summary', nullable: false }],
  }),

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║ MATHEMATICAL - Calculations, Statistics, Modeling                         ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝

  createSkill({ id: 'math.calculate', name: 'Calculate', tier: 'atomic', category: SKILL_CATEGORIES.MATHEMATICAL, subcategory: 'arithmetic', tags: ['calculate', 'math', 'compute'], description: 'Perform mathematical calculations.', systemPrompt: 'Calculate accurately. Show work for complex calculations. Handle units. Report precision/rounding.',
    inputs: [{ name: 'expression', type: 'string', required: true, description: 'Mathematical expression' }, { name: 'variables', type: 'object', required: false, description: 'Variable values' }],
    outputs: [{ name: 'result', type: 'number', description: 'Calculation result', nullable: false }, { name: 'steps', type: 'array', description: 'Calculation steps', nullable: true }],
  }),

  createSkill({ id: 'math.statistics', name: 'Statistical Analysis', tier: 'atomic', category: SKILL_CATEGORIES.MATHEMATICAL, subcategory: 'statistics', tags: ['statistics', 'mean', 'variance'], description: 'Calculate statistical measures.', systemPrompt: 'Compute statistics. Handle outliers. Report confidence intervals. Note sample vs population.',
    inputs: [{ name: 'data', type: 'array', required: true, description: 'Data to analyze' }, { name: 'measures', type: 'array', required: false, description: 'mean|median|mode|std|variance|percentiles|all' }],
    outputs: [{ name: 'statistics', type: 'object', description: 'Computed statistics', nullable: false }, { name: 'outliers', type: 'array', description: 'Detected outliers', nullable: true }],
  }),

  createSkill({ id: 'math.regression', name: 'Regression Analysis', tier: 'atomic', category: SKILL_CATEGORIES.MATHEMATICAL, subcategory: 'modeling', tags: ['regression', 'modeling', 'prediction'], description: 'Perform regression analysis.', systemPrompt: 'Fit regression model. Report coefficients, R², significance. Check assumptions. Provide predictions with confidence.',
    inputs: [{ name: 'xData', type: 'array', required: true, description: 'Independent variable(s)' }, { name: 'yData', type: 'array', required: true, description: 'Dependent variable' }, { name: 'type', type: 'string', required: false, description: 'linear|polynomial|logistic', defaultValue: 'linear' }],
    outputs: [{ name: 'coefficients', type: 'array', description: 'Model coefficients', nullable: false }, { name: 'rSquared', type: 'number', description: 'R² value', nullable: false }, { name: 'equation', type: 'string', description: 'Model equation', nullable: false }],
  }),

  createSkill({ id: 'math.convert_units', name: 'Convert Units', tier: 'atomic', category: SKILL_CATEGORIES.MATHEMATICAL, subcategory: 'conversion', tags: ['units', 'conversion', 'measurement'], description: 'Convert between units.', systemPrompt: 'Convert units accurately. Handle compound units. Use precise conversion factors.',
    inputs: [{ name: 'value', type: 'number', required: true, description: 'Value to convert' }, { name: 'fromUnit', type: 'string', required: true, description: 'Source unit' }, { name: 'toUnit', type: 'string', required: true, description: 'Target unit' }],
    outputs: [{ name: 'result', type: 'number', description: 'Converted value', nullable: false }],
  }),

  createSkill({ id: 'math.financial_calc', name: 'Financial Calculations', tier: 'atomic', category: SKILL_CATEGORIES.MATHEMATICAL, subcategory: 'finance', tags: ['finance', 'interest', 'investment'], trustLevelRequired: 2, riskCategory: 'low', description: 'Perform financial calculations.', systemPrompt: 'Calculate financial metrics accurately. Use proper compounding. Show assumptions. Provide schedules where applicable.',
    inputs: [{ name: 'calculationType', type: 'string', required: true, description: 'npv|irr|pmt|fv|pv|amortization|roi' }, { name: 'parameters', type: 'object', required: true, description: 'Calculation parameters' }],
    outputs: [{ name: 'result', type: 'any', description: 'Calculation result', nullable: false }, { name: 'schedule', type: 'array', description: 'Payment schedule', nullable: true }],
  }),

  createSkill({ id: 'math.probability', name: 'Probability Calculations', tier: 'atomic', category: SKILL_CATEGORIES.MATHEMATICAL, subcategory: 'probability', tags: ['probability', 'risk', 'likelihood'], description: 'Calculate probabilities.', systemPrompt: 'Calculate probabilities accurately. Handle dependent/independent events. Apply appropriate distributions. Report assumptions.',
    inputs: [{ name: 'scenario', type: 'object', required: true, description: 'Probability scenario' }, { name: 'distribution', type: 'string', required: false, description: 'Distribution type' }],
    outputs: [{ name: 'probability', type: 'number', description: 'Calculated probability', nullable: false }, { name: 'confidenceInterval', type: 'object', description: 'Confidence interval', nullable: true }],
  }),

  createSkill({ id: 'math.optimize', name: 'Optimization', tier: 'atomic', category: SKILL_CATEGORIES.MATHEMATICAL, subcategory: 'optimization', tags: ['optimization', 'minimize', 'maximize'], trustLevelRequired: 2, riskCategory: 'low', description: 'Solve optimization problems.', systemPrompt: 'Solve optimization. Find optimal values respecting constraints. Report sensitivity analysis.',
    inputs: [{ name: 'objective', type: 'string', required: true, description: 'Objective function' }, { name: 'goal', type: 'string', required: true, description: 'minimize|maximize' }, { name: 'constraints', type: 'array', required: false, description: 'Constraint equations' }],
    outputs: [{ name: 'optimalValues', type: 'object', description: 'Optimal values', nullable: false }, { name: 'objectiveValue', type: 'number', description: 'Optimal objective', nullable: false }],
  }),

  // Continued in Part 2...
];
