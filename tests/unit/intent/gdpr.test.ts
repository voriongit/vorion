/**
 * GDPR Service Tests
 *
 * Comprehensive tests for GDPR-compliant data export and erasure functionality.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  GdprService,
  createGdprService,
  type GdprExportData,
  type GdprExportRequest,
  type GdprErasureResult,
} from '../../../src/intent/gdpr.js';

// Mock dependencies
vi.mock('../../../src/common/config.js', () => ({
  getConfig: vi.fn(() => ({
    intent: {
      softDeleteRetentionDays: 90,
      eventRetentionDays: 365,
    },
    audit: {
      retentionDays: 2555, // 7 years
    },
  })),
}));

const mockRedis = {
  set: vi.fn().mockResolvedValue('OK'),
  get: vi.fn().mockResolvedValue(null),
  del: vi.fn().mockResolvedValue(1),
  ttl: vi.fn().mockResolvedValue(86400),
  duplicate: vi.fn().mockReturnThis(),
};

vi.mock('../../../src/common/redis.js', () => ({
  getRedis: vi.fn(() => mockRedis),
}));

// Mock data stores
let mockIntentStore: Map<string, any>;
let mockEventStore: Map<string, any>;
let mockEscalationStore: Map<string, any>;
let mockAuditStore: Map<string, any>;

// Create a mock db that returns proper arrays for query chains
const createMockDb = () => {
  const getTableResults = (tableName: string) => {
    if (tableName === 'intents') return Array.from(mockIntentStore.values());
    if (tableName === 'intent_events') return Array.from(mockEventStore.values());
    if (tableName === 'escalations') return Array.from(mockEscalationStore.values());
    if (tableName === 'audit_records') return Array.from(mockAuditStore.values());
    return [];
  };

  return {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation((table) => {
        const tableName = table?._?.name || '';
        const createWhereChain = () => {
          const results = getTableResults(tableName);
          const orderByFn = vi.fn().mockImplementation(() => {
            // Make the result "thenable" so await works on it
            const result = Promise.resolve(results);
            (result as any).limit = vi.fn().mockResolvedValue(results);
            return result;
          });
          const whereResult: any = Promise.resolve(results);
          whereResult.orderBy = orderByFn;
          whereResult.limit = vi.fn().mockResolvedValue(results);
          return whereResult;
        };
        return {
          where: vi.fn().mockImplementation(createWhereChain),
          orderBy: vi.fn().mockImplementation(() => {
            const results = getTableResults(tableName);
            const result: any = Promise.resolve(results);
            result.limit = vi.fn().mockResolvedValue(results);
            return result;
          }),
        };
      }),
    })),
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation((updates) => ({
        where: vi.fn().mockImplementation(() => ({
          returning: vi.fn().mockImplementation(async () => {
            const results: any[] = [];
            for (const [id, record] of mockIntentStore.entries()) {
              const updated = { ...record, ...updates, updatedAt: new Date() };
              mockIntentStore.set(id, updated);
              results.push(updated);
            }
            return results;
          }),
        })),
      })),
    })),
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation(() => ({
        returning: vi.fn().mockResolvedValue([]),
      })),
    })),
  };
};

let mockDb: ReturnType<typeof createMockDb>;

vi.mock('../../../src/common/db.js', () => ({
  getDatabase: vi.fn(() => mockDb),
  withLongQueryTimeout: vi.fn((fn) => fn()), // Execute the function directly
  withStatementTimeout: vi.fn((fn) => fn()),
}));

// Mock audit service
const mockAuditService = {
  record: vi.fn().mockResolvedValue({ id: 'audit-1' }),
};

const mockAuditHelper = {
  recordIntentEvent: vi.fn().mockResolvedValue({ id: 'audit-event-1' }),
};

vi.mock('../../../src/audit/index.js', () => ({
  createAuditService: vi.fn(() => mockAuditService),
  createAuditHelper: vi.fn(() => mockAuditHelper),
}));

describe('GdprService', () => {
  let service: GdprService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIntentStore = new Map();
    mockEventStore = new Map();
    mockEscalationStore = new Map();
    mockAuditStore = new Map();
    mockDb = createMockDb();
    service = createGdprService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('exportUserData', () => {
    it('should export all user data with correct structure', async () => {
      const userId = 'user-123';
      const tenantId = 'tenant-456';

      // Set up mock data
      const mockIntent = {
        id: 'intent-1',
        entityId: userId,
        tenantId,
        goal: 'Test goal',
        intentType: 'test-type',
        status: 'completed',
        context: { key: 'value' },
        metadata: { source: 'test' },
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };
      mockIntentStore.set(mockIntent.id, mockIntent);

      const exportData = await service.exportUserData(userId, tenantId);

      expect(exportData).toBeDefined();
      expect(exportData.userId).toBe(userId);
      expect(exportData.tenantId).toBe(tenantId);
      expect(exportData.exportTimestamp).toBeDefined();
      expect(exportData.dataCategories).toContain('intents');
      expect(exportData.dataCategories).toContain('intent_events');
      expect(exportData.dataCategories).toContain('escalations');
      expect(exportData.dataCategories).toContain('audit_records');
    });

    it('should include metadata with GDPR article reference', async () => {
      const userId = 'user-123';
      const tenantId = 'tenant-456';

      const exportData = await service.exportUserData(userId, tenantId);

      expect(exportData.metadata).toBeDefined();
      expect(exportData.metadata.exportVersion).toBe('1.0');
      expect(exportData.metadata.gdprArticle).toBe('Article 15 - Right of Access');
      expect(typeof exportData.metadata.totalRecords).toBe('number');
    });

    it('should include retention periods for all data categories', async () => {
      const userId = 'user-123';
      const tenantId = 'tenant-456';

      const exportData = await service.exportUserData(userId, tenantId);

      expect(exportData.retentionPeriods).toBeDefined();
      expect(exportData.retentionPeriods.intents).toBeDefined();
      expect(exportData.retentionPeriods.intent_events).toBeDefined();
      expect(exportData.retentionPeriods.escalations).toBeDefined();
      expect(exportData.retentionPeriods.audit_records).toBeDefined();
    });

    it('should handle user with no data', async () => {
      const userId = 'user-no-data';
      const tenantId = 'tenant-456';

      const exportData = await service.exportUserData(userId, tenantId);

      expect(exportData.data.intents).toEqual([]);
      expect(exportData.data.events).toEqual([]);
      expect(exportData.data.escalations).toEqual([]);
      expect(exportData.data.auditRecords).toEqual([]);
      expect(exportData.metadata.totalRecords).toBe(0);
    });

    it('should generate unique export IDs', async () => {
      const userId = 'user-123';
      const tenantId = 'tenant-456';

      const export1 = await service.exportUserData(userId, tenantId);
      const export2 = await service.exportUserData(userId, tenantId);

      expect(export1.exportId).not.toBe(export2.exportId);
    });
  });

  describe('createExportRequest', () => {
    it('should create an export request with pending status', async () => {
      const userId = 'user-123';
      const tenantId = 'tenant-456';
      const requestedBy = 'admin-user';

      const request = await service.createExportRequest(userId, tenantId, requestedBy);

      expect(request).toBeDefined();
      expect(request.id).toBeDefined();
      expect(request.userId).toBe(userId);
      expect(request.tenantId).toBe(tenantId);
      expect(request.status).toBe('pending');
      expect(request.requestedAt).toBeDefined();
      expect(request.expiresAt).toBeDefined();
    });

    it('should store request in Redis with TTL', async () => {
      const userId = 'user-123';
      const tenantId = 'tenant-456';
      const requestedBy = 'admin-user';

      await service.createExportRequest(userId, tenantId, requestedBy);

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('gdpr:export:'),
        expect.any(String),
        'EX',
        86400 // 24 hours
      );
    });

    it('should record audit event for export request', async () => {
      const userId = 'user-123';
      const tenantId = 'tenant-456';
      const requestedBy = 'admin-user';

      await service.createExportRequest(userId, tenantId, requestedBy);

      expect(mockAuditHelper.recordIntentEvent).toHaveBeenCalledWith(
        tenantId,
        'data.exported',
        expect.any(String),
        { type: 'user', id: requestedBy },
        expect.objectContaining({
          outcome: 'success',
          metadata: expect.objectContaining({
            gdprAction: 'export_request_created',
            targetUserId: userId,
          }),
        })
      );
    });

    it('should set expiration 24 hours in the future', async () => {
      const userId = 'user-123';
      const tenantId = 'tenant-456';
      const requestedBy = 'admin-user';

      const request = await service.createExportRequest(userId, tenantId, requestedBy);

      const requestedAt = new Date(request.requestedAt);
      const expiresAt = new Date(request.expiresAt!);
      const diffMs = expiresAt.getTime() - requestedAt.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      expect(diffHours).toBeCloseTo(24, 0);
    });
  });

  describe('getExportRequest', () => {
    it('should return null for non-existent request', async () => {
      const requestId = 'non-existent';
      const tenantId = 'tenant-456';

      const result = await service.getExportRequest(requestId, tenantId);

      expect(result).toBeNull();
    });

    it('should return null for wrong tenant', async () => {
      const requestId = 'request-123';
      const correctTenantId = 'tenant-456';
      const wrongTenantId = 'tenant-789';

      // Store a request
      const mockRequest: GdprExportRequest = {
        id: requestId,
        userId: 'user-123',
        tenantId: correctTenantId,
        status: 'completed',
        requestedAt: new Date().toISOString(),
      };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(mockRequest));

      const result = await service.getExportRequest(requestId, wrongTenantId);

      expect(result).toBeNull();
    });

    it('should mark expired requests as expired', async () => {
      const requestId = 'request-123';
      const tenantId = 'tenant-456';

      // Store an expired request
      const expiredRequest: GdprExportRequest = {
        id: requestId,
        userId: 'user-123',
        tenantId,
        status: 'completed',
        requestedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(expiredRequest));

      const result = await service.getExportRequest(requestId, tenantId);

      expect(result?.status).toBe('expired');
    });

    it('should return valid request with correct tenant', async () => {
      const requestId = 'request-123';
      const tenantId = 'tenant-456';

      const validRequest: GdprExportRequest = {
        id: requestId,
        userId: 'user-123',
        tenantId,
        status: 'processing',
        requestedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(validRequest));

      const result = await service.getExportRequest(requestId, tenantId);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(requestId);
      expect(result?.status).toBe('processing');
    });
  });

  describe('updateExportRequest', () => {
    it('should return null for non-existent request', async () => {
      const requestId = 'non-existent';

      const result = await service.updateExportRequest(requestId, { status: 'completed' });

      expect(result).toBeNull();
    });

    it('should update request fields', async () => {
      const requestId = 'request-123';
      const originalRequest: GdprExportRequest = {
        id: requestId,
        userId: 'user-123',
        tenantId: 'tenant-456',
        status: 'pending',
        requestedAt: new Date().toISOString(),
      };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(originalRequest));
      mockRedis.ttl.mockResolvedValueOnce(3600);

      const result = await service.updateExportRequest(requestId, {
        status: 'completed',
        completedAt: new Date().toISOString(),
      });

      expect(result?.status).toBe('completed');
      expect(result?.completedAt).toBeDefined();
    });
  });

  describe('eraseUserData', () => {
    it('should soft delete all user intents', async () => {
      const userId = 'user-123';
      const tenantId = 'tenant-456';
      const erasedBy = 'admin-user';

      // Set up mock data
      const mockIntent = {
        id: 'intent-1',
        entityId: userId,
        tenantId,
        goal: 'Original goal',
        status: 'completed',
      };
      mockIntentStore.set(mockIntent.id, mockIntent);

      const result = await service.eraseUserData(userId, tenantId, erasedBy);

      expect(result).toBeDefined();
      expect(result.userId).toBe(userId);
      expect(result.tenantId).toBe(tenantId);
      expect(result.erasedAt).toBeDefined();
    });

    it('should record audit event for erasure', async () => {
      const userId = 'user-123';
      const tenantId = 'tenant-456';
      const erasedBy = 'admin-user';

      await service.eraseUserData(userId, tenantId, erasedBy);

      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          eventType: 'data.deleted',
          actor: { type: 'user', id: erasedBy },
          target: { type: 'user', id: userId },
          action: 'gdpr_erasure',
          outcome: 'success',
          metadata: expect.objectContaining({
            gdprArticle: 'Article 17 - Right to Erasure',
          }),
        })
      );
    });

    it('should return counts of erased records', async () => {
      const userId = 'user-123';
      const tenantId = 'tenant-456';
      const erasedBy = 'admin-user';

      const result = await service.eraseUserData(userId, tenantId, erasedBy);

      expect(result.counts).toBeDefined();
      expect(typeof result.counts.intents).toBe('number');
      expect(typeof result.counts.events).toBe('number');
      expect(typeof result.counts.escalations).toBe('number');
    });

    it('should handle user with no data gracefully', async () => {
      const userId = 'user-no-data';
      const tenantId = 'tenant-456';
      const erasedBy = 'admin-user';

      const result = await service.eraseUserData(userId, tenantId, erasedBy);

      expect(result.counts.intents).toBe(0);
      expect(result.counts.events).toBe(0);
      expect(result.counts.escalations).toBe(0);
    });
  });

  describe('storeExportData', () => {
    it('should store export data and return download URL', async () => {
      const requestId = 'request-123';
      const exportData: GdprExportData = {
        exportId: 'export-1',
        userId: 'user-123',
        tenantId: 'tenant-456',
        exportTimestamp: new Date().toISOString(),
        dataCategories: ['intents'],
        retentionPeriods: { intents: '90 days' },
        data: {
          intents: [],
          events: [],
          escalations: [],
          auditRecords: [],
        },
        metadata: {
          totalRecords: 0,
          exportVersion: '1.0',
          gdprArticle: 'Article 15',
        },
      };

      // Mock getExportRequest for updateExportRequest
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({
        id: requestId,
        userId: 'user-123',
        tenantId: 'tenant-456',
        status: 'processing',
        requestedAt: new Date().toISOString(),
      }));
      mockRedis.ttl.mockResolvedValueOnce(3600);

      const downloadUrl = await service.storeExportData(requestId, exportData);

      expect(downloadUrl).toBe(`/api/v1/intent/gdpr/export/${requestId}/download`);
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining(`gdpr:export:data:${requestId}`),
        expect.any(String),
        'EX',
        86400
      );
    });
  });

  describe('getExportData', () => {
    it('should return null for non-existent data', async () => {
      const requestId = 'non-existent';
      const tenantId = 'tenant-456';

      const result = await service.getExportData(requestId, tenantId);

      expect(result).toBeNull();
    });

    it('should return null for non-completed request', async () => {
      const requestId = 'request-123';
      const tenantId = 'tenant-456';

      const pendingRequest: GdprExportRequest = {
        id: requestId,
        userId: 'user-123',
        tenantId,
        status: 'pending',
        requestedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(pendingRequest));

      const result = await service.getExportData(requestId, tenantId);

      expect(result).toBeNull();
    });

    it('should return data for completed request', async () => {
      const requestId = 'request-123';
      const tenantId = 'tenant-456';

      const completedRequest: GdprExportRequest = {
        id: requestId,
        userId: 'user-123',
        tenantId,
        status: 'completed',
        requestedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      const exportData: GdprExportData = {
        exportId: 'export-1',
        userId: 'user-123',
        tenantId,
        exportTimestamp: new Date().toISOString(),
        dataCategories: ['intents'],
        retentionPeriods: { intents: '90 days' },
        data: {
          intents: [],
          events: [],
          escalations: [],
          auditRecords: [],
        },
        metadata: {
          totalRecords: 0,
          exportVersion: '1.0',
          gdprArticle: 'Article 15',
        },
      };

      // First call for getExportRequest
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(completedRequest));
      // Second call for export data
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(exportData));

      const result = await service.getExportData(requestId, tenantId);

      expect(result).not.toBeNull();
      expect(result?.userId).toBe('user-123');
    });
  });
});

describe('GdprExportData type', () => {
  it('should have required fields', () => {
    const exportData: GdprExportData = {
      exportId: 'export-123',
      userId: 'user-123',
      tenantId: 'tenant-456',
      exportTimestamp: new Date().toISOString(),
      dataCategories: ['intents', 'events', 'escalations', 'audit_records'],
      retentionPeriods: {
        intents: '90 days',
        events: '365 days',
        escalations: 'With intent',
        audit_records: '7 years',
      },
      data: {
        intents: [],
        events: [],
        escalations: [],
        auditRecords: [],
      },
      metadata: {
        totalRecords: 0,
        exportVersion: '1.0',
        gdprArticle: 'Article 15 - Right of Access',
      },
    };

    expect(exportData.exportId).toBe('export-123');
    expect(exportData.dataCategories).toHaveLength(4);
    expect(exportData.metadata.gdprArticle).toContain('Article 15');
  });
});

describe('GdprExportRequest type', () => {
  it('should have required fields', () => {
    const request: GdprExportRequest = {
      id: 'request-123',
      userId: 'user-123',
      tenantId: 'tenant-456',
      status: 'pending',
      requestedAt: new Date().toISOString(),
    };

    expect(request.id).toBe('request-123');
    expect(request.status).toBe('pending');
  });

  it('should allow optional fields', () => {
    const request: GdprExportRequest = {
      id: 'request-123',
      userId: 'user-123',
      tenantId: 'tenant-456',
      status: 'completed',
      requestedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
      downloadUrl: '/api/v1/intent/gdpr/export/request-123/download',
      metadata: { requestedBy: 'admin' },
    };

    expect(request.completedAt).toBeDefined();
    expect(request.downloadUrl).toBeDefined();
    expect(request.metadata?.requestedBy).toBe('admin');
  });
});

describe('GdprErasureResult type', () => {
  it('should have required fields', () => {
    const result: GdprErasureResult = {
      userId: 'user-123',
      tenantId: 'tenant-456',
      erasedAt: new Date().toISOString(),
      counts: {
        intents: 5,
        events: 25,
        escalations: 2,
      },
    };

    expect(result.userId).toBe('user-123');
    expect(result.counts.intents).toBe(5);
    expect(result.counts.events).toBe(25);
    expect(result.counts.escalations).toBe(2);
  });
});

describe('GdprExportStatus', () => {
  it('should support all status values', () => {
    const statuses: GdprExportRequest['status'][] = [
      'pending',
      'processing',
      'completed',
      'failed',
      'expired',
    ];

    statuses.forEach((status) => {
      const request: GdprExportRequest = {
        id: 'request-123',
        userId: 'user-123',
        tenantId: 'tenant-456',
        status,
        requestedAt: new Date().toISOString(),
      };
      expect(request.status).toBe(status);
    });
  });
});

describe('createGdprService', () => {
  it('should create a new GdprService instance', () => {
    const service = createGdprService();

    expect(service).toBeInstanceOf(GdprService);
    expect(typeof service.exportUserData).toBe('function');
    expect(typeof service.createExportRequest).toBe('function');
    expect(typeof service.getExportRequest).toBe('function');
    expect(typeof service.eraseUserData).toBe('function');
  });
});
