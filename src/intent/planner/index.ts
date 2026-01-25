/**
 * EXECUTION PLANNER
 *
 * Creates and manages execution plans for approved intents.
 * Handles multi-step execution with dependencies and rollback support.
 */

import { randomUUID } from 'node:crypto';
import {
  trace,
  SpanKind,
  SpanStatusCode,
  type Span,
} from '@opentelemetry/api';
import type { Intent } from '../../common/types.js';
import { createLogger } from '../../common/logger.js';
import { DependencyResolver, CircularDependencyError } from './dependency.js';
import { RollbackPlanner } from './rollback.js';
import {
  getTemplate,
  type ExecutionTemplate,
  type TemplateStep,
} from './templates.js';

const logger = createLogger({ component: 'execution-planner' });

// Tracer for execution planner operations
const TRACER_NAME = 'vorion.execution-planner';
const TRACER_VERSION = '1.0.0';

/**
 * Get the execution planner tracer
 */
export function getTracer() {
  return trace.getTracer(TRACER_NAME, TRACER_VERSION);
}

/**
 * Span attribute names for execution planner operations
 */
export const PlannerAttributes = {
  PLAN_ID: 'plan.id',
  INTENT_ID: 'intent.id',
  STEP_COUNT: 'plan.step_count',
  ESTIMATED_DURATION: 'plan.estimated_duration_ms',
  HAS_ROLLBACK: 'plan.has_rollback',
  TEMPLATE_NAME: 'plan.template',
} as const;

/**
 * Failure handling strategy for a step
 */
export type OnFailureStrategy =
  | 'abort'           // Stop execution and mark plan as failed
  | 'rollback'        // Trigger rollback of completed steps
  | 'continue'        // Continue with next step (for non-critical steps)
  | 'retry'           // Retry the step (up to retries count)
  | 'skip';           // Skip this step and continue

/**
 * Execution step definition
 */
export interface ExecutionStep {
  /** Unique step identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Action type to execute */
  action: string;
  /** Action parameters */
  params: Record<string, unknown>;
  /** Timeout in milliseconds */
  timeout: number;
  /** Number of retries on failure */
  retries: number;
  /** Strategy on failure */
  onFailure: OnFailureStrategy;
  /** Optional description */
  description?: string;
  /** Estimated duration in milliseconds */
  estimatedDuration?: number;
  /** Whether this step is critical (affects rollback behavior) */
  critical?: boolean;
}

/**
 * Execution plan
 */
export interface ExecutionPlan {
  /** Unique plan identifier */
  id: string;
  /** Intent this plan is for */
  intentId: string;
  /** Ordered execution steps */
  steps: ExecutionStep[];
  /** Step dependencies (step ID -> dependent step IDs) */
  dependencies: Record<string, string[]>;
  /** Total estimated duration in milliseconds */
  estimatedDuration: number;
  /** Rollback steps (in reverse order) */
  rollbackSteps: ExecutionStep[];
  /** Creation timestamp */
  createdAt: string;
  /** Plan metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Options for plan creation
 */
export interface CreatePlanOptions {
  /** Use a specific template */
  template?: string;
  /** Custom timeout multiplier */
  timeoutMultiplier?: number;
  /** Skip rollback planning */
  skipRollback?: boolean;
  /** Additional metadata to include */
  metadata?: Record<string, unknown>;
}

/**
 * Default step configuration
 */
const DEFAULT_STEP_CONFIG = {
  timeout: 30000,     // 30 seconds
  retries: 3,
  onFailure: 'rollback' as OnFailureStrategy,
  estimatedDuration: 5000,  // 5 seconds estimate
};

/**
 * ExecutionPlanner - Creates execution plans for intents
 */
export class ExecutionPlanner {
  private dependencyResolver: DependencyResolver;
  private rollbackPlanner: RollbackPlanner;

  constructor() {
    this.dependencyResolver = new DependencyResolver();
    this.rollbackPlanner = new RollbackPlanner();
  }

  /**
   * Create an execution plan for an intent
   */
  async createPlan(
    intent: Intent,
    options: CreatePlanOptions = {}
  ): Promise<ExecutionPlan> {
    const tracer = getTracer();

    return tracer.startActiveSpan(
      'execution.plan.create',
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          [PlannerAttributes.INTENT_ID]: intent.id,
        },
      },
      async (span) => {
        try {
          const plan = await this.createPlanInternal(intent, options, span);
          span.setAttributes({
            [PlannerAttributes.PLAN_ID]: plan.id,
            [PlannerAttributes.STEP_COUNT]: plan.steps.length,
            [PlannerAttributes.ESTIMATED_DURATION]: plan.estimatedDuration,
            [PlannerAttributes.HAS_ROLLBACK]: plan.rollbackSteps.length > 0,
          });
          span.setStatus({ code: SpanStatusCode.OK });
          return plan;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
          if (error instanceof Error) {
            span.recordException(error);
          }
          throw error;
        } finally {
          span.end();
        }
      }
    );
  }

  /**
   * Internal plan creation logic
   */
  private async createPlanInternal(
    intent: Intent,
    options: CreatePlanOptions,
    span: Span
  ): Promise<ExecutionPlan> {
    const planId = randomUUID();
    const timeoutMultiplier = options.timeoutMultiplier ?? 1;

    // Determine steps based on template or intent type
    let steps: ExecutionStep[];
    let dependencies: Record<string, string[]>;

    if (options.template) {
      span.setAttribute(PlannerAttributes.TEMPLATE_NAME, options.template);
      const result = this.createFromTemplate(options.template, intent, timeoutMultiplier);
      steps = result.steps;
      dependencies = result.dependencies;
    } else {
      // Infer steps from intent
      const result = this.inferStepsFromIntent(intent, timeoutMultiplier);
      steps = result.steps;
      dependencies = result.dependencies;
    }

    // Validate and resolve dependencies
    this.dependencyResolver.validateDependencies(steps, dependencies);
    const executionOrder = this.dependencyResolver.getExecutionOrder(
      steps.map(s => s.id),
      dependencies
    );

    // Reorder steps based on execution order
    const orderedSteps = executionOrder.map(
      stepId => steps.find(s => s.id === stepId)!
    );

    // Generate rollback steps unless skipped
    const rollbackSteps = options.skipRollback
      ? []
      : this.rollbackPlanner.generateRollbackSteps(orderedSteps);

    // Calculate estimated duration
    const estimatedDuration = this.calculateEstimatedDuration(orderedSteps, dependencies);

    const plan: ExecutionPlan = {
      id: planId,
      intentId: intent.id,
      steps: orderedSteps,
      dependencies,
      estimatedDuration,
      rollbackSteps,
      createdAt: new Date().toISOString(),
      metadata: {
        ...options.metadata,
        intentType: intent.intentType,
        entityId: intent.entityId,
      },
    };

    logger.info(
      {
        planId,
        intentId: intent.id,
        stepCount: orderedSteps.length,
        rollbackStepCount: rollbackSteps.length,
        estimatedDuration,
      },
      'Execution plan created'
    );

    return plan;
  }

  /**
   * Create steps from a template
   */
  private createFromTemplate(
    templateName: string,
    intent: Intent,
    timeoutMultiplier: number
  ): { steps: ExecutionStep[]; dependencies: Record<string, string[]> } {
    const template = getTemplate(templateName);
    if (!template) {
      throw new PlannerError(
        `Template not found: ${templateName}`,
        'TEMPLATE_NOT_FOUND'
      );
    }

    const steps = template.steps.map((templateStep, index) =>
      this.templateStepToExecutionStep(templateStep, intent, index, timeoutMultiplier)
    );

    return {
      steps,
      dependencies: template.dependencies ?? {},
    };
  }

  /**
   * Convert a template step to an execution step
   */
  private templateStepToExecutionStep(
    templateStep: TemplateStep,
    intent: Intent,
    index: number,
    timeoutMultiplier: number
  ): ExecutionStep {
    const stepId = templateStep.id ?? `step-${index}`;

    // Resolve parameter placeholders from intent context
    const params = this.resolveParams(templateStep.params ?? {}, intent);

    return {
      id: stepId,
      name: templateStep.name,
      action: templateStep.action,
      params,
      timeout: Math.round((templateStep.timeout ?? DEFAULT_STEP_CONFIG.timeout) * timeoutMultiplier),
      retries: templateStep.retries ?? DEFAULT_STEP_CONFIG.retries,
      onFailure: templateStep.onFailure ?? DEFAULT_STEP_CONFIG.onFailure,
      description: templateStep.description,
      estimatedDuration: templateStep.estimatedDuration ?? DEFAULT_STEP_CONFIG.estimatedDuration,
      critical: templateStep.critical ?? true,
    };
  }

  /**
   * Infer execution steps from intent
   */
  private inferStepsFromIntent(
    intent: Intent,
    timeoutMultiplier: number
  ): { steps: ExecutionStep[]; dependencies: Record<string, string[]> } {
    const intentType = intent.intentType ?? 'default';

    // Map common intent types to templates
    const templateMapping: Record<string, string> = {
      'data-access': 'data-access',
      'data_access': 'data-access',
      'api-call': 'api-call',
      'api_call': 'api-call',
    };

    const mappedTemplate = templateMapping[intentType];
    if (mappedTemplate) {
      return this.createFromTemplate(mappedTemplate, intent, timeoutMultiplier);
    }

    // Default: single-step execution
    return {
      steps: [
        {
          id: 'execute',
          name: 'Execute Intent',
          action: 'execute',
          params: {
            goal: intent.goal,
            context: intent.context,
          },
          timeout: Math.round(DEFAULT_STEP_CONFIG.timeout * timeoutMultiplier),
          retries: DEFAULT_STEP_CONFIG.retries,
          onFailure: 'rollback',
          estimatedDuration: DEFAULT_STEP_CONFIG.estimatedDuration,
          critical: true,
        },
      ],
      dependencies: {},
    };
  }

  /**
   * Resolve parameter placeholders from intent context
   */
  private resolveParams(
    params: Record<string, unknown>,
    intent: Intent
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
        // Extract placeholder path
        const path = value.slice(2, -2).trim();
        resolved[key] = this.resolvePath(path, intent);
      } else if (typeof value === 'object' && value !== null) {
        resolved[key] = this.resolveParams(
          value as Record<string, unknown>,
          intent
        );
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  /**
   * Resolve a dotted path from intent
   */
  private resolvePath(path: string, intent: Intent): unknown {
    const parts = path.split('.');
    let current: unknown = intent;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Calculate estimated duration considering parallel execution
   */
  private calculateEstimatedDuration(
    steps: ExecutionStep[],
    dependencies: Record<string, string[]>
  ): number {
    if (steps.length === 0) {
      return 0;
    }

    // Build reverse dependency map (step -> steps that depend on it)
    const reverseDeps = this.dependencyResolver.buildReverseDependencyMap(
      steps.map(s => s.id),
      dependencies
    );

    // Calculate critical path duration using topological levels
    const levels = this.dependencyResolver.getExecutionLevels(
      steps.map(s => s.id),
      dependencies
    );

    let totalDuration = 0;
    for (const level of levels) {
      // Steps in the same level can run in parallel
      // Duration for this level is the maximum step duration
      const levelDuration = Math.max(
        ...level.map(stepId => {
          const step = steps.find(s => s.id === stepId);
          return step?.estimatedDuration ?? DEFAULT_STEP_CONFIG.estimatedDuration;
        })
      );
      totalDuration += levelDuration;
    }

    return totalDuration;
  }

  /**
   * Validate a plan structure
   */
  validatePlan(plan: ExecutionPlan): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for empty plan
    if (plan.steps.length === 0) {
      warnings.push('Plan has no execution steps');
    }

    // Validate each step
    for (const step of plan.steps) {
      if (!step.id) {
        errors.push('Step missing id');
      }
      if (!step.action) {
        errors.push(`Step ${step.id} missing action`);
      }
      if (step.timeout <= 0) {
        errors.push(`Step ${step.id} has invalid timeout: ${step.timeout}`);
      }
      if (step.retries < 0) {
        errors.push(`Step ${step.id} has invalid retries: ${step.retries}`);
      }
    }

    // Validate dependencies reference existing steps
    const stepIds = new Set(plan.steps.map(s => s.id));
    for (const [stepId, deps] of Object.entries(plan.dependencies)) {
      if (!stepIds.has(stepId)) {
        errors.push(`Dependency references unknown step: ${stepId}`);
      }
      for (const dep of deps) {
        if (!stepIds.has(dep)) {
          errors.push(`Step ${stepId} depends on unknown step: ${dep}`);
        }
      }
    }

    // Check for circular dependencies
    try {
      this.dependencyResolver.getExecutionOrder(
        plan.steps.map(s => s.id),
        plan.dependencies
      );
    } catch (error) {
      if (error instanceof CircularDependencyError) {
        errors.push(`Circular dependency detected: ${error.cycle.join(' -> ')}`);
      } else {
        throw error;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Create an empty plan (edge case handling)
   */
  createEmptyPlan(intentId: string): ExecutionPlan {
    return {
      id: randomUUID(),
      intentId,
      steps: [],
      dependencies: {},
      estimatedDuration: 0,
      rollbackSteps: [],
      createdAt: new Date().toISOString(),
      metadata: { isEmpty: true },
    };
  }
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Planner error
 */
export class PlannerError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PlannerError';
  }
}

/**
 * Create a new execution planner instance
 */
export function createExecutionPlanner(): ExecutionPlanner {
  return new ExecutionPlanner();
}

// Re-exports
export { DependencyResolver, CircularDependencyError } from './dependency.js';
export { RollbackPlanner } from './rollback.js';
export {
  getTemplate,
  registerTemplate,
  listTemplates,
  composeTemplates,
  type ExecutionTemplate,
  type TemplateStep,
} from './templates.js';
