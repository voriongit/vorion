/**
 * ROLLBACK PLANNER
 *
 * Generates rollback/compensation steps for execution plans.
 * Supports partial rollback and compensation patterns.
 */

import { randomUUID } from 'node:crypto';
import { createLogger } from '../../common/logger.js';
import type { ExecutionStep, OnFailureStrategy } from './index.js';

const logger = createLogger({ component: 'rollback-planner' });

/**
 * Rollback strategy for a specific action type
 */
export interface RollbackStrategy {
  /** The action type this strategy handles */
  actionType: string;
  /** Generate rollback action type */
  rollbackAction: string | ((step: ExecutionStep) => string);
  /** Transform parameters for rollback */
  transformParams?: (params: Record<string, unknown>, step: ExecutionStep) => Record<string, unknown>;
  /** Whether this action is reversible */
  reversible: boolean;
  /** Description of the rollback operation */
  description?: string | ((step: ExecutionStep) => string);
}

/**
 * Built-in compensation patterns for common operations
 */
export const COMPENSATION_PATTERNS: Record<string, RollbackStrategy> = {
  // Data operations
  'create': {
    actionType: 'create',
    rollbackAction: 'delete',
    transformParams: (params) => ({
      id: params.id ?? params.resourceId,
      resourceType: params.resourceType,
    }),
    reversible: true,
    description: 'Delete created resource',
  },
  'delete': {
    actionType: 'delete',
    rollbackAction: 'restore',
    transformParams: (params) => ({
      id: params.id ?? params.resourceId,
      snapshot: params.snapshot,
    }),
    reversible: true,
    description: 'Restore deleted resource',
  },
  'update': {
    actionType: 'update',
    rollbackAction: 'update',
    transformParams: (params) => ({
      id: params.id ?? params.resourceId,
      data: params.previousState ?? params.originalData,
    }),
    reversible: true,
    description: 'Restore previous state',
  },

  // API operations
  'api-call': {
    actionType: 'api-call',
    rollbackAction: 'api-call',
    transformParams: (params) => ({
      ...params,
      method: params.compensationMethod ?? 'DELETE',
      endpoint: params.compensationEndpoint ?? params.endpoint,
    }),
    reversible: true,
    description: 'Call compensation API',
  },

  // Permission operations
  'grant-permission': {
    actionType: 'grant-permission',
    rollbackAction: 'revoke-permission',
    transformParams: (params) => ({
      userId: params.userId,
      permission: params.permission,
      resourceId: params.resourceId,
    }),
    reversible: true,
    description: 'Revoke granted permission',
  },
  'revoke-permission': {
    actionType: 'revoke-permission',
    rollbackAction: 'grant-permission',
    reversible: true,
    description: 'Re-grant revoked permission',
  },

  // Queue/message operations
  'enqueue': {
    actionType: 'enqueue',
    rollbackAction: 'dequeue',
    transformParams: (params) => ({
      messageId: params.messageId,
      queue: params.queue,
    }),
    reversible: true,
    description: 'Remove message from queue',
  },
  'publish': {
    actionType: 'publish',
    rollbackAction: 'publish-compensation',
    transformParams: (params) => ({
      topic: params.topic,
      compensationEvent: true,
      originalEventId: params.eventId,
    }),
    reversible: true,
    description: 'Publish compensation event',
  },

  // Audit/logging operations (not reversible but tracked)
  'audit-log': {
    actionType: 'audit-log',
    rollbackAction: 'audit-log',
    transformParams: (params) => ({
      ...params,
      type: 'rollback',
      originalEventId: params.eventId,
    }),
    reversible: false,
    description: 'Log rollback event',
  },

  // State machine operations
  'transition-state': {
    actionType: 'transition-state',
    rollbackAction: 'transition-state',
    transformParams: (params) => ({
      entityId: params.entityId,
      targetState: params.previousState ?? params.fromState,
    }),
    reversible: true,
    description: 'Revert state transition',
  },

  // Notification operations (not truly reversible)
  'send-notification': {
    actionType: 'send-notification',
    rollbackAction: 'send-cancellation-notification',
    transformParams: (params) => ({
      recipient: params.recipient,
      originalNotificationId: params.notificationId,
      message: `Cancellation: ${params.subject ?? 'Previous notification'}`,
    }),
    reversible: false,
    description: 'Send cancellation notification',
  },

  // Default execute action
  'execute': {
    actionType: 'execute',
    rollbackAction: 'undo',
    transformParams: (params) => ({
      originalParams: params,
    }),
    reversible: true,
    description: 'Undo execution',
  },
};

/**
 * Rollback scope options
 */
export type RollbackScope = 'full' | 'partial' | 'none';

/**
 * Partial rollback options
 */
export interface PartialRollbackOptions {
  /** Steps to include in rollback (by ID) */
  includeSteps?: string[];
  /** Steps to exclude from rollback (by ID) */
  excludeSteps?: string[];
  /** Only rollback critical steps */
  criticalOnly?: boolean;
  /** Custom filter function */
  filter?: (step: ExecutionStep) => boolean;
}

/**
 * RollbackPlanner - Generates compensation/rollback steps
 */
export class RollbackPlanner {
  private customStrategies: Map<string, RollbackStrategy>;

  constructor() {
    this.customStrategies = new Map();
  }

  /**
   * Register a custom rollback strategy for an action type
   */
  registerStrategy(strategy: RollbackStrategy): void {
    this.customStrategies.set(strategy.actionType, strategy);
    logger.debug(
      { actionType: strategy.actionType },
      'Registered custom rollback strategy'
    );
  }

  /**
   * Generate rollback steps for a list of execution steps
   * Returns steps in reverse order (last executed first to rollback)
   */
  generateRollbackSteps(steps: ExecutionStep[]): ExecutionStep[] {
    const rollbackSteps: ExecutionStep[] = [];

    // Process in reverse order
    for (let i = steps.length - 1; i >= 0; i--) {
      const step = steps[i];
      if (!step) continue;

      const rollbackStep = this.createRollbackStep(step);
      if (rollbackStep) {
        rollbackSteps.push(rollbackStep);
      }
    }

    return rollbackSteps;
  }

  /**
   * Generate partial rollback steps
   */
  generatePartialRollbackSteps(
    steps: ExecutionStep[],
    completedStepIds: string[],
    options: PartialRollbackOptions = {}
  ): ExecutionStep[] {
    // Filter to only completed steps
    const completedSteps = steps.filter(s => completedStepIds.includes(s.id));

    // Apply additional filters
    let filteredSteps = completedSteps;

    if (options.includeSteps) {
      filteredSteps = filteredSteps.filter(s => options.includeSteps!.includes(s.id));
    }

    if (options.excludeSteps) {
      filteredSteps = filteredSteps.filter(s => !options.excludeSteps!.includes(s.id));
    }

    if (options.criticalOnly) {
      filteredSteps = filteredSteps.filter(s => s.critical !== false);
    }

    if (options.filter) {
      filteredSteps = filteredSteps.filter(options.filter);
    }

    return this.generateRollbackSteps(filteredSteps);
  }

  /**
   * Create a rollback step for a single execution step
   */
  createRollbackStep(step: ExecutionStep): ExecutionStep | null {
    // Check for custom strategy first
    let strategy = this.customStrategies.get(step.action);

    // Fall back to built-in patterns
    if (!strategy) {
      strategy = COMPENSATION_PATTERNS[step.action];
    }

    // If no strategy found, create a generic rollback
    if (!strategy) {
      return this.createGenericRollbackStep(step);
    }

    // Get rollback action
    const rollbackAction = typeof strategy.rollbackAction === 'function'
      ? strategy.rollbackAction(step)
      : strategy.rollbackAction;

    // Transform parameters
    const rollbackParams = strategy.transformParams
      ? strategy.transformParams(step.params, step)
      : { ...step.params, rollbackFor: step.id };

    // Get description
    const description = typeof strategy.description === 'function'
      ? strategy.description(step)
      : strategy.description ?? `Rollback: ${step.name}`;

    return {
      id: `rollback-${step.id}`,
      name: `Rollback: ${step.name}`,
      action: rollbackAction,
      params: rollbackParams,
      timeout: step.timeout,
      retries: step.retries,
      onFailure: 'continue', // Rollback steps should continue on failure
      description,
      estimatedDuration: step.estimatedDuration,
      critical: step.critical,
    };
  }

  /**
   * Create a generic rollback step when no strategy is defined
   */
  private createGenericRollbackStep(step: ExecutionStep): ExecutionStep {
    return {
      id: `rollback-${step.id}`,
      name: `Rollback: ${step.name}`,
      action: `undo-${step.action}`,
      params: {
        originalStep: step.id,
        originalAction: step.action,
        originalParams: step.params,
      },
      timeout: step.timeout,
      retries: 1, // Fewer retries for rollback
      onFailure: 'continue',
      description: `Generic rollback for ${step.action}`,
      estimatedDuration: step.estimatedDuration,
      critical: step.critical,
    };
  }

  /**
   * Determine rollback scope based on failure context
   */
  determineRollbackScope(
    failedStep: ExecutionStep,
    completedSteps: ExecutionStep[]
  ): RollbackScope {
    // If failed step's onFailure is 'rollback', do full rollback
    if (failedStep.onFailure === 'rollback') {
      return 'full';
    }

    // If failed step's onFailure is 'abort' and it's critical, partial rollback
    if (failedStep.onFailure === 'abort' && failedStep.critical) {
      return 'partial';
    }

    // If failed step's onFailure is 'continue' or 'skip', no rollback
    if (failedStep.onFailure === 'continue' || failedStep.onFailure === 'skip') {
      return 'none';
    }

    // Default to partial rollback
    return 'partial';
  }

  /**
   * Get rollback steps for a specific scope
   */
  getRollbackStepsForScope(
    scope: RollbackScope,
    allSteps: ExecutionStep[],
    completedStepIds: string[],
    failedStepId?: string
  ): ExecutionStep[] {
    switch (scope) {
      case 'full':
        return this.generatePartialRollbackSteps(allSteps, completedStepIds);

      case 'partial':
        // Only rollback critical steps
        return this.generatePartialRollbackSteps(allSteps, completedStepIds, {
          criticalOnly: true,
        });

      case 'none':
        return [];

      default:
        return [];
    }
  }

  /**
   * Check if a step can be rolled back
   */
  canRollback(step: ExecutionStep): boolean {
    // Check custom strategy
    const customStrategy = this.customStrategies.get(step.action);
    if (customStrategy) {
      return customStrategy.reversible;
    }

    // Check built-in patterns
    const builtInStrategy = COMPENSATION_PATTERNS[step.action];
    if (builtInStrategy) {
      return builtInStrategy.reversible;
    }

    // Default: assume rollback is possible
    return true;
  }

  /**
   * Get all action types that have rollback strategies
   */
  getSupportedActions(): string[] {
    const builtIn = Object.keys(COMPENSATION_PATTERNS);
    const custom = Array.from(this.customStrategies.keys());
    return [...new Set([...builtIn, ...custom])];
  }
}

/**
 * Create a new rollback planner instance
 */
export function createRollbackPlanner(): RollbackPlanner {
  return new RollbackPlanner();
}
