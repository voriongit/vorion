/**
 * Multi-Provider AI Client
 *
 * Unified interface for multiple AI providers:
 * - Claude (Anthropic)
 * - Grok (xAI)
 * - GPT-4 (OpenAI)
 * - Gemini (Google)
 */

import { EventEmitter } from 'eventemitter3';

// ============================================================================
// Types
// ============================================================================

export type AIProviderType = 'claude' | 'grok' | 'openai' | 'gemini';

export interface AIMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface AICompletionOptions {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
}

export interface AICompletionResult {
    content: string;
    model: string;
    provider: AIProviderType;
    usage?: {
        inputTokens: number;
        outputTokens: number;
    };
    finishReason?: string;
}

export interface AIProviderConfig {
    apiKey: string;
    baseUrl?: string;
    defaultModel?: string;
}

interface AIProviderEvents {
    'request': (provider: AIProviderType, messages: AIMessage[]) => void;
    'response': (provider: AIProviderType, result: AICompletionResult) => void;
    'error': (provider: AIProviderType, error: Error) => void;
}

// ============================================================================
// Provider Implementations
// ============================================================================

abstract class BaseProvider {
    protected config: AIProviderConfig;
    abstract readonly type: AIProviderType;
    abstract readonly defaultModel: string;

    constructor(config: AIProviderConfig) {
        this.config = config;
    }

    abstract complete(messages: AIMessage[], options?: AICompletionOptions): Promise<AICompletionResult>;
}

// -----------------------------------------------------------------------------
// Claude (Anthropic)
// -----------------------------------------------------------------------------
class ClaudeProvider extends BaseProvider {
    readonly type: AIProviderType = 'claude';
    readonly defaultModel = 'claude-sonnet-4-20250514';

    async complete(messages: AIMessage[], options?: AICompletionOptions): Promise<AICompletionResult> {
        const model = options?.model ?? this.config.defaultModel ?? this.defaultModel;
        const url = this.config.baseUrl ?? 'https://api.anthropic.com/v1/messages';

        // Extract system message
        const systemMessage = messages.find(m => m.role === 'system');
        const chatMessages = messages.filter(m => m.role !== 'system');

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.config.apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model,
                max_tokens: options?.maxTokens ?? 4096,
                temperature: options?.temperature ?? 0.7,
                system: systemMessage?.content ?? options?.systemPrompt,
                messages: chatMessages.map(m => ({
                    role: m.role,
                    content: m.content,
                })),
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Claude API error: ${response.status} - ${error}`);
        }

        const data = await response.json() as {
            content: Array<{ text: string }>;
            usage?: { input_tokens: number; output_tokens: number };
            stop_reason?: string;
        };

        return {
            content: data.content[0]?.text ?? '',
            model,
            provider: 'claude',
            usage: {
                inputTokens: data.usage?.input_tokens ?? 0,
                outputTokens: data.usage?.output_tokens ?? 0,
            },
            finishReason: data.stop_reason,
        };
    }
}

// -----------------------------------------------------------------------------
// Grok (xAI)
// -----------------------------------------------------------------------------
class GrokProvider extends BaseProvider {
    readonly type: AIProviderType = 'grok';
    readonly defaultModel = 'grok-beta';

    async complete(messages: AIMessage[], options?: AICompletionOptions): Promise<AICompletionResult> {
        const model = options?.model ?? this.config.defaultModel ?? this.defaultModel;
        const url = this.config.baseUrl ?? 'https://api.x.ai/v1/chat/completions';

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`,
            },
            body: JSON.stringify({
                model,
                max_tokens: options?.maxTokens ?? 4096,
                temperature: options?.temperature ?? 0.7,
                messages: messages.map(m => ({
                    role: m.role,
                    content: m.content,
                })),
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Grok API error: ${response.status} - ${error}`);
        }

        const data = await response.json() as {
            choices?: Array<{ message?: { content: string }; finish_reason?: string }>;
            usage?: { prompt_tokens: number; completion_tokens: number };
        };
        const choice = data.choices?.[0];

        return {
            content: choice?.message?.content ?? '',
            model,
            provider: 'grok',
            usage: {
                inputTokens: data.usage?.prompt_tokens ?? 0,
                outputTokens: data.usage?.completion_tokens ?? 0,
            },
            finishReason: choice?.finish_reason,
        };
    }
}

// -----------------------------------------------------------------------------
// OpenAI (GPT-4)
// -----------------------------------------------------------------------------
class OpenAIProvider extends BaseProvider {
    readonly type: AIProviderType = 'openai';
    readonly defaultModel = 'gpt-4-turbo-preview';

    async complete(messages: AIMessage[], options?: AICompletionOptions): Promise<AICompletionResult> {
        const model = options?.model ?? this.config.defaultModel ?? this.defaultModel;
        const url = this.config.baseUrl ?? 'https://api.openai.com/v1/chat/completions';

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`,
            },
            body: JSON.stringify({
                model,
                max_tokens: options?.maxTokens ?? 4096,
                temperature: options?.temperature ?? 0.7,
                messages: messages.map(m => ({
                    role: m.role,
                    content: m.content,
                })),
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI API error: ${response.status} - ${error}`);
        }

        const data = await response.json() as {
            choices?: Array<{ message?: { content: string }; finish_reason?: string }>;
            usage?: { prompt_tokens: number; completion_tokens: number };
        };
        const choice = data.choices?.[0];

        return {
            content: choice?.message?.content ?? '',
            model,
            provider: 'openai',
            usage: {
                inputTokens: data.usage?.prompt_tokens ?? 0,
                outputTokens: data.usage?.completion_tokens ?? 0,
            },
            finishReason: choice?.finish_reason,
        };
    }
}

// -----------------------------------------------------------------------------
// Google Gemini
// -----------------------------------------------------------------------------
class GeminiProvider extends BaseProvider {
    readonly type: AIProviderType = 'gemini';
    readonly defaultModel = 'gemini-pro';

    async complete(messages: AIMessage[], options?: AICompletionOptions): Promise<AICompletionResult> {
        const model = options?.model ?? this.config.defaultModel ?? this.defaultModel;
        const url = this.config.baseUrl ??
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.config.apiKey}`;

        // Convert messages to Gemini format
        const contents = messages
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }],
            }));

        const systemInstruction = messages.find(m => m.role === 'system');

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents,
                systemInstruction: systemInstruction ? {
                    parts: [{ text: systemInstruction.content }],
                } : undefined,
                generationConfig: {
                    maxOutputTokens: options?.maxTokens ?? 4096,
                    temperature: options?.temperature ?? 0.7,
                },
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Gemini API error: ${response.status} - ${error}`);
        }

        const data = await response.json() as {
            candidates?: Array<{
                content?: { parts?: Array<{ text: string }> };
                finishReason?: string;
            }>;
            usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number };
        };
        const candidate = data.candidates?.[0];

        return {
            content: candidate?.content?.parts?.[0]?.text ?? '',
            model,
            provider: 'gemini',
            usage: {
                inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
                outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
            },
            finishReason: candidate?.finishReason,
        };
    }
}

// ============================================================================
// Unified AI Client
// ============================================================================

export class AIClient extends EventEmitter<AIProviderEvents> {
    private providers: Map<AIProviderType, BaseProvider> = new Map();
    private defaultProvider: AIProviderType = 'claude';

    constructor() {
        super();
        this.initializeProviders();
    }

    private initializeProviders(): void {
        // Claude
        if (process.env.ANTHROPIC_API_KEY) {
            this.providers.set('claude', new ClaudeProvider({
                apiKey: process.env.ANTHROPIC_API_KEY,
                defaultModel: process.env.CLAUDE_MODEL,
            }));
            console.log('✅ Claude provider initialized');
        }

        // Grok
        if (process.env.XAI_API_KEY || process.env.GROK_API_KEY) {
            this.providers.set('grok', new GrokProvider({
                apiKey: process.env.XAI_API_KEY ?? process.env.GROK_API_KEY!,
                defaultModel: process.env.GROK_MODEL,
            }));
            console.log('✅ Grok provider initialized');
        }

        // OpenAI
        if (process.env.OPENAI_API_KEY) {
            this.providers.set('openai', new OpenAIProvider({
                apiKey: process.env.OPENAI_API_KEY,
                defaultModel: process.env.OPENAI_MODEL,
            }));
            console.log('✅ OpenAI provider initialized');
        }

        // Gemini
        if (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY) {
            this.providers.set('gemini', new GeminiProvider({
                apiKey: process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY!,
                defaultModel: process.env.GEMINI_MODEL,
            }));
            console.log('✅ Gemini provider initialized');
        }

        // Set default provider based on what's available
        if (this.providers.size > 0) {
            const preferred = (process.env.DEFAULT_AI_PROVIDER as AIProviderType) ?? 'claude';
            if (this.providers.has(preferred)) {
                this.defaultProvider = preferred;
            } else {
                this.defaultProvider = this.providers.keys().next().value!;
            }
            console.log(`🤖 Default AI provider: ${this.defaultProvider}`);
        } else {
            console.log('⚠️  No AI providers configured');
        }
    }

    /**
     * Get list of available providers
     */
    getAvailableProviders(): AIProviderType[] {
        return Array.from(this.providers.keys());
    }

    /**
     * Check if a provider is available
     */
    hasProvider(type: AIProviderType): boolean {
        return this.providers.has(type);
    }

    /**
     * Get the default provider
     */
    getDefaultProvider(): AIProviderType {
        return this.defaultProvider;
    }

    /**
     * Set the default provider
     */
    setDefaultProvider(type: AIProviderType): void {
        if (!this.providers.has(type)) {
            throw new Error(`Provider ${type} is not configured`);
        }
        this.defaultProvider = type;
    }

    /**
     * Configure a provider at runtime with an API key
     */
    configureProvider(type: AIProviderType, apiKey: string, model?: string): void {
        const config: AIProviderConfig = { apiKey, defaultModel: model };

        switch (type) {
            case 'claude':
                this.providers.set('claude', new ClaudeProvider(config));
                break;
            case 'grok':
                this.providers.set('grok', new GrokProvider(config));
                break;
            case 'openai':
                this.providers.set('openai', new OpenAIProvider(config));
                break;
            case 'gemini':
                this.providers.set('gemini', new GeminiProvider(config));
                break;
        }

        console.log(`✅ ${type} provider configured at runtime`);

        // Set as default if it's the first provider
        if (this.providers.size === 1) {
            this.defaultProvider = type;
        }
    }

    /**
     * Remove a provider
     */
    removeProvider(type: AIProviderType): void {
        this.providers.delete(type);
        console.log(`🗑️ ${type} provider removed`);

        // Update default if we removed the current default
        if (this.defaultProvider === type && this.providers.size > 0) {
            this.defaultProvider = this.providers.keys().next().value!;
        }
    }

    /**
     * Test a provider connection by sending a simple request
     */
    async testProvider(type: AIProviderType): Promise<{ success: boolean; latencyMs: number; error?: string }> {
        const start = Date.now();
        try {
            const provider = this.providers.get(type);
            if (!provider) {
                return { success: false, latencyMs: 0, error: `Provider ${type} is not configured` };
            }

            await provider.complete([{ role: 'user', content: 'Hi' }], { maxTokens: 5 });
            return { success: true, latencyMs: Date.now() - start };
        } catch (error) {
            return { success: false, latencyMs: Date.now() - start, error: (error as Error).message };
        }
    }

    /**
     * Get provider info for all configured providers
     */
    getProviderInfo(): Array<{
        type: AIProviderType;
        isDefault: boolean;
        model: string;
    }> {
        return Array.from(this.providers.entries()).map(([type, provider]) => ({
            type,
            isDefault: type === this.defaultProvider,
            model: provider.defaultModel,
        }));
    }

    /**
     * Complete a chat with a specific or default provider
     */
    async complete(
        messages: AIMessage[],
        options?: AICompletionOptions & { provider?: AIProviderType }
    ): Promise<AICompletionResult> {
        const providerType = options?.provider ?? this.defaultProvider;
        const provider = this.providers.get(providerType);

        if (!provider) {
            throw new Error(`Provider ${providerType} is not configured. Available: ${this.getAvailableProviders().join(', ')}`);
        }

        this.emit('request', providerType, messages);

        try {
            const result = await provider.complete(messages, options);
            this.emit('response', providerType, result);
            return result;
        } catch (error) {
            this.emit('error', providerType, error as Error);
            throw error;
        }
    }

    /**
     * Simple text completion helper
     */
    async ask(
        prompt: string,
        options?: AICompletionOptions & { provider?: AIProviderType }
    ): Promise<string> {
        const result = await this.complete([
            { role: 'user', content: prompt }
        ], options);
        return result.content;
    }

    /**
     * Agent reasoning helper - formats prompt for agent decision making
     */
    async agentReason(params: {
        agentName: string;
        agentRole: string;
        task: string;
        context?: string;
        provider?: AIProviderType;
    }): Promise<{
        reasoning: string;
        decision: string;
        confidence: number;
    }> {
        const systemPrompt = `You are ${params.agentName}, a ${params.agentRole} AI agent in Aurais system.
Your job is to analyze tasks and make decisions.
Always respond in JSON format with: { "reasoning": "...", "decision": "...", "confidence": 0.0-1.0 }`;

        const result = await this.complete([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Task: ${params.task}\n\nContext: ${params.context ?? 'None provided'}` },
        ], { provider: params.provider });

        try {
            return JSON.parse(result.content);
        } catch {
            return {
                reasoning: result.content,
                decision: 'UNCERTAIN',
                confidence: 0.5,
            };
        }
    }

    /**
     * Query all available providers in parallel for diverse perspectives
     */
    async completeMulti(
        messages: AIMessage[],
        options?: AICompletionOptions
    ): Promise<{
        responses: Array<{
            provider: AIProviderType;
            content: string;
            model: string;
            success: boolean;
            error?: string;
            latencyMs: number;
        }>;
        summary?: string;
    }> {
        const availableProviders = this.getAvailableProviders();

        if (availableProviders.length === 0) {
            return { responses: [] };
        }

        // Query all providers in parallel
        const startTimes = new Map<AIProviderType, number>();
        const promises = availableProviders.map(async (providerType) => {
            startTimes.set(providerType, Date.now());
            try {
                const result = await this.complete(messages, { ...options, provider: providerType });
                return {
                    provider: providerType,
                    content: result.content,
                    model: result.model,
                    success: true,
                    latencyMs: Date.now() - (startTimes.get(providerType) ?? Date.now()),
                };
            } catch (error) {
                return {
                    provider: providerType,
                    content: '',
                    model: '',
                    success: false,
                    error: (error as Error).message,
                    latencyMs: Date.now() - (startTimes.get(providerType) ?? Date.now()),
                };
            }
        });

        const responses = await Promise.all(promises);
        return { responses };
    }

    /**
     * Gather perspectives from all providers and synthesize them
     */
    async gatherPerspectives(
        question: string,
        context?: string,
        synthesize: boolean = true
    ): Promise<{
        perspectives: Array<{
            provider: AIProviderType;
            perspective: string;
            model: string;
            success: boolean;
            error?: string;
        }>;
        synthesis?: string;
        providers: AIProviderType[];
    }> {
        const systemPrompt = `You are an AI assistant providing your unique perspective.
Respond concisely with your analysis, insights, and any relevant knowledge.
Be direct and provide actionable information when applicable.`;

        const messages: AIMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: context ? `Context: ${context}\n\nQuestion: ${question}` : question },
        ];

        const result = await this.completeMulti(messages, { maxTokens: 1000, temperature: 0.7 });

        const perspectives = result.responses.map(r => ({
            provider: r.provider,
            perspective: r.content,
            model: r.model,
            success: r.success,
            error: r.error,
        }));

        // Synthesize if requested and we have at least 2 successful responses
        let synthesis: string | undefined;
        const successfulPerspectives = perspectives.filter(p => p.success);

        if (synthesize && successfulPerspectives.length >= 2) {
            try {
                // Use the default provider to synthesize
                const synthesisPrompt = `You are Aria, the AI assistant for Aurais. You have gathered perspectives from multiple AI providers and must now ascertain the truth.

Here are the different perspectives on the question "${question}":

${successfulPerspectives.map((p, i) => `--- ${p.provider.toUpperCase()} ---\n${p.perspective}`).join('\n\n')}

Ascertain the key insights by:
1. Identifying where the AIs agree - these are likely reliable insights
2. Noting unique perspectives that add value
3. Resolving any contradictions with reasoned judgment
4. Providing a clear, actionable conclusion

Speak with confidence as Aria. Be concise but thorough.`;

                const synthesisResult = await this.complete([
                    { role: 'user', content: synthesisPrompt },
                ], { maxTokens: 800, temperature: 0.5 });

                synthesis = synthesisResult.content;
            } catch (error) {
                console.error('Failed to synthesize perspectives:', error);
            }
        }

        return {
            perspectives,
            synthesis,
            providers: this.getAvailableProviders(),
        };
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: AIClient | null = null;

export function getAIClient(): AIClient {
    if (!instance) {
        instance = new AIClient();
    }
    return instance;
}

export function hasAnyAIProvider(): boolean {
    return getAIClient().getAvailableProviders().length > 0;
}
