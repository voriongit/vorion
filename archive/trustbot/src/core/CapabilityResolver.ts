/**
 * Aurais Infrastructure - Capability Resolver Service
 * 
 * Determines what capabilities an agent has based on their current trust tier.
 * This is the authoritative source for trust-gated permissions.
 */

import {
  TrustTier,
  TrustState,
  CapabilitySet,
  TimeCapabilities,
  MemoryCapabilities,
  SchedulingCapabilities,
  CommunicationCapabilities,
  ToolCapabilities,
  MemoryPersistence,
  QueueAccess,
  MessageProtocol,
  AgentId,
} from '../types/core.js';

// ============================================================================
// TIER CAPABILITY DEFINITIONS
// ============================================================================

const TIER_CAPABILITIES: Record<TrustTier, CapabilitySet> = {
  [TrustTier.UNTRUSTED]: {
    time: {
      canReadClock: false,
      canSetRelativeDeadlines: false,
      canScheduleFutureWork: false,
      canCreateTimersForOthers: false,
      hasTemporalAuthority: false,
      maxScheduleHorizon: 0,
    },
    memory: {
      persistence: MemoryPersistence.EPHEMERAL,
      quotaBytes: 0,
      canReadSharedGraph: false,
      canWriteSharedGraph: false,
      canCreateNamespaces: false,
      namespaceQuota: 0,
    },
    scheduling: {
      canClaimTasks: false,
      queueAccess: [QueueAccess.NONE],
      maxConcurrentTasks: 0,
      canCreateSubtasks: false,
      canDelegateToTiers: [],
      canSpawnAgents: false,
      spawnBudget: 0,
      spawnCooldownTicks: Infinity,
    },
    communication: {
      canInitiateMessages: false,
      messageTargets: [],
      canSubscribeToTopics: false,
      canPublishToTopics: false,
      canCreateChannels: false,
      canBroadcast: false,
      canImpersonate: false,
    },
    tools: {
      enabledTools: [],
      mcpServers: [],
      apiRateLimit: 0,
      costBudget: 0,
    },
  },

  [TrustTier.PROBATIONARY]: {
    time: {
      canReadClock: false,
      canSetRelativeDeadlines: false,
      canScheduleFutureWork: false,
      canCreateTimersForOthers: false,
      hasTemporalAuthority: false,
      maxScheduleHorizon: 0,
    },
    memory: {
      persistence: MemoryPersistence.SESSION,
      quotaBytes: 64 * 1024,          // 64KB
      canReadSharedGraph: false,
      canWriteSharedGraph: false,
      canCreateNamespaces: false,
      namespaceQuota: 0,
    },
    scheduling: {
      canClaimTasks: true,
      queueAccess: [QueueAccess.TRAINING],
      maxConcurrentTasks: 1,
      canCreateSubtasks: false,
      canDelegateToTiers: [],
      canSpawnAgents: false,
      spawnBudget: 0,
      spawnCooldownTicks: Infinity,
    },
    communication: {
      canInitiateMessages: true,
      messageTargets: [
        {
          targetType: 'supervisor',
          protocolRequired: MessageProtocol.STRUCTURED_ONLY,
        },
      ],
      canSubscribeToTopics: false,
      canPublishToTopics: false,
      canCreateChannels: false,
      canBroadcast: false,
      canImpersonate: false,
    },
    tools: {
      enabledTools: [
        { toolId: 'read_file', accessLevel: 'read' },
        { toolId: 'list_directory', accessLevel: 'read' },
      ],
      mcpServers: [],
      apiRateLimit: 10,               // 10 calls/min
      costBudget: 100,
    },
  },

  [TrustTier.TRUSTED]: {
    time: {
      canReadClock: true,
      canSetRelativeDeadlines: true,
      canScheduleFutureWork: false,
      canCreateTimersForOthers: false,
      hasTemporalAuthority: false,
      maxScheduleHorizon: 1000,       // 1000 ticks ahead
    },
    memory: {
      persistence: MemoryPersistence.PERSISTENT,
      quotaBytes: 1024 * 1024,        // 1MB
      canReadSharedGraph: false,
      canWriteSharedGraph: false,
      canCreateNamespaces: false,
      namespaceQuota: 0,
    },
    scheduling: {
      canClaimTasks: true,
      queueAccess: [QueueAccess.TRAINING, QueueAccess.GENERAL],
      maxConcurrentTasks: 3,
      canCreateSubtasks: false,
      canDelegateToTiers: [],
      canSpawnAgents: false,
      spawnBudget: 0,
      spawnCooldownTicks: Infinity,
    },
    communication: {
      canInitiateMessages: true,
      messageTargets: [
        {
          targetType: 'supervisor',
          protocolRequired: MessageProtocol.SEMI_STRUCTURED,
        },
        {
          targetType: 'peer',
          tierRange: { min: TrustTier.TRUSTED, max: TrustTier.TRUSTED },
          protocolRequired: MessageProtocol.STRUCTURED_ONLY,
        },
      ],
      canSubscribeToTopics: true,
      canPublishToTopics: false,
      canCreateChannels: false,
      canBroadcast: false,
      canImpersonate: false,
    },
    tools: {
      enabledTools: [
        { toolId: 'read_file', accessLevel: 'read' },
        { toolId: 'write_file', accessLevel: 'write' },
        { toolId: 'list_directory', accessLevel: 'read' },
        { toolId: 'web_search', accessLevel: 'read' },
        { toolId: 'web_fetch', accessLevel: 'read' },
      ],
      mcpServers: [],
      apiRateLimit: 60,               // 60 calls/min
      costBudget: 500,
    },
  },

  [TrustTier.VERIFIED]: {
    time: {
      canReadClock: true,
      canSetRelativeDeadlines: true,
      canScheduleFutureWork: true,
      canCreateTimersForOthers: false,
      hasTemporalAuthority: false,
      maxScheduleHorizon: 10000,      // 10000 ticks ahead
    },
    memory: {
      persistence: MemoryPersistence.PERSISTENT,
      quotaBytes: 10 * 1024 * 1024,   // 10MB
      canReadSharedGraph: true,
      canWriteSharedGraph: false,
      canCreateNamespaces: false,
      namespaceQuota: 0,
    },
    scheduling: {
      canClaimTasks: true,
      queueAccess: [QueueAccess.TRAINING, QueueAccess.GENERAL, QueueAccess.PRIORITY],
      maxConcurrentTasks: 5,
      canCreateSubtasks: true,
      canDelegateToTiers: [TrustTier.UNTRUSTED, TrustTier.PROBATIONARY, TrustTier.TRUSTED],
      canSpawnAgents: false,
      spawnBudget: 0,
      spawnCooldownTicks: Infinity,
    },
    communication: {
      canInitiateMessages: true,
      messageTargets: [
        {
          targetType: 'any',
          tierRange: { min: TrustTier.UNTRUSTED, max: TrustTier.VERIFIED },
          protocolRequired: MessageProtocol.SEMI_STRUCTURED,
        },
      ],
      canSubscribeToTopics: true,
      canPublishToTopics: true,
      canCreateChannels: false,
      canBroadcast: false,
      canImpersonate: false,
    },
    tools: {
      enabledTools: [
        { toolId: 'read_file', accessLevel: 'read' },
        { toolId: 'write_file', accessLevel: 'write' },
        { toolId: 'list_directory', accessLevel: 'read' },
        { toolId: 'web_search', accessLevel: 'read' },
        { toolId: 'web_fetch', accessLevel: 'read' },
        { toolId: 'execute_code', accessLevel: 'write', constraints: { sandboxed: true } },
        { toolId: 'database_query', accessLevel: 'read' },
      ],
      mcpServers: [
        {
          serverId: 'readonly-mcp',
          serverUrl: 'https://mcp.internal/readonly',
          enabledTools: ['search', 'fetch', 'list'],
        },
      ],
      apiRateLimit: 120,              // 120 calls/min
      costBudget: 2000,
    },
  },

  [TrustTier.CERTIFIED]: {
    time: {
      canReadClock: true,
      canSetRelativeDeadlines: true,
      canScheduleFutureWork: true,
      canCreateTimersForOthers: true,
      hasTemporalAuthority: false,
      maxScheduleHorizon: 100000,     // 100000 ticks ahead
    },
    memory: {
      persistence: MemoryPersistence.PERSISTENT,
      quotaBytes: 100 * 1024 * 1024,  // 100MB
      canReadSharedGraph: true,
      canWriteSharedGraph: true,
      canCreateNamespaces: false,
      namespaceQuota: 0,
    },
    scheduling: {
      canClaimTasks: true,
      queueAccess: [QueueAccess.TRAINING, QueueAccess.GENERAL, QueueAccess.PRIORITY],
      maxConcurrentTasks: 10,
      canCreateSubtasks: true,
      canDelegateToTiers: [
        TrustTier.UNTRUSTED,
        TrustTier.PROBATIONARY,
        TrustTier.TRUSTED,
        TrustTier.VERIFIED,
      ],
      canSpawnAgents: true,
      spawnBudget: 5,                 // Can spawn up to 5 agents
      spawnCooldownTicks: 1000,       // Must wait 1000 ticks between spawns
    },
    communication: {
      canInitiateMessages: true,
      messageTargets: [
        {
          targetType: 'any',
          tierRange: { min: TrustTier.UNTRUSTED, max: TrustTier.CERTIFIED },
          protocolRequired: MessageProtocol.FREE_FORM,
        },
      ],
      canSubscribeToTopics: true,
      canPublishToTopics: true,
      canCreateChannels: true,
      canBroadcast: false,
      canImpersonate: false,
    },
    tools: {
      enabledTools: [
        { toolId: 'read_file', accessLevel: 'admin' },
        { toolId: 'write_file', accessLevel: 'admin' },
        { toolId: 'list_directory', accessLevel: 'admin' },
        { toolId: 'web_search', accessLevel: 'read' },
        { toolId: 'web_fetch', accessLevel: 'read' },
        { toolId: 'execute_code', accessLevel: 'write' },
        { toolId: 'database_query', accessLevel: 'write' },
        { toolId: 'database_mutate', accessLevel: 'write' },
        { toolId: 'spawn_agent', accessLevel: 'write' },
      ],
      mcpServers: [
        {
          serverId: 'readonly-mcp',
          serverUrl: 'https://mcp.internal/readonly',
          enabledTools: ['*'],
        },
        {
          serverId: 'write-mcp',
          serverUrl: 'https://mcp.internal/write',
          enabledTools: ['create', 'update'],
        },
      ],
      apiRateLimit: 300,              // 300 calls/min
      costBudget: 10000,
    },
  },

  [TrustTier.ELITE]: {
    time: {
      canReadClock: true,
      canSetRelativeDeadlines: true,
      canScheduleFutureWork: true,
      canCreateTimersForOthers: true,
      hasTemporalAuthority: true,     // Can pause/resume other agents
      maxScheduleHorizon: Infinity,
    },
    memory: {
      persistence: MemoryPersistence.PERSISTENT,
      quotaBytes: 1024 * 1024 * 1024, // 1GB
      canReadSharedGraph: true,
      canWriteSharedGraph: true,
      canCreateNamespaces: true,
      namespaceQuota: 100,
    },
    scheduling: {
      canClaimTasks: true,
      queueAccess: [
        QueueAccess.TRAINING,
        QueueAccess.GENERAL,
        QueueAccess.PRIORITY,
        QueueAccess.ADMINISTRATIVE,
      ],
      maxConcurrentTasks: Infinity,
      canCreateSubtasks: true,
      canDelegateToTiers: [
        TrustTier.UNTRUSTED,
        TrustTier.PROBATIONARY,
        TrustTier.TRUSTED,
        TrustTier.VERIFIED,
        TrustTier.CERTIFIED,
      ],
      canSpawnAgents: true,
      spawnBudget: 50,
      spawnCooldownTicks: 100,
    },
    communication: {
      canInitiateMessages: true,
      messageTargets: [
        {
          targetType: 'any',
          protocolRequired: MessageProtocol.FREE_FORM,
        },
      ],
      canSubscribeToTopics: true,
      canPublishToTopics: true,
      canCreateChannels: true,
      canBroadcast: true,
      canImpersonate: true,           // For testing, with full audit trail
    },
    tools: {
      enabledTools: [
        { toolId: '*', accessLevel: 'admin' },  // All tools
      ],
      mcpServers: [
        {
          serverId: '*',              // All MCP servers
          serverUrl: '*',
          enabledTools: ['*'],
        },
      ],
      apiRateLimit: Infinity,
      costBudget: Infinity,
    },
  },
};

// ============================================================================
// CAPABILITY RESOLVER SERVICE
// ============================================================================

export interface ICapabilityResolver {
  /**
   * Get the full capability set for an agent based on their trust state.
   */
  getCapabilities(trustState: TrustState): CapabilitySet;

  /**
   * Check if an agent can perform a specific action.
   */
  canPerform(trustState: TrustState, action: CapabilityCheck): CapabilityCheckResult;

  /**
   * Get the tier required for a specific capability.
   */
  getRequiredTier(capability: string): TrustTier | null;

  /**
   * Calculate effective tier considering ceiling and decay.
   */
  getEffectiveTier(trustState: TrustState): TrustTier;
}

export interface CapabilityCheck {
  category: 'time' | 'memory' | 'scheduling' | 'communication' | 'tools';
  action: string;
  params?: Record<string, unknown>;
}

export interface CapabilityCheckResult {
  allowed: boolean;
  reason?: string;
  requiredTier?: TrustTier;
  currentTier?: TrustTier;
  alternativeAction?: string;
}

export class CapabilityResolver implements ICapabilityResolver {

  getCapabilities(trustState: TrustState): CapabilitySet {
    const effectiveTier = this.getEffectiveTier(trustState);
    return { ...TIER_CAPABILITIES[effectiveTier] };
  }

  getEffectiveTier(trustState: TrustState): TrustTier {
    // Calculate base tier from score
    const scoreTier = this.tierFromScore(trustState.score.current);

    // Apply ceiling (cannot exceed parent-imposed limit)
    const ceiledTier = Math.min(scoreTier, trustState.trustCeiling) as TrustTier;

    // Check for active suspensions
    const hasActiveViolation = trustState.violations.some(v => !v.resolved && v.severity === 'CRITICAL');
    if (hasActiveViolation) {
      return TrustTier.UNTRUSTED;
    }

    // Check for council approval requirements (Certified and Elite require it)
    if (ceiledTier >= TrustTier.CERTIFIED) {
      const hasCouncilApproval = trustState.councilApprovals.some(
        a => a.tier === ceiledTier && (!a.expiresAt || a.expiresAt > Date.now())
      );
      if (!hasCouncilApproval) {
        return TrustTier.VERIFIED;  // Cap at Verified without council approval
      }
    }

    return ceiledTier;
  }

  private tierFromScore(score: number): TrustTier {
    if (score >= 950) return TrustTier.ELITE;
    if (score >= 800) return TrustTier.CERTIFIED;
    if (score >= 600) return TrustTier.VERIFIED;
    if (score >= 400) return TrustTier.TRUSTED;
    if (score >= 200) return TrustTier.PROBATIONARY;
    return TrustTier.UNTRUSTED;
  }

  canPerform(trustState: TrustState, check: CapabilityCheck): CapabilityCheckResult {
    const capabilities = this.getCapabilities(trustState);
    const effectiveTier = this.getEffectiveTier(trustState);

    switch (check.category) {
      case 'time':
        return this.checkTimeCapability(capabilities.time, check.action, effectiveTier);
      case 'memory':
        return this.checkMemoryCapability(capabilities.memory, check.action, check.params, effectiveTier);
      case 'scheduling':
        return this.checkSchedulingCapability(capabilities.scheduling, check.action, check.params, effectiveTier);
      case 'communication':
        return this.checkCommunicationCapability(capabilities.communication, check.action, check.params, effectiveTier);
      case 'tools':
        return this.checkToolCapability(capabilities.tools, check.action, check.params, effectiveTier);
      default:
        return { allowed: false, reason: `Unknown capability category: ${check.category}` };
    }
  }

  private checkTimeCapability(
    caps: TimeCapabilities,
    action: string,
    currentTier: TrustTier
  ): CapabilityCheckResult {
    const checks: Record<string, { allowed: boolean; requiredTier: TrustTier }> = {
      'read_clock': { allowed: caps.canReadClock, requiredTier: TrustTier.TRUSTED },
      'set_deadline': { allowed: caps.canSetRelativeDeadlines, requiredTier: TrustTier.TRUSTED },
      'schedule_future': { allowed: caps.canScheduleFutureWork, requiredTier: TrustTier.VERIFIED },
      'create_timer': { allowed: caps.canCreateTimersForOthers, requiredTier: TrustTier.CERTIFIED },
      'temporal_authority': { allowed: caps.hasTemporalAuthority, requiredTier: TrustTier.ELITE },
    };

    const check = checks[action];
    if (!check) {
      return { allowed: false, reason: `Unknown time action: ${action}` };
    }

    return {
      allowed: check.allowed,
      reason: check.allowed ? undefined : `Requires ${TrustTier[check.requiredTier]} tier`,
      requiredTier: check.requiredTier,
      currentTier,
    };
  }

  private checkMemoryCapability(
    caps: MemoryCapabilities,
    action: string,
    params: Record<string, unknown> | undefined,
    currentTier: TrustTier
  ): CapabilityCheckResult {
    switch (action) {
      case 'write':
        const size = (params?.size as number) || 0;
        if (caps.persistence === MemoryPersistence.EPHEMERAL) {
          return { allowed: false, reason: 'No write persistence at this tier', requiredTier: TrustTier.PROBATIONARY, currentTier };
        }
        if (size > caps.quotaBytes) {
          return { allowed: false, reason: `Write size ${size} exceeds quota ${caps.quotaBytes}` };
        }
        return { allowed: true };

      case 'read_graph':
        return {
          allowed: caps.canReadSharedGraph,
          reason: caps.canReadSharedGraph ? undefined : 'Graph read requires VERIFIED tier',
          requiredTier: TrustTier.VERIFIED,
          currentTier,
        };

      case 'write_graph':
        return {
          allowed: caps.canWriteSharedGraph,
          reason: caps.canWriteSharedGraph ? undefined : 'Graph write requires CERTIFIED tier',
          requiredTier: TrustTier.CERTIFIED,
          currentTier,
        };

      case 'create_namespace':
        return {
          allowed: caps.canCreateNamespaces,
          reason: caps.canCreateNamespaces ? undefined : 'Namespace creation requires ELITE tier',
          requiredTier: TrustTier.ELITE,
          currentTier,
        };

      default:
        return { allowed: false, reason: `Unknown memory action: ${action}` };
    }
  }

  private checkSchedulingCapability(
    caps: SchedulingCapabilities,
    action: string,
    params: Record<string, unknown> | undefined,
    currentTier: TrustTier
  ): CapabilityCheckResult {
    switch (action) {
      case 'claim_task':
        if (!caps.canClaimTasks) {
          return { allowed: false, reason: 'Cannot claim tasks at UNTRUSTED tier', requiredTier: TrustTier.PROBATIONARY, currentTier };
        }
        const queue = params?.queue as QueueAccess;
        if (queue && !caps.queueAccess.includes(queue)) {
          return { allowed: false, reason: `No access to ${queue} queue` };
        }
        return { allowed: true };

      case 'create_subtask':
        return {
          allowed: caps.canCreateSubtasks,
          reason: caps.canCreateSubtasks ? undefined : 'Subtask creation requires VERIFIED tier',
          requiredTier: TrustTier.VERIFIED,
          currentTier,
        };

      case 'delegate':
        const targetTier = params?.targetTier as TrustTier;
        if (!caps.canDelegateToTiers.includes(targetTier)) {
          return { allowed: false, reason: `Cannot delegate to ${TrustTier[targetTier]} tier` };
        }
        return { allowed: true };

      case 'spawn_agent':
        if (!caps.canSpawnAgents) {
          return { allowed: false, reason: 'Agent spawning requires CERTIFIED tier', requiredTier: TrustTier.CERTIFIED, currentTier };
        }
        const spawnCount = (params?.currentSpawnCount as number) || 0;
        if (spawnCount >= caps.spawnBudget) {
          return { allowed: false, reason: `Spawn budget exhausted (${caps.spawnBudget} max)` };
        }
        return { allowed: true };

      default:
        return { allowed: false, reason: `Unknown scheduling action: ${action}` };
    }
  }

  private checkCommunicationCapability(
    caps: CommunicationCapabilities,
    action: string,
    params: Record<string, unknown> | undefined,
    currentTier: TrustTier
  ): CapabilityCheckResult {
    switch (action) {
      case 'send_message':
        if (!caps.canInitiateMessages) {
          return { allowed: false, reason: 'Cannot initiate messages at UNTRUSTED tier', requiredTier: TrustTier.PROBATIONARY, currentTier };
        }
        // Check target rules
        const targetTier = params?.targetTier as TrustTier;
        const targetType = params?.targetType as string;
        const matchingRule = caps.messageTargets.find(rule => {
          if (rule.targetType !== 'any' && rule.targetType !== targetType) return false;
          if (rule.tierRange) {
            if (targetTier < rule.tierRange.min || targetTier > rule.tierRange.max) return false;
          }
          return true;
        });
        if (!matchingRule) {
          return { allowed: false, reason: `No permission to message ${targetType} at ${TrustTier[targetTier]} tier` };
        }
        return { allowed: true };

      case 'publish':
        return {
          allowed: caps.canPublishToTopics,
          reason: caps.canPublishToTopics ? undefined : 'Topic publishing requires VERIFIED tier',
          requiredTier: TrustTier.VERIFIED,
          currentTier,
        };

      case 'create_channel':
        return {
          allowed: caps.canCreateChannels,
          reason: caps.canCreateChannels ? undefined : 'Channel creation requires CERTIFIED tier',
          requiredTier: TrustTier.CERTIFIED,
          currentTier,
        };

      case 'broadcast':
        return {
          allowed: caps.canBroadcast,
          reason: caps.canBroadcast ? undefined : 'Broadcast requires ELITE tier',
          requiredTier: TrustTier.ELITE,
          currentTier,
        };

      default:
        return { allowed: false, reason: `Unknown communication action: ${action}` };
    }
  }

  private checkToolCapability(
    caps: ToolCapabilities,
    action: string,
    params: Record<string, unknown> | undefined,
    currentTier: TrustTier
  ): CapabilityCheckResult {
    const toolId = params?.toolId as string;

    // Check for wildcard permission
    const hasWildcard = caps.enabledTools.some(t => t.toolId === '*');
    if (hasWildcard) {
      return { allowed: true };
    }

    // Check specific tool permission
    const toolPermission = caps.enabledTools.find(t => t.toolId === toolId);
    if (!toolPermission) {
      return { allowed: false, reason: `Tool ${toolId} not enabled at current tier` };
    }

    const requestedAccess = (params?.accessLevel as string) || 'read';
    const accessLevels: Record<string, number> = { read: 1, write: 2, admin: 3 };
    if ((accessLevels[requestedAccess] ?? 0) > (accessLevels[toolPermission.accessLevel] ?? 0)) {
      return { allowed: false, reason: `Tool ${toolId} only permits ${toolPermission.accessLevel} access` };
    }

    // Check constraints
    if (toolPermission.constraints) {
      const violatedConstraint = Object.entries(toolPermission.constraints).find(
        ([key, value]) => params?.[key] !== value
      );
      if (violatedConstraint) {
        return { allowed: false, reason: `Tool constraint violated: ${violatedConstraint[0]} must be ${violatedConstraint[1]}` };
      }
    }

    return { allowed: true };
  }

  getRequiredTier(capability: string): TrustTier | null {
    const requirements: Record<string, TrustTier> = {
      // Time
      'time.read_clock': TrustTier.TRUSTED,
      'time.set_deadline': TrustTier.TRUSTED,
      'time.schedule_future': TrustTier.VERIFIED,
      'time.create_timer': TrustTier.CERTIFIED,
      'time.temporal_authority': TrustTier.ELITE,

      // Memory
      'memory.session': TrustTier.PROBATIONARY,
      'memory.persistent': TrustTier.TRUSTED,
      'memory.read_graph': TrustTier.VERIFIED,
      'memory.write_graph': TrustTier.CERTIFIED,
      'memory.create_namespace': TrustTier.ELITE,

      // Scheduling
      'scheduling.claim_task': TrustTier.PROBATIONARY,
      'scheduling.general_queue': TrustTier.TRUSTED,
      'scheduling.priority_queue': TrustTier.VERIFIED,
      'scheduling.create_subtask': TrustTier.VERIFIED,
      'scheduling.delegate': TrustTier.VERIFIED,
      'scheduling.spawn_agent': TrustTier.CERTIFIED,
      'scheduling.admin_queue': TrustTier.ELITE,

      // Communication
      'communication.message_supervisor': TrustTier.PROBATIONARY,
      'communication.message_peer': TrustTier.TRUSTED,
      'communication.subscribe': TrustTier.TRUSTED,
      'communication.publish': TrustTier.VERIFIED,
      'communication.message_any': TrustTier.VERIFIED,
      'communication.create_channel': TrustTier.CERTIFIED,
      'communication.broadcast': TrustTier.ELITE,
      'communication.impersonate': TrustTier.ELITE,
    };

    return requirements[capability] ?? null;
  }
}

// Export singleton instance
export const capabilityResolver = new CapabilityResolver();
