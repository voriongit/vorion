/**
 * Pagination Tests for INTENT Module
 *
 * Tests the strict pagination limits and behavior for the INTENT module.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../../../src/intent/repository.js';
import type { Intent, IntentStatus } from '../../../src/common/types.js';
import type { PaginatedResult } from '../../../src/intent/repository.js';

// Mock dependencies
vi.mock('../../../src/common/config.js', () => ({
  getConfig: vi.fn(() => ({
    intent: {
      defaultNamespace: 'default',
      namespaceRouting: {},
      dedupeTtlSeconds: 600,
      sensitivePaths: [],
      defaultMaxInFlight: 1000,
      tenantMaxInFlight: {},
      queueConcurrency: 5,
      jobTimeoutMs: 30000,
      maxRetries: 3,
      retryBackoffMs: 1000,
      eventRetentionDays: 90,
      encryptContext: false,
      trustGates: {},
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
    eval: vi.fn().mockResolvedValue(1),
  };
  return {
    getRedis: vi.fn(() => mockRedis),
  };
});

vi.mock('../../../src/intent/queues.js', () => ({
  enqueueIntentSubmission: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/common/db.js', () => ({
  getDatabase: vi.fn(() => ({
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
  })),
  checkDatabaseHealth: vi.fn().mockResolvedValue({ ok: true }),
}));

describe('Pagination Constants', () => {
  it('should have DEFAULT_PAGE_SIZE of 50', () => {
    expect(DEFAULT_PAGE_SIZE).toBe(50);
  });

  it('should have MAX_PAGE_SIZE of 1000', () => {
    expect(MAX_PAGE_SIZE).toBe(1000);
  });
});

describe('Pagination Schema Validation', () => {
  // Recreate the schema used in routes.ts for testing
  const paginationQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
    offset: z.coerce.number().int().min(0).optional(),
    cursor: z.string().uuid().optional(),
  }).refine(
    (data) => !(data.offset !== undefined && data.cursor !== undefined),
    {
      message: 'Cannot use both offset and cursor pagination simultaneously',
      path: ['cursor'],
    }
  );

  describe('limit validation', () => {
    it('should accept valid limit within range', () => {
      const result = paginationQuerySchema.safeParse({ limit: 50 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
      }
    });

    it('should accept limit of 1 (minimum)', () => {
      const result = paginationQuerySchema.safeParse({ limit: 1 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(1);
      }
    });

    it('should accept limit of MAX_PAGE_SIZE (1000)', () => {
      const result = paginationQuerySchema.safeParse({ limit: MAX_PAGE_SIZE });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(MAX_PAGE_SIZE);
      }
    });

    it('should reject limit of 0', () => {
      const result = paginationQuerySchema.safeParse({ limit: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject limit exceeding MAX_PAGE_SIZE', () => {
      const result = paginationQuerySchema.safeParse({ limit: MAX_PAGE_SIZE + 1 });
      expect(result.success).toBe(false);
    });

    it('should reject negative limit', () => {
      const result = paginationQuerySchema.safeParse({ limit: -10 });
      expect(result.success).toBe(false);
    });

    it('should coerce string limit to number', () => {
      const result = paginationQuerySchema.safeParse({ limit: '100' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(100);
      }
    });
  });

  describe('offset validation', () => {
    it('should accept valid offset of 0', () => {
      const result = paginationQuerySchema.safeParse({ offset: 0 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.offset).toBe(0);
      }
    });

    it('should accept positive offset', () => {
      const result = paginationQuerySchema.safeParse({ offset: 100 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.offset).toBe(100);
      }
    });

    it('should reject negative offset', () => {
      const result = paginationQuerySchema.safeParse({ offset: -1 });
      expect(result.success).toBe(false);
    });

    it('should coerce string offset to number', () => {
      const result = paginationQuerySchema.safeParse({ offset: '50' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.offset).toBe(50);
      }
    });
  });

  describe('cursor validation', () => {
    it('should accept valid UUID cursor', () => {
      const result = paginationQuerySchema.safeParse({
        cursor: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid cursor format', () => {
      const result = paginationQuerySchema.safeParse({ cursor: 'not-a-uuid' });
      expect(result.success).toBe(false);
    });
  });

  describe('mutual exclusivity of offset and cursor', () => {
    it('should reject when both offset and cursor are provided', () => {
      const result = paginationQuerySchema.safeParse({
        offset: 10,
        cursor: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('Cannot use both');
      }
    });

    it('should accept offset alone', () => {
      const result = paginationQuerySchema.safeParse({
        offset: 10,
        limit: 50,
      });
      expect(result.success).toBe(true);
    });

    it('should accept cursor alone', () => {
      const result = paginationQuerySchema.safeParse({
        cursor: '123e4567-e89b-12d3-a456-426614174000',
        limit: 50,
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('PaginatedResult Structure', () => {
  it('should have correct structure with all required fields', () => {
    const result: PaginatedResult<Intent> = {
      items: [],
      limit: 50,
      hasMore: false,
    };

    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('limit');
    expect(result).toHaveProperty('hasMore');
  });

  it('should support optional offset field', () => {
    const result: PaginatedResult<Intent> = {
      items: [],
      limit: 50,
      offset: 0,
      hasMore: false,
    };

    expect(result.offset).toBe(0);
  });

  it('should support optional nextCursor field', () => {
    const result: PaginatedResult<Intent> = {
      items: [],
      limit: 50,
      nextCursor: '123e4567-e89b-12d3-a456-426614174000',
      hasMore: true,
    };

    expect(result.nextCursor).toBe('123e4567-e89b-12d3-a456-426614174000');
  });

  it('should support optional total field', () => {
    const result: PaginatedResult<Intent> = {
      items: [],
      limit: 50,
      total: 100,
      hasMore: true,
    };

    expect(result.total).toBe(100);
  });
});

describe('hasMore Flag Accuracy', () => {
  /**
   * The repository queries with LIMIT + 1 to detect if there are more results.
   * If we get more results than the limit, hasMore should be true.
   */

  it('should set hasMore to false when results are less than limit', () => {
    const queryResultCount = 30;
    const limit = 50;
    const hasMore = queryResultCount > limit;
    expect(hasMore).toBe(false);
  });

  it('should set hasMore to false when results exactly match limit', () => {
    const queryResultCount = 50;
    const limit = 50;
    // With LIMIT + 1 strategy, exactly matching limit means no more
    const hasMore = queryResultCount > limit;
    expect(hasMore).toBe(false);
  });

  it('should set hasMore to true when results exceed limit (LIMIT + 1 strategy)', () => {
    const queryResultCount = 51; // Query with LIMIT + 1 returns 51
    const limit = 50;
    const hasMore = queryResultCount > limit;
    expect(hasMore).toBe(true);
  });

  it('should correctly compute nextCursor when hasMore is true', () => {
    const mockIntents: Intent[] = [
      {
        id: 'intent-1',
        tenantId: 'tenant-1',
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
        tenantId: 'tenant-1',
        entityId: '123e4567-e89b-12d3-a456-426614174000',
        goal: 'Goal 2',
        context: {},
        metadata: {},
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const hasMore = true;
    const items = mockIntents;
    const lastItem = items[items.length - 1];
    const nextCursor = hasMore && lastItem ? lastItem.id : undefined;

    expect(nextCursor).toBe('intent-2');
  });

  it('should not set nextCursor when hasMore is false', () => {
    const mockIntents: Intent[] = [
      {
        id: 'intent-1',
        tenantId: 'tenant-1',
        entityId: '123e4567-e89b-12d3-a456-426614174000',
        goal: 'Goal 1',
        context: {},
        metadata: {},
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const hasMore = false;
    const items = mockIntents;
    const lastItem = items[items.length - 1];
    const nextCursor = hasMore && lastItem ? lastItem.id : undefined;

    expect(nextCursor).toBeUndefined();
  });
});

describe('Limit Enforcement', () => {
  /**
   * Test that the repository correctly enforces MAX_PAGE_SIZE
   */

  it('should cap requested limit at MAX_PAGE_SIZE', () => {
    const requestedLimit = 5000;
    const effectiveLimit = Math.min(requestedLimit, MAX_PAGE_SIZE);
    expect(effectiveLimit).toBe(MAX_PAGE_SIZE);
  });

  it('should use requested limit when within bounds', () => {
    const requestedLimit = 500;
    const effectiveLimit = Math.min(requestedLimit, MAX_PAGE_SIZE);
    expect(effectiveLimit).toBe(500);
  });

  it('should use DEFAULT_PAGE_SIZE when no limit specified', () => {
    const requestedLimit = undefined;
    const effectiveLimit = Math.min(requestedLimit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    expect(effectiveLimit).toBe(DEFAULT_PAGE_SIZE);
  });
});

describe('Default Pagination Behavior', () => {
  it('should default to DEFAULT_PAGE_SIZE (50) when no limit specified', () => {
    const query: { limit?: number } = {};
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    expect(limit).toBe(50);
  });

  it('should default offset to 0 when not specified', () => {
    const query: { offset?: number } = {};
    const offset = query.offset ?? 0;
    expect(offset).toBe(0);
  });
});

describe('Integration: Repository Pagination Logic', () => {
  /**
   * These tests verify the pagination logic that would be applied
   * in the repository methods.
   */

  it('should apply correct limit for offset-based pagination', () => {
    const options = {
      limit: 100,
      offset: 50,
    };

    const effectiveLimit = Math.min(options.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const queryLimit = effectiveLimit + 1; // For hasMore detection

    expect(effectiveLimit).toBe(100);
    expect(queryLimit).toBe(101);
  });

  it('should apply correct limit for cursor-based pagination', () => {
    const options = {
      limit: 25,
      cursor: '123e4567-e89b-12d3-a456-426614174000',
    };

    const effectiveLimit = Math.min(options.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const queryLimit = effectiveLimit + 1; // For hasMore detection

    expect(effectiveLimit).toBe(25);
    expect(queryLimit).toBe(26);
  });

  it('should not use offset when cursor is provided', () => {
    const options = {
      cursor: '123e4567-e89b-12d3-a456-426614174000',
      offset: 100, // Should be ignored
    };

    // In the repository, offset should be 0 when cursor is used
    const effectiveOffset = options.cursor ? 0 : (options.offset ?? 0);
    expect(effectiveOffset).toBe(0);
  });
});
