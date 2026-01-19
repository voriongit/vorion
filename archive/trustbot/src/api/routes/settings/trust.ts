/**
 * Trust Configuration API Routes
 *
 * Epic 11: Live Trust Scoring Engine
 * Story 11.5: Organization Trust Configuration
 *
 * Allows organizations to customize trust scoring weights,
 * decay periods, and tier thresholds.
 */

import { Hono } from 'hono';
import {
    getTrustScoreCalculator,
    type ScoringConfig,
    type TrustEventConfig,
    type TrustEventType,
    DEFAULT_EVENT_CONFIG,
} from '../../../services/TrustScoreCalculator.js';
import {
    getTierManager,
    type TierDefinition,
    type TierLevel,
    DEFAULT_TIERS,
} from '../../../services/TierManager.js';

// ============================================================================
// Types
// ============================================================================

export interface TrustConfigResponse {
    success: boolean;
    data?: OrganizationTrustConfig;
    error?: string;
}

export interface OrganizationTrustConfig {
    orgId: string;
    scoring: {
        events: Record<TrustEventType, TrustEventConfig>;
        minScore: number;
        maxScore: number;
        baseScore: number;
        decayFunction: 'linear' | 'exponential';
    };
    tiers: TierDefinition[];
}

export interface TrustConfigUpdate {
    scoring?: Partial<{
        events: Partial<Record<TrustEventType, Partial<TrustEventConfig>>>;
        minScore: number;
        maxScore: number;
        baseScore: number;
        decayFunction: 'linear' | 'exponential';
    }>;
    tiers?: Array<{
        level: TierLevel;
        minScore: number;
        maxScore: number;
        capabilities?: string[];
        maxConcurrentTasks?: number;
        description?: string;
    }>;
}

export interface ConfigPreviewResult {
    agentId: string;
    currentScore: number;
    currentTier: TierLevel;
    projectedTier: TierLevel;
    tierChange: 'promotion' | 'demotion' | 'same';
    affectedCapabilities: {
        gained: string[];
        lost: string[];
    };
}

// ============================================================================
// Validation
// ============================================================================

const VALID_EVENT_TYPES: TrustEventType[] = [
    'task_completed',
    'task_reviewed_positive',
    'task_reviewed_negative',
    'task_failed',
    'task_timeout',
    'invalid_delegation',
    'security_violation',
    'manual_adjustment',
];

const VALID_TIER_LEVELS: TierLevel[] = [
    'UNTRUSTED',
    'PROBATIONARY',
    'TRUSTED',
    'VERIFIED',
    'CERTIFIED',
    'ELITE',
];

function validateTrustConfigUpdate(body: unknown): {
    valid: boolean;
    errors: string[];
    data?: TrustConfigUpdate;
} {
    const errors: string[] = [];

    if (!body || typeof body !== 'object') {
        return { valid: false, errors: ['Request body is required'] };
    }

    const data = body as Record<string, unknown>;

    // Validate scoring config
    if (data.scoring) {
        if (typeof data.scoring !== 'object') {
            errors.push('scoring must be an object');
        } else {
            const scoring = data.scoring as Record<string, unknown>;

            // Validate events
            if (scoring.events) {
                if (typeof scoring.events !== 'object') {
                    errors.push('scoring.events must be an object');
                } else {
                    const events = scoring.events as Record<string, unknown>;
                    for (const [eventType, config] of Object.entries(events)) {
                        if (!VALID_EVENT_TYPES.includes(eventType as TrustEventType)) {
                            errors.push(`Invalid event type: ${eventType}`);
                            continue;
                        }
                        if (typeof config !== 'object' || config === null) {
                            errors.push(`scoring.events.${eventType} must be an object`);
                            continue;
                        }
                        const eventConfig = config as Record<string, unknown>;
                        if (eventConfig.points !== undefined && typeof eventConfig.points !== 'number') {
                            errors.push(`scoring.events.${eventType}.points must be a number`);
                        }
                        if (eventConfig.decayDays !== undefined) {
                            if (typeof eventConfig.decayDays !== 'number') {
                                errors.push(`scoring.events.${eventType}.decayDays must be a number`);
                            } else if (eventConfig.decayDays < 1 || eventConfig.decayDays > 365) {
                                errors.push(`scoring.events.${eventType}.decayDays must be between 1 and 365`);
                            }
                        }
                    }
                }
            }

            // Validate score bounds
            if (scoring.minScore !== undefined) {
                if (typeof scoring.minScore !== 'number' || scoring.minScore < 0) {
                    errors.push('scoring.minScore must be a non-negative number');
                }
            }
            if (scoring.maxScore !== undefined) {
                if (typeof scoring.maxScore !== 'number' || scoring.maxScore <= 0) {
                    errors.push('scoring.maxScore must be a positive number');
                }
            }
            if (scoring.baseScore !== undefined) {
                if (typeof scoring.baseScore !== 'number') {
                    errors.push('scoring.baseScore must be a number');
                }
            }
            if (scoring.decayFunction !== undefined) {
                if (scoring.decayFunction !== 'linear' && scoring.decayFunction !== 'exponential') {
                    errors.push('scoring.decayFunction must be "linear" or "exponential"');
                }
            }
        }
    }

    // Validate tiers
    if (data.tiers) {
        if (!Array.isArray(data.tiers)) {
            errors.push('tiers must be an array');
        } else {
            for (let i = 0; i < data.tiers.length; i++) {
                const tier = data.tiers[i] as Record<string, unknown>;

                if (!tier.level || !VALID_TIER_LEVELS.includes(tier.level as TierLevel)) {
                    errors.push(`tiers[${i}].level must be a valid tier level`);
                }
                if (typeof tier.minScore !== 'number' || tier.minScore < 0) {
                    errors.push(`tiers[${i}].minScore must be a non-negative number`);
                }
                if (typeof tier.maxScore !== 'number' || tier.maxScore <= 0) {
                    errors.push(`tiers[${i}].maxScore must be a positive number`);
                }
                if (tier.minScore !== undefined && tier.maxScore !== undefined) {
                    if ((tier.minScore as number) > (tier.maxScore as number)) {
                        errors.push(`tiers[${i}].minScore cannot be greater than maxScore`);
                    }
                }
            }

            // Check for tier gaps and overlaps
            if (data.tiers.length > 0 && errors.length === 0) {
                const sortedTiers = [...data.tiers].sort((a: any, b: any) => a.minScore - b.minScore);
                for (let i = 1; i < sortedTiers.length; i++) {
                    const prev = sortedTiers[i - 1] as Record<string, unknown>;
                    const curr = sortedTiers[i] as Record<string, unknown>;
                    if ((prev.maxScore as number) >= (curr.minScore as number)) {
                        errors.push('Tier score ranges cannot overlap');
                        break;
                    }
                }
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        data: errors.length === 0 ? (data as TrustConfigUpdate) : undefined,
    };
}

// ============================================================================
// Route Handler
// ============================================================================

const trustSettingsRouter = new Hono();

/**
 * GET /api/v1/settings/trust/:orgId
 * Get current trust configuration for an organization
 */
trustSettingsRouter.get('/:orgId', async (c) => {
    const orgId = c.req.param('orgId');

    try {
        const calculator = getTrustScoreCalculator();
        const tierManager = getTierManager();

        const scoringConfig = calculator.getOrgConfig(orgId);
        const tiers = tierManager.getAllTiers(orgId);

        const config: OrganizationTrustConfig = {
            orgId,
            scoring: {
                events: scoringConfig.events,
                minScore: scoringConfig.minScore,
                maxScore: scoringConfig.maxScore,
                baseScore: scoringConfig.baseScore,
                decayFunction: scoringConfig.decayFunction,
            },
            tiers,
        };

        return c.json({
            success: true,
            data: config,
        } as TrustConfigResponse);
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get trust config',
            } as TrustConfigResponse,
            500
        );
    }
});

/**
 * PUT /api/v1/settings/trust/:orgId
 * Update trust configuration for an organization
 */
trustSettingsRouter.put('/:orgId', async (c) => {
    const orgId = c.req.param('orgId');

    try {
        const body = await c.req.json();
        const validation = validateTrustConfigUpdate(body);

        if (!validation.valid) {
            return c.json(
                {
                    success: false,
                    error: `Validation failed: ${validation.errors.join(', ')}`,
                } as TrustConfigResponse,
                400
            );
        }

        const update = validation.data!;
        const calculator = getTrustScoreCalculator();
        const tierManager = getTierManager();

        // Update scoring config
        if (update.scoring) {
            const currentConfig = calculator.getOrgConfig(orgId);

            // Merge events
            const mergedEvents = { ...currentConfig.events };
            if (update.scoring.events) {
                for (const [eventType, config] of Object.entries(update.scoring.events)) {
                    if (config) {
                        mergedEvents[eventType as TrustEventType] = {
                            ...mergedEvents[eventType as TrustEventType],
                            ...config,
                        };
                    }
                }
            }

            calculator.setOrgConfig(orgId, {
                events: mergedEvents,
                minScore: update.scoring.minScore ?? currentConfig.minScore,
                maxScore: update.scoring.maxScore ?? currentConfig.maxScore,
                baseScore: update.scoring.baseScore ?? currentConfig.baseScore,
                decayFunction: update.scoring.decayFunction ?? currentConfig.decayFunction,
            });
        }

        // Update tier config
        if (update.tiers) {
            const tierDefs: TierDefinition[] = update.tiers.map((t) => ({
                level: t.level,
                minScore: t.minScore,
                maxScore: t.maxScore,
                capabilities: (t.capabilities || []) as any,
                maxConcurrentTasks: t.maxConcurrentTasks ?? 0,
                description: t.description || '',
            }));

            tierManager.setOrgTiers(orgId, tierDefs);
        }

        // Return updated config
        const scoringConfig = calculator.getOrgConfig(orgId);
        const tiers = tierManager.getAllTiers(orgId);

        return c.json({
            success: true,
            data: {
                orgId,
                scoring: {
                    events: scoringConfig.events,
                    minScore: scoringConfig.minScore,
                    maxScore: scoringConfig.maxScore,
                    baseScore: scoringConfig.baseScore,
                    decayFunction: scoringConfig.decayFunction,
                },
                tiers,
            },
        } as TrustConfigResponse);
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update trust config',
            } as TrustConfigResponse,
            500
        );
    }
});

/**
 * POST /api/v1/settings/trust/:orgId/preview
 * Preview the impact of configuration changes
 */
trustSettingsRouter.post('/:orgId/preview', async (c) => {
    const orgId = c.req.param('orgId');

    try {
        const body = await c.req.json();
        const validation = validateTrustConfigUpdate(body);

        if (!validation.valid) {
            return c.json(
                {
                    success: false,
                    error: `Validation failed: ${validation.errors.join(', ')}`,
                },
                400
            );
        }

        const update = validation.data!;
        const calculator = getTrustScoreCalculator();
        const tierManager = getTierManager();

        // Get current org scores
        const orgScores = calculator.getOrgScores(orgId);

        // Build proposed tier config
        let proposedTiers = tierManager.getAllTiers(orgId);
        if (update.tiers) {
            proposedTiers = update.tiers.map((t) => ({
                level: t.level,
                minScore: t.minScore,
                maxScore: t.maxScore,
                capabilities: (t.capabilities || []) as any,
                maxConcurrentTasks: t.maxConcurrentTasks ?? 0,
                description: t.description || '',
            }));
        }

        const results: ConfigPreviewResult[] = [];

        for (const [agentId, currentScore] of orgScores) {
            const currentState = tierManager.getAgentState(agentId);
            if (!currentState) continue;

            // Find projected tier
            const projectedTierDef = proposedTiers.find(
                (t) => currentScore >= t.minScore && currentScore <= t.maxScore
            ) || proposedTiers[0];

            // Skip if no tier definition found (shouldn't happen with valid config)
            if (!projectedTierDef) continue;

            const tierChange =
                projectedTierDef.level === currentState.currentTier
                    ? 'same'
                    : VALID_TIER_LEVELS.indexOf(projectedTierDef.level) >
                      VALID_TIER_LEVELS.indexOf(currentState.currentTier)
                    ? 'promotion'
                    : 'demotion';

            // Calculate capability changes
            const currentCaps = new Set(currentState.capabilities);
            const projectedCaps = new Set(projectedTierDef.capabilities);

            const gained = [...projectedCaps].filter((c) => !currentCaps.has(c));
            const lost = [...currentCaps].filter((c) => !projectedCaps.has(c as any));

            results.push({
                agentId,
                currentScore,
                currentTier: currentState.currentTier,
                projectedTier: projectedTierDef.level,
                tierChange,
                affectedCapabilities: {
                    gained,
                    lost,
                },
            });
        }

        return c.json({
            success: true,
            data: {
                orgId,
                affectedAgents: results.length,
                promotions: results.filter((r) => r.tierChange === 'promotion').length,
                demotions: results.filter((r) => r.tierChange === 'demotion').length,
                unchanged: results.filter((r) => r.tierChange === 'same').length,
                agents: results,
            },
        });
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to preview changes',
            },
            500
        );
    }
});

/**
 * POST /api/v1/settings/trust/:orgId/reset
 * Reset trust configuration to defaults
 */
trustSettingsRouter.post('/:orgId/reset', async (c) => {
    const orgId = c.req.param('orgId');

    try {
        const calculator = getTrustScoreCalculator();
        const tierManager = getTierManager();

        // Reset to defaults by setting the default config
        calculator.setOrgConfig(orgId, {
            events: { ...DEFAULT_EVENT_CONFIG },
            minScore: 0,
            maxScore: 1000,
            baseScore: 300,
            decayFunction: 'linear',
        });

        tierManager.setOrgTiers(orgId, [...DEFAULT_TIERS]);

        return c.json({
            success: true,
            data: {
                orgId,
                message: 'Trust configuration reset to defaults',
            },
        });
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to reset config',
            },
            500
        );
    }
});

/**
 * GET /api/v1/settings/trust/defaults
 * Get default trust configuration
 */
trustSettingsRouter.get('/defaults', async (c) => {
    return c.json({
        success: true,
        data: {
            scoring: {
                events: DEFAULT_EVENT_CONFIG,
                minScore: 0,
                maxScore: 1000,
                baseScore: 300,
                decayFunction: 'linear',
            },
            tiers: DEFAULT_TIERS,
        },
    });
});

export default trustSettingsRouter;
export { trustSettingsRouter };
