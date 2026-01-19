/**
 * Webhook Service Tests
 *
 * Comprehensive tests for the webhook notification system including:
 * - SSRF protection (URL validation)
 * - Webhook registration/unregistration
 * - Webhook delivery with retry logic
 * - Event filtering
 * - HMAC signature verification
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';

// Define mock objects that will be populated by the vi.mock factories
let mockRedis: {
  set: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  sadd: ReturnType<typeof vi.fn>;
  srem: ReturnType<typeof vi.fn>;
  smembers: ReturnType<typeof vi.fn>;
  keys: ReturnType<typeof vi.fn>;
  setex: ReturnType<typeof vi.fn>;
  zadd: ReturnType<typeof vi.fn>;
  zrevrange: ReturnType<typeof vi.fn>;
  zrange: ReturnType<typeof vi.fn>;
  zrem: ReturnType<typeof vi.fn>;
  expire: ReturnType<typeof vi.fn>;
  exists: ReturnType<typeof vi.fn>;
};

let mockLogger: {
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
};

// Mock fetch
const mockFetch = vi.fn();

// Mock Redis
vi.mock('../../../src/common/redis.js', () => {
  const redis = {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
    sadd: vi.fn().mockResolvedValue(1),
    srem: vi.fn().mockResolvedValue(1),
    smembers: vi.fn().mockResolvedValue([]),
    keys: vi.fn().mockResolvedValue([]),
    setex: vi.fn().mockResolvedValue('OK'),
    zadd: vi.fn().mockResolvedValue(1),
    zrevrange: vi.fn().mockResolvedValue([]),
    zrange: vi.fn().mockResolvedValue([]),
    zrem: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(1),
  };
  // Export for test access
  (globalThis as any).__mockRedis = redis;
  return {
    getRedis: vi.fn(() => redis),
  };
});

// Mock logger
vi.mock('../../../src/common/logger.js', () => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
  // Export for test access
  (globalThis as any).__mockLogger = logger;
  return {
    createLogger: vi.fn(() => logger),
  };
});

// Mock config - default webhook configuration
const mockWebhookConfig = {
  timeoutMs: 10000,
  retryAttempts: 3,
  retryDelayMs: 1000,
};

vi.mock('../../../src/common/config.js', () => {
  return {
    getConfig: vi.fn(() => ({
      webhook: (globalThis as any).__mockWebhookConfig || {
        timeoutMs: 10000,
        retryAttempts: 3,
        retryDelayMs: 1000,
      },
    })),
  };
});

// Mock DNS and util modules for dynamic import
const mockDnsLookup = vi.fn();
vi.mock('node:dns', () => ({
  lookup: mockDnsLookup,
  default: { lookup: mockDnsLookup },
}));

vi.mock('node:util', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:util')>();
  return {
    ...original,
    promisify: (fn: Function) => {
      // Return a function that calls our mock
      if (fn === mockDnsLookup || fn.name === 'lookup') {
        return async (hostname: string) => {
          return new Promise((resolve, reject) => {
            mockDnsLookup(hostname, (err: Error | null, result: any) => {
              if (err) reject(err);
              else resolve(result);
            });
          });
        };
      }
      return original.promisify(fn as any);
    },
  };
});

// Import after mocks are set up
import {
  validateWebhookUrl,
  validateWebhookUrlAtRuntime,
  WebhookService,
  type WebhookConfig,
} from '../../../src/intent/webhooks.js';
import type { EscalationRecord } from '../../../src/intent/escalation.js';

// Get mock references after import
mockRedis = (globalThis as any).__mockRedis;
mockLogger = (globalThis as any).__mockLogger;

// Setup global fetch mock
beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  // Reset webhook config to defaults
  (globalThis as any).__mockWebhookConfig = {
    timeoutMs: 10000,
    retryAttempts: 3,
    retryDelayMs: 1000,
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete (globalThis as any).__mockWebhookConfig;
});

describe('WebhookService', () => {
  let service: WebhookService;
  let originalEnv: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    service = new WebhookService();
    originalEnv = process.env['VORION_ENV'];
    // Set production environment for most tests
    process.env['VORION_ENV'] = 'production';
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env['VORION_ENV'] = originalEnv;
  });

  describe('URL Validation (SSRF Protection)', () => {
    describe('Protocol validation', () => {
      it('should reject HTTP URLs in production', async () => {
        process.env['VORION_ENV'] = 'production';
        const result = await validateWebhookUrl('http://example.com/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Webhook URL must use HTTPS');
      });

      it('should allow HTTPS URLs', async () => {
        const result = await validateWebhookUrl('https://example.com/webhook');
        expect(result.valid).toBe(true);
      });

      it('should allow HTTP localhost in development', async () => {
        process.env['VORION_ENV'] = 'development';
        const result = await validateWebhookUrl('http://localhost:3000/webhook');
        expect(result.valid).toBe(true);
      });
    });

    describe('Blocked hostnames', () => {
      it('should block localhost in production', async () => {
        process.env['VORION_ENV'] = 'production';
        const result = await validateWebhookUrl('https://localhost/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Webhook URL hostname is blocked');
      });

      it('should block 127.0.0.1 in production', async () => {
        process.env['VORION_ENV'] = 'production';
        const result = await validateWebhookUrl('https://127.0.0.1/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Webhook URL hostname is blocked');
      });

      it('should block 169.254.169.254 (metadata endpoint)', async () => {
        const result = await validateWebhookUrl('https://169.254.169.254/latest/meta-data/');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Webhook URL hostname is blocked');
      });

      it('should block kubernetes.default', async () => {
        const result = await validateWebhookUrl('https://kubernetes.default/api');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Webhook URL hostname is blocked');
      });

      it('should block kubernetes.default.svc', async () => {
        const result = await validateWebhookUrl('https://kubernetes.default.svc/api');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Webhook URL hostname is blocked');
      });

      it('should block metadata.google.internal', async () => {
        const result = await validateWebhookUrl('https://metadata.google.internal/computeMetadata/v1/');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Webhook URL hostname is blocked');
      });

      it('should block 0.0.0.0', async () => {
        const result = await validateWebhookUrl('https://0.0.0.0/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Webhook URL hostname is blocked');
      });
    });

    describe('Private IP ranges', () => {
      it('should block 10.x.x.x private range', async () => {
        const result = await validateWebhookUrl('https://10.0.0.1/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Webhook URL resolves to private IP address');
      });

      it('should block 10.255.255.255 private range', async () => {
        const result = await validateWebhookUrl('https://10.255.255.255/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Webhook URL resolves to private IP address');
      });

      it('should block 172.16.x.x private range', async () => {
        const result = await validateWebhookUrl('https://172.16.0.1/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Webhook URL resolves to private IP address');
      });

      it('should block 172.31.x.x private range', async () => {
        const result = await validateWebhookUrl('https://172.31.255.255/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Webhook URL resolves to private IP address');
      });

      it('should allow 172.15.x.x (not in private range)', async () => {
        const result = await validateWebhookUrl('https://172.15.0.1/webhook');
        expect(result.valid).toBe(true);
      });

      it('should allow 172.32.x.x (not in private range)', async () => {
        const result = await validateWebhookUrl('https://172.32.0.1/webhook');
        expect(result.valid).toBe(true);
      });

      it('should block 192.168.x.x private range', async () => {
        const result = await validateWebhookUrl('https://192.168.1.1/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Webhook URL resolves to private IP address');
      });

      it('should block 192.168.0.0 private range', async () => {
        const result = await validateWebhookUrl('https://192.168.0.0/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Webhook URL resolves to private IP address');
      });

      it('should block 127.x.x.x loopback range', async () => {
        const result = await validateWebhookUrl('https://127.0.0.1/webhook');
        expect(result.valid).toBe(false);
        // This gets caught by the blocked hostnames check first
        expect(result.reason).toBe('Webhook URL hostname is blocked');
      });

      it('should block 169.254.x.x link-local', async () => {
        const result = await validateWebhookUrl('https://169.254.1.1/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Webhook URL resolves to private IP address');
      });
    });

    describe('Blocked domain patterns', () => {
      it('should block .internal domains', async () => {
        const result = await validateWebhookUrl('https://api.internal/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Webhook URL domain pattern is blocked');
      });

      it('should block .local domains', async () => {
        const result = await validateWebhookUrl('https://myservice.local/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Webhook URL domain pattern is blocked');
      });

      it('should block .localhost domains', async () => {
        const result = await validateWebhookUrl('https://app.localhost/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Webhook URL domain pattern is blocked');
      });

      it('should block .svc domains', async () => {
        const result = await validateWebhookUrl('https://myservice.svc/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Webhook URL domain pattern is blocked');
      });

      it('should block .cluster.local domains', async () => {
        const result = await validateWebhookUrl('https://myservice.default.cluster.local/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Webhook URL domain pattern is blocked');
      });

      it('should block .corp domains', async () => {
        const result = await validateWebhookUrl('https://intranet.corp/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Webhook URL domain pattern is blocked');
      });

      it('should block .lan domains', async () => {
        const result = await validateWebhookUrl('https://router.lan/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Webhook URL domain pattern is blocked');
      });

      it('should block .home domains', async () => {
        const result = await validateWebhookUrl('https://server.home/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Webhook URL domain pattern is blocked');
      });
    });

    describe('Blocked ports', () => {
      it('should block port 22 (SSH)', async () => {
        const result = await validateWebhookUrl('https://example.com:22/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Webhook URL port 22 is blocked');
      });

      it('should block port 23 (Telnet)', async () => {
        const result = await validateWebhookUrl('https://example.com:23/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Webhook URL port 23 is blocked');
      });

      it('should block port 25 (SMTP)', async () => {
        const result = await validateWebhookUrl('https://example.com:25/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Webhook URL port 25 is blocked');
      });

      it('should block port 3306 (MySQL)', async () => {
        const result = await validateWebhookUrl('https://example.com:3306/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Webhook URL port 3306 is blocked');
      });

      it('should block port 5432 (PostgreSQL)', async () => {
        const result = await validateWebhookUrl('https://example.com:5432/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Webhook URL port 5432 is blocked');
      });

      it('should block port 6379 (Redis)', async () => {
        const result = await validateWebhookUrl('https://example.com:6379/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Webhook URL port 6379 is blocked');
      });

      it('should block port 27017 (MongoDB)', async () => {
        const result = await validateWebhookUrl('https://example.com:27017/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Webhook URL port 27017 is blocked');
      });

      it('should block port 9200 (Elasticsearch)', async () => {
        const result = await validateWebhookUrl('https://example.com:9200/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Webhook URL port 9200 is blocked');
      });

      it('should block port 11211 (Memcached)', async () => {
        const result = await validateWebhookUrl('https://example.com:11211/webhook');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Webhook URL port 11211 is blocked');
      });

      it('should allow standard HTTPS port 443', async () => {
        const result = await validateWebhookUrl('https://example.com:443/webhook');
        expect(result.valid).toBe(true);
      });

      it('should allow custom non-blocked port', async () => {
        const result = await validateWebhookUrl('https://example.com:8443/webhook');
        expect(result.valid).toBe(true);
      });
    });

    describe('Valid URLs', () => {
      it('should allow valid external HTTPS URLs', async () => {
        const result = await validateWebhookUrl('https://api.example.com/webhooks/notify');
        expect(result.valid).toBe(true);
      });

      it('should allow valid URLs with paths and query strings', async () => {
        const result = await validateWebhookUrl('https://api.example.com/v1/webhooks?token=abc123');
        expect(result.valid).toBe(true);
      });

      it('should allow URLs with valid public IPs like 8.8.8.8', async () => {
        const result = await validateWebhookUrl('https://8.8.8.8/webhook');
        expect(result.valid).toBe(true);
      });
    });

    describe('Invalid URL format', () => {
      it('should reject malformed URLs', async () => {
        const result = await validateWebhookUrl('not-a-url');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Invalid webhook URL format');
      });

      it('should reject empty strings', async () => {
        const result = await validateWebhookUrl('');
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Invalid webhook URL format');
      });
    });
  });

  describe('Runtime URL Validation', () => {
    it('should reject URLs that resolve to private IPs', async () => {
      // Mock DNS lookup to return a private IP
      mockDnsLookup.mockImplementation((hostname: string, callback: Function) => {
        callback(null, { address: '10.0.0.1', family: 4 });
      });

      const result = await validateWebhookUrlAtRuntime('https://malicious.example.com/webhook');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Webhook URL resolves to private IP address');
      expect(result.resolvedIP).toBe('10.0.0.1');
    });

    it('should allow URLs that resolve to public IPs', async () => {
      mockDnsLookup.mockImplementation((hostname: string, callback: Function) => {
        callback(null, { address: '93.184.216.34', family: 4 });
      });

      const result = await validateWebhookUrlAtRuntime('https://example.com/webhook');
      expect(result.valid).toBe(true);
      expect(result.resolvedIP).toBe('93.184.216.34');
    });

    it('should handle DNS resolution failures gracefully', async () => {
      mockDnsLookup.mockImplementation((hostname: string, callback: Function) => {
        callback(new Error('ENOTFOUND'));
      });

      const result = await validateWebhookUrlAtRuntime('https://nonexistent.example.com/webhook');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Failed to resolve webhook URL hostname');
    });

    it('should skip DNS check for IP addresses', async () => {
      const result = await validateWebhookUrlAtRuntime('https://8.8.8.8/webhook');
      expect(result.valid).toBe(true);
      expect(result.resolvedIP).toBe('8.8.8.8');
      // DNS lookup should not be called for IP addresses
      expect(mockDnsLookup).not.toHaveBeenCalled();
    });

    it('should reject URLs that fail basic validation', async () => {
      const result = await validateWebhookUrlAtRuntime('http://example.com/webhook');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Webhook URL must use HTTPS');
    });
  });

  describe('Webhook Registration', () => {
    const validConfig: WebhookConfig = {
      url: 'https://api.example.com/webhooks',
      secret: 'test-secret',
      enabled: true,
      events: ['escalation.created', 'escalation.approved'],
    };

    it('should register a valid webhook', async () => {
      const webhookId = await service.registerWebhook('tenant-123', validConfig);

      expect(webhookId).toBeDefined();
      expect(typeof webhookId).toBe('string');
      expect(webhookId.length).toBeGreaterThan(0);
    });

    it('should reject invalid webhook URLs', async () => {
      const invalidConfig: WebhookConfig = {
        url: 'http://internal.local/webhook',
        enabled: true,
        events: ['escalation.created'],
      };

      await expect(service.registerWebhook('tenant-123', invalidConfig)).rejects.toThrow(
        'Invalid webhook URL'
      );
    });

    it('should store webhook config in Redis', async () => {
      const webhookId = await service.registerWebhook('tenant-123', validConfig);

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining(`webhook:config:tenant-123:${webhookId}`),
        JSON.stringify(validConfig)
      );
    });

    it('should return webhook ID as valid UUID', async () => {
      const webhookId = await service.registerWebhook('tenant-123', validConfig);

      // Webhook ID should be a valid UUID
      expect(webhookId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should add webhook to tenant set', async () => {
      const webhookId = await service.registerWebhook('tenant-123', validConfig);

      expect(mockRedis.sadd).toHaveBeenCalledWith(
        'webhook:tenants:tenant-123',
        webhookId
      );
    });

    it('should log registration', async () => {
      await service.registerWebhook('tenant-123', validConfig);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-123',
          url: validConfig.url,
        }),
        'Webhook registered'
      );
    });
  });

  describe('Webhook Unregistration', () => {
    it('should remove webhook from Redis', async () => {
      mockRedis.del.mockResolvedValue(1);

      const result = await service.unregisterWebhook('tenant-123', 'webhook-456');

      expect(mockRedis.del).toHaveBeenCalledWith('webhook:config:tenant-123:webhook-456');
      expect(result).toBe(true);
    });

    it('should return true on successful removal', async () => {
      mockRedis.del.mockResolvedValue(1);

      const result = await service.unregisterWebhook('tenant-123', 'webhook-456');

      expect(result).toBe(true);
    });

    it('should return false for non-existent webhook', async () => {
      mockRedis.del.mockResolvedValue(0);

      const result = await service.unregisterWebhook('tenant-123', 'nonexistent');

      expect(result).toBe(false);
    });

    it('should remove webhook from tenant set', async () => {
      await service.unregisterWebhook('tenant-123', 'webhook-456');

      expect(mockRedis.srem).toHaveBeenCalledWith(
        'webhook:tenants:tenant-123',
        'webhook-456'
      );
    });

    it('should log unregistration when successful', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.unregisterWebhook('tenant-123', 'webhook-456');

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-123',
          webhookId: 'webhook-456',
        }),
        'Webhook unregistered'
      );
    });
  });

  describe('Webhook Listing', () => {
    it('should return all webhooks for tenant', async () => {
      const config1: WebhookConfig = {
        url: 'https://api1.example.com/webhook',
        enabled: true,
        events: ['escalation.created'],
      };
      const config2: WebhookConfig = {
        url: 'https://api2.example.com/webhook',
        enabled: true,
        events: ['escalation.approved'],
      };

      mockRedis.smembers.mockResolvedValue(['webhook-1', 'webhook-2']);
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(config1))
        .mockResolvedValueOnce(JSON.stringify(config2));

      const webhooks = await service.getWebhooks('tenant-123');

      expect(webhooks).toHaveLength(2);
      expect(webhooks[0]).toEqual({ id: 'webhook-1', config: config1 });
      expect(webhooks[1]).toEqual({ id: 'webhook-2', config: config2 });
    });

    it('should return empty array when no webhooks', async () => {
      mockRedis.smembers.mockResolvedValue([]);

      const webhooks = await service.getWebhooks('tenant-123');

      expect(webhooks).toEqual([]);
    });

    it('should handle missing webhook configs gracefully', async () => {
      mockRedis.smembers.mockResolvedValue(['webhook-1', 'webhook-2']);
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify({ url: 'https://example.com', enabled: true, events: [] }))
        .mockResolvedValueOnce(null); // Second webhook config not found

      const webhooks = await service.getWebhooks('tenant-123');

      expect(webhooks).toHaveLength(1);
    });
  });

  describe('Webhook Delivery', () => {
    const mockEscalation: EscalationRecord = {
      id: 'esc-123',
      intentId: 'intent-456',
      tenantId: 'tenant-789',
      reason: 'Trust level insufficient',
      reasonCategory: 'trust_insufficient',
      escalatedTo: 'governance-team',
      status: 'pending',
      timeout: 'PT1H',
      timeoutAt: new Date(Date.now() + 3600000).toISOString(),
      slaBreached: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockWebhookConfig: WebhookConfig = {
      url: 'https://api.example.com/webhook',
      secret: 'webhook-secret',
      enabled: true,
      events: ['escalation.created', 'escalation.approved'],
      retryAttempts: 3,
      retryDelayMs: 100,
    };

    beforeEach(() => {
      // Setup DNS mock for runtime validation
      mockDnsLookup.mockImplementation((hostname: string, callback: Function) => {
        callback(null, { address: '93.184.216.34', family: 4 });
      });

      mockRedis.smembers.mockResolvedValue(['webhook-1']);
      mockRedis.get.mockResolvedValue(JSON.stringify(mockWebhookConfig));
    });

    it('should deliver payload to webhook URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      await service.notifyEscalation('escalation.created', mockEscalation);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String),
        })
      );
    });

    it('should include correct headers', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      await service.notifyEscalation('escalation.created', mockEscalation);

      const fetchCall = mockFetch.mock.calls[0];
      const options = fetchCall[1];
      const headers = options.headers;

      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['User-Agent']).toBe('Vorion-Webhook/1.0');
      expect(headers['X-Webhook-Event']).toBe('escalation.created');
      expect(headers['X-Webhook-Delivery']).toBeDefined();
    });

    it('should include HMAC signature when secret configured', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      await service.notifyEscalation('escalation.created', mockEscalation);

      const fetchCall = mockFetch.mock.calls[0];
      const options = fetchCall[1];
      const headers = options.headers;
      const body = options.body;

      expect(headers['X-Webhook-Signature']).toBeDefined();
      expect(headers['X-Webhook-Signature']).toMatch(/^sha256=/);

      // Verify the signature is correct
      const expectedSignature = createHmac('sha256', 'webhook-secret')
        .update(body)
        .digest('hex');
      expect(headers['X-Webhook-Signature']).toBe(`sha256=${expectedSignature}`);
    });

    it('should not include signature when no secret configured', async () => {
      const configWithoutSecret: WebhookConfig = {
        ...mockWebhookConfig,
        secret: undefined,
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(configWithoutSecret));

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      await service.notifyEscalation('escalation.created', mockEscalation);

      const fetchCall = mockFetch.mock.calls[0];
      const options = fetchCall[1];
      const headers = options.headers;

      expect(headers['X-Webhook-Signature']).toBeUndefined();
    });

    it('should retry on failure', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Internal Server Error' })
        .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Internal Server Error' })
        .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' });

      const promise = service.notifyEscalation('escalation.created', mockEscalation);

      // Fast-forward through retry delays
      await vi.advanceTimersByTimeAsync(100); // First retry delay
      await vi.advanceTimersByTimeAsync(200); // Second retry delay (exponential)

      const results = await promise;

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(results[0].success).toBe(true);
      expect(results[0].attempts).toBe(3);
    });

    it('should use exponential backoff', async () => {
      const configWithRetry: WebhookConfig = {
        ...mockWebhookConfig,
        retryAttempts: 4,
        retryDelayMs: 100,
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(configWithRetry));

      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Error' })
        .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Error' })
        .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Error' })
        .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' });

      const promise = service.notifyEscalation('escalation.created', mockEscalation);

      // Expected delays: 100ms (100 * 2^0), 200ms (100 * 2^1), 400ms (100 * 2^2)
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);
      await vi.advanceTimersByTimeAsync(400);

      await promise;

      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('should give up after max retries', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' });

      const promise = service.notifyEscalation('escalation.created', mockEscalation);

      // Fast-forward through all retry delays
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);

      const results = await promise;

      expect(mockFetch).toHaveBeenCalledTimes(3); // retryAttempts is 3
      expect(results[0].success).toBe(false);
      expect(results[0].attempts).toBe(3);
      expect(results[0].error).toBe('HTTP 500: Internal Server Error');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const promise = service.notifyEscalation('escalation.created', mockEscalation);

      // Fast-forward through retry delays
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);

      const results = await promise;

      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('Network error');
    });

    it('should abort on timeout', async () => {
      // Create a fetch that never resolves but respects abort signal
      mockFetch.mockImplementation((_url: string, options: RequestInit) => {
        return new Promise((resolve, reject) => {
          const signal = options.signal as AbortSignal;
          if (signal) {
            signal.addEventListener('abort', () => {
              reject(new Error('The operation was aborted'));
            });
          }
        });
      });

      const promise = service.notifyEscalation('escalation.created', mockEscalation);

      // The timeout is 10000ms per the config default
      // Advance through timeout and retry delays
      await vi.advanceTimersByTimeAsync(10000); // First timeout
      await vi.advanceTimersByTimeAsync(100);   // Retry delay
      await vi.advanceTimersByTimeAsync(10000); // Second timeout
      await vi.advanceTimersByTimeAsync(200);   // Retry delay
      await vi.advanceTimersByTimeAsync(10000); // Third timeout

      const results = await promise;

      expect(results[0].success).toBe(false);
    });

    it('should use configurable timeout from config', async () => {
      // Set custom timeout of 5 seconds
      (globalThis as any).__mockWebhookConfig = {
        timeoutMs: 5000,
        retryAttempts: 3,
        retryDelayMs: 1000,
      };

      // Create a fetch that never resolves but respects abort signal
      mockFetch.mockImplementation((_url: string, options: RequestInit) => {
        return new Promise((resolve, reject) => {
          const signal = options.signal as AbortSignal;
          if (signal) {
            signal.addEventListener('abort', () => {
              reject(new Error('The operation was aborted'));
            });
          }
        });
      });

      const promise = service.notifyEscalation('escalation.created', mockEscalation);

      // The timeout is now 5000ms from config
      // Advance through timeout and retry delays
      await vi.advanceTimersByTimeAsync(5000); // First timeout (custom)
      await vi.advanceTimersByTimeAsync(1000); // Retry delay
      await vi.advanceTimersByTimeAsync(5000); // Second timeout (custom)
      await vi.advanceTimersByTimeAsync(2000); // Retry delay (exponential)
      await vi.advanceTimersByTimeAsync(5000); // Third timeout (custom)

      const results = await promise;

      expect(results[0].success).toBe(false);
      expect(results[0].attempts).toBe(3);
    });

    it('should use configurable retry attempts from config', async () => {
      // Set custom retry attempts to 5 - must be set before creating service
      // as getConfig is called at runtime, not at service creation
      (globalThis as any).__mockWebhookConfig = {
        timeoutMs: 10000,
        retryAttempts: 5,
        retryDelayMs: 100,
      };

      // Note: The WebhookConfig on the webhook itself doesn't have retryAttempts set,
      // so it will fall back to the global config
      const webhookConfigNoOverride: WebhookConfig = {
        url: 'https://api.example.com/webhook',
        enabled: true,
        events: ['escalation.created'],
        // No retryAttempts or retryDelayMs - will use global config
      };

      mockRedis.smembers.mockResolvedValue(['webhook-1']);
      mockRedis.get.mockResolvedValue(JSON.stringify(webhookConfigNoOverride));
      mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' });

      const promise = service.notifyEscalation('escalation.created', mockEscalation);

      // Fast-forward through all 5 retry delays with exponential backoff
      await vi.advanceTimersByTimeAsync(100);  // After attempt 1
      await vi.advanceTimersByTimeAsync(200);  // After attempt 2
      await vi.advanceTimersByTimeAsync(400);  // After attempt 3
      await vi.advanceTimersByTimeAsync(800);  // After attempt 4
      // No delay after attempt 5 (last attempt)

      const results = await promise;

      expect(mockFetch).toHaveBeenCalledTimes(5);
      expect(results[0].success).toBe(false);
      expect(results[0].attempts).toBe(5);
    });

    it('should use configurable retry delay from config', async () => {
      // Set custom retry delay to 500ms
      (globalThis as any).__mockWebhookConfig = {
        timeoutMs: 10000,
        retryAttempts: 3,
        retryDelayMs: 500,
      };

      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Error' })
        .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Error' })
        .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' });

      const promise = service.notifyEscalation('escalation.created', mockEscalation);

      // With 500ms base delay and exponential backoff:
      // After attempt 1: 500ms delay (500 * 2^0)
      // After attempt 2: 1000ms delay (500 * 2^1)
      await vi.advanceTimersByTimeAsync(500);  // First retry delay
      await vi.advanceTimersByTimeAsync(1000); // Second retry delay

      const results = await promise;

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(results[0].success).toBe(true);
      expect(results[0].attempts).toBe(3);
    });

    it('should allow per-webhook config to override global config', async () => {
      // Global config with 5 retries
      (globalThis as any).__mockWebhookConfig = {
        timeoutMs: 10000,
        retryAttempts: 5,
        retryDelayMs: 100,
      };

      // Webhook-specific config with only 2 retries
      const webhookConfigWithOverride: WebhookConfig = {
        url: 'https://api.example.com/webhook',
        enabled: true,
        events: ['escalation.created'],
        retryAttempts: 2,
        retryDelayMs: 50,
      };

      mockRedis.smembers.mockResolvedValue(['webhook-1']);
      mockRedis.get.mockResolvedValue(JSON.stringify(webhookConfigWithOverride));
      mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' });

      const promise = service.notifyEscalation('escalation.created', mockEscalation);

      // Fast-forward through 2 retry delays (webhook override)
      await vi.advanceTimersByTimeAsync(50);   // After attempt 1 (50 * 2^0)
      await vi.advanceTimersByTimeAsync(100);  // After attempt 2 (50 * 2^1)

      const results = await promise;

      // Should respect per-webhook config (2 attempts) not global config (5 attempts)
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(results[0].success).toBe(false);
      expect(results[0].attempts).toBe(2);
    });
  });

  describe('Event Filtering', () => {
    const mockEscalation: EscalationRecord = {
      id: 'esc-123',
      intentId: 'intent-456',
      tenantId: 'tenant-789',
      reason: 'Test',
      reasonCategory: 'trust_insufficient',
      escalatedTo: 'team',
      status: 'pending',
      timeout: 'PT1H',
      timeoutAt: new Date(Date.now() + 3600000).toISOString(),
      slaBreached: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    beforeEach(() => {
      mockDnsLookup.mockImplementation((hostname: string, callback: Function) => {
        callback(null, { address: '93.184.216.34', family: 4 });
      });
    });

    it('should only deliver to webhooks subscribed to event type', async () => {
      const webhookForCreated: WebhookConfig = {
        url: 'https://created.example.com/webhook',
        enabled: true,
        events: ['escalation.created'],
      };
      const webhookForApproved: WebhookConfig = {
        url: 'https://approved.example.com/webhook',
        enabled: true,
        events: ['escalation.approved'],
      };

      mockRedis.smembers.mockResolvedValue(['webhook-1', 'webhook-2']);
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(webhookForCreated))
        .mockResolvedValueOnce(JSON.stringify(webhookForApproved));

      mockFetch.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });

      await service.notifyEscalation('escalation.created', mockEscalation);

      // Should only call webhook-1 (subscribed to escalation.created)
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://created.example.com/webhook',
        expect.any(Object)
      );
    });

    it('should skip disabled webhooks', async () => {
      const disabledWebhook: WebhookConfig = {
        url: 'https://disabled.example.com/webhook',
        enabled: false,
        events: ['escalation.created'],
      };
      const enabledWebhook: WebhookConfig = {
        url: 'https://enabled.example.com/webhook',
        enabled: true,
        events: ['escalation.created'],
      };

      mockRedis.smembers.mockResolvedValue(['webhook-1', 'webhook-2']);
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(disabledWebhook))
        .mockResolvedValueOnce(JSON.stringify(enabledWebhook));

      mockFetch.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });

      await service.notifyEscalation('escalation.created', mockEscalation);

      // Should only call the enabled webhook
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://enabled.example.com/webhook',
        expect.any(Object)
      );
    });

    it('should deliver to multiple matching webhooks', async () => {
      const webhook1: WebhookConfig = {
        url: 'https://webhook1.example.com/webhook',
        enabled: true,
        events: ['escalation.created', 'escalation.approved'],
      };
      const webhook2: WebhookConfig = {
        url: 'https://webhook2.example.com/webhook',
        enabled: true,
        events: ['escalation.created'],
      };

      mockRedis.smembers.mockResolvedValue(['webhook-1', 'webhook-2']);
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(webhook1))
        .mockResolvedValueOnce(JSON.stringify(webhook2));

      mockFetch.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });

      const results = await service.notifyEscalation('escalation.created', mockEscalation);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(2);
    });
  });

  describe('Escalation Notifications', () => {
    const mockEscalation: EscalationRecord = {
      id: 'esc-123',
      intentId: 'intent-456',
      tenantId: 'tenant-789',
      reason: 'Trust level insufficient',
      reasonCategory: 'trust_insufficient',
      escalatedTo: 'governance-team',
      escalatedBy: 'system',
      status: 'pending',
      timeout: 'PT1H',
      timeoutAt: new Date(Date.now() + 3600000).toISOString(),
      slaBreached: false,
      context: { originalGoal: 'Delete user data' },
      metadata: { priority: 'high' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockWebhookConfig: WebhookConfig = {
      url: 'https://api.example.com/webhook',
      enabled: true,
      events: ['escalation.created', 'escalation.approved', 'escalation.rejected'],
    };

    beforeEach(() => {
      mockDnsLookup.mockImplementation((hostname: string, callback: Function) => {
        callback(null, { address: '93.184.216.34', family: 4 });
      });
      mockRedis.smembers.mockResolvedValue(['webhook-1']);
      mockRedis.get.mockResolvedValue(JSON.stringify(mockWebhookConfig));
      mockFetch.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });
    });

    it('should format escalation.created payload correctly', async () => {
      await service.notifyEscalation('escalation.created', mockEscalation);

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.eventType).toBe('escalation.created');
      expect(body.tenantId).toBe('tenant-789');
      expect(body.data.escalationId).toBe('esc-123');
      expect(body.data.intentId).toBe('intent-456');
      expect(body.data.reason).toBe('Trust level insufficient');
      expect(body.data.reasonCategory).toBe('trust_insufficient');
      expect(body.data.escalatedTo).toBe('governance-team');
      expect(body.data.status).toBe('pending');
      expect(body.timestamp).toBeDefined();
      expect(body.id).toBeDefined();
    });

    it('should format escalation.approved payload correctly', async () => {
      const approvedEscalation: EscalationRecord = {
        ...mockEscalation,
        status: 'approved',
        resolution: {
          resolvedBy: 'admin-user',
          resolvedAt: new Date().toISOString(),
          notes: 'Approved after review',
        },
      };

      await service.notifyEscalation('escalation.approved', approvedEscalation);

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.eventType).toBe('escalation.approved');
      expect(body.data.status).toBe('approved');
      expect(body.data.resolution).toEqual(approvedEscalation.resolution);
    });

    it('should format escalation.rejected payload correctly', async () => {
      const rejectedEscalation: EscalationRecord = {
        ...mockEscalation,
        status: 'rejected',
        resolution: {
          resolvedBy: 'security-team',
          resolvedAt: new Date().toISOString(),
          notes: 'Denied - insufficient justification',
        },
      };

      await service.notifyEscalation('escalation.rejected', rejectedEscalation);

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.eventType).toBe('escalation.rejected');
      expect(body.data.status).toBe('rejected');
      expect(body.data.resolution).toEqual(rejectedEscalation.resolution);
    });

    it('should include all escalation metadata in payload', async () => {
      await service.notifyEscalation('escalation.created', mockEscalation);

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.data.createdAt).toBe(mockEscalation.createdAt);
      expect(body.data.updatedAt).toBe(mockEscalation.updatedAt);
    });
  });

  describe('Intent Notifications', () => {
    const mockWebhookConfig: WebhookConfig = {
      url: 'https://api.example.com/webhook',
      enabled: true,
      events: ['intent.approved', 'intent.denied', 'intent.completed'],
    };

    beforeEach(() => {
      mockDnsLookup.mockImplementation((hostname: string, callback: Function) => {
        callback(null, { address: '93.184.216.34', family: 4 });
      });
      mockRedis.smembers.mockResolvedValue(['webhook-1']);
      mockRedis.get.mockResolvedValue(JSON.stringify(mockWebhookConfig));
      mockFetch.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });
    });

    it('should format intent.approved payload correctly', async () => {
      await service.notifyIntent('intent.approved', 'intent-123', 'tenant-456', {
        approvedBy: 'admin',
        approvalReason: 'Meets all criteria',
      });

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.eventType).toBe('intent.approved');
      expect(body.tenantId).toBe('tenant-456');
      expect(body.data.intentId).toBe('intent-123');
      expect(body.data.approvedBy).toBe('admin');
      expect(body.data.approvalReason).toBe('Meets all criteria');
      expect(body.timestamp).toBeDefined();
      expect(body.id).toBeDefined();
    });

    it('should format intent.denied payload correctly', async () => {
      await service.notifyIntent('intent.denied', 'intent-123', 'tenant-456', {
        deniedBy: 'security-team',
        denialReason: 'Policy violation',
      });

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.eventType).toBe('intent.denied');
      expect(body.data.intentId).toBe('intent-123');
      expect(body.data.deniedBy).toBe('security-team');
      expect(body.data.denialReason).toBe('Policy violation');
    });

    it('should format intent.completed payload correctly', async () => {
      await service.notifyIntent('intent.completed', 'intent-123', 'tenant-456', {
        completedAt: new Date().toISOString(),
        result: 'success',
      });

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.eventType).toBe('intent.completed');
      expect(body.data.intentId).toBe('intent-123');
      expect(body.data.result).toBe('success');
    });

    it('should handle notifications without additional data', async () => {
      await service.notifyIntent('intent.approved', 'intent-123', 'tenant-456');

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.eventType).toBe('intent.approved');
      expect(body.data.intentId).toBe('intent-123');
    });
  });

  describe('Delivery Result Storage', () => {
    const mockEscalation: EscalationRecord = {
      id: 'esc-123',
      intentId: 'intent-456',
      tenantId: 'tenant-789',
      reason: 'Test',
      reasonCategory: 'trust_insufficient',
      escalatedTo: 'team',
      status: 'pending',
      timeout: 'PT1H',
      timeoutAt: new Date(Date.now() + 3600000).toISOString(),
      slaBreached: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockWebhookConfig: WebhookConfig = {
      url: 'https://api.example.com/webhook',
      enabled: true,
      events: ['escalation.created'],
    };

    beforeEach(() => {
      mockDnsLookup.mockImplementation((hostname: string, callback: Function) => {
        callback(null, { address: '93.184.216.34', family: 4 });
      });
      mockRedis.smembers.mockResolvedValue(['webhook-1']);
      mockRedis.get.mockResolvedValue(JSON.stringify(mockWebhookConfig));
      mockFetch.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });
    });

    it('should store delivery result in Redis', async () => {
      await service.notifyEscalation('escalation.created', mockEscalation);

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^webhook:delivery:tenant-789:webhook-1:/),
        expect.any(String),
        'EX',
        604800 // 7 days in seconds
      );
    });

    it('should add delivery ID to sorted set index', async () => {
      await service.notifyEscalation('escalation.created', mockEscalation);

      // Verify zadd was called to add entry to sorted set
      expect(mockRedis.zadd).toHaveBeenCalledWith(
        'webhook:delivery-index:tenant-789:webhook-1',
        expect.any(Number), // timestamp
        expect.stringMatching(/^\d+:/) // "timestamp:deliveryId" format
      );

      // Verify expire was called on the index
      expect(mockRedis.expire).toHaveBeenCalledWith(
        'webhook:delivery-index:tenant-789:webhook-1',
        604800
      );
    });

    it('should store successful delivery result', async () => {
      await service.notifyEscalation('escalation.created', mockEscalation);

      const setCall = mockRedis.set.mock.calls.find((call: any) =>
        call[0].startsWith('webhook:delivery:')
      );

      expect(setCall).toBeDefined();
      const storedResult = JSON.parse(setCall[1]);
      expect(storedResult.success).toBe(true);
      expect(storedResult.statusCode).toBe(200);
      expect(storedResult.attempts).toBe(1);
      expect(storedResult.deliveredAt).toBeDefined();
    });

    it('should store failed delivery result', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' });

      const promise = service.notifyEscalation('escalation.created', mockEscalation);

      // Fast-forward through retry delays
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);

      await promise;

      const setCall = mockRedis.set.mock.calls.find((call: any) =>
        call[0].startsWith('webhook:delivery:')
      );

      expect(setCall).toBeDefined();
      const storedResult = JSON.parse(setCall[1]);
      expect(storedResult.success).toBe(false);
      expect(storedResult.attempts).toBe(3);
      expect(storedResult.error).toContain('500');
    });
  });

  describe('Get Deliveries', () => {
    it('should return recent deliveries for a webhook using sorted set index', async () => {
      const delivery1 = { success: true, statusCode: 200, attempts: 1, deliveredAt: '2024-01-01T00:00:00Z' };
      const delivery2 = { success: false, statusCode: 500, attempts: 3, error: 'Server error' };

      // Mock zrevrange to return index entries (most recent first)
      mockRedis.zrevrange.mockResolvedValue([
        '1704067200000:delivery-2', // More recent
        '1704067100000:delivery-1', // Older
      ]);
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(delivery2))
        .mockResolvedValueOnce(JSON.stringify(delivery1));

      const deliveries = await service.getDeliveries('tenant-123', 'webhook-456');

      expect(deliveries).toHaveLength(2);
      // Should use zrevrange instead of keys
      expect(mockRedis.zrevrange).toHaveBeenCalledWith(
        'webhook:delivery-index:tenant-123:webhook-456',
        0,
        99 // limit - 1
      );
      // keys should NOT be called (this was the performance issue)
      expect(mockRedis.keys).not.toHaveBeenCalled();
    });

    it('should respect limit parameter', async () => {
      mockRedis.zrevrange.mockResolvedValue([
        '1704067200000:delivery-3',
        '1704067100000:delivery-2',
      ]);
      mockRedis.get.mockResolvedValue(JSON.stringify({ success: true }));

      await service.getDeliveries('tenant-123', 'webhook-456', 2);

      // zrevrange should be called with limit - 1
      expect(mockRedis.zrevrange).toHaveBeenCalledWith(
        'webhook:delivery-index:tenant-123:webhook-456',
        0,
        1 // limit - 1 = 2 - 1 = 1
      );
      // Only get the 2 deliveries
      expect(mockRedis.get).toHaveBeenCalledTimes(2);
    });

    it('should return empty array when no deliveries exist', async () => {
      mockRedis.zrevrange.mockResolvedValue([]);

      const deliveries = await service.getDeliveries('tenant-123', 'webhook-456');

      expect(deliveries).toEqual([]);
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('should clean up stale index entries when delivery data has expired', async () => {
      mockRedis.zrevrange.mockResolvedValue([
        '1704067200000:delivery-2',
        '1704067100000:delivery-1', // This one's data is missing (expired)
      ]);
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify({ success: true }))
        .mockResolvedValueOnce(null); // Data expired

      const deliveries = await service.getDeliveries('tenant-123', 'webhook-456');

      expect(deliveries).toHaveLength(1);
      // Should have cleaned up the stale index entry
      expect(mockRedis.zrem).toHaveBeenCalledWith(
        'webhook:delivery-index:tenant-123:webhook-456',
        '1704067100000:delivery-1'
      );
    });

    it('should extract delivery ID correctly from index entry', async () => {
      mockRedis.zrevrange.mockResolvedValue(['1704067200000:my-uuid-delivery-id']);
      mockRedis.get.mockResolvedValue(JSON.stringify({ success: true, attempts: 1 }));

      const deliveries = await service.getDeliveries('tenant-123', 'webhook-456');

      expect(deliveries).toHaveLength(1);
      expect(deliveries[0].id).toBe('my-uuid-delivery-id');
      expect(mockRedis.get).toHaveBeenCalledWith(
        'webhook:delivery:tenant-123:webhook-456:my-uuid-delivery-id'
      );
    });
  });

  describe('Cleanup Delivery Index', () => {
    it('should remove stale index entries', async () => {
      mockRedis.zrange.mockResolvedValue([
        '1704067100000:delivery-1',
        '1704067200000:delivery-2',
      ]);
      mockRedis.exists
        .mockResolvedValueOnce(0) // delivery-1 data is gone
        .mockResolvedValueOnce(1); // delivery-2 data exists

      const cleanedCount = await service.cleanupDeliveryIndex('tenant-123', 'webhook-456');

      expect(cleanedCount).toBe(1);
      expect(mockRedis.zrem).toHaveBeenCalledWith(
        'webhook:delivery-index:tenant-123:webhook-456',
        '1704067100000:delivery-1'
      );
      expect(mockRedis.zrem).toHaveBeenCalledTimes(1);
    });

    it('should return 0 when no stale entries', async () => {
      mockRedis.zrange.mockResolvedValue([
        '1704067100000:delivery-1',
        '1704067200000:delivery-2',
      ]);
      mockRedis.exists.mockResolvedValue(1); // All data exists

      const cleanedCount = await service.cleanupDeliveryIndex('tenant-123', 'webhook-456');

      expect(cleanedCount).toBe(0);
      expect(mockRedis.zrem).not.toHaveBeenCalled();
    });

    it('should log when entries are cleaned', async () => {
      mockRedis.zrange.mockResolvedValue(['1704067100000:delivery-1']);
      mockRedis.exists.mockResolvedValue(0);

      await service.cleanupDeliveryIndex('tenant-123', 'webhook-456');

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-123',
          webhookId: 'webhook-456',
          cleanedCount: 1,
        }),
        'Cleaned up stale delivery index entries'
      );
    });
  });

  describe('HMAC Signature Verification', () => {
    it('should generate verifiable HMAC signature', async () => {
      const mockWebhookConfig: WebhookConfig = {
        url: 'https://api.example.com/webhook',
        secret: 'my-webhook-secret',
        enabled: true,
        events: ['escalation.created'],
      };

      mockDnsLookup.mockImplementation((hostname: string, callback: Function) => {
        callback(null, { address: '93.184.216.34', family: 4 });
      });
      mockRedis.smembers.mockResolvedValue(['webhook-1']);
      mockRedis.get.mockResolvedValue(JSON.stringify(mockWebhookConfig));
      mockFetch.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });

      const mockEscalation: EscalationRecord = {
        id: 'esc-123',
        intentId: 'intent-456',
        tenantId: 'tenant-789',
        reason: 'Test',
        reasonCategory: 'trust_insufficient',
        escalatedTo: 'team',
        status: 'pending',
        timeout: 'PT1H',
        timeoutAt: new Date(Date.now() + 3600000).toISOString(),
        slaBreached: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await service.notifyEscalation('escalation.created', mockEscalation);

      const fetchCall = mockFetch.mock.calls[0];
      const body = fetchCall[1].body;
      const signature = fetchCall[1].headers['X-Webhook-Signature'];

      // Verify the signature matches what we'd compute
      const expectedSignature = `sha256=${createHmac('sha256', 'my-webhook-secret').update(body).digest('hex')}`;
      expect(signature).toBe(expectedSignature);

      // Simulate receiver-side verification
      const receivedSignature = signature;
      const computedSignature = `sha256=${createHmac('sha256', 'my-webhook-secret').update(body).digest('hex')}`;

      expect(receivedSignature).toBe(computedSignature);
    });
  });

  describe('createWebhookService', () => {
    it('should create a new WebhookService instance', async () => {
      const { createWebhookService } = await import('../../../src/intent/webhooks.js');

      const newService = createWebhookService();

      expect(newService).toBeInstanceOf(WebhookService);
    });
  });
});
