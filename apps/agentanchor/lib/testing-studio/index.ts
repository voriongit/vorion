/**
 * A3I Testing Studio
 * Adversarial testing infrastructure for AI agent security
 *
 * "Agents that attack. Agents that defend. Defenses that learn."
 */

// ============================================================================
// Types
// ============================================================================
export * from './types';

// ============================================================================
// Red Agents
// ============================================================================
export {
  RedAgent,
  ATTACK_TEMPLATES,
  OBFUSCATION_METHODS,
  InjectorAgent,
  ObfuscatorAgent,
  JailbreakerAgent,
  createRedAgent,
  createRedTeam,
  getRedAgentTypes,
} from './red-agents';

export type {
  RedAgentType,
  AttackPayload,
  AttackContext,
  AttackResult,
} from './red-agents';

// ============================================================================
// Blue Agents
// ============================================================================
export {
  BlueAgent,
  SentinelAgent,
  DecoderAgent,
  GuardianAgent,
  createBlueAgent,
  createBlueTeam,
  getBlueAgentTypes,
} from './blue-agents';

export type {
  BlueAgentType,
  DetectionSignal,
  Evidence,
  RuleEvaluation,
} from './blue-agents';

// ============================================================================
// Arena (Orchestration)
// ============================================================================
export {
  Arena,
  SessionManager,
  Sandbox,
  IntelligenceCollector,
} from './arena';

export type {
  ArenaConfig,
  SessionEvents,
  TurnResult,
} from './arena';

// ============================================================================
// Database
// ============================================================================
export * from './db';

// ============================================================================
// Version
// ============================================================================
export const TESTING_STUDIO_VERSION = '0.4.0';
