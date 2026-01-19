/**
 * Mission Control API Routes
 *
 * REST API endpoints for the Mission Control dashboard.
 * All routes are protected by RBAC middleware.
 *
 * Story 1.3: Agent Overview Module - List View
 * Story 2.1: Task Pipeline Module - Pending Decisions View
 * Story 2.3: Approve Action Request
 * Story 2.5: Trust Impact Preview
 * Story 2.6: Sample Data Viewing
 * Story 2.7: Task Execution Progress View
 * Story 3.1: Bot Tribunal Voting Records
 * Story 3.2: Trust Gate Decision Explanations
 * Story 3.3: HITL Override with Rationale
 * Story 3.4: Director Governance Rule Approval
 * Story 4.1: Record Review Module - Audit Trail
 * Story 4.2: Hash Chain Verification
 * Story 4.3: Accountability Chain Display
 * Story 4.4: HITL Quality Metrics
 * Story 4.5: Automation Bias Alerts
 * FRs: FR1, FR4, FR5, FR7-FR9, FR11-FR14, FR17-FR25, FR28-FR30
 */

import { Hono } from 'hono';
import { requireRole, requireAuth, getUserContext, getOrgId } from '../../middleware/rbac.js';

// ============================================================================
// Types
// ============================================================================

interface Agent {
    id: string;
    structuredId?: string;
    name: string;
    type: string;
    tier: number;
    status: string;
    location: { floor: string; room: string };
    trustScore: number;
    capabilities: string[];
    parentId: string | null;
    childIds?: string[];
    orgId?: string;
}

// Story 2.1: Action Request Types
type ActionRequestUrgency = 'immediate' | 'queued';
type ActionRequestStatus = 'pending' | 'approved' | 'denied' | 'cancelled' | 'expired';

interface ActionRequest {
    id: string;
    orgId: string;
    agentId: string;
    agentName: string;
    actionType: string;
    actionPayload?: Record<string, unknown>;
    status: ActionRequestStatus;
    urgency: ActionRequestUrgency;
    queuedReason?: string;
    trustGateRules?: string[];
    priority: number;
    decidedBy?: string;
    decidedAt?: string;
    decisionReason?: string;
    createdAt: string;
    updatedAt: string;
    timeInQueue?: string;
}

interface QueueResponse {
    queue: ActionRequest[];
    counts: {
        immediate: number;
        queued: number;
        total: number;
    };
}

interface AgentListResponse {
    agents: Agent[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}

interface DashboardResponse {
    orgId: string;
    stats: {
        totalAgents: number;
        activeAgents: number;
        idleAgents: number;
        errorAgents: number;
        avgTrustScore: number;
        pendingDecisions: number;
    };
    lastUpdated: string;
}

// ============================================================================
// Mock Data (would come from database in production)
// ============================================================================

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate human-readable time-in-queue duration
 */
function formatTimeInQueue(createdAt: string): string {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const remainingMins = diffMins % 60;

    if (diffHours === 0) {
        return `${diffMins}m`;
    }
    return `${diffHours}h ${remainingMins}m`;
}

// ============================================================================
// Mock Action Requests (Story 2.1)
// ============================================================================

const MOCK_ACTION_REQUESTS: ActionRequest[] = [
    {
        id: 'ar-001',
        orgId: 'demo-org',
        agentId: 'worker-1',
        agentName: 'DataProcessor-Alpha',
        actionType: 'data_export',
        actionPayload: { format: 'csv', recordCount: 15000 },
        status: 'pending',
        urgency: 'immediate',
        queuedReason: 'Action involves bulk data export exceeding 10,000 records',
        trustGateRules: ['high_volume_data', 'low_tier_agent'],
        priority: 10,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 'ar-002',
        orgId: 'demo-org',
        agentId: 'specialist-1',
        agentName: 'SecurityAnalyst',
        actionType: 'security_scan',
        actionPayload: { target: 'production', scope: 'full' },
        status: 'pending',
        urgency: 'immediate',
        queuedReason: 'Security scan on production environment requires explicit approval',
        trustGateRules: ['production_access', 'security_action'],
        priority: 20,
        createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 mins ago
        updatedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    },
    {
        id: 'ar-003',
        orgId: 'demo-org',
        agentId: 'worker-2',
        agentName: 'DataProcessor-Beta',
        actionType: 'report_generation',
        actionPayload: { type: 'monthly', department: 'finance' },
        status: 'pending',
        urgency: 'queued',
        queuedReason: 'Routine report generation - can be reviewed during normal hours',
        trustGateRules: ['report_generation'],
        priority: 5,
        createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), // 8 hours ago (overnight)
        updatedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 'ar-004',
        orgId: 'demo-org',
        agentId: 'listener-1',
        agentName: 'EventListener',
        actionType: 'alert_escalation',
        actionPayload: { alertId: 'ALT-789', severity: 'medium' },
        status: 'pending',
        urgency: 'queued',
        queuedReason: 'Medium severity alert - queued for batch review',
        trustGateRules: ['alert_escalation', 'passive_agent'],
        priority: 3,
        createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
        updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 'ar-005',
        orgId: 'demo-org',
        agentId: 'error-1',
        agentName: 'FaultyWorker',
        actionType: 'data_correction',
        actionPayload: { recordIds: ['R001', 'R002', 'R003'] },
        status: 'pending',
        urgency: 'immediate',
        queuedReason: 'Agent in ERROR state attempting data modification',
        trustGateRules: ['error_state_agent', 'data_modification'],
        priority: 15,
        createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 mins ago
        updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
    {
        id: 'ar-006',
        orgId: 'other-org',
        agentId: 'other-agent-1',
        agentName: 'OtherOrgAgent',
        actionType: 'data_export',
        status: 'pending',
        urgency: 'queued',
        priority: 5,
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    },
];

// ============================================================================
// Mock Agents
// ============================================================================

const MOCK_AGENTS: Agent[] = [
    {
        id: 'exec-1',
        structuredId: '05-MC-EX-01',
        name: 'T5-EXECUTOR',
        type: 'EXECUTOR',
        tier: 5,
        status: 'IDLE',
        location: { floor: 'EXECUTIVE', room: 'EXECUTOR_OFFICE' },
        trustScore: 1000,
        capabilities: ['strategic_decision', 'emergency_control'],
        parentId: null,
        orgId: 'demo-org',
    },
    {
        id: 'plan-1',
        structuredId: '05-MC-PL-01',
        name: 'T5-PLANNER',
        type: 'PLANNER',
        tier: 5,
        status: 'WORKING',
        location: { floor: 'EXECUTIVE', room: 'PLANNER_OFFICE' },
        trustScore: 980,
        capabilities: ['goal_decomposition', 'hierarchy_design'],
        parentId: null,
        orgId: 'demo-org',
    },
    {
        id: 'valid-1',
        structuredId: '05-MC-VA-01',
        name: 'T5-VALIDATOR',
        type: 'VALIDATOR',
        tier: 5,
        status: 'IDLE',
        location: { floor: 'EXECUTIVE', room: 'VALIDATOR_OFFICE' },
        trustScore: 990,
        capabilities: ['spawn_validation', 'trust_monitoring'],
        parentId: null,
        orgId: 'demo-org',
    },
    {
        id: 'worker-1',
        structuredId: '01-MC-WK-01',
        name: 'DataProcessor-Alpha',
        type: 'WORKER',
        tier: 1,
        status: 'WORKING',
        location: { floor: 'OPERATIONS', room: 'WORKER_STATION_A' },
        trustScore: 350,
        capabilities: ['data_processing', 'report_generation'],
        parentId: 'exec-1',
        orgId: 'demo-org',
    },
    {
        id: 'worker-2',
        structuredId: '01-MC-WK-02',
        name: 'DataProcessor-Beta',
        type: 'WORKER',
        tier: 1,
        status: 'IDLE',
        location: { floor: 'OPERATIONS', room: 'WORKER_STATION_B' },
        trustScore: 280,
        capabilities: ['data_processing'],
        parentId: 'exec-1',
        orgId: 'demo-org',
    },
    {
        id: 'specialist-1',
        structuredId: '02-MC-SP-01',
        name: 'SecurityAnalyst',
        type: 'SPECIALIST',
        tier: 2,
        status: 'WORKING',
        location: { floor: 'OPERATIONS', room: 'SECURITY_CENTER' },
        trustScore: 550,
        capabilities: ['security_analysis', 'threat_detection'],
        parentId: 'valid-1',
        orgId: 'demo-org',
    },
    {
        id: 'listener-1',
        structuredId: '00-MC-LI-01',
        name: 'EventListener',
        type: 'LISTENER',
        tier: 0,
        status: 'WORKING',
        location: { floor: 'OPERATIONS', room: 'LISTENER_STATION' },
        trustScore: 50,
        capabilities: ['observe', 'log'],
        parentId: 'plan-1',
        orgId: 'demo-org',
    },
    {
        id: 'error-1',
        structuredId: '01-MC-WK-03',
        name: 'FaultyWorker',
        type: 'WORKER',
        tier: 1,
        status: 'ERROR',
        location: { floor: 'OPERATIONS', room: 'WORKER_STATION_C' },
        trustScore: 150,
        capabilities: ['data_processing'],
        parentId: 'exec-1',
        orgId: 'demo-org',
    },
];

// ============================================================================
// Routes
// ============================================================================

const missionControlRoutes = new Hono();

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/dashboard
// Returns dashboard summary for the operator's organization
// ----------------------------------------------------------------------------
missionControlRoutes.get('/dashboard', requireRole('operator'), async (c) => {
    const user = getUserContext(c);
    const orgId = getOrgId(c) || 'demo-org';

    // Filter agents by org (RLS would do this in production)
    const orgAgents = MOCK_AGENTS.filter((a) => a.orgId === orgId);

    const stats = {
        totalAgents: orgAgents.length,
        activeAgents: orgAgents.filter((a) => a.status === 'WORKING').length,
        idleAgents: orgAgents.filter((a) => a.status === 'IDLE').length,
        errorAgents: orgAgents.filter((a) => a.status === 'ERROR').length,
        avgTrustScore:
            orgAgents.length > 0
                ? Math.round(orgAgents.reduce((sum, a) => sum + a.trustScore, 0) / orgAgents.length)
                : 0,
        pendingDecisions: 3, // Mock value
    };

    const response: DashboardResponse = {
        orgId,
        stats,
        lastUpdated: new Date().toISOString(),
    };

    return c.json(response);
});

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/agents
// Returns list of agents for the operator's organization
// ----------------------------------------------------------------------------
missionControlRoutes.get('/agents', requireRole('operator'), async (c) => {
    const orgId = getOrgId(c) || 'demo-org';

    // Query parameters
    const page = parseInt(c.req.query('page') || '1', 10);
    const pageSize = Math.min(parseInt(c.req.query('pageSize') || '50', 10), 100);
    const status = c.req.query('status');
    const tier = c.req.query('tier');
    const search = c.req.query('search')?.toLowerCase();

    // Filter agents by org (RLS would do this in production)
    let agents = MOCK_AGENTS.filter((a) => a.orgId === orgId);

    // Apply filters
    if (status) {
        agents = agents.filter((a) => a.status === status);
    }
    if (tier !== undefined) {
        agents = agents.filter((a) => a.tier === parseInt(tier, 10));
    }
    if (search) {
        agents = agents.filter(
            (a) =>
                a.name.toLowerCase().includes(search) ||
                a.id.toLowerCase().includes(search) ||
                a.structuredId?.toLowerCase().includes(search)
        );
    }

    // Sort by tier (descending), then by name
    agents.sort((a, b) => {
        if (a.tier !== b.tier) return b.tier - a.tier;
        return a.name.localeCompare(b.name);
    });

    const total = agents.length;
    const startIndex = (page - 1) * pageSize;
    const paginatedAgents = agents.slice(startIndex, startIndex + pageSize);

    const response: AgentListResponse = {
        agents: paginatedAgents,
        total,
        page,
        pageSize,
        hasMore: startIndex + pageSize < total,
    };

    return c.json(response);
});

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/agents/:id
// Returns a single agent by ID
// ----------------------------------------------------------------------------
missionControlRoutes.get('/agents/:id', requireRole('operator'), async (c) => {
    const agentId = c.req.param('id');
    const orgId = getOrgId(c) || 'demo-org';

    const agent = MOCK_AGENTS.find((a) => (a.id === agentId || a.structuredId === agentId) && a.orgId === orgId);

    if (!agent) {
        return c.json(
            {
                type: 'https://aurais.ai/errors/not-found',
                title: 'Not Found',
                status: 404,
                detail: 'Agent not found',
            },
            404
        );
    }

    return c.json(agent);
});

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/stats
// Returns fleet statistics
// ----------------------------------------------------------------------------
missionControlRoutes.get('/stats', requireRole('operator'), async (c) => {
    const orgId = getOrgId(c) || 'demo-org';
    const orgAgents = MOCK_AGENTS.filter((a) => a.orgId === orgId);

    const byTier: Record<number, number> = {};
    const byStatus: Record<string, number> = {};

    for (const agent of orgAgents) {
        byTier[agent.tier] = (byTier[agent.tier] || 0) + 1;
        byStatus[agent.status] = (byStatus[agent.status] || 0) + 1;
    }

    return c.json({
        total: orgAgents.length,
        byTier,
        byStatus,
        avgTrustScore:
            orgAgents.length > 0
                ? Math.round(orgAgents.reduce((sum, a) => sum + a.trustScore, 0) / orgAgents.length)
                : 0,
    });
});

// ============================================================================
// Story 2.1: Task Pipeline Module - Queue Endpoints
// ============================================================================

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/queue
// Returns pending action requests for the operator's organization
// Story 2.1: FR7, FR11, FR12, FR13
// ----------------------------------------------------------------------------
missionControlRoutes.get('/queue', requireRole('operator'), async (c) => {
    const orgId = getOrgId(c) || 'demo-org';

    // Query parameters
    const urgencyFilter = c.req.query('urgency') as ActionRequestUrgency | undefined;
    const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 100);

    // Filter by org and pending status (RLS would do this in production)
    let queue = MOCK_ACTION_REQUESTS.filter(
        (ar) => ar.orgId === orgId && ar.status === 'pending'
    );

    // Apply urgency filter
    if (urgencyFilter) {
        queue = queue.filter((ar) => ar.urgency === urgencyFilter);
    }

    // Sort by: urgency (immediate first), then priority (high to low), then createdAt (oldest first)
    queue.sort((a, b) => {
        // Immediate before queued
        if (a.urgency !== b.urgency) {
            return a.urgency === 'immediate' ? -1 : 1;
        }
        // Higher priority first
        if (a.priority !== b.priority) {
            return b.priority - a.priority;
        }
        // Oldest first (FIFO within same priority)
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    // Apply limit
    queue = queue.slice(0, limit);

    // Add computed timeInQueue field
    const queueWithTime = queue.map((ar) => ({
        ...ar,
        timeInQueue: formatTimeInQueue(ar.createdAt),
    }));

    // Calculate counts
    const allPending = MOCK_ACTION_REQUESTS.filter(
        (ar) => ar.orgId === orgId && ar.status === 'pending'
    );
    const counts = {
        immediate: allPending.filter((ar) => ar.urgency === 'immediate').length,
        queued: allPending.filter((ar) => ar.urgency === 'queued').length,
        total: allPending.length,
    };

    const response: QueueResponse = {
        queue: queueWithTime,
        counts,
    };

    return c.json(response);
});

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/queue/morning
// Returns pending action requests from overnight period (6 PM - 8 AM)
// Story 2.2: FR10
// ----------------------------------------------------------------------------
missionControlRoutes.get('/queue/morning', requireRole('operator'), async (c) => {
    const orgId = getOrgId(c) || 'demo-org';
    const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 100);

    // Calculate overnight period (6 PM yesterday to 8 AM today)
    const now = new Date();
    const today8am = new Date(now);
    today8am.setHours(8, 0, 0, 0);

    const yesterday6pm = new Date(now);
    yesterday6pm.setDate(yesterday6pm.getDate() - 1);
    yesterday6pm.setHours(18, 0, 0, 0);

    // If we're after 8 AM, use today's 6pm to tomorrow 8am instead
    // But typically we want to show overnight from previous day
    const periodStart = yesterday6pm;
    const periodEnd = today8am;

    // Filter by org, pending status, and overnight period
    let queue = MOCK_ACTION_REQUESTS.filter((ar) => {
        if (ar.orgId !== orgId || ar.status !== 'pending') return false;

        const createdAt = new Date(ar.createdAt);
        // Check if created during overnight hours (before 8am or after 6pm)
        const hour = createdAt.getHours();
        return hour >= 18 || hour < 8;
    });

    // Sort by: urgency (immediate first), priority (high to low), createdAt (oldest first)
    queue.sort((a, b) => {
        if (a.urgency !== b.urgency) {
            return a.urgency === 'immediate' ? -1 : 1;
        }
        if (a.priority !== b.priority) {
            return b.priority - a.priority;
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    // Apply limit
    queue = queue.slice(0, limit);

    // Add computed timeInQueue field
    const queueWithTime = queue.map((ar) => ({
        ...ar,
        timeInQueue: formatTimeInQueue(ar.createdAt),
    }));

    // Calculate counts for morning queue only
    const allMorning = MOCK_ACTION_REQUESTS.filter((ar) => {
        if (ar.orgId !== orgId || ar.status !== 'pending') return false;
        const createdAt = new Date(ar.createdAt);
        const hour = createdAt.getHours();
        return hour >= 18 || hour < 8;
    });

    const counts = {
        immediate: allMorning.filter((ar) => ar.urgency === 'immediate').length,
        queued: allMorning.filter((ar) => ar.urgency === 'queued').length,
        total: allMorning.length,
    };

    return c.json({
        queue: queueWithTime,
        counts,
        period: {
            start: periodStart.toISOString(),
            end: periodEnd.toISOString(),
        },
    });
});

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/queue/:id
// Returns a single action request by ID
// Story 2.1
// ----------------------------------------------------------------------------
missionControlRoutes.get('/queue/:id', requireRole('operator'), async (c) => {
    const requestId = c.req.param('id');
    const orgId = getOrgId(c) || 'demo-org';

    const actionRequest = MOCK_ACTION_REQUESTS.find(
        (ar) => ar.id === requestId && ar.orgId === orgId
    );

    if (!actionRequest) {
        return c.json(
            {
                type: 'https://aurais.ai/errors/not-found',
                title: 'Not Found',
                status: 404,
                detail: 'Action request not found',
            },
            404
        );
    }

    return c.json({
        ...actionRequest,
        timeInQueue: formatTimeInQueue(actionRequest.createdAt),
    });
});

// ============================================================================
// Story 2.3: Approve Action Request
// ============================================================================

// HITL Metrics storage (in-memory for mock, would be in database in production)
interface HITLMetric {
    id: string;
    orgId: string;
    userId: string;
    decisionId: string;
    reviewTimeMs: number;
    detailViewsAccessed: boolean;
    sampleDataViewed: boolean;
    scrollDepth?: number;
    createdAt: string;
}

const HITL_METRICS: HITLMetric[] = [];

// ----------------------------------------------------------------------------
// POST /api/v1/mission-control/decisions/:id/approve
// Approves a pending action request
// Story 2.3: FR14
// ----------------------------------------------------------------------------
missionControlRoutes.post('/decisions/:id/approve', requireRole('operator'), async (c) => {
    const decisionId = c.req.param('id');
    const orgId = getOrgId(c) || 'demo-org';
    const user = getUserContext(c);
    const userId = user?.id || 'anonymous';

    // Parse request body
    let body: {
        reviewNotes?: string;
        reviewMetrics?: {
            reviewTimeMs?: number;
            detailViewsAccessed?: boolean;
            sampleDataViewed?: boolean;
            scrollDepth?: number;
        };
    } = {};

    try {
        body = await c.req.json();
    } catch {
        // Body is optional
    }

    // Find the action request
    const actionIndex = MOCK_ACTION_REQUESTS.findIndex(
        (ar) => ar.id === decisionId && ar.orgId === orgId
    );

    if (actionIndex === -1) {
        return c.json(
            {
                type: 'https://aurais.ai/errors/not-found',
                title: 'Not Found',
                status: 404,
                detail: 'Decision not found',
            },
            404
        );
    }

    const actionRequest = MOCK_ACTION_REQUESTS[actionIndex]!;

    // Check if already decided
    if (actionRequest.status !== 'pending') {
        return c.json(
            {
                type: 'https://aurais.ai/errors/conflict',
                title: 'Conflict',
                status: 409,
                detail: `Decision has already been ${actionRequest.status}`,
            },
            409
        );
    }

    // Update the action request
    const decidedAt = new Date().toISOString();
    MOCK_ACTION_REQUESTS[actionIndex] = {
        ...actionRequest,
        status: 'approved',
        decidedBy: userId,
        decidedAt,
        decisionReason: body.reviewNotes,
        updatedAt: decidedAt,
    };

    // Record HITL metrics
    const reviewMetrics = body.reviewMetrics || {};
    const hitlMetric: HITLMetric = {
        id: `hitl-${Date.now()}`,
        orgId,
        userId,
        decisionId,
        reviewTimeMs: reviewMetrics.reviewTimeMs || 0,
        detailViewsAccessed: reviewMetrics.detailViewsAccessed || false,
        sampleDataViewed: reviewMetrics.sampleDataViewed || false,
        scrollDepth: reviewMetrics.scrollDepth,
        createdAt: decidedAt,
    };
    HITL_METRICS.push(hitlMetric);

    return c.json({
        success: true,
        decision: {
            id: decisionId,
            status: 'approved',
            decidedBy: userId,
            decidedAt,
            reviewMetrics: {
                reviewTimeMs: hitlMetric.reviewTimeMs,
                detailViewsAccessed: hitlMetric.detailViewsAccessed,
                sampleDataViewed: hitlMetric.sampleDataViewed,
            },
        },
    });
});

// ----------------------------------------------------------------------------
// POST /api/v1/mission-control/decisions/:id/deny
// Denies a pending action request (Story 2.4 placeholder)
// ----------------------------------------------------------------------------
missionControlRoutes.post('/decisions/:id/deny', requireRole('operator'), async (c) => {
    const decisionId = c.req.param('id');
    const orgId = getOrgId(c) || 'demo-org';
    const user = getUserContext(c);
    const userId = user?.id || 'anonymous';

    let body: {
        reason?: string;
        reviewMetrics?: {
            reviewTimeMs?: number;
            detailViewsAccessed?: boolean;
            sampleDataViewed?: boolean;
            scrollDepth?: number;
        };
    } = {};

    try {
        body = await c.req.json();
    } catch {
        // Body is optional but reason is recommended
    }

    const actionIndex = MOCK_ACTION_REQUESTS.findIndex(
        (ar) => ar.id === decisionId && ar.orgId === orgId
    );

    if (actionIndex === -1) {
        return c.json(
            {
                type: 'https://aurais.ai/errors/not-found',
                title: 'Not Found',
                status: 404,
                detail: 'Decision not found',
            },
            404
        );
    }

    const actionRequest = MOCK_ACTION_REQUESTS[actionIndex]!;

    if (actionRequest.status !== 'pending') {
        return c.json(
            {
                type: 'https://aurais.ai/errors/conflict',
                title: 'Conflict',
                status: 409,
                detail: `Decision has already been ${actionRequest.status}`,
            },
            409
        );
    }

    const decidedAt = new Date().toISOString();
    MOCK_ACTION_REQUESTS[actionIndex] = {
        ...actionRequest,
        status: 'denied',
        decidedBy: userId,
        decidedAt,
        decisionReason: body.reason,
        updatedAt: decidedAt,
    };

    // Record HITL metrics
    const reviewMetrics = body.reviewMetrics || {};
    const hitlMetric: HITLMetric = {
        id: `hitl-${Date.now()}`,
        orgId,
        userId,
        decisionId,
        reviewTimeMs: reviewMetrics.reviewTimeMs || 0,
        detailViewsAccessed: reviewMetrics.detailViewsAccessed || false,
        sampleDataViewed: reviewMetrics.sampleDataViewed || false,
        scrollDepth: reviewMetrics.scrollDepth,
        createdAt: decidedAt,
    };
    HITL_METRICS.push(hitlMetric);

    return c.json({
        success: true,
        decision: {
            id: decisionId,
            status: 'denied',
            decidedBy: userId,
            decidedAt,
            reason: body.reason,
            reviewMetrics: {
                reviewTimeMs: hitlMetric.reviewTimeMs,
                detailViewsAccessed: hitlMetric.detailViewsAccessed,
                sampleDataViewed: hitlMetric.sampleDataViewed,
            },
        },
    });
});

// ============================================================================
// Story 2.5: Trust Impact Preview
// ============================================================================

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/decisions/:id/impact
// Returns trust impact preview for approve/deny outcomes
// Story 2.5: FR17
// ----------------------------------------------------------------------------
missionControlRoutes.get('/decisions/:id/impact', requireRole('operator'), async (c) => {
    const decisionId = c.req.param('id');
    const orgId = getOrgId(c) || 'demo-org';

    // Find the action request
    const actionRequest = MOCK_ACTION_REQUESTS.find(
        (ar) => ar.id === decisionId && ar.orgId === orgId
    );

    if (!actionRequest) {
        return c.json(
            {
                type: 'https://aurais.ai/errors/not-found',
                title: 'Not Found',
                status: 404,
                detail: 'Decision not found',
            },
            404
        );
    }

    // Find the agent to get current trust score
    const agent = MOCK_AGENTS.find((a) => a.id === actionRequest.agentId);
    const currentTrust = agent?.trustScore ?? 500;

    // Calculate trust impact based on action type and urgency
    // In production, this would use the TrustScoreCalculator service
    const baseApproveImpact = actionRequest.urgency === 'immediate' ? 20 : 10;
    const baseDenyImpact = actionRequest.urgency === 'immediate' ? -30 : -15;

    // Modifiers based on action type
    const actionTypeModifiers: Record<string, number> = {
        data_export: 5,
        security_scan: 10,
        report_generation: 3,
        alert_escalation: 2,
        data_correction: 8,
    };
    const typeModifier = actionTypeModifiers[actionRequest.actionType] || 5;

    // History modifier (mock: use priority as proxy for history)
    const historyModifier = Math.floor(actionRequest.priority / 5);

    const approveScoreDelta = baseApproveImpact + typeModifier + historyModifier;
    const denyScoreDelta = baseDenyImpact - Math.floor(typeModifier / 2);

    return c.json({
        currentTrust,
        agentId: actionRequest.agentId,
        agentName: actionRequest.agentName,
        approveImpact: {
            scoreDelta: approveScoreDelta,
            newScore: Math.min(1000, Math.max(0, currentTrust + approveScoreDelta)),
            factors: [
                { name: 'Action completion', value: baseApproveImpact },
                { name: 'Action type bonus', value: typeModifier },
                { name: 'History modifier', value: historyModifier },
            ],
        },
        denyImpact: {
            scoreDelta: denyScoreDelta,
            newScore: Math.min(1000, Math.max(0, currentTrust + denyScoreDelta)),
            factors: [
                { name: 'Failed request', value: baseDenyImpact },
                { name: 'Operator override', value: -Math.floor(typeModifier / 2) },
            ],
        },
    });
});

// ============================================================================
// Story 2.6: Sample Data Viewing
// ============================================================================

// Masking utility functions
function maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return '***@***.***';
    if (!domain) return '***@***.***';
    const domainParts = domain.split('.');
    return `${local[0]}***@***.${domainParts[domainParts.length - 1]}`;
}

function maskName(name: string): string {
    const parts = name.split(' ');
    return parts.map((part) => `${part[0]}${'*'.repeat(Math.min(part.length - 1, 3))}`).join(' ');
}

function maskPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 4) return '***-***-****';
    return `***-***-${digits.slice(-4)}`;
}

function maskSSN(ssn: string): string {
    const digits = ssn.replace(/\D/g, '');
    if (digits.length < 4) return '***-**-****';
    return `***-**-${digits.slice(-4)}`;
}

// Mock sample data for different action types
const MOCK_SAMPLE_DATA: Record<string, { records: Record<string, unknown>[]; maskedFields: { field: string; type: string; reason: string }[] }> = {
    data_export: {
        records: [
            { id: 'REC-001', customer_name: 'John Doe', email: 'john.doe@example.com', phone: '555-123-4567', amount: 1250.00, status: 'active' },
            { id: 'REC-002', customer_name: 'Jane Smith', email: 'jane.smith@company.org', phone: '555-987-6543', amount: 3400.50, status: 'pending' },
            { id: 'REC-003', customer_name: 'Bob Johnson', email: 'bob.j@email.net', phone: '555-456-7890', amount: 890.25, status: 'active' },
            { id: 'REC-004', customer_name: 'Alice Brown', email: 'alice.b@mail.com', phone: '555-321-0987', amount: 2100.00, status: 'completed' },
            { id: 'REC-005', customer_name: 'Charlie Wilson', email: 'c.wilson@corp.io', phone: '555-654-3210', amount: 567.80, status: 'active' },
        ],
        maskedFields: [
            { field: 'customer_name', type: 'name', reason: 'PII - Personal Name' },
            { field: 'email', type: 'email', reason: 'PII - Contact Information' },
            { field: 'phone', type: 'phone', reason: 'PII - Contact Information' },
        ],
    },
    security_scan: {
        records: [
            { id: 'SCAN-001', target: 'api.production.internal', port: 443, protocol: 'HTTPS', last_scan: '2025-12-22T10:00:00Z', vulnerabilities: 0 },
            { id: 'SCAN-002', target: 'db.production.internal', port: 5432, protocol: 'PostgreSQL', last_scan: '2025-12-22T10:05:00Z', vulnerabilities: 2 },
            { id: 'SCAN-003', target: 'cache.production.internal', port: 6379, protocol: 'Redis', last_scan: '2025-12-22T10:10:00Z', vulnerabilities: 0 },
        ],
        maskedFields: [
            { field: 'target', type: 'hostname', reason: 'Infrastructure - Internal Network' },
        ],
    },
    report_generation: {
        records: [
            { id: 'RPT-001', department: 'Finance', period: 'Q4 2025', total_revenue: 1250000, employee_count: 45, ssn_sample: '123-45-6789' },
            { id: 'RPT-002', department: 'Operations', period: 'Q4 2025', total_revenue: 890000, employee_count: 120, ssn_sample: '987-65-4321' },
        ],
        maskedFields: [
            { field: 'ssn_sample', type: 'ssn', reason: 'PII - Social Security Number' },
        ],
    },
    data_correction: {
        records: [
            { id: 'COR-001', record_id: 'R001', field: 'email', old_value: 'wrong@email.com', new_value: 'correct@email.com', reason: 'User request' },
            { id: 'COR-002', record_id: 'R002', field: 'phone', old_value: '555-000-0000', new_value: '555-111-2222', reason: 'Data validation' },
        ],
        maskedFields: [
            { field: 'old_value', type: 'mixed', reason: 'May contain PII' },
            { field: 'new_value', type: 'mixed', reason: 'May contain PII' },
        ],
    },
};

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/decisions/:id/sample
// Returns masked sample data for a decision
// Story 2.6: FR18
// ----------------------------------------------------------------------------
missionControlRoutes.get('/decisions/:id/sample', requireRole('operator'), async (c) => {
    const decisionId = c.req.param('id');
    const orgId = getOrgId(c) || 'demo-org';
    const limit = Math.min(parseInt(c.req.query('limit') || '5', 10), 10);

    // Find the action request
    const actionRequest = MOCK_ACTION_REQUESTS.find(
        (ar) => ar.id === decisionId && ar.orgId === orgId
    );

    if (!actionRequest) {
        return c.json(
            {
                type: 'https://aurais.ai/errors/not-found',
                title: 'Not Found',
                status: 404,
                detail: 'Decision not found',
            },
            404
        );
    }

    // Get sample data for this action type
    const sampleConfig = MOCK_SAMPLE_DATA[actionRequest.actionType] || MOCK_SAMPLE_DATA.data_export!;
    const rawRecords = sampleConfig.records.slice(0, limit);

    // Apply masking to the records
    const maskedRecords = rawRecords.map((record) => {
        const masked: Record<string, unknown> = { ...record };

        for (const fieldConfig of sampleConfig.maskedFields) {
            const value = masked[fieldConfig.field];
            if (typeof value === 'string') {
                switch (fieldConfig.type) {
                    case 'email':
                        masked[fieldConfig.field] = maskEmail(value);
                        break;
                    case 'name':
                        masked[fieldConfig.field] = maskName(value);
                        break;
                    case 'phone':
                        masked[fieldConfig.field] = maskPhone(value);
                        break;
                    case 'ssn':
                        masked[fieldConfig.field] = maskSSN(value);
                        break;
                    case 'hostname':
                        // Partially mask hostname
                        masked[fieldConfig.field] = value.replace(/\.internal$/, '.***');
                        break;
                    case 'mixed':
                        // Generic masking for mixed content
                        masked[fieldConfig.field] = value.length > 4
                            ? `${value.slice(0, 2)}${'*'.repeat(value.length - 4)}${value.slice(-2)}`
                            : '****';
                        break;
                    default:
                        masked[fieldConfig.field] = '***';
                }
            }
        }

        return masked;
    });

    // Calculate total records based on action payload if available
    const payloadRecordCount = actionRequest.actionPayload?.recordCount;
    const totalRecords = typeof payloadRecordCount === 'number' ? payloadRecordCount : rawRecords.length * 100;

    return c.json({
        decisionId,
        actionType: actionRequest.actionType,
        sampleData: maskedRecords,
        maskedFields: sampleConfig.maskedFields,
        totalRecords,
        sampleSize: maskedRecords.length,
    });
});

// ============================================================================
// Story 2.7: Task Execution Progress View
// ============================================================================

type ExecutingTaskStatus = 'executing' | 'completed' | 'failed' | 'cancelled';

interface ExecutingTask {
    id: string;
    decisionId: string;
    agentId: string;
    agentName: string;
    actionType: string;
    status: ExecutingTaskStatus;
    progress: number;
    startedAt: string;
    completedAt?: string;
    estimatedCompletion?: string;
    currentStep?: string;
    error?: string;
    duration?: string;
}

// Mock executing tasks data
const MOCK_EXECUTING_TASKS: ExecutingTask[] = [
    {
        id: 'task-001',
        decisionId: 'ar-001',
        agentId: 'worker-1',
        agentName: 'DataProcessor-Alpha',
        actionType: 'data_export',
        status: 'executing',
        progress: 65,
        startedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 mins ago
        estimatedCompletion: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 mins from now
        currentStep: 'Processing records 6500 of 10000',
    },
    {
        id: 'task-002',
        decisionId: 'ar-002',
        agentId: 'specialist-1',
        agentName: 'SecurityAnalyst',
        actionType: 'security_scan',
        status: 'executing',
        progress: 30,
        startedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        estimatedCompletion: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        currentStep: 'Scanning production endpoints',
    },
    {
        id: 'task-003',
        decisionId: 'ar-prev-001',
        agentId: 'worker-2',
        agentName: 'DataProcessor-Beta',
        actionType: 'report_generation',
        status: 'completed',
        progress: 100,
        startedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        completedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        duration: '15m',
    },
    {
        id: 'task-004',
        decisionId: 'ar-prev-002',
        agentId: 'worker-1',
        agentName: 'DataProcessor-Alpha',
        actionType: 'data_export',
        status: 'completed',
        progress: 100,
        startedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        completedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        duration: '15m',
    },
    {
        id: 'task-005',
        decisionId: 'ar-prev-003',
        agentId: 'error-1',
        agentName: 'FaultyWorker',
        actionType: 'data_correction',
        status: 'failed',
        progress: 45,
        startedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
        completedAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
        duration: '2m',
        error: 'Connection timeout while accessing database',
    },
];

/**
 * Calculate human-readable duration between two dates
 */
function formatDuration(startDate: Date, endDate: Date): string {
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const remainingMins = diffMins % 60;

    if (diffHours === 0) {
        return `${diffMins}m`;
    }
    return `${diffHours}h ${remainingMins}m`;
}

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/tasks/executing
// Returns currently executing tasks
// Story 2.7: FR8
// ----------------------------------------------------------------------------
missionControlRoutes.get('/tasks/executing', requireRole('operator'), async (c) => {
    const orgId = getOrgId(c) || 'demo-org';

    // Filter to only executing tasks (in production, filter by org)
    const executingTasks = MOCK_EXECUTING_TASKS.filter((t) => t.status === 'executing');

    // Calculate counts
    const counts = {
        executing: MOCK_EXECUTING_TASKS.filter((t) => t.status === 'executing').length,
        completed: MOCK_EXECUTING_TASKS.filter((t) => t.status === 'completed').length,
        failed: MOCK_EXECUTING_TASKS.filter((t) => t.status === 'failed').length,
    };

    return c.json({
        tasks: executingTasks,
        counts,
    });
});

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/tasks/completed
// Returns recently completed tasks
// Story 2.7: FR9
// ----------------------------------------------------------------------------
missionControlRoutes.get('/tasks/completed', requireRole('operator'), async (c) => {
    const orgId = getOrgId(c) || 'demo-org';
    const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 50);
    const statusFilter = c.req.query('status') as 'success' | 'failed' | undefined;

    // Filter to completed/failed tasks
    let tasks = MOCK_EXECUTING_TASKS.filter(
        (t) => t.status === 'completed' || t.status === 'failed'
    );

    // Apply status filter
    if (statusFilter === 'success') {
        tasks = tasks.filter((t) => t.status === 'completed');
    } else if (statusFilter === 'failed') {
        tasks = tasks.filter((t) => t.status === 'failed');
    }

    // Sort by completedAt descending (most recent first)
    tasks.sort((a, b) => {
        const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return bTime - aTime;
    });

    // Apply limit
    tasks = tasks.slice(0, limit);

    // Calculate counts
    const counts = {
        executing: MOCK_EXECUTING_TASKS.filter((t) => t.status === 'executing').length,
        completed: MOCK_EXECUTING_TASKS.filter((t) => t.status === 'completed').length,
        failed: MOCK_EXECUTING_TASKS.filter((t) => t.status === 'failed').length,
    };

    return c.json({
        tasks,
        counts,
    });
});

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/tasks/:id
// Returns a single task by ID
// Story 2.7
// ----------------------------------------------------------------------------
missionControlRoutes.get('/tasks/:id', requireRole('operator'), async (c) => {
    const taskId = c.req.param('id');

    const task = MOCK_EXECUTING_TASKS.find((t) => t.id === taskId);

    if (!task) {
        return c.json(
            {
                type: 'https://aurais.ai/errors/not-found',
                title: 'Not Found',
                status: 404,
                detail: 'Task not found',
            },
            404
        );
    }

    return c.json(task);
});

// ============================================================================
// Story 3.1: Bot Tribunal Voting Records
// ============================================================================

type TribunalVoteType = 'approve' | 'deny' | 'abstain';
type TribunalConsensus = 'unanimous' | 'majority' | 'split' | 'deadlock';
type TribunalStatus = 'pending' | 'completed' | 'overridden';

interface TribunalVote {
    id: string;
    agentId: string;
    agentName: string;
    vote: TribunalVoteType;
    reasoning: string;
    confidence: number;
    votedAt: string;
    dissenting?: boolean;
}

interface TribunalRecord {
    decisionId: string;
    tribunalId: string;
    status: TribunalStatus;
    finalRecommendation: TribunalVoteType;
    consensus: TribunalConsensus;
    votedAt: string;
    votes: TribunalVote[];
    summary: {
        approveCount: number;
        denyCount: number;
        abstainCount: number;
        totalVotes: number;
        averageConfidence: number;
    };
}

// Mock tribunal data - maps decision ID to tribunal records
const MOCK_TRIBUNAL_RECORDS: Record<string, TribunalRecord> = {
    'ar-001': {
        decisionId: 'ar-001',
        tribunalId: 'trib-001',
        status: 'completed',
        finalRecommendation: 'approve',
        consensus: 'majority',
        votedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        votes: [
            {
                id: 'vote-001',
                agentId: 'validator-1',
                agentName: 'RiskAssessor-Prime',
                vote: 'approve',
                reasoning: 'Action within normal operational parameters. The data export size is large but the agent has successfully completed similar exports before. Low risk profile based on historical performance.',
                confidence: 0.92,
                votedAt: new Date(Date.now() - 2 * 60 * 60 * 1000 - 30000).toISOString(),
            },
            {
                id: 'vote-002',
                agentId: 'validator-2',
                agentName: 'ComplianceCheck-Alpha',
                vote: 'approve',
                reasoning: 'No compliance violations detected. Proper authorization chain verified. Data export format follows approved templates.',
                confidence: 0.88,
                votedAt: new Date(Date.now() - 2 * 60 * 60 * 1000 - 20000).toISOString(),
            },
            {
                id: 'vote-003',
                agentId: 'validator-3',
                agentName: 'SecurityGate-Beta',
                vote: 'deny',
                reasoning: 'Elevated risk due to recent similar action failures in the sector. Recommend additional verification before proceeding with bulk data operations.',
                confidence: 0.75,
                votedAt: new Date(Date.now() - 2 * 60 * 60 * 1000 - 10000).toISOString(),
                dissenting: true,
            },
        ],
        summary: {
            approveCount: 2,
            denyCount: 1,
            abstainCount: 0,
            totalVotes: 3,
            averageConfidence: 0.85,
        },
    },
    'ar-002': {
        decisionId: 'ar-002',
        tribunalId: 'trib-002',
        status: 'completed',
        finalRecommendation: 'approve',
        consensus: 'unanimous',
        votedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        votes: [
            {
                id: 'vote-004',
                agentId: 'validator-1',
                agentName: 'RiskAssessor-Prime',
                vote: 'approve',
                reasoning: 'Security scan is a routine operational task. Agent has appropriate clearance for production environment access.',
                confidence: 0.95,
                votedAt: new Date(Date.now() - 45 * 60 * 1000 - 30000).toISOString(),
            },
            {
                id: 'vote-005',
                agentId: 'validator-2',
                agentName: 'ComplianceCheck-Alpha',
                vote: 'approve',
                reasoning: 'Scan scope is within authorized parameters. No sensitive data access required.',
                confidence: 0.91,
                votedAt: new Date(Date.now() - 45 * 60 * 1000 - 20000).toISOString(),
            },
            {
                id: 'vote-006',
                agentId: 'validator-3',
                agentName: 'SecurityGate-Beta',
                vote: 'approve',
                reasoning: 'Full production scan is scheduled activity. All prerequisites met.',
                confidence: 0.94,
                votedAt: new Date(Date.now() - 45 * 60 * 1000 - 10000).toISOString(),
            },
        ],
        summary: {
            approveCount: 3,
            denyCount: 0,
            abstainCount: 0,
            totalVotes: 3,
            averageConfidence: 0.93,
        },
    },
    'ar-005': {
        decisionId: 'ar-005',
        tribunalId: 'trib-003',
        status: 'completed',
        finalRecommendation: 'deny',
        consensus: 'majority',
        votedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        votes: [
            {
                id: 'vote-007',
                agentId: 'validator-1',
                agentName: 'RiskAssessor-Prime',
                vote: 'deny',
                reasoning: 'Agent is in ERROR state. Data modifications should not proceed until agent status is resolved and root cause analyzed.',
                confidence: 0.97,
                votedAt: new Date(Date.now() - 30 * 60 * 1000 - 30000).toISOString(),
            },
            {
                id: 'vote-008',
                agentId: 'validator-2',
                agentName: 'ComplianceCheck-Alpha',
                vote: 'deny',
                reasoning: 'Compliance policy prohibits data modifications by agents in error states. Manual intervention required.',
                confidence: 0.99,
                votedAt: new Date(Date.now() - 30 * 60 * 1000 - 20000).toISOString(),
            },
            {
                id: 'vote-009',
                agentId: 'validator-3',
                agentName: 'SecurityGate-Beta',
                vote: 'abstain',
                reasoning: 'Unable to determine security implications without understanding the nature of the error state. Deferring to other validators.',
                confidence: 0.60,
                votedAt: new Date(Date.now() - 30 * 60 * 1000 - 10000).toISOString(),
            },
        ],
        summary: {
            approveCount: 0,
            denyCount: 2,
            abstainCount: 1,
            totalVotes: 3,
            averageConfidence: 0.85,
        },
    },
};

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/decisions/:id/tribunal
// Returns tribunal voting record for a decision
// Story 3.1: FR19
// ----------------------------------------------------------------------------
missionControlRoutes.get('/decisions/:id/tribunal', requireRole('operator'), async (c) => {
    const decisionId = c.req.param('id');
    const orgId = getOrgId(c) || 'demo-org';

    // First verify the decision exists and belongs to this org
    const actionRequest = MOCK_ACTION_REQUESTS.find(
        (ar) => ar.id === decisionId && ar.orgId === orgId
    );

    if (!actionRequest) {
        return c.json(
            {
                type: 'https://aurais.ai/errors/not-found',
                title: 'Not Found',
                status: 404,
                detail: 'Decision not found',
            },
            404
        );
    }

    // Get tribunal record for this decision
    const tribunalRecord = MOCK_TRIBUNAL_RECORDS[decisionId];

    if (!tribunalRecord) {
        // Not all decisions go through tribunal - only high-risk ones
        return c.json(
            {
                type: 'https://aurais.ai/errors/not-found',
                title: 'Not Found',
                status: 404,
                detail: 'No tribunal record exists for this decision. Tribunal review is only required for high-risk actions.',
            },
            404
        );
    }

    // Mark dissenting votes based on final recommendation
    const votesWithDissent = tribunalRecord.votes.map((vote) => ({
        ...vote,
        dissenting: vote.vote !== tribunalRecord.finalRecommendation && vote.vote !== 'abstain',
    }));

    return c.json({
        ...tribunalRecord,
        votes: votesWithDissent,
    });
});

// ============================================================================
// Story 3.2: Trust Gate Decision Explanations
// ============================================================================

type TrustGateRuleType =
    | 'trust_score_threshold'
    | 'risk_level'
    | 'action_type'
    | 'tier_permission'
    | 'rate_limit'
    | 'first_time_action';

interface TrustGateRule {
    id: string;
    type: TrustGateRuleType;
    name: string;
    description: string;
    threshold?: number;
    currentValue?: number;
    exceeded: boolean;
    isPrimary?: boolean;
}

interface TrustGateExplanationData {
    decisionId: string;
    agentId: string;
    agentName: string;
    agentTier: number;
    agentTrustScore: number;
    rules: TrustGateRule[];
    summary: string;
}

// Mock trust gate explanations - maps decision ID to explanation data
const MOCK_TRUST_GATE_EXPLANATIONS: Record<string, TrustGateExplanationData> = {
    'ar-001': {
        decisionId: 'ar-001',
        agentId: 'worker-1',
        agentName: 'DataProcessor-Alpha',
        agentTier: 1,
        agentTrustScore: 350,
        rules: [
            {
                id: 'rule-001',
                type: 'trust_score_threshold',
                name: 'Trust Score Below Threshold',
                description: 'Agent trust score (350) is below the required threshold (600) for autonomous bulk data operations',
                threshold: 600,
                currentValue: 350,
                exceeded: true,
                isPrimary: true,
            },
            {
                id: 'rule-002',
                type: 'action_type',
                name: 'High-Volume Data Export',
                description: 'Data exports exceeding 10,000 records require HITL approval regardless of trust score',
                exceeded: true,
                isPrimary: false,
            },
        ],
        summary: 'This action required human approval due to 2 governance rules: low trust score and high data volume',
    },
    'ar-002': {
        decisionId: 'ar-002',
        agentId: 'specialist-1',
        agentName: 'SecurityAnalyst',
        agentTier: 2,
        agentTrustScore: 550,
        rules: [
            {
                id: 'rule-003',
                type: 'action_type',
                name: 'Production Environment Access',
                description: 'Security scans on production environment always require HITL approval for audit compliance',
                exceeded: true,
                isPrimary: true,
            },
            {
                id: 'rule-004',
                type: 'risk_level',
                name: 'Elevated Risk Level',
                description: 'Full-scope security scans are classified as high-risk operations',
                exceeded: true,
                isPrimary: false,
            },
        ],
        summary: 'This action required human approval due to production environment access policies',
    },
    'ar-003': {
        decisionId: 'ar-003',
        agentId: 'worker-2',
        agentName: 'DataProcessor-Beta',
        agentTier: 1,
        agentTrustScore: 280,
        rules: [
            {
                id: 'rule-005',
                type: 'trust_score_threshold',
                name: 'Trust Score Below Threshold',
                description: 'Agent trust score (280) is below the minimum threshold (400) for autonomous operations',
                threshold: 400,
                currentValue: 280,
                exceeded: true,
                isPrimary: true,
            },
        ],
        summary: 'This action required human approval due to the agent\'s low trust score',
    },
    'ar-004': {
        decisionId: 'ar-004',
        agentId: 'listener-1',
        agentName: 'EventListener',
        agentTier: 0,
        agentTrustScore: 50,
        rules: [
            {
                id: 'rule-006',
                type: 'tier_permission',
                name: 'Tier 0 Permission Restriction',
                description: 'Tier 0 (Untrusted) agents cannot perform alert escalations autonomously',
                exceeded: true,
                isPrimary: true,
            },
            {
                id: 'rule-007',
                type: 'action_type',
                name: 'Alert Escalation Action',
                description: 'Alert escalations affect operational workflows and require human verification',
                exceeded: true,
                isPrimary: false,
            },
        ],
        summary: 'This action required human approval due to tier-based permission restrictions',
    },
    'ar-005': {
        decisionId: 'ar-005',
        agentId: 'error-1',
        agentName: 'FaultyWorker',
        agentTier: 1,
        agentTrustScore: 150,
        rules: [
            {
                id: 'rule-008',
                type: 'risk_level',
                name: 'Agent in Error State',
                description: 'Agents in ERROR state cannot perform any actions autonomously until status is resolved',
                exceeded: true,
                isPrimary: true,
            },
            {
                id: 'rule-009',
                type: 'action_type',
                name: 'Data Modification Action',
                description: 'Data correction operations require HITL approval to prevent cascading errors',
                exceeded: true,
                isPrimary: false,
            },
            {
                id: 'rule-010',
                type: 'trust_score_threshold',
                name: 'Critically Low Trust Score',
                description: 'Agent trust score (150) is critically low, indicating reliability concerns',
                threshold: 300,
                currentValue: 150,
                exceeded: true,
                isPrimary: false,
            },
        ],
        summary: 'This action required human approval due to 3 governance rules: agent error state, data modification risk, and critically low trust score',
    },
};

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/decisions/:id/trust-gate
// Returns Trust Gate explanation for why a decision required review
// Story 3.2: FR20
// ----------------------------------------------------------------------------
missionControlRoutes.get('/decisions/:id/trust-gate', requireRole('operator'), async (c) => {
    const decisionId = c.req.param('id');
    const orgId = getOrgId(c) || 'demo-org';

    // First verify the decision exists and belongs to this org
    const actionRequest = MOCK_ACTION_REQUESTS.find(
        (ar) => ar.id === decisionId && ar.orgId === orgId
    );

    if (!actionRequest) {
        return c.json(
            {
                type: 'https://aurais.ai/errors/not-found',
                title: 'Not Found',
                status: 404,
                detail: 'Decision not found',
            },
            404
        );
    }

    // Get trust gate explanation for this decision
    const explanation = MOCK_TRUST_GATE_EXPLANATIONS[decisionId];

    if (!explanation) {
        // Generate a basic explanation based on the action request
        const agent = MOCK_AGENTS.find((a) => a.id === actionRequest.agentId);
        const basicExplanation: TrustGateExplanationData = {
            decisionId,
            agentId: actionRequest.agentId,
            agentName: actionRequest.agentName,
            agentTier: agent?.tier ?? 0,
            agentTrustScore: agent?.trustScore ?? 0,
            rules: actionRequest.trustGateRules?.map((rule, index) => ({
                id: `rule-auto-${index}`,
                type: 'action_type' as TrustGateRuleType,
                name: rule.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                description: `Trust Gate rule "${rule}" triggered review for this action`,
                exceeded: true,
                isPrimary: index === 0,
            })) || [],
            summary: actionRequest.queuedReason || 'This action required human approval',
        };
        return c.json(basicExplanation);
    }

    return c.json(explanation);
});

// ============================================================================
// Story 3.3: HITL Override with Rationale
// ============================================================================

type OverrideType = 'approve' | 'deny';

interface OverrideRecord {
    id: string;
    decisionId: string;
    tribunalId: string;
    overriddenBy: string;
    overriddenByName: string;
    overrideType: OverrideType;
    originalRecommendation: TribunalVoteType;
    rationale: string;
    overriddenAt: string;
}

// In-memory storage for overrides (would be in database in production)
const OVERRIDE_RECORDS: Record<string, OverrideRecord> = {};

// Minimum rationale length for meaningful explanation
const MIN_RATIONALE_LENGTH = 50;

// ----------------------------------------------------------------------------
// POST /api/v1/mission-control/decisions/:id/override
// Overrides a Bot Tribunal decision with documented rationale
// Story 3.3: FR21
// ----------------------------------------------------------------------------
missionControlRoutes.post('/decisions/:id/override', requireRole('operator'), async (c) => {
    const decisionId = c.req.param('id');
    const orgId = getOrgId(c) || 'demo-org';
    const user = getUserContext(c);
    const userId = user?.id || 'anonymous';
    const userName = user?.name || 'Anonymous Operator';

    // Parse request body
    let body: {
        overrideType?: OverrideType;
        rationale?: string;
    } = {};

    try {
        body = await c.req.json();
    } catch {
        return c.json(
            {
                type: 'https://aurais.ai/errors/bad-request',
                title: 'Bad Request',
                status: 400,
                detail: 'Invalid request body',
            },
            400
        );
    }

    // Validate required fields
    if (!body.overrideType || !['approve', 'deny'].includes(body.overrideType)) {
        return c.json(
            {
                type: 'https://aurais.ai/errors/validation',
                title: 'Validation Error',
                status: 400,
                detail: 'overrideType must be either "approve" or "deny"',
            },
            400
        );
    }

    if (!body.rationale || typeof body.rationale !== 'string') {
        return c.json(
            {
                type: 'https://aurais.ai/errors/validation',
                title: 'Validation Error',
                status: 400,
                detail: 'Rationale is required for tribunal override',
            },
            400
        );
    }

    if (body.rationale.trim().length < MIN_RATIONALE_LENGTH) {
        return c.json(
            {
                type: 'https://aurais.ai/errors/validation',
                title: 'Validation Error',
                status: 400,
                detail: `Rationale must be at least ${MIN_RATIONALE_LENGTH} characters to provide meaningful justification`,
                minLength: MIN_RATIONALE_LENGTH,
                currentLength: body.rationale.trim().length,
            },
            400
        );
    }

    // Find the action request
    const actionIndex = MOCK_ACTION_REQUESTS.findIndex(
        (ar) => ar.id === decisionId && ar.orgId === orgId
    );

    if (actionIndex === -1) {
        return c.json(
            {
                type: 'https://aurais.ai/errors/not-found',
                title: 'Not Found',
                status: 404,
                detail: 'Decision not found',
            },
            404
        );
    }

    const actionRequest = MOCK_ACTION_REQUESTS[actionIndex]!;

    // Check if already decided
    if (actionRequest.status !== 'pending') {
        return c.json(
            {
                type: 'https://aurais.ai/errors/conflict',
                title: 'Conflict',
                status: 409,
                detail: `Decision has already been ${actionRequest.status}`,
            },
            409
        );
    }

    // Get tribunal record
    const tribunalRecord = MOCK_TRIBUNAL_RECORDS[decisionId];
    if (!tribunalRecord) {
        return c.json(
            {
                type: 'https://aurais.ai/errors/bad-request',
                title: 'Bad Request',
                status: 400,
                detail: 'No tribunal record exists for this decision. Override is only applicable to tribunal-reviewed decisions.',
            },
            400
        );
    }

    // Validate that override is different from tribunal recommendation
    if (body.overrideType === tribunalRecord.finalRecommendation) {
        return c.json(
            {
                type: 'https://aurais.ai/errors/validation',
                title: 'Validation Error',
                status: 400,
                detail: `Cannot override to "${body.overrideType}" - tribunal already recommended "${tribunalRecord.finalRecommendation}". Use standard approve/deny endpoint instead.`,
            },
            400
        );
    }

    // Create override record
    const overriddenAt = new Date().toISOString();
    const overrideRecord: OverrideRecord = {
        id: `override-${Date.now()}`,
        decisionId,
        tribunalId: tribunalRecord.tribunalId,
        overriddenBy: userId,
        overriddenByName: userName,
        overrideType: body.overrideType,
        originalRecommendation: tribunalRecord.finalRecommendation,
        rationale: body.rationale.trim(),
        overriddenAt,
    };

    // Store override record
    OVERRIDE_RECORDS[decisionId] = overrideRecord;

    // Update tribunal status to 'overridden'
    MOCK_TRIBUNAL_RECORDS[decisionId] = {
        ...tribunalRecord,
        status: 'overridden',
    };

    // Update action request status
    const newStatus = body.overrideType === 'approve' ? 'approved' : 'denied';
    MOCK_ACTION_REQUESTS[actionIndex] = {
        ...actionRequest,
        status: newStatus,
        decidedBy: userId,
        decidedAt: overriddenAt,
        decisionReason: `[TRIBUNAL OVERRIDE] ${body.rationale.trim()}`,
        updatedAt: overriddenAt,
    };

    return c.json({
        success: true,
        override: overrideRecord,
        decision: {
            id: decisionId,
            status: newStatus,
            decidedBy: userId,
            decidedAt: overriddenAt,
        },
        message: `Tribunal decision overridden. Original recommendation was "${tribunalRecord.finalRecommendation}", now "${body.overrideType}".`,
    });
});

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/decisions/:id/override
// Returns override record for a decision if exists
// Story 3.3: FR21
// ----------------------------------------------------------------------------
missionControlRoutes.get('/decisions/:id/override', requireRole('operator'), async (c) => {
    const decisionId = c.req.param('id');
    const orgId = getOrgId(c) || 'demo-org';

    // Verify decision exists and belongs to org
    const actionRequest = MOCK_ACTION_REQUESTS.find(
        (ar) => ar.id === decisionId && ar.orgId === orgId
    );

    if (!actionRequest) {
        return c.json(
            {
                type: 'https://aurais.ai/errors/not-found',
                title: 'Not Found',
                status: 404,
                detail: 'Decision not found',
            },
            404
        );
    }

    const overrideRecord = OVERRIDE_RECORDS[decisionId];

    if (!overrideRecord) {
        return c.json(
            {
                type: 'https://aurais.ai/errors/not-found',
                title: 'Not Found',
                status: 404,
                detail: 'No override record exists for this decision',
            },
            404
        );
    }

    return c.json(overrideRecord);
});

// ============================================================================
// Story 3.4: Director Governance Rule Approval
// ============================================================================

type GovernanceRuleType =
    | 'trust_threshold'
    | 'action_permission'
    | 'rate_limit'
    | 'tier_requirement'
    | 'time_restriction';

type GovernanceRuleStatus = 'draft' | 'pending' | 'approved' | 'denied' | 'archived';

interface GovernanceRuleDefinition {
    type: GovernanceRuleType;
    threshold?: number;
    actions?: string[];
    tierRequired?: number;
    schedule?: { start: string; end: string };
    description: string;
}

interface GovernanceRuleImpact {
    affectedAgentCount: number;
    estimatedApprovalRateChange: number;
    affectedActionTypes: string[];
    riskLevel: 'low' | 'medium' | 'high';
}

interface GovernanceRule {
    id: string;
    orgId: string;
    name: string;
    status: GovernanceRuleStatus;
    version: number;
    currentDefinition: GovernanceRuleDefinition;
    proposedDefinition?: GovernanceRuleDefinition;
    impact?: GovernanceRuleImpact;
    proposedBy: string;
    proposedByName: string;
    proposedAt: string;
    proposalReason: string;
    decidedBy?: string;
    decidedByName?: string;
    decidedAt?: string;
    decisionReason?: string;
    createdAt: string;
    updatedAt: string;
}

// Mock governance rules
const MOCK_GOVERNANCE_RULES: GovernanceRule[] = [
    {
        id: 'rule-001',
        orgId: 'demo-org',
        name: 'High-Risk Action Trust Threshold',
        status: 'pending',
        version: 2,
        currentDefinition: {
            type: 'trust_threshold',
            threshold: 600,
            actions: ['data_delete', 'bulk_update'],
            description: 'Minimum trust score for high-risk data operations',
        },
        proposedDefinition: {
            type: 'trust_threshold',
            threshold: 700,
            actions: ['data_delete', 'bulk_update', 'schema_modify'],
            description: 'Increased threshold and added schema modifications',
        },
        impact: {
            affectedAgentCount: 12,
            estimatedApprovalRateChange: -15,
            affectedActionTypes: ['data_delete', 'bulk_update', 'schema_modify'],
            riskLevel: 'medium',
        },
        proposedBy: 'user-456',
        proposedByName: 'Jane Supervisor',
        proposedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        proposalReason: 'Recent security audit recommended stricter thresholds for data operations',
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 'rule-002',
        orgId: 'demo-org',
        name: 'Tier 0 Action Restrictions',
        status: 'pending',
        version: 1,
        currentDefinition: {
            type: 'tier_requirement',
            tierRequired: 1,
            actions: ['alert_escalation'],
            description: 'Untrusted agents cannot escalate alerts',
        },
        proposedDefinition: {
            type: 'tier_requirement',
            tierRequired: 2,
            actions: ['alert_escalation', 'external_notification'],
            description: 'Require Trusted tier for all external communications',
        },
        impact: {
            affectedAgentCount: 5,
            estimatedApprovalRateChange: -8,
            affectedActionTypes: ['alert_escalation', 'external_notification'],
            riskLevel: 'low',
        },
        proposedBy: 'user-789',
        proposedByName: 'Security Team Lead',
        proposedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        proposalReason: 'Prevent unauthorized external communications from low-tier agents',
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 'rule-003',
        orgId: 'demo-org',
        name: 'Production Access Rate Limit',
        status: 'pending',
        version: 3,
        currentDefinition: {
            type: 'rate_limit',
            threshold: 100,
            actions: ['production_access'],
            description: 'Maximum 100 production access requests per hour',
        },
        proposedDefinition: {
            type: 'rate_limit',
            threshold: 50,
            actions: ['production_access', 'database_query'],
            description: 'Reduced rate limit and expanded scope to include database queries',
        },
        impact: {
            affectedAgentCount: 8,
            estimatedApprovalRateChange: -22,
            affectedActionTypes: ['production_access', 'database_query'],
            riskLevel: 'high',
        },
        proposedBy: 'user-456',
        proposedByName: 'Jane Supervisor',
        proposedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        proposalReason: 'Performance concerns during peak hours require stricter rate limiting',
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 'rule-004',
        orgId: 'demo-org',
        name: 'After-Hours Restrictions',
        status: 'approved',
        version: 1,
        currentDefinition: {
            type: 'time_restriction',
            schedule: { start: '18:00', end: '08:00' },
            actions: ['bulk_update', 'data_export'],
            description: 'Restrict bulk operations to business hours',
        },
        proposedBy: 'user-123',
        proposedByName: 'Operations Manager',
        proposedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        proposalReason: 'Reduce risk of unattended bulk operations',
        decidedBy: 'director-001',
        decidedByName: 'Director Smith',
        decidedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        decisionReason: 'Approved as part of operational risk reduction initiative',
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 'rule-005',
        orgId: 'demo-org',
        name: 'Customer Data Export Approval',
        status: 'denied',
        version: 2,
        currentDefinition: {
            type: 'action_permission',
            actions: ['customer_data_export'],
            threshold: 800,
            description: 'Trust threshold for customer data exports',
        },
        proposedDefinition: {
            type: 'action_permission',
            actions: ['customer_data_export'],
            threshold: 500,
            description: 'Lower threshold to allow more agents to export customer data',
        },
        proposedBy: 'user-999',
        proposedByName: 'Data Team Lead',
        proposedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        proposalReason: 'Increase operational efficiency by allowing more agents to handle data exports',
        decidedBy: 'director-001',
        decidedByName: 'Director Smith',
        decidedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        decisionReason: 'Denied due to compliance concerns. Customer data exports require high trust verification.',
        createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
];

// Minimum reason length for governance decisions
const MIN_DECISION_REASON_LENGTH = 20;

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/rules/pending
// Returns pending governance rule proposals for director review
// Story 3.4: FR22
// ----------------------------------------------------------------------------
missionControlRoutes.get('/rules/pending', requireRole('director'), async (c) => {
    const orgId = getOrgId(c) || 'demo-org';

    // Filter to pending rules for this org
    const pendingRules = MOCK_GOVERNANCE_RULES.filter(
        (r) => r.orgId === orgId && r.status === 'pending'
    );

    // Sort by proposedAt (oldest first)
    pendingRules.sort((a, b) =>
        new Date(a.proposedAt).getTime() - new Date(b.proposedAt).getTime()
    );

    // Calculate counts
    const allOrgRules = MOCK_GOVERNANCE_RULES.filter((r) => r.orgId === orgId);
    const counts = {
        pending: allOrgRules.filter((r) => r.status === 'pending').length,
        approved: allOrgRules.filter((r) => r.status === 'approved').length,
        denied: allOrgRules.filter((r) => r.status === 'denied').length,
    };

    return c.json({
        rules: pendingRules,
        counts,
    });
});

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/rules/:id
// Returns a single governance rule by ID
// Story 3.4: FR22
// ----------------------------------------------------------------------------
missionControlRoutes.get('/rules/:id', requireRole('operator'), async (c) => {
    const ruleId = c.req.param('id');
    const orgId = getOrgId(c) || 'demo-org';

    const rule = MOCK_GOVERNANCE_RULES.find(
        (r) => r.id === ruleId && r.orgId === orgId
    );

    if (!rule) {
        return c.json(
            {
                type: 'https://aurais.ai/errors/not-found',
                title: 'Not Found',
                status: 404,
                detail: 'Governance rule not found',
            },
            404
        );
    }

    return c.json(rule);
});

// ----------------------------------------------------------------------------
// POST /api/v1/mission-control/rules/:id/decide
// Approve or deny a governance rule proposal
// Story 3.4: FR22
// ----------------------------------------------------------------------------
missionControlRoutes.post('/rules/:id/decide', requireRole('director'), async (c) => {
    const ruleId = c.req.param('id');
    const orgId = getOrgId(c) || 'demo-org';
    const user = getUserContext(c);
    const userId = user?.id || 'anonymous';
    const userName = user?.name || 'Anonymous Director';

    // Parse request body
    let body: {
        action?: 'approve' | 'deny';
        reason?: string;
    } = {};

    try {
        body = await c.req.json();
    } catch {
        return c.json(
            {
                type: 'https://aurais.ai/errors/bad-request',
                title: 'Bad Request',
                status: 400,
                detail: 'Invalid request body',
            },
            400
        );
    }

    // Validate required fields
    if (!body.action || !['approve', 'deny'].includes(body.action)) {
        return c.json(
            {
                type: 'https://aurais.ai/errors/validation',
                title: 'Validation Error',
                status: 400,
                detail: 'action must be either "approve" or "deny"',
            },
            400
        );
    }

    if (!body.reason || typeof body.reason !== 'string') {
        return c.json(
            {
                type: 'https://aurais.ai/errors/validation',
                title: 'Validation Error',
                status: 400,
                detail: 'Reason is required for governance rule decisions',
            },
            400
        );
    }

    if (body.reason.trim().length < MIN_DECISION_REASON_LENGTH) {
        return c.json(
            {
                type: 'https://aurais.ai/errors/validation',
                title: 'Validation Error',
                status: 400,
                detail: `Reason must be at least ${MIN_DECISION_REASON_LENGTH} characters`,
                minLength: MIN_DECISION_REASON_LENGTH,
                currentLength: body.reason.trim().length,
            },
            400
        );
    }

    // Find the rule
    const ruleIndex = MOCK_GOVERNANCE_RULES.findIndex(
        (r) => r.id === ruleId && r.orgId === orgId
    );

    if (ruleIndex === -1) {
        return c.json(
            {
                type: 'https://aurais.ai/errors/not-found',
                title: 'Not Found',
                status: 404,
                detail: 'Governance rule not found',
            },
            404
        );
    }

    const rule = MOCK_GOVERNANCE_RULES[ruleIndex]!;

    // Check if rule is pending
    if (rule.status !== 'pending') {
        return c.json(
            {
                type: 'https://aurais.ai/errors/conflict',
                title: 'Conflict',
                status: 409,
                detail: `Rule has already been ${rule.status}`,
            },
            409
        );
    }

    // Update the rule
    const decidedAt = new Date().toISOString();
    const newStatus = body.action === 'approve' ? 'approved' : 'denied';

    const updatedRule: GovernanceRule = {
        ...rule,
        status: newStatus,
        decidedBy: userId,
        decidedByName: userName,
        decidedAt,
        decisionReason: body.reason.trim(),
        updatedAt: decidedAt,
        // If approved, apply the proposed definition as current
        ...(body.action === 'approve' && rule.proposedDefinition
            ? {
                  currentDefinition: rule.proposedDefinition,
                  proposedDefinition: undefined,
                  version: rule.version + 1,
              }
            : {}),
    };

    MOCK_GOVERNANCE_RULES[ruleIndex] = updatedRule;

    return c.json({
        success: true,
        rule: updatedRule,
        message: body.action === 'approve'
            ? `Rule "${rule.name}" approved and activated. Version updated to ${updatedRule.version}.`
            : `Rule "${rule.name}" denied. Proposer will be notified.`,
    });
});

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/rules
// Returns all governance rules for the organization
// Story 3.4: FR22
// ----------------------------------------------------------------------------
missionControlRoutes.get('/rules', requireRole('operator'), async (c) => {
    const orgId = getOrgId(c) || 'demo-org';
    const statusFilter = c.req.query('status') as GovernanceRuleStatus | undefined;

    let rules = MOCK_GOVERNANCE_RULES.filter((r) => r.orgId === orgId);

    // Apply status filter
    if (statusFilter) {
        rules = rules.filter((r) => r.status === statusFilter);
    }

    // Sort by updatedAt descending
    rules.sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    // Calculate counts
    const counts = {
        pending: MOCK_GOVERNANCE_RULES.filter((r) => r.orgId === orgId && r.status === 'pending').length,
        approved: MOCK_GOVERNANCE_RULES.filter((r) => r.orgId === orgId && r.status === 'approved').length,
        denied: MOCK_GOVERNANCE_RULES.filter((r) => r.orgId === orgId && r.status === 'denied').length,
    };

    return c.json({
        rules,
        counts,
    });
});

// ============================================================================
// Epic 4: Cryptographic Audit Trail
// Stories 4.1-4.5: Audit entries, hash verification, accountability chain,
// HITL metrics, automation bias alerts
// ============================================================================

type AuditActionType =
    | 'decision_approved'
    | 'decision_denied'
    | 'task_started'
    | 'task_completed'
    | 'task_failed'
    | 'agent_spawned'
    | 'agent_terminated'
    | 'trust_changed'
    | 'override_applied'
    | 'investigation_started';

type AuditOutcome = 'success' | 'failure' | 'pending' | 'cancelled';
type HashStatus = 'verified' | 'unverified' | 'invalid' | 'checking';

interface AuditEntry {
    id: string;
    orgId: string;
    timestamp: string;
    agentId: string;
    agentName: string;
    actionType: AuditActionType;
    actionDetails: string;
    outcome: AuditOutcome;
    hashStatus: HashStatus;
    currentHash: string;
    previousHash: string;
    hashAlgorithm: string;
    actingAgentId: string;
    supervisingAgentId?: string;
    hitlReviewerId?: string;
    tribunalIds?: string[];
    governanceOwnerId?: string;
}

// Generate mock hash
function generateMockHash(): string {
    return Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
    ).join('');
}

// Mock audit entries
const MOCK_AUDIT_ENTRIES: AuditEntry[] = Array.from({ length: 50 }, (_, i) => {
    const actionTypes: AuditActionType[] = [
        'decision_approved', 'decision_denied', 'task_started',
        'task_completed', 'task_failed', 'agent_spawned', 'trust_changed'
    ];
    const outcomes: AuditOutcome[] = ['success', 'failure', 'pending'];
    const agents = ['DataProcessor-Alpha', 'SecurityAnalyst', 'EventListener', 'FaultyWorker'];
    const agentIds = ['worker-1', 'specialist-1', 'listener-1', 'error-1'];

    const agentIndex = i % agents.length;
    const actionType = actionTypes[i % actionTypes.length];
    const prevHash = i === 0 ? '0'.repeat(64) : generateMockHash();

    return {
        id: `audit-${String(i + 1).padStart(3, '0')}`,
        orgId: 'demo-org',
        timestamp: new Date(Date.now() - i * 30 * 60 * 1000).toISOString(),
        agentId: agentIds[agentIndex]!,
        agentName: agents[agentIndex]!,
        actionType: actionType!,
        actionDetails: `${actionType!.replace(/_/g, ' ')} for request ${i + 1}`,
        outcome: outcomes[i % outcomes.length]!,
        hashStatus: i % 10 === 9 ? 'unverified' : 'verified',
        currentHash: generateMockHash(),
        previousHash: prevHash,
        hashAlgorithm: 'SHA-256',
        actingAgentId: agentIds[agentIndex]!,
        supervisingAgentId: i % 3 === 0 ? 'exec-1' : undefined,
        hitlReviewerId: i % 5 === 0 ? 'user-123' : undefined,
        tribunalIds: i % 7 === 0 ? ['validator-1', 'validator-2'] : undefined,
        governanceOwnerId: 'director-001',
    };
});

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/audit
// Returns audit trail with cursor pagination
// Story 4.1: FR23
// ----------------------------------------------------------------------------
missionControlRoutes.get('/audit', requireRole('operator'), async (c) => {
    const orgId = getOrgId(c) || 'demo-org';
    const cursor = c.req.query('cursor');
    const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 50);
    const actionType = c.req.query('actionType') as AuditActionType | undefined;
    const outcome = c.req.query('outcome') as AuditOutcome | undefined;
    const agentId = c.req.query('agentId');

    let entries = MOCK_AUDIT_ENTRIES.filter((e) => e.orgId === orgId);

    // Apply filters
    if (actionType) entries = entries.filter((e) => e.actionType === actionType);
    if (outcome) entries = entries.filter((e) => e.outcome === outcome);
    if (agentId) entries = entries.filter((e) => e.agentId === agentId);

    // Sort by timestamp descending
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply cursor pagination
    let startIndex = 0;
    if (cursor) {
        const cursorIndex = entries.findIndex((e) => e.id === cursor);
        startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
    }

    const paginatedEntries = entries.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < entries.length;
    const nextCursor = hasMore ? paginatedEntries[paginatedEntries.length - 1]?.id : undefined;

    return c.json({
        entries: paginatedEntries,
        cursor: nextCursor,
        hasMore,
        total: entries.length,
    });
});

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/audit/:id
// Returns single audit entry with full details
// Story 4.1: FR23
// ----------------------------------------------------------------------------
missionControlRoutes.get('/audit/:id', requireRole('operator'), async (c) => {
    const entryId = c.req.param('id');
    const orgId = getOrgId(c) || 'demo-org';

    const entry = MOCK_AUDIT_ENTRIES.find((e) => e.id === entryId && e.orgId === orgId);

    if (!entry) {
        return c.json({ type: 'https://aurais.ai/errors/not-found', title: 'Not Found', status: 404, detail: 'Audit entry not found' }, 404);
    }

    return c.json(entry);
});

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/audit/:id/verify
// Verifies hash chain for an entry
// Story 4.2: FR24, FR30
// ----------------------------------------------------------------------------
missionControlRoutes.get('/audit/:id/verify', requireRole('operator'), async (c) => {
    const entryId = c.req.param('id');
    const orgId = getOrgId(c) || 'demo-org';

    const entry = MOCK_AUDIT_ENTRIES.find((e) => e.id === entryId && e.orgId === orgId);

    if (!entry) {
        return c.json({ type: 'https://aurais.ai/errors/not-found', title: 'Not Found', status: 404, detail: 'Audit entry not found' }, 404);
    }

    // Simulate verification (in production would actually verify hash chain)
    const isValid = entry.hashStatus !== 'invalid';
    const chainIntact = entry.previousHash !== '0'.repeat(64) || entry.id === 'audit-001';

    return c.json({
        entryId,
        status: isValid ? 'verified' : 'invalid',
        currentHash: entry.currentHash,
        previousHash: entry.previousHash,
        expectedHash: entry.currentHash,
        algorithm: entry.hashAlgorithm,
        verifiedAt: new Date().toISOString(),
        chainIntact,
        error: isValid ? undefined : 'Hash mismatch detected',
    });
});

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/audit/:id/accountability
// Returns 5-level accountability chain for an entry
// Story 4.3: FR25
// ----------------------------------------------------------------------------
missionControlRoutes.get('/audit/:id/accountability', requireRole('operator'), async (c) => {
    const entryId = c.req.param('id');
    const orgId = getOrgId(c) || 'demo-org';

    const entry = MOCK_AUDIT_ENTRIES.find((e) => e.id === entryId && e.orgId === orgId);

    if (!entry) {
        return c.json({ type: 'https://aurais.ai/errors/not-found', title: 'Not Found', status: 404, detail: 'Audit entry not found' }, 404);
    }

    const agent = MOCK_AGENTS.find((a) => a.id === entry.actingAgentId);

    const levels = [
        {
            level: 1,
            title: 'Acting Agent',
            entityId: entry.actingAgentId,
            entityName: entry.agentName,
            entityType: 'agent',
            applicable: true,
        },
        {
            level: 2,
            title: 'Supervising Agent',
            entityId: entry.supervisingAgentId,
            entityName: entry.supervisingAgentId ? 'T5-EXECUTOR' : undefined,
            entityType: entry.supervisingAgentId ? 'agent' : 'na',
            applicable: !!entry.supervisingAgentId,
            reason: entry.supervisingAgentId ? undefined : 'No supervising agent assigned',
        },
        {
            level: 3,
            title: 'HITL Reviewer',
            entityId: entry.hitlReviewerId,
            entityName: entry.hitlReviewerId ? 'John Operator' : undefined,
            entityType: entry.hitlReviewerId ? 'hitl' : 'na',
            applicable: !!entry.hitlReviewerId,
            reason: entry.hitlReviewerId ? undefined : 'Action did not require HITL review',
        },
        {
            level: 4,
            title: 'Tribunal Members',
            entityId: entry.tribunalIds?.join(','),
            entityName: entry.tribunalIds ? 'Bot Tribunal' : undefined,
            entityType: entry.tribunalIds ? 'tribunal' : 'na',
            applicable: !!entry.tribunalIds?.length,
            reason: entry.tribunalIds ? undefined : 'Action did not require tribunal review',
        },
        {
            level: 5,
            title: 'Governance Owner',
            entityId: entry.governanceOwnerId,
            entityName: 'Director Smith',
            entityType: 'governance',
            applicable: true,
        },
    ];

    return c.json({ entryId, levels });
});

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/metrics/hitl
// Returns HITL quality metrics
// Story 4.4: FR28
// ----------------------------------------------------------------------------
missionControlRoutes.get('/metrics/hitl', requireRole('supervisor'), async (c) => {
    const orgId = getOrgId(c) || 'demo-org';

    // Mock HITL metrics per operator
    const operatorMetrics = [
        {
            userId: 'user-123',
            userName: 'John Operator',
            period: 'last_7_days',
            avgReviewTimeMs: 15000,
            detailViewRate: 0.85,
            sampleDataViewRate: 0.72,
            avgScrollDepth: 0.68,
            totalDecisions: 45,
            automationBiasRisk: 'low',
        },
        {
            userId: 'user-456',
            userName: 'Jane Supervisor',
            period: 'last_7_days',
            avgReviewTimeMs: 8500,
            detailViewRate: 0.65,
            sampleDataViewRate: 0.45,
            avgScrollDepth: 0.42,
            totalDecisions: 82,
            automationBiasRisk: 'medium',
        },
        {
            userId: 'user-789',
            userName: 'Bob Quick',
            period: 'last_7_days',
            avgReviewTimeMs: 2100,
            detailViewRate: 0.15,
            sampleDataViewRate: 0.08,
            avgScrollDepth: 0.12,
            totalDecisions: 156,
            automationBiasRisk: 'high',
        },
    ];

    const summary = {
        orgId,
        period: 'last_7_days',
        avgReviewTimeMs: Math.round(operatorMetrics.reduce((s, m) => s + m.avgReviewTimeMs, 0) / operatorMetrics.length),
        detailViewRate: operatorMetrics.reduce((s, m) => s + m.detailViewRate, 0) / operatorMetrics.length,
        sampleDataViewRate: operatorMetrics.reduce((s, m) => s + m.sampleDataViewRate, 0) / operatorMetrics.length,
        operatorCount: operatorMetrics.length,
        biasAlertCount: operatorMetrics.filter((m) => m.automationBiasRisk === 'high').length,
    };

    return c.json({ operators: operatorMetrics, summary });
});

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/alerts/bias
// Returns automation bias alerts
// Story 4.5: FR29
// ----------------------------------------------------------------------------
missionControlRoutes.get('/alerts/bias', requireRole('supervisor'), async (c) => {
    const orgId = getOrgId(c) || 'demo-org';
    const statusFilter = c.req.query('status') as 'active' | 'acknowledged' | 'resolved' | undefined;

    const alerts = [
        {
            id: 'bias-001',
            orgId: 'demo-org',
            userId: 'user-789',
            userName: 'Bob Quick',
            severity: 'critical',
            status: 'active',
            reason: 'Average review time under 3 seconds for 156 decisions in past 7 days',
            metrics: { avgReviewTimeMs: 2100, decisionCount: 156, detailViewRate: 0.15 },
            detectedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        },
        {
            id: 'bias-002',
            orgId: 'demo-org',
            userId: 'user-456',
            userName: 'Jane Supervisor',
            severity: 'warning',
            status: 'acknowledged',
            reason: 'Low detail view rate (45%) with high decision volume',
            metrics: { avgReviewTimeMs: 8500, decisionCount: 82, detailViewRate: 0.45 },
            detectedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            acknowledgedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        },
    ];

    let filtered = alerts.filter((a) => a.orgId === orgId);
    if (statusFilter) filtered = filtered.filter((a) => a.status === statusFilter);

    return c.json({
        alerts: filtered,
        counts: {
            active: alerts.filter((a) => a.status === 'active').length,
            acknowledged: alerts.filter((a) => a.status === 'acknowledged').length,
            resolved: alerts.filter((a) => a.status === 'resolved').length,
        },
    });
});

// ----------------------------------------------------------------------------
// POST /api/v1/mission-control/alerts/bias/:id/acknowledge
// Acknowledge a bias alert
// Story 4.5: FR29
// ----------------------------------------------------------------------------
missionControlRoutes.post('/alerts/bias/:id/acknowledge', requireRole('supervisor'), async (c) => {
    const alertId = c.req.param('id');

    return c.json({
        success: true,
        alert: {
            id: alertId,
            status: 'acknowledged',
            acknowledgedAt: new Date().toISOString(),
        },
    });
});

// ============================================================================
// EPIC 5: COMPLIANCE & EVIDENCE PACKAGES
// Story 5.1: Customer Data Trail Search (FR26)
// Story 5.2: Evidence Package Generator (FR27)
// ============================================================================

// Mock customer data for searches
const mockCustomerDataTrails = Array.from({ length: 30 }, (_, i) => {
    const operations = ['read', 'write', 'delete', 'export'] as const;
    const dataCategories = ['personal_info', 'financial_records', 'transaction_history', 'preferences', 'communications'];
    const agentNames = ['DataProcessor', 'ReportGenerator', 'ComplianceChecker', 'CustomerService', 'AnalyticsEngine'];

    return {
        id: `trail-${String(i + 1).padStart(3, '0')}`,
        timestamp: new Date(Date.now() - i * 3600000).toISOString(),
        actionType: 'task_completed' as const,
        agentId: `agent-${(i % 5) + 1}`,
        agentName: agentNames[i % 5],
        customerId: `CUST-${String(Math.floor(i / 6) + 1001).padStart(6, '0')}`,
        dataCategory: dataCategories[i % 5],
        operation: operations[i % 4],
        recordCount: Math.floor(Math.random() * 100) + 1,
        hashStatus: 'verified' as const,
        accountabilityChainId: `chain-${String(i + 1).padStart(3, '0')}`,
    };
});

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/compliance/search
// Search customer data trail by customer ID
// Story 5.1: FR26
// ----------------------------------------------------------------------------
missionControlRoutes.get('/compliance/search', requireRole('operator'), async (c) => {
    const customerId = c.req.query('customerId');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    const dataCategory = c.req.query('dataCategory');
    const operation = c.req.query('operation');
    const cursor = c.req.query('cursor');
    const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 50);

    if (!customerId) {
        return c.json({ error: 'customerId is required' }, 400);
    }

    // Filter by customer ID
    let filtered = mockCustomerDataTrails.filter((t) => t.customerId === customerId);

    // Apply additional filters
    if (startDate) {
        filtered = filtered.filter((t) => t.timestamp >= startDate);
    }
    if (endDate) {
        filtered = filtered.filter((t) => t.timestamp <= endDate);
    }
    if (dataCategory) {
        filtered = filtered.filter((t) => t.dataCategory === dataCategory);
    }
    if (operation) {
        filtered = filtered.filter((t) => t.operation === operation);
    }

    // Apply cursor pagination
    let startIndex = 0;
    if (cursor) {
        startIndex = parseInt(cursor, 10);
    }

    const paginatedEntries = filtered.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < filtered.length;
    const nextCursor = hasMore ? String(startIndex + limit) : undefined;

    return c.json({
        entries: paginatedEntries,
        cursor: nextCursor,
        hasMore,
        total: filtered.length,
        customerId,
        searchedFrom: startDate || 'beginning',
        searchedTo: endDate || 'now',
    });
});

// Mock evidence packages
const mockEvidencePackages: Record<string, {
    id: string;
    orgId: string;
    customerId: string;
    status: 'generating' | 'ready' | 'expired' | 'failed';
    format: 'pdf' | 'json' | 'csv';
    requestedAt: string;
    generatedAt?: string;
    expiresAt?: string;
    downloadUrl?: string;
    requestedBy: string;
    reason: string;
    period: { startDate: string; endDate: string };
    summary: { totalActions: number; agentsInvolved: number; dataCategories: string[]; hitlDecisions: number };
    hashIntegrity: {
        totalEntries: number;
        verifiedCount: number;
        unverifiedCount: number;
        invalidCount: number;
        chainIntact: boolean;
        firstEntryHash: string;
        lastEntryHash: string;
        verificationTimestamp: string;
    };
    error?: string;
}> = {};

// ----------------------------------------------------------------------------
// POST /api/v1/mission-control/compliance/evidence-package
// Request generation of an evidence package
// Story 5.2: FR27
// ----------------------------------------------------------------------------
missionControlRoutes.post('/compliance/evidence-package', requireRole('operator'), async (c) => {
    const body = await c.req.json();
    const { customerId, startDate, endDate, includeRawData, format, reason } = body;

    if (!customerId || !startDate || !endDate || !reason) {
        return c.json({ error: 'customerId, startDate, endDate, and reason are required' }, 400);
    }

    const packageId = `pkg-${Date.now()}`;
    const pkg = {
        id: packageId,
        orgId: 'org-123',
        customerId,
        status: 'generating' as const,
        format: format || 'pdf',
        requestedAt: new Date().toISOString(),
        requestedBy: 'current-user',
        reason,
        period: { startDate, endDate },
        summary: {
            totalActions: 0,
            agentsInvolved: 0,
            dataCategories: [],
            hitlDecisions: 0,
        },
        hashIntegrity: {
            totalEntries: 0,
            verifiedCount: 0,
            unverifiedCount: 0,
            invalidCount: 0,
            chainIntact: true,
            firstEntryHash: '',
            lastEntryHash: '',
            verificationTimestamp: new Date().toISOString(),
        },
    };

    mockEvidencePackages[packageId] = pkg;

    // Simulate async generation (in real app, this would be a background job)
    setTimeout(() => {
        const storedPkg = mockEvidencePackages[packageId];
        if (storedPkg) {
            storedPkg.status = 'ready';
            storedPkg.generatedAt = new Date().toISOString();
            storedPkg.expiresAt = new Date(Date.now() + 7 * 24 * 3600000).toISOString();
            storedPkg.downloadUrl = `/api/v1/mission-control/compliance/evidence-package/${packageId}/download`;
            storedPkg.summary = {
                totalActions: 47,
                agentsInvolved: 5,
                dataCategories: ['personal_info', 'financial_records', 'transaction_history'],
                hitlDecisions: 12,
            };
            storedPkg.hashIntegrity = {
                totalEntries: 47,
                verifiedCount: 45,
                unverifiedCount: 2,
                invalidCount: 0,
                chainIntact: true,
                firstEntryHash: 'a1b2c3d4e5f6',
                lastEntryHash: 'z9y8x7w6v5u4',
                verificationTimestamp: new Date().toISOString(),
            };
        }
    }, 2000);

    return c.json({ package: pkg });
});

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/compliance/evidence-package/:id
// Get evidence package status and details
// Story 5.2: FR27
// ----------------------------------------------------------------------------
missionControlRoutes.get('/compliance/evidence-package/:id', requireRole('operator'), async (c) => {
    const packageId = c.req.param('id');
    const pkg = mockEvidencePackages[packageId];

    if (!pkg) {
        return c.json({ error: 'Evidence package not found' }, 404);
    }

    return c.json({ package: pkg });
});

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/compliance/evidence-packages
// List all evidence packages for the organization
// Story 5.2: FR27
// ----------------------------------------------------------------------------
missionControlRoutes.get('/compliance/evidence-packages', requireRole('operator'), async (c) => {
    const packages = Object.values(mockEvidencePackages);

    return c.json({
        packages,
        total: packages.length,
    });
});

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/compliance/evidence-package/:id/download
// Download evidence package file
// Story 5.2: FR27
// ----------------------------------------------------------------------------
missionControlRoutes.get('/compliance/evidence-package/:id/download', requireRole('operator'), async (c) => {
    const packageId = c.req.param('id');
    const pkg = mockEvidencePackages[packageId];

    if (!pkg) {
        return c.json({ error: 'Evidence package not found' }, 404);
    }

    if (pkg.status !== 'ready') {
        return c.json({ error: 'Evidence package is not ready for download' }, 400);
    }

    // In real implementation, this would return the actual file
    // For mock, return a JSON representation
    return c.json({
        package: pkg,
        content: {
            executiveSummary: `Evidence package for customer ${pkg.customerId} covering ${pkg.period.startDate} to ${pkg.period.endDate}`,
            hashIntegrityReport: pkg.hashIntegrity,
            actions: mockCustomerDataTrails.filter((t) => t.customerId === pkg.customerId).slice(0, 10),
        },
    });
});

// ============================================================================
// EPIC 6: INVESTIGATION MANAGEMENT
// Story 6.1: Initiate Investigation (FR31)
// Story 6.2: Expand Investigation Scope (FR32)
// Story 6.3: Link Related Events (FR33)
// Story 6.4: Rollback Review Capability (FR34)
// Story 6.5: Pattern Anomaly Detection (FR35)
// ============================================================================

// Mock investigations store
const mockInvestigations: Record<string, {
    id: string;
    orgId: string;
    title: string;
    description: string;
    type: 'suspicious_activity' | 'trust_violation' | 'data_anomaly' | 'pattern_alert' | 'manual';
    status: 'open' | 'in_progress' | 'pending_review' | 'closed' | 'merged';
    priority: 'low' | 'medium' | 'high' | 'critical';
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    assignedTo?: string;
    triggerEventId?: string;
    scope: {
        agentIds: string[];
        timeRange: { start: string; end: string };
        actionTypes: string[];
        expanded: boolean;
        expansionHistory: Array<{
            id: string;
            expandedAt: string;
            expandedBy: string;
            reason: string;
            addedAgents: string[];
        }>;
    };
    linkedEvents: Array<{
        id: string;
        eventId: string;
        eventType: string;
        linkedAt: string;
        linkedBy: string;
        relationship: string;
        notes?: string;
    }>;
    findings: Array<{
        id: string;
        timestamp: string;
        author: string;
        severity: string;
        title: string;
        description: string;
        affectedEntities: string[];
    }>;
    rollbacks: Array<{
        id: string;
        investigationId: string;
        decisionId: string;
        originalOutcome: string;
        rolledBackAt: string;
        rolledBackBy: string;
        reason: string;
        status: string;
        affectedRecords: number;
        undoAvailable: boolean;
    }>;
    anomalies: Array<{
        id: string;
        detectedAt: string;
        pattern: string;
        description: string;
        severity: string;
        affectedAgents: string[];
        baseline: { metric: string; expectedValue: number; actualValue: number; deviationPercent: number };
        status: string;
    }>;
}> = {
    'inv-001': {
        id: 'inv-001',
        orgId: 'org-123',
        title: 'Unusual approval pattern detected',
        description: 'Agent DataProcessor showing 98% approval rate, significantly above baseline',
        type: 'pattern_alert',
        status: 'in_progress',
        priority: 'high',
        createdAt: new Date(Date.now() - 2 * 24 * 3600000).toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'user-001',
        assignedTo: 'user-002',
        scope: {
            agentIds: ['agent-001'],
            timeRange: { start: new Date(Date.now() - 7 * 24 * 3600000).toISOString(), end: new Date().toISOString() },
            actionTypes: ['decision_approved', 'decision_denied'],
            expanded: false,
            expansionHistory: [],
        },
        linkedEvents: [],
        findings: [
            {
                id: 'finding-001',
                timestamp: new Date().toISOString(),
                author: 'user-002',
                severity: 'warning',
                title: 'High approval rate confirmed',
                description: 'Agent approved 147 out of 150 requests in the last 7 days',
                affectedEntities: ['agent-001'],
            },
        ],
        rollbacks: [],
        anomalies: [
            {
                id: 'anomaly-001',
                detectedAt: new Date(Date.now() - 2 * 24 * 3600000).toISOString(),
                pattern: 'approval_rate_deviation',
                description: 'Approval rate 25% higher than baseline',
                severity: 'medium',
                affectedAgents: ['agent-001'],
                baseline: { metric: 'approval_rate', expectedValue: 0.73, actualValue: 0.98, deviationPercent: 34 },
                status: 'investigating',
            },
        ],
    },
};

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/investigations
// List investigations with pagination
// Story 6.1: FR31
// ----------------------------------------------------------------------------
missionControlRoutes.get('/investigations', requireRole('operator'), async (c) => {
    const status = c.req.query('status');
    const priority = c.req.query('priority');
    const cursor = c.req.query('cursor');
    const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 50);

    let investigations = Object.values(mockInvestigations);

    if (status) {
        investigations = investigations.filter((inv) => inv.status === status);
    }
    if (priority) {
        investigations = investigations.filter((inv) => inv.priority === priority);
    }

    // Sort by createdAt descending
    investigations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    let startIndex = 0;
    if (cursor) {
        startIndex = parseInt(cursor, 10);
    }

    const paginatedInvestigations = investigations.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < investigations.length;

    return c.json({
        investigations: paginatedInvestigations,
        total: investigations.length,
        cursor: hasMore ? String(startIndex + limit) : undefined,
        hasMore,
    });
});

// ----------------------------------------------------------------------------
// POST /api/v1/mission-control/investigations
// Initiate a new investigation
// Story 6.1: FR31
// ----------------------------------------------------------------------------
missionControlRoutes.post('/investigations', requireRole('operator'), async (c) => {
    const body = await c.req.json();
    const { title, description, type, priority, triggerEventId, initialAgentIds, timeRange } = body;

    if (!title || !description || !type || !priority || !initialAgentIds || !timeRange) {
        return c.json({ error: 'Missing required fields' }, 400);
    }

    const id = `inv-${Date.now()}`;
    const investigation = {
        id,
        orgId: 'org-123',
        title,
        description,
        type,
        status: 'open' as const,
        priority,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'current-user',
        triggerEventId,
        scope: {
            agentIds: initialAgentIds,
            timeRange,
            actionTypes: ['decision_approved', 'decision_denied', 'task_completed'],
            expanded: false,
            expansionHistory: [],
        },
        linkedEvents: [],
        findings: [],
        rollbacks: [],
        anomalies: [],
    };

    mockInvestigations[id] = investigation;

    return c.json({ investigation }, 201);
});

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/investigations/:id
// Get investigation details
// Story 6.1: FR31
// ----------------------------------------------------------------------------
missionControlRoutes.get('/investigations/:id', requireRole('operator'), async (c) => {
    const id = c.req.param('id');
    const investigation = mockInvestigations[id];

    if (!investigation) {
        return c.json({ error: 'Investigation not found' }, 404);
    }

    return c.json({ investigation });
});

// ----------------------------------------------------------------------------
// PUT /api/v1/mission-control/investigations/:id/scope
// Expand investigation scope
// Story 6.2: FR32
// ----------------------------------------------------------------------------
missionControlRoutes.put('/investigations/:id/scope', requireRole('supervisor'), async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { addAgentIds, extendTimeRange, addActionTypes, reason } = body;

    const investigation = mockInvestigations[id];
    if (!investigation) {
        return c.json({ error: 'Investigation not found' }, 404);
    }

    if (!reason) {
        return c.json({ error: 'Reason is required for scope expansion' }, 400);
    }

    const expansion = {
        id: `exp-${Date.now()}`,
        expandedAt: new Date().toISOString(),
        expandedBy: 'current-user',
        reason,
        addedAgents: addAgentIds || [],
    };

    if (addAgentIds) {
        investigation.scope.agentIds = [...new Set([...investigation.scope.agentIds, ...addAgentIds])];
    }
    if (extendTimeRange) {
        if (extendTimeRange.start < investigation.scope.timeRange.start) {
            investigation.scope.timeRange.start = extendTimeRange.start;
        }
        if (extendTimeRange.end > investigation.scope.timeRange.end) {
            investigation.scope.timeRange.end = extendTimeRange.end;
        }
    }
    if (addActionTypes) {
        investigation.scope.actionTypes = [...new Set([...investigation.scope.actionTypes, ...addActionTypes])];
    }

    investigation.scope.expanded = true;
    investigation.scope.expansionHistory.push(expansion);
    investigation.updatedAt = new Date().toISOString();

    return c.json({ investigation, expansion });
});

// ----------------------------------------------------------------------------
// POST /api/v1/mission-control/investigations/:id/events
// Link related events to investigation
// Story 6.3: FR33
// ----------------------------------------------------------------------------
missionControlRoutes.post('/investigations/:id/events', requireRole('operator'), async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { eventId, eventType, relationship, notes } = body;

    const investigation = mockInvestigations[id];
    if (!investigation) {
        return c.json({ error: 'Investigation not found' }, 404);
    }

    if (!eventId || !eventType || !relationship) {
        return c.json({ error: 'eventId, eventType, and relationship are required' }, 400);
    }

    const linkedEvent = {
        id: `link-${Date.now()}`,
        eventId,
        eventType,
        linkedAt: new Date().toISOString(),
        linkedBy: 'current-user',
        relationship,
        notes,
    };

    investigation.linkedEvents.push(linkedEvent);
    investigation.updatedAt = new Date().toISOString();

    return c.json({ linkedEvent });
});

// ----------------------------------------------------------------------------
// POST /api/v1/mission-control/investigations/:id/rollback
// Request rollback of a decision
// Story 6.4: FR34
// ----------------------------------------------------------------------------
missionControlRoutes.post('/investigations/:id/rollback', requireRole('supervisor'), async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { decisionId, reason } = body;

    const investigation = mockInvestigations[id];
    if (!investigation) {
        return c.json({ error: 'Investigation not found' }, 404);
    }

    if (!decisionId || !reason) {
        return c.json({ error: 'decisionId and reason are required' }, 400);
    }

    const rollback = {
        id: `rollback-${Date.now()}`,
        investigationId: id,
        decisionId,
        originalOutcome: 'approved' as const,
        rolledBackAt: new Date().toISOString(),
        rolledBackBy: 'current-user',
        reason,
        status: 'pending' as const,
        affectedRecords: Math.floor(Math.random() * 50) + 1,
        undoAvailable: true,
    };

    investigation.rollbacks.push(rollback);
    investigation.updatedAt = new Date().toISOString();

    // Simulate rollback processing
    setTimeout(() => {
        const storedRollback = investigation.rollbacks.find((r) => r.id === rollback.id);
        if (storedRollback) {
            storedRollback.status = 'completed';
        }
    }, 1000);

    return c.json({ rollback });
});

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/anomalies
// Get pattern anomalies
// Story 6.5: FR35
// ----------------------------------------------------------------------------
missionControlRoutes.get('/anomalies', requireRole('operator'), async (c) => {
    const status = c.req.query('status');
    const severity = c.req.query('severity');

    const allAnomalies = Object.values(mockInvestigations).flatMap((inv) =>
        inv.anomalies.map((a) => ({ ...a, investigationId: inv.id }))
    );

    let filtered = allAnomalies;
    if (status) {
        filtered = filtered.filter((a) => a.status === status);
    }
    if (severity) {
        filtered = filtered.filter((a) => a.severity === severity);
    }

    return c.json({
        anomalies: filtered,
        total: filtered.length,
    });
});

// ----------------------------------------------------------------------------
// PUT /api/v1/mission-control/anomalies/:id/status
// Update anomaly status
// Story 6.5: FR35
// ----------------------------------------------------------------------------
missionControlRoutes.put('/anomalies/:id/status', requireRole('operator'), async (c) => {
    const anomalyId = c.req.param('id');
    const body = await c.req.json();
    const { status } = body;

    if (!status || !['new', 'investigating', 'confirmed', 'dismissed'].includes(status)) {
        return c.json({ error: 'Valid status is required' }, 400);
    }

    // Find and update the anomaly
    for (const inv of Object.values(mockInvestigations)) {
        const anomaly = inv.anomalies.find((a) => a.id === anomalyId);
        if (anomaly) {
            anomaly.status = status;
            return c.json({ anomaly });
        }
    }

    return c.json({ error: 'Anomaly not found' }, 404);
});

// ============================================================================
// EPIC 7: TEAM & EXECUTIVE DASHBOARDS
// Story 7.1: Supervisor View - Team Operators (FR36)
// Story 7.2: Cross-Operator Activity Patterns (FR37)
// Story 7.3: Team Decision Metrics (FR38)
// Story 7.4: Executive View - Fleet Health KPIs (FR39, FR40, FR41)
// Story 7.5: HITL Load & Autonomous Rate Metrics (FR42, FR43)
// Story 7.6: Active Incidents & Cost Avoided (FR44, FR45)
// ============================================================================

// Mock team operators
const mockTeamOperators = [
    { id: 'op-001', name: 'Alice Chen', role: 'Senior Operator', status: 'online', lastActive: new Date().toISOString(), pendingReviews: 5, completedToday: 23, avgResponseTime: 45000, qualityScore: 94 },
    { id: 'op-002', name: 'Bob Martinez', role: 'Operator', status: 'online', lastActive: new Date().toISOString(), pendingReviews: 3, completedToday: 18, avgResponseTime: 62000, qualityScore: 87 },
    { id: 'op-003', name: 'Carol Wilson', role: 'Operator', status: 'away', lastActive: new Date(Date.now() - 900000).toISOString(), pendingReviews: 8, completedToday: 12, avgResponseTime: 38000, qualityScore: 91 },
    { id: 'op-004', name: 'David Kim', role: 'Junior Operator', status: 'offline', lastActive: new Date(Date.now() - 3600000).toISOString(), pendingReviews: 0, completedToday: 15, avgResponseTime: 78000, qualityScore: 82 },
];

// Mock active incidents
const mockActiveIncidents = [
    { id: 'inc-001', title: 'Elevated Trust Score Volatility', severity: 'medium' as const, status: 'investigating' as const, startedAt: new Date(Date.now() - 7200000).toISOString(), assignedTo: 'Alice Chen', affectedAgents: 12, potentialImpact: 15000 },
    { id: 'inc-002', title: 'Unusual Approval Pattern', severity: 'low' as const, status: 'active' as const, startedAt: new Date(Date.now() - 3600000).toISOString(), assignedTo: 'Bob Martinez', affectedAgents: 3, potentialImpact: 5000 },
];

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/team/operators
// Returns team operators for supervisor view
// Story 7.1: FR36
// ----------------------------------------------------------------------------
missionControlRoutes.get('/team/operators', requireRole('supervisor'), async (c) => {
    const onlineCount = mockTeamOperators.filter((o) => o.status === 'online').length;
    const pendingTotal = mockTeamOperators.reduce((sum, o) => sum + o.pendingReviews, 0);
    const avgTeamQuality = mockTeamOperators.reduce((sum, o) => sum + o.qualityScore, 0) / mockTeamOperators.length;

    return c.json({
        supervisorId: 'sup-001',
        supervisorName: 'Sarah Thompson',
        teamSize: mockTeamOperators.length,
        operators: mockTeamOperators,
        onlineCount,
        pendingTotal,
        avgTeamQuality: Math.round(avgTeamQuality * 10) / 10,
    });
});

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/team/patterns
// Returns cross-operator activity patterns
// Story 7.2: FR37
// ----------------------------------------------------------------------------
missionControlRoutes.get('/team/patterns', requireRole('supervisor'), async (c) => {
    const hours = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
    const patterns = mockTeamOperators.flatMap((op) =>
        hours.map((hour) => ({
            operatorId: op.id,
            operatorName: op.name,
            timeBlock: `${hour}-${String(parseInt(hour) + 1).padStart(2, '0')}:00`,
            reviewCount: Math.floor(Math.random() * 10) + 2,
            approvalRate: 70 + Math.random() * 25,
            avgReviewTime: 30000 + Math.random() * 60000,
            deviationFromTeamAvg: (Math.random() - 0.5) * 40,
        }))
    );

    return c.json({
        period: {
            start: new Date(Date.now() - 86400000).toISOString(),
            end: new Date().toISOString(),
        },
        patterns,
        teamAverages: {
            avgApprovalRate: 82.5,
            avgReviewTime: 52000,
            avgReviewsPerHour: 5.2,
        },
        outliers: [
            { operatorId: 'op-002', operatorName: 'Bob Martinez', metric: 'avgReviewTime', deviation: 18.5, severity: 'low' as const },
            { operatorId: 'op-004', operatorName: 'David Kim', metric: 'approvalRate', deviation: -12.3, severity: 'medium' as const },
        ],
    });
});

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/team/metrics
// Returns team decision metrics
// Story 7.3: FR38
// ----------------------------------------------------------------------------
missionControlRoutes.get('/team/metrics', requireRole('supervisor'), async (c) => {
    const period = c.req.query('period') || '7d';
    const days = period === '30d' ? 30 : period === '24h' ? 1 : 7;

    const trend = Array.from({ length: days }, (_, i) => ({
        date: new Date(Date.now() - (days - 1 - i) * 86400000).toISOString().split('T')[0],
        decisions: 80 + Math.floor(Math.random() * 40),
        approvalRate: 75 + Math.random() * 15,
    }));

    return c.json({
        period: {
            start: new Date(Date.now() - days * 86400000).toISOString(),
            end: new Date().toISOString(),
        },
        totalDecisions: trend.reduce((sum, d) => sum + d.decisions, 0),
        approvalRate: 81.5,
        denialRate: 18.5,
        avgReviewTime: 54000,
        byOperator: mockTeamOperators.map((op) => ({
            operatorId: op.id,
            operatorName: op.name,
            decisions: 50 + Math.floor(Math.random() * 100),
            approvalRate: 75 + Math.random() * 20,
            avgReviewTime: op.avgResponseTime,
        })),
        byDecisionType: [
            { type: 'data_access', count: 245, approvalRate: 88.2 },
            { type: 'action_execution', count: 180, approvalRate: 76.5 },
            { type: 'resource_allocation', count: 95, approvalRate: 82.1 },
            { type: 'external_api', count: 67, approvalRate: 71.8 },
        ],
        trend,
    });
});

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/executive/kpis
// Returns fleet health KPIs for executive view
// Story 7.4: FR39, FR40, FR41
// ----------------------------------------------------------------------------
missionControlRoutes.get('/executive/kpis', requireRole('director'), async (c) => {
    return c.json({
        timestamp: new Date().toISOString(),
        totalAgents: 156,
        activeAgents: 142,
        avgTrustScore: 724,
        trustDistribution: {
            'Elite': 8,
            'Certified': 23,
            'Verified': 45,
            'Trusted': 52,
            'Probationary': 18,
            'Untrusted': 10,
        },
        healthIndicators: {
            overall: 'healthy',
            trustTrend: 'improving',
            riskLevel: 'low',
        },
        kpis: [
            { name: 'Agent Uptime', value: 99.7, unit: '%', target: 99.5, status: 'above_target', trend: 0.2 },
            { name: 'Avg Trust Score', value: 724, unit: 'pts', target: 700, status: 'above_target', trend: 2.5 },
            { name: 'Task Success Rate', value: 96.8, unit: '%', target: 95.0, status: 'above_target', trend: 0.8 },
            { name: 'HITL Resolution Time', value: 4.2, unit: 'min', target: 5.0, status: 'above_target', trend: -8.5 },
            { name: 'Autonomous Rate', value: 73.5, unit: '%', target: 70.0, status: 'above_target', trend: 3.2 },
            { name: 'Risk Events', value: 3, unit: 'count', target: 5, status: 'above_target', trend: -40 },
        ],
    });
});

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/executive/hitl-load
// Returns HITL load and autonomous rate metrics
// Story 7.5: FR42, FR43
// ----------------------------------------------------------------------------
missionControlRoutes.get('/executive/hitl-load', requireRole('supervisor'), async (c) => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
        hour: `${String(i).padStart(2, '0')}:00`,
        count: i >= 9 && i <= 17 ? 15 + Math.floor(Math.random() * 20) : 2 + Math.floor(Math.random() * 8),
        avgWaitTime: 120000 + Math.random() * 180000,
    }));

    return c.json({
        period: {
            start: new Date(Date.now() - 86400000).toISOString(),
            end: new Date().toISOString(),
        },
        totalDecisions: 847,
        hitlRequired: 224,
        autonomousDecisions: 623,
        autonomousRate: 73.5,
        hitlLoadByHour: hours,
        capacityUtilization: 68.5,
        queueHealth: 'healthy',
    });
});

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/executive/incidents
// Returns active incidents and cost avoided metrics
// Story 7.6: FR44, FR45
// ----------------------------------------------------------------------------
missionControlRoutes.get('/executive/incidents', requireRole('supervisor'), async (c) => {
    return c.json({
        activeCount: mockActiveIncidents.filter((i) => i.status === 'active').length,
        resolvingCount: mockActiveIncidents.filter((i) => ['investigating', 'mitigating'].includes(i.status)).length,
        resolvedLast24h: 5,
        incidents: mockActiveIncidents,
        costAvoided: {
            period: {
                start: new Date(Date.now() - 30 * 86400000).toISOString(),
                end: new Date().toISOString(),
            },
            totalCostAvoided: 284500,
            byCategory: [
                { category: 'Trust Violations Prevented', amount: 125000, incidents: 8 },
                { category: 'Data Breach Attempts Blocked', amount: 89000, incidents: 3 },
                { category: 'Unauthorized Actions Stopped', amount: 45500, incidents: 12 },
                { category: 'Resource Misuse Detected', amount: 25000, incidents: 6 },
            ],
            byMonth: [
                { month: '2025-10', amount: 78000 },
                { month: '2025-11', amount: 92500 },
                { month: '2025-12', amount: 114000 },
            ],
            topPreventedIncidents: [
                { type: 'Credential Exposure', estimatedCost: 75000, preventedCount: 2 },
                { type: 'Unauthorized Data Export', estimatedCost: 50000, preventedCount: 4 },
                { type: 'Trust Score Manipulation', estimatedCost: 35000, preventedCount: 3 },
            ],
        },
    });
});

// ============================================================================
// EPIC 8: ONBOARDING & EDUCATION
// Story 8.1: Guided Tooltip Tour (FR46)
// Story 8.2: First Denial Learning Popup (FR47)
// Story 8.3: First Approval Request Learning (FR48)
// Story 8.4: Tier Change Learning (FR49)
// Story 8.5: On-Demand Trust Explanations (FR50)
// Story 8.6: Urgency Rule Configuration (FR54)
// ============================================================================

// Mock tours
const mockTours = {
    'mission-control-intro': {
        id: 'mission-control-intro',
        name: 'Mission Control Introduction',
        steps: [
            { id: 'step-1', target: '.agent-overview', title: 'Agent Overview', content: 'Monitor all your AI agents and their current trust levels.', placement: 'right', order: 1 },
            { id: 'step-2', target: '.task-pipeline', title: 'Task Pipeline', content: 'Review pending decisions that require human approval.', placement: 'bottom', order: 2 },
            { id: 'step-3', target: '.trust-badge', title: 'Trust Scores', content: 'Each agent has a trust score that determines their autonomy.', placement: 'left', order: 3 },
            { id: 'step-4', target: '.decision-queue', title: 'Decision Queue', content: 'Approve or deny agent requests here.', placement: 'top', order: 4 },
        ],
        autoStart: true,
        completionReward: 'mission_control_certified',
    },
};

// Mock learning popups
const mockLearningPopups: Record<string, {
    id: string;
    eventType: string;
    title: string;
    content: string;
    tips: string[];
    learnMoreUrl?: string;
    dismissable: boolean;
    showOnce: boolean;
}> = {
    'first_denial': {
        id: 'popup-denial',
        eventType: 'first_denial',
        title: 'Understanding Denials',
        content: 'When you deny a request, the agent\'s trust score may be affected. This helps the system learn which actions require more oversight.',
        tips: [
            'Provide a clear reason for denial to help the agent learn',
            'Consider if the request could be modified instead of denied',
            'Denials are logged for audit and training purposes',
        ],
        dismissable: true,
        showOnce: true,
    },
    'first_approval': {
        id: 'popup-approval',
        eventType: 'first_approval',
        title: 'Approval Best Practices',
        content: 'Great job on your first approval! Remember to review the full context before approving requests.',
        tips: [
            'Check the agent\'s trust tier before approving high-impact actions',
            'Use sample data preview to verify the request scope',
            'Your approval patterns help train the system',
        ],
        dismissable: true,
        showOnce: true,
    },
    'tier_change_up': {
        id: 'popup-tier-up',
        eventType: 'tier_change_up',
        title: 'Agent Promoted!',
        content: 'This agent has earned enough trust to move up a tier. They now have more autonomy.',
        tips: [
            'Higher tiers mean fewer required approvals',
            'Monitor newly promoted agents closely initially',
            'Tier changes are based on consistent positive performance',
        ],
        dismissable: true,
        showOnce: false,
    },
    'tier_change_down': {
        id: 'popup-tier-down',
        eventType: 'tier_change_down',
        title: 'Agent Trust Decreased',
        content: 'This agent has been demoted due to recent performance issues. More oversight is now required.',
        tips: [
            'Review recent denials and failures for this agent',
            'Consider initiating an investigation if the pattern continues',
            'Agents can recover trust through consistent good performance',
        ],
        dismissable: true,
        showOnce: false,
    },
};

// Mock trust explanations
const mockTrustExplanations = [
    {
        topic: 'trust-tiers',
        title: 'Understanding Trust Tiers',
        summary: 'Trust tiers determine how much autonomy an agent has.',
        details: 'Agents progress through 6 tiers: Untrusted, Probationary, Trusted, Verified, Certified, and Elite. Each tier grants additional capabilities and requires less human oversight.',
        relatedTopics: ['trust-score', 'tier-promotion'],
        examples: [
            { scenario: 'Newly created agent', explanation: 'Starts at Untrusted tier, all actions require approval' },
            { scenario: 'Agent reaches Verified', explanation: 'Can delegate tasks but still needs approval for external actions' },
        ],
    },
    {
        topic: 'trust-score',
        title: 'Trust Score Mechanics',
        summary: 'Trust scores are numerical values that determine tier placement.',
        details: 'Scores range from 0-1000. Successful task completions increase score, failures decrease it. Score thresholds determine tier boundaries.',
        relatedTopics: ['trust-tiers', 'score-factors'],
    },
    {
        topic: 'hitl-decisions',
        title: 'Human-in-the-Loop Decisions',
        summary: 'Some actions require human approval before execution.',
        details: 'HITL ensures human oversight for high-risk or sensitive operations. The requirement is based on trust tier, action type, and organizational policies.',
        relatedTopics: ['approval-workflow', 'urgency-levels'],
    },
];

// Mock urgency rules
const mockUrgencyRules = [
    { id: 'rule-1', name: 'High Impact Actions', description: 'Actions affecting more than 100 records', condition: { field: 'affected_records', operator: 'greater_than', value: 100 }, urgencyLevel: 'high', enabled: true, priority: 1 },
    { id: 'rule-2', name: 'External API Calls', description: 'Any external API interactions', condition: { field: 'action_type', operator: 'equals', value: 'external_api' }, urgencyLevel: 'immediate', enabled: true, priority: 2 },
    { id: 'rule-3', name: 'Low Trust Agents', description: 'Actions from Untrusted tier agents', condition: { field: 'agent_tier', operator: 'less_than', value: 2 }, urgencyLevel: 'high', enabled: true, priority: 3 },
];

// User learning progress (mock per-user store)
const mockUserProgress: Record<string, { seenPopups: string[]; completedTours: string[]; preferHints: boolean }> = {};

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/onboarding/tour/:tourId
// Returns tour configuration
// Story 8.1: FR46
// ----------------------------------------------------------------------------
missionControlRoutes.get('/onboarding/tour/:tourId', requireRole('operator'), async (c) => {
    const tourId = c.req.param('tourId');
    const tour = mockTours[tourId as keyof typeof mockTours];

    if (!tour) {
        return c.json({ error: 'Tour not found' }, 404);
    }

    return c.json({ tour });
});

// ----------------------------------------------------------------------------
// POST /api/v1/mission-control/onboarding/tour/:tourId/progress
// Update tour progress
// Story 8.1: FR46
// ----------------------------------------------------------------------------
missionControlRoutes.post('/onboarding/tour/:tourId/progress', requireRole('operator'), async (c) => {
    const tourId = c.req.param('tourId');
    const body = await c.req.json();
    const { currentStep, completed, skipped, stepsViewed } = body;

    const userId = 'current-user';
    if (!mockUserProgress[userId]) {
        mockUserProgress[userId] = { seenPopups: [], completedTours: [], preferHints: true };
    }

    if (completed) {
        mockUserProgress[userId].completedTours.push(tourId);
    }

    return c.json({
        tourState: {
            tourId,
            currentStep: currentStep || 0,
            completed: completed || false,
            skipped: skipped || false,
            stepsViewed: stepsViewed || [],
        },
    });
});

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/onboarding/popup/:eventType
// Returns learning popup for event type
// Story 8.2-8.4: FR47, FR48, FR49
// ----------------------------------------------------------------------------
missionControlRoutes.get('/onboarding/popup/:eventType', requireRole('operator'), async (c) => {
    const eventType = c.req.param('eventType');
    const popup = mockLearningPopups[eventType];

    if (!popup) {
        return c.json({ error: 'Popup not found' }, 404);
    }

    const userId = 'current-user';
    const userProgress = mockUserProgress[userId];
    const alreadySeen = userProgress?.seenPopups.includes(popup.id);

    if (popup.showOnce && alreadySeen) {
        return c.json({ popup: null, alreadySeen: true });
    }

    return c.json({ popup, alreadySeen: false });
});

// ----------------------------------------------------------------------------
// POST /api/v1/mission-control/onboarding/popup/:popupId/dismiss
// Mark popup as seen
// Story 8.2-8.4: FR47, FR48, FR49
// ----------------------------------------------------------------------------
missionControlRoutes.post('/onboarding/popup/:popupId/dismiss', requireRole('operator'), async (c) => {
    const popupId = c.req.param('popupId');
    const userId = 'current-user';

    if (!mockUserProgress[userId]) {
        mockUserProgress[userId] = { seenPopups: [], completedTours: [], preferHints: true };
    }

    if (!mockUserProgress[userId].seenPopups.includes(popupId)) {
        mockUserProgress[userId].seenPopups.push(popupId);
    }

    return c.json({ success: true });
});

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/help/explanations
// Returns trust explanations for help panel
// Story 8.5: FR50
// ----------------------------------------------------------------------------
missionControlRoutes.get('/help/explanations', requireRole('operator'), async (c) => {
    const topic = c.req.query('topic');

    if (topic) {
        const explanation = mockTrustExplanations.find((e) => e.topic === topic);
        return c.json({ explanation: explanation || null });
    }

    return c.json({ explanations: mockTrustExplanations });
});

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/help/context/:contextId
// Returns context-specific help content
// Story 8.5: FR50
// ----------------------------------------------------------------------------
missionControlRoutes.get('/help/context/:contextId', requireRole('operator'), async (c) => {
    const contextId = c.req.param('contextId');

    // Map context to relevant explanations
    const contextMap: Record<string, string[]> = {
        'decision-queue': ['hitl-decisions', 'trust-tiers'],
        'agent-overview': ['trust-score', 'trust-tiers'],
        'tribunal-record': ['trust-tiers', 'hitl-decisions'],
    };

    const topics = contextMap[contextId] || ['trust-tiers'];
    const explanations = mockTrustExplanations.filter((e) => topics.includes(e.topic));

    return c.json({
        contextId,
        explanations,
        faqs: [
            { question: 'What happens when I deny a request?', answer: 'The agent\'s trust score may decrease and the action is logged for review.' },
            { question: 'How do agents gain trust?', answer: 'Agents gain trust through successful task completion and positive review outcomes.' },
        ],
    });
});

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/settings/urgency
// Returns urgency rule configuration
// Story 8.6: FR54
// ----------------------------------------------------------------------------
missionControlRoutes.get('/settings/urgency', requireRole('supervisor'), async (c) => {
    return c.json({
        orgId: 'demo-org',
        defaultUrgency: 'medium',
        rules: mockUrgencyRules,
        escalationTimeouts: {
            low: 3600000,      // 1 hour
            medium: 1800000,   // 30 min
            high: 900000,      // 15 min
        },
    });
});

// ----------------------------------------------------------------------------
// PUT /api/v1/mission-control/settings/urgency
// Update urgency rule configuration
// Story 8.6: FR54
// ----------------------------------------------------------------------------
missionControlRoutes.put('/settings/urgency', requireRole('supervisor'), async (c) => {
    const body = await c.req.json();
    const { defaultUrgency, rules, escalationTimeouts } = body;

    // In real implementation, this would persist to database
    return c.json({
        success: true,
        config: {
            orgId: 'demo-org',
            defaultUrgency: defaultUrgency || 'medium',
            rules: rules || mockUrgencyRules,
            escalationTimeouts: escalationTimeouts || { low: 3600000, medium: 1800000, high: 900000 },
        },
    });
});

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/onboarding/progress
// Returns user's learning progress
// Story 8.1-8.4: Combined progress endpoint
// ----------------------------------------------------------------------------
missionControlRoutes.get('/onboarding/progress', requireRole('operator'), async (c) => {
    const userId = 'current-user';
    const progress = mockUserProgress[userId] || { seenPopups: [], completedTours: [], preferHints: true };

    return c.json({
        userId,
        ...progress,
        lastLearningEvent: new Date().toISOString(),
    });
});

// ----------------------------------------------------------------------------
// GET /api/v1/mission-control/executive/dashboard
// Returns complete executive dashboard data
// Story 7.4-7.6: Combined endpoint for efficiency
// ----------------------------------------------------------------------------
missionControlRoutes.get('/executive/dashboard', requireRole('director'), async (c) => {
    // Combine all executive data into a single response
    const kpisResponse = {
        timestamp: new Date().toISOString(),
        totalAgents: 156,
        activeAgents: 142,
        avgTrustScore: 724,
        trustDistribution: { 'Elite': 8, 'Certified': 23, 'Verified': 45, 'Trusted': 52, 'Probationary': 18, 'Untrusted': 10 },
        healthIndicators: { overall: 'healthy' as const, trustTrend: 'improving' as const, riskLevel: 'low' as const },
        kpis: [
            { name: 'Agent Uptime', value: 99.7, unit: '%', target: 99.5, status: 'above_target' as const, trend: 0.2 },
            { name: 'Avg Trust Score', value: 724, unit: 'pts', target: 700, status: 'above_target' as const, trend: 2.5 },
            { name: 'Autonomous Rate', value: 73.5, unit: '%', target: 70.0, status: 'above_target' as const, trend: 3.2 },
        ],
    };

    const hitlLoadResponse = {
        period: { start: new Date(Date.now() - 86400000).toISOString(), end: new Date().toISOString() },
        totalDecisions: 847,
        hitlRequired: 224,
        autonomousDecisions: 623,
        autonomousRate: 73.5,
        hitlLoadByHour: [],
        capacityUtilization: 68.5,
        queueHealth: 'healthy' as const,
    };

    const incidentsResponse = {
        activeCount: 1,
        resolvingCount: 1,
        resolvedLast24h: 5,
        incidents: mockActiveIncidents,
        costAvoided: {
            period: { start: new Date(Date.now() - 30 * 86400000).toISOString(), end: new Date().toISOString() },
            totalCostAvoided: 284500,
            byCategory: [],
            byMonth: [],
            topPreventedIncidents: [],
        },
    };

    return c.json({
        fleetHealth: kpisResponse,
        hitlLoad: hitlLoadResponse,
        incidents: incidentsResponse,
        lastUpdated: new Date().toISOString(),
    });
});

export { missionControlRoutes };
export default missionControlRoutes;
