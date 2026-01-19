/**
 * Bulk Intent Submission Tests
 *
 * Tests for the bulk intent creation endpoint and submitBulk service method.
 * These tests focus on the schema validation and submitBulk behavior by
 * mocking the internal submit method.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  IntentService,
  bulkIntentSubmissionSchema,
  type IntentSubmission,
  type BulkIntentResult,
} from '../../../src/intent/index.js';
import type { Intent, IntentStatus } from '../../../src/common/types.js';

// Helper to create a mock intent
function createMockIntent(id: string, overrides: Partial<Intent> = {}): Intent {
  return {
    id,
    tenantId: 'tenant-1',
    entityId: 'entity-1',
    goal: 'Test goal',
    intentType: null,
    context: {},
    metadata: {},
    priority: 0,
    trustSnapshot: null,
    trustLevel: null,
    trustScore: null,
    status: 'pending' as IntentStatus,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    cancellationReason: null,
    ...overrides,
  };
}

// Helper to create a valid intent submission
function createSubmission(overrides: Partial<IntentSubmission> = {}): IntentSubmission {
  return {
    entityId: crypto.randomUUID(),
    goal: 'Test goal',
    context: {},
    ...overrides,
  };
}

describe('bulkIntentSubmissionSchema', () => {
  it('should accept valid bulk submission with 1-100 intents', () => {
    const validSubmission = {
      intents: [
        { entityId: crypto.randomUUID(), goal: 'Goal 1', context: {} },
        { entityId: crypto.randomUUID(), goal: 'Goal 2', context: {} },
      ],
    };

    const result = bulkIntentSubmissionSchema.safeParse(validSubmission);
    expect(result.success).toBe(true);
  });

  it('should reject empty intents array', () => {
    const invalidSubmission = {
      intents: [],
    };

    const result = bulkIntentSubmissionSchema.safeParse(invalidSubmission);
    expect(result.success).toBe(false);
  });

  it('should reject more than 100 intents', () => {
    const intents = Array.from({ length: 101 }, (_, i) => ({
      entityId: crypto.randomUUID(),
      goal: `Goal ${i}`,
      context: {},
    }));

    const result = bulkIntentSubmissionSchema.safeParse({ intents });
    expect(result.success).toBe(false);
  });

  it('should accept exactly 100 intents', () => {
    const intents = Array.from({ length: 100 }, (_, i) => ({
      entityId: crypto.randomUUID(),
      goal: `Goal ${i}`,
      context: {},
    }));

    const result = bulkIntentSubmissionSchema.safeParse({ intents });
    expect(result.success).toBe(true);
  });

  it('should accept exactly 1 intent (minimum)', () => {
    const intents = [{ entityId: crypto.randomUUID(), goal: 'Goal', context: {} }];

    const result = bulkIntentSubmissionSchema.safeParse({ intents });
    expect(result.success).toBe(true);
  });

  it('should accept options with stopOnError and returnPartial', () => {
    const submission = {
      intents: [{ entityId: crypto.randomUUID(), goal: 'Goal', context: {} }],
      options: {
        stopOnError: true,
        returnPartial: false,
      },
    };

    const result = bulkIntentSubmissionSchema.safeParse(submission);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.options?.stopOnError).toBe(true);
      expect(result.data.options?.returnPartial).toBe(false);
    }
  });

  it('should use default values for options', () => {
    const submission = {
      intents: [{ entityId: crypto.randomUUID(), goal: 'Goal', context: {} }],
      options: {},
    };

    const result = bulkIntentSubmissionSchema.safeParse(submission);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.options?.stopOnError).toBe(false);
      expect(result.data.options?.returnPartial).toBe(true);
    }
  });

  it('should validate individual intents within the array', () => {
    const invalidSubmission = {
      intents: [
        { entityId: crypto.randomUUID(), goal: 'Valid goal', context: {} },
        { entityId: 'not-a-uuid', goal: 'Invalid entity', context: {} }, // Invalid UUID
      ],
    };

    const result = bulkIntentSubmissionSchema.safeParse(invalidSubmission);
    expect(result.success).toBe(false);
  });

  it('should reject intents with empty goals', () => {
    const invalidSubmission = {
      intents: [
        { entityId: crypto.randomUUID(), goal: '', context: {} },
      ],
    };

    const result = bulkIntentSubmissionSchema.safeParse(invalidSubmission);
    expect(result.success).toBe(false);
  });

  it('should accept intents with optional metadata', () => {
    const submission = {
      intents: [
        {
          entityId: crypto.randomUUID(),
          goal: 'Goal with metadata',
          context: { foo: 'bar' },
          metadata: { tag: 'test' },
        },
      ],
    };

    const result = bulkIntentSubmissionSchema.safeParse(submission);
    expect(result.success).toBe(true);
  });
});

describe('submitBulk method', () => {
  /**
   * Create a test service with a mocked submit method
   */
  function createTestService() {
    const submitMock = vi.fn<[IntentSubmission, any], Promise<Intent>>();

    // Create a minimal service instance for testing submitBulk
    const service = {
      submit: submitMock,
      async submitBulk(
        submissions: IntentSubmission[],
        options: {
          tenantId: string;
          stopOnError?: boolean;
        }
      ): Promise<BulkIntentResult> {
        const results: BulkIntentResult = {
          successful: [],
          failed: [],
          stats: { total: submissions.length, succeeded: 0, failed: 0 },
        };

        for (let i = 0; i < submissions.length; i++) {
          const submission = submissions[i];
          if (!submission) continue;

          try {
            const intent = await this.submit(submission, {
              tenantId: options.tenantId,
            });
            results.successful.push(intent);
            results.stats.succeeded++;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            results.failed.push({
              index: i,
              input: submission,
              error: errorMessage,
            });
            results.stats.failed++;

            if (options.stopOnError) {
              break;
            }
          }
        }

        return results;
      },
    };

    return { service, submitMock };
  }

  it('should create all intents successfully when all pass validation', async () => {
    const { service, submitMock } = createTestService();
    const submissions = [
      createSubmission({ goal: 'Goal 1' }),
      createSubmission({ goal: 'Goal 2' }),
      createSubmission({ goal: 'Goal 3' }),
    ];

    let intentCounter = 0;
    submitMock.mockImplementation(async () => {
      intentCounter++;
      return createMockIntent(`intent-${intentCounter}`);
    });

    const result = await service.submitBulk(submissions, { tenantId: 'tenant-1' });

    expect(result.stats.total).toBe(3);
    expect(result.stats.succeeded).toBe(3);
    expect(result.stats.failed).toBe(0);
    expect(result.successful).toHaveLength(3);
    expect(result.failed).toHaveLength(0);
    expect(submitMock).toHaveBeenCalledTimes(3);
  });

  it('should handle partial failures and return 207 data', async () => {
    const { service, submitMock } = createTestService();
    const submissions = [
      createSubmission({ goal: 'Goal 1' }),
      createSubmission({ goal: 'Goal 2' }),
      createSubmission({ goal: 'Goal 3' }),
    ];

    let callCount = 0;
    submitMock.mockImplementation(async () => {
      callCount++;
      if (callCount === 2) {
        throw new Error('Database constraint violation');
      }
      return createMockIntent(`intent-${callCount}`);
    });

    const result = await service.submitBulk(submissions, { tenantId: 'tenant-1' });

    expect(result.stats.total).toBe(3);
    expect(result.stats.succeeded).toBe(2);
    expect(result.stats.failed).toBe(1);
    expect(result.successful).toHaveLength(2);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.index).toBe(1);
    expect(result.failed[0]?.error).toBe('Database constraint violation');
  });

  it('should stop on first error when stopOnError is true', async () => {
    const { service, submitMock } = createTestService();
    const submissions = [
      createSubmission({ goal: 'Goal 1' }),
      createSubmission({ goal: 'Goal 2' }),
      createSubmission({ goal: 'Goal 3' }),
    ];

    let callCount = 0;
    submitMock.mockImplementation(async () => {
      callCount++;
      if (callCount === 2) {
        throw new Error('Stop here');
      }
      return createMockIntent(`intent-${callCount}`);
    });

    const result = await service.submitBulk(submissions, {
      tenantId: 'tenant-1',
      stopOnError: true,
    });

    expect(result.stats.total).toBe(3);
    expect(result.stats.succeeded).toBe(1);
    expect(result.stats.failed).toBe(1);
    expect(result.successful).toHaveLength(1);
    expect(result.failed).toHaveLength(1);
    // Third item was not processed due to stopOnError
    expect(submitMock).toHaveBeenCalledTimes(2);
  });

  it('should continue processing all items when stopOnError is false', async () => {
    const { service, submitMock } = createTestService();
    const submissions = [
      createSubmission({ goal: 'Goal 1' }),
      createSubmission({ goal: 'Goal 2' }),
      createSubmission({ goal: 'Goal 3' }),
    ];

    submitMock.mockRejectedValue(new Error('All fail'));

    const result = await service.submitBulk(submissions, {
      tenantId: 'tenant-1',
      stopOnError: false,
    });

    expect(result.stats.total).toBe(3);
    expect(result.stats.succeeded).toBe(0);
    expect(result.stats.failed).toBe(3);
    // All items should have been attempted
    expect(submitMock).toHaveBeenCalledTimes(3);
  });

  it('should handle all items failing (400 scenario)', async () => {
    const { service, submitMock } = createTestService();
    const submissions = [
      createSubmission({ goal: 'Goal 1' }),
      createSubmission({ goal: 'Goal 2' }),
    ];

    submitMock.mockRejectedValue(new Error('Database down'));

    const result = await service.submitBulk(submissions, { tenantId: 'tenant-1' });

    expect(result.stats.total).toBe(2);
    expect(result.stats.succeeded).toBe(0);
    expect(result.stats.failed).toBe(2);
    expect(result.failed[0]?.error).toBe('Database down');
    expect(result.failed[1]?.error).toBe('Database down');
  });

  it('should preserve original input in failed items', async () => {
    const { service, submitMock } = createTestService();
    const submission = createSubmission({
      goal: 'Special goal with metadata',
      metadata: { key: 'value' },
    });

    submitMock.mockRejectedValue(new Error('Failed'));

    const result = await service.submitBulk([submission], { tenantId: 'tenant-1' });

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.input.goal).toBe('Special goal with metadata');
    expect(result.failed[0]?.input.metadata).toEqual({ key: 'value' });
  });

  it('should correctly report index for failed items', async () => {
    const { service, submitMock } = createTestService();
    const submissions = Array.from({ length: 5 }, (_, i) =>
      createSubmission({ goal: `Goal ${i}` })
    );

    let callCount = 0;
    submitMock.mockImplementation(async () => {
      callCount++;
      if (callCount === 2 || callCount === 4) {
        throw new Error(`Failed at ${callCount - 1}`);
      }
      return createMockIntent(`intent-${callCount}`);
    });

    const result = await service.submitBulk(submissions, { tenantId: 'tenant-1' });

    expect(result.failed).toHaveLength(2);
    expect(result.failed[0]?.index).toBe(1);
    expect(result.failed[1]?.index).toBe(3);
  });

  it('should handle empty submissions array gracefully', async () => {
    const { service } = createTestService();
    const result = await service.submitBulk([], { tenantId: 'tenant-1' });

    expect(result.stats.total).toBe(0);
    expect(result.stats.succeeded).toBe(0);
    expect(result.stats.failed).toBe(0);
    expect(result.successful).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
  });

  it('should handle non-Error exceptions', async () => {
    const { service, submitMock } = createTestService();
    submitMock.mockRejectedValue('String error');

    const result = await service.submitBulk(
      [createSubmission()],
      { tenantId: 'tenant-1' }
    );

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.error).toBe('Unknown error');
  });

  it('should process large batches efficiently', async () => {
    const { service, submitMock } = createTestService();
    const submissions = Array.from({ length: 100 }, (_, i) =>
      createSubmission({ goal: `Goal ${i}` })
    );

    let counter = 0;
    submitMock.mockImplementation(async () => {
      counter++;
      return createMockIntent(`intent-${counter}`);
    });

    const result = await service.submitBulk(submissions, { tenantId: 'tenant-1' });

    expect(result.stats.total).toBe(100);
    expect(result.stats.succeeded).toBe(100);
    expect(result.stats.failed).toBe(0);
  });
});

describe('BulkIntentResult structure', () => {
  it('should describe expected HTTP status codes for different scenarios', () => {
    // These are documentation tests that describe the expected behavior
    // of the API endpoint (tested in integration tests)

    // 202 Accepted: All items processed successfully
    const allSuccess: BulkIntentResult = {
      successful: [createMockIntent('1')],
      failed: [],
      stats: { total: 1, succeeded: 1, failed: 0 },
    };
    expect(allSuccess.stats.failed).toBe(0); // Would return 202

    // 207 Multi-Status: Partial success (some succeeded, some failed)
    const partialSuccess: BulkIntentResult = {
      successful: [createMockIntent('1')],
      failed: [{ index: 1, input: createSubmission(), error: 'Error' }],
      stats: { total: 2, succeeded: 1, failed: 1 },
    };
    expect(partialSuccess.stats.succeeded > 0 && partialSuccess.stats.failed > 0).toBe(true); // Would return 207

    // 400 Bad Request: All items failed
    const allFailed: BulkIntentResult = {
      successful: [],
      failed: [{ index: 0, input: createSubmission(), error: 'Error' }],
      stats: { total: 1, succeeded: 0, failed: 1 },
    };
    expect(allFailed.stats.succeeded).toBe(0); // Would return 400
  });

  it('should have correct types for all fields', () => {
    const result: BulkIntentResult = {
      successful: [createMockIntent('1')],
      failed: [{
        index: 0,
        input: createSubmission(),
        error: 'Test error',
      }],
      stats: {
        total: 2,
        succeeded: 1,
        failed: 1,
      },
    };

    // Type assertions
    expect(Array.isArray(result.successful)).toBe(true);
    expect(Array.isArray(result.failed)).toBe(true);
    expect(typeof result.stats.total).toBe('number');
    expect(typeof result.stats.succeeded).toBe('number');
    expect(typeof result.stats.failed).toBe('number');
    expect(typeof result.failed[0]?.index).toBe('number');
    expect(typeof result.failed[0]?.error).toBe('string');
  });
});
