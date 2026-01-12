/**
 * Agent Wrapper - Main integration point for governance SDK
 *
 * This wraps AI agent execution with:
 * - Trust-based autonomy checks
 * - Dynamic persona/system prompt injection
 * - Capability activation as tools
 * - MCP server integration
 * - Role-based permission enforcement
 * - Audit trail generation
 */

import {
  AgentRuntimeContext,
  TrustContext,
  PersonaConfig,
  Capability,
  CapabilityId,
  MCPServerConfig,
  GovernanceDecision,
  AuditEvent,
  AuditEventType,
  UserRole,
  AgentStatus,
  RiskLevel,
  ToolDefinition,
} from './types';

import { buildTrustContext, assessRisk, evaluateAction } from './trust';
import { buildSystemPrompt, buildPersonaConfig, injectContextToPrompt, DEFAULT_PERSONAS } from './persona';
import { getAvailableCapabilities, getToolDefinitions, formatToolsForAnthropic, CAPABILITY_REGISTRY } from './capabilities';
import { canUseMCPServer, buildMCPContextPrompt } from './mcp';
import { checkPermission, PermissionContext } from './roles';

// =============================================================================
// Agent Runtime Builder
// =============================================================================

export interface AgentConfig {
  agentId: string;
  userId: string;
  userRole: UserRole;
  agentStatus: AgentStatus;

  // Trust
  trustScore: number;
  lastActivity: Date;

  // Persona
  name: string;
  description: string;
  specialization: string;
  personalityTraits: string[];
  systemPrompt?: string;

  // Capabilities
  capabilities: string[];

  // MCP
  mcpServers: MCPServerConfig[];

  // Environment
  environment?: Record<string, string>;

  // Session
  sessionId: string;
  conversationId: string;
  messageCount: number;
}

export function buildAgentContext(config: AgentConfig): AgentRuntimeContext {
  // Build trust context
  const trust = buildTrustContext(config.trustScore, config.lastActivity);

  // Build persona
  const persona = buildPersonaConfig(
    config.name,
    config.description,
    config.specialization as any,
    config.personalityTraits as any[],
    config.systemPrompt,
  );

  // Get available capabilities based on trust
  const requestedCapabilities = config.capabilities as CapabilityId[];
  const { available: capabilities } = getAvailableCapabilities(requestedCapabilities, trust);

  // Get tool definitions
  const activeTools = getToolDefinitions(capabilities);

  return {
    agentId: config.agentId,
    userId: config.userId,
    trust,
    persona,
    capabilities,
    activeTools,
    mcpServers: config.mcpServers,
    userRole: config.userRole,
    agentStatus: config.agentStatus,
    environment: config.environment || {},
    sessionId: config.sessionId,
    conversationId: config.conversationId,
    messageCount: config.messageCount,
  };
}

// =============================================================================
// System Prompt Generation
// =============================================================================

export function generateSystemPrompt(context: AgentRuntimeContext): string {
  // Build base persona prompt
  let systemPrompt = buildSystemPrompt(context.persona, context.trust);

  // Inject capability context
  systemPrompt = injectContextToPrompt(systemPrompt, context);

  // Add MCP context
  const mcpPrompt = buildMCPContextPrompt(context.mcpServers, context.trust);
  if (mcpPrompt) {
    systemPrompt += '\n' + mcpPrompt;
  }

  return systemPrompt;
}

// =============================================================================
// Tool Preparation for Anthropic API
// =============================================================================

export interface AnthropicToolConfig {
  tools: Array<{
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
  }>;
  systemPrompt: string;
}

export function prepareAnthropicConfig(context: AgentRuntimeContext): AnthropicToolConfig {
  const systemPrompt = generateSystemPrompt(context);
  const tools = formatToolsForAnthropic(context.activeTools);

  return {
    tools,
    systemPrompt,
  };
}

// =============================================================================
// Action Governance
// =============================================================================

export interface ActionRequest {
  action: string;
  resource?: string;
  params?: Record<string, unknown>;
  riskContext?: Record<string, unknown>;
}

export interface GovernedActionResult {
  decision: GovernanceDecision;
  auditEvent: AuditEvent;
  proceed: boolean;
}

export function governAction(
  context: AgentRuntimeContext,
  request: ActionRequest
): GovernedActionResult {
  // Assess risk
  const risk = assessRisk(request.action, request.riskContext);

  // Evaluate against trust
  const decision = evaluateAction(context.trust, risk, request.action);

  // Check role permissions if resource specified
  if (request.resource) {
    const permContext: PermissionContext = {
      userId: context.userId,
      userRole: context.userRole,
      agentStatus: context.agentStatus,
    };

    const permResult = checkPermission(request.action, request.resource, permContext);
    if (!permResult.allowed) {
      decision.allowed = false;
      decision.reason = permResult.reason;
    }
  }

  // Create audit event
  const auditEvent = createAuditEvent(
    context,
    'action_requested',
    request.action,
    { request, risk },
    risk.level,
    decision
  );

  return {
    decision,
    auditEvent,
    proceed: decision.allowed && !decision.requiresApproval,
  };
}

// =============================================================================
// Audit Trail
// =============================================================================

function createAuditEvent(
  context: AgentRuntimeContext,
  type: AuditEventType,
  action: string,
  details: Record<string, unknown>,
  riskLevel: RiskLevel,
  decision: GovernanceDecision
): AuditEvent {
  return {
    id: generateAuditId(),
    timestamp: new Date(),
    type,
    agentId: context.agentId,
    userId: context.userId,
    sessionId: context.sessionId,
    action,
    details,
    riskLevel,
    decision,
  };
}

function generateAuditId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// =============================================================================
// Quick Setup Helpers
// =============================================================================

/**
 * Create a minimal agent context for quick testing
 */
export function createQuickAgent(
  name: string,
  type: 'assistant' | 'developer' | 'support' | 'writer' | 'analyst' | 'tutor' = 'assistant',
  trustScore: number = 400
): AgentRuntimeContext {
  const persona = DEFAULT_PERSONAS[type];
  const trust = buildTrustContext(trustScore, new Date());

  // Get default capabilities for the type
  const defaultCapabilities: Record<string, CapabilityId[]> = {
    assistant: ['text_generation', 'question_answering', 'summarization'],
    developer: ['code_assistance', 'technical_documentation', 'data_analysis'],
    support: ['customer_support', 'text_generation', 'question_answering'],
    writer: ['content_writing', 'creative_writing', 'summarization'],
    analyst: ['data_analysis', 'summarization', 'question_answering'],
    tutor: ['text_generation', 'question_answering', 'summarization'],
  };

  const { available: capabilities } = getAvailableCapabilities(
    defaultCapabilities[type],
    trust
  );

  return {
    agentId: `agent_${Date.now()}`,
    userId: 'system',
    trust,
    persona,
    capabilities,
    activeTools: getToolDefinitions(capabilities),
    mcpServers: [],
    userRole: 'both',
    agentStatus: 'active',
    environment: {},
    sessionId: `session_${Date.now()}`,
    conversationId: `conv_${Date.now()}`,
    messageCount: 0,
  };
}

/**
 * Wrap an existing bot record from database into runtime context
 */
export function wrapDatabaseBot(bot: {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  system_prompt?: string;
  model?: string;
  temperature?: number;
  capabilities?: string[];
  personality_traits?: string[];
  specialization?: string;
  trust_score?: number;
  status?: string;
  updated_at?: string;
}, userRole: UserRole = 'both', sessionId?: string): AgentRuntimeContext {
  return buildAgentContext({
    agentId: bot.id,
    userId: bot.user_id,
    userRole,
    agentStatus: (bot.status || 'draft') as AgentStatus,
    trustScore: bot.trust_score || 0,
    lastActivity: bot.updated_at ? new Date(bot.updated_at) : new Date(),
    name: bot.name,
    description: bot.description || '',
    specialization: bot.specialization || 'core',
    personalityTraits: bot.personality_traits || ['professional', 'friendly'],
    systemPrompt: bot.system_prompt,
    capabilities: bot.capabilities || ['text_generation', 'question_answering'],
    mcpServers: [],
    environment: {
      MODEL: bot.model || 'claude-sonnet-4-20250514',
      TEMPERATURE: String(bot.temperature || 0.7),
    },
    sessionId: sessionId || `session_${Date.now()}`,
    conversationId: `conv_${bot.id}_${Date.now()}`,
    messageCount: 0,
  });
}

// =============================================================================
// Exports for Chat Route Integration
// =============================================================================

export {
  buildTrustContext,
  assessRisk,
  evaluateAction,
  buildSystemPrompt,
  getAvailableCapabilities,
  formatToolsForAnthropic,
  checkPermission,
};
