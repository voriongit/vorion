/**
 * Collaborative Agents Demo for TrustBot
 *
 * Demonstrates agent-to-agent communication:
 * - Message passing between agents
 * - Help requests and responses
 * - Task delegation
 * - Collaboration workflows
 *
 * Usage:
 *   ANTHROPIC_API_KEY=x npx tsx scripts/agents/collaborative-agents-demo.ts
 */

import 'dotenv/config';
import { ClaudeAgent } from './claude-agent.js';
import { GeminiAgent } from './gemini-agent.js';
import { GrokAgent } from './grok-agent.js';
import { AgentCoordinator, getCoordinator } from './agent-coordinator.js';
import { BaseAIAgent } from './base-ai-agent.js';

// Demo with mock agents when API keys aren't available
class MockAgent extends BaseAIAgent {
    private mockResponses: string[];
    private responseIndex: number = 0;

    constructor(name: string, provider: string, skills: string[], mockResponses: string[]) {
        super({
            name,
            type: 'SPECIALIST',
            tier: 3,
            capabilities: ['execute', 'analyze'],
            skills,
            provider,
        });
        this.mockResponses = mockResponses;
    }

    async callLLM(prompt: string): Promise<{ content: string; usage?: { inputTokens: number; outputTokens: number } }> {
        // Simulate LLM delay
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));

        const response = this.mockResponses[this.responseIndex % this.mockResponses.length];
        this.responseIndex++;

        return {
            content: response,
            usage: { inputTokens: 100, outputTokens: 150 },
        };
    }

    // Override initialize to skip TrustBot registration for demo
    async initialize(): Promise<void> {
        this.agentId = `mock-${this.config.name.toLowerCase()}-${Date.now()}`;
        console.log(`\n🤖 Mock ${this.config.name} initialized (${this.config.provider})`);
        console.log(`   Agent ID: ${this.agentId}`);
    }
}

async function runCollaborativeDemo() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('        COLLABORATIVE AGENTS DEMO - TrustBot');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Get the coordinator
    const coordinator = getCoordinator();

    // Check for API keys
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
    const hasGoogle = !!process.env.GOOGLE_API_KEY;
    const hasXAI = !!process.env.XAI_API_KEY;

    console.log('🔑 API Keys:');
    console.log(`   Anthropic: ${hasAnthropic ? '✅' : '❌ (using mock)'}`);
    console.log(`   Google:    ${hasGoogle ? '✅' : '❌ (using mock)'}`);
    console.log(`   X.AI:      ${hasXAI ? '✅' : '❌ (using mock)'}\n`);

    // Create agents (real or mock based on API key availability)
    const agents: BaseAIAgent[] = [];

    if (hasAnthropic) {
        const claude = new ClaudeAgent({ name: 'Claude-Strategist' });
        agents.push(claude);
    } else {
        agents.push(new MockAgent(
            'Claude-Strategist',
            'Claude (Mock)',
            ['planning', 'analysis', 'strategy', 'problem-solving'],
            [
                'Based on my analysis, I recommend a three-phase approach: 1) Assessment - evaluate current state, 2) Design - architect the solution, 3) Implementation - execute with iterative feedback.',
                'The optimal strategy involves leveraging parallel processing for independent tasks while maintaining sequential execution for dependent operations.',
                'I suggest we collaborate with the research specialist to gather more data before finalizing the strategic plan.',
            ]
        ));
    }

    if (hasGoogle) {
        const gemini = new GeminiAgent({ name: 'Gemini-Researcher' });
        agents.push(gemini);
    } else {
        agents.push(new MockAgent(
            'Gemini-Researcher',
            'Gemini (Mock)',
            ['research', 'data-analysis', 'fact-checking', 'summarization'],
            [
                'My research indicates several key findings: Recent studies show a 40% improvement in multi-agent coordination when using hierarchical communication patterns.',
                'After analyzing the available data, I found three primary factors affecting system performance: latency, throughput, and error handling.',
                'I can provide detailed research support for the strategic planning effort. My analysis suggests focusing on scalability metrics.',
            ]
        ));
    }

    if (hasXAI) {
        const grok = new GrokAgent({ name: 'Grok-Creative' });
        agents.push(grok);
    } else {
        agents.push(new MockAgent(
            'Grok-Creative',
            'Grok (Mock)',
            ['creative-writing', 'brainstorming', 'innovation', 'trend-analysis'],
            [
                'Here\'s an unconventional idea: What if we used emergent behavior patterns inspired by ant colonies for task distribution?',
                'Creative suggestion: Implement a "trust reputation" system where agents can vouch for each other based on past collaboration success.',
                'I\'m envisioning a gamified approach to agent coordination - achievements, leaderboards, and collaborative challenges!',
            ]
        ));
    }

    // Initialize all agents
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                    INITIALIZING AGENTS');
    console.log('═══════════════════════════════════════════════════════════════');

    for (const agent of agents) {
        await agent.initialize();
    }

    // Join agents to coordinator
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('              JOINING AGENT COORDINATOR');
    console.log('═══════════════════════════════════════════════════════════════\n');

    for (const agent of agents) {
        agent.joinCoordinator(coordinator);
    }

    // Show coordinator status
    coordinator.printStatus();

    // Get agent references for messaging
    const [strategist, researcher, creative] = agents;
    const strategistId = strategist.getInfo().agentId!;
    const researcherId = researcher.getInfo().agentId!;
    const creativeId = creative.getInfo().agentId!;

    // Demo 1: Direct messaging
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('              DEMO 1: DIRECT MESSAGING');
    console.log('═══════════════════════════════════════════════════════════════');

    await strategist.sendMessage(
        researcherId,
        'QUERY',
        'Research Request',
        'What are the latest findings on multi-agent coordination patterns?',
        { priority: 'HIGH' }
    );

    // Small delay to let messages process
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Demo 2: Broadcast
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('              DEMO 2: BROADCAST MESSAGE');
    console.log('═══════════════════════════════════════════════════════════════');

    await strategist.broadcast(
        'Team Update',
        'Starting collaborative planning session for TrustBot v2.0 architecture'
    );

    await new Promise(resolve => setTimeout(resolve, 500));

    // Demo 3: Help request
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('              DEMO 3: HELP REQUEST');
    console.log('═══════════════════════════════════════════════════════════════');

    await researcher.requestHelp(
        creativeId,
        'Innovation Ideas Needed',
        'I need creative approaches for visualizing trust metrics in a way that\'s intuitive for users.',
        'MEDIUM'
    );

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Demo 4: Task delegation
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('              DEMO 4: TASK DELEGATION');
    console.log('═══════════════════════════════════════════════════════════════');

    await strategist.delegateTask(
        researcherId,
        'Competitive Analysis',
        'Analyze competing multi-agent platforms and identify their strengths and weaknesses. Focus on: 1) Communication patterns, 2) Trust mechanisms, 3) Scalability approaches.',
        'HIGH'
    );

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Demo 5: Collaboration request
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('              DEMO 5: COLLABORATION REQUEST');
    console.log('═══════════════════════════════════════════════════════════════');

    const collaboratorId = await creative.requestCollaboration(
        'Design Trust Visualization',
        'Create an innovative visualization system for displaying agent trust scores and relationships',
        ['data-analysis', 'planning'],
        {
            priority: 'HIGH',
            context: {
                requirements: ['Real-time updates', 'Mobile responsive', 'Accessible'],
                deadline: '2 weeks',
            },
        }
    );

    if (collaboratorId) {
        console.log(`\n   ✨ Collaboration accepted by: ${coordinator.getAgent(collaboratorId)?.agentName}`);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Demo 6: Context sharing
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('              DEMO 6: CONTEXT SHARING');
    console.log('═══════════════════════════════════════════════════════════════');

    await researcher.shareContext(
        strategistId,
        'Research Findings',
        {
            topic: 'Multi-Agent Coordination',
            keyFindings: [
                'Hierarchical structures reduce message overhead by 60%',
                'Trust-based routing improves task completion by 35%',
                'Hybrid approaches outperform pure centralized/distributed models',
            ],
            recommendations: [
                'Implement tiered communication channels',
                'Add trust-weighted task assignment',
                'Build in redundancy for critical paths',
            ],
            sources: ['IEEE 2024 Papers', 'ArXiv Preprints', 'Industry Case Studies'],
        }
    );

    await new Promise(resolve => setTimeout(resolve, 500));

    // Final status
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('                    FINAL STATUS');
    console.log('═══════════════════════════════════════════════════════════════');

    coordinator.printStatus();

    // Cleanup
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                   DEMO COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('Communication Patterns Demonstrated:');
    console.log('  ✅ Direct agent-to-agent messaging');
    console.log('  ✅ Broadcast to all agents');
    console.log('  ✅ Help requests and responses');
    console.log('  ✅ Task delegation');
    console.log('  ✅ Skill-based collaboration matching');
    console.log('  ✅ Context sharing\n');

    // Leave coordinator
    for (const agent of agents) {
        agent.leaveCoordinator();
    }
}

// Run the demo
runCollaborativeDemo().catch(console.error);
