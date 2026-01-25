/**
 * Capabilities / Skills System - Tool activation and skill execution
 */

import {
  Capability,
  CapabilityId,
  ToolDefinition,
  SkillExecution,
  TrustContext,
  RiskLevel,
  TrustTier,
} from './types';
import { getTrustTier } from './trust';

// =============================================================================
// Capability Registry
// =============================================================================

export const CAPABILITY_REGISTRY: Record<CapabilityId, Capability> = {
  text_generation: {
    id: 'text_generation',
    name: 'Text Generation',
    description: 'Generate natural language text for various purposes',
    riskLevel: 'low',
    requiredTrustTier: 'untrusted',
    requiredTrustBand: 'T0_UNTRUSTED',
  },
  code_assistance: {
    id: 'code_assistance',
    name: 'Code Assistance',
    description: 'Help with programming tasks, code review, and debugging',
    riskLevel: 'medium',
    requiredTrustTier: 'provisional',
    requiredTrustBand: 'T1_SUPERVISED',
    toolDefinition: {
      name: 'code_assist',
      description: 'Analyze, write, or debug code',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['analyze', 'write', 'debug', 'review'] },
          language: { type: 'string' },
          code: { type: 'string' },
          context: { type: 'string' },
        },
        required: ['action'],
      },
    },
  },
  data_analysis: {
    id: 'data_analysis',
    name: 'Data Analysis',
    description: 'Analyze datasets, generate insights, and create visualizations',
    riskLevel: 'medium',
    requiredTrustTier: 'established',
    requiredTrustBand: 'T3_TRUSTED',
    toolDefinition: {
      name: 'analyze_data',
      description: 'Analyze data and generate insights',
      inputSchema: {
        type: 'object',
        properties: {
          data: { type: 'string', description: 'Data to analyze (JSON or CSV)' },
          analysisType: { type: 'string', enum: ['summary', 'trends', 'correlation', 'anomalies'] },
          format: { type: 'string', enum: ['text', 'json', 'chart'] },
        },
        required: ['data', 'analysisType'],
      },
    },
  },
  customer_support: {
    id: 'customer_support',
    name: 'Customer Support',
    description: 'Handle customer inquiries, issues, and service requests',
    riskLevel: 'medium',
    requiredTrustTier: 'established',
    requiredTrustBand: 'T3_TRUSTED',
  },
  content_writing: {
    id: 'content_writing',
    name: 'Content Writing',
    description: 'Create articles, blog posts, marketing copy, and other content',
    riskLevel: 'low',
    requiredTrustTier: 'provisional',
    requiredTrustBand: 'T1_SUPERVISED',
  },
  translation: {
    id: 'translation',
    name: 'Translation',
    description: 'Translate text between languages while preserving meaning',
    riskLevel: 'low',
    requiredTrustTier: 'untrusted',
    requiredTrustBand: 'T0_UNTRUSTED',
    toolDefinition: {
      name: 'translate',
      description: 'Translate text between languages',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          sourceLang: { type: 'string' },
          targetLang: { type: 'string' },
          preserveTone: { type: 'boolean' },
        },
        required: ['text', 'targetLang'],
      },
    },
  },
  summarization: {
    id: 'summarization',
    name: 'Summarization',
    description: 'Condense long content into concise summaries',
    riskLevel: 'low',
    requiredTrustTier: 'untrusted',
    requiredTrustBand: 'T0_UNTRUSTED',
  },
  question_answering: {
    id: 'question_answering',
    name: 'Question Answering',
    description: 'Answer questions based on provided context or knowledge',
    riskLevel: 'low',
    requiredTrustTier: 'untrusted',
    requiredTrustBand: 'T0_UNTRUSTED',
  },
  creative_writing: {
    id: 'creative_writing',
    name: 'Creative Writing',
    description: 'Create stories, poems, scripts, and other creative content',
    riskLevel: 'low',
    requiredTrustTier: 'provisional',
    requiredTrustBand: 'T1_SUPERVISED',
  },
  technical_documentation: {
    id: 'technical_documentation',
    name: 'Technical Documentation',
    description: 'Create and maintain technical documentation, API docs, and guides',
    riskLevel: 'low',
    requiredTrustTier: 'established',
    requiredTrustBand: 'T3_TRUSTED',
  },
  web_search: {
    id: 'web_search',
    name: 'Web Search',
    description: 'Search the web for information and resources',
    riskLevel: 'medium',
    requiredTrustTier: 'established',
    requiredTrustBand: 'T3_TRUSTED',
    toolDefinition: {
      name: 'web_search',
      description: 'Search the web for information',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          maxResults: { type: 'number', default: 5 },
          domain: { type: 'string', description: 'Restrict to specific domain' },
        },
        required: ['query'],
      },
    },
  },
  file_operations: {
    id: 'file_operations',
    name: 'File Operations',
    description: 'Read, write, and manage files within allowed directories',
    riskLevel: 'high',
    requiredTrustTier: 'trusted',
    requiredTrustBand: 'T3_TRUSTED',
    toolDefinition: {
      name: 'file_ops',
      description: 'Perform file operations',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['read', 'write', 'list', 'delete'] },
          path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['action', 'path'],
      },
    },
  },
  api_integration: {
    id: 'api_integration',
    name: 'API Integration',
    description: 'Make API calls to external services',
    riskLevel: 'high',
    requiredTrustTier: 'verified',
    requiredTrustBand: 'T4_AUTONOMOUS',
    toolDefinition: {
      name: 'api_call',
      description: 'Make HTTP requests to APIs',
      inputSchema: {
        type: 'object',
        properties: {
          method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'] },
          url: { type: 'string' },
          headers: { type: 'object' },
          body: { type: 'string' },
        },
        required: ['method', 'url'],
      },
    },
  },
};

// =============================================================================
// Capability Checks
// =============================================================================

const TIER_ORDER: TrustTier[] = ['untrusted', 'provisional', 'established', 'trusted', 'verified', 'certified'];

function tierMeetsRequirement(current: TrustTier, required: TrustTier): boolean {
  return TIER_ORDER.indexOf(current) >= TIER_ORDER.indexOf(required);
}

export function canUseCapability(capabilityId: CapabilityId, trust: TrustContext): {
  allowed: boolean;
  reason: string;
} {
  const capability = CAPABILITY_REGISTRY[capabilityId];

  if (!capability) {
    return { allowed: false, reason: `Unknown capability: ${capabilityId}` };
  }

  if (!tierMeetsRequirement(trust.tier, capability.requiredTrustTier || 'untrusted')) {
    return {
      allowed: false,
      reason: `Requires ${capability.requiredTrustTier} trust tier (current: ${trust.tier})`,
    };
  }

  return { allowed: true, reason: 'Capability available' };
}

export function getAvailableCapabilities(
  requestedIds: CapabilityId[],
  trust: TrustContext
): {
  available: Capability[];
  unavailable: Array<{ id: CapabilityId; reason: string }>;
} {
  const available: Capability[] = [];
  const unavailable: Array<{ id: CapabilityId; reason: string }> = [];

  for (const id of requestedIds) {
    const check = canUseCapability(id, trust);
    if (check.allowed) {
      available.push(CAPABILITY_REGISTRY[id]);
    } else {
      unavailable.push({ id, reason: check.reason });
    }
  }

  return { available, unavailable };
}

// =============================================================================
// Tool Definitions for Anthropic API
// =============================================================================

export function getToolDefinitions(capabilities: Capability[]): ToolDefinition[] {
  return capabilities
    .filter(c => c.toolDefinition)
    .map(c => c.toolDefinition!);
}

export function formatToolsForAnthropic(tools: ToolDefinition[]): Array<{
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}> {
  return tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  }));
}

// =============================================================================
// Skill Execution Tracking
// =============================================================================

export function createSkillExecution(
  capabilityId: CapabilityId,
  input: Record<string, unknown>
): SkillExecution {
  return {
    capabilityId,
    input,
    success: false,
    executionTime: 0,
  };
}

export function completeSkillExecution(
  execution: SkillExecution,
  output: unknown,
  success: boolean,
  error?: string
): SkillExecution {
  return {
    ...execution,
    output,
    success,
    error,
    executionTime: Date.now() - execution.executionTime,
  };
}

// =============================================================================
// Capability Groups
// =============================================================================

export const CAPABILITY_GROUPS = {
  content: ['text_generation', 'content_writing', 'creative_writing', 'summarization'] as CapabilityId[],
  technical: ['code_assistance', 'technical_documentation', 'data_analysis'] as CapabilityId[],
  communication: ['translation', 'question_answering', 'customer_support'] as CapabilityId[],
  integration: ['web_search', 'file_operations', 'api_integration'] as CapabilityId[],
};

export function getCapabilitiesByGroup(group: keyof typeof CAPABILITY_GROUPS): Capability[] {
  return CAPABILITY_GROUPS[group].map(id => CAPABILITY_REGISTRY[id]);
}

// =============================================================================
// Capability Prompt Augmentation
// =============================================================================

export function buildCapabilityPromptSection(capabilities: Capability[]): string {
  if (capabilities.length === 0) return '';

  const sections: string[] = ['## Available Capabilities\n'];

  for (const cap of capabilities) {
    sections.push(`### ${cap.name}`);
    sections.push(cap.description);

    if (cap.toolDefinition) {
      sections.push(`\nTool: \`${cap.toolDefinition.name}\``);
      sections.push(`Use this tool to ${cap.toolDefinition.description.toLowerCase()}.`);
    }

    sections.push(`Risk Level: ${cap.riskLevel}`);
    sections.push('');
  }

  return sections.join('\n');
}
