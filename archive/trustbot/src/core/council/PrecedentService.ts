/**
 * Precedent Service
 *
 * TRUST-3.7: Records and applies precedents for consistent council decisions.
 * Similar requests get consistent treatment based on past decisions.
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import type {
    Precedent,
    CouncilReview,
    CouncilConfig,
    CouncilEvents,
    CouncilRequestType,
    PrecedentMatch,
} from './types.js';
import { DEFAULT_COUNCIL_CONFIG } from './types.js';

// ============================================================================
// Errors
// ============================================================================

export class PrecedentServiceError extends Error {
    constructor(message: string, public readonly code: string) {
        super(message);
        this.name = 'PrecedentServiceError';
    }
}

// ============================================================================
// Precedent Service
// ============================================================================

export class PrecedentService extends EventEmitter<Pick<CouncilEvents, 'council:precedent-created' | 'council:precedent-applied'>> {
    private precedents: Map<string, Precedent> = new Map();
    private config: CouncilConfig;

    constructor(config: Partial<CouncilConfig> = {}) {
        super();
        this.config = { ...DEFAULT_COUNCIL_CONFIG, ...config };
    }

    /**
     * Create a precedent from a decided review.
     */
    async createFromReview(review: CouncilReview): Promise<Precedent> {
        if (!review.outcome) {
            throw new PrecedentServiceError(
                'Cannot create precedent from undecided review',
                'REVIEW_UNDECIDED'
            );
        }

        // Generalize the context pattern
        const contextPattern = this.generalizeContext(review.context);

        // Calculate average confidence from votes
        const votes = [...review.votes.values()];
        const avgConfidence = votes.length > 0
            ? votes.reduce((sum, v) => sum + v.confidence, 0) / votes.length
            : 0.5;

        const precedent: Precedent = {
            id: uuidv4(),
            requestType: review.requestType,
            contextPattern,
            decision: review.outcome.decision,
            reasoning: review.outcome.reasoning,
            votes: [...votes],
            confidence: avgConfidence,
            createdAt: new Date(),
            appliedCount: 0,
            sourceReviewId: review.id,
            isActive: true,
        };

        this.precedents.set(precedent.id, precedent);
        this.emit('council:precedent-created', precedent);

        return precedent;
    }

    /**
     * Find a matching precedent for a request.
     */
    async findPrecedent(
        requestType: CouncilRequestType,
        context: Record<string, unknown>
    ): Promise<PrecedentMatch | null> {
        // Find precedents of the same type
        const candidates = [...this.precedents.values()].filter(
            p => p.requestType === requestType && p.isActive
        );

        let bestMatch: PrecedentMatch | null = null;

        for (const precedent of candidates) {
            const similarity = this.calculateSimilarity(context, precedent.contextPattern);

            if (similarity > (bestMatch?.similarity ?? 0)) {
                const shouldAutoApply =
                    similarity >= this.config.precedentSimilarityThreshold &&
                    precedent.confidence >= this.config.precedentConfidenceThreshold &&
                    this.config.enablePrecedentAutoApply;

                bestMatch = {
                    precedent,
                    similarity,
                    shouldAutoApply,
                };
            }
        }

        return bestMatch;
    }

    /**
     * Record that a precedent was applied.
     */
    async recordApplication(precedentId: string): Promise<void> {
        const precedent = this.precedents.get(precedentId);
        if (precedent) {
            precedent.appliedCount++;
        }
    }

    /**
     * Get a precedent by ID.
     */
    getPrecedent(id: string): Precedent | undefined {
        return this.precedents.get(id);
    }

    /**
     * Get all precedents.
     */
    getAllPrecedents(): Precedent[] {
        return [...this.precedents.values()];
    }

    /**
     * Get precedents by request type.
     */
    getPrecedentsByType(requestType: CouncilRequestType): Precedent[] {
        return [...this.precedents.values()].filter(
            p => p.requestType === requestType
        );
    }

    /**
     * Get active precedents only.
     */
    getActivePrecedents(): Precedent[] {
        return [...this.precedents.values()].filter(p => p.isActive);
    }

    /**
     * Deactivate a precedent (soft delete).
     */
    deactivatePrecedent(id: string, justification: string): boolean {
        const precedent = this.precedents.get(id);
        if (!precedent) return false;

        precedent.isActive = false;
        precedent.overrideJustification = justification;

        return true;
    }

    /**
     * Reactivate a precedent.
     */
    reactivatePrecedent(id: string): boolean {
        const precedent = this.precedents.get(id);
        if (!precedent) return false;

        precedent.isActive = true;
        delete precedent.overrideJustification;

        return true;
    }

    // -------------------------------------------------------------------------
    // Similarity Calculation
    // -------------------------------------------------------------------------

    /**
     * Calculate similarity between a context and a pattern.
     * Returns a score between 0 and 1.
     */
    calculateSimilarity(
        context: Record<string, unknown>,
        pattern: Record<string, unknown>
    ): number {
        const contextKeys = Object.keys(context);
        const patternKeys = Object.keys(pattern);

        if (patternKeys.length === 0) {
            return 0;
        }

        let matchingKeys = 0;
        let totalWeight = 0;

        for (const key of patternKeys) {
            const weight = this.getKeyWeight(key);
            totalWeight += weight;

            if (key in context) {
                const contextValue = context[key];
                const patternValue = pattern[key];

                const valueSimilarity = this.compareValues(contextValue, patternValue);
                matchingKeys += valueSimilarity * weight;
            }
        }

        // Penalize for extra keys in context that aren't in pattern
        const extraKeys = contextKeys.filter(k => !(k in pattern)).length;
        const extraKeyPenalty = Math.min(0.2, extraKeys * 0.05);

        const baseSimilarity = totalWeight > 0 ? matchingKeys / totalWeight : 0;
        return Math.max(0, baseSimilarity - extraKeyPenalty);
    }

    /**
     * Compare two values for similarity.
     */
    private compareValues(a: unknown, b: unknown): number {
        // Exact match
        if (a === b) return 1;

        // Type mismatch
        if (typeof a !== typeof b) return 0;

        // String similarity
        if (typeof a === 'string' && typeof b === 'string') {
            return this.stringSimilarity(a, b);
        }

        // Number similarity (within 10% is considered similar)
        if (typeof a === 'number' && typeof b === 'number') {
            const diff = Math.abs(a - b);
            const avg = (Math.abs(a) + Math.abs(b)) / 2;
            if (avg === 0) return diff === 0 ? 1 : 0;
            return Math.max(0, 1 - diff / avg);
        }

        // Array similarity
        if (Array.isArray(a) && Array.isArray(b)) {
            return this.arraySimilarity(a, b);
        }

        // Object similarity (recursive)
        if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
            return this.calculateSimilarity(
                a as Record<string, unknown>,
                b as Record<string, unknown>
            );
        }

        return 0;
    }

    /**
     * Calculate string similarity using Jaccard index.
     */
    private stringSimilarity(a: string, b: string): number {
        const setA = new Set(a.toLowerCase().split(/\s+/));
        const setB = new Set(b.toLowerCase().split(/\s+/));

        const intersection = new Set([...setA].filter(x => setB.has(x)));
        const union = new Set([...setA, ...setB]);

        if (union.size === 0) return 1;
        return intersection.size / union.size;
    }

    /**
     * Calculate array similarity.
     */
    private arraySimilarity(a: unknown[], b: unknown[]): number {
        if (a.length === 0 && b.length === 0) return 1;
        if (a.length === 0 || b.length === 0) return 0;

        const setA = new Set(a.map(v => JSON.stringify(v)));
        const setB = new Set(b.map(v => JSON.stringify(v)));

        const intersection = new Set([...setA].filter(x => setB.has(x)));
        const union = new Set([...setA, ...setB]);

        return intersection.size / union.size;
    }

    /**
     * Get weight for a context key (some keys are more important).
     */
    private getKeyWeight(key: string): number {
        // Higher weight for critical keys
        const criticalKeys = ['tier', 'agentType', 'requestType', 'capability'];
        if (criticalKeys.includes(key)) return 2;

        // Normal weight for most keys
        return 1;
    }

    // -------------------------------------------------------------------------
    // Context Generalization
    // -------------------------------------------------------------------------

    /**
     * Generalize a context for pattern matching.
     * Removes overly specific details while keeping important structure.
     */
    private generalizeContext(context: Record<string, unknown>): Record<string, unknown> {
        const generalized: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(context)) {
            // Skip highly specific fields
            if (this.isHighlySpecificKey(key)) continue;

            // Generalize the value
            generalized[key] = this.generalizeValue(value);
        }

        return generalized;
    }

    /**
     * Check if a key is too specific to include in patterns.
     */
    private isHighlySpecificKey(key: string): boolean {
        const specificKeys = ['id', 'timestamp', 'uuid', 'token', 'session'];
        return specificKeys.some(s => key.toLowerCase().includes(s));
    }

    /**
     * Generalize a value for pattern matching.
     */
    private generalizeValue(value: unknown): unknown {
        if (value === null || value === undefined) return value;

        // Keep primitives as-is
        if (typeof value !== 'object') return value;

        // Recursively generalize objects
        if (Array.isArray(value)) {
            return value.map(v => this.generalizeValue(v));
        }

        const obj = value as Record<string, unknown>;
        const generalized: Record<string, unknown> = {};

        for (const [key, val] of Object.entries(obj)) {
            if (!this.isHighlySpecificKey(key)) {
                generalized[key] = this.generalizeValue(val);
            }
        }

        return generalized;
    }

    // -------------------------------------------------------------------------
    // Statistics
    // -------------------------------------------------------------------------

    /**
     * Get precedent statistics.
     */
    getStats(): {
        totalPrecedents: number;
        activePrecedents: number;
        totalApplications: number;
        byRequestType: Record<string, number>;
        avgConfidence: number;
    } {
        const precedents = [...this.precedents.values()];

        const byRequestType: Record<string, number> = {};
        let totalApplications = 0;
        let totalConfidence = 0;
        let activePrecedents = 0;

        for (const p of precedents) {
            byRequestType[p.requestType] = (byRequestType[p.requestType] ?? 0) + 1;
            totalApplications += p.appliedCount;
            totalConfidence += p.confidence;
            if (p.isActive) activePrecedents++;
        }

        return {
            totalPrecedents: precedents.length,
            activePrecedents,
            totalApplications,
            byRequestType,
            avgConfidence: precedents.length > 0
                ? totalConfidence / precedents.length
                : 0,
        };
    }

    // -------------------------------------------------------------------------
    // Configuration
    // -------------------------------------------------------------------------

    /**
     * Get configuration.
     */
    getConfig(): CouncilConfig {
        return { ...this.config };
    }

    /**
     * Update configuration.
     */
    setConfig(config: Partial<CouncilConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Clear all precedents (for testing).
     */
    clear(): void {
        this.precedents.clear();
    }

    /**
     * Import precedents (for persistence).
     */
    import(precedents: Precedent[]): void {
        for (const p of precedents) {
            this.precedents.set(p.id, p);
        }
    }

    /**
     * Export precedents (for persistence).
     */
    export(): Precedent[] {
        return [...this.precedents.values()];
    }
}

// Singleton instance
export const precedentService = new PrecedentService();
