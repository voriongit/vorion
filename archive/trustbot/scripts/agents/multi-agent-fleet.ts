/**
 * Multi-Agent Fleet Runner for TrustBot
 *
 * Launches multiple AI agents (Claude, Gemini, Grok) to work together
 * on tasks within TrustBot Mission Control.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=x GOOGLE_API_KEY=y XAI_API_KEY=z npx ts-node scripts/agents/multi-agent-fleet.ts
 */

import 'dotenv/config';
import { ClaudeAgent } from './claude-agent.js';
import { GeminiAgent } from './gemini-agent.js';
import { GrokAgent } from './grok-agent.js';

interface FleetMember {
    agent: ClaudeAgent | GeminiAgent | GrokAgent;
    role: string;
    status: 'pending' | 'ready' | 'working' | 'error';
}

class MultiAgentFleet {
    private fleet: Map<string, FleetMember> = new Map();
    private apiBaseUrl: string;

    constructor() {
        this.apiBaseUrl = process.env.TRUSTBOT_API_URL || 'https://trustbot-api.fly.dev';
    }

    /**
     * Add an agent to the fleet
     */
    addAgent(name: string, agent: ClaudeAgent | GeminiAgent | GrokAgent, role: string): void {
        this.fleet.set(name, { agent, role, status: 'pending' });
    }

    /**
     * Initialize all agents in the fleet
     */
    async initializeFleet(): Promise<void> {
        console.log('\n🚀 Initializing Multi-Agent Fleet...\n');
        console.log('═══════════════════════════════════════════════════════════════\n');

        const initPromises = Array.from(this.fleet.entries()).map(async ([name, member]) => {
            try {
                await member.agent.initialize();
                member.status = 'ready';
                console.log(`   ✅ ${name} ready (${member.role})`);
            } catch (error) {
                member.status = 'error';
                console.error(`   ❌ ${name} failed: ${error}`);
            }
        });

        await Promise.all(initPromises);

        const readyCount = Array.from(this.fleet.values()).filter(m => m.status === 'ready').length;
        console.log(`\n📊 Fleet Status: ${readyCount}/${this.fleet.size} agents ready\n`);
    }

    /**
     * Execute a coordinated multi-agent task
     */
    async executeCoordinatedTask(
        taskTitle: string,
        subtasks: Array<{ agentName: string; subtask: string }>
    ): Promise<void> {
        console.log('═══════════════════════════════════════════════════════════════');
        console.log(`   COORDINATED TASK: ${taskTitle}`);
        console.log('═══════════════════════════════════════════════════════════════\n');

        for (const { agentName, subtask } of subtasks) {
            const member = this.fleet.get(agentName);
            if (!member || member.status !== 'ready') {
                console.log(`⚠️  Skipping ${agentName} (not ready)`);
                continue;
            }

            member.status = 'working';
            console.log(`\n🔄 ${agentName} working on: ${subtask.substring(0, 50)}...`);

            try {
                await member.agent.executeTask(
                    `${taskTitle} - ${agentName}`,
                    subtask,
                    'HIGH'
                );
                member.status = 'ready';
            } catch (error) {
                console.error(`   ❌ ${agentName} error: ${error}`);
                member.status = 'error';
            }
        }
    }

    /**
     * Get fleet status
     */
    getStatus(): Record<string, string> {
        const status: Record<string, string> = {};
        this.fleet.forEach((member, name) => {
            status[name] = member.status;
        });
        return status;
    }

    /**
     * Check dashboard for results
     */
    async checkDashboard(): Promise<void> {
        const response = await fetch(`${this.apiBaseUrl}/dashboard/today`);
        const data = await response.json();

        console.log('\n📊 Dashboard Summary:');
        console.log(`   Tasks Completed: ${data.totalCompleted}`);
        console.log(`   Tasks Failed: ${data.totalFailed}`);
        console.log(`   Trust Changes: +${data.trustChanges?.rewards || 0} / -${data.trustChanges?.penalties || 0}`);
    }
}

// Main execution
async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('        MULTI-AGENT FLEET - TrustBot Mission Control');
    console.log('═══════════════════════════════════════════════════════════════');

    const fleet = new MultiAgentFleet();

    // Check which API keys are available
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
    const hasGoogle = !!process.env.GOOGLE_API_KEY;
    const hasXAI = !!process.env.XAI_API_KEY;

    console.log('\n🔑 API Keys Detected:');
    console.log(`   Claude (Anthropic): ${hasAnthropic ? '✅' : '❌'}`);
    console.log(`   Gemini (Google):    ${hasGoogle ? '✅' : '❌'}`);
    console.log(`   Grok (X.AI):        ${hasXAI ? '✅' : '❌'}`);

    // Add available agents to fleet
    if (hasAnthropic) {
        fleet.addAgent('Claude', new ClaudeAgent({ name: 'Claude-Fleet-001' }), 'Strategic Planner');
    }
    if (hasGoogle) {
        fleet.addAgent('Gemini', new GeminiAgent({ name: 'Gemini-Fleet-001' }), 'Research Analyst');
    }
    if (hasXAI) {
        fleet.addAgent('Grok', new GrokAgent({ name: 'Grok-Fleet-001' }), 'Creative Specialist');
    }

    if (!hasAnthropic && !hasGoogle && !hasXAI) {
        console.error('\n❌ No API keys configured. Set at least one of:');
        console.error('   - ANTHROPIC_API_KEY');
        console.error('   - GOOGLE_API_KEY');
        console.error('   - XAI_API_KEY');
        process.exit(1);
    }

    try {
        // Initialize the fleet
        await fleet.initializeFleet();

        // Execute a coordinated multi-agent task
        const subtasks: Array<{ agentName: string; subtask: string }> = [];

        if (hasAnthropic) {
            subtasks.push({
                agentName: 'Claude',
                subtask: `As the Strategic Planner, create a high-level strategy for:

1. Scaling the TrustBot multi-agent system to 100+ agents
2. Implementing hierarchical trust delegation
3. Optimizing the decision pipeline for low latency

Provide a phased implementation plan.`,
            });
        }

        if (hasGoogle) {
            subtasks.push({
                agentName: 'Gemini',
                subtask: `As the Research Analyst, research and compile:

1. Latest academic papers on multi-agent trust systems
2. Industry best practices for AI fleet management
3. Case studies of successful autonomous agent deployments

Provide citations and key findings.`,
            });
        }

        if (hasXAI) {
            subtasks.push({
                agentName: 'Grok',
                subtask: `As the Creative Specialist, brainstorm:

1. Novel approaches to human-AI trust calibration
2. Creative visualizations for trust dynamics
3. Unconventional metrics for agent reliability

Think outside the box and be innovative.`,
            });
        }

        await fleet.executeCoordinatedTask(
            'TrustBot System Enhancement Analysis',
            subtasks
        );

        // Check final dashboard
        await fleet.checkDashboard();

        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('         MULTI-AGENT FLEET EXECUTION COMPLETE');
        console.log('═══════════════════════════════════════════════════════════════\n');

        console.log('Fleet Status:', fleet.getStatus());

    } catch (error) {
        console.error('\n❌ Fleet Error:', error);
        process.exit(1);
    }
}

// Export for use as module
export { MultiAgentFleet };

// Run if executed directly
main();
