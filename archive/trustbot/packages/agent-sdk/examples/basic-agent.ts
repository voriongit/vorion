/**
 * Basic Aurais Agent Example
 *
 * Demonstrates how to use the @aurais/agent-sdk to connect an AI agent
 * to Aurais Mission Control.
 *
 * Usage:
 *   TRUSTBOT_API_KEY=your_key npx ts-node examples/basic-agent.ts
 */

import { AuraisAgent, type Task, type ActionRequest } from '../src/index.js';

// ============================================================================
// Configuration
// ============================================================================

const agent = new AuraisAgent({
    apiKey: process.env.TRUSTBOT_API_KEY || 'your-api-key-here',
    capabilities: ['execute', 'external'],
    skills: ['web-dev', 'api-integration', 'data-analysis'],
    serverUrl: process.env.TRUSTBOT_WS_URL || 'ws://localhost:3001/ws',
    autoReconnect: true,
    maxReconnectAttempts: 10,
    heartbeatInterval: 30000,
    metadata: {
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
    },
});

// ============================================================================
// Event Handlers
// ============================================================================

// Connection events
agent.on('connected', () => {
    console.log('✅ Connected to Aurais Mission Control');
    console.log(`   Agent ID: ${agent.getAgentId()}`);
    console.log(`   Structured ID: ${agent.getStructuredId()}`);
});

agent.on('disconnected', (reason) => {
    console.log(`❌ Disconnected: ${reason}`);
});

agent.on('reconnecting', (attempt, maxAttempts) => {
    console.log(`🔄 Reconnecting... (attempt ${attempt}/${maxAttempts})`);
});

agent.on('reconnected', () => {
    console.log('✅ Reconnected to Aurais Mission Control');
});

agent.on('error', (error) => {
    console.error('❌ Error:', error.message);
});

// Status changes
agent.on('status:changed', (oldStatus, newStatus) => {
    console.log(`📊 Status changed: ${oldStatus} → ${newStatus}`);
});

// ============================================================================
// Task Handler
// ============================================================================

agent.on('task:assigned', async (task: Task) => {
    console.log(`📋 Task assigned: ${task.title}`);
    console.log(`   ID: ${task.id}`);
    console.log(`   Type: ${task.type}`);
    console.log(`   Priority: ${task.priority}`);

    try {
        // Update status to working
        await agent.updateStatus('WORKING', 0, `Starting task: ${task.title}`);

        // Simulate task execution with progress updates
        const steps = ['Analyzing', 'Processing', 'Validating', 'Completing'];

        for (let i = 0; i < steps.length; i++) {
            const progress = Math.round(((i + 1) / steps.length) * 100);
            await agent.reportProgress(task.id, progress, steps[i]);
            console.log(`   📊 Progress: ${progress}% - ${steps[i]}`);

            // Simulate work
            await sleep(1000);
        }

        // Complete the task
        const result = {
            message: 'Task completed successfully',
            processedAt: new Date().toISOString(),
            taskType: task.type,
        };

        await agent.completeTask(task.id, result);
        console.log(`✅ Task completed: ${task.id}`);

        // Return to idle
        await agent.updateStatus('IDLE');

    } catch (error) {
        console.error(`❌ Task failed: ${error}`);
        await agent.failTask(task.id, error instanceof Error ? error.message : String(error));
        await agent.updateStatus('ERROR', undefined, 'Task execution failed');
    }
});

// ============================================================================
// Decision Handler
// ============================================================================

agent.on('decision:required', async (request: ActionRequest) => {
    console.log(`⚠️ Decision required: ${request.title}`);
    console.log(`   ID: ${request.id}`);
    console.log(`   Risk Level: ${request.riskLevel}`);
    console.log(`   Urgency: ${request.urgency}`);

    // In a real agent, you would process this and potentially
    // request human approval through the dashboard
});

agent.on('decision:result', (decision) => {
    console.log(`📝 Decision received for ${decision.requestId}`);
    console.log(`   Decision: ${decision.decision}`);
    console.log(`   Decided by: ${decision.decidedBy}`);
    if (decision.reason) {
        console.log(`   Reason: ${decision.reason}`);
    }
});

// ============================================================================
// Config Handler
// ============================================================================

agent.on('config:updated', (config) => {
    console.log(`⚙️ Config updated: ${config.key} = ${JSON.stringify(config.value)}`);
});

// ============================================================================
// Main
// ============================================================================

async function main() {
    console.log('🤖 Aurais Agent SDK Example');
    console.log('================================');

    try {
        // Connect to Mission Control
        console.log('🔌 Connecting to Aurais Mission Control...');
        await agent.connect();

        // Keep the agent running
        console.log('👂 Listening for tasks...');
        console.log('   Press Ctrl+C to disconnect');

        // Handle graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down...');
            agent.disconnect();
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            console.log('\n🛑 Shutting down...');
            agent.disconnect();
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Failed to connect:', error);
        process.exit(1);
    }
}

// ============================================================================
// Utilities
// ============================================================================

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the agent
main();
