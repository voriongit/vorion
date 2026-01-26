/**
 * LangChain Trust Tools
 *
 * Tools that allow agents to query trust information.
 *
 * @packageDocumentation
 */

import type { TrustEngine } from '../trust-engine/index.js';
import { TRUST_LEVEL_NAMES, TRUST_THRESHOLDS } from '../trust-engine/index.js';
import type { TrustLevel } from '../common/types.js';

/**
 * Tool definition compatible with LangChain's DynamicTool
 */
export interface TrustToolDefinition {
  name: string;
  description: string;
  func: (input: string) => Promise<string>;
}

/**
 * Create trust query tools for LangChain agents
 */
export function createTrustTools(
  trustEngine: TrustEngine,
  agentId: string
): TrustToolDefinition[] {
  return [
    {
      name: 'check_my_trust',
      description:
        'Check your current trust score and level. Returns your trust score (0-1000), ' +
        'trust level (L0-L5), and level name. Use this to understand your current permissions.',
      func: async (_input: string) => {
        const record = await trustEngine.getScore(agentId);
        if (!record) {
          return JSON.stringify({
            error: 'Trust record not found',
            agentId,
          });
        }

        return JSON.stringify({
          agentId,
          score: record.score,
          level: record.level,
          levelName: TRUST_LEVEL_NAMES[record.level],
          components: record.components,
          recentFailures: record.recentFailures.length,
          acceleratedDecay: trustEngine.isAcceleratedDecayActive(agentId),
        });
      },
    },
    {
      name: 'check_trust_requirements',
      description:
        'Check what trust level is required for a specific action. ' +
        'Input should be the action name (e.g., "send_email", "access_database"). ' +
        'Returns the required trust level and whether you currently meet it.',
      func: async (input: string) => {
        const record = await trustEngine.getScore(agentId);
        const currentLevel = record?.level ?? 0;

        // Default action requirements (can be customized)
        const actionRequirements: Record<string, TrustLevel> = {
          read_files: 1,
          write_files: 2,
          send_email: 3,
          access_database: 3,
          execute_code: 4,
          modify_system: 5,
          access_secrets: 5,
        };

        const action = input.toLowerCase().trim();
        const requiredLevel = actionRequirements[action] ?? 2;
        const allowed = currentLevel >= requiredLevel;

        return JSON.stringify({
          action,
          requiredLevel,
          requiredLevelName: TRUST_LEVEL_NAMES[requiredLevel],
          currentLevel,
          currentLevelName: TRUST_LEVEL_NAMES[currentLevel],
          allowed,
          message: allowed
            ? `You have sufficient trust to perform "${action}"`
            : `You need ${TRUST_LEVEL_NAMES[requiredLevel]} trust to perform "${action}", but you are ${TRUST_LEVEL_NAMES[currentLevel]}`,
        });
      },
    },
    {
      name: 'get_trust_levels',
      description:
        'Get information about all trust levels and their score ranges. ' +
        'Useful for understanding the trust tier system.',
      func: async (_input: string) => {
        const levels = Object.entries(TRUST_LEVEL_NAMES).map(([level, name]) => ({
          level: parseInt(level),
          name,
          scoreRange: TRUST_THRESHOLDS[parseInt(level) as TrustLevel],
        }));

        return JSON.stringify({
          levels,
          description:
            'Trust levels range from L0 (Sandbox) to L5 (Autonomous). ' +
            'L0=Sandbox, L1=Provisional, L2=Standard, L3=Trusted, L4=Certified, L5=Autonomous. ' +
            'Higher levels grant access to more sensitive actions.',
        });
      },
    },
    {
      name: 'report_task_success',
      description:
        'Report that you successfully completed a task. ' +
        'This will record a positive behavioral signal to improve your trust score. ' +
        'Input should be a brief description of what you accomplished.',
      func: async (input: string) => {
        await trustEngine.recordSignal({
          id: crypto.randomUUID(),
          entityId: agentId,
          type: 'behavioral.task_completed',
          value: 0.85,
          source: 'self-report',
          timestamp: new Date().toISOString(),
          metadata: { description: input },
        });

        const record = await trustEngine.getScore(agentId);

        return JSON.stringify({
          recorded: true,
          newScore: record?.score,
          newLevel: record?.level,
          message: 'Task success recorded. Your trust score may have improved.',
        });
      },
    },
    {
      name: 'report_task_failure',
      description:
        'Report that you failed to complete a task or encountered an error. ' +
        'Honest self-reporting of failures can help maintain trust long-term. ' +
        'Input should be a brief description of what went wrong.',
      func: async (input: string) => {
        await trustEngine.recordSignal({
          id: crypto.randomUUID(),
          entityId: agentId,
          type: 'behavioral.task_failed',
          value: 0.2,
          source: 'self-report',
          timestamp: new Date().toISOString(),
          metadata: { description: input },
        });

        const record = await trustEngine.getScore(agentId);

        return JSON.stringify({
          recorded: true,
          newScore: record?.score,
          newLevel: record?.level,
          acceleratedDecay: trustEngine.isAcceleratedDecayActive(agentId),
          message:
            'Task failure recorded. Your trust score may have decreased. ' +
            'Honest reporting is valued in the trust system.',
        });
      },
    },
  ];
}

/**
 * Create a single tool to query trust for any entity
 */
export function createTrustQueryTool(
  trustEngine: TrustEngine
): TrustToolDefinition {
  return {
    name: 'query_entity_trust',
    description:
      'Query the trust score and level for any entity in the system. ' +
      'Input should be the entity ID to query.',
    func: async (input: string) => {
      const entityId = input.trim();
      const record = await trustEngine.getScore(entityId);

      if (!record) {
        return JSON.stringify({
          error: 'Entity not found',
          entityId,
        });
      }

      return JSON.stringify({
        entityId,
        score: record.score,
        level: record.level,
        levelName: TRUST_LEVEL_NAMES[record.level],
        lastCalculatedAt: record.lastCalculatedAt,
      });
    },
  };
}
