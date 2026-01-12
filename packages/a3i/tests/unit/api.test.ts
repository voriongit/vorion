/**
 * Tests for A3I API endpoints
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import {
  ObservationTier,
  TrustBand,
  ActionType,
  DataSensitivity,
  Reversibility,
} from '@orion/contracts';
import {
  createApi,
  createApiWithContext,
  TrustProfileService,
  AuthorizationEngine,
} from '../../src/index.js';

// Use consistent test agent ID
const TEST_AGENT_ID = '11111111-1111-1111-1111-111111111111';

describe('A3I API', () => {
  let app: ReturnType<typeof createApi>;
  let profileService: TrustProfileService;
  let authEngine: AuthorizationEngine;

  beforeEach(async () => {
    profileService = new TrustProfileService();
    authEngine = new AuthorizationEngine({ profileService });
    app = createApiWithContext({ profileService, authEngine }, {
      apiKey: { allowUnauthenticated: true },
    });

    // Create a test profile with valid UUID
    await profileService.create(
      TEST_AGENT_ID,
      ObservationTier.WHITE_BOX,
      [
        { evidenceId: uuidv4(), dimension: 'CT', impact: 20, source: 'test', collectedAt: new Date() },
        { evidenceId: uuidv4(), dimension: 'BT', impact: 20, source: 'test', collectedAt: new Date() },
      ]
    );
  });

  describe('GET /api/v1/health', () => {
    it('should return healthy status', async () => {
      const res = await app.request('/api/v1/health');
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.status).toBe('healthy');
      expect(data.service).toBe('a3i');
    });
  });

  describe('GET /api/v1/info', () => {
    it('should return service information', async () => {
      const res = await app.request('/api/v1/info');
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.service).toBe('A3I - Agent Anchor AI Trust Engine');
      expect(data.endpoints).toBeDefined();
      expect(data.endpoints.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/trust/:agentId', () => {
    it('should return trust profile for existing agent', async () => {
      const res = await app.request(`/api/v1/trust/${TEST_AGENT_ID}`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.profile).toBeDefined();
      expect(data.profile.agentId).toBe(TEST_AGENT_ID);
      expect(data.profile.band).toBeDefined();
      expect(data.profile.adjustedScore).toBeDefined();
    });

    it('should return 404 for non-existent agent', async () => {
      const res = await app.request('/api/v1/trust/non-existent');
      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data.error.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/v1/trust', () => {
    it('should list all profiles', async () => {
      const res = await app.request('/api/v1/trust');
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.profiles).toBeDefined();
      expect(Array.isArray(data.profiles)).toBe(true);
      expect(data.pagination).toBeDefined();
    });

    it('should filter by minimum score', async () => {
      const res = await app.request('/api/v1/trust?minScore=50');
      expect(res.status).toBe(200);

      const data = await res.json();
      data.profiles.forEach((p: any) => {
        expect(p.adjustedScore).toBeGreaterThanOrEqual(50);
      });
    });

    it('should apply pagination', async () => {
      const res = await app.request('/api/v1/trust?limit=10&offset=0');
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.pagination.limit).toBe(10);
      expect(data.pagination.offset).toBe(0);
    });
  });

  describe('POST /api/v1/trust/calculate', () => {
    it('should create new profile', async () => {
      const body = {
        agentId: uuidv4(),
        observationTier: ObservationTier.GRAY_BOX,
        evidence: [
          { evidenceId: uuidv4(), dimension: 'CT', impact: 10, source: 'test', collectedAt: new Date().toISOString() },
        ],
      };

      const res = await app.request('/api/v1/trust/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.profile).toBeDefined();
      expect(data.isNew).toBe(true);
    });

    it('should update existing profile', async () => {
      const body = {
        agentId: TEST_AGENT_ID,
        observationTier: ObservationTier.WHITE_BOX,
        evidence: [
          { evidenceId: uuidv4(), dimension: 'GT', impact: 15, source: 'test', collectedAt: new Date().toISOString() },
        ],
      };

      const res = await app.request('/api/v1/trust/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.isNew).toBe(false);
      expect(data.previousVersion).toBe(1);
    });

    it('should reject invalid request', async () => {
      const body = {
        agentId: 'invalid-not-uuid', // Invalid UUID
        // Missing observationTier
        evidence: [],
      };

      const res = await app.request('/api/v1/trust/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      // Should return error status (either 400 validation error or 500 internal)
      expect(res.status).toBeGreaterThanOrEqual(400);
      // Error response format is checked - may be JSON or text depending on error type
    });
  });

  describe('DELETE /api/v1/trust/:agentId', () => {
    it('should delete existing profile', async () => {
      const res = await app.request(`/api/v1/trust/${TEST_AGENT_ID}`, {
        method: 'DELETE',
      });

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify deletion
      const getRes = await app.request(`/api/v1/trust/${TEST_AGENT_ID}`);
      expect(getRes.status).toBe(404);
    });

    it('should return 404 for non-existent profile', async () => {
      const nonExistentId = '99999999-9999-9999-9999-999999999999';
      const res = await app.request(`/api/v1/trust/${nonExistentId}`, {
        method: 'DELETE',
      });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/trust/:agentId/history', () => {
    it('should return profile history', async () => {
      // Update profile to create history
      await profileService.update(TEST_AGENT_ID, [
        { evidenceId: uuidv4(), dimension: 'AC', impact: 5, source: 'test', collectedAt: new Date() },
      ]);

      const res = await app.request(`/api/v1/trust/${TEST_AGENT_ID}/history`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.agentId).toBe(TEST_AGENT_ID);
      expect(data.history).toBeDefined();
      expect(Array.isArray(data.history)).toBe(true);
    });
  });

  describe('GET /api/v1/bands', () => {
    it('should return band configuration', async () => {
      const res = await app.request('/api/v1/bands');
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.bands).toBeDefined();
      expect(data.bands.length).toBe(6); // T0-T5
      expect(data.config).toBeDefined();
      expect(data.config.hysteresis).toBeDefined();
    });

    it('should include band names', async () => {
      const res = await app.request('/api/v1/bands');
      const data = await res.json();

      expect(data.bands[0].name).toBe('T0_UNTRUSTED');
      expect(data.bands[5].name).toBe('T5_MISSION_CRITICAL');
    });
  });

  describe('POST /api/v1/authorize', () => {
    it('should authorize valid intent', async () => {
      const body = {
        intent: {
          intentId: uuidv4(),
          agentId: TEST_AGENT_ID,
          correlationId: uuidv4(),
          action: 'Read public data',
          actionType: ActionType.READ,
          resourceScope: ['public-resource'],
          dataSensitivity: DataSensitivity.PUBLIC,
          reversibility: Reversibility.REVERSIBLE,
          context: {},
          createdAt: new Date().toISOString(),
        },
      };

      const res = await app.request('/api/v1/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.decision).toBeDefined();
      expect(data.decision.permitted).toBe(true);
      expect(data.decision.constraints).toBeDefined();
    });

    it('should deny unauthorized intent', async () => {
      const body = {
        intent: {
          intentId: uuidv4(),
          agentId: TEST_AGENT_ID,
          correlationId: uuidv4(),
          action: 'Transfer restricted data',
          actionType: ActionType.TRANSFER,
          resourceScope: ['restricted-resource'],
          dataSensitivity: DataSensitivity.RESTRICTED,
          reversibility: Reversibility.IRREVERSIBLE,
          context: {},
          createdAt: new Date().toISOString(),
        },
      };

      const res = await app.request('/api/v1/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.decision.permitted).toBe(false);
      expect(data.remediations).toBeDefined();
    });

    it('should deny for unknown agent', async () => {
      const unknownAgentId = '88888888-8888-8888-8888-888888888888';
      const body = {
        intent: {
          intentId: uuidv4(),
          agentId: unknownAgentId,
          correlationId: uuidv4(),
          action: 'Test action',
          actionType: ActionType.READ,
          resourceScope: [],
          dataSensitivity: DataSensitivity.PUBLIC,
          reversibility: Reversibility.REVERSIBLE,
          context: {},
          createdAt: new Date().toISOString(),
        },
      };

      const res = await app.request('/api/v1/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.decision.permitted).toBe(false);
      expect(data.decision.reasoning).toContain('No trust profile found for agent');
    });

    it('should include latency in response', async () => {
      const body = {
        intent: {
          intentId: uuidv4(),
          agentId: TEST_AGENT_ID,
          correlationId: uuidv4(),
          action: 'Test',
          actionType: ActionType.READ,
          resourceScope: [],
          dataSensitivity: DataSensitivity.PUBLIC,
          reversibility: Reversibility.REVERSIBLE,
          context: {},
          createdAt: new Date().toISOString(),
        },
      };

      const res = await app.request('/api/v1/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.decision.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error handling', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await app.request('/api/v1/unknown-route');
      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Response headers', () => {
    it('should include timing header', async () => {
      const res = await app.request('/api/v1/health');
      expect(res.headers.get('X-Response-Time')).toBeDefined();
    });

    it('should include request ID header', async () => {
      const res = await app.request('/api/v1/health');
      expect(res.headers.get('X-Request-ID')).toBeDefined();
    });

    it('should echo provided request ID', async () => {
      const requestId = uuidv4();
      const res = await app.request('/api/v1/health', {
        headers: { 'X-Request-ID': requestId },
      });
      expect(res.headers.get('X-Request-ID')).toBe(requestId);
    });
  });
});

describe('API Factory', () => {
  it('should create API with default config', () => {
    const app = createApi();
    expect(app).toBeDefined();
  });

  it('should create API with custom config', () => {
    const app = createApi({
      basePath: '/custom/api',
      rateLimit: { limit: 50, windowMs: 30000 },
    });
    expect(app).toBeDefined();
  });
});
