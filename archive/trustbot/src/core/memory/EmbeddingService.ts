/**
 * Embedding Service
 *
 * Generates vector embeddings for semantic search using AI providers.
 * Supports OpenAI text-embedding-ada-002 and Claude embeddings.
 *
 * Epic: Aria Memory & Knowledge System
 * Phase 1: Foundation
 */

import { createHash } from 'crypto';
import type { EmbeddingConfig } from './types.js';

// ============================================================================
// Types
// ============================================================================

export interface EmbeddingResult {
    embedding: number[];
    tokensUsed: number;
    cached: boolean;
}

export interface BatchEmbeddingResult {
    embeddings: number[][];
    totalTokensUsed: number;
    cachedCount: number;
}

// ============================================================================
// Embedding Service
// ============================================================================

export class EmbeddingService {
    private cache: Map<string, number[]> = new Map();
    private config: EmbeddingConfig;
    private openaiApiKey?: string;
    private anthropicApiKey?: string;

    constructor(config?: Partial<EmbeddingConfig>) {
        this.config = {
            provider: config?.provider || 'openai',
            model: config?.model || 'text-embedding-ada-002',
            dimensions: config?.dimensions || 1536,
            batchSize: config?.batchSize || 100,
            cacheEnabled: config?.cacheEnabled ?? true,
        };

        this.openaiApiKey = process.env.OPENAI_API_KEY;
        this.anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    }

    /**
     * Check if embedding service is available (API keys configured)
     */
    isAvailable(): boolean {
        return !!this.openaiApiKey;
    }

    /**
     * Generate embedding for a single text
     */
    async embed(text: string, useCache: boolean = true): Promise<EmbeddingResult> {
        const cacheKey = this.hashText(text);

        // Check cache
        if (useCache && this.config.cacheEnabled && this.cache.has(cacheKey)) {
            return {
                embedding: this.cache.get(cacheKey)!,
                tokensUsed: 0,
                cached: true,
            };
        }

        // Generate embedding
        const result = await this.generateEmbedding(text);

        // Cache result
        if (this.config.cacheEnabled) {
            this.cache.set(cacheKey, result.embedding);
        }

        return {
            ...result,
            cached: false,
        };
    }

    /**
     * Generate embeddings for multiple texts in batches
     */
    async embedBatch(texts: string[]): Promise<BatchEmbeddingResult> {
        const results: number[][] = [];
        let totalTokensUsed = 0;
        let cachedCount = 0;

        // Process in batches
        for (let i = 0; i < texts.length; i += this.config.batchSize) {
            const batch = texts.slice(i, i + this.config.batchSize);
            const uncachedTexts: { index: number; text: string }[] = [];
            const batchResults: (number[] | null)[] = new Array(batch.length).fill(null);

            // Check cache for each text
            for (let j = 0; j < batch.length; j++) {
                const text = batch[j]!;
                const cacheKey = this.hashText(text);
                if (this.config.cacheEnabled && this.cache.has(cacheKey)) {
                    batchResults[j] = this.cache.get(cacheKey)!;
                    cachedCount++;
                } else {
                    uncachedTexts.push({ index: j, text });
                }
            }

            // Generate embeddings for uncached texts
            if (uncachedTexts.length > 0) {
                const embeddings = await this.generateBatchEmbeddings(
                    uncachedTexts.map((t) => t.text)
                );

                for (let k = 0; k < uncachedTexts.length; k++) {
                    const item = uncachedTexts[k]!;
                    const embedding = embeddings.embeddings[k]!;
                    batchResults[item.index] = embedding;
                    totalTokensUsed += embeddings.tokensPerText[k] || 0;

                    // Cache result
                    if (this.config.cacheEnabled) {
                        this.cache.set(this.hashText(item.text), embedding);
                    }
                }
            }

            results.push(...(batchResults as number[][]));
        }

        return {
            embeddings: results,
            totalTokensUsed,
            cachedCount,
        };
    }

    /**
     * Calculate cosine similarity between two embeddings
     */
    cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) {
            throw new Error('Embeddings must have the same dimensions');
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            const aVal = a[i]!;
            const bVal = b[i]!;
            dotProduct += aVal * bVal;
            normA += aVal * aVal;
            normB += bVal * bVal;
        }

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * Find most similar embeddings from a list
     */
    findSimilar(
        queryEmbedding: number[],
        candidates: { id: string; embedding: number[] }[],
        topK: number = 10,
        threshold: number = 0.7
    ): { id: string; similarity: number }[] {
        const results = candidates
            .map((candidate) => ({
                id: candidate.id,
                similarity: this.cosineSimilarity(queryEmbedding, candidate.embedding),
            }))
            .filter((r) => r.similarity >= threshold)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, topK);

        return results;
    }

    /**
     * Clear the embedding cache
     */
    clearCache(): void {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { size: number; memoryBytes: number } {
        let memoryBytes = 0;
        const values = Array.from(this.cache.values());
        for (let i = 0; i < values.length; i++) {
            memoryBytes += values[i]!.length * 8; // 8 bytes per float64
        }

        return {
            size: this.cache.size,
            memoryBytes,
        };
    }

    // ========================================================================
    // Private Methods
    // ========================================================================

    private hashText(text: string): string {
        return createHash('sha256').update(text).digest('hex');
    }

    private async generateEmbedding(text: string): Promise<{ embedding: number[]; tokensUsed: number }> {
        if (this.config.provider === 'openai') {
            return this.generateOpenAIEmbedding(text);
        } else {
            // For Claude, we'd use a different approach
            // Claude doesn't have a native embedding API, so we'd use OpenAI or a local model
            return this.generateOpenAIEmbedding(text);
        }
    }

    private async generateBatchEmbeddings(
        texts: string[]
    ): Promise<{ embeddings: number[][]; tokensPerText: number[] }> {
        if (this.config.provider === 'openai') {
            return this.generateOpenAIBatchEmbeddings(texts);
        } else {
            return this.generateOpenAIBatchEmbeddings(texts);
        }
    }

    private async generateOpenAIEmbedding(
        text: string
    ): Promise<{ embedding: number[]; tokensUsed: number }> {
        if (!this.openaiApiKey) {
            throw new Error('OPENAI_API_KEY not configured for embedding service');
        }

        const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.openaiApiKey}`,
            },
            body: JSON.stringify({
                model: this.config.model,
                input: text,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI embedding failed: ${error}`);
        }

        interface OpenAIEmbeddingResponse {
            data: Array<{ embedding: number[]; index: number }>;
            usage?: { total_tokens: number };
        }

        const data = (await response.json()) as OpenAIEmbeddingResponse;
        return {
            embedding: data.data[0]!.embedding,
            tokensUsed: data.usage?.total_tokens || 0,
        };
    }

    private async generateOpenAIBatchEmbeddings(
        texts: string[]
    ): Promise<{ embeddings: number[][]; tokensPerText: number[] }> {
        if (!this.openaiApiKey) {
            throw new Error('OPENAI_API_KEY not configured for embedding service');
        }

        const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.openaiApiKey}`,
            },
            body: JSON.stringify({
                model: this.config.model,
                input: texts,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI batch embedding failed: ${error}`);
        }

        interface OpenAIEmbeddingResponse {
            data: Array<{ embedding: number[]; index: number }>;
            usage?: { total_tokens: number };
        }

        const data = (await response.json()) as OpenAIEmbeddingResponse;

        // Sort by index to maintain order
        const sortedData = data.data.sort((a, b) => a.index - b.index);

        return {
            embeddings: sortedData.map((d) => d.embedding),
            tokensPerText: sortedData.map(() => Math.floor((data.usage?.total_tokens || 0) / texts.length)),
        };
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let embeddingServiceInstance: EmbeddingService | null = null;

export function getEmbeddingService(config?: Partial<EmbeddingConfig>): EmbeddingService {
    if (!embeddingServiceInstance) {
        embeddingServiceInstance = new EmbeddingService(config);
    }
    return embeddingServiceInstance;
}

export function resetEmbeddingService(): void {
    embeddingServiceInstance = null;
}
