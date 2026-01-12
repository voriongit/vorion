/**
 * Knowledge Base Types
 *
 * Comprehensive knowledge system from BAI ai-workforce with:
 * - Multi-modal knowledge capture
 * - Semantic understanding with embeddings
 * - Knowledge graphs with relationships
 * - Quality tracking and active learning
 */

// ============================================================================
// Core Knowledge Types
// ============================================================================

export type KnowledgeType =
  | 'fact'          // Verified truth
  | 'concept'       // Abstract idea or definition
  | 'procedure'     // How to do something
  | 'principle'     // Guiding rule or heuristic
  | 'example'       // Concrete instance
  | 'pattern'       // Recurring solution
  | 'anti_pattern'  // What to avoid
  | 'relationship'  // Connection between things
  | 'context'       // Situational information
  | 'preference'    // User/system preference
  | 'decision'      // Recorded decision with rationale
  | 'experience'    // Learned from doing
  | 'insight'       // Derived understanding
  | 'hypothesis'    // Unverified belief
  | 'question'      // Open inquiry
  | 'contradiction' // Conflicting knowledge
  | 'meta'          // Knowledge about knowledge

export type KnowledgeSource =
  | 'conversation'     // From user interactions
  | 'codebase'         // From source code analysis
  | 'documentation'    // From docs
  | 'external'         // From web/APIs
  | 'inference'        // Derived by reasoning
  | 'synthesis'        // Combined from multiple sources
  | 'human_verified'   // Explicitly verified
  | 'agent_learned'    // Learned by agents
  | 'imported'         // Bulk imported
  | 'generated'        // AI generated

export type ValidityStatus =
  | 'verified'     // Confirmed true
  | 'probable'     // Likely true
  | 'uncertain'    // Unknown validity
  | 'disputed'     // Actively contested
  | 'deprecated'   // No longer valid
  | 'superseded'   // Replaced by newer knowledge
  | 'conditional'  // Valid under conditions

export type ConfidenceBasis =
  | 'verified'      // Human or system verified
  | 'inferred'      // Derived through reasoning
  | 'consensus'     // Multiple sources agree
  | 'authoritative' // From trusted source
  | 'statistical'   // Based on data
  | 'heuristic'     // Rule-based estimate
  | 'assumed'       // Default assumption

// ============================================================================
// Knowledge Item
// ============================================================================

export interface KnowledgeItem {
  id: string
  version: number
  type: KnowledgeType
  source: KnowledgeSource

  // Core content
  summary: string
  fullContent?: string
  structuredData?: Record<string, unknown>
  codeContent?: CodeContent

  // Embedding for semantic search
  embedding?: number[] // Float32Array in practice
  semanticHash?: string

  // Confidence & validity
  confidenceScore: number // 0-1
  confidenceBasis: ConfidenceBasis
  validityStatus: ValidityStatus
  verifiedAt?: Date
  verifiedBy?: string
  expiresAt?: Date

  // Organization
  domains: string[]
  tags: string[]
  categories: string[]

  // Quality metrics
  quality: KnowledgeQuality

  // Provenance
  provenance: KnowledgeProvenance

  // Ownership
  createdBy?: string
  agentId?: string

  // Lifecycle
  accessCount: number
  lastAccessedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface CodeContent {
  language: string
  code: string
  context?: string
  filePath?: string
  lineRange?: [number, number]
}

// ============================================================================
// Knowledge Quality
// ============================================================================

export interface KnowledgeQuality {
  overall: number // 0-1
  dimensions: {
    accuracy: number
    completeness: number
    consistency: number
    timeliness: number
    relevance: number
    accessibility: number
  }
  issues?: QualityIssue[]
}

export interface QualityIssue {
  type: 'missing' | 'outdated' | 'inconsistent' | 'unclear' | 'unverified'
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  detectedAt: Date
  resolvedAt?: Date
}

// ============================================================================
// Knowledge Provenance
// ============================================================================

export interface KnowledgeProvenance {
  originalSource: string
  sourceType: KnowledgeSource
  extractedBy?: string
  extractionMethod?: string
  transformations: ProvenanceTransformation[]
  citations?: Citation[]
}

export interface ProvenanceTransformation {
  type: 'extraction' | 'inference' | 'synthesis' | 'correction' | 'enrichment'
  description: string
  timestamp: Date
  agent?: string
}

export interface Citation {
  type: 'document' | 'url' | 'conversation' | 'code' | 'api'
  reference: string
  location?: string
  timestamp?: Date
}

// ============================================================================
// Knowledge Relationships
// ============================================================================

export type RelationshipType =
  // Hierarchical
  | 'is_a'           // Subtype/supertype
  | 'part_of'        // Component/container
  | 'instance_of'    // Example/class

  // Logical
  | 'implies'        // A implies B
  | 'contradicts'    // A conflicts with B
  | 'supports'       // A provides evidence for B
  | 'depends_on'     // A requires B

  // Semantic
  | 'related_to'     // General relationship
  | 'similar_to'     // Semantically similar
  | 'opposite_of'    // Antonym/contrast
  | 'derived_from'   // Created from

  // Temporal
  | 'precedes'       // A comes before B
  | 'follows'        // A comes after B
  | 'supersedes'     // A replaces B

  // Causal
  | 'causes'         // A causes B
  | 'enables'        // A allows B
  | 'prevents'       // A stops B

  // Usage
  | 'used_by'        // A is used by B
  | 'uses'           // A uses B
  | 'applies_to'     // A is relevant to B

export interface KnowledgeRelationship {
  id: string
  sourceId: string
  targetId: string
  relationshipType: RelationshipType
  strength: number // 0-1
  bidirectional: boolean
  metadata?: Record<string, unknown>
  createdAt: Date
}

// ============================================================================
// Knowledge Graph
// ============================================================================

export interface KnowledgeGraph {
  id: string
  name: string
  description: string
  nodes: KnowledgeNode[]
  edges: KnowledgeEdge[]
  clusters?: KnowledgeCluster[]
  statistics: GraphStatistics
}

export interface KnowledgeNode {
  id: string
  label: string
  type: KnowledgeType
  weight: number
  position?: { x: number; y: number }
}

export interface KnowledgeEdge {
  id: string
  source: string
  target: string
  type: RelationshipType
  weight: number
  bidirectional: boolean
}

export interface KnowledgeCluster {
  id: string
  name: string
  description?: string
  members: string[]
  centroid?: string
  coherence: number
}

export interface GraphStatistics {
  nodeCount: number
  edgeCount: number
  density: number
  averageDegree: number
  clusteringCoefficient: number
  connectedComponents: number
}

// ============================================================================
// Knowledge Query
// ============================================================================

export interface KnowledgeQuery {
  // Text search
  text?: string
  semanticSearch?: boolean

  // Filters
  types?: KnowledgeType[]
  sources?: KnowledgeSource[]
  domains?: string[]
  tags?: string[]
  categories?: string[]

  // Confidence/validity filters
  minConfidence?: number
  validityStatus?: ValidityStatus[]

  // Temporal filters
  createdAfter?: Date
  createdBefore?: Date
  validAt?: Date

  // Relationship traversal
  relatedTo?: string
  relationshipTypes?: RelationshipType[]
  traversalDepth?: number

  // Quality filters
  minQuality?: number

  // Pagination
  limit?: number
  offset?: number

  // Ordering
  orderBy?: 'relevance' | 'confidence' | 'quality' | 'recency' | 'access_frequency'
  orderDirection?: 'asc' | 'desc'
}

export interface KnowledgeSearchResult {
  item: KnowledgeItem
  score: number
  matchType: 'exact' | 'semantic' | 'related' | 'inferred'
  highlights?: Array<{ field: string; snippet: string }>
  explanation?: string
}

// ============================================================================
// Active Learning
// ============================================================================

export type LearningType =
  | 'gap'            // Missing knowledge identified
  | 'conflict'       // Contradictions to resolve
  | 'outdated'       // Stale knowledge to refresh
  | 'low_confidence' // Uncertain knowledge to verify
  | 'underutilized'  // Valuable but rarely accessed
  | 'emerging'       // New domain to explore
  | 'feedback'       // User feedback to incorporate
  | 'pattern'        // Recurring pattern to formalize

export interface LearningOpportunity {
  id: string
  type: LearningType
  description: string
  priority: number
  estimatedValue: number
  suggestedActions: LearningAction[]
  relatedKnowledge: string[]
  status: 'open' | 'in_progress' | 'resolved' | 'dismissed'
  createdAt: Date
  resolvedAt?: Date
}

export interface LearningAction {
  type: 'query' | 'research' | 'verify' | 'synthesize' | 'ask_user' | 'observe'
  description: string
  priority: number
  estimatedEffort: number
}

// ============================================================================
// Knowledge Synthesis
// ============================================================================

export type SynthesisMethod =
  | 'merge'      // Combine overlapping knowledge
  | 'abstract'   // Create higher-level concept
  | 'generalize' // Create general principle from examples
  | 'specialize' // Create specific instance from general
  | 'bridge'     // Connect disparate knowledge
  | 'resolve'    // Resolve contradictions
  | 'summarize'  // Create concise version
  | 'elaborate'  // Add detail

export interface SynthesisRequest {
  sources: string[]
  method: SynthesisMethod
  constraints?: SynthesisConstraint[]
  outputType?: KnowledgeType
}

export interface SynthesisConstraint {
  type: 'preserve' | 'exclude' | 'prioritize' | 'transform'
  target: string
  value?: unknown
}

export interface SynthesisResult {
  synthesized: KnowledgeItem
  method: SynthesisMethod
  sources: string[]
  confidence: number
  lostInformation?: string[]
  addedInformation?: string[]
}

// ============================================================================
// Knowledge Events
// ============================================================================

export type KnowledgeEventType =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'accessed'
  | 'linked'
  | 'unlinked'
  | 'verified'
  | 'challenged'
  | 'deprecated'
  | 'synthesized'
  | 'conflict_detected'
  | 'gap_identified'
  | 'quality_changed'

export interface KnowledgeEvent {
  id: string
  type: KnowledgeEventType
  timestamp: Date
  source: string
  targetId?: string
  data: Record<string, unknown>
}
