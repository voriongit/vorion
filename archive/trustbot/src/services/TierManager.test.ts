/**
 * TierManager Tests
 *
 * Epic 11: Live Trust Scoring Engine
 * Story 11.3: Automatic Tier Management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    TierManager,
    TierLevel,
    TierCapability,
    DEFAULT_TIERS,
    resetTierManager,
} from './TierManager.js';

describe('TierManager', () => {
    let manager: TierManager;

    beforeEach(() => {
        vi.useFakeTimers();
        resetTierManager();
        manager = new TierManager({
            allowDemotion: true,
            demotionGracePeriodMs: 0,
            hysteresisPoints: 10,
        });
    });

    afterEach(() => {
        manager.clear();
        vi.useRealTimers();
    });

    // =========================================================================
    // Tier Calculation
    // =========================================================================

    describe('Tier Calculation', () => {
        it('should get correct tier for score 0', () => {
            const tier = manager.getTierForScore(0);
            expect(tier.level).toBe('UNTRUSTED');
        });

        it('should get correct tier for score 199', () => {
            const tier = manager.getTierForScore(199);
            expect(tier.level).toBe('UNTRUSTED');
        });

        it('should get PROBATIONARY for score 200', () => {
            const tier = manager.getTierForScore(200);
            expect(tier.level).toBe('PROBATIONARY');
        });

        it('should get TRUSTED for score 400', () => {
            const tier = manager.getTierForScore(400);
            expect(tier.level).toBe('TRUSTED');
        });

        it('should get VERIFIED for score 600', () => {
            const tier = manager.getTierForScore(600);
            expect(tier.level).toBe('VERIFIED');
        });

        it('should get CERTIFIED for score 800', () => {
            const tier = manager.getTierForScore(800);
            expect(tier.level).toBe('CERTIFIED');
        });

        it('should get ELITE for score 950', () => {
            const tier = manager.getTierForScore(950);
            expect(tier.level).toBe('ELITE');
        });

        it('should get ELITE for score 1000', () => {
            const tier = manager.getTierForScore(1000);
            expect(tier.level).toBe('ELITE');
        });
    });

    // =========================================================================
    // Tier Updates
    // =========================================================================

    describe('Tier Updates', () => {
        it('should promote agent when score increases', () => {
            manager.initializeAgent('agent_1', 'org_1', 300); // PROBATIONARY

            const change = manager.updateAgentTier('agent_1', 'org_1', 450);

            expect(change).not.toBeNull();
            expect(change?.previousTier).toBe('PROBATIONARY');
            expect(change?.newTier).toBe('TRUSTED');
            expect(change?.direction).toBe('promotion');
        });

        it('should demote agent when score decreases', () => {
            manager.initializeAgent('agent_1', 'org_1', 450); // TRUSTED

            const change = manager.updateAgentTier('agent_1', 'org_1', 350);

            expect(change).not.toBeNull();
            expect(change?.previousTier).toBe('TRUSTED');
            expect(change?.newTier).toBe('PROBATIONARY');
            expect(change?.direction).toBe('demotion');
        });

        it('should return null when tier unchanged', () => {
            manager.initializeAgent('agent_1', 'org_1', 450); // TRUSTED

            const change = manager.updateAgentTier('agent_1', 'org_1', 480);

            expect(change).toBeNull();
        });

        it('should emit tier:changed event', () => {
            manager.initializeAgent('agent_1', 'org_1', 300);

            const changes: any[] = [];
            manager.on('tier:changed', (c) => changes.push(c));

            manager.updateAgentTier('agent_1', 'org_1', 450);

            expect(changes.length).toBe(1);
            expect(changes[0].direction).toBe('promotion');
        });

        it('should emit tier:promotion event', () => {
            manager.initializeAgent('agent_1', 'org_1', 300);

            const promotions: any[] = [];
            manager.on('tier:promotion', (c) => promotions.push(c));

            manager.updateAgentTier('agent_1', 'org_1', 450);

            expect(promotions.length).toBe(1);
        });

        it('should emit tier:demotion event', () => {
            manager.initializeAgent('agent_1', 'org_1', 450);

            const demotions: any[] = [];
            manager.on('tier:demotion', (c) => demotions.push(c));

            manager.updateAgentTier('agent_1', 'org_1', 350);

            expect(demotions.length).toBe(1);
        });
    });

    // =========================================================================
    // Hysteresis
    // =========================================================================

    describe('Hysteresis', () => {
        it('should not demote within hysteresis zone', () => {
            manager.initializeAgent('agent_1', 'org_1', 410); // TRUSTED

            // Score drops but still within hysteresis zone (400 - 10 = 390)
            const change = manager.updateAgentTier('agent_1', 'org_1', 395);

            expect(change).toBeNull(); // No demotion yet
        });

        it('should demote below hysteresis zone', () => {
            manager.initializeAgent('agent_1', 'org_1', 410); // TRUSTED

            // Score drops below hysteresis zone
            const change = manager.updateAgentTier('agent_1', 'org_1', 380);

            expect(change).not.toBeNull();
            expect(change?.newTier).toBe('PROBATIONARY');
        });

        it('should emit warning when approaching demotion', () => {
            manager.initializeAgent('agent_1', 'org_1', 410);

            const warnings: any[] = [];
            manager.on('tier:warning', (id, msg) => warnings.push({ id, msg }));

            manager.updateAgentTier('agent_1', 'org_1', 395);

            expect(warnings.length).toBe(1);
            expect(warnings[0].msg).toContain('approaching demotion');
        });
    });

    // =========================================================================
    // Grace Period
    // =========================================================================

    describe('Demotion Grace Period', () => {
        it('should delay demotion with grace period', () => {
            const graceManager = new TierManager({
                allowDemotion: true,
                demotionGracePeriodMs: 5000,
                hysteresisPoints: 0,
            });

            graceManager.initializeAgent('agent_1', 'org_1', 450);

            // Score drops below threshold
            const change = graceManager.updateAgentTier('agent_1', 'org_1', 350);

            expect(change).toBeNull(); // Demotion scheduled, not applied yet
            expect(graceManager.getAgentTier('agent_1')).toBe('TRUSTED'); // Still trusted

            // After grace period
            vi.advanceTimersByTime(6000);

            expect(graceManager.getAgentTier('agent_1')).toBe('PROBATIONARY');

            graceManager.clear();
        });

        it('should cancel demotion if score recovers', () => {
            const graceManager = new TierManager({
                allowDemotion: true,
                demotionGracePeriodMs: 5000,
                hysteresisPoints: 0,
            });

            graceManager.initializeAgent('agent_1', 'org_1', 450);
            graceManager.updateAgentTier('agent_1', 'org_1', 350); // Schedule demotion

            // Score recovers before grace period ends
            vi.advanceTimersByTime(2000);
            graceManager.updateAgentTier('agent_1', 'org_1', 500); // Promote

            // Wait for original grace period
            vi.advanceTimersByTime(4000);

            expect(graceManager.getAgentTier('agent_1')).toBe('TRUSTED'); // Promoted, not demoted

            graceManager.clear();
        });
    });

    // =========================================================================
    // Demotion Control
    // =========================================================================

    describe('Demotion Control', () => {
        it('should block demotion when disabled', () => {
            const noDemotionManager = new TierManager({
                allowDemotion: false,
                hysteresisPoints: 0,
            });

            noDemotionManager.initializeAgent('agent_1', 'org_1', 450);
            const change = noDemotionManager.updateAgentTier('agent_1', 'org_1', 350);

            expect(change).toBeNull();
            expect(noDemotionManager.getAgentTier('agent_1')).toBe('TRUSTED');

            noDemotionManager.clear();
        });
    });

    // =========================================================================
    // Agent State
    // =========================================================================

    describe('Agent State', () => {
        it('should initialize agent at correct tier', () => {
            const state = manager.initializeAgent('agent_1', 'org_1', 450);

            expect(state.currentTier).toBe('TRUSTED');
            expect(state.capabilities).toContain('execute');
        });

        it('should get agent state', () => {
            manager.initializeAgent('agent_1', 'org_1', 450);

            const state = manager.getAgentState('agent_1');

            expect(state).not.toBeNull();
            expect(state?.currentScore).toBe(450);
        });

        it('should get agent tier', () => {
            manager.initializeAgent('agent_1', 'org_1', 450);

            expect(manager.getAgentTier('agent_1')).toBe('TRUSTED');
        });

        it('should return null for unknown agent', () => {
            expect(manager.getAgentState('unknown')).toBeNull();
            expect(manager.getAgentTier('unknown')).toBeNull();
        });

        it('should remove agent', () => {
            manager.initializeAgent('agent_1', 'org_1', 450);

            const removed = manager.removeAgent('agent_1');

            expect(removed).toBe(true);
            expect(manager.getAgentState('agent_1')).toBeNull();
        });

        it('should track previous tier after change', () => {
            manager.initializeAgent('agent_1', 'org_1', 350);
            manager.updateAgentTier('agent_1', 'org_1', 450);

            const state = manager.getAgentState('agent_1');

            expect(state?.previousTier).toBe('PROBATIONARY');
            expect(state?.currentTier).toBe('TRUSTED');
        });
    });

    // =========================================================================
    // Capabilities
    // =========================================================================

    describe('Capabilities', () => {
        it('should check if agent has capability', () => {
            manager.initializeAgent('agent_1', 'org_1', 650); // VERIFIED

            expect(manager.hasCapability('agent_1', 'execute')).toBe(true);
            expect(manager.hasCapability('agent_1', 'delegate')).toBe(true);
            expect(manager.hasCapability('agent_1', 'spawn')).toBe(false);
        });

        it('should return false for unknown agent', () => {
            expect(manager.hasCapability('unknown', 'execute')).toBe(false);
        });

        it('should get max concurrent tasks', () => {
            manager.initializeAgent('agent_1', 'org_1', 450); // TRUSTED - 3 tasks
            manager.initializeAgent('agent_2', 'org_1', 850); // CERTIFIED - 10 tasks
            manager.initializeAgent('agent_3', 'org_1', 975); // ELITE - unlimited

            expect(manager.getMaxConcurrentTasks('agent_1')).toBe(3);
            expect(manager.getMaxConcurrentTasks('agent_2')).toBe(10);
            expect(manager.getMaxConcurrentTasks('agent_3')).toBe(-1);
        });

        it('should update capabilities on tier change', () => {
            manager.initializeAgent('agent_1', 'org_1', 450);

            expect(manager.hasCapability('agent_1', 'delegate')).toBe(false);

            manager.updateAgentTier('agent_1', 'org_1', 650);

            expect(manager.hasCapability('agent_1', 'delegate')).toBe(true);
        });
    });

    // =========================================================================
    // Tier Definitions
    // =========================================================================

    describe('Tier Definitions', () => {
        it('should get tier definition', () => {
            const tier = manager.getTierDefinition('VERIFIED');

            expect(tier).not.toBeNull();
            expect(tier?.minScore).toBe(600);
            expect(tier?.maxScore).toBe(799);
        });

        it('should get all tier definitions', () => {
            const tiers = manager.getAllTiers();

            expect(tiers.length).toBe(6);
        });

        it('should support org-specific tiers', () => {
            manager.setOrgTiers('org_1', [
                { level: 'UNTRUSTED', minScore: 0, maxScore: 299, capabilities: [], maxConcurrentTasks: 0, description: '' },
                { level: 'PROBATIONARY', minScore: 300, maxScore: 599, capabilities: ['execute'], maxConcurrentTasks: 1, description: '' },
                { level: 'TRUSTED', minScore: 600, maxScore: 1000, capabilities: ['execute', 'delegate'], maxConcurrentTasks: 5, description: '' },
            ]);

            // Score 500 is PROBATIONARY in custom config (vs TRUSTED in default)
            const tier = manager.getTierForScore(500, 'org_1');
            expect(tier.level).toBe('PROBATIONARY');

            // Default config still works for other orgs
            const defaultTier = manager.getTierForScore(500);
            expect(defaultTier.level).toBe('TRUSTED');
        });
    });

    // =========================================================================
    // Bulk Operations
    // =========================================================================

    describe('Bulk Operations', () => {
        it('should get agents in a tier', () => {
            manager.initializeAgent('agent_1', 'org_1', 450);
            manager.initializeAgent('agent_2', 'org_1', 450);
            manager.initializeAgent('agent_3', 'org_1', 650);

            const trusted = manager.getAgentsInTier('TRUSTED');

            expect(trusted.length).toBe(2);
        });

        it('should filter agents by org', () => {
            manager.initializeAgent('agent_1', 'org_1', 450);
            manager.initializeAgent('agent_2', 'org_2', 450);

            const trusted = manager.getAgentsInTier('TRUSTED', 'org_1');

            expect(trusted.length).toBe(1);
            expect(trusted[0].agentId).toBe('agent_1');
        });

        it('should get tier distribution', () => {
            manager.initializeAgent('agent_1', 'org_1', 100);
            manager.initializeAgent('agent_2', 'org_1', 450);
            manager.initializeAgent('agent_3', 'org_1', 450);
            manager.initializeAgent('agent_4', 'org_1', 950);

            const dist = manager.getTierDistribution();

            expect(dist.UNTRUSTED).toBe(1);
            expect(dist.TRUSTED).toBe(2);
            expect(dist.ELITE).toBe(1);
        });

        it('should get agents with capability', () => {
            manager.initializeAgent('agent_1', 'org_1', 450); // execute only
            manager.initializeAgent('agent_2', 'org_1', 650); // execute + delegate
            manager.initializeAgent('agent_3', 'org_1', 850); // execute + delegate + spawn

            const delegators = manager.getAgentsWithCapability('delegate');

            expect(delegators.length).toBe(2);
        });
    });

    // =========================================================================
    // Statistics
    // =========================================================================

    describe('Statistics', () => {
        it('should get stats', () => {
            manager.initializeAgent('agent_1', 'org_1', 400);
            manager.initializeAgent('agent_2', 'org_1', 600);
            manager.initializeAgent('agent_3', 'org_1', 800);

            const stats = manager.getStats();

            expect(stats.totalAgents).toBe(3);
            expect(stats.averageScore).toBe(600);
            expect(stats.distribution.TRUSTED).toBe(1);
            expect(stats.distribution.VERIFIED).toBe(1);
            expect(stats.distribution.CERTIFIED).toBe(1);
        });

        it('should filter stats by org', () => {
            manager.initializeAgent('agent_1', 'org_1', 400);
            manager.initializeAgent('agent_2', 'org_2', 600);

            const stats = manager.getStats('org_1');

            expect(stats.totalAgents).toBe(1);
        });
    });

    // =========================================================================
    // Default Tiers
    // =========================================================================

    describe('Default Tier Configuration', () => {
        it('should have 6 default tiers', () => {
            expect(DEFAULT_TIERS.length).toBe(6);
        });

        it('should have correct tier order', () => {
            const levels = DEFAULT_TIERS.map(t => t.level);
            expect(levels).toEqual([
                'UNTRUSTED',
                'PROBATIONARY',
                'TRUSTED',
                'VERIFIED',
                'CERTIFIED',
                'ELITE',
            ]);
        });

        it('should have no overlapping score ranges', () => {
            for (let i = 1; i < DEFAULT_TIERS.length; i++) {
                expect(DEFAULT_TIERS[i].minScore).toBeGreaterThan(DEFAULT_TIERS[i - 1].maxScore);
            }
        });
    });

    // =========================================================================
    // Lifecycle
    // =========================================================================

    describe('Lifecycle', () => {
        it('should clear all state', () => {
            manager.initializeAgent('agent_1', 'org_1', 450);
            manager.initializeAgent('agent_2', 'org_1', 650);

            manager.clear();

            expect(manager.getAgentState('agent_1')).toBeNull();
            expect(manager.getAgentState('agent_2')).toBeNull();
        });
    });
});
