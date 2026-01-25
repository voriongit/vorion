/**
 * Execution Planner Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ExecutionPlanner,
  createExecutionPlanner,
  PlannerError,
  type ExecutionStep,
  type ExecutionPlan,
  type CreatePlanOptions,
} from '../../../src/intent/planner/index.js';
import {
  DependencyResolver,
  CircularDependencyError,
  InvalidDependencyError,
} from '../../../src/intent/planner/dependency.js';
import {
  RollbackPlanner,
  COMPENSATION_PATTERNS,
} from '../../../src/intent/planner/rollback.js';
import {
  getTemplate,
  registerTemplate,
  listTemplates,
  composeTemplates,
  createTemplate,
  type ExecutionTemplate,
} from '../../../src/intent/planner/templates.js';
import type { Intent } from '../../../src/common/types.js';

// Mock logger
vi.mock('../../../src/common/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock OpenTelemetry
vi.mock('@opentelemetry/api', () => ({
  trace: {
    getTracer: vi.fn(() => ({
      startActiveSpan: vi.fn((name, options, fn) => {
        const mockSpan = {
          setAttribute: vi.fn(),
          setAttributes: vi.fn(),
          setStatus: vi.fn(),
          recordException: vi.fn(),
          end: vi.fn(),
        };
        return fn(mockSpan);
      }),
    })),
  },
  SpanKind: { INTERNAL: 'internal' },
  SpanStatusCode: { OK: 0, ERROR: 1 },
}));

// Helper to create a mock intent
function createMockIntent(overrides: Partial<Intent> = {}): Intent {
  return {
    id: 'intent-123',
    tenantId: 'tenant-456',
    entityId: 'entity-789',
    goal: 'Test goal',
    context: {
      resourceType: 'document',
      resourceId: 'doc-123',
      action: 'read',
    },
    metadata: {},
    status: 'approved',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('ExecutionPlanner', () => {
  let planner: ExecutionPlanner;

  beforeEach(() => {
    planner = createExecutionPlanner();
  });

  describe('createPlan', () => {
    it('should create a basic execution plan for an intent', async () => {
      const intent = createMockIntent();
      const plan = await planner.createPlan(intent);

      expect(plan).toBeDefined();
      expect(plan.id).toBeDefined();
      expect(plan.intentId).toBe(intent.id);
      expect(plan.steps).toBeDefined();
      expect(Array.isArray(plan.steps)).toBe(true);
      expect(plan.dependencies).toBeDefined();
      expect(plan.estimatedDuration).toBeGreaterThanOrEqual(0);
      expect(plan.rollbackSteps).toBeDefined();
      expect(plan.createdAt).toBeDefined();
    });

    it('should create a plan with data-access template', async () => {
      const intent = createMockIntent({ intentType: 'data-access' });
      const plan = await planner.createPlan(intent);

      expect(plan.steps.length).toBeGreaterThan(1);
      expect(plan.steps.some(s => s.action === 'check-permission')).toBe(true);
      expect(plan.steps.some(s => s.action === 'fetch')).toBe(true);
      expect(plan.steps.some(s => s.action === 'audit-log')).toBe(true);
    });

    it('should create a plan with api-call template', async () => {
      const intent = createMockIntent({ intentType: 'api-call' });
      const plan = await planner.createPlan(intent);

      expect(plan.steps.length).toBeGreaterThan(1);
      expect(plan.steps.some(s => s.action === 'validate')).toBe(true);
      expect(plan.steps.some(s => s.action === 'api-call')).toBe(true);
    });

    it('should use explicit template option over intent type', async () => {
      const intent = createMockIntent({ intentType: 'data-access' });
      const plan = await planner.createPlan(intent, { template: 'api-call' });

      expect(plan.steps.some(s => s.action === 'api-call')).toBe(true);
    });

    it('should create a single-step plan for unknown intent types', async () => {
      const intent = createMockIntent({ intentType: 'unknown-type' });
      const plan = await planner.createPlan(intent);

      expect(plan.steps.length).toBe(1);
      expect(plan.steps[0].action).toBe('execute');
    });

    it('should throw PlannerError for non-existent template', async () => {
      const intent = createMockIntent();

      await expect(
        planner.createPlan(intent, { template: 'non-existent-template' })
      ).rejects.toThrow(PlannerError);
    });

    it('should apply timeout multiplier to all steps', async () => {
      const intent = createMockIntent({ intentType: 'data-access' });
      const plan = await planner.createPlan(intent, { timeoutMultiplier: 2 });

      // The default timeout for check-permission is 5000, so with 2x it should be 10000
      const checkStep = plan.steps.find(s => s.action === 'check-permission');
      expect(checkStep?.timeout).toBe(10000);
    });

    it('should skip rollback steps when option is set', async () => {
      const intent = createMockIntent({ intentType: 'data-access' });
      const plan = await planner.createPlan(intent, { skipRollback: true });

      expect(plan.rollbackSteps).toEqual([]);
    });

    it('should include metadata in the plan', async () => {
      const intent = createMockIntent({ intentType: 'data-access' });
      const plan = await planner.createPlan(intent, {
        metadata: { customKey: 'customValue' },
      });

      expect(plan.metadata?.customKey).toBe('customValue');
      expect(plan.metadata?.intentType).toBe('data-access');
    });

    it('should generate rollback steps in reverse order', async () => {
      const intent = createMockIntent({ intentType: 'data-access' });
      const plan = await planner.createPlan(intent);

      // Rollback steps should exist for critical steps
      expect(plan.rollbackSteps.length).toBeGreaterThan(0);

      // Rollback step IDs should have 'rollback-' prefix
      for (const rollbackStep of plan.rollbackSteps) {
        expect(rollbackStep.id).toMatch(/^rollback-/);
      }
    });
  });

  describe('createEmptyPlan', () => {
    it('should create an empty plan', () => {
      const plan = planner.createEmptyPlan('intent-empty');

      expect(plan.intentId).toBe('intent-empty');
      expect(plan.steps).toEqual([]);
      expect(plan.dependencies).toEqual({});
      expect(plan.estimatedDuration).toBe(0);
      expect(plan.rollbackSteps).toEqual([]);
      expect(plan.metadata?.isEmpty).toBe(true);
    });
  });

  describe('validatePlan', () => {
    it('should validate a valid plan', async () => {
      const intent = createMockIntent({ intentType: 'data-access' });
      const plan = await planner.createPlan(intent);

      const result = planner.validatePlan(plan);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return warning for empty plan', () => {
      const emptyPlan = planner.createEmptyPlan('intent-empty');
      const result = planner.validatePlan(emptyPlan);

      expect(result.warnings).toContain('Plan has no execution steps');
    });

    it('should detect missing step ID', () => {
      const plan: ExecutionPlan = {
        id: 'plan-1',
        intentId: 'intent-1',
        steps: [
          { id: '', name: 'Test', action: 'test', params: {}, timeout: 5000, retries: 1, onFailure: 'abort' },
        ],
        dependencies: {},
        estimatedDuration: 0,
        rollbackSteps: [],
        createdAt: new Date().toISOString(),
      };

      const result = planner.validatePlan(plan);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Step missing id');
    });

    it('should detect missing action', () => {
      const plan: ExecutionPlan = {
        id: 'plan-1',
        intentId: 'intent-1',
        steps: [
          { id: 'step-1', name: 'Test', action: '', params: {}, timeout: 5000, retries: 1, onFailure: 'abort' },
        ],
        dependencies: {},
        estimatedDuration: 0,
        rollbackSteps: [],
        createdAt: new Date().toISOString(),
      };

      const result = planner.validatePlan(plan);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('missing action'))).toBe(true);
    });

    it('should detect invalid timeout', () => {
      const plan: ExecutionPlan = {
        id: 'plan-1',
        intentId: 'intent-1',
        steps: [
          { id: 'step-1', name: 'Test', action: 'test', params: {}, timeout: -1, retries: 1, onFailure: 'abort' },
        ],
        dependencies: {},
        estimatedDuration: 0,
        rollbackSteps: [],
        createdAt: new Date().toISOString(),
      };

      const result = planner.validatePlan(plan);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('invalid timeout'))).toBe(true);
    });

    it('should detect unknown dependency', () => {
      const plan: ExecutionPlan = {
        id: 'plan-1',
        intentId: 'intent-1',
        steps: [
          { id: 'step-1', name: 'Test', action: 'test', params: {}, timeout: 5000, retries: 1, onFailure: 'abort' },
        ],
        dependencies: {
          'step-1': ['non-existent-step'],
        },
        estimatedDuration: 0,
        rollbackSteps: [],
        createdAt: new Date().toISOString(),
      };

      const result = planner.validatePlan(plan);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('unknown step'))).toBe(true);
    });

    it('should detect circular dependencies', () => {
      const plan: ExecutionPlan = {
        id: 'plan-1',
        intentId: 'intent-1',
        steps: [
          { id: 'step-1', name: 'Test 1', action: 'test', params: {}, timeout: 5000, retries: 1, onFailure: 'abort' },
          { id: 'step-2', name: 'Test 2', action: 'test', params: {}, timeout: 5000, retries: 1, onFailure: 'abort' },
        ],
        dependencies: {
          'step-1': ['step-2'],
          'step-2': ['step-1'],
        },
        estimatedDuration: 0,
        rollbackSteps: [],
        createdAt: new Date().toISOString(),
      };

      const result = planner.validatePlan(plan);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Circular dependency'))).toBe(true);
    });
  });
});

describe('DependencyResolver', () => {
  let resolver: DependencyResolver;

  beforeEach(() => {
    resolver = new DependencyResolver();
  });

  describe('validateDependencies', () => {
    it('should validate correct dependencies', () => {
      const steps = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
      const deps = { b: ['a'], c: ['b'] };

      expect(() => resolver.validateDependencies(steps, deps)).not.toThrow();
    });

    it('should throw InvalidDependencyError for unknown dependency', () => {
      const steps = [{ id: 'a' }, { id: 'b' }];
      const deps = { b: ['unknown'] };

      expect(() => resolver.validateDependencies(steps, deps)).toThrow(
        InvalidDependencyError
      );
    });
  });

  describe('getExecutionOrder', () => {
    it('should return correct order for linear dependencies', () => {
      const stepIds = ['a', 'b', 'c'];
      const deps = { b: ['a'], c: ['b'] };

      const order = resolver.getExecutionOrder(stepIds, deps);

      expect(order).toEqual(['a', 'b', 'c']);
    });

    it('should return correct order for parallel steps', () => {
      const stepIds = ['a', 'b', 'c', 'd'];
      const deps = { c: ['a'], d: ['b'] };

      const order = resolver.getExecutionOrder(stepIds, deps);

      // a and b should come before c and d
      expect(order.indexOf('a')).toBeLessThan(order.indexOf('c'));
      expect(order.indexOf('b')).toBeLessThan(order.indexOf('d'));
    });

    it('should handle empty dependencies', () => {
      const stepIds = ['a', 'b', 'c'];
      const deps = {};

      const order = resolver.getExecutionOrder(stepIds, deps);

      expect(order.length).toBe(3);
      expect(order).toContain('a');
      expect(order).toContain('b');
      expect(order).toContain('c');
    });

    it('should handle empty steps', () => {
      const order = resolver.getExecutionOrder([], {});
      expect(order).toEqual([]);
    });

    it('should throw CircularDependencyError for circular dependencies', () => {
      const stepIds = ['a', 'b', 'c'];
      const deps = { a: ['c'], b: ['a'], c: ['b'] };

      expect(() => resolver.getExecutionOrder(stepIds, deps)).toThrow(
        CircularDependencyError
      );
    });

    it('should throw CircularDependencyError for self-dependency', () => {
      const stepIds = ['a', 'b'];
      const deps = { a: ['a'] };

      expect(() => resolver.getExecutionOrder(stepIds, deps)).toThrow(
        CircularDependencyError
      );
    });
  });

  describe('getExecutionLevels', () => {
    it('should return correct levels for linear dependencies', () => {
      const stepIds = ['a', 'b', 'c'];
      const deps = { b: ['a'], c: ['b'] };

      const levels = resolver.getExecutionLevels(stepIds, deps);

      expect(levels).toEqual([['a'], ['b'], ['c']]);
    });

    it('should group parallel steps in same level', () => {
      const stepIds = ['a', 'b', 'c', 'd'];
      const deps = { c: ['a'], d: ['a'] };

      const levels = resolver.getExecutionLevels(stepIds, deps);

      // Level 0: a, b (no deps)
      // Level 1: c, d (both depend on a)
      expect(levels.length).toBe(2);
      expect(levels[0]).toContain('a');
      expect(levels[0]).toContain('b');
      expect(levels[1]).toContain('c');
      expect(levels[1]).toContain('d');
    });

    it('should handle empty steps', () => {
      const levels = resolver.getExecutionLevels([], {});
      expect(levels).toEqual([]);
    });
  });

  describe('buildReverseDependencyMap', () => {
    it('should build correct reverse map', () => {
      const stepIds = ['a', 'b', 'c'];
      const deps = { b: ['a'], c: ['a', 'b'] };

      const reverse = resolver.buildReverseDependencyMap(stepIds, deps);

      expect(reverse['a']).toContain('b');
      expect(reverse['a']).toContain('c');
      expect(reverse['b']).toContain('c');
      expect(reverse['c']).toEqual([]);
    });
  });

  describe('getTransitiveDependencies', () => {
    it('should get all transitive dependencies', () => {
      const deps = { b: ['a'], c: ['b'], d: ['c'] };

      const transitive = resolver.getTransitiveDependencies('d', deps);

      expect(transitive.has('a')).toBe(true);
      expect(transitive.has('b')).toBe(true);
      expect(transitive.has('c')).toBe(true);
    });

    it('should handle no dependencies', () => {
      const deps = {};

      const transitive = resolver.getTransitiveDependencies('a', deps);

      expect(transitive.size).toBe(0);
    });
  });

  describe('wouldCreateCycle', () => {
    it('should detect cycle creation', () => {
      const stepIds = ['a', 'b', 'c'];
      const deps = { b: ['a'], c: ['b'] };

      // Adding c -> a would create: a -> b -> c -> a
      expect(resolver.wouldCreateCycle('a', 'c', stepIds, deps)).toBe(true);
    });

    it('should allow valid dependency', () => {
      const stepIds = ['a', 'b', 'c', 'd'];
      const deps = { b: ['a'] };

      // Adding d -> c is fine
      expect(resolver.wouldCreateCycle('d', 'c', stepIds, deps)).toBe(false);
    });
  });

  describe('getCriticalPath', () => {
    it('should find critical path in linear dependency', () => {
      const steps = [
        { id: 'a', estimatedDuration: 100 },
        { id: 'b', estimatedDuration: 200 },
        { id: 'c', estimatedDuration: 150 },
      ];
      const deps = { b: ['a'], c: ['b'] };

      const { path, duration } = resolver.getCriticalPath(steps, deps);

      expect(path).toEqual(['a', 'b', 'c']);
      expect(duration).toBe(450);
    });

    it('should find longest path with parallel branches', () => {
      const steps = [
        { id: 'a', estimatedDuration: 100 },
        { id: 'b', estimatedDuration: 50 },
        { id: 'c', estimatedDuration: 200 },
        { id: 'd', estimatedDuration: 100 },
      ];
      const deps = { c: ['a'], d: ['b'] };

      const { path, duration } = resolver.getCriticalPath(steps, deps);

      // Path a -> c (100 + 200 = 300) is longer than b -> d (50 + 100 = 150)
      expect(path).toEqual(['a', 'c']);
      expect(duration).toBe(300);
    });

    it('should handle empty steps', () => {
      const { path, duration } = resolver.getCriticalPath([], {});

      expect(path).toEqual([]);
      expect(duration).toBe(0);
    });
  });

  describe('findCycle', () => {
    it('should find a cycle in the graph', () => {
      const stepIds = ['a', 'b', 'c'];
      const deps = { a: ['c'], b: ['a'], c: ['b'] };

      const cycle = resolver.findCycle(stepIds, deps);

      expect(cycle.length).toBeGreaterThan(0);
      // The cycle should include at least 2 steps
      expect(cycle.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('RollbackPlanner', () => {
  let rollbackPlanner: RollbackPlanner;

  beforeEach(() => {
    rollbackPlanner = new RollbackPlanner();
  });

  describe('generateRollbackSteps', () => {
    it('should generate rollback steps in reverse order', () => {
      const steps: ExecutionStep[] = [
        { id: 'step-1', name: 'Step 1', action: 'create', params: { id: '123' }, timeout: 5000, retries: 1, onFailure: 'rollback' },
        { id: 'step-2', name: 'Step 2', action: 'update', params: { id: '123', previousState: {} }, timeout: 5000, retries: 1, onFailure: 'rollback' },
      ];

      const rollbackSteps = rollbackPlanner.generateRollbackSteps(steps);

      expect(rollbackSteps.length).toBe(2);
      expect(rollbackSteps[0].id).toBe('rollback-step-2');
      expect(rollbackSteps[1].id).toBe('rollback-step-1');
    });

    it('should use compensation patterns for known actions', () => {
      const steps: ExecutionStep[] = [
        { id: 'step-1', name: 'Create Resource', action: 'create', params: { id: '123' }, timeout: 5000, retries: 1, onFailure: 'rollback' },
      ];

      const rollbackSteps = rollbackPlanner.generateRollbackSteps(steps);

      expect(rollbackSteps[0].action).toBe('delete');
    });

    it('should create generic rollback for unknown actions', () => {
      const steps: ExecutionStep[] = [
        { id: 'step-1', name: 'Custom Action', action: 'custom-action', params: {}, timeout: 5000, retries: 1, onFailure: 'rollback' },
      ];

      const rollbackSteps = rollbackPlanner.generateRollbackSteps(steps);

      expect(rollbackSteps[0].action).toBe('undo-custom-action');
    });

    it('should handle empty steps array', () => {
      const rollbackSteps = rollbackPlanner.generateRollbackSteps([]);

      expect(rollbackSteps).toEqual([]);
    });
  });

  describe('generatePartialRollbackSteps', () => {
    const allSteps: ExecutionStep[] = [
      { id: 'step-1', name: 'Step 1', action: 'create', params: {}, timeout: 5000, retries: 1, onFailure: 'rollback', critical: true },
      { id: 'step-2', name: 'Step 2', action: 'update', params: {}, timeout: 5000, retries: 1, onFailure: 'rollback', critical: true },
      { id: 'step-3', name: 'Step 3', action: 'audit-log', params: {}, timeout: 5000, retries: 1, onFailure: 'continue', critical: false },
    ];

    it('should only rollback completed steps', () => {
      const completedStepIds = ['step-1', 'step-2'];

      const rollbackSteps = rollbackPlanner.generatePartialRollbackSteps(
        allSteps,
        completedStepIds
      );

      expect(rollbackSteps.length).toBe(2);
    });

    it('should filter by includeSteps', () => {
      const completedStepIds = ['step-1', 'step-2', 'step-3'];

      const rollbackSteps = rollbackPlanner.generatePartialRollbackSteps(
        allSteps,
        completedStepIds,
        { includeSteps: ['step-1'] }
      );

      expect(rollbackSteps.length).toBe(1);
      expect(rollbackSteps[0].id).toBe('rollback-step-1');
    });

    it('should filter by excludeSteps', () => {
      const completedStepIds = ['step-1', 'step-2'];

      const rollbackSteps = rollbackPlanner.generatePartialRollbackSteps(
        allSteps,
        completedStepIds,
        { excludeSteps: ['step-2'] }
      );

      expect(rollbackSteps.length).toBe(1);
      expect(rollbackSteps[0].id).toBe('rollback-step-1');
    });

    it('should filter by criticalOnly', () => {
      const completedStepIds = ['step-1', 'step-2', 'step-3'];

      const rollbackSteps = rollbackPlanner.generatePartialRollbackSteps(
        allSteps,
        completedStepIds,
        { criticalOnly: true }
      );

      expect(rollbackSteps.length).toBe(2);
      expect(rollbackSteps.every(s => !s.id.includes('step-3'))).toBe(true);
    });
  });

  describe('registerStrategy', () => {
    it('should register and use custom strategy', () => {
      rollbackPlanner.registerStrategy({
        actionType: 'custom-create',
        rollbackAction: 'custom-delete',
        reversible: true,
        description: 'Custom delete',
      });

      const steps: ExecutionStep[] = [
        { id: 'step-1', name: 'Custom Create', action: 'custom-create', params: {}, timeout: 5000, retries: 1, onFailure: 'rollback' },
      ];

      const rollbackSteps = rollbackPlanner.generateRollbackSteps(steps);

      expect(rollbackSteps[0].action).toBe('custom-delete');
    });
  });

  describe('canRollback', () => {
    it('should return true for reversible actions', () => {
      const step: ExecutionStep = {
        id: 'step-1',
        name: 'Create',
        action: 'create',
        params: {},
        timeout: 5000,
        retries: 1,
        onFailure: 'rollback',
      };

      expect(rollbackPlanner.canRollback(step)).toBe(true);
    });

    it('should return false for non-reversible actions', () => {
      const step: ExecutionStep = {
        id: 'step-1',
        name: 'Audit',
        action: 'audit-log',
        params: {},
        timeout: 5000,
        retries: 1,
        onFailure: 'continue',
      };

      expect(rollbackPlanner.canRollback(step)).toBe(false);
    });

    it('should return true for unknown actions by default', () => {
      const step: ExecutionStep = {
        id: 'step-1',
        name: 'Unknown',
        action: 'totally-unknown-action',
        params: {},
        timeout: 5000,
        retries: 1,
        onFailure: 'rollback',
      };

      expect(rollbackPlanner.canRollback(step)).toBe(true);
    });
  });

  describe('determineRollbackScope', () => {
    it('should return full for rollback onFailure', () => {
      const failedStep: ExecutionStep = {
        id: 'step-1',
        name: 'Step',
        action: 'test',
        params: {},
        timeout: 5000,
        retries: 1,
        onFailure: 'rollback',
      };

      expect(rollbackPlanner.determineRollbackScope(failedStep, [])).toBe('full');
    });

    it('should return none for continue onFailure', () => {
      const failedStep: ExecutionStep = {
        id: 'step-1',
        name: 'Step',
        action: 'test',
        params: {},
        timeout: 5000,
        retries: 1,
        onFailure: 'continue',
      };

      expect(rollbackPlanner.determineRollbackScope(failedStep, [])).toBe('none');
    });

    it('should return partial for abort with critical step', () => {
      const failedStep: ExecutionStep = {
        id: 'step-1',
        name: 'Step',
        action: 'test',
        params: {},
        timeout: 5000,
        retries: 1,
        onFailure: 'abort',
        critical: true,
      };

      expect(rollbackPlanner.determineRollbackScope(failedStep, [])).toBe('partial');
    });
  });

  describe('getSupportedActions', () => {
    it('should return all supported action types', () => {
      const actions = rollbackPlanner.getSupportedActions();

      expect(actions).toContain('create');
      expect(actions).toContain('delete');
      expect(actions).toContain('update');
      expect(actions).toContain('api-call');
    });
  });
});

describe('Templates', () => {
  describe('getTemplate', () => {
    it('should return data-access template', () => {
      const template = getTemplate('data-access');

      expect(template).toBeDefined();
      expect(template?.name).toBe('data-access');
      expect(template?.steps.length).toBeGreaterThan(0);
    });

    it('should return api-call template', () => {
      const template = getTemplate('api-call');

      expect(template).toBeDefined();
      expect(template?.name).toBe('api-call');
    });

    it('should return undefined for non-existent template', () => {
      const template = getTemplate('non-existent');

      expect(template).toBeUndefined();
    });
  });

  describe('registerTemplate', () => {
    it('should register a custom template', () => {
      const customTemplate: ExecutionTemplate = {
        name: 'test-template',
        description: 'Test template',
        version: '1.0.0',
        steps: [
          { name: 'Test Step', action: 'test' },
        ],
      };

      registerTemplate(customTemplate);

      const retrieved = getTemplate('test-template');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('test-template');
    });
  });

  describe('listTemplates', () => {
    it('should return list of template names', () => {
      const templates = listTemplates();

      expect(templates).toContain('data-access');
      expect(templates).toContain('api-call');
      expect(templates).toContain('data-mutation');
      expect(templates).toContain('notification');
      expect(templates).toContain('workflow-step');
    });
  });

  describe('composeTemplates', () => {
    it('should compose multiple templates', () => {
      const composed = composeTemplates('composed-test', ['data-access', 'notification']);

      expect(composed.name).toBe('composed-test');
      expect(composed.steps.length).toBeGreaterThan(0);

      // Steps should be prefixed with template names
      expect(composed.steps.some(s => s.id?.startsWith('data-access-'))).toBe(true);
      expect(composed.steps.some(s => s.id?.startsWith('notification-'))).toBe(true);
    });

    it('should add sequential dependencies when option is set', () => {
      const composed = composeTemplates(
        'sequential-test',
        ['data-access', 'notification'],
        { sequentialDependencies: true }
      );

      // The first step of notification template should depend on the last step of data-access
      const notificationDeps = Object.entries(composed.dependencies ?? {}).filter(
        ([key]) => key.startsWith('notification-')
      );

      expect(notificationDeps.some(([_, deps]) =>
        deps.some(d => d.startsWith('data-access-'))
      )).toBe(true);
    });

    it('should throw for non-existent template', () => {
      expect(() => {
        composeTemplates('error-test', ['data-access', 'non-existent']);
      }).toThrow('Template not found');
    });
  });

  describe('createTemplate', () => {
    it('should create a template with auto-generated IDs', () => {
      const template = createTemplate('custom-template', [
        { name: 'Step 1', action: 'action1' },
        { name: 'Step 2', action: 'action2' },
      ]);

      expect(template.name).toBe('custom-template');
      expect(template.steps[0].id).toBe('step-0');
      expect(template.steps[1].id).toBe('step-1');
    });

    it('should preserve existing IDs', () => {
      const template = createTemplate('custom-template', [
        { id: 'custom-id', name: 'Step 1', action: 'action1' },
      ]);

      expect(template.steps[0].id).toBe('custom-id');
    });

    it('should include dependencies', () => {
      const template = createTemplate(
        'custom-template',
        [
          { id: 'a', name: 'Step A', action: 'a' },
          { id: 'b', name: 'Step B', action: 'b' },
        ],
        {
          dependencies: { b: ['a'] },
        }
      );

      expect(template.dependencies?.b).toContain('a');
    });
  });
});

describe('COMPENSATION_PATTERNS', () => {
  it('should have create -> delete pattern', () => {
    const pattern = COMPENSATION_PATTERNS['create'];
    expect(pattern.rollbackAction).toBe('delete');
    expect(pattern.reversible).toBe(true);
  });

  it('should have delete -> restore pattern', () => {
    const pattern = COMPENSATION_PATTERNS['delete'];
    expect(pattern.rollbackAction).toBe('restore');
    expect(pattern.reversible).toBe(true);
  });

  it('should have update -> update pattern with previous state', () => {
    const pattern = COMPENSATION_PATTERNS['update'];
    expect(pattern.rollbackAction).toBe('update');
    expect(pattern.reversible).toBe(true);
  });

  it('should have grant-permission -> revoke-permission pattern', () => {
    const pattern = COMPENSATION_PATTERNS['grant-permission'];
    expect(pattern.rollbackAction).toBe('revoke-permission');
    expect(pattern.reversible).toBe(true);
  });

  it('should mark audit-log as not reversible', () => {
    const pattern = COMPENSATION_PATTERNS['audit-log'];
    expect(pattern.reversible).toBe(false);
  });
});

describe('Edge Cases', () => {
  let planner: ExecutionPlanner;

  beforeEach(() => {
    planner = createExecutionPlanner();
  });

  describe('Empty Plans', () => {
    it('should handle intent with null intentType', async () => {
      const intent = createMockIntent({ intentType: null });
      const plan = await planner.createPlan(intent);

      expect(plan.steps.length).toBe(1);
      expect(plan.steps[0].action).toBe('execute');
    });

    it('should handle intent with undefined intentType', async () => {
      const intent = createMockIntent();
      delete (intent as any).intentType;
      const plan = await planner.createPlan(intent);

      expect(plan.steps.length).toBe(1);
    });
  });

  describe('Single Step Plans', () => {
    it('should create valid single step plan', async () => {
      const intent = createMockIntent({ intentType: 'simple' });
      const plan = await planner.createPlan(intent);

      expect(plan.steps.length).toBe(1);
      expect(plan.dependencies).toEqual({});
    });

    it('should generate rollback for single step', async () => {
      const intent = createMockIntent({ intentType: 'simple' });
      const plan = await planner.createPlan(intent);

      expect(plan.rollbackSteps.length).toBe(1);
    });
  });

  describe('Complex Dependencies', () => {
    it('should handle diamond dependency pattern', async () => {
      const resolver = new DependencyResolver();
      const stepIds = ['a', 'b', 'c', 'd'];
      // Diamond: a -> b, a -> c, b -> d, c -> d
      const deps = { b: ['a'], c: ['a'], d: ['b', 'c'] };

      const order = resolver.getExecutionOrder(stepIds, deps);

      expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
      expect(order.indexOf('a')).toBeLessThan(order.indexOf('c'));
      expect(order.indexOf('b')).toBeLessThan(order.indexOf('d'));
      expect(order.indexOf('c')).toBeLessThan(order.indexOf('d'));
    });

    it('should calculate correct levels for diamond', () => {
      const resolver = new DependencyResolver();
      const stepIds = ['a', 'b', 'c', 'd'];
      const deps = { b: ['a'], c: ['a'], d: ['b', 'c'] };

      const levels = resolver.getExecutionLevels(stepIds, deps);

      expect(levels[0]).toContain('a');
      expect(levels[1]).toContain('b');
      expect(levels[1]).toContain('c');
      expect(levels[2]).toContain('d');
    });
  });

  describe('Parameter Resolution', () => {
    it('should resolve nested context placeholders', async () => {
      const intent = createMockIntent({
        context: {
          nested: {
            deep: {
              value: 'resolved-value',
            },
          },
        },
      });

      // Create a template with nested placeholder
      registerTemplate({
        name: 'nested-test',
        description: 'Test nested params',
        version: '1.0.0',
        steps: [
          {
            id: 'test-step',
            name: 'Test',
            action: 'test',
            params: {
              value: '{{context.nested.deep.value}}',
            },
          },
        ],
      });

      const plan = await planner.createPlan(intent, { template: 'nested-test' });

      expect(plan.steps[0].params.value).toBe('resolved-value');
    });

    it('should handle missing placeholder paths gracefully', async () => {
      const intent = createMockIntent({
        context: {},
      });

      registerTemplate({
        name: 'missing-path-test',
        description: 'Test missing path',
        version: '1.0.0',
        steps: [
          {
            id: 'test-step',
            name: 'Test',
            action: 'test',
            params: {
              value: '{{context.nonexistent.path}}',
            },
          },
        ],
      });

      const plan = await planner.createPlan(intent, { template: 'missing-path-test' });

      expect(plan.steps[0].params.value).toBeUndefined();
    });
  });

  describe('Estimated Duration Calculation', () => {
    it('should calculate parallel execution duration correctly', async () => {
      const intent = createMockIntent({ intentType: 'data-access' });
      const plan = await planner.createPlan(intent);

      // The estimated duration should be less than the sum of all step durations
      // if there are parallel steps
      const sumOfDurations = plan.steps.reduce(
        (sum, step) => sum + (step.estimatedDuration ?? 0),
        0
      );

      // For data-access template, steps are sequential so duration equals sum
      expect(plan.estimatedDuration).toBeLessThanOrEqual(sumOfDurations);
      expect(plan.estimatedDuration).toBeGreaterThan(0);
    });
  });
});
