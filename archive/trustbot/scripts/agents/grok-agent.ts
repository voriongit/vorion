/**
 * Grok AI Agent for TrustBot
 *
 * Connects X.AI's Grok as an AI agent to TrustBot Mission Control.
 *
 * Usage:
 *   XAI_API_KEY=your_key npx ts-node scripts/agents/grok-agent.ts
 */

import { BaseAIAgent, type LLMResponse, type AgentConfig } from './base-ai-agent.js';

class GrokAgent extends BaseAIAgent {
    private xaiApiKey: string;
    private model: string;

    constructor(config?: Partial<AgentConfig>) {
        super({
            name: config?.name || 'Grok-Agent',
            type: config?.type || 'SPECIALIST',
            tier: config?.tier || 3,
            capabilities: config?.capabilities || ['execute', 'analyze', 'create'],
            skills: config?.skills || ['creative-writing', 'trend-analysis', 'real-time-info', 'humor'],
            provider: 'Grok (X.AI)',
        });

        this.xaiApiKey = process.env.XAI_API_KEY || '';
        this.model = process.env.GROK_MODEL || 'grok-3';

        if (!this.xaiApiKey) {
            console.warn('⚠️  XAI_API_KEY not set - Grok calls will fail');
        }
    }

    async callLLM(prompt: string): Promise<LLMResponse> {
        // Grok uses OpenAI-compatible API
        const response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.xaiApiKey}`,
            },
            body: JSON.stringify({
                model: this.model,
                max_tokens: 2048,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful AI agent working within the TrustBot system. Be direct, insightful, and efficient.',
                    },
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Grok API error: ${error}`);
        }

        const data = await response.json() as {
            choices: Array<{
                message: {
                    content: string;
                };
            }>;
            usage?: {
                prompt_tokens: number;
                completion_tokens: number;
            };
        };

        return {
            content: data.choices[0]?.message?.content || '',
            usage: data.usage ? {
                inputTokens: data.usage.prompt_tokens,
                outputTokens: data.usage.completion_tokens,
            } : undefined,
        };
    }
}

// Main execution
async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('            GROK AGENT - TrustBot Mission Control');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const agent = new GrokAgent();

    try {
        await agent.initialize();

        // Execute a sample task
        await agent.executeTask(
            'Creative Analysis Task',
            `Analyze the concept of "trust" in AI systems and provide:
1. A creative analogy explaining trust scoring
2. Potential pitfalls in automated trust systems
3. Innovative ideas for improving human-AI collaboration

Be insightful and think outside the box.`,
            'MEDIUM'
        );

        console.log('\n✅ Grok Agent completed successfully!');

    } catch (error) {
        console.error('\n❌ Error:', error);
        process.exit(1);
    }
}

// Export for use as module
export { GrokAgent };

// Run if executed directly (ESM entry point check)
import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main();
}
