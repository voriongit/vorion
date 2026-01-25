/**
 * EXECUTION TEMPLATES
 *
 * Pre-defined execution templates for common operations.
 * Supports template composition and customization.
 */

import { createLogger } from '../../common/logger.js';
import type { OnFailureStrategy } from './index.js';

const logger = createLogger({ component: 'execution-templates' });

/**
 * Template step definition
 */
export interface TemplateStep {
  /** Step identifier (optional, auto-generated if not provided) */
  id?: string;
  /** Human-readable name */
  name: string;
  /** Action type to execute */
  action: string;
  /** Action parameters (supports {{path}} placeholders) */
  params?: Record<string, unknown>;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Number of retries on failure */
  retries?: number;
  /** Strategy on failure */
  onFailure?: OnFailureStrategy;
  /** Optional description */
  description?: string;
  /** Estimated duration in milliseconds */
  estimatedDuration?: number;
  /** Whether this step is critical */
  critical?: boolean;
}

/**
 * Execution template definition
 */
export interface ExecutionTemplate {
  /** Unique template name */
  name: string;
  /** Template description */
  description: string;
  /** Template version */
  version: string;
  /** Execution steps */
  steps: TemplateStep[];
  /** Step dependencies (step ID -> dependent step IDs) */
  dependencies?: Record<string, string[]>;
  /** Default timeout multiplier */
  defaultTimeoutMultiplier?: number;
  /** Template metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Template registry
 */
const templateRegistry = new Map<string, ExecutionTemplate>();

/**
 * Built-in template: Data Access
 *
 * Pattern: Check permissions -> Fetch data -> Audit log
 */
const DATA_ACCESS_TEMPLATE: ExecutionTemplate = {
  name: 'data-access',
  description: 'Standard data access pattern with permission check and audit',
  version: '1.0.0',
  steps: [
    {
      id: 'check-permissions',
      name: 'Check Permissions',
      action: 'check-permission',
      params: {
        userId: '{{entityId}}',
        resource: '{{context.resourceType}}',
        resourceId: '{{context.resourceId}}',
        action: '{{context.action}}',
      },
      timeout: 5000,
      retries: 3,
      onFailure: 'abort',
      description: 'Verify user has permission to access the resource',
      estimatedDuration: 500,
      critical: true,
    },
    {
      id: 'fetch-data',
      name: 'Fetch Data',
      action: 'fetch',
      params: {
        resourceType: '{{context.resourceType}}',
        resourceId: '{{context.resourceId}}',
        fields: '{{context.fields}}',
      },
      timeout: 30000,
      retries: 2,
      onFailure: 'abort',
      description: 'Retrieve the requested data',
      estimatedDuration: 2000,
      critical: true,
    },
    {
      id: 'audit-access',
      name: 'Audit Access',
      action: 'audit-log',
      params: {
        eventType: 'data.accessed',
        userId: '{{entityId}}',
        resource: '{{context.resourceType}}',
        resourceId: '{{context.resourceId}}',
        action: 'read',
      },
      timeout: 5000,
      retries: 3,
      onFailure: 'continue', // Audit failure shouldn't block the operation
      description: 'Record the data access in audit log',
      estimatedDuration: 200,
      critical: false,
    },
  ],
  dependencies: {
    'fetch-data': ['check-permissions'],
    'audit-access': ['fetch-data'],
  },
};

/**
 * Built-in template: API Call
 *
 * Pattern: Validate -> Call API -> Verify response -> Record
 */
const API_CALL_TEMPLATE: ExecutionTemplate = {
  name: 'api-call',
  description: 'External API call pattern with validation and recording',
  version: '1.0.0',
  steps: [
    {
      id: 'validate-request',
      name: 'Validate Request',
      action: 'validate',
      params: {
        schema: '{{context.requestSchema}}',
        data: '{{context.requestData}}',
      },
      timeout: 5000,
      retries: 1,
      onFailure: 'abort',
      description: 'Validate the API request payload',
      estimatedDuration: 100,
      critical: true,
    },
    {
      id: 'call-api',
      name: 'Call External API',
      action: 'api-call',
      params: {
        method: '{{context.method}}',
        endpoint: '{{context.endpoint}}',
        headers: '{{context.headers}}',
        body: '{{context.requestData}}',
        timeout: '{{context.apiTimeout}}',
      },
      timeout: 60000,
      retries: 3,
      onFailure: 'rollback',
      description: 'Execute the external API call',
      estimatedDuration: 5000,
      critical: true,
    },
    {
      id: 'verify-response',
      name: 'Verify Response',
      action: 'validate',
      params: {
        schema: '{{context.responseSchema}}',
        data: '{{context.responseData}}',
      },
      timeout: 5000,
      retries: 1,
      onFailure: 'rollback',
      description: 'Verify the API response meets expectations',
      estimatedDuration: 100,
      critical: true,
    },
    {
      id: 'record-call',
      name: 'Record API Call',
      action: 'audit-log',
      params: {
        eventType: 'api.called',
        endpoint: '{{context.endpoint}}',
        method: '{{context.method}}',
        statusCode: '{{context.responseStatus}}',
      },
      timeout: 5000,
      retries: 3,
      onFailure: 'continue',
      description: 'Record the API call in audit log',
      estimatedDuration: 200,
      critical: false,
    },
  ],
  dependencies: {
    'call-api': ['validate-request'],
    'verify-response': ['call-api'],
    'record-call': ['verify-response'],
  },
};

/**
 * Built-in template: Data Mutation
 *
 * Pattern: Validate -> Snapshot -> Mutate -> Verify -> Audit
 */
const DATA_MUTATION_TEMPLATE: ExecutionTemplate = {
  name: 'data-mutation',
  description: 'Data mutation pattern with snapshot for rollback',
  version: '1.0.0',
  steps: [
    {
      id: 'check-permissions',
      name: 'Check Permissions',
      action: 'check-permission',
      params: {
        userId: '{{entityId}}',
        resource: '{{context.resourceType}}',
        resourceId: '{{context.resourceId}}',
        action: '{{context.action}}',
      },
      timeout: 5000,
      retries: 3,
      onFailure: 'abort',
      description: 'Verify user has permission to mutate',
      estimatedDuration: 500,
      critical: true,
    },
    {
      id: 'snapshot-current',
      name: 'Snapshot Current State',
      action: 'fetch',
      params: {
        resourceType: '{{context.resourceType}}',
        resourceId: '{{context.resourceId}}',
        forSnapshot: true,
      },
      timeout: 10000,
      retries: 2,
      onFailure: 'abort',
      description: 'Capture current state for rollback',
      estimatedDuration: 1000,
      critical: true,
    },
    {
      id: 'apply-mutation',
      name: 'Apply Mutation',
      action: 'update',
      params: {
        resourceType: '{{context.resourceType}}',
        resourceId: '{{context.resourceId}}',
        data: '{{context.updateData}}',
        previousState: '{{steps.snapshot-current.result}}',
      },
      timeout: 30000,
      retries: 2,
      onFailure: 'rollback',
      description: 'Apply the data mutation',
      estimatedDuration: 2000,
      critical: true,
    },
    {
      id: 'verify-mutation',
      name: 'Verify Mutation',
      action: 'validate',
      params: {
        resourceType: '{{context.resourceType}}',
        resourceId: '{{context.resourceId}}',
        expectedState: '{{context.expectedState}}',
      },
      timeout: 10000,
      retries: 2,
      onFailure: 'rollback',
      description: 'Verify the mutation was applied correctly',
      estimatedDuration: 1000,
      critical: true,
    },
    {
      id: 'audit-mutation',
      name: 'Audit Mutation',
      action: 'audit-log',
      params: {
        eventType: 'data.mutated',
        userId: '{{entityId}}',
        resource: '{{context.resourceType}}',
        resourceId: '{{context.resourceId}}',
        action: '{{context.action}}',
        previousState: '{{steps.snapshot-current.result}}',
      },
      timeout: 5000,
      retries: 3,
      onFailure: 'continue',
      description: 'Record the mutation in audit log',
      estimatedDuration: 200,
      critical: false,
    },
  ],
  dependencies: {
    'snapshot-current': ['check-permissions'],
    'apply-mutation': ['snapshot-current'],
    'verify-mutation': ['apply-mutation'],
    'audit-mutation': ['verify-mutation'],
  },
};

/**
 * Built-in template: Notification
 *
 * Pattern: Build message -> Check preferences -> Send -> Track
 */
const NOTIFICATION_TEMPLATE: ExecutionTemplate = {
  name: 'notification',
  description: 'Notification delivery pattern with preference checking',
  version: '1.0.0',
  steps: [
    {
      id: 'build-message',
      name: 'Build Message',
      action: 'template-render',
      params: {
        template: '{{context.template}}',
        data: '{{context.templateData}}',
        locale: '{{context.locale}}',
      },
      timeout: 5000,
      retries: 1,
      onFailure: 'abort',
      description: 'Render the notification message',
      estimatedDuration: 200,
      critical: true,
    },
    {
      id: 'check-preferences',
      name: 'Check User Preferences',
      action: 'fetch',
      params: {
        resourceType: 'user-preferences',
        resourceId: '{{context.recipientId}}',
        fields: ['notifications', 'channels'],
      },
      timeout: 5000,
      retries: 2,
      onFailure: 'continue', // Use defaults if preferences unavailable
      description: 'Check user notification preferences',
      estimatedDuration: 500,
      critical: false,
    },
    {
      id: 'send-notification',
      name: 'Send Notification',
      action: 'send-notification',
      params: {
        recipient: '{{context.recipientId}}',
        channel: '{{context.channel}}',
        subject: '{{context.subject}}',
        message: '{{steps.build-message.result}}',
        priority: '{{context.priority}}',
      },
      timeout: 30000,
      retries: 3,
      onFailure: 'retry',
      description: 'Deliver the notification',
      estimatedDuration: 2000,
      critical: true,
    },
    {
      id: 'track-delivery',
      name: 'Track Delivery',
      action: 'audit-log',
      params: {
        eventType: 'notification.sent',
        recipientId: '{{context.recipientId}}',
        channel: '{{context.channel}}',
        notificationId: '{{steps.send-notification.result.id}}',
      },
      timeout: 5000,
      retries: 3,
      onFailure: 'continue',
      description: 'Track notification delivery',
      estimatedDuration: 200,
      critical: false,
    },
  ],
  dependencies: {
    'check-preferences': ['build-message'],
    'send-notification': ['build-message', 'check-preferences'],
    'track-delivery': ['send-notification'],
  },
};

/**
 * Built-in template: Workflow Step
 *
 * Pattern: Check state -> Execute action -> Transition state -> Notify
 */
const WORKFLOW_STEP_TEMPLATE: ExecutionTemplate = {
  name: 'workflow-step',
  description: 'Workflow state transition pattern',
  version: '1.0.0',
  steps: [
    {
      id: 'check-state',
      name: 'Check Current State',
      action: 'fetch',
      params: {
        resourceType: 'workflow',
        resourceId: '{{context.workflowId}}',
        fields: ['currentState', 'allowedTransitions'],
      },
      timeout: 5000,
      retries: 2,
      onFailure: 'abort',
      description: 'Verify current workflow state',
      estimatedDuration: 500,
      critical: true,
    },
    {
      id: 'validate-transition',
      name: 'Validate Transition',
      action: 'validate',
      params: {
        transitionType: 'workflow-state',
        fromState: '{{steps.check-state.result.currentState}}',
        toState: '{{context.targetState}}',
        allowedTransitions: '{{steps.check-state.result.allowedTransitions}}',
      },
      timeout: 5000,
      retries: 1,
      onFailure: 'abort',
      description: 'Validate the state transition is allowed',
      estimatedDuration: 100,
      critical: true,
    },
    {
      id: 'execute-action',
      name: 'Execute Workflow Action',
      action: 'execute',
      params: {
        workflowId: '{{context.workflowId}}',
        action: '{{context.workflowAction}}',
        data: '{{context.actionData}}',
      },
      timeout: 60000,
      retries: 2,
      onFailure: 'rollback',
      description: 'Execute the workflow action',
      estimatedDuration: 5000,
      critical: true,
    },
    {
      id: 'transition-state',
      name: 'Transition State',
      action: 'transition-state',
      params: {
        entityId: '{{context.workflowId}}',
        entityType: 'workflow',
        previousState: '{{steps.check-state.result.currentState}}',
        targetState: '{{context.targetState}}',
      },
      timeout: 10000,
      retries: 2,
      onFailure: 'rollback',
      description: 'Update workflow to target state',
      estimatedDuration: 500,
      critical: true,
    },
    {
      id: 'notify-transition',
      name: 'Notify State Transition',
      action: 'publish',
      params: {
        topic: 'workflow.state.changed',
        payload: {
          workflowId: '{{context.workflowId}}',
          fromState: '{{steps.check-state.result.currentState}}',
          toState: '{{context.targetState}}',
          triggeredBy: '{{entityId}}',
        },
      },
      timeout: 5000,
      retries: 3,
      onFailure: 'continue',
      description: 'Publish state transition event',
      estimatedDuration: 200,
      critical: false,
    },
  ],
  dependencies: {
    'validate-transition': ['check-state'],
    'execute-action': ['validate-transition'],
    'transition-state': ['execute-action'],
    'notify-transition': ['transition-state'],
  },
};

// Register built-in templates
function registerBuiltInTemplates(): void {
  templateRegistry.set('data-access', DATA_ACCESS_TEMPLATE);
  templateRegistry.set('api-call', API_CALL_TEMPLATE);
  templateRegistry.set('data-mutation', DATA_MUTATION_TEMPLATE);
  templateRegistry.set('notification', NOTIFICATION_TEMPLATE);
  templateRegistry.set('workflow-step', WORKFLOW_STEP_TEMPLATE);
}

// Initialize built-in templates
registerBuiltInTemplates();

/**
 * Get a template by name
 */
export function getTemplate(name: string): ExecutionTemplate | undefined {
  return templateRegistry.get(name);
}

/**
 * Register a custom template
 */
export function registerTemplate(template: ExecutionTemplate): void {
  if (templateRegistry.has(template.name)) {
    logger.warn(
      { templateName: template.name },
      'Overwriting existing template'
    );
  }
  templateRegistry.set(template.name, template);
  logger.info(
    { templateName: template.name, version: template.version },
    'Template registered'
  );
}

/**
 * List all available templates
 */
export function listTemplates(): string[] {
  return Array.from(templateRegistry.keys());
}

/**
 * Compose multiple templates into one
 */
export function composeTemplates(
  name: string,
  templates: string[],
  options: {
    description?: string;
    version?: string;
    sequentialDependencies?: boolean;
  } = {}
): ExecutionTemplate {
  const steps: TemplateStep[] = [];
  const dependencies: Record<string, string[]> = {};
  let stepOffset = 0;
  let previousTemplateLastStepId: string | null = null;

  for (const templateName of templates) {
    const template = getTemplate(templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    // Add prefix to step IDs to avoid conflicts
    const prefix = `${templateName}-`;

    for (const step of template.steps) {
      const newStepId = `${prefix}${step.id ?? `step-${stepOffset}`}`;
      steps.push({
        ...step,
        id: newStepId,
      });
      stepOffset++;
    }

    // Update dependencies with prefix
    for (const [stepId, deps] of Object.entries(template.dependencies ?? {})) {
      const newStepId = `${prefix}${stepId}`;
      dependencies[newStepId] = deps.map(d => `${prefix}${d}`);
    }

    // If sequential, add dependency from first step of this template
    // to last step of previous template
    if (options.sequentialDependencies && previousTemplateLastStepId) {
      const firstStepOfCurrentTemplate = template.steps[0];
      if (firstStepOfCurrentTemplate) {
        const firstStepId = `${prefix}${firstStepOfCurrentTemplate.id ?? 'step-0'}`;
        dependencies[firstStepId] = [
          ...(dependencies[firstStepId] ?? []),
          previousTemplateLastStepId,
        ];
      }
    }

    // Track last step of this template
    const lastStep = template.steps[template.steps.length - 1];
    if (lastStep) {
      previousTemplateLastStepId = `${prefix}${lastStep.id ?? `step-${template.steps.length - 1}`}`;
    }
  }

  return {
    name,
    description: options.description ?? `Composed template: ${templates.join(' + ')}`,
    version: options.version ?? '1.0.0',
    steps,
    dependencies,
    metadata: {
      composedFrom: templates,
    },
  };
}

/**
 * Create a template from steps array
 */
export function createTemplate(
  name: string,
  steps: TemplateStep[],
  options: {
    description?: string;
    version?: string;
    dependencies?: Record<string, string[]>;
    metadata?: Record<string, unknown>;
  } = {}
): ExecutionTemplate {
  // Ensure all steps have IDs
  const stepsWithIds = steps.map((step, index) => ({
    ...step,
    id: step.id ?? `step-${index}`,
  }));

  return {
    name,
    description: options.description ?? `Custom template: ${name}`,
    version: options.version ?? '1.0.0',
    steps: stepsWithIds,
    dependencies: options.dependencies ?? {},
    metadata: options.metadata,
  };
}
