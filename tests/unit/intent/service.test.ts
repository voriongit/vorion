/**
 * Intent Service Tests
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { IntentService, intentSubmissionSchema, type IntentSubmission } from '../../../src/intent/index.js';
import type { Intent, IntentStatus } from '../../../src/common/types.js';

// Mock dependencies
vi.mock('../../../src/common/config.js', () => ({
  getConfig: vi.fn(() => ({
    intent: {
      defaultNamespace: 'default',
      namespaceRouting: { 'data-access': 'data-namespace' },
      dedupeTtlSeconds: 600,
      sensitivePaths: ['context.password', 'context.apiKey', 'metadata.secret'],
      defaultMaxInFlight: 1000,
      tenantMaxInFlight: { 'limited-tenant': 10 },
      queueConcurrency: 5,
      jobTimeoutMs: 30000,
      maxRetries: 3,
      retryBackoffMs: 1000,
      eventRetentionDays: 90,
      encryptContext: false,
      trustGates: { 'high-security': 3 },
      defaultMinTrustLevel: 0,
      revalidateTrustAtDecision: true,
      softDeleteRetentionDays: 30,
    },
  })),
}));

vi.mock('../../../src/common/redis.js', () => {
  const mockRedis = {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    duplicate: vi.fn().mockReturnThis(),
  };
  return {
    getRedis: vi.fn(() => mockRedis),
  };
});

vi.mock('../../../src/intent/queues.js', () => ({
  enqueueIntentSubmission: vi.fn().mockResolvedValue(undefined),
}));

// Mock repository
const mockRepository = {
  createIntent: vi.fn(),
  createIntentWithEvent: vi.fn(),
  findById: vi.fn(),
  findByDedupeHash: vi.fn(),
  updateStatus: vi.fn(),
  listIntents: vi.fn(),
  recordEvent: vi.fn(),
  getRecentEvents: vi.fn(),
  recordEvaluation: vi.fn(),
  listEvaluations: vi.fn(),
  countActiveIntents: vi.fn(),
  updateTrustMetadata: vi.fn(),
  cancelIntent: vi.fn(),
  softDelete: vi.fn(),
  verifyEventChain: vi.fn(),
};

describe('IntentService', () => {
  let service: IntentService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new IntentService(mockRepository as any);
  });

  describe('intentSubmissionSchema', () => {
    it('should validate a valid submission', () => {
      const submission: IntentSubmission = {
        entityId: '123e4567-e89b-12d3-a456-426614174000',
        goal: 'Test goal',
        context: { key: 'value' },
        priority: 5,
      };

      const result = intentSubmissionSchema.safeParse(submission);
      expect(result.success).toBe(true);
    });

    it('should reject invalid entityId', () => {
      const submission = {
        entityId: 'not-a-uuid',
        goal: 'Test goal',
        context: {},
      };

      const result = intentSubmissionSchema.safeParse(submission);
      expect(result.success).toBe(false);
    });

    it('should reject empty goal', () => {
      const submission = {
        entityId: '123e4567-e89b-12d3-a456-426614174000',
        goal: '',
        context: {},
      };

      const result = intentSubmissionSchema.safeParse(submission);
      expect(result.success).toBe(false);
    });

    it('should reject goal exceeding 1024 characters', () => {
      const submission = {
        entityId: '123e4567-e89b-12d3-a456-426614174000',
        goal: 'a'.repeat(1025),
        context: {},
      };

      const result = intentSubmissionSchema.safeParse(submission);
      expect(result.success).toBe(false);
    });

    it('should reject priority out of range', () => {
      const submission = {
        entityId: '123e4567-e89b-12d3-a456-426614174000',
        goal: 'Test goal',
        context: {},
        priority: 10,
      };

      const result = intentSubmissionSchema.safeParse(submission);
      expect(result.success).toBe(false);
    });

    it('should reject context exceeding 64KB', () => {
      const submission = {
        entityId: '123e4567-e89b-12d3-a456-426614174000',
        goal: 'Test goal',
        context: { data: 'x'.repeat(65 * 1024) },
      };

      const result = intentSubmissionSchema.safeParse(submission);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('bytes');
      }
    });

    it('should set default priority to 0', () => {
      const submission = {
        entityId: '123e4567-e89b-12d3-a456-426614174000',
        goal: 'Test goal',
        context: {},
      };

      const result = intentSubmissionSchema.safeParse(submission);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priority).toBe(0);
      }
    });
  });

  describe('submit', () => {
    const validSubmission: IntentSubmission = {
      entityId: '123e4567-e89b-12d3-a456-426614174000',
      goal: 'Test goal',
      context: { key: 'value' },
      priority: 0,
    };

    const mockIntent: Intent = {
      id: 'intent-123',
      tenantId: 'tenant-456',
      entityId: '123e4567-e89b-12d3-a456-426614174000',
      goal: 'Test goal',
      context: { key: 'value' },
      metadata: {},
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    beforeEach(() => {
      mockRepository.findByDedupeHash.mockResolvedValue(null);
      mockRepository.countActiveIntents.mockResolvedValue(0);
      mockRepository.createIntentWithEvent.mockResolvedValue(mockIntent);
      mockRepository.recordEvent.mockResolvedValue(undefined);
    });

    it('should create a new intent', async () => {
      const intent = await service.submit(validSubmission, { tenantId: 'tenant-456', bypassTrustGate: true });

      expect(intent).toEqual(mockIntent);
      expect(mockRepository.createIntentWithEvent).toHaveBeenCalledTimes(1);
    });

    it('should return existing intent if duplicate detected', async () => {
      mockRepository.findByDedupeHash.mockResolvedValue(mockIntent);

      const intent = await service.submit(validSubmission, { tenantId: 'tenant-456', bypassTrustGate: true });

      expect(intent).toEqual(mockIntent);
      expect(mockRepository.createIntentWithEvent).not.toHaveBeenCalled();
    });

    it('should redact sensitive fields in context', async () => {
      const submissionWithSensitive: IntentSubmission = {
        ...validSubmission,
        context: {
          key: 'value',
          password: 'secret123',
          apiKey: 'key123',
        },
      };

      await service.submit(submissionWithSensitive, { tenantId: 'tenant-456', bypassTrustGate: true });

      const createCall = mockRepository.createIntentWithEvent.mock.calls[0][0];
      expect(createCall.context.password).toBe('[REDACTED]');
      expect(createCall.context.apiKey).toBe('[REDACTED]');
      expect(createCall.context.key).toBe('value');
    });

    it('should redact sensitive fields in metadata', async () => {
      const submissionWithSensitive: IntentSubmission = {
        ...validSubmission,
        metadata: {
          key: 'value',
          secret: 'topsecret',
        },
      };

      await service.submit(submissionWithSensitive, { tenantId: 'tenant-456', bypassTrustGate: true });

      const createCall = mockRepository.createIntentWithEvent.mock.calls[0][0];
      expect(createCall.metadata.secret).toBe('[REDACTED]');
      expect(createCall.metadata.key).toBe('value');
    });

    it('should resolve namespace from intentType', async () => {
      const submissionWithType: IntentSubmission = {
        ...validSubmission,
        intentType: 'data-access',
      };

      const mockIntentWithType = {
        ...mockIntent,
        intentType: 'data-access',
      };
      mockRepository.createIntentWithEvent.mockResolvedValue(mockIntentWithType);

      await service.submit(submissionWithType, { tenantId: 'tenant-456', bypassTrustGate: true });

      const { enqueueIntentSubmission } = await import('../../../src/intent/queues.js');
      expect(enqueueIntentSubmission).toHaveBeenCalledWith(
        mockIntentWithType,
        { namespace: 'data-namespace' }
      );
    });

    it('should use default namespace when intentType not mapped', async () => {
      const submissionWithUnknownType: IntentSubmission = {
        ...validSubmission,
        intentType: 'unknown-type',
      };

      await service.submit(submissionWithUnknownType, { tenantId: 'tenant-456', bypassTrustGate: true });

      const { enqueueIntentSubmission } = await import('../../../src/intent/queues.js');
      expect(enqueueIntentSubmission).toHaveBeenCalledWith(
        mockIntent,
        { namespace: 'default' }
      );
    });
  });

  describe('get', () => {
    it('should return intent by id and tenantId', async () => {
      const mockIntent: Intent = {
        id: 'intent-123',
        tenantId: 'tenant-456',
        entityId: '123e4567-e89b-12d3-a456-426614174000',
        goal: 'Test goal',
        context: {},
        metadata: {},
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockRepository.findById.mockResolvedValue(mockIntent);

      const intent = await service.get('intent-123', 'tenant-456');

      expect(intent).toEqual(mockIntent);
      expect(mockRepository.findById).toHaveBeenCalledWith('intent-123', 'tenant-456');
    });

    it('should return null if intent not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const intent = await service.get('nonexistent', 'tenant-456');

      expect(intent).toBeNull();
    });
  });

  describe('getWithEvents', () => {
    it('should return intent with events and evaluations', async () => {
      const mockIntent: Intent = {
        id: 'intent-123',
        tenantId: 'tenant-456',
        entityId: '123e4567-e89b-12d3-a456-426614174000',
        goal: 'Test goal',
        context: {},
        metadata: {},
        status: 'approved',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockEvents = [
        { id: 'ev1', intentId: 'intent-123', eventType: 'intent.submitted', payload: {}, createdAt: new Date().toISOString() },
        { id: 'ev2', intentId: 'intent-123', eventType: 'intent.status.changed', payload: { status: 'approved' }, createdAt: new Date().toISOString() },
      ];

      const mockEvaluations = [
        { id: 'eval1', intentId: 'intent-123', tenantId: 'tenant-456', result: { stage: 'basis' }, createdAt: new Date().toISOString() },
      ];

      mockRepository.findById.mockResolvedValue(mockIntent);
      mockRepository.getRecentEvents.mockResolvedValue(mockEvents);
      mockRepository.listEvaluations.mockResolvedValue(mockEvaluations);

      const result = await service.getWithEvents('intent-123', 'tenant-456');

      expect(result).toEqual({
        intent: mockIntent,
        events: mockEvents,
        evaluations: mockEvaluations,
      });
    });

    it('should return null if intent not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await service.getWithEvents('nonexistent', 'tenant-456');

      expect(result).toBeNull();
    });
  });

  describe('updateStatus', () => {
    const mockIntent: Intent = {
      id: 'intent-123',
      tenantId: 'tenant-456',
      entityId: '123e4567-e89b-12d3-a456-426614174000',
      goal: 'Test goal',
      context: {},
      metadata: {},
      status: 'approved',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should update intent status', async () => {
      mockRepository.updateStatus.mockResolvedValue(mockIntent);

      const intent = await service.updateStatus('intent-123', 'tenant-456', 'approved');

      expect(intent).toEqual(mockIntent);
      expect(mockRepository.updateStatus).toHaveBeenCalledWith('intent-123', 'tenant-456', 'approved');
      expect(mockRepository.recordEvent).toHaveBeenCalledWith({
        intentId: 'intent-123',
        eventType: 'intent.status.changed',
        payload: { status: 'approved' },
      });
    });

    it('should throw error for invalid status', async () => {
      await expect(
        service.updateStatus('intent-123', 'tenant-456', 'invalid' as IntentStatus)
      ).rejects.toThrow('Invalid intent status');
    });

    it('should return null if intent not found', async () => {
      mockRepository.updateStatus.mockResolvedValue(null);

      const intent = await service.updateStatus('nonexistent', 'tenant-456', 'approved');

      expect(intent).toBeNull();
      expect(mockRepository.recordEvent).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('should list intents with filters', async () => {
      const mockIntents: Intent[] = [
        {
          id: 'intent-1',
          tenantId: 'tenant-456',
          entityId: '123e4567-e89b-12d3-a456-426614174000',
          goal: 'Goal 1',
          context: {},
          metadata: {},
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'intent-2',
          tenantId: 'tenant-456',
          entityId: '123e4567-e89b-12d3-a456-426614174000',
          goal: 'Goal 2',
          context: {},
          metadata: {},
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      mockRepository.listIntents.mockResolvedValue(mockIntents);

      const intents = await service.list({
        tenantId: 'tenant-456',
        status: 'pending',
        limit: 10,
      });

      expect(intents).toEqual(mockIntents);
      expect(mockRepository.listIntents).toHaveBeenCalledWith({
        tenantId: 'tenant-456',
        status: 'pending',
        limit: 10,
      });
    });
  });

  describe('updateTrustMetadata', () => {
    it('should update trust metadata', async () => {
      const mockIntent: Intent = {
        id: 'intent-123',
        tenantId: 'tenant-456',
        entityId: '123e4567-e89b-12d3-a456-426614174000',
        goal: 'Test goal',
        context: {},
        metadata: {},
        status: 'pending',
        trustSnapshot: { score: 500, level: 2 },
        trustLevel: 2,
        trustScore: 500,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockRepository.updateTrustMetadata.mockResolvedValue(mockIntent);

      const intent = await service.updateTrustMetadata(
        'intent-123',
        'tenant-456',
        { score: 500, level: 2 },
        2,
        500
      );

      expect(intent).toEqual(mockIntent);
      expect(mockRepository.updateTrustMetadata).toHaveBeenCalledWith(
        'intent-123',
        'tenant-456',
        { score: 500, level: 2 },
        2,
        500
      );
    });
  });

  describe('recordEvaluation', () => {
    it('should record evaluation', async () => {
      const mockEvaluation = {
        id: 'eval-123',
        intentId: 'intent-123',
        tenantId: 'tenant-456',
        result: { stage: 'basis', passed: true },
        createdAt: new Date().toISOString(),
      };

      mockRepository.recordEvaluation.mockResolvedValue(mockEvaluation);

      const evaluation = await service.recordEvaluation(
        'intent-123',
        'tenant-456',
        { stage: 'basis', passed: true }
      );

      expect(evaluation).toEqual(mockEvaluation);
    });
  });
});

describe('Deduplication', () => {
  let service: IntentService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new IntentService(mockRepository as any);
    mockRepository.findByDedupeHash.mockResolvedValue(null);
    mockRepository.countActiveIntents.mockResolvedValue(0);
  });

  it('should generate consistent dedupe hash for same input', async () => {
    const submission: IntentSubmission = {
      entityId: '123e4567-e89b-12d3-a456-426614174000',
      goal: 'Test goal',
      context: { key: 'value' },
      priority: 0,
    };

    const intent1: Intent = {
      id: 'intent-1',
      tenantId: 'tenant-456',
      entityId: submission.entityId,
      goal: submission.goal,
      context: submission.context,
      metadata: {},
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockRepository.createIntentWithEvent.mockResolvedValue(intent1);

    await service.submit(submission, { tenantId: 'tenant-456', bypassTrustGate: true });
    const firstCallHash = mockRepository.createIntentWithEvent.mock.calls[0][0].dedupeHash;

    mockRepository.createIntentWithEvent.mockClear();
    mockRepository.createIntentWithEvent.mockResolvedValue({ ...intent1, id: 'intent-2' });

    await service.submit(submission, { tenantId: 'tenant-456', bypassTrustGate: true });
    const secondCallHash = mockRepository.createIntentWithEvent.mock.calls[0][0].dedupeHash;

    expect(firstCallHash).toBe(secondCallHash);
  });

  it('should generate different dedupe hash for different goals', async () => {
    const submission1: IntentSubmission = {
      entityId: '123e4567-e89b-12d3-a456-426614174000',
      goal: 'Goal 1',
      context: {},
      priority: 0,
    };

    const submission2: IntentSubmission = {
      entityId: '123e4567-e89b-12d3-a456-426614174000',
      goal: 'Goal 2',
      context: {},
      priority: 0,
    };

    const mockIntent: Intent = {
      id: 'intent-1',
      tenantId: 'tenant-456',
      entityId: submission1.entityId,
      goal: submission1.goal,
      context: {},
      metadata: {},
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockRepository.createIntentWithEvent.mockResolvedValue(mockIntent);

    await service.submit(submission1, { tenantId: 'tenant-456', bypassTrustGate: true });
    const hash1 = mockRepository.createIntentWithEvent.mock.calls[0][0].dedupeHash;

    mockRepository.createIntentWithEvent.mockClear();
    mockRepository.createIntentWithEvent.mockResolvedValue({ ...mockIntent, goal: submission2.goal });

    await service.submit(submission2, { tenantId: 'tenant-456', bypassTrustGate: true });
    const hash2 = mockRepository.createIntentWithEvent.mock.calls[0][0].dedupeHash;

    expect(hash1).not.toBe(hash2);
  });

  it('should include idempotencyKey in dedupe hash when provided', async () => {
    const baseSubmission: IntentSubmission = {
      entityId: '123e4567-e89b-12d3-a456-426614174000',
      goal: 'Test goal',
      context: {},
      priority: 0,
    };

    const submissionWithKey: IntentSubmission = {
      ...baseSubmission,
      idempotencyKey: 'unique-key-123',
    };

    const mockIntent: Intent = {
      id: 'intent-1',
      tenantId: 'tenant-456',
      entityId: baseSubmission.entityId,
      goal: baseSubmission.goal,
      context: {},
      metadata: {},
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockRepository.createIntentWithEvent.mockResolvedValue(mockIntent);

    await service.submit(baseSubmission, { tenantId: 'tenant-456', bypassTrustGate: true });
    const hashWithoutKey = mockRepository.createIntentWithEvent.mock.calls[0][0].dedupeHash;

    mockRepository.createIntentWithEvent.mockClear();
    mockRepository.createIntentWithEvent.mockResolvedValue(mockIntent);

    await service.submit(submissionWithKey, { tenantId: 'tenant-456', bypassTrustGate: true });
    const hashWithKey = mockRepository.createIntentWithEvent.mock.calls[0][0].dedupeHash;

    expect(hashWithoutKey).not.toBe(hashWithKey);
  });
});

describe('Trust Gate Validation', () => {
  let service: IntentService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new IntentService(mockRepository as any);
    mockRepository.findByDedupeHash.mockResolvedValue(null);
    mockRepository.countActiveIntents.mockResolvedValue(0);
  });

  it('should allow submission when trust level meets requirement', async () => {
    const submission: IntentSubmission = {
      entityId: '123e4567-e89b-12d3-a456-426614174000',
      goal: 'High security operation',
      context: {},
      intentType: 'high-security',
      priority: 0,
    };

    const mockIntent: Intent = {
      id: 'intent-123',
      tenantId: 'tenant-456',
      entityId: submission.entityId,
      goal: submission.goal,
      context: {},
      metadata: {},
      intentType: 'high-security',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockRepository.createIntentWithEvent.mockResolvedValue(mockIntent);

    // Trust level 3 meets the requirement for 'high-security' (requires 3)
    const intent = await service.submit(submission, {
      tenantId: 'tenant-456',
      trustLevel: 3,
    });

    expect(intent).toEqual(mockIntent);
  });

  it('should reject submission when trust level is insufficient', async () => {
    const submission: IntentSubmission = {
      entityId: '123e4567-e89b-12d3-a456-426614174000',
      goal: 'High security operation',
      context: {},
      intentType: 'high-security',
      priority: 0,
    };

    // Trust level 2 is below the requirement for 'high-security' (requires 3)
    await expect(
      service.submit(submission, {
        tenantId: 'tenant-456',
        trustLevel: 2,
      })
    ).rejects.toThrow('Trust level');
  });

  it('should allow bypassing trust gate when explicitly requested', async () => {
    const submission: IntentSubmission = {
      entityId: '123e4567-e89b-12d3-a456-426614174000',
      goal: 'High security operation',
      context: {},
      intentType: 'high-security',
      priority: 0,
    };

    const mockIntent: Intent = {
      id: 'intent-123',
      tenantId: 'tenant-456',
      entityId: submission.entityId,
      goal: submission.goal,
      context: {},
      metadata: {},
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockRepository.createIntentWithEvent.mockResolvedValue(mockIntent);

    // Even with insufficient trust level, bypass should work
    const intent = await service.submit(submission, {
      tenantId: 'tenant-456',
      trustLevel: 0,
      bypassTrustGate: true,
    });

    expect(intent).toEqual(mockIntent);
  });

  it('should use default trust level for unmapped intent types', async () => {
    const submission: IntentSubmission = {
      entityId: '123e4567-e89b-12d3-a456-426614174000',
      goal: 'Regular operation',
      context: {},
      intentType: 'regular-operation',
      priority: 0,
    };

    const mockIntent: Intent = {
      id: 'intent-123',
      tenantId: 'tenant-456',
      entityId: submission.entityId,
      goal: submission.goal,
      context: {},
      metadata: {},
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockRepository.createIntentWithEvent.mockResolvedValue(mockIntent);

    // Default trust level is 0, so level 0 should be sufficient
    const intent = await service.submit(submission, {
      tenantId: 'tenant-456',
      trustLevel: 0,
    });

    expect(intent).toEqual(mockIntent);
  });

  it('should return correct required trust level for intent types', () => {
    // high-security requires level 3
    expect(service.getRequiredTrustLevel('high-security')).toBe(3);

    // unmapped type uses default (0)
    expect(service.getRequiredTrustLevel('regular')).toBe(0);

    // null/undefined uses default (0)
    expect(service.getRequiredTrustLevel(null)).toBe(0);
    expect(service.getRequiredTrustLevel(undefined)).toBe(0);
  });
});

describe('Intent Cancellation', () => {
  let service: IntentService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new IntentService(mockRepository as any);
  });

  it('should cancel a pending intent', async () => {
    const mockCancelledIntent: Intent = {
      id: 'intent-123',
      tenantId: 'tenant-456',
      entityId: '123e4567-e89b-12d3-a456-426614174000',
      goal: 'Test goal',
      context: {},
      metadata: {},
      status: 'cancelled',
      cancellationReason: 'User requested',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockRepository.cancelIntent.mockResolvedValue(mockCancelledIntent);

    const result = await service.cancel('intent-123', {
      tenantId: 'tenant-456',
      reason: 'User requested',
    });

    expect(result).toEqual(mockCancelledIntent);
    expect(mockRepository.cancelIntent).toHaveBeenCalledWith(
      'intent-123',
      'tenant-456',
      'User requested'
    );
  });

  it('should record cancellation evaluation when cancelledBy is provided', async () => {
    const mockCancelledIntent: Intent = {
      id: 'intent-123',
      tenantId: 'tenant-456',
      entityId: '123e4567-e89b-12d3-a456-426614174000',
      goal: 'Test goal',
      context: {},
      metadata: {},
      status: 'cancelled',
      cancellationReason: 'Admin override',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockRepository.cancelIntent.mockResolvedValue(mockCancelledIntent);

    await service.cancel('intent-123', {
      tenantId: 'tenant-456',
      reason: 'Admin override',
      cancelledBy: 'admin-user',
    });

    expect(mockRepository.recordEvaluation).toHaveBeenCalledWith({
      intentId: 'intent-123',
      tenantId: 'tenant-456',
      result: {
        stage: 'cancelled',
        reason: 'Admin override',
        cancelledBy: 'admin-user',
      },
    });
  });

  it('should record cancellation event', async () => {
    const mockCancelledIntent: Intent = {
      id: 'intent-123',
      tenantId: 'tenant-456',
      entityId: '123e4567-e89b-12d3-a456-426614174000',
      goal: 'Test goal',
      context: {},
      metadata: {},
      status: 'cancelled',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockRepository.cancelIntent.mockResolvedValue(mockCancelledIntent);

    await service.cancel('intent-123', {
      tenantId: 'tenant-456',
      reason: 'User requested',
    });

    expect(mockRepository.recordEvent).toHaveBeenCalledWith({
      intentId: 'intent-123',
      eventType: 'intent.cancelled',
      payload: {
        reason: 'User requested',
        cancelledBy: undefined,
      },
    });
  });

  it('should return null when intent cannot be cancelled', async () => {
    mockRepository.cancelIntent.mockResolvedValue(null);

    const result = await service.cancel('intent-123', {
      tenantId: 'tenant-456',
      reason: 'Too late',
    });

    expect(result).toBeNull();
    expect(mockRepository.recordEvent).not.toHaveBeenCalled();
  });
});

describe('Intent Soft Delete (GDPR)', () => {
  let service: IntentService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new IntentService(mockRepository as any);
  });

  it('should soft delete an intent', async () => {
    const deletedAt = new Date().toISOString();
    const mockDeletedIntent: Intent = {
      id: 'intent-123',
      tenantId: 'tenant-456',
      entityId: '123e4567-e89b-12d3-a456-426614174000',
      goal: 'Test goal',
      context: {},
      metadata: {},
      status: 'completed',
      deletedAt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockRepository.softDelete.mockResolvedValue(mockDeletedIntent);

    const result = await service.delete('intent-123', 'tenant-456');

    expect(result).toEqual(mockDeletedIntent);
    expect(mockRepository.softDelete).toHaveBeenCalledWith('intent-123', 'tenant-456');
  });

  it('should record deletion event', async () => {
    const deletedAt = new Date().toISOString();
    const mockDeletedIntent: Intent = {
      id: 'intent-123',
      tenantId: 'tenant-456',
      entityId: '123e4567-e89b-12d3-a456-426614174000',
      goal: 'Test goal',
      context: {},
      metadata: {},
      status: 'completed',
      deletedAt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockRepository.softDelete.mockResolvedValue(mockDeletedIntent);

    await service.delete('intent-123', 'tenant-456');

    expect(mockRepository.recordEvent).toHaveBeenCalledWith({
      intentId: 'intent-123',
      eventType: 'intent.deleted',
      payload: { deletedAt },
    });
  });

  it('should return null when intent not found', async () => {
    mockRepository.softDelete.mockResolvedValue(null);

    const result = await service.delete('nonexistent', 'tenant-456');

    expect(result).toBeNull();
    expect(mockRepository.recordEvent).not.toHaveBeenCalled();
  });
});

describe('Event Chain Verification', () => {
  let service: IntentService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new IntentService(mockRepository as any);
  });

  it('should return valid when chain is intact', async () => {
    mockRepository.verifyEventChain.mockResolvedValue({ valid: true });

    const result = await service.verifyEventChain('intent-123');

    expect(result).toEqual({ valid: true });
    expect(mockRepository.verifyEventChain).toHaveBeenCalledWith('intent-123');
  });

  it('should return invalid with error details when chain is broken', async () => {
    mockRepository.verifyEventChain.mockResolvedValue({
      valid: false,
      invalidAt: 3,
      error: 'Chain broken at event 3',
    });

    const result = await service.verifyEventChain('intent-123');

    expect(result).toEqual({
      valid: false,
      invalidAt: 3,
      error: 'Chain broken at event 3',
    });
  });
});
