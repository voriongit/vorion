/**
 * A3I Testing Studio - Red Agents Index
 * Export all red agent specializations
 */

// Base class and constants
export { RedAgent, ATTACK_TEMPLATES, OBFUSCATION_METHODS } from './base';

// Types from base
export type { AttackPayload, AttackContext, AttackResult } from './base';

// Specializations
export { InjectorAgent } from './injector';
export { ObfuscatorAgent } from './obfuscator';
export { JailbreakerAgent } from './jailbreaker';

// Re-export types
export type { RedAgentConfig } from '../types';

// ============================================================================
// Red Agent Factory
// ============================================================================

import type { AttackCategory, RedAgentConfig } from '../types';
import { RedAgent } from './base';
import { InjectorAgent } from './injector';
import { ObfuscatorAgent } from './obfuscator';
import { JailbreakerAgent } from './jailbreaker';

export type RedAgentType = 'injector' | 'obfuscator' | 'jailbreaker';

/**
 * Factory function to create red agents
 */
export function createRedAgent(
  type: RedAgentType,
  config: Partial<RedAgentConfig> & { agentId: string }
): RedAgent {
  switch (type) {
    case 'injector':
      return new InjectorAgent(config);
    case 'obfuscator':
      return new ObfuscatorAgent(config);
    case 'jailbreaker':
      return new JailbreakerAgent(config);
    default:
      throw new Error(`Unknown red agent type: ${type}`);
  }
}

/**
 * Get all available red agent types
 */
export function getRedAgentTypes(): {
  type: RedAgentType;
  category: AttackCategory;
  description: string;
}[] {
  return [
    {
      type: 'injector',
      category: 'prompt_injection',
      description: 'Specializes in prompt injection attacks (direct, indirect, multi-stage)',
    },
    {
      type: 'obfuscator',
      category: 'obfuscation',
      description: 'Specializes in bypassing detection through encoding, unicode, and semantic obfuscation',
    },
    {
      type: 'jailbreaker',
      category: 'jailbreak',
      description: 'Specializes in restriction bypass through roleplay, hypotheticals, and social engineering',
    },
  ];
}

/**
 * Create a team of red agents with different specializations
 */
export function createRedTeam(
  config: Partial<RedAgentConfig> & { agentId: string }
): RedAgent[] {
  return [
    new InjectorAgent({ ...config, agentId: `${config.agentId}-injector` }),
    new ObfuscatorAgent({ ...config, agentId: `${config.agentId}-obfuscator` }),
    new JailbreakerAgent({ ...config, agentId: `${config.agentId}-jailbreaker` }),
  ];
}
