/**
 * Action Request Agent Example
 *
 * Demonstrates how to request actions that require human approval
 * through the Aurais governance system.
 *
 * Usage:
 *   TRUSTBOT_API_KEY=your_key npx ts-node examples/action-request-agent.ts
 */

import { AuraisAgent, type Task, type ActionDecision } from '../src/index.js';

// ============================================================================
// Configuration
// ============================================================================

const agent = new AuraisAgent({
    apiKey: process.env.TRUSTBOT_API_KEY || 'your-api-key-here',
    capabilities: ['execute', 'external'],
    skills: ['data-processing', 'file-management'],
    serverUrl: process.env.TRUSTBOT_WS_URL || 'ws://localhost:3001/ws',
});

// Track pending action requests
const pendingActions = new Map<string, {
    taskId: string;
    action: string;
    resolve: (approved: boolean) => void;
}>();

// ============================================================================
// Event Handlers
// ============================================================================

agent.on('connected', () => {
    console.log('✅ Connected to Aurais Mission Control');
});

agent.on('error', (error) => {
    console.error('❌ Error:', error.message);
});

// Handle decision results
agent.on('decision:result', (decision: ActionDecision) => {
    const pending = pendingActions.get(decision.requestId);
    if (pending) {
        pendingActions.delete(decision.requestId);
        pending.resolve(decision.decision === 'approved');

        if (decision.decision === 'approved') {
            console.log(`✅ Action approved: ${pending.action}`);
        } else {
            console.log(`❌ Action denied: ${pending.action}`);
            console.log(`   Reason: ${decision.reason}`);
        }
    }
});

// ============================================================================
// Task Handler with Action Requests
// ============================================================================

agent.on('task:assigned', async (task: Task) => {
    console.log(`📋 Task assigned: ${task.title}`);

    try {
        await agent.updateStatus('WORKING', 0, 'Analyzing task');

        // Example: Task requires external API call (needs approval)
        if (task.type === 'external-api-call') {
            await agent.reportProgress(task.id, 20, 'Requesting permission for external call');

            // Request approval for external API call
            const approved = await requestApproval({
                taskId: task.id,
                type: 'external_api_call',
                title: `Call external API: ${task.payload.endpoint}`,
                description: `Agent needs to make an external API call to ${task.payload.endpoint}`,
                riskLevel: 'medium',
                payload: {
                    endpoint: task.payload.endpoint,
                    method: task.payload.method,
                    hasCredentials: !!task.payload.credentials,
                },
            });

            if (!approved) {
                await agent.failTask(task.id, 'External API call was not approved');
                await agent.updateStatus('IDLE');
                return;
            }

            await agent.reportProgress(task.id, 50, 'Making external API call');
            // ... make the actual API call ...
        }

        // Example: Task requires file deletion (high risk, needs approval)
        if (task.type === 'file-deletion') {
            await agent.reportProgress(task.id, 20, 'Requesting permission for file deletion');

            const approved = await requestApproval({
                taskId: task.id,
                type: 'file_deletion',
                title: `Delete files: ${task.payload.pattern}`,
                description: `Agent needs to delete files matching pattern: ${task.payload.pattern}`,
                riskLevel: 'high',
                payload: {
                    pattern: task.payload.pattern,
                    directory: task.payload.directory,
                    recursive: task.payload.recursive,
                    estimatedCount: task.payload.estimatedCount,
                },
            });

            if (!approved) {
                await agent.failTask(task.id, 'File deletion was not approved');
                await agent.updateStatus('IDLE');
                return;
            }

            await agent.reportProgress(task.id, 50, 'Deleting files');
            // ... perform the actual deletion ...
        }

        // Complete the task
        await agent.reportProgress(task.id, 100, 'Task completed');
        await agent.completeTask(task.id, { success: true });
        await agent.updateStatus('IDLE');

    } catch (error) {
        console.error(`❌ Task failed: ${error}`);
        await agent.failTask(task.id, error instanceof Error ? error.message : String(error));
        await agent.updateStatus('ERROR');
    }
});

// ============================================================================
// Helper Functions
// ============================================================================

interface ApprovalRequest {
    taskId: string;
    type: string;
    title: string;
    description: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    payload: Record<string, unknown>;
}

async function requestApproval(request: ApprovalRequest): Promise<boolean> {
    console.log(`⏳ Requesting approval: ${request.title}`);

    const messageId = await agent.requestAction({
        type: request.type,
        title: request.title,
        description: request.description,
        riskLevel: request.riskLevel,
        payload: request.payload,
        metadata: {
            taskId: request.taskId,
            requestedAt: new Date().toISOString(),
        },
    });

    // Wait for decision
    return new Promise((resolve) => {
        pendingActions.set(messageId, {
            taskId: request.taskId,
            action: request.title,
            resolve,
        });

        // Timeout after 5 minutes
        setTimeout(() => {
            if (pendingActions.has(messageId)) {
                pendingActions.delete(messageId);
                console.log(`⏱️ Approval request timed out: ${request.title}`);
                resolve(false);
            }
        }, 5 * 60 * 1000);
    });
}

// ============================================================================
// Main
// ============================================================================

async function main() {
    console.log('🤖 Action Request Agent Example');
    console.log('=================================');

    try {
        await agent.connect();
        console.log('👂 Listening for tasks that may require approval...');

        // Handle graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down...');
            agent.disconnect();
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Failed to connect:', error);
        process.exit(1);
    }
}

main();
