/**
 * Automation Settings API Routes
 *
 * Epic 12: Decision Automation Pipeline
 * Story 12.8: Automation Threshold Configuration
 *
 * Allows directors to configure automation thresholds.
 */

import { Hono } from 'hono';
import {
    getAutomationConfigService,
    type AutomationConfigUpdate,
    type RiskLevel,
    type UrgencyLevel,
} from '../../../services/AutomationConfig.js';

// ============================================================================
// Types
// ============================================================================

export interface AutomationResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}

// ============================================================================
// Validation
// ============================================================================

const VALID_RISK_LEVELS: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
const VALID_URGENCY_LEVELS: UrgencyLevel[] = ['low', 'normal', 'high', 'immediate'];

function validateRiskLevel(value: string | undefined): RiskLevel | undefined {
    if (!value) return undefined;
    if (VALID_RISK_LEVELS.includes(value as RiskLevel)) {
        return value as RiskLevel;
    }
    return undefined;
}

function validateUrgencyLevel(value: string | undefined): UrgencyLevel | undefined {
    if (!value) return undefined;
    if (VALID_URGENCY_LEVELS.includes(value as UrgencyLevel)) {
        return value as UrgencyLevel;
    }
    return undefined;
}

// ============================================================================
// Route Handler
// ============================================================================

const automationSettingsRouter = new Hono();

/**
 * GET /api/v1/settings/automation/:orgId
 * Get all automation settings for an organization
 */
automationSettingsRouter.get('/:orgId', async (c) => {
    const orgId = c.req.param('orgId');

    try {
        const service = getAutomationConfigService();
        const settings = service.getSettings(orgId);

        return c.json({
            success: true,
            data: settings,
        } as AutomationResponse);
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get settings',
            } as AutomationResponse,
            500
        );
    }
});

/**
 * PUT /api/v1/settings/automation/:orgId
 * Update automation settings for an organization
 */
automationSettingsRouter.put('/:orgId', async (c) => {
    const orgId = c.req.param('orgId');

    try {
        const body = await c.req.json() as AutomationConfigUpdate;
        const service = getAutomationConfigService();

        // Validate update
        const validation = service.validateUpdate(body);
        if (!validation.valid) {
            return c.json(
                {
                    success: false,
                    error: `Validation failed: ${validation.errors.join(', ')}`,
                } as AutomationResponse,
                400
            );
        }

        const userId = c.req.header('X-User-ID');
        const settings = service.updateSettings(orgId, body, userId);

        return c.json({
            success: true,
            data: settings,
        } as AutomationResponse);
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update settings',
            } as AutomationResponse,
            500
        );
    }
});

/**
 * POST /api/v1/settings/automation/:orgId/reset
 * Reset settings to defaults
 */
automationSettingsRouter.post('/:orgId/reset', async (c) => {
    const orgId = c.req.param('orgId');

    try {
        const service = getAutomationConfigService();
        const settings = service.resetSettings(orgId);

        return c.json({
            success: true,
            data: settings,
        } as AutomationResponse);
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to reset settings',
            } as AutomationResponse,
            500
        );
    }
});

/**
 * GET /api/v1/settings/automation/:orgId/auto-approval
 * Get auto-approval settings
 */
automationSettingsRouter.get('/:orgId/auto-approval', async (c) => {
    const orgId = c.req.param('orgId');

    try {
        const service = getAutomationConfigService();
        const thresholds = service.getAutoApprovalThresholds(orgId);

        return c.json({
            success: true,
            data: thresholds,
        } as AutomationResponse);
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get auto-approval settings',
            } as AutomationResponse,
            500
        );
    }
});

/**
 * PUT /api/v1/settings/automation/:orgId/auto-approval
 * Update auto-approval settings
 */
automationSettingsRouter.put('/:orgId/auto-approval', async (c) => {
    const orgId = c.req.param('orgId');

    try {
        const body = await c.req.json();
        const service = getAutomationConfigService();

        const validation = service.validateUpdate({ autoApproval: body });
        if (!validation.valid) {
            return c.json(
                {
                    success: false,
                    error: `Validation failed: ${validation.errors.join(', ')}`,
                } as AutomationResponse,
                400
            );
        }

        const thresholds = service.updateAutoApprovalThresholds(orgId, body);

        return c.json({
            success: true,
            data: thresholds,
        } as AutomationResponse);
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update auto-approval settings',
            } as AutomationResponse,
            500
        );
    }
});

/**
 * POST /api/v1/settings/automation/:orgId/auto-approval/check
 * Check if an action is eligible for auto-approval
 */
automationSettingsRouter.post('/:orgId/auto-approval/check', async (c) => {
    const orgId = c.req.param('orgId');

    try {
        const body = await c.req.json();
        const { trustScore, actionType, riskLevel } = body;

        if (typeof trustScore !== 'number') {
            return c.json(
                {
                    success: false,
                    error: 'trustScore is required and must be a number',
                } as AutomationResponse,
                400
            );
        }

        if (!actionType || typeof actionType !== 'string') {
            return c.json(
                {
                    success: false,
                    error: 'actionType is required and must be a string',
                } as AutomationResponse,
                400
            );
        }

        const validatedRiskLevel = validateRiskLevel(riskLevel);
        if (riskLevel && !validatedRiskLevel) {
            return c.json(
                {
                    success: false,
                    error: `Invalid riskLevel. Valid values: ${VALID_RISK_LEVELS.join(', ')}`,
                } as AutomationResponse,
                400
            );
        }

        const service = getAutomationConfigService();
        const computedRiskLevel = validatedRiskLevel || service.classifyRisk(orgId, actionType, trustScore);
        const result = service.isAutoApprovalEligible(orgId, trustScore, actionType, computedRiskLevel);

        return c.json({
            success: true,
            data: {
                ...result,
                computedRiskLevel,
                trustScore,
                actionType,
            },
        } as AutomationResponse);
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to check eligibility',
            } as AutomationResponse,
            500
        );
    }
});

/**
 * GET /api/v1/settings/automation/:orgId/risk-classifications
 * Get risk classifications
 */
automationSettingsRouter.get('/:orgId/risk-classifications', async (c) => {
    const orgId = c.req.param('orgId');

    try {
        const service = getAutomationConfigService();
        const classifications = service.getRiskClassifications(orgId);

        return c.json({
            success: true,
            data: classifications,
        } as AutomationResponse);
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get risk classifications',
            } as AutomationResponse,
            500
        );
    }
});

/**
 * POST /api/v1/settings/automation/:orgId/risk-classifications/classify
 * Classify an action's risk level
 */
automationSettingsRouter.post('/:orgId/risk-classifications/classify', async (c) => {
    const orgId = c.req.param('orgId');

    try {
        const body = await c.req.json();
        const { actionType, trustScore } = body;

        if (!actionType || typeof actionType !== 'string') {
            return c.json(
                {
                    success: false,
                    error: 'actionType is required',
                } as AutomationResponse,
                400
            );
        }

        const service = getAutomationConfigService();
        const riskLevel = service.classifyRisk(
            orgId,
            actionType,
            typeof trustScore === 'number' ? trustScore : undefined
        );
        const riskScore = service.getRiskScore(orgId, actionType);

        return c.json({
            success: true,
            data: {
                actionType,
                riskLevel,
                riskScore,
            },
        } as AutomationResponse);
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to classify risk',
            } as AutomationResponse,
            500
        );
    }
});

/**
 * GET /api/v1/settings/automation/:orgId/timeouts
 * Get timeout configurations
 */
automationSettingsRouter.get('/:orgId/timeouts', async (c) => {
    const orgId = c.req.param('orgId');

    try {
        const service = getAutomationConfigService();
        const timeouts = service.getTimeoutConfigurations(orgId);

        return c.json({
            success: true,
            data: timeouts,
        } as AutomationResponse);
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get timeouts',
            } as AutomationResponse,
            500
        );
    }
});

/**
 * GET /api/v1/settings/automation/:orgId/timeouts/:urgency
 * Get timeout for specific urgency
 */
automationSettingsRouter.get('/:orgId/timeouts/:urgency', async (c) => {
    const orgId = c.req.param('orgId');
    const urgency = validateUrgencyLevel(c.req.param('urgency'));

    if (!urgency) {
        return c.json(
            {
                success: false,
                error: `Invalid urgency level. Valid values: ${VALID_URGENCY_LEVELS.join(', ')}`,
            } as AutomationResponse,
            400
        );
    }

    try {
        const service = getAutomationConfigService();
        const timeout = service.getTimeoutForUrgency(orgId, urgency);

        if (!timeout) {
            return c.json(
                {
                    success: false,
                    error: `No timeout configured for urgency: ${urgency}`,
                } as AutomationResponse,
                404
            );
        }

        return c.json({
            success: true,
            data: timeout,
        } as AutomationResponse);
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get timeout',
            } as AutomationResponse,
            500
        );
    }
});

/**
 * GET /api/v1/settings/automation/:orgId/escalation-paths
 * Get escalation paths
 */
automationSettingsRouter.get('/:orgId/escalation-paths', async (c) => {
    const orgId = c.req.param('orgId');

    try {
        const service = getAutomationConfigService();
        const paths = service.getEscalationPaths(orgId);

        return c.json({
            success: true,
            data: paths,
        } as AutomationResponse);
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get escalation paths',
            } as AutomationResponse,
            500
        );
    }
});

/**
 * GET /api/v1/settings/automation/:orgId/escalation-paths/:riskLevel
 * Get escalation path for specific risk level
 */
automationSettingsRouter.get('/:orgId/escalation-paths/:riskLevel', async (c) => {
    const orgId = c.req.param('orgId');
    const riskLevel = validateRiskLevel(c.req.param('riskLevel'));

    if (!riskLevel) {
        return c.json(
            {
                success: false,
                error: `Invalid risk level. Valid values: ${VALID_RISK_LEVELS.join(', ')}`,
            } as AutomationResponse,
            400
        );
    }

    try {
        const service = getAutomationConfigService();
        const path = service.getEscalationPathForRisk(orgId, riskLevel);

        if (!path) {
            return c.json(
                {
                    success: false,
                    error: `No escalation path for risk level: ${riskLevel}`,
                } as AutomationResponse,
                404
            );
        }

        return c.json({
            success: true,
            data: path,
        } as AutomationResponse);
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get escalation path',
            } as AutomationResponse,
            500
        );
    }
});

/**
 * GET /api/v1/settings/automation/:orgId/tribunal
 * Get tribunal configuration
 */
automationSettingsRouter.get('/:orgId/tribunal', async (c) => {
    const orgId = c.req.param('orgId');

    try {
        const service = getAutomationConfigService();
        const config = service.getTribunalConfig(orgId);

        return c.json({
            success: true,
            data: config,
        } as AutomationResponse);
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get tribunal config',
            } as AutomationResponse,
            500
        );
    }
});

/**
 * PUT /api/v1/settings/automation/:orgId/tribunal
 * Update tribunal configuration
 */
automationSettingsRouter.put('/:orgId/tribunal', async (c) => {
    const orgId = c.req.param('orgId');

    try {
        const body = await c.req.json();
        const service = getAutomationConfigService();

        const validation = service.validateUpdate({ tribunal: body });
        if (!validation.valid) {
            return c.json(
                {
                    success: false,
                    error: `Validation failed: ${validation.errors.join(', ')}`,
                } as AutomationResponse,
                400
            );
        }

        const config = service.updateTribunalConfig(orgId, body);

        return c.json({
            success: true,
            data: config,
        } as AutomationResponse);
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update tribunal config',
            } as AutomationResponse,
            500
        );
    }
});

/**
 * GET /api/v1/settings/automation/:orgId/hitl
 * Get HITL configuration
 */
automationSettingsRouter.get('/:orgId/hitl', async (c) => {
    const orgId = c.req.param('orgId');

    try {
        const service = getAutomationConfigService();
        const config = service.getHITLConfig(orgId);

        return c.json({
            success: true,
            data: config,
        } as AutomationResponse);
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get HITL config',
            } as AutomationResponse,
            500
        );
    }
});

/**
 * PUT /api/v1/settings/automation/:orgId/hitl
 * Update HITL configuration
 */
automationSettingsRouter.put('/:orgId/hitl', async (c) => {
    const orgId = c.req.param('orgId');

    try {
        const body = await c.req.json();
        const service = getAutomationConfigService();

        const validation = service.validateUpdate({ hitl: body });
        if (!validation.valid) {
            return c.json(
                {
                    success: false,
                    error: `Validation failed: ${validation.errors.join(', ')}`,
                } as AutomationResponse,
                400
            );
        }

        const config = service.updateHITLConfig(orgId, body);

        return c.json({
            success: true,
            data: config,
        } as AutomationResponse);
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update HITL config',
            } as AutomationResponse,
            500
        );
    }
});

/**
 * GET /api/v1/settings/automation/defaults
 * Get default configuration
 */
automationSettingsRouter.get('/defaults', async (c) => {
    try {
        const service = getAutomationConfigService();
        const defaults = service.getDefaults();

        return c.json({
            success: true,
            data: defaults,
        } as AutomationResponse);
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get defaults',
            } as AutomationResponse,
            500
        );
    }
});

export default automationSettingsRouter;
export { automationSettingsRouter };
