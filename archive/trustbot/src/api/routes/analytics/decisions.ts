/**
 * Decision Analytics API Routes
 *
 * Epic 12: Decision Automation Pipeline
 * Story 12.7: Decision Analytics
 *
 * Provides analytics endpoints for decision patterns to optimize
 * automation thresholds.
 */

import { Hono } from 'hono';
import {
    getDecisionAnalytics,
    type DecisionSource,
    type DecisionOutcome,
    type RiskLevel,
} from '../../../services/DecisionAnalytics.js';

// ============================================================================
// Types
// ============================================================================

export interface AnalyticsResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}

// ============================================================================
// Validation
// ============================================================================

function parseDate(value: string | undefined): Date | undefined {
    if (!value) return undefined;
    const date = new Date(value);
    if (isNaN(date.getTime())) return undefined;
    return date;
}

function validateSource(value: string | undefined): DecisionSource | undefined {
    if (!value) return undefined;
    if (['auto_approval', 'tribunal', 'hitl'].includes(value)) {
        return value as DecisionSource;
    }
    return undefined;
}

function validateOutcome(value: string | undefined): DecisionOutcome | undefined {
    if (!value) return undefined;
    if (['approved', 'denied', 'expired', 'escalated'].includes(value)) {
        return value as DecisionOutcome;
    }
    return undefined;
}

function validateRiskLevel(value: string | undefined): RiskLevel | undefined {
    if (!value) return undefined;
    if (['low', 'medium', 'high', 'critical'].includes(value)) {
        return value as RiskLevel;
    }
    return undefined;
}

// ============================================================================
// Route Handler
// ============================================================================

const decisionsAnalyticsRouter = new Hono();

/**
 * GET /api/v1/analytics/decisions/stats
 * Get global analytics statistics
 * NOTE: This route must be defined before /:orgId to avoid being caught by the wildcard
 */
decisionsAnalyticsRouter.get('/stats', async (c) => {
    try {
        const analytics = getDecisionAnalytics();
        const stats = analytics.getStats();

        return c.json({
            success: true,
            data: stats,
        } as AnalyticsResponse);
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get stats',
            } as AnalyticsResponse,
            500
        );
    }
});

/**
 * GET /api/v1/analytics/decisions/:orgId
 * Get comprehensive decision analytics summary
 */
decisionsAnalyticsRouter.get('/:orgId', async (c) => {
    const orgId = c.req.param('orgId');
    const startDate = parseDate(c.req.query('startDate'));
    const endDate = parseDate(c.req.query('endDate'));

    try {
        const analytics = getDecisionAnalytics();
        const summary = analytics.getAnalyticsSummary(orgId, { startDate, endDate });

        return c.json({
            success: true,
            data: summary,
        } as AnalyticsResponse);
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get analytics',
            } as AnalyticsResponse,
            500
        );
    }
});

/**
 * GET /api/v1/analytics/decisions/:orgId/auto-approval
 * Get auto-approval metrics
 */
decisionsAnalyticsRouter.get('/:orgId/auto-approval', async (c) => {
    const orgId = c.req.param('orgId');
    const startDate = parseDate(c.req.query('startDate'));
    const endDate = parseDate(c.req.query('endDate'));

    try {
        const analytics = getDecisionAnalytics();
        const metrics = analytics.getAutoApprovalMetrics(orgId, startDate, endDate);

        return c.json({
            success: true,
            data: metrics,
        } as AnalyticsResponse);
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get auto-approval metrics',
            } as AnalyticsResponse,
            500
        );
    }
});

/**
 * GET /api/v1/analytics/decisions/:orgId/decision-time
 * Get decision time metrics
 */
decisionsAnalyticsRouter.get('/:orgId/decision-time', async (c) => {
    const orgId = c.req.param('orgId');
    const startDate = parseDate(c.req.query('startDate'));
    const endDate = parseDate(c.req.query('endDate'));

    try {
        const analytics = getDecisionAnalytics();
        const metrics = analytics.getDecisionTimeMetrics(orgId, startDate, endDate);

        return c.json({
            success: true,
            data: metrics,
        } as AnalyticsResponse);
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get decision time metrics',
            } as AnalyticsResponse,
            500
        );
    }
});

/**
 * GET /api/v1/analytics/decisions/:orgId/overrides
 * Get override metrics
 */
decisionsAnalyticsRouter.get('/:orgId/overrides', async (c) => {
    const orgId = c.req.param('orgId');
    const startDate = parseDate(c.req.query('startDate'));
    const endDate = parseDate(c.req.query('endDate'));

    try {
        const analytics = getDecisionAnalytics();
        const metrics = analytics.getOverrideMetrics(orgId, startDate, endDate);

        return c.json({
            success: true,
            data: metrics,
        } as AnalyticsResponse);
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get override metrics',
            } as AnalyticsResponse,
            500
        );
    }
});

/**
 * GET /api/v1/analytics/decisions/:orgId/false-positives
 * Get false positive metrics
 */
decisionsAnalyticsRouter.get('/:orgId/false-positives', async (c) => {
    const orgId = c.req.param('orgId');
    const startDate = parseDate(c.req.query('startDate'));
    const endDate = parseDate(c.req.query('endDate'));

    try {
        const analytics = getDecisionAnalytics();
        const metrics = analytics.getFalsePositiveMetrics(orgId, startDate, endDate);

        return c.json({
            success: true,
            data: metrics,
        } as AnalyticsResponse);
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get false positive metrics',
            } as AnalyticsResponse,
            500
        );
    }
});

/**
 * GET /api/v1/analytics/decisions/:orgId/recent
 * Get recent decision records
 */
decisionsAnalyticsRouter.get('/:orgId/recent', async (c) => {
    const orgId = c.req.param('orgId');
    const limit = parseInt(c.req.query('limit') || '100', 10);
    const source = validateSource(c.req.query('source'));
    const outcome = validateOutcome(c.req.query('outcome'));
    const riskLevel = validateRiskLevel(c.req.query('riskLevel'));

    try {
        const analytics = getDecisionAnalytics();
        const records = analytics.getRecentRecords(orgId, Math.min(limit, 500), {
            source,
            outcome,
            riskLevel,
        });

        return c.json({
            success: true,
            data: {
                count: records.length,
                records,
            },
        } as AnalyticsResponse);
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get recent records',
            } as AnalyticsResponse,
            500
        );
    }
});

/**
 * GET /api/v1/analytics/decisions/:orgId/agent/:agentId
 * Get agent-specific analytics
 */
decisionsAnalyticsRouter.get('/:orgId/agent/:agentId', async (c) => {
    const agentId = c.req.param('agentId');
    const startDate = parseDate(c.req.query('startDate'));
    const endDate = parseDate(c.req.query('endDate'));

    try {
        const analytics = getDecisionAnalytics();
        const agentAnalytics = analytics.getAgentAnalytics(agentId, startDate, endDate);

        return c.json({
            success: true,
            data: agentAnalytics,
        } as AnalyticsResponse);
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get agent analytics',
            } as AnalyticsResponse,
            500
        );
    }
});

/**
 * GET /api/v1/analytics/decisions/:orgId/action-type/:actionType
 * Get action type specific analytics
 */
decisionsAnalyticsRouter.get('/:orgId/action-type/:actionType', async (c) => {
    const orgId = c.req.param('orgId');
    const actionType = c.req.param('actionType');
    const startDate = parseDate(c.req.query('startDate'));
    const endDate = parseDate(c.req.query('endDate'));

    try {
        const analytics = getDecisionAnalytics();
        const actionAnalytics = analytics.getActionTypeAnalytics(orgId, actionType, startDate, endDate);

        return c.json({
            success: true,
            data: actionAnalytics,
        } as AnalyticsResponse);
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get action type analytics',
            } as AnalyticsResponse,
            500
        );
    }
});

/**
 * GET /api/v1/analytics/decisions/:orgId/thresholds
 * Get alert thresholds for an organization
 */
decisionsAnalyticsRouter.get('/:orgId/thresholds', async (c) => {
    const orgId = c.req.param('orgId');

    try {
        const analytics = getDecisionAnalytics();
        const thresholds: Record<string, number | null> = {};

        for (const metric of ['autoApprovalRate', 'maxOverrideRate', 'maxFalsePositiveRate']) {
            thresholds[metric] = analytics.getThreshold(orgId, metric);
        }

        return c.json({
            success: true,
            data: { orgId, thresholds },
        } as AnalyticsResponse);
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get thresholds',
            } as AnalyticsResponse,
            500
        );
    }
});

/**
 * PUT /api/v1/analytics/decisions/:orgId/thresholds
 * Set alert thresholds for an organization
 */
decisionsAnalyticsRouter.put('/:orgId/thresholds', async (c) => {
    const orgId = c.req.param('orgId');

    try {
        const body = await c.req.json();
        const analytics = getDecisionAnalytics();

        if (typeof body !== 'object' || body === null) {
            return c.json(
                {
                    success: false,
                    error: 'Request body must be an object with threshold values',
                } as AnalyticsResponse,
                400
            );
        }

        const validMetrics = ['autoApprovalRate', 'maxOverrideRate', 'maxFalsePositiveRate'];
        const updates: Record<string, number> = {};

        for (const [metric, value] of Object.entries(body)) {
            if (!validMetrics.includes(metric)) {
                return c.json(
                    {
                        success: false,
                        error: `Invalid metric: ${metric}. Valid metrics: ${validMetrics.join(', ')}`,
                    } as AnalyticsResponse,
                    400
                );
            }
            if (typeof value !== 'number' || value < 0 || value > 1) {
                return c.json(
                    {
                        success: false,
                        error: `${metric} must be a number between 0 and 1`,
                    } as AnalyticsResponse,
                    400
                );
            }
            analytics.setThreshold(orgId, metric, value);
            updates[metric] = value;
        }

        return c.json({
            success: true,
            data: { orgId, thresholds: updates },
        } as AnalyticsResponse);
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to set thresholds',
            } as AnalyticsResponse,
            500
        );
    }
});

/**
 * DELETE /api/v1/analytics/decisions/:orgId/thresholds/:metric
 * Clear a specific threshold
 */
decisionsAnalyticsRouter.delete('/:orgId/thresholds/:metric', async (c) => {
    const orgId = c.req.param('orgId');
    const metric = c.req.param('metric');

    try {
        const analytics = getDecisionAnalytics();
        const cleared = analytics.clearThreshold(orgId, metric);

        return c.json({
            success: true,
            data: { orgId, metric, cleared },
        } as AnalyticsResponse);
    } catch (error) {
        return c.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to clear threshold',
            } as AnalyticsResponse,
            500
        );
    }
});

export default decisionsAnalyticsRouter;
export { decisionsAnalyticsRouter };
