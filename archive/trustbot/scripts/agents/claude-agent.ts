/**
 * Claude AI Agent for TrustBot
 *
 * Connects Claude (Anthropic) as an AI agent to TrustBot Mission Control.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=your_key npx ts-node scripts/agents/claude-agent.ts
 */

import { BaseAIAgent, type LLMResponse, type AgentConfig } from './base-ai-agent.js';

class ClaudeAgent extends BaseAIAgent {
    private anthropicApiKey: string;
    private model: string;

    constructor(config?: Partial<AgentConfig>) {
        super({
            name: config?.name || 'Claude-Agent',
            type: config?.type || 'PLANNER',
            tier: config?.tier || 3,
            capabilities: config?.capabilities || ['execute', 'reason', 'analyze'],
            skills: config?.skills || ['planning', 'analysis', 'problem-solving', 'code-review'],
            provider: 'Claude (Anthropic)',
        });

        this.anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';
        this.model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

        if (!this.anthropicApiKey) {
            console.warn('⚠️  ANTHROPIC_API_KEY not set - Claude calls will fail');
        }
    }

    async callLLM(prompt: string): Promise<LLMResponse> {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.anthropicApiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: this.model,
                max_tokens: 2048,
                messages: [
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Claude API error: ${error}`);
        }

        const data = await response.json() as {
            content: Array<{ type: string; text: string }>;
            usage: { input_tokens: number; output_tokens: number };
        };

        return {
            content: data.content[0]?.text || '',
            usage: {
                inputTokens: data.usage.input_tokens,
                outputTokens: data.usage.output_tokens,
            },
        };
    }
}

// Main execution
async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('           CLAUDE AGENT - TrustBot Mission Control');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const agent = new ClaudeAgent();

    try {
        await agent.initialize();

        // Execute a sample task
        await agent.executeTask(
            'Analyze System Architecture',
            `Review the TrustBot system architecture and provide insights on:
1. The trust scoring mechanism
2. The decision pipeline flow
3. Potential improvements for scalability

Provide actionable recommendations.`,
            'HIGH'
        );

        console.log('\n✅ Claude Agent completed successfully!');

    } catch (error) {
        console.error('\n❌ Error:', error);
        process.exit(1);
    }
}

// Export for use as module
export { ClaudeAgent };

// Run if executed directly (ESM entry point check)
import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main();
}
