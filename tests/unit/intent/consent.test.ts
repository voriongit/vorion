/**
 * Consent Management Tests
 *
 * Comprehensive tests for GDPR/SOC2 compliant consent management.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import {
  ConsentService,
  ConsentRequiredError,
  ConsentPolicyNotFoundError,
  type ConsentType,
  type UserConsent,
  type ConsentPolicy,
} from '../../../src/intent/consent.js';
import { IntentService, type IntentSubmission } from '../../../src/intent/index.js';
import type { Intent } from '../../../src/common/types.js';

// =============================================================================
// MOCKS
// =============================================================================

vi.mock('../../../src/common/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../../../src/common/config.js', () => ({
  getConfig: vi.fn(() => ({
    intent: {
      defaultNamespace: 'default',
      namespaceRouting: {},
      dedupeTtlSeconds: 600,
      sensitivePaths: [],
      defaultMaxInFlight: 1000,
      tenantMaxInFlight: {},
      trustGates: {},
      defaultMinTrustLevel: 0,
      encryptContext: false,
    },
  })),
}));

vi.mock('../../../src/common/redis.js', () => ({
  getRedis: vi.fn(() => ({
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    duplicate: vi.fn().mockReturnThis(),
    eval: vi.fn().mockResolvedValue(1),
  })),
}));

vi.mock('../../../src/intent/queues.js', () => ({
  enqueueIntentSubmission: vi.fn().mockResolvedValue(undefined),
}));

// Mock database for ConsentService constructor
vi.mock('../../../src/common/db.js', () => ({
  getDatabase: vi.fn(() => ({
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
          orderBy: vi.fn().mockResolvedValue([]),
        }),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  })),
  checkDatabaseHealth: vi.fn().mockResolvedValue({ ok: true }),
}));

// =============================================================================
// CONSENT SERVICE UNIT TESTS (with mocked repository)
// =============================================================================

describe('ConsentService - Unit Tests', () => {
  // Create a mock consent service with stubbed database calls
  const createMockConsentService = () => {
    const service = {
      grantConsent: vi.fn(),
      revokeConsent: vi.fn(),
      getConsents: vi.fn(),
      getActiveConsents: vi.fn(),
      hasValidConsent: vi.fn(),
      validateConsent: vi.fn(),
      requireConsent: vi.fn(),
      getConsentHistory: vi.fn(),
      createPolicy: vi.fn(),
      getCurrentPolicy: vi.fn(),
      getPolicy: vi.fn(),
      getPolicyHistory: vi.fn(),
    };
    return service;
  };

  describe('grantConsent', () => {
    it('should grant consent and return consent record', async () => {
      const mockService = createMockConsentService();
      const now = new Date().toISOString();

      const expectedConsent: UserConsent = {
        id: 'consent-123',
        userId: 'user-456',
        tenantId: 'tenant-789',
        consentType: 'data_processing',
        granted: true,
        grantedAt: now,
        revokedAt: null,
        version: '1.0',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        createdAt: now,
        updatedAt: now,
      };

      mockService.grantConsent.mockResolvedValue(expectedConsent);

      const consent = await mockService.grantConsent(
        'user-456',
        'tenant-789',
        'data_processing',
        '1.0',
        { ipAddress: '192.168.1.1', userAgent: 'Mozilla/5.0' }
      );

      expect(consent.id).toBe('consent-123');
      expect(consent.userId).toBe('user-456');
      expect(consent.tenantId).toBe('tenant-789');
      expect(consent.consentType).toBe('data_processing');
      expect(consent.granted).toBe(true);
      expect(consent.version).toBe('1.0');
      expect(consent.ipAddress).toBe('192.168.1.1');
      expect(mockService.grantConsent).toHaveBeenCalledWith(
        'user-456',
        'tenant-789',
        'data_processing',
        '1.0',
        { ipAddress: '192.168.1.1', userAgent: 'Mozilla/5.0' }
      );
    });
  });

  describe('revokeConsent', () => {
    it('should revoke an active consent', async () => {
      const mockService = createMockConsentService();
      const now = new Date().toISOString();

      const revokedConsent: UserConsent = {
        id: 'consent-123',
        userId: 'user-456',
        tenantId: 'tenant-789',
        consentType: 'data_processing',
        granted: false,
        grantedAt: now,
        revokedAt: now,
        version: '1.0',
        ipAddress: null,
        userAgent: null,
        createdAt: now,
        updatedAt: now,
      };

      mockService.revokeConsent.mockResolvedValue(revokedConsent);

      const consent = await mockService.revokeConsent(
        'user-456',
        'tenant-789',
        'data_processing'
      );

      expect(consent).not.toBeNull();
      expect(consent!.granted).toBe(false);
      expect(consent!.revokedAt).not.toBeNull();
    });

    it('should return null if no active consent to revoke', async () => {
      const mockService = createMockConsentService();
      mockService.revokeConsent.mockResolvedValue(null);

      const consent = await mockService.revokeConsent(
        'user-456',
        'tenant-789',
        'data_processing'
      );

      expect(consent).toBeNull();
    });
  });

  describe('getConsents', () => {
    it('should return all consents for a user', async () => {
      const mockService = createMockConsentService();
      const now = new Date().toISOString();

      const consents: UserConsent[] = [
        {
          id: 'consent-1',
          userId: 'user-456',
          tenantId: 'tenant-789',
          consentType: 'data_processing',
          granted: true,
          grantedAt: now,
          revokedAt: null,
          version: '1.0',
          ipAddress: null,
          userAgent: null,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'consent-2',
          userId: 'user-456',
          tenantId: 'tenant-789',
          consentType: 'analytics',
          granted: false,
          grantedAt: now,
          revokedAt: now,
          version: '1.0',
          ipAddress: null,
          userAgent: null,
          createdAt: now,
          updatedAt: now,
        },
      ];

      mockService.getConsents.mockResolvedValue(consents);

      const result = await mockService.getConsents('user-456', 'tenant-789');

      expect(result).toHaveLength(2);
      expect(result[0]!.consentType).toBe('data_processing');
      expect(result[1]!.consentType).toBe('analytics');
    });
  });

  describe('hasValidConsent', () => {
    it('should return true if valid consent exists', async () => {
      const mockService = createMockConsentService();
      mockService.hasValidConsent.mockResolvedValue(true);

      const hasConsent = await mockService.hasValidConsent(
        'user-456',
        'tenant-789',
        'data_processing'
      );

      expect(hasConsent).toBe(true);
    });

    it('should return false if no valid consent exists', async () => {
      const mockService = createMockConsentService();
      mockService.hasValidConsent.mockResolvedValue(false);

      const hasConsent = await mockService.hasValidConsent(
        'user-456',
        'tenant-789',
        'data_processing'
      );

      expect(hasConsent).toBe(false);
    });
  });

  describe('validateConsent', () => {
    it('should return valid result with details if consent exists', async () => {
      const mockService = createMockConsentService();
      const now = new Date().toISOString();

      mockService.validateConsent.mockResolvedValue({
        valid: true,
        consentType: 'data_processing',
        grantedAt: now,
        version: '1.0',
      });

      const result = await mockService.validateConsent(
        'user-456',
        'tenant-789',
        'data_processing'
      );

      expect(result.valid).toBe(true);
      expect(result.consentType).toBe('data_processing');
      expect(result.version).toBe('1.0');
      expect(result.grantedAt).toBeDefined();
    });

    it('should return invalid result if no consent exists', async () => {
      const mockService = createMockConsentService();

      mockService.validateConsent.mockResolvedValue({
        valid: false,
        consentType: 'data_processing',
        reason: 'No active consent found',
      });

      const result = await mockService.validateConsent(
        'user-456',
        'tenant-789',
        'data_processing'
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('No active consent found');
    });
  });

  describe('requireConsent', () => {
    it('should not throw if consent exists', async () => {
      const mockService = createMockConsentService();
      mockService.requireConsent.mockResolvedValue(undefined);

      await expect(
        mockService.requireConsent('user-456', 'tenant-789', 'data_processing')
      ).resolves.not.toThrow();
    });

    it('should throw ConsentRequiredError if consent does not exist', async () => {
      const mockService = createMockConsentService();
      mockService.requireConsent.mockRejectedValue(
        new ConsentRequiredError('user-456', 'tenant-789', 'data_processing')
      );

      await expect(
        mockService.requireConsent('user-456', 'tenant-789', 'data_processing')
      ).rejects.toThrow(ConsentRequiredError);
    });
  });

  describe('getConsentHistory', () => {
    it('should return chronological history of consent changes', async () => {
      const mockService = createMockConsentService();
      const now = new Date().toISOString();
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

      mockService.getConsentHistory.mockResolvedValue([
        {
          id: 'consent-2',
          consentType: 'data_processing',
          action: 'granted',
          version: '2.0',
          timestamp: now,
          ipAddress: '192.168.1.2',
          userAgent: 'Firefox',
        },
        {
          id: 'consent-1',
          consentType: 'data_processing',
          action: 'revoked',
          version: '1.0',
          timestamp: now,
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome',
        },
        {
          id: 'consent-1',
          consentType: 'data_processing',
          action: 'granted',
          version: '1.0',
          timestamp: oneHourAgo,
          ipAddress: '192.168.1.1',
          userAgent: 'Chrome',
        },
      ]);

      const history = await mockService.getConsentHistory('user-456', 'tenant-789');

      expect(history).toHaveLength(3);
      expect(history[0]!.action).toBe('granted');
      expect(history[0]!.version).toBe('2.0');
    });
  });
});

// =============================================================================
// CONSENT POLICY TESTS
// =============================================================================

describe('ConsentService - Policy Management', () => {
  const createMockConsentService = () => ({
    createPolicy: vi.fn(),
    getCurrentPolicy: vi.fn(),
    getPolicy: vi.fn(),
    getPolicyHistory: vi.fn(),
  });

  describe('createPolicy', () => {
    it('should create a new policy', async () => {
      const mockService = createMockConsentService();
      const now = new Date().toISOString();

      const newPolicy: ConsentPolicy = {
        id: 'policy-123',
        tenantId: 'tenant-789',
        consentType: 'data_processing',
        version: '2.0',
        content: 'New policy text',
        effectiveFrom: now,
        effectiveTo: null,
        createdAt: now,
      };

      mockService.createPolicy.mockResolvedValue(newPolicy);

      const policy = await mockService.createPolicy(
        'tenant-789',
        'data_processing',
        '2.0',
        'New policy text'
      );

      expect(policy.id).toBe('policy-123');
      expect(policy.version).toBe('2.0');
      expect(policy.content).toBe('New policy text');
    });
  });

  describe('getCurrentPolicy', () => {
    it('should return current effective policy', async () => {
      const mockService = createMockConsentService();
      const now = new Date().toISOString();

      const policy: ConsentPolicy = {
        id: 'policy-123',
        tenantId: 'tenant-789',
        consentType: 'data_processing',
        version: '1.0',
        content: 'Policy text',
        effectiveFrom: now,
        effectiveTo: null,
        createdAt: now,
      };

      mockService.getCurrentPolicy.mockResolvedValue(policy);

      const result = await mockService.getCurrentPolicy('tenant-789', 'data_processing');

      expect(result).not.toBeNull();
      expect(result!.version).toBe('1.0');
    });

    it('should return null if no effective policy', async () => {
      const mockService = createMockConsentService();
      mockService.getCurrentPolicy.mockResolvedValue(null);

      const result = await mockService.getCurrentPolicy('tenant-789', 'data_processing');

      expect(result).toBeNull();
    });
  });

  describe('getPolicyHistory', () => {
    it('should return all policy versions', async () => {
      const mockService = createMockConsentService();
      const now = new Date().toISOString();
      const yesterday = new Date(Date.now() - 86400000).toISOString();

      const policies: ConsentPolicy[] = [
        {
          id: 'policy-2',
          tenantId: 'tenant-789',
          consentType: 'data_processing',
          version: '2.0',
          content: 'Policy v2',
          effectiveFrom: now,
          effectiveTo: null,
          createdAt: now,
        },
        {
          id: 'policy-1',
          tenantId: 'tenant-789',
          consentType: 'data_processing',
          version: '1.0',
          content: 'Policy v1',
          effectiveFrom: yesterday,
          effectiveTo: now,
          createdAt: yesterday,
        },
      ];

      mockService.getPolicyHistory.mockResolvedValue(policies);

      const result = await mockService.getPolicyHistory('tenant-789', 'data_processing');

      expect(result).toHaveLength(2);
      expect(result[0]!.version).toBe('2.0');
      expect(result[1]!.version).toBe('1.0');
    });
  });
});

// =============================================================================
// INTENT SERVICE CONSENT INTEGRATION TESTS
// =============================================================================

describe('IntentService - Consent Integration', () => {
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

  const mockConsentService = {
    grantConsent: vi.fn(),
    revokeConsent: vi.fn(),
    getConsents: vi.fn(),
    getActiveConsents: vi.fn(),
    hasValidConsent: vi.fn(),
    validateConsent: vi.fn(),
    requireConsent: vi.fn(),
    getConsentHistory: vi.fn(),
    createPolicy: vi.fn(),
    getCurrentPolicy: vi.fn(),
    getPolicy: vi.fn(),
    getPolicyHistory: vi.fn(),
  };

  let service: IntentService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new IntentService(mockRepository as any, mockConsentService as any);
    mockRepository.findByDedupeHash.mockResolvedValue(null);
    mockRepository.countActiveIntents.mockResolvedValue(0);
  });

  describe('submit with consent validation', () => {
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

    it('should submit intent when data_processing consent is valid', async () => {
      mockConsentService.validateConsent.mockResolvedValue({
        valid: true,
        consentType: 'data_processing',
        version: '1.0',
        grantedAt: new Date().toISOString(),
      });
      mockRepository.createIntentWithEvent.mockResolvedValue(mockIntent);

      const intent = await service.submit(validSubmission, {
        tenantId: 'tenant-456',
        userId: 'user-789',
        bypassTrustGate: true,
      });

      expect(intent).toEqual(mockIntent);
      expect(mockConsentService.validateConsent).toHaveBeenCalledWith(
        'user-789',
        'tenant-456',
        'data_processing'
      );
    });

    it('should reject intent when data_processing consent is not granted', async () => {
      mockConsentService.validateConsent.mockResolvedValue({
        valid: false,
        consentType: 'data_processing',
        reason: 'No active consent found',
      });

      await expect(
        service.submit(validSubmission, {
          tenantId: 'tenant-456',
          userId: 'user-789',
          bypassTrustGate: true,
        })
      ).rejects.toThrow(ConsentRequiredError);

      expect(mockRepository.createIntentWithEvent).not.toHaveBeenCalled();
    });

    it('should bypass consent check when bypassConsentCheck is true', async () => {
      mockRepository.createIntentWithEvent.mockResolvedValue(mockIntent);

      const intent = await service.submit(validSubmission, {
        tenantId: 'tenant-456',
        userId: 'user-789',
        bypassConsentCheck: true,
        bypassTrustGate: true,
      });

      expect(intent).toEqual(mockIntent);
      expect(mockConsentService.validateConsent).not.toHaveBeenCalled();
    });

    it('should skip consent check when no userId is provided', async () => {
      mockRepository.createIntentWithEvent.mockResolvedValue(mockIntent);

      const intent = await service.submit(validSubmission, {
        tenantId: 'tenant-456',
        bypassTrustGate: true,
      });

      expect(intent).toEqual(mockIntent);
      expect(mockConsentService.validateConsent).not.toHaveBeenCalled();
    });
  });

  describe('getConsentService', () => {
    it('should return the consent service instance', () => {
      const consentService = service.getConsentService();
      expect(consentService).toBe(mockConsentService);
    });
  });
});

// =============================================================================
// ERROR CLASSES TESTS
// =============================================================================

describe('ConsentRequiredError', () => {
  it('should create error with correct properties', () => {
    const error = new ConsentRequiredError(
      'user-123',
      'tenant-456',
      'data_processing'
    );

    expect(error.name).toBe('ConsentRequiredError');
    expect(error.userId).toBe('user-123');
    expect(error.tenantId).toBe('tenant-456');
    expect(error.consentType).toBe('data_processing');
    expect(error.message).toContain('data_processing');
    expect(error.message).toContain('user-123');
  });

  it('should use custom message when provided', () => {
    const error = new ConsentRequiredError(
      'user-123',
      'tenant-456',
      'data_processing',
      'Custom error message'
    );

    expect(error.message).toBe('Custom error message');
  });
});

describe('ConsentPolicyNotFoundError', () => {
  it('should create error with correct properties', () => {
    const error = new ConsentPolicyNotFoundError(
      'tenant-456',
      'data_processing',
      '1.0'
    );

    expect(error.name).toBe('ConsentPolicyNotFoundError');
    expect(error.tenantId).toBe('tenant-456');
    expect(error.consentType).toBe('data_processing');
    expect(error.version).toBe('1.0');
    expect(error.message).toContain('data_processing');
    expect(error.message).toContain('1.0');
  });
});

// =============================================================================
// CONSENT TYPES TESTS
// =============================================================================

describe('Consent Types', () => {
  it('should support all consent types', () => {
    const types: ConsentType[] = ['data_processing', 'analytics', 'marketing'];

    types.forEach(type => {
      expect(['data_processing', 'analytics', 'marketing']).toContain(type);
    });
  });
});
