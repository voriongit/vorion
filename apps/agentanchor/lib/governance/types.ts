/**
 * Governance SDK Types
 */

// =============================================================================
// Trust System
// =============================================================================

export type TrustTier =
  | 'untrusted'    // 0-199
  | 'provisional'  // 200-399
  | 'established'  // 400-599
  | 'trusted'      // 600-799
  | 'verified'     // 800-899
  | 'certified';   // 900-1000

export interface TrustContext {
  score: number;
  tier: TrustTier;
  lastActivity: Date;
  decayApplied: boolean;
  effectiveScore: number; // After decay calculation
}

export const TRUST_TIER_THRESHOLDS: Record<TrustTier, { min: number; max: number }> = {
  untrusted: { min: 0, max: 199 },
  provisional: { min: 200, max: 399 },
  established: { min: 400, max: 599 },
  trusted: { min: 600, max: 799 },
  verified: { min: 800, max: 899 },
  certified: { min: 900, max: 1000 },
};

// =============================================================================
// Risk Assessment
// =============================================================================

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskAssessment {
  level: RiskLevel;
  factors: string[];
  requiresApproval: boolean;
  escalateTo: 'council' | 'human' | null;
}

export const RISK_AUTONOMY_REQUIREMENTS: Record<RiskLevel, number> = {
  low: 0,        // Any trust level
  medium: 400,   // Established+
  high: 600,     // Trusted+
  critical: 900, // Certified only (with human oversight)
};

// =============================================================================
// Persona System
// =============================================================================

export type PersonalityTrait =
  | 'professional'
  | 'friendly'
  | 'formal'
  | 'casual'
  | 'empathetic'
  | 'direct'
  | 'patient'
  | 'enthusiastic'
  | 'analytical'
  | 'creative';

export type Specialization =
  | 'core'
  | 'customer_service'
  | 'technical'
  | 'creative'
  | 'research'
  | 'education';

export interface PersonaConfig {
  name: string;
  description: string;
  specialization: Specialization;
  personalityTraits: PersonalityTrait[];
  systemPromptBase: string;
  toneGuidelines: string[];
  restrictions: string[];
}

// =============================================================================
// Capabilities / Skills
// =============================================================================

export type CapabilityId =
  | 'text_generation'
  | 'code_assistance'
  | 'data_analysis'
  | 'customer_support'
  | 'content_writing'
  | 'translation'
  | 'summarization'
  | 'question_answering'
  | 'creative_writing'
  | 'technical_documentation'
  | 'web_search'
  | 'file_operations'
  | 'api_integration';

export interface Capability {
  id: CapabilityId;
  name: string;
  description: string;
  riskLevel: RiskLevel;
  requiredTrustTier: TrustTier;
  toolDefinition?: ToolDefinition;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface SkillExecution {
  capabilityId: CapabilityId;
  input: Record<string, unknown>;
  output?: unknown;
  success: boolean;
  error?: string;
  executionTime: number;
}

// =============================================================================
// MCP (Model Context Protocol)
// =============================================================================

export type MCPServerType =
  | 'filesystem'
  | 'github'
  | 'database'
  | 'websearch'
  | 'custom';

export interface MCPServerConfig {
  id: string;
  name: string;
  type: MCPServerType;
  endpoint?: string;
  config: Record<string, unknown>;
  permissions: MCPPermissions;
  enabled: boolean;
}

export interface MCPPermissions {
  read: boolean;
  write: boolean;
  execute: boolean;
  allowedPaths?: string[];
  deniedPaths?: string[];
  rateLimit?: number; // requests per minute
}

export interface MCPInvocation {
  serverId: string;
  method: string;
  params: Record<string, unknown>;
  result?: unknown;
  error?: string;
  duration: number;
}

// =============================================================================
// Roles & Permissions
// =============================================================================

// UserRole includes admin for internal governance checks
// Database may use 'trainer' | 'consumer' | 'both' but SDK supports admin
export type UserRole = 'trainer' | 'consumer' | 'both' | 'admin';

export type AgentStatus =
  | 'draft'
  | 'training'
  | 'examination'
  | 'active'
  | 'suspended'
  | 'retired';

export interface Permission {
  action: string;
  resource: string;
  conditions?: Record<string, unknown>;
}

export interface RolePermissions {
  role: UserRole;
  permissions: Permission[];
}

export const ROLE_PERMISSIONS: RolePermissions[] = [
  {
    role: 'consumer',
    permissions: [
      { action: 'read', resource: 'agents' },
      { action: 'use', resource: 'agents', conditions: { status: 'active' } },
      { action: 'read', resource: 'marketplace' },
      { action: 'acquire', resource: 'agents' },
    ],
  },
  {
    role: 'trainer',
    permissions: [
      { action: 'create', resource: 'agents' },
      { action: 'update', resource: 'agents', conditions: { owned: true } },
      { action: 'delete', resource: 'agents', conditions: { owned: true } },
      { action: 'train', resource: 'agents', conditions: { owned: true } },
      { action: 'publish', resource: 'agents', conditions: { owned: true, status: 'active' } },
      { action: 'read', resource: 'academy' },
      { action: 'enroll', resource: 'academy' },
    ],
  },
  {
    role: 'both',
    permissions: [
      // All consumer permissions
      { action: 'read', resource: 'agents' },
      { action: 'use', resource: 'agents', conditions: { status: 'active' } },
      { action: 'read', resource: 'marketplace' },
      { action: 'acquire', resource: 'agents' },
      // All trainer permissions
      { action: 'create', resource: 'agents' },
      { action: 'update', resource: 'agents', conditions: { owned: true } },
      { action: 'delete', resource: 'agents', conditions: { owned: true } },
      { action: 'train', resource: 'agents', conditions: { owned: true } },
      { action: 'publish', resource: 'agents', conditions: { owned: true, status: 'active' } },
      { action: 'read', resource: 'academy' },
      { action: 'enroll', resource: 'academy' },
    ],
  },
  {
    role: 'admin',
    permissions: [
      { action: '*', resource: '*' }, // Full access
    ],
  },
];

// =============================================================================
// Governance Decision
// =============================================================================

export interface GovernanceDecision {
  allowed: boolean;
  requiresApproval: boolean;
  escalateTo: 'council' | 'human' | null;
  reason: string;
  trustImpact: number; // Positive or negative trust score change
  auditRequired: boolean;
}

// =============================================================================
// Agent Runtime Context
// =============================================================================

export interface AgentRuntimeContext {
  agentId: string;
  userId: string;

  // Trust
  trust: TrustContext;

  // Persona
  persona: PersonaConfig;

  // Capabilities
  capabilities: Capability[];
  activeTools: ToolDefinition[];

  // MCP
  mcpServers: MCPServerConfig[];

  // Role
  userRole: UserRole;
  agentStatus: AgentStatus;

  // Environment
  environment: Record<string, string>;

  // Session
  sessionId: string;
  conversationId: string;
  messageCount: number;
}

// =============================================================================
// Audit Event
// =============================================================================

export type AuditEventType =
  | 'action_requested'
  | 'action_approved'
  | 'action_denied'
  | 'action_executed'
  | 'escalation_triggered'
  | 'trust_updated'
  | 'mcp_invoked'
  | 'skill_executed'
  | 'error_occurred';

export interface AuditEvent {
  id: string;
  timestamp: Date;
  type: AuditEventType;
  agentId: string;
  userId: string;
  sessionId: string;
  action: string;
  details: Record<string, unknown>;
  riskLevel: RiskLevel;
  decision: GovernanceDecision;
  merkleHash?: string; // For Truth Chain anchoring
}
