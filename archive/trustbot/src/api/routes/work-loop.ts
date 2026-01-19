/**
 * Work Loop API Routes
 *
 * Exposes the AgentWorkLoop functionality via HTTP endpoints.
 * Enables submitting objectives, monitoring execution, and viewing stats.
 */

import { Hono } from 'hono';
import { agentWorkLoop, AgentRole } from '../../core/AgentWorkLoop.js';
import { workLoopPersistence } from '../../core/WorkLoopPersistence.js';
import { trustIntegration } from '../../core/TrustIntegration.js';

const app = new Hono();

// ============================================================================
// Initialize T5 Agents in Work Loop
// ============================================================================

let initialized = false;

function ensureInitialized() {
    if (initialized) return;

    // Register the T5 executive agents
    const t5Agents: Array<{ id: string; name: string; role: AgentRole; tier: number }> = [
        { id: 'exec-1', name: 'T5-EXECUTOR', role: 'EXECUTOR', tier: 5 },
        { id: 'plan-1', name: 'T5-PLANNER', role: 'PLANNER', tier: 5 },
        { id: 'valid-1', name: 'T5-VALIDATOR', role: 'VALIDATOR', tier: 5 },
        { id: 'evolve-1', name: 'T5-EVOLVER', role: 'EVOLVER', tier: 5 },
        { id: 'spawn-1', name: 'T5-SPAWNER', role: 'SPAWNER', tier: 5 },
    ];

    for (const agent of t5Agents) {
        agentWorkLoop.registerAgent(agent);
    }

    // Start the work loop
    agentWorkLoop.start();

    // Set up event logging
    agentWorkLoop.on('task:claimed', (agent, task) => {
        console.log(`[WorkLoop] ${agent.name} claimed: ${task.title}`);
    });

    agentWorkLoop.on('task:completed', (agent, task, result) => {
        console.log(`[WorkLoop] ${agent.name} completed: ${task.title} (${result.confidence}% confidence)`);
    });

    agentWorkLoop.on('task:failed', (agent, task, error) => {
        console.log(`[WorkLoop] ${agent.name} failed: ${task.title} - ${error}`);
    });

    agentWorkLoop.on('objective:decomposed', (task, subtasks) => {
        console.log(`[WorkLoop] Objective decomposed into ${subtasks.length} subtasks`);
    });

    agentWorkLoop.on('escalation', (agent, task, reason) => {
        console.log(`[WorkLoop] ESCALATION: ${task.title} - ${reason}`);
    });

    // Validation loop events
    agentWorkLoop.on('validation:queued', (originalTask, validationTask) => {
        console.log(`[ValidationLoop] Queued validation for: ${originalTask.title}`);
    });

    agentWorkLoop.on('validation:passed', (originalTask, score) => {
        console.log(`[ValidationLoop] ✓ PASSED: ${originalTask.title} (score: ${score}%)`);
    });

    agentWorkLoop.on('validation:failed', (originalTask, score, feedback) => {
        console.log(`[ValidationLoop] ✗ FAILED: ${originalTask.title} (score: ${score}%) - ${feedback.substring(0, 100)}...`);
    });

    agentWorkLoop.on('validation:requeued', (originalTask, attempt) => {
        console.log(`[ValidationLoop] Re-queued for improvement: ${originalTask.title} (attempt ${attempt})`);
    });

    initialized = true;
    console.log('[WorkLoop] Initialized with 5 T5 agents (Validation Loop enabled)');
}

// ============================================================================
// Routes
// ============================================================================

// GET /work-loop/status - Get work loop status and stats
app.get('/status', (c) => {
    ensureInitialized();
    const stats = agentWorkLoop.getStats();
    const agents = agentWorkLoop.getAllAgents();

    return c.json({
        running: true,
        agents: agents.map(a => ({
            id: a.id,
            name: a.name,
            role: a.role,
            tier: a.tier,
            status: a.status,
            currentTaskId: a.currentTaskId,
            executionCount: a.executionCount,
            successCount: a.successCount,
            successRate: a.executionCount > 0
                ? Math.round((a.successCount / a.executionCount) * 100)
                : 100,
        })),
        stats,
    });
});

// POST /work-loop/objective - Submit a new objective for autonomous execution
app.post('/objective', async (c) => {
    ensureInitialized();

    const body = await c.req.json() as {
        title: string;
        description: string;
        priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    };

    if (!body.title || !body.description) {
        return c.json({ error: 'title and description required' }, 400);
    }

    const task = agentWorkLoop.submitObjective(
        body.title,
        body.description,
        body.priority || 'MEDIUM'
    );

    return c.json({
        success: true,
        message: `Objective submitted. T5-PLANNER will decompose it into subtasks.`,
        objective: {
            id: task.id,
            title: task.title,
            description: task.description,
            priority: task.priority,
            status: task.status,
            createdAt: new Date(task.createdAt).toISOString(),
        },
    });
});

// POST /work-loop/task - Submit a direct task (bypasses planning)
app.post('/task', async (c) => {
    ensureInitialized();

    const body = await c.req.json() as {
        title: string;
        description: string;
        type?: 'OBJECTIVE' | 'SUBTASK' | 'VALIDATION' | 'PLANNING';
        priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        requiredTier?: number;
        requiredRole?: AgentRole;
    };

    if (!body.title || !body.description) {
        return c.json({ error: 'title and description required' }, 400);
    }

    const task = agentWorkLoop.submitTask({
        title: body.title,
        description: body.description,
        type: body.type || 'SUBTASK',
        priority: body.priority || 'MEDIUM',
        requiredTier: body.requiredTier || 2,
        requiredRole: body.requiredRole,
        timeoutMs: 30000,
        maxRetries: 3,
    });

    return c.json({
        success: true,
        task: {
            id: task.id,
            title: task.title,
            type: task.type,
            priority: task.priority,
            status: task.status,
            requiredTier: task.requiredTier,
            requiredRole: task.requiredRole,
        },
    });
});

// GET /work-loop/tasks - Get all tasks
app.get('/tasks', (c) => {
    ensureInitialized();

    const queued = agentWorkLoop.getQueuedTasks();
    const active = agentWorkLoop.getActiveTasks();
    const completed = agentWorkLoop.getCompletedTasks();

    return c.json({
        queued: queued.map(t => ({
            id: t.id,
            title: t.title,
            type: t.type,
            priority: t.priority,
            status: t.status,
            requiredRole: t.requiredRole,
            createdAt: new Date(t.createdAt).toISOString(),
        })),
        active: active.map(t => ({
            id: t.id,
            title: t.title,
            type: t.type,
            priority: t.priority,
            status: t.status,
            assignedTo: t.assignedTo,
            startedAt: t.startedAt ? new Date(t.startedAt).toISOString() : null,
        })),
        completed: completed.slice(-20).map(t => ({
            id: t.id,
            title: t.title,
            type: t.type,
            status: t.status,
            result: t.result ? {
                success: t.result.success,
                confidence: t.result.confidence,
                duration: t.result.duration,
                subtaskCount: t.result.subtasks?.length,
            } : null,
            completedAt: t.completedAt ? new Date(t.completedAt).toISOString() : null,
        })),
        summary: {
            queued: queued.length,
            active: active.length,
            completed: completed.length,
        },
    });
});

// GET /work-loop/task/:id - Get specific task details
app.get('/task/:id', (c) => {
    ensureInitialized();

    const taskId = c.req.param('id');
    const task = agentWorkLoop.getTaskById(taskId);

    if (!task) {
        return c.json({ error: 'Task not found' }, 404);
    }

    return c.json({
        id: task.id,
        title: task.title,
        description: task.description,
        type: task.type,
        priority: task.priority,
        status: task.status,
        requiredTier: task.requiredTier,
        requiredRole: task.requiredRole,
        parentTaskId: task.parentTaskId,
        dependencies: task.dependencies,
        assignedTo: task.assignedTo,
        retryCount: task.retryCount,
        maxRetries: task.maxRetries,
        result: task.result,
        createdAt: new Date(task.createdAt).toISOString(),
        startedAt: task.startedAt ? new Date(task.startedAt).toISOString() : null,
        completedAt: task.completedAt ? new Date(task.completedAt).toISOString() : null,
    });
});

// POST /work-loop/worker - Spawn a new worker agent
app.post('/worker', async (c) => {
    ensureInitialized();

    const body = await c.req.json() as {
        name: string;
        specialization?: string;
    };

    if (!body.name) {
        return c.json({ error: 'name required' }, 400);
    }

    const workerId = `worker_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const worker = agentWorkLoop.registerAgent({
        id: workerId,
        name: body.name,
        role: 'WORKER',
        tier: 2, // Workers start at T2
    });

    return c.json({
        success: true,
        worker: {
            id: worker.id,
            name: worker.name,
            role: worker.role,
            tier: worker.tier,
            status: worker.status,
        },
    });
});

// DELETE /work-loop/agent/:id - Remove an agent from the work loop
app.delete('/agent/:id', (c) => {
    ensureInitialized();

    const agentId = c.req.param('id');
    const agent = agentWorkLoop.getAgent(agentId);

    if (!agent) {
        return c.json({ error: 'Agent not found' }, 404);
    }

    // Don't allow removing T5 agents
    if (agent.tier === 5) {
        return c.json({ error: 'Cannot remove T5 executive agents' }, 400);
    }

    agentWorkLoop.unregisterAgent(agentId);

    return c.json({
        success: true,
        message: `Agent ${agent.name} removed from work loop`,
    });
});

// POST /work-loop/start - Start the work loop (if stopped)
app.post('/start', (c) => {
    ensureInitialized();
    agentWorkLoop.start();
    return c.json({ success: true, message: 'Work loop started' });
});

// POST /work-loop/stop - Stop the work loop
app.post('/stop', (c) => {
    agentWorkLoop.stop();
    return c.json({ success: true, message: 'Work loop stopped' });
});

// DELETE /work-loop/queue - Clear all queued tasks
app.delete('/queue', (c) => {
    ensureInitialized();
    const count = agentWorkLoop.clearQueue();
    return c.json({
        success: true,
        message: `Cleared ${count} queued tasks`,
        clearedCount: count,
    });
});

// DELETE /work-loop/completed - Clear completed tasks history
app.delete('/completed', (c) => {
    ensureInitialized();
    const count = agentWorkLoop.clearCompleted();
    return c.json({
        success: true,
        message: `Cleared ${count} completed tasks`,
        clearedCount: count,
    });
});

// ============================================================================
// Persistence Endpoints
// ============================================================================

// GET /work-loop/persistence - Get persistence status
app.get('/persistence', (c) => {
    return c.json({
        enabled: true,
        filepath: workLoopPersistence.getFilepath(),
        hasState: workLoopPersistence.exists(),
    });
});

// POST /work-loop/save - Manually save state
app.post('/save', (c) => {
    ensureInitialized();
    const success = agentWorkLoop.saveState();
    return c.json({
        success,
        message: success ? 'State saved successfully' : 'Failed to save state',
        filepath: workLoopPersistence.getFilepath(),
    });
});

// POST /work-loop/restore - Manually restore state
app.post('/restore', (c) => {
    const success = agentWorkLoop.restoreState();
    return c.json({
        success,
        message: success ? 'State restored successfully' : 'No saved state found',
    });
});

// ============================================================================
// Validation Loop Endpoints
// ============================================================================

// GET /work-loop/validation - Get validation loop config
app.get('/validation', (c) => {
    ensureInitialized();
    return c.json({
        ...agentWorkLoop.getValidationConfig(),
        description: {
            enabled: 'Whether validation loop is active',
            threshold: 'Score below which tasks are re-executed (0-100)',
            maxAttempts: 'Maximum validation attempts before accepting',
            highPriorityOnly: 'Only validate HIGH/CRITICAL priority tasks',
        },
    });
});

// POST /work-loop/validation - Update validation loop config
app.post('/validation', async (c) => {
    ensureInitialized();

    const body = await c.req.json() as {
        enabled?: boolean;
        threshold?: number;
        maxAttempts?: number;
        highPriorityOnly?: boolean;
    };

    agentWorkLoop.setValidationConfig(body);

    return c.json({
        success: true,
        message: 'Validation loop config updated',
        config: agentWorkLoop.getValidationConfig(),
    });
});

// ============================================================================
// Trust Integration Endpoints (ATSF-Core)
// ============================================================================

// GET /work-loop/trust - Get trust summary for all agents
app.get('/trust', async (c) => {
    ensureInitialized();

    try {
        const summary = await trustIntegration.getTrustSummary();
        const agents = agentWorkLoop.getAllAgents();

        // Merge trust data with agent info
        const agentTrust = agents.map(agent => {
            const trust = summary.find(t => t.agentId === agent.id);
            return {
                agentId: agent.id,
                name: agent.name,
                role: agent.role,
                currentTier: agent.tier,
                trustScore: trust?.score ?? null,
                trustTier: trust?.tier ?? null,
                trustTierName: trust?.tierName ?? 'Unknown',
                acceleratedDecay: trust?.acceleratedDecay ?? false,
                failureCount: trust?.failureCount ?? 0,
                complexityBonus: trust?.complexityBonus ?? 0,
                decayReduction: trust ? `${Math.round(trust.complexityBonus * 100)}%` : '0%',
                status: agent.status,
                executionCount: agent.executionCount,
                successCount: agent.successCount,
                successRate: agent.executionCount > 0
                    ? Math.round((agent.successCount / agent.executionCount) * 100)
                    : 100,
            };
        });

        return c.json({
            enabled: trustIntegration.isEnabled(),
            agents: agentTrust,
            summary: {
                totalAgents: agents.length,
                trackedAgents: summary.length,
                agentsWithAcceleratedDecay: summary.filter(t => t.acceleratedDecay).length,
            },
        });
    } catch (error) {
        return c.json({
            error: 'Failed to get trust summary',
            message: error instanceof Error ? error.message : 'Unknown error',
        }, 500);
    }
});

// GET /work-loop/trust/:agentId - Get trust details for specific agent
app.get('/trust/:agentId', async (c) => {
    ensureInitialized();

    const agentId = c.req.param('agentId');
    const agent = agentWorkLoop.getAgent(agentId);

    if (!agent) {
        return c.json({ error: 'Agent not found' }, 404);
    }

    try {
        const trust = await trustIntegration.getAgentTrust(agentId);
        const effectiveTier = await trustIntegration.getEffectiveTier(agentId);

        // Get complexity stats for smarter decay info
        const complexityStats = trustIntegration.getComplexityStats(agentId);
        const recoveryState = trustIntegration.getAgentRecoveryState(agentId);

        return c.json({
            agent: {
                id: agent.id,
                name: agent.name,
                role: agent.role,
                assignedTier: agent.tier,
            },
            trust: trust ? {
                score: trust.score,
                level: trust.level,
                levelName: trustIntegration.getTrustLevelName(trust.level),
                threshold: trustIntegration.getTrustThreshold(trust.level),
                effectiveTier,
                acceleratedDecay: trustIntegration.isAcceleratedDecayActive(agentId),
                failureCount: trustIntegration.getFailureCount(agentId),
                complexity: complexityStats ? {
                    recentTaskCount: complexityStats.recentTaskCount,
                    avgComplexity: Math.round(complexityStats.avgComplexity * 10) / 10,
                    successRate: Math.round(complexityStats.successRate * 100),
                    complexityBonus: Math.round(complexityStats.complexityBonus * 100),
                    decayReduction: `${Math.round(complexityStats.complexityBonus * 100)}%`,
                } : null,
                recovery: recoveryState ? {
                    active: recoveryState.active,
                    originalTier: recoveryState.originalTier,
                    currentTier: trust.level,
                    targetTier: recoveryState.targetTier,
                    progressPercent: Math.round((recoveryState.recoveryPoints / recoveryState.pointsRequired) * 100),
                    recoveryPoints: recoveryState.recoveryPoints,
                    pointsRequired: recoveryState.pointsRequired,
                    consecutiveSuccesses: recoveryState.consecutiveSuccesses,
                    requiredSuccesses: recoveryState.requiredConsecutiveSuccesses,
                    successRate: Math.round(recoveryState.recoverySuccessRate * 100),
                    tasksCompleted: recoveryState.recoveryTaskCount,
                    demotedAt: recoveryState.demotedAt,
                    recoveryStartedAt: recoveryState.recoveryStartedAt,
                } : null,
            } : null,
        });
    } catch (error) {
        return c.json({
            error: 'Failed to get agent trust',
            message: error instanceof Error ? error.message : 'Unknown error',
        }, 500);
    }
});

// POST /work-loop/trust/enable - Enable/disable trust integration
app.post('/trust/enable', async (c) => {
    ensureInitialized();

    const body = await c.req.json() as { enabled: boolean };

    if (typeof body.enabled !== 'boolean') {
        return c.json({ error: 'enabled (boolean) required' }, 400);
    }

    trustIntegration.setEnabled(body.enabled);

    return c.json({
        success: true,
        message: `Trust integration ${body.enabled ? 'enabled' : 'disabled'}`,
        enabled: trustIntegration.isEnabled(),
    });
});

// POST /work-loop/trust/reset - Reset all trust data and reinitialize agents
app.post('/trust/reset', async (c) => {
    ensureInitialized();

    try {
        // Reset all trust data
        await trustIntegration.resetTrust();

        // Define original tiers for core agents (these may have been demoted)
        const coreAgentTiers: Record<string, number> = {
            'exec-1': 5,
            'plan-1': 5,
            'valid-1': 5,
            'evolve-1': 5,
            'spawn-1': 5,
        };

        // Reinitialize all agents with fresh baselines
        const agents = agentWorkLoop.getAllAgents();
        const results = [];

        for (const agent of agents) {
            // Restore original tier for core agents before reinitializing
            const originalTier = coreAgentTiers[agent.id];
            if (originalTier !== undefined) {
                agent.tier = originalTier;
            }

            const record = await trustIntegration.reinitializeAgent(agent);
            // Update the agent's tier to match their trust level
            agent.tier = record.level;
            results.push({
                agentId: agent.id,
                name: agent.name,
                tier: record.level,
                score: record.score,
            });
        }

        return c.json({
            success: true,
            message: `Reset trust data and reinitialized ${agents.length} agents`,
            agents: results,
        });
    } catch (error) {
        return c.json({
            error: 'Failed to reset trust',
            message: error instanceof Error ? error.message : 'Unknown error',
        }, 500);
    }
});

// ============================================================================
// Recovery Path Endpoints
// ============================================================================

// GET /work-loop/trust/recovery - Get recovery summary for all agents in recovery
app.get('/trust/recovery', async (c) => {
    ensureInitialized();

    try {
        const recoverySummary = await trustIntegration.getRecoverySummary();
        const agents = agentWorkLoop.getAllAgents();

        // Merge with agent info
        const recoveryInfo = recoverySummary.map(recovery => {
            const agent = agents.find(a => a.id === recovery.agentId);
            return {
                ...recovery,
                agentName: agent?.name ?? 'Unknown',
                agentRole: agent?.role ?? 'Unknown',
                originalTierName: trustIntegration.getTrustLevelName(recovery.originalTier),
                targetTierName: trustIntegration.getTrustLevelName(recovery.targetTier),
                currentTierName: trustIntegration.getTrustLevelName(recovery.currentTier),
            };
        });

        return c.json({
            agentsInRecovery: recoveryInfo.length,
            recoveries: recoveryInfo,
        });
    } catch (error) {
        return c.json({
            error: 'Failed to get recovery summary',
            message: error instanceof Error ? error.message : 'Unknown error',
        }, 500);
    }
});

// POST /work-loop/trust/:agentId/recovery/start - Start recovery for an agent
app.post('/trust/:agentId/recovery/start', async (c) => {
    ensureInitialized();

    const agentId = c.req.param('agentId');
    const agent = agentWorkLoop.getAgent(agentId);

    if (!agent) {
        return c.json({ error: 'Agent not found' }, 404);
    }

    const body = await c.req.json().catch(() => ({})) as { originalTier?: number };

    try {
        const recovery = await trustIntegration.startAgentRecovery(agentId, body.originalTier);

        if (!recovery) {
            return c.json({
                error: 'Cannot start recovery',
                message: 'Agent may already be at or above original tier, or no original tier is known',
            }, 400);
        }

        return c.json({
            success: true,
            message: `Recovery started for ${agent.name}`,
            recovery: {
                active: recovery.active,
                originalTier: recovery.originalTier,
                targetTier: recovery.targetTier,
                pointsRequired: recovery.pointsRequired,
                requiredConsecutiveSuccesses: recovery.requiredConsecutiveSuccesses,
            },
        });
    } catch (error) {
        return c.json({
            error: 'Failed to start recovery',
            message: error instanceof Error ? error.message : 'Unknown error',
        }, 500);
    }
});

// POST /work-loop/trust/:agentId/recovery/cancel - Cancel recovery for an agent
app.post('/trust/:agentId/recovery/cancel', async (c) => {
    ensureInitialized();

    const agentId = c.req.param('agentId');
    const agent = agentWorkLoop.getAgent(agentId);

    if (!agent) {
        return c.json({ error: 'Agent not found' }, 404);
    }

    const body = await c.req.json().catch(() => ({})) as { reason?: string };

    try {
        const cancelled = await trustIntegration.cancelAgentRecovery(agentId, body.reason);

        if (!cancelled) {
            return c.json({
                error: 'Cannot cancel recovery',
                message: 'Agent is not in recovery mode',
            }, 400);
        }

        return c.json({
            success: true,
            message: `Recovery cancelled for ${agent.name}`,
            reason: body.reason ?? 'manual',
        });
    } catch (error) {
        return c.json({
            error: 'Failed to cancel recovery',
            message: error instanceof Error ? error.message : 'Unknown error',
        }, 500);
    }
});

// POST /work-loop/trust/:agentId/original-tier - Set original tier for an agent
app.post('/trust/:agentId/original-tier', async (c) => {
    ensureInitialized();

    const agentId = c.req.param('agentId');
    const agent = agentWorkLoop.getAgent(agentId);

    if (!agent) {
        return c.json({ error: 'Agent not found' }, 404);
    }

    const body = await c.req.json() as { tier: number };

    if (typeof body.tier !== 'number' || body.tier < 0 || body.tier > 5) {
        return c.json({ error: 'tier (0-5) required' }, 400);
    }

    trustIntegration.setOriginalTier(agentId, body.tier);

    return c.json({
        success: true,
        message: `Original tier set to T${body.tier} for ${agent.name}`,
        agentId,
        originalTier: body.tier,
    });
});

export default app;
