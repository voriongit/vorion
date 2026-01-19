/**
 * Gemini AI Agent for TrustBot
 *
 * Connects Google Gemini as an AI agent to TrustBot Mission Control.
 *
 * Usage:
 *   GOOGLE_API_KEY=your_key npx ts-node scripts/agents/gemini-agent.ts
 */

import { BaseAIAgent, type LLMResponse, type AgentConfig } from './base-ai-agent.js';

class GeminiAgent extends BaseAIAgent {
    private googleApiKey: string;
    private model: string;

    constructor(config?: Partial<AgentConfig>) {
        super({
            name: config?.name || 'Gemini-Agent',
            type: config?.type || 'RESEARCHER',
            tier: config?.tier || 3,
            capabilities: config?.capabilities || ['execute', 'research', 'synthesize'],
            skills: config?.skills || ['research', 'data-analysis', 'summarization', 'fact-checking'],
            provider: 'Gemini (Google)',
        });

        this.googleApiKey = process.env.GOOGLE_API_KEY || '';
        this.model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

        if (!this.googleApiKey) {
            console.warn('⚠️  GOOGLE_API_KEY not set - Gemini calls will fail');
        }
    }

    async callLLM(prompt: string): Promise<LLMResponse> {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.googleApiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { text: prompt },
                        ],
                    },
                ],
                generationConfig: {
                    maxOutputTokens: 2048,
                    temperature: 0.7,
                },
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Gemini API error: ${error}`);
        }

        const data = await response.json() as {
            candidates: Array<{
                content: {
                    parts: Array<{ text: string }>;
                };
            }>;
            usageMetadata?: {
                promptTokenCount: number;
                candidatesTokenCount: number;
            };
        };

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        return {
            content: text,
            usage: data.usageMetadata ? {
                inputTokens: data.usageMetadata.promptTokenCount,
                outputTokens: data.usageMetadata.candidatesTokenCount,
            } : undefined,
        };
    }
}

// Main execution
async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('           GEMINI AGENT - TrustBot Mission Control');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const agent = new GeminiAgent();

    try {
        await agent.initialize();

        // Execute a sample task
        await agent.executeTask(
            'Research Best Practices',
            `Research and summarize best practices for:
1. Multi-agent AI systems
2. Trust and safety in autonomous agents
3. Human-in-the-loop patterns for AI oversight

Provide a structured summary with key recommendations.`,
            'MEDIUM'
        );

        console.log('\n✅ Gemini Agent completed successfully!');

    } catch (error) {
        console.error('\n❌ Error:', error);
        process.exit(1);
    }
}

// Export for use as module
export { GeminiAgent };

// Run if executed directly (ESM entry point check)
import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main();
}
