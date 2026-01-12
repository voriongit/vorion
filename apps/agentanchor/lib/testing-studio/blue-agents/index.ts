/**
 * A3I Testing Studio - Blue Agents Index
 * Export all blue agent specializations
 */

// Base class
export { BlueAgent } from './base';

// Types from base
export type { DetectionSignal, Evidence, RuleEvaluation } from './base';

// Specializations
export { SentinelAgent } from './sentinel';
export { DecoderAgent } from './decoder';
export { GuardianAgent } from './guardian';

// Re-export types
export type { BlueAgentConfig, DetectionRule, DetectionResult } from '../types';

// ============================================================================
// Blue Agent Factory
// ============================================================================

import type { BlueAgentConfig } from '../types';
import { BlueAgent } from './base';
import { SentinelAgent } from './sentinel';
import { DecoderAgent } from './decoder';
import { GuardianAgent } from './guardian';

export type BlueAgentType = 'sentinel' | 'decoder' | 'guardian';

/**
 * Factory function to create blue agents
 */
export function createBlueAgent(
  type: BlueAgentType,
  config: Partial<BlueAgentConfig> & { agentId: string }
): BlueAgent {
  switch (type) {
    case 'sentinel':
      return new SentinelAgent(config);
    case 'decoder':
      return new DecoderAgent(config);
    case 'guardian':
      return new GuardianAgent(config);
    default:
      throw new Error(`Unknown blue agent type: ${type}`);
  }
}

/**
 * Get all available blue agent types
 */
export function getBlueAgentTypes(): {
  type: BlueAgentType;
  specialization: string[];
  description: string;
}[] {
  return [
    {
      type: 'sentinel',
      specialization: ['prompt_injection'],
      description: 'Specializes in prompt injection detection (overrides, delimiters, context manipulation)',
    },
    {
      type: 'decoder',
      specialization: ['obfuscation'],
      description: 'Specializes in obfuscation detection (unicode, homoglyphs, encoding)',
    },
    {
      type: 'guardian',
      specialization: ['jailbreak'],
      description: 'Specializes in jailbreak detection (roleplay, authority, emotional manipulation)',
    },
  ];
}

/**
 * Create a complete blue team with all specializations
 */
export function createBlueTeam(
  config: Partial<BlueAgentConfig> & { agentId: string }
): BlueAgent[] {
  return [
    new SentinelAgent({ ...config, agentId: `${config.agentId}-sentinel` }),
    new DecoderAgent({ ...config, agentId: `${config.agentId}-decoder` }),
    new GuardianAgent({ ...config, agentId: `${config.agentId}-guardian` }),
  ];
}
