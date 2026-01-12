/**
 * API Handlers - Request handlers for A3I endpoints
 */

import type { Context } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import {
  type Intent,
  type TrustEvidence,
  type ObservationTier,
  TrustBand,
  intentSchema,
  trustCalculationRequestSchema,
} from '@orion/contracts';
import {
  TrustProfileService,
  type ProfileQueryFilter,
  type ProfileQueryOptions,
} from '../trust/profile-service.js';
import {
  AuthorizationEngine,
  type AuthorizeRequest,
} from '../authorization/engine.js';
import { DEFAULT_BANDING_CONFIG } from '@orion/contracts';
import { ValidationError } from './middleware.js';

/**
 * Handler context with services
 */
export interface HandlerContext {
  profileService: TrustProfileService;
  authEngine: AuthorizationEngine;
}

/**
 * Create handlers with injected services
 */
export function createHandlers(context: HandlerContext) {
  const { profileService, authEngine } = context;

  return {
    /**
     * POST /api/v1/authorize
     * Authorize an intent
     */
    async authorize(c: Context) {
      const body = await c.req.json();

      // Validate intent structure
      const parseResult = intentSchema.safeParse(body.intent);
      if (!parseResult.success) {
        throw new ValidationError('Invalid intent', parseResult.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })));
      }

      const intent: Intent = {
        ...parseResult.data,
        intentId: parseResult.data.intentId || uuidv4(),
        correlationId: parseResult.data.correlationId || c.get('requestId') || uuidv4(),
        createdAt: parseResult.data.createdAt || new Date(),
      };

      const request: AuthorizeRequest = {
        intent,
        policySetId: body.policySetId,
        constraintOptions: body.constraintOptions,
      };

      const response = await authEngine.authorize(request);

      return c.json({
        decision: {
          ...response.decision,
          decidedAt: response.decision.decidedAt.toISOString(),
          expiresAt: response.decision.expiresAt.toISOString(),
        },
        remediations: response.remediations,
      });
    },

    /**
     * GET /api/v1/trust/:agentId
     * Get trust profile for an agent
     */
    async getTrustProfile(c: Context) {
      const agentId = c.req.param('agentId');

      if (!agentId) {
        throw new ValidationError('Missing agentId', [
          { path: 'agentId', message: 'Agent ID is required' },
        ]);
      }

      const profile = await profileService.get(agentId);

      if (!profile) {
        return c.json({ error: { code: 'NOT_FOUND', message: `No profile found for agent ${agentId}` } }, 404);
      }

      return c.json({
        profile: {
          ...profile,
          calculatedAt: profile.calculatedAt.toISOString(),
          validUntil: profile.validUntil?.toISOString(),
          evidence: profile.evidence.map((e) => ({
            ...e,
            collectedAt: e.collectedAt.toISOString(),
            expiresAt: e.expiresAt?.toISOString(),
          })),
        },
      });
    },

    /**
     * GET /api/v1/trust
     * List trust profiles with filters
     */
    async listTrustProfiles(c: Context) {
      const query = c.req.query();

      const filter: ProfileQueryFilter = {};
      const options: ProfileQueryOptions = {};

      // Parse query parameters
      if (query.agentIds) {
        filter.agentIds = query.agentIds.split(',');
      }
      if (query.minScore) {
        filter.minScore = parseFloat(query.minScore);
      }
      if (query.maxScore) {
        filter.maxScore = parseFloat(query.maxScore);
      }
      if (query.bands) {
        filter.bands = query.bands.split(',').map(Number);
      }
      if (query.limit) {
        options.limit = parseInt(query.limit, 10);
      }
      if (query.offset) {
        options.offset = parseInt(query.offset, 10);
      }
      if (query.orderBy) {
        options.orderBy = query.orderBy as 'calculatedAt' | 'adjustedScore' | 'agentId';
      }
      if (query.orderDir) {
        options.orderDir = query.orderDir as 'asc' | 'desc';
      }

      const result = await profileService.query(filter, options);

      return c.json({
        profiles: result.profiles.map((p) => ({
          agentId: p.agentId,
          compositeScore: p.compositeScore,
          adjustedScore: p.adjustedScore,
          band: p.band,
          bandName: TrustBand[p.band],
          observationTier: p.observationTier,
          calculatedAt: p.calculatedAt.toISOString(),
        })),
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
        },
      });
    },

    /**
     * POST /api/v1/trust/calculate
     * Calculate trust for an agent
     */
    async calculateTrust(c: Context) {
      const body = await c.req.json();

      // Validate request
      const parseResult = trustCalculationRequestSchema.safeParse(body);
      if (!parseResult.success) {
        throw new ValidationError('Invalid calculation request', parseResult.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })));
      }

      const { agentId, observationTier, evidence, weights } = parseResult.data;

      // Check if profile exists
      const existing = await profileService.get(agentId);

      let result;
      if (existing) {
        // Recalculate existing profile
        result = await profileService.update(agentId, evidence as TrustEvidence[], {
          weights: weights,
        });
      } else {
        // Create new profile
        result = await profileService.create(
          agentId,
          observationTier as ObservationTier,
          evidence as TrustEvidence[],
          { weights: weights }
        );
      }

      if (!result.success) {
        return c.json({ error: { code: 'CALCULATION_FAILED', message: result.error } }, 400);
      }

      return c.json({
        profile: {
          ...result.profile,
          calculatedAt: result.profile!.calculatedAt.toISOString(),
          validUntil: result.profile!.validUntil?.toISOString(),
          evidence: result.profile!.evidence.map((e) => ({
            ...e,
            collectedAt: e.collectedAt instanceof Date ? e.collectedAt.toISOString() : e.collectedAt,
            expiresAt: e.expiresAt instanceof Date ? e.expiresAt.toISOString() : e.expiresAt,
          })),
        },
        isNew: result.isNew,
        previousVersion: result.previousVersion,
      });
    },

    /**
     * DELETE /api/v1/trust/:agentId
     * Delete a trust profile
     */
    async deleteTrustProfile(c: Context) {
      const agentId = c.req.param('agentId');

      if (!agentId) {
        throw new ValidationError('Missing agentId', [
          { path: 'agentId', message: 'Agent ID is required' },
        ]);
      }

      const deleted = await profileService.delete(agentId);

      if (!deleted) {
        return c.json({ error: { code: 'NOT_FOUND', message: `No profile found for agent ${agentId}` } }, 404);
      }

      return c.json({ success: true, agentId });
    },

    /**
     * GET /api/v1/trust/:agentId/history
     * Get trust profile history
     */
    async getTrustHistory(c: Context) {
      const agentId = c.req.param('agentId');
      const limit = parseInt(c.req.query('limit') ?? '50', 10);

      if (!agentId) {
        throw new ValidationError('Missing agentId', [
          { path: 'agentId', message: 'Agent ID is required' },
        ]);
      }

      const history = await profileService.getHistory(agentId, limit);

      return c.json({
        agentId,
        history: history.map((entry) => ({
          profile: {
            profileId: entry.profile.profileId,
            compositeScore: entry.profile.compositeScore,
            adjustedScore: entry.profile.adjustedScore,
            band: entry.profile.band,
            bandName: TrustBand[entry.profile.band],
            version: entry.profile.version,
          },
          timestamp: entry.timestamp.toISOString(),
          reason: entry.reason,
        })),
      });
    },

    /**
     * GET /api/v1/bands
     * Get band configuration
     */
    async getBands(c: Context) {
      const thresholds = DEFAULT_BANDING_CONFIG.thresholds;

      const bands = Object.entries(TrustBand)
        .filter(([key]) => !isNaN(Number(key)))
        .map(([value, name]) => {
          const bandKey = `T${value}` as keyof typeof thresholds;
          const threshold = thresholds[bandKey];
          return {
            band: parseInt(value, 10),
            name: name as string,
            minScore: threshold?.min ?? 0,
            maxScore: threshold?.max ?? 100,
          };
        });

      return c.json({
        bands,
        config: {
          hysteresis: DEFAULT_BANDING_CONFIG.hysteresis,
          decayRate: DEFAULT_BANDING_CONFIG.decayRate,
          promotionDelay: DEFAULT_BANDING_CONFIG.promotionDelay,
        },
      });
    },

    /**
     * GET /api/v1/health
     * Health check endpoint
     */
    async health(c: Context) {
      return c.json({
        status: 'healthy',
        service: 'a3i',
        timestamp: new Date().toISOString(),
      });
    },

    /**
     * GET /api/v1/info
     * Service information
     */
    async info(c: Context) {
      return c.json({
        service: 'A3I - Agent Anchor AI Trust Engine',
        version: '0.1.0',
        endpoints: [
          { method: 'POST', path: '/api/v1/authorize', description: 'Authorize an intent' },
          { method: 'GET', path: '/api/v1/trust/:agentId', description: 'Get trust profile' },
          { method: 'GET', path: '/api/v1/trust', description: 'List trust profiles' },
          { method: 'POST', path: '/api/v1/trust/calculate', description: 'Calculate trust' },
          { method: 'DELETE', path: '/api/v1/trust/:agentId', description: 'Delete trust profile' },
          { method: 'GET', path: '/api/v1/trust/:agentId/history', description: 'Get trust history' },
          { method: 'GET', path: '/api/v1/bands', description: 'Get band configuration' },
          { method: 'GET', path: '/api/v1/health', description: 'Health check' },
        ],
      });
    },
  };
}

export type Handlers = ReturnType<typeof createHandlers>;
