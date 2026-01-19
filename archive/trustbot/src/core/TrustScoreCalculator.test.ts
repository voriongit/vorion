/**
 * TrustScoreCalculator Tests
 *
 * Tests for TRUST-1.2 through TRUST-1.7: Multi-component trust scoring.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TrustScoreCalculator } from './TrustScoreCalculator.js';
import { COMPONENT_WEIGHTS, SCORE_RANGE } from './types/trust.js';

describe('TrustScoreCalculator', () => {
    let calculator: TrustScoreCalculator;

    beforeEach(() => {
        calculator = new TrustScoreCalculator();
    });

    // =========================================================================
    // TRUST-1.2: Decision Accuracy Calculator
    // =========================================================================

    describe('calculateDecisionAccuracy', () => {
        it('should return neutral score (50) for empty data', () => {
            const result = calculator.calculateDecisionAccuracy([]);

            expect(result.raw).toBe(50);
            expect(result.samples).toBe(0);
            expect(result.confidence).toBe(0);
        });

        it('should calculate 100% approval rate correctly', () => {
            const data = [
                { approved: 100, rejected: 0, riskLevel: 'low' as const },
            ];

            const result = calculator.calculateDecisionAccuracy(data);

            expect(result.raw).toBe(100);
            expect(result.samples).toBe(100);
            expect(result.confidence).toBe(1);
        });

        it('should calculate 50% approval rate correctly', () => {
            const data = [
                { approved: 50, rejected: 50, riskLevel: 'low' as const },
            ];

            const result = calculator.calculateDecisionAccuracy(data);

            expect(result.raw).toBe(50);
            expect(result.samples).toBe(100);
        });

        it('should apply risk weighting correctly', () => {
            // High risk tasks are weighted 2x
            const lowRisk = [{ approved: 50, rejected: 50, riskLevel: 'low' as const }];
            const highRisk = [{ approved: 50, rejected: 50, riskLevel: 'high' as const }];

            const lowResult = calculator.calculateDecisionAccuracy(lowRisk);
            const highResult = calculator.calculateDecisionAccuracy(highRisk);

            // Both should be 50% because same approval ratio
            expect(lowResult.raw).toBe(50);
            expect(highResult.raw).toBe(50);
        });

        it('should weight multiple risk levels correctly', () => {
            // Mix of risk levels
            const data = [
                { approved: 10, rejected: 0, riskLevel: 'low' as const },      // 10 * 1 = 10 approved
                { approved: 10, rejected: 10, riskLevel: 'critical' as const }, // 10 * 3 = 30 approved, 10 * 3 = 30 rejected
            ];

            const result = calculator.calculateDecisionAccuracy(data);

            // Weighted: (10*1 + 10*3) / (10*1 + 20*3) = 40 / 70 = 57%
            expect(result.raw).toBe(57);
        });

        it('should calculate confidence based on sample size', () => {
            const small = [{ approved: 10, rejected: 0, riskLevel: 'low' as const }];
            const large = [{ approved: 100, rejected: 0, riskLevel: 'low' as const }];

            const smallResult = calculator.calculateDecisionAccuracy(small);
            const largeResult = calculator.calculateDecisionAccuracy(large);

            expect(smallResult.confidence).toBe(0.1);
            expect(largeResult.confidence).toBe(1);
        });

        it('should apply correct weight to result', () => {
            const data = [{ approved: 100, rejected: 0, riskLevel: 'low' as const }];
            const result = calculator.calculateDecisionAccuracy(data);

            expect(result.weighted).toBe(100 * COMPONENT_WEIGHTS.decisionAccuracy);
        });
    });

    // =========================================================================
    // TRUST-1.3: Ethics Compliance Calculator
    // =========================================================================

    describe('calculateEthicsCompliance', () => {
        it('should return 100 for no violations', () => {
            const result = calculator.calculateEthicsCompliance({
                violations: 0,
                escalations: 0,
            });

            expect(result.raw).toBe(100);
            expect(result.confidence).toBe(1);
        });

        it('should deduct 10 points per violation', () => {
            const result = calculator.calculateEthicsCompliance({
                violations: 5,
                escalations: 0,
            });

            expect(result.raw).toBe(50);
        });

        it('should deduct 5 points per escalation', () => {
            const result = calculator.calculateEthicsCompliance({
                violations: 0,
                escalations: 4,
            });

            expect(result.raw).toBe(80);
        });

        it('should combine violation and escalation penalties', () => {
            const result = calculator.calculateEthicsCompliance({
                violations: 2,  // -20
                escalations: 4, // -20
            });

            expect(result.raw).toBe(60);
        });

        it('should floor at 0', () => {
            const result = calculator.calculateEthicsCompliance({
                violations: 15,
                escalations: 0,
            });

            expect(result.raw).toBe(0);
        });

        it('should have full confidence always', () => {
            const result = calculator.calculateEthicsCompliance({
                violations: 5,
                escalations: 3,
            });

            expect(result.confidence).toBe(1);
        });
    });

    // =========================================================================
    // TRUST-1.4: Task Success Calculator
    // =========================================================================

    describe('calculateTaskSuccess', () => {
        it('should return neutral score for no tasks', () => {
            const result = calculator.calculateTaskSuccess({
                completed: 0,
                failed: 0,
            });

            expect(result.raw).toBe(50);
            expect(result.confidence).toBe(0);
        });

        it('should calculate 100% success rate', () => {
            const result = calculator.calculateTaskSuccess({
                completed: 100,
                failed: 0,
            });

            expect(result.raw).toBe(100);
        });

        it('should calculate 50% success rate', () => {
            const result = calculator.calculateTaskSuccess({
                completed: 50,
                failed: 50,
            });

            expect(result.raw).toBe(50);
        });

        it('should calculate 0% success rate', () => {
            const result = calculator.calculateTaskSuccess({
                completed: 0,
                failed: 100,
            });

            expect(result.raw).toBe(0);
        });

        it('should calculate confidence correctly', () => {
            const small = calculator.calculateTaskSuccess({ completed: 10, failed: 10 });
            const large = calculator.calculateTaskSuccess({ completed: 25, failed: 25 });

            expect(small.confidence).toBe(0.4);
            expect(large.confidence).toBe(1);
        });
    });

    // =========================================================================
    // TRUST-1.5: Operational Stability Calculator
    // =========================================================================

    describe('calculateOperationalStability', () => {
        it('should return 100 for no errors and fast response', () => {
            const result = calculator.calculateOperationalStability({
                errors: 0,
                avgResponseTimeMs: 200,
            });

            expect(result.raw).toBe(100);
        });

        it('should deduct 5 points per error', () => {
            const result = calculator.calculateOperationalStability({
                errors: 5,
                avgResponseTimeMs: 200,
            });

            expect(result.raw).toBe(75);
        });

        it('should cap error penalty at 50', () => {
            const result = calculator.calculateOperationalStability({
                errors: 20,
                avgResponseTimeMs: 200,
            });

            expect(result.raw).toBe(50);
        });

        it('should deduct for slow response times', () => {
            const result = calculator.calculateOperationalStability({
                errors: 0,
                avgResponseTimeMs: 1000, // 500ms above baseline
            });

            expect(result.raw).toBe(95); // -5 points
        });

        it('should combine error and response penalties', () => {
            const result = calculator.calculateOperationalStability({
                errors: 5,    // -25 points
                avgResponseTimeMs: 1000, // -5 points
            });

            expect(result.raw).toBe(70);
        });

        it('should floor at 0', () => {
            const result = calculator.calculateOperationalStability({
                errors: 10,
                avgResponseTimeMs: 10000,
            });

            expect(result.raw).toBe(0);
        });
    });

    // =========================================================================
    // TRUST-1.6: Peer Reviews Calculator
    // =========================================================================

    describe('calculatePeerReviews', () => {
        it('should return 0 for no contributions', () => {
            const result = calculator.calculatePeerReviews({
                endorsements: 0,
                resolvedSolutions: 0,
                totalContributions: 0,
            });

            expect(result.raw).toBe(0);
            expect(result.confidence).toBe(0);
        });

        it('should award 5 points per endorsement', () => {
            const result = calculator.calculatePeerReviews({
                endorsements: 10,
                resolvedSolutions: 0,
                totalContributions: 10,
            });

            expect(result.raw).toBe(50);
        });

        it('should award 20 points per resolved solution', () => {
            const result = calculator.calculatePeerReviews({
                endorsements: 0,
                resolvedSolutions: 3,
                totalContributions: 3,
            });

            expect(result.raw).toBe(60);
        });

        it('should cap at 100', () => {
            const result = calculator.calculatePeerReviews({
                endorsements: 50,
                resolvedSolutions: 10,
                totalContributions: 60,
            });

            expect(result.raw).toBe(100);
        });

        it('should calculate confidence based on contribution count', () => {
            const small = calculator.calculatePeerReviews({
                endorsements: 5,
                resolvedSolutions: 0,
                totalContributions: 5,
            });
            const large = calculator.calculatePeerReviews({
                endorsements: 10,
                resolvedSolutions: 0,
                totalContributions: 20,
            });

            expect(small.confidence).toBe(0.25);
            expect(large.confidence).toBe(1);
        });
    });

    // =========================================================================
    // TRUST-1.7: Weighted Score Aggregation
    // =========================================================================

    describe('aggregateScore', () => {
        const makeComponents = (raw: number) => ({
            decisionAccuracy: { raw, weighted: raw * 0.35, samples: 100, confidence: 1, lastUpdated: new Date() },
            ethicsCompliance: { raw, weighted: raw * 0.25, samples: 0, confidence: 1, lastUpdated: new Date() },
            taskSuccess: { raw, weighted: raw * 0.20, samples: 50, confidence: 1, lastUpdated: new Date() },
            operationalStability: { raw, weighted: raw * 0.15, samples: 0, confidence: 1, lastUpdated: new Date() },
            peerReviews: { raw, weighted: raw * 0.05, samples: 20, confidence: 1, lastUpdated: new Date() },
        });

        it('should return 300 for all 0 scores', () => {
            const components = makeComponents(0);
            const result = calculator.aggregateScore(components);

            expect(result.ficoScore).toBe(SCORE_RANGE.min);
            // 300 is the minimum FICO score, which falls in WORKER tier (300-449)
            expect(result.level).toBe('WORKER');
        });

        it('should return 1000 for all 100 scores', () => {
            const components = makeComponents(100);
            const result = calculator.aggregateScore(components);

            expect(result.ficoScore).toBe(SCORE_RANGE.max);
            expect(result.level).toBe('SOVEREIGN');
        });

        it('should return middle score for all 50 scores', () => {
            const components = makeComponents(50);
            const result = calculator.aggregateScore(components);

            // 300 + (50/100) * 700 = 300 + 350 = 650
            expect(result.ficoScore).toBe(650);
            expect(result.level).toBe('TACTICAL');
        });

        it('should apply inheritance bonus', () => {
            const components = makeComponents(50);
            const inherited = 100;

            const result = calculator.aggregateScore(components, inherited);

            // Base: 650, Inheritance bonus: 100 * 0.8 = 80
            expect(result.ficoScore).toBe(730);
        });

        it('should apply penalties', () => {
            const components = makeComponents(50);
            const penalties = 50;

            const result = calculator.aggregateScore(components, 0, penalties);

            // Base: 650, Penalty: -50
            expect(result.ficoScore).toBe(600);
        });

        it('should clamp to min score', () => {
            const components = makeComponents(0);
            const penalties = 500;

            const result = calculator.aggregateScore(components, 0, penalties);

            expect(result.ficoScore).toBe(SCORE_RANGE.min);
        });

        it('should clamp to max score', () => {
            const components = makeComponents(100);
            const inherited = 500;

            const result = calculator.aggregateScore(components, inherited);

            expect(result.ficoScore).toBe(SCORE_RANGE.max);
        });

        it('should map scores to correct levels', () => {
            // Raw component scores map to FICO scores via: 300 + (raw/100) * 700
            // Then FICO scores map to levels:
            // SOVEREIGN: 900-1000, EXECUTIVE: 750-899, TACTICAL: 600-749
            // OPERATIONAL: 450-599, WORKER: 300-449, PASSIVE: 0-299 (unreachable with min 300)
            const testCases = [
                { score: 0, expected: 'WORKER' },       // 300 FICO -> WORKER
                { score: 30, expected: 'OPERATIONAL' },// 510 FICO -> OPERATIONAL
                { score: 50, expected: 'TACTICAL' },   // 650 FICO -> TACTICAL
                { score: 65, expected: 'EXECUTIVE' },  // 755 FICO -> EXECUTIVE
                { score: 80, expected: 'EXECUTIVE' },  // 860 FICO -> EXECUTIVE
                { score: 100, expected: 'SOVEREIGN' }, // 1000 FICO -> SOVEREIGN
            ];

            for (const { score, expected } of testCases) {
                const components = makeComponents(score);
                const result = calculator.aggregateScore(components);
                expect(result.level).toBe(expected);
            }
        });
    });

    // =========================================================================
    // Full Score Calculation
    // =========================================================================

    describe('calculateFullScore', () => {
        it('should calculate complete enhanced score', () => {
            const result = calculator.calculateFullScore(
                'agent-1',
                {
                    decisionAccuracy: [{ approved: 80, rejected: 20, riskLevel: 'low' }],
                    ethicsCompliance: { violations: 1, escalations: 0 },
                    taskSuccess: { completed: 90, failed: 10 },
                    operationalStability: { errors: 2, avgResponseTimeMs: 300 },
                    peerReviews: { endorsements: 10, resolvedSolutions: 2, totalContributions: 15 },
                }
            );

            expect(result.ficoScore).toBeGreaterThan(SCORE_RANGE.min);
            expect(result.ficoScore).toBeLessThanOrEqual(SCORE_RANGE.max);
            expect(result.components).toBeDefined();
            expect(result.components.decisionAccuracy.raw).toBe(80);
            expect(result.components.ethicsCompliance.raw).toBe(90);
            expect(result.components.taskSuccess.raw).toBe(90);
            expect(result.trend).toBeDefined();
            expect(result.overallConfidence).toBeGreaterThan(0);
        });

        it('should emit score:calculated event', () => {
            let emittedScore: any;
            calculator.on('score:calculated', (agentId, score) => {
                emittedScore = { agentId, score };
            });

            calculator.calculateFullScore(
                'agent-1',
                {
                    decisionAccuracy: [],
                    ethicsCompliance: { violations: 0, escalations: 0 },
                    taskSuccess: { completed: 0, failed: 0 },
                    operationalStability: { errors: 0, avgResponseTimeMs: 100 },
                    peerReviews: { endorsements: 0, resolvedSolutions: 0, totalContributions: 0 },
                }
            );

            expect(emittedScore.agentId).toBe('agent-1');
            expect(emittedScore.score).toBeDefined();
        });
    });

    // =========================================================================
    // Trend Calculation
    // =========================================================================

    describe('calculateTrend', () => {
        it('should return stable for no history', () => {
            const result = calculator.calculateTrend('agent-1', 500);

            expect(result.trend).toBe('stable');
            expect(result.delta).toBe(0);
        });

        it('should track score history', () => {
            // Record a score
            calculator.recordScore('agent-1', 500);

            // Verify it was recorded
            const history = (calculator as any).scoreHistory.get('agent-1');
            expect(history).toHaveLength(1);
            expect(history[0].score).toBe(500);
        });
    });

    // =========================================================================
    // Overall Confidence
    // =========================================================================

    describe('calculateOverallConfidence', () => {
        it('should calculate weighted average of component confidences', () => {
            const components = {
                decisionAccuracy: { raw: 80, weighted: 28, samples: 100, confidence: 1, lastUpdated: new Date() },
                ethicsCompliance: { raw: 100, weighted: 25, samples: 0, confidence: 1, lastUpdated: new Date() },
                taskSuccess: { raw: 90, weighted: 18, samples: 50, confidence: 1, lastUpdated: new Date() },
                operationalStability: { raw: 95, weighted: 14.25, samples: 0, confidence: 0.8, lastUpdated: new Date() },
                peerReviews: { raw: 70, weighted: 3.5, samples: 10, confidence: 0.5, lastUpdated: new Date() },
            };

            const confidence = calculator.calculateOverallConfidence(components);

            // 1*0.35 + 1*0.25 + 1*0.20 + 0.8*0.15 + 0.5*0.05 = 0.35 + 0.25 + 0.20 + 0.12 + 0.025 = 0.945
            expect(confidence).toBeCloseTo(0.945, 2);
        });
    });

    // =========================================================================
    // Configuration
    // =========================================================================

    describe('configuration', () => {
        it('should use default config', () => {
            const config = calculator.getConfig();

            expect(config.lookbackDays).toBe(90);
            expect(config.minSamplesForFullConfidence).toBe(100);
            expect(config.inheritanceRate).toBe(0.8);
            expect(config.useFicoScoring).toBe(true);
        });

        it('should allow config override', () => {
            const customCalc = new TrustScoreCalculator({
                lookbackDays: 30,
                minSamplesForFullConfidence: 50,
            });

            const config = customCalc.getConfig();

            expect(config.lookbackDays).toBe(30);
            expect(config.minSamplesForFullConfidence).toBe(50);
        });

        it('should allow config updates', () => {
            calculator.setConfig({ lookbackDays: 60 });

            expect(calculator.getConfig().lookbackDays).toBe(60);
        });
    });
});
