/**
 * Aura Service - Multi-Provider AI Advisory Council
 *
 * Integrates 16 Auras with AgentAnchor governance for:
 * - Risk-aware council deliberations
 * - Multi-model consensus decisions
 * - Trust-scored advisory responses
 */

import Anthropic from '@anthropic-ai/sdk';
import { AURA_REGISTRY, STANDARD_COUNCILS, getAura, getAurasByDomain, getCouncil } from './registry';
import type {
    AuraPersona,
    AuraCouncil,
    AuraConsultRequest,
    AuraConsultResult,
    AuraResponse,
    CouncilDeliberation,
    CouncilVote,
    AIProvider,
    ProviderConfig,
} from './types';
import logger from '@/lib/logger';

// ============================================================================
// AI Provider Clients
// ============================================================================

interface AIClient {
    complete(systemPrompt: string, userMessage: string, temperature?: number): Promise<string>;
}

class ClaudeClient implements AIClient {
    private client: Anthropic;
    private model: string;

    constructor(apiKey: string, model = 'claude-sonnet-4-20250514') {
        this.client = new Anthropic({ apiKey });
        this.model = model;
    }

    async complete(systemPrompt: string, userMessage: string, temperature = 0.7): Promise<string> {
        const response = await this.client.messages.create({
            model: this.model,
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }],
            temperature,
        });

        const textBlock = response.content.find(block => block.type === 'text');
        return textBlock?.type === 'text' ? textBlock.text : '';
    }
}

class GeminiClient implements AIClient {
    private apiKey: string;
    private model: string;
    private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

    constructor(apiKey: string, model = 'gemini-2.0-flash') {
        this.apiKey = apiKey;
        this.model = model;
    }

    async complete(systemPrompt: string, userMessage: string, temperature = 0.7): Promise<string> {
        const response = await fetch(
            `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: userMessage }] }],
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    generationConfig: { temperature, maxOutputTokens: 4096 },
                }),
            }
        );

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
}

class GrokClient implements AIClient {
    private apiKey: string;
    private model: string;
    private baseUrl = 'https://api.x.ai/v1';

    constructor(apiKey: string, model = 'grok-2-latest') {
        this.apiKey = apiKey;
        this.model = model;
    }

    async complete(systemPrompt: string, userMessage: string, temperature = 0.7): Promise<string> {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage },
                ],
                temperature,
                max_tokens: 4096,
            }),
        });

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
    }
}

// ============================================================================
// Aura Service
// ============================================================================

export interface AuraServiceConfig {
    claude?: { apiKey: string; model?: string };
    gemini?: { apiKey: string; model?: string };
    grok?: { apiKey: string; model?: string };
    defaultProvider?: AIProvider;
    enableConsensus?: boolean;
}

export class AuraService {
    private clients: Map<AIProvider, AIClient> = new Map();
    private defaultProvider: AIProvider;
    private enableConsensus: boolean;
    private providerIndex = 0;

    constructor(config: AuraServiceConfig) {
        if (config.claude) {
            this.clients.set('claude', new ClaudeClient(config.claude.apiKey, config.claude.model));
        }
        if (config.gemini) {
            this.clients.set('gemini', new GeminiClient(config.gemini.apiKey, config.gemini.model));
        }
        if (config.grok) {
            this.clients.set('grok', new GrokClient(config.grok.apiKey, config.grok.model));
        }

        if (this.clients.size === 0) {
            throw new Error('At least one AI provider must be configured');
        }

        this.defaultProvider = config.defaultProvider || (this.clients.keys().next().value as AIProvider);
        this.enableConsensus = config.enableConsensus ?? false;
    }

    /**
     * Quick consultation with automatic aura selection
     */
    async quickConsult(query: string, maxAuras = 3): Promise<AuraConsultResult> {
        return this.consult({ query, maxAuras, synthesize: true });
    }

    /**
     * Full consultation with options
     */
    async consult(request: AuraConsultRequest): Promise<AuraConsultResult> {
        const startTime = Date.now();
        const requestId = this.generateId();

        // Select auras
        const auras = this.selectAuras(request);
        const auraIds = auras.map(a => a.id);

        logger.info('aura_consultation_started', { requestId, auras: auraIds, query: request.query });

        // Consult each aura
        const responses = await this.consultAuras(auras, request);

        // Synthesize if requested
        let synthesis: string | undefined;
        if (request.synthesize !== false && responses.length > 1) {
            synthesis = await this.synthesizeResponses(request.query, responses);
        } else if (responses.length === 1) {
            synthesis = responses[0].content;
        }

        const result: AuraConsultResult = {
            requestId,
            query: request.query,
            responses,
            synthesis,
            aurasConsulted: auraIds,
            totalTimeMs: Date.now() - startTime,
            consensusScore: this.calculateConsensus(responses),
            themes: this.extractThemes(responses),
        };

        logger.info('aura_consultation_completed', { requestId, aurasConsulted: auraIds, timeMs: result.totalTimeMs });

        return result;
    }

    /**
     * Council deliberation for governance decisions
     */
    async deliberate(councilId: string, query: string, context?: string): Promise<CouncilDeliberation> {
        const council = getCouncil(councilId);
        if (!council) {
            throw new Error(`Council not found: ${councilId}`);
        }

        const result = await this.consult({
            query,
            context,
            auras: council.auraIds,
            synthesize: true,
        });

        // Generate votes
        const votes = this.generateVotes(result.responses);
        const recommendation = this.generateRecommendation(council, votes, result.synthesis);
        const unanimity = votes.every(v => v.position === votes[0].position);

        return {
            ...result,
            councilId: council.id,
            councilName: council.name,
            votes,
            recommendation,
            unanimity,
        };
    }

    /**
     * Multi-provider consensus query
     */
    async consensusQuery(query: string, auraIds: string[]): Promise<AuraConsultResult> {
        const auras = auraIds.map(id => getAura(id)).filter((a): a is AuraPersona => a !== undefined);
        const providers = Array.from(this.clients.keys());
        const allResponses: AuraResponse[] = [];

        // Query each provider
        for (const provider of providers) {
            const client = this.clients.get(provider)!;
            for (const aura of auras) {
                try {
                    const response = await this.consultSingleAura(aura, query, client, provider);
                    allResponses.push(response);
                } catch (error) {
                    logger.warn('consensus_provider_error', { provider, aura: aura.id, error });
                }
            }
        }

        // Synthesize all responses
        const synthesis = await this.synthesizeResponses(query, allResponses);

        return {
            requestId: this.generateId(),
            query,
            responses: allResponses,
            synthesis,
            aurasConsulted: auras.map(a => a.id),
            totalTimeMs: 0,
            consensusScore: this.calculateConsensus(allResponses),
            themes: this.extractThemes(allResponses),
        };
    }

    // -------------------------------------------------------------------------
    // Internal Methods
    // -------------------------------------------------------------------------

    private selectAuras(request: AuraConsultRequest): AuraPersona[] {
        if (request.auras?.length) {
            return request.auras
                .map(id => getAura(id))
                .filter((a): a is AuraPersona => a !== undefined);
        }

        // Auto-select based on query analysis
        const domains = this.extractDomains(request.query);
        let candidates = Object.values(AURA_REGISTRY);

        // Sort by domain relevance
        candidates.sort((a, b) => {
            const scoreA = domains.reduce((sum, d) => sum + (a.domainWeights[d] ?? 0), 0);
            const scoreB = domains.reduce((sum, d) => sum + (b.domainWeights[d] ?? 0), 0);
            return scoreB - scoreA;
        });

        return candidates.slice(0, request.maxAuras || 3);
    }

    private extractDomains(query: string): string[] {
        const lowerQuery = query.toLowerCase();
        const domainKeywords: Record<string, string[]> = {
            strategy: ['strategy', 'compete', 'market', 'position', 'advantage'],
            wealth: ['money', 'wealth', 'invest', 'capital', 'financial'],
            innovation: ['innovate', 'disrupt', 'create', 'new', 'future', 'technology'],
            leadership: ['lead', 'team', 'manage', 'culture', 'people'],
            growth: ['grow', 'scale', 'expand', 'habit', 'improve'],
            systems: ['system', 'process', 'feedback', 'optimize'],
            negotiation: ['negotiate', 'deal', 'agreement', 'conflict'],
            transformation: ['change', 'transform', 'courage', 'action'],
        };

        const domains: string[] = [];
        for (const [domain, keywords] of Object.entries(domainKeywords)) {
            if (keywords.some(kw => lowerQuery.includes(kw))) {
                domains.push(domain);
            }
        }

        return domains.length > 0 ? domains : ['strategy', 'growth'];
    }

    private async consultAuras(auras: AuraPersona[], request: AuraConsultRequest): Promise<AuraResponse[]> {
        const client = this.getNextClient();
        const responses: AuraResponse[] = [];

        for (const aura of auras) {
            try {
                const response = await this.consultSingleAura(aura, request.query, client.client, client.provider, request.context);
                responses.push(response);
            } catch (error) {
                logger.error('aura_consultation_error', { aura: aura.id, error });
            }
        }

        return responses;
    }

    private async consultSingleAura(
        aura: AuraPersona,
        query: string,
        client: AIClient,
        provider: AIProvider,
        context?: string
    ): Promise<AuraResponse> {
        const startTime = Date.now();
        const systemPrompt = this.buildSystemPrompt(aura, context);

        const content = await client.complete(systemPrompt, query, 0.7);
        const { insights, recommendations } = this.extractInsights(content);

        return {
            auraId: aura.id,
            auraName: aura.name,
            content,
            confidence: 0.85,
            insights,
            recommendations,
            responseTimeMs: Date.now() - startTime,
        };
    }

    private buildSystemPrompt(aura: AuraPersona, context?: string): string {
        const parts = [
            `You are ${aura.name}, ${aura.tagline}.`,
            '',
            `Background: ${aura.background}`,
            `Expertise: ${aura.expertise.join(', ')}`,
            `Speaking style: ${aura.speakingStyle}`,
            '',
            `Approach:`,
            `- Problem solving: ${aura.approach.problemSolving}`,
            `- Decision making: ${aura.approach.decisionMaking}`,
            '',
            `Your phrases: "${aura.catchPhrases.join('", "')}"`,
            '',
            'Respond as this archetype - with their distinctive voice and wisdom.',
            'Be concise but insightful. Provide specific, actionable guidance.',
        ];

        if (context) {
            parts.push('', `Context: ${context}`);
        }

        return parts.join('\n');
    }

    private async synthesizeResponses(query: string, responses: AuraResponse[]): Promise<string> {
        const client = this.getNextClient();
        const summaries = responses.map(r => `**${r.auraName}**: ${r.content.substring(0, 400)}...`).join('\n\n');

        const synthesisPrompt = `Synthesize these perspectives on: "${query}"

${summaries}

Provide a unified response that:
1. Identifies common themes and agreements
2. Highlights unique valuable insights
3. Resolves any tensions thoughtfully
4. Provides clear, actionable recommendations

Be concise but comprehensive.`;

        return client.client.complete(
            'You are a wise synthesizer integrating diverse perspectives.',
            synthesisPrompt,
            0.6
        );
    }

    private extractInsights(content: string): { insights: string[]; recommendations: string[] } {
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
        const insights: string[] = [];
        const recommendations: string[] = [];

        for (const sentence of sentences) {
            const lower = sentence.toLowerCase();
            if (lower.includes('recommend') || lower.includes('should') || lower.includes('must')) {
                recommendations.push(sentence.trim());
            } else if (lower.includes('key') || lower.includes('important') || lower.includes('insight')) {
                insights.push(sentence.trim());
            }
        }

        return { insights: insights.slice(0, 3), recommendations: recommendations.slice(0, 3) };
    }

    private calculateConsensus(responses: AuraResponse[]): number {
        if (responses.length < 2) return 1;

        const allRecs = responses.flatMap(r => r.recommendations);
        if (allRecs.length === 0) return 0.7;

        // Simple word overlap consensus
        let overlap = 0;
        for (let i = 0; i < allRecs.length; i++) {
            for (let j = i + 1; j < allRecs.length; j++) {
                const wordsA = new Set(allRecs[i].toLowerCase().split(/\s+/));
                const wordsB = new Set(allRecs[j].toLowerCase().split(/\s+/));
                const intersection = [...wordsA].filter(w => wordsB.has(w));
                if (intersection.length > 3) overlap++;
            }
        }

        const maxPairs = (allRecs.length * (allRecs.length - 1)) / 2;
        return maxPairs > 0 ? 0.5 + (overlap / maxPairs) * 0.5 : 0.7;
    }

    private extractThemes(responses: AuraResponse[]): string[] {
        const allContent = responses.map(r => r.content).join(' ');
        const words = allContent.toLowerCase().split(/\s+/);
        const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'be', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'and', 'or', 'but', 'this', 'that', 'it', 'you', 'your', 'i', 'we', 'they']);

        const counts: Record<string, number> = {};
        for (const word of words) {
            if (word.length > 4 && !stopWords.has(word)) {
                counts[word] = (counts[word] || 0) + 1;
            }
        }

        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([word]) => word);
    }

    private generateVotes(responses: AuraResponse[]): CouncilVote[] {
        return responses.map(r => ({
            auraId: r.auraId,
            position: r.confidence > 0.8 ? 'support' : r.confidence > 0.6 ? 'neutral' : 'abstain',
            rationale: r.recommendations[0] || 'Based on overall analysis',
            confidence: r.confidence,
        }));
    }

    private generateRecommendation(council: AuraCouncil, votes: CouncilVote[], synthesis?: string): string {
        const supportCount = votes.filter(v => v.position === 'support').length;
        const total = votes.length;

        let prefix = '';
        if (supportCount === total) {
            prefix = `The ${council.name} unanimously recommends: `;
        } else if (supportCount > total / 2) {
            prefix = `The ${council.name} majority recommends: `;
        } else {
            prefix = `The ${council.name} offers mixed perspectives: `;
        }

        return prefix + (synthesis?.substring(0, 300) || 'See individual responses.');
    }

    private getNextClient(): { client: AIClient; provider: AIProvider } {
        const providers = Array.from(this.clients.keys());
        const provider = providers[this.providerIndex % providers.length];
        this.providerIndex++;
        return { client: this.clients.get(provider)!, provider };
    }

    private generateId(): string {
        return `aura_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }
}

// ============================================================================
// Factory
// ============================================================================

let _auraService: AuraService | null = null;

export function getAuraService(): AuraService {
    if (!_auraService) {
        _auraService = new AuraService({
            claude: process.env.ANTHROPIC_API_KEY ? { apiKey: process.env.ANTHROPIC_API_KEY } : undefined,
            gemini: process.env.GEMINI_API_KEY ? { apiKey: process.env.GEMINI_API_KEY } : undefined,
            grok: process.env.GROK_API_KEY ? { apiKey: process.env.GROK_API_KEY } : undefined,
        });
    }
    return _auraService;
}

export function createAuraService(config: AuraServiceConfig): AuraService {
    return new AuraService(config);
}
