/**
 * T5-Evolver: Adaptive Intelligence
 * 
 * Continuously improves the system through performance analysis,
 * capability evolution, and pattern learning.
 */

import { BaseAgent } from '../agents/BaseAgent.js';
import type { AgentId, AgentLocation, Capability } from '../types.js';
import { blackboard } from '../core/Blackboard.js';
import { trustEngine } from '../core/TrustEngine.js';

const EVOLVER_KNOWLEDGE = {
    role: 'Adaptive Intelligence',
    tier: 5,
    evolutionStrategies: ['Genetic Algorithm', 'Reinforcement Learning', 'Swarm Optimization'],
    performanceMetrics: [
        { name: 'Task Completion Rate', weight: 0.25 },
        { name: 'Trust Score Trend', weight: 0.20 },
        { name: 'Collaboration Score', weight: 0.15 },
        { name: 'Efficiency', weight: 0.15 },
        { name: 'Quality Score', weight: 0.15 },
        { name: 'Innovation Score', weight: 0.10 },
    ],
    baseTraits: ['problem_solving', 'communication', 'collaboration', 'decision_making', 'learning'],
    mutationRate: 0.1,
};

interface PerformanceRecord {
    agentId: AgentId;
    metrics: Record<string, number>;
    timestamp: Date;
    overallScore: number;
}

interface CapabilityGenome {
    agentId: AgentId;
    traits: string[];
    fitness: number;
    generation: number;
}

export class T5Evolver extends BaseAgent {
    private performanceHistory: Map<AgentId, PerformanceRecord[]> = new Map();
    private capabilityGenomes: Map<AgentId, CapabilityGenome> = new Map();
    private evolutionCycle: number = 0;

    constructor() {
        super({
            name: 'T5-EVOLVER',
            type: 'EVOLVER',
            tier: 5,
            parentId: null,
            location: { floor: 'EXECUTIVE', room: 'EVOLVER_OFFICE' },
            capabilities: [
                { id: 'performance_analysis', name: 'Performance Analysis', description: 'Analyze metrics', requiredTier: 5 },
                { id: 'capability_evolution', name: 'Capability Evolution', description: 'Evolve capabilities', requiredTier: 5 },
                { id: 'pattern_learning', name: 'Pattern Learning', description: 'Learn patterns', requiredTier: 5 },
            ],
        });
        this.metadata['knowledge'] = EVOLVER_KNOWLEDGE;
    }

    protected getDefaultLocation(): AgentLocation {
        return { floor: 'EXECUTIVE', room: 'EVOLVER_OFFICE' };
    }

    async initialize(): Promise<void> {
        await super.initialize();
        this.postToBlackboard({
            type: 'OBSERVATION',
            title: 'T5-EVOLVER Online',
            content: { message: 'Adaptive Intelligence initialized' },
            priority: 'HIGH',
        });
    }

    async execute(): Promise<void> {
        while (this.status !== 'TERMINATED') {
            const requests = this.getPendingRequests();
            for (const req of requests) {
                await this.handleRequest(req);
            }
            await this.runEvolutionCycle();
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    recordPerformance(agentId: AgentId, metrics: Record<string, number>): void {
        const score = this.calculateScore(metrics);
        const record: PerformanceRecord = { agentId, metrics, timestamp: new Date(), overallScore: score };

        let history = this.performanceHistory.get(agentId) ?? [];
        history.push(record);
        if (history.length > 100) history = history.slice(-100);
        this.performanceHistory.set(agentId, history);
    }

    private calculateScore(metrics: Record<string, number>): number {
        let score = 0;
        for (const m of EVOLVER_KNOWLEDGE.performanceMetrics) {
            score += (metrics[m.name] ?? 0) * m.weight;
        }
        return Math.round(score);
    }

    getTopPerformers(count: number = 10): AgentId[] {
        const avgScores: Array<{ id: AgentId; score: number }> = [];
        for (const [id, history] of this.performanceHistory) {
            if (history.length > 0) {
                const avg = history.reduce((s, r) => s + r.overallScore, 0) / history.length;
                avgScores.push({ id, score: avg });
            }
        }
        return avgScores.sort((a, b) => b.score - a.score).slice(0, count).map(a => a.id);
    }

    evolveCapabilities(): Capability[] {
        const topPerformers = this.getTopPerformers(5);
        if (topPerformers.length < 2) return [];

        const genomes = topPerformers.map(id => this.capabilityGenomes.get(id)).filter(Boolean) as CapabilityGenome[];
        if (genomes.length < 2) return [];

        // Crossover
        const parent1 = genomes[0]!, parent2 = genomes[1]!;
        const mid = Math.floor(parent1.traits.length / 2);
        const childTraits = [...new Set([...parent1.traits.slice(0, mid), ...parent2.traits.slice(mid)])];

        // Mutation
        const mutated = childTraits.map(t =>
            Math.random() < EVOLVER_KNOWLEDGE.mutationRate
                ? EVOLVER_KNOWLEDGE.baseTraits[Math.floor(Math.random() * EVOLVER_KNOWLEDGE.baseTraits.length)]!
                : t
        );

        this.evolutionCycle++;
        this.makeDecision(`Evolved capabilities in cycle ${this.evolutionCycle}`, `Created from ${topPerformers.length} top performers`);

        return mutated.map(trait => ({
            id: `evolved_${trait}_${Date.now()}`,
            name: `Evolved ${trait}`,
            description: 'Evolved capability',
            requiredTier: 2 as const,
        }));
    }

    private async runEvolutionCycle(): Promise<void> {
        if (this.evolutionCycle % 10 !== 0) {
            this.evolutionCycle++;
            return;
        }
        const stats = trustEngine.getStats();
        if (stats.avgTrust > 500) this.evolveCapabilities();

        const problems = blackboard.getOpenProblems();
        if (problems.length > 5) {
            this.postToBlackboard({
                type: 'HYPOTHESIS',
                title: 'Capability Gap Detected',
                content: { openProblems: problems.length },
                priority: 'MEDIUM',
            });
        }
    }

    private async handleRequest(msg: any): Promise<void> {
        switch (msg.subject) {
            case 'Get Top Performers':
                this.respond(msg.id, { topPerformers: this.getTopPerformers(msg.content?.count ?? 10) });
                break;
            case 'Evolve Capabilities':
                this.respond(msg.id, { newCapabilities: this.evolveCapabilities() });
                break;
            default:
                this.respond(msg.id, { error: 'Unknown request' });
        }
    }
}
