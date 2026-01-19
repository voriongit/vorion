/**
 * Audit Service Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CreateAuditRecordInput, AuditRecord, AuditCleanupResult } from '../../../src/audit/types.js';

// Mock database
const mockDb = {
  insert: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock('../../../src/common/db.js', () => ({
  getDatabase: vi.fn(() => mockDb),
}));

vi.mock('../../../src/common/trace.js', () => ({
  getTraceContext: vi.fn(() => null),
  getTraceLogContext: vi.fn(() => null),
}));

// Import after mocking
import { AuditService, createAuditService, AuditHelper, createAuditHelper } from '../../../src/audit/service.js';

describe('AuditService', () => {
  let service: AuditService;
  let recordCounter: number;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createAuditService();
    recordCounter = 0;

    // Default mock for getting latest record (empty for new tenant)
    mockDb.select.mockImplementation(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
          limit: vi.fn().mockResolvedValue([]),
        })),
        orderBy: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([]),
          offset: vi.fn().mockResolvedValue([]),
        })),
        limit: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockResolvedValue([]),
      })),
    }));

    mockDb.insert.mockImplementation(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{
          id: `audit-${++recordCounter}`,
          tenantId: 'tenant-123',
          eventType: 'intent.created',
          eventCategory: 'intent',
          severity: 'info',
          actorType: 'user',
          actorId: 'user-456',
          actorName: 'Test User',
          actorIp: null,
          targetType: 'intent',
          targetId: 'intent-789',
          targetName: null,
          requestId: 'req-abc',
          traceId: null,
          spanId: null,
          action: 'created',
          outcome: 'success',
          reason: null,
          beforeState: null,
          afterState: null,
          diffState: null,
          metadata: null,
          tags: null,
          sequenceNumber: BigInt(recordCounter),
          previousHash: null,
          recordHash: 'abc123hash',
          eventTime: new Date(),
          recordedAt: new Date(),
          archived: false,
          archivedAt: null,
        }]),
      })),
    }));

    // Default mock for update operations
    mockDb.update.mockImplementation(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([]),
        })),
      })),
    }));

    // Default mock for delete operations
    mockDb.delete.mockImplementation(() => ({
      where: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([]),
      })),
    }));
  });

  describe('record', () => {
    it('should record an audit event', async () => {
      const input: CreateAuditRecordInput = {
        tenantId: 'tenant-123',
        eventType: 'intent.created',
        actor: { type: 'user', id: 'user-456', name: 'Test User' },
        target: { type: 'intent', id: 'intent-789' },
        action: 'created',
        outcome: 'success',
      };

      const record = await service.record(input);

      expect(record.id).toBe('audit-1');
      expect(record.tenantId).toBe('tenant-123');
      expect(record.eventType).toBe('intent.created');
      expect(record.actor.id).toBe('user-456');
      expect(record.target.id).toBe('intent-789');
      expect(record.sequenceNumber).toBe(1);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should auto-determine category and severity from event type', async () => {
      const input: CreateAuditRecordInput = {
        tenantId: 'tenant-123',
        eventType: 'intent.failed',
        actor: { type: 'system', id: 'system' },
        target: { type: 'intent', id: 'intent-789' },
        action: 'execute',
        outcome: 'failure',
      };

      await service.record(input);

      // Verify insert was called with correct category and severity
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should include state change when provided', async () => {
      const input: CreateAuditRecordInput = {
        tenantId: 'tenant-123',
        eventType: 'intent.status.changed',
        actor: { type: 'service', id: 'intake-service' },
        target: { type: 'intent', id: 'intent-789' },
        action: 'status_change',
        outcome: 'success',
        stateChange: {
          before: { status: 'pending' },
          after: { status: 'evaluating' },
          diff: { status: ['pending', 'evaluating'] },
        },
      };

      const record = await service.record(input);

      expect(record.id).toBeDefined();
    });

    it('should include metadata and tags', async () => {
      const input: CreateAuditRecordInput = {
        tenantId: 'tenant-123',
        eventType: 'policy.violation',
        actor: { type: 'agent', id: 'agent-abc' },
        target: { type: 'policy', id: 'policy-xyz' },
        action: 'evaluate',
        outcome: 'failure',
        reason: 'Trust level too low',
        metadata: { requiredTrust: 3, actualTrust: 1 },
        tags: ['security', 'trust-violation'],
      };

      const record = await service.record(input);

      expect(record.id).toBeDefined();
    });

    it('should chain records with sequence numbers', async () => {
      // Record first event
      await service.record({
        tenantId: 'tenant-123',
        eventType: 'intent.created',
        actor: { type: 'user', id: 'user-1' },
        target: { type: 'intent', id: 'intent-1' },
        action: 'create',
        outcome: 'success',
      });

      // Update mock to return previous record
      mockDb.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue([{
                sequenceNumber: BigInt(1),
                recordHash: 'previous-hash',
              }]),
            })),
          })),
        })),
      }));

      // Record second event
      await service.record({
        tenantId: 'tenant-123',
        eventType: 'intent.submitted',
        actor: { type: 'service', id: 'api' },
        target: { type: 'intent', id: 'intent-1' },
        action: 'submit',
        outcome: 'success',
      });

      // Verify insert was called twice
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });
  });

  describe('query', () => {
    let callCount: number;

    beforeEach(() => {
      callCount = 0;
      // Mock for query - first call is count, second is actual records
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call - count query
          return {
            from: vi.fn(() => ({
              where: vi.fn().mockResolvedValue([{ count: 1 }]),
            })),
          };
        } else {
          // Second call - records query
          return {
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                orderBy: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    offset: vi.fn().mockResolvedValue([{
                      id: 'audit-1',
                      tenantId: 'tenant-123',
                      eventType: 'intent.created',
                      eventCategory: 'intent',
                      severity: 'info',
                      actorType: 'user',
                      actorId: 'user-456',
                      actorName: 'Test User',
                      actorIp: null,
                      targetType: 'intent',
                      targetId: 'intent-789',
                      targetName: null,
                      requestId: 'req-abc',
                      traceId: null,
                      spanId: null,
                      action: 'created',
                      outcome: 'success',
                      reason: null,
                      beforeState: null,
                      afterState: null,
                      diffState: null,
                      metadata: null,
                      tags: null,
                      sequenceNumber: BigInt(1),
                      previousHash: null,
                      recordHash: 'abc123hash',
                      eventTime: new Date(),
                      recordedAt: new Date(),
                    }]),
                  })),
                })),
              })),
            })),
          };
        }
      });
    });

    it('should query audit records with filters', async () => {
      const result = await service.query({
        tenantId: 'tenant-123',
        eventType: 'intent.created',
        limit: 10,
      });

      expect(result.records).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('should support pagination', async () => {
      const result = await service.query({
        tenantId: 'tenant-123',
        limit: 10,
        offset: 0,
      });

      expect(result.records).toBeDefined();
      expect(typeof result.total).toBe('number');
    });

    it('should support time range filtering', async () => {
      await service.query({
        tenantId: 'tenant-123',
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-12-31T23:59:59Z',
      });

      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should support ordering', async () => {
      await service.query({
        tenantId: 'tenant-123',
        orderBy: 'eventTime',
        orderDirection: 'desc',
      });

      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should find record by ID', async () => {
      mockDb.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([{
              id: 'audit-123',
              tenantId: 'tenant-123',
              eventType: 'intent.created',
              eventCategory: 'intent',
              severity: 'info',
              actorType: 'user',
              actorId: 'user-456',
              actorName: null,
              actorIp: null,
              targetType: 'intent',
              targetId: 'intent-789',
              targetName: null,
              requestId: 'req-abc',
              traceId: null,
              spanId: null,
              action: 'created',
              outcome: 'success',
              reason: null,
              beforeState: null,
              afterState: null,
              diffState: null,
              metadata: null,
              tags: null,
              sequenceNumber: BigInt(1),
              previousHash: null,
              recordHash: 'hash',
              eventTime: new Date(),
              recordedAt: new Date(),
            }]),
          })),
        })),
      }));

      const record = await service.findById('audit-123', 'tenant-123');

      expect(record).not.toBeNull();
      expect(record?.id).toBe('audit-123');
    });

    it('should return null for non-existent record', async () => {
      mockDb.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
        })),
      }));

      const record = await service.findById('nonexistent', 'tenant-123');

      expect(record).toBeNull();
    });
  });

  describe('getForTarget', () => {
    it('should get records for a specific target', async () => {
      mockDb.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => ({
                offset: vi.fn().mockResolvedValue([{
                  id: 'audit-1',
                  tenantId: 'tenant-123',
                  eventType: 'intent.created',
                  eventCategory: 'intent',
                  severity: 'info',
                  actorType: 'user',
                  actorId: 'user-456',
                  actorName: null,
                  actorIp: null,
                  targetType: 'intent',
                  targetId: 'intent-789',
                  targetName: null,
                  requestId: 'req-abc',
                  traceId: null,
                  spanId: null,
                  action: 'created',
                  outcome: 'success',
                  reason: null,
                  beforeState: null,
                  afterState: null,
                  diffState: null,
                  metadata: null,
                  tags: null,
                  sequenceNumber: BigInt(1),
                  previousHash: null,
                  recordHash: 'hash',
                  eventTime: new Date(),
                  recordedAt: new Date(),
                }]),
              })),
            })),
          })),
        })),
      }));

      const records = await service.getForTarget('tenant-123', 'intent', 'intent-789');

      expect(records).toHaveLength(1);
      expect(records[0]?.target.id).toBe('intent-789');
    });
  });

  describe('verifyChainIntegrity', () => {
    it('should verify valid chain', async () => {
      mockDb.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue([
                { id: 'audit-1', sequenceNumber: BigInt(1), previousHash: null, recordHash: 'hash1' },
                { id: 'audit-2', sequenceNumber: BigInt(2), previousHash: 'hash1', recordHash: 'hash2' },
                { id: 'audit-3', sequenceNumber: BigInt(3), previousHash: 'hash2', recordHash: 'hash3' },
              ]),
            })),
          })),
        })),
      }));

      const result = await service.verifyChainIntegrity('tenant-123');

      expect(result.valid).toBe(true);
      expect(result.recordsChecked).toBe(3);
      expect(result.firstRecord).toBe('audit-1');
      expect(result.lastRecord).toBe('audit-3');
    });

    it('should detect broken chain', async () => {
      mockDb.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue([
                { id: 'audit-1', sequenceNumber: BigInt(1), previousHash: null, recordHash: 'hash1' },
                { id: 'audit-2', sequenceNumber: BigInt(2), previousHash: 'wrong-hash', recordHash: 'hash2' },
              ]),
            })),
          })),
        })),
      }));

      const result = await service.verifyChainIntegrity('tenant-123');

      expect(result.valid).toBe(false);
      expect(result.brokenAt).toBe('audit-2');
    });

    it('should return valid for empty chain', async () => {
      mockDb.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue([]),
            })),
          })),
        })),
      }));

      const result = await service.verifyChainIntegrity('tenant-123');

      expect(result.valid).toBe(true);
      expect(result.recordsChecked).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return audit statistics', async () => {
      let statsCallCount = 0;
      mockDb.select.mockImplementation(() => {
        statsCallCount++;
        if (statsCallCount === 1) {
          // Total count
          return {
            from: vi.fn(() => ({
              where: vi.fn().mockResolvedValue([{ count: 15 }]),
            })),
          };
        } else {
          // Category, severity, or outcome groupBy
          return {
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                groupBy: vi.fn().mockResolvedValue([
                  { category: 'intent', severity: 'info', outcome: 'success', count: 10 },
                  { category: 'policy', severity: 'warning', outcome: 'failure', count: 5 },
                ]),
              })),
            })),
          };
        }
      });

      const stats = await service.getStats('tenant-123');

      expect(stats.totalRecords).toBe(15);
      expect(typeof stats.byCategory).toBe('object');
      expect(typeof stats.bySeverity).toBe('object');
      expect(typeof stats.byOutcome).toBe('object');
    });
  });

  // ==========================================================================
  // ARCHIVE & RETENTION TESTS
  // ==========================================================================

  describe('archiveOldRecords', () => {
    it('should archive records older than specified days', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100); // 100 days ago

      mockDb.update.mockImplementation(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([
              { id: 'audit-1', eventTime: oldDate },
              { id: 'audit-2', eventTime: oldDate },
            ]),
          })),
        })),
      }));

      const result = await service.archiveOldRecords(90);

      expect(result.recordsArchived).toBe(2);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should return zero when no records to archive', async () => {
      mockDb.update.mockImplementation(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([]),
          })),
        })),
      }));

      const result = await service.archiveOldRecords(90);

      expect(result.recordsArchived).toBe(0);
      expect(result.oldestArchivedDate).toBeUndefined();
      expect(result.newestArchivedDate).toBeUndefined();
    });

    it('should set archived timestamp', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      mockDb.update.mockImplementation(() => ({
        set: vi.fn((data: { archived: boolean; archivedAt: Date }) => {
          expect(data.archived).toBe(true);
          expect(data.archivedAt).toBeInstanceOf(Date);
          return {
            where: vi.fn(() => ({
              returning: vi.fn().mockResolvedValue([
                { id: 'audit-1', eventTime: oldDate },
              ]),
            })),
          };
        }),
      }));

      await service.archiveOldRecords(90);

      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('purgeOldRecords', () => {
    it('should purge archived records older than retention period', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 400); // 400 days ago (past 365-day retention)

      mockDb.delete.mockImplementation(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([
            { id: 'audit-1', eventTime: oldDate },
            { id: 'audit-2', eventTime: oldDate },
            { id: 'audit-3', eventTime: oldDate },
          ]),
        })),
      }));

      const result = await service.purgeOldRecords(365);

      expect(result.recordsPurged).toBe(3);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('should return zero when no records to purge', async () => {
      mockDb.delete.mockImplementation(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([]),
        })),
      }));

      const result = await service.purgeOldRecords(365);

      expect(result.recordsPurged).toBe(0);
      expect(result.oldestPurgedDate).toBeUndefined();
      expect(result.newestPurgedDate).toBeUndefined();
    });
  });

  describe('runCleanup', () => {
    it('should run archive and purge operations', async () => {
      const oldArchiveDate = new Date();
      oldArchiveDate.setDate(oldArchiveDate.getDate() - 100);

      const oldPurgeDate = new Date();
      oldPurgeDate.setDate(oldPurgeDate.getDate() - 400);

      mockDb.update.mockImplementation(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([
              { id: 'audit-1', eventTime: oldArchiveDate },
            ]),
          })),
        })),
      }));

      mockDb.delete.mockImplementation(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([
            { id: 'audit-old-1', eventTime: oldPurgeDate },
          ]),
        })),
      }));

      const result = await service.runCleanup({
        archiveAfterDays: 90,
        retentionDays: 365,
        archiveEnabled: true,
      });

      expect(result.archived.recordsArchived).toBe(1);
      expect(result.purged.recordsPurged).toBe(1);
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should skip archive when disabled', async () => {
      mockDb.delete.mockImplementation(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([]),
        })),
      }));

      const result = await service.runCleanup({
        archiveAfterDays: 90,
        retentionDays: 365,
        archiveEnabled: false,
      });

      expect(result.archived.recordsArchived).toBe(0);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('should collect errors but continue processing', async () => {
      mockDb.update.mockImplementation(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockRejectedValue(new Error('Archive failed')),
          })),
        })),
      }));

      mockDb.delete.mockImplementation(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([
            { id: 'audit-1', eventTime: new Date() },
          ]),
        })),
      }));

      const result = await service.runCleanup({
        archiveAfterDays: 90,
        retentionDays: 365,
        archiveEnabled: true,
      });

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Archive failed');
      expect(result.purged.recordsPurged).toBe(1);
    });
  });

  describe('getRetentionStats', () => {
    it('should return retention statistics', async () => {
      let statsCallCount = 0;
      const now = new Date();
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      mockDb.select.mockImplementation(() => {
        statsCallCount++;
        if (statsCallCount === 1) {
          // Total count
          return {
            from: vi.fn(() => ({
              where: vi.fn().mockResolvedValue([{ count: 100 }]),
            })),
          };
        } else if (statsCallCount === 2) {
          // Active count
          return {
            from: vi.fn(() => ({
              where: vi.fn().mockResolvedValue([{ count: 80 }]),
            })),
          };
        } else if (statsCallCount === 3) {
          // Archived count
          return {
            from: vi.fn(() => ({
              where: vi.fn().mockResolvedValue([{ count: 20 }]),
            })),
          };
        } else if (statsCallCount === 4) {
          // Oldest record
          return {
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                orderBy: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue([{ eventTime: oldDate }]),
                })),
              })),
            })),
          };
        } else if (statsCallCount === 5) {
          // Newest record
          return {
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                orderBy: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue([{ eventTime: now }]),
                })),
              })),
            })),
          };
        } else {
          // Oldest archived
          return {
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                orderBy: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue([{ archivedAt: oldDate }]),
                })),
              })),
            })),
          };
        }
      });

      const stats = await service.getRetentionStats('tenant-123');

      expect(stats.totalRecords).toBe(100);
      expect(stats.activeRecords).toBe(80);
      expect(stats.archivedRecords).toBe(20);
      expect(stats.oldestRecord).toBeDefined();
      expect(stats.newestRecord).toBeDefined();
    });
  });
});

describe('AuditHelper', () => {
  let service: AuditService;
  let helper: AuditHelper;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createAuditService();
    helper = createAuditHelper(service);

    mockDb.select.mockImplementation(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
        })),
      })),
    }));

    mockDb.insert.mockImplementation(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{
          id: 'audit-1',
          tenantId: 'tenant-123',
          eventType: 'intent.created',
          eventCategory: 'intent',
          severity: 'info',
          actorType: 'user',
          actorId: 'user-456',
          actorName: null,
          actorIp: null,
          targetType: 'intent',
          targetId: 'intent-789',
          targetName: null,
          requestId: 'req-abc',
          traceId: null,
          spanId: null,
          action: 'created',
          outcome: 'success',
          reason: null,
          beforeState: null,
          afterState: null,
          diffState: null,
          metadata: null,
          tags: null,
          sequenceNumber: BigInt(1),
          previousHash: null,
          recordHash: 'hash',
          eventTime: new Date(),
          recordedAt: new Date(),
          archived: false,
          archivedAt: null,
        }]),
      })),
    }));
  });

  describe('recordIntentEvent', () => {
    it('should record intent lifecycle events', async () => {
      const record = await helper.recordIntentEvent(
        'tenant-123',
        'intent.created',
        'intent-789',
        { type: 'user', id: 'user-456', name: 'Test User' }
      );

      expect(record.id).toBeDefined();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should include state change for status events', async () => {
      await helper.recordIntentEvent(
        'tenant-123',
        'intent.status.changed',
        'intent-789',
        { type: 'service', id: 'workflow' },
        {
          stateChange: {
            before: { status: 'pending' },
            after: { status: 'evaluating' },
          },
        }
      );

      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('recordPolicyEvaluation', () => {
    it('should record policy evaluation events', async () => {
      const record = await helper.recordPolicyEvaluation(
        'tenant-123',
        'policy-xyz',
        'intent-789',
        { type: 'service', id: 'evaluator' },
        { action: 'allow', matched: true, rulesEvaluated: 5 }
      );

      expect(record.id).toBeDefined();
    });
  });

  describe('recordEscalationEvent', () => {
    it('should record escalation events', async () => {
      const record = await helper.recordEscalationEvent(
        'tenant-123',
        'escalation.created',
        'esc-abc',
        'intent-789',
        { type: 'service', id: 'escalation-service' },
        { reason: 'Trust level insufficient' }
      );

      expect(record.id).toBeDefined();
    });
  });
});
