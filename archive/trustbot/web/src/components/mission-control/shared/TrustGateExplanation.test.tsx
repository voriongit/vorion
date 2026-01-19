/**
 * TrustGateExplanation Component Tests
 *
 * Story 3.2: Trust Gate Decision Explanations
 * FRs: FR20
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
    TrustGateExplanation,
    getRuleIcon,
    getRuleColor,
    getRuleTypeLabel,
    formatThresholdComparison,
    getThresholdPercentage,
} from './TrustGateExplanation';
import type { TrustGateExplanation as TrustGateExplanationType, TrustGateRule } from '../../../types';

// ============================================================================
// Test Data
// ============================================================================

const mockExplanation: TrustGateExplanationType = {
    decisionId: 'ar-001',
    agentId: 'worker-1',
    agentName: 'DataProcessor-Alpha',
    agentTier: 1,
    agentTrustScore: 350,
    rules: [
        {
            id: 'rule-001',
            type: 'trust_score_threshold',
            name: 'Trust Score Below Threshold',
            description: 'Agent trust score (350) is below the required threshold (600)',
            threshold: 600,
            currentValue: 350,
            exceeded: true,
            isPrimary: true,
        },
        {
            id: 'rule-002',
            type: 'action_type',
            name: 'High-Volume Data Export',
            description: 'Data exports exceeding 10,000 records require HITL approval',
            exceeded: true,
            isPrimary: false,
        },
    ],
    summary: 'This action required human approval due to 2 governance rules',
};

const singleRuleExplanation: TrustGateExplanationType = {
    ...mockExplanation,
    rules: [mockExplanation.rules[0]],
    summary: 'This action required human approval due to low trust score',
};

const multiRuleExplanation: TrustGateExplanationType = {
    decisionId: 'ar-005',
    agentId: 'error-1',
    agentName: 'FaultyWorker',
    agentTier: 1,
    agentTrustScore: 150,
    rules: [
        {
            id: 'rule-008',
            type: 'risk_level',
            name: 'Agent in Error State',
            description: 'Agents in ERROR state cannot perform actions autonomously',
            exceeded: true,
            isPrimary: true,
        },
        {
            id: 'rule-009',
            type: 'action_type',
            name: 'Data Modification Action',
            description: 'Data correction operations require HITL approval',
            exceeded: true,
            isPrimary: false,
        },
        {
            id: 'rule-010',
            type: 'trust_score_threshold',
            name: 'Critically Low Trust Score',
            description: 'Agent trust score (150) is critically low',
            threshold: 300,
            currentValue: 150,
            exceeded: true,
            isPrimary: false,
        },
    ],
    summary: 'This action required human approval due to 3 governance rules',
};

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('getRuleIcon', () => {
    it('returns correct icon for trust_score_threshold', () => {
        expect(getRuleIcon('trust_score_threshold')).toBe('📊');
    });

    it('returns correct icon for risk_level', () => {
        expect(getRuleIcon('risk_level')).toBe('⚠️');
    });

    it('returns correct icon for action_type', () => {
        expect(getRuleIcon('action_type')).toBe('🎯');
    });

    it('returns correct icon for tier_permission', () => {
        expect(getRuleIcon('tier_permission')).toBe('🔒');
    });

    it('returns correct icon for rate_limit', () => {
        expect(getRuleIcon('rate_limit')).toBe('⏱️');
    });

    it('returns correct icon for first_time_action', () => {
        expect(getRuleIcon('first_time_action')).toBe('🆕');
    });
});

describe('getRuleColor', () => {
    it('returns warning color for trust_score_threshold', () => {
        expect(getRuleColor('trust_score_threshold')).toContain('f59e0b');
    });

    it('returns error color for risk_level', () => {
        expect(getRuleColor('risk_level')).toContain('ef4444');
    });

    it('returns purple for action_type', () => {
        expect(getRuleColor('action_type')).toContain('8b5cf6');
    });

    it('returns blue for tier_permission', () => {
        expect(getRuleColor('tier_permission')).toContain('3b82f6');
    });
});

describe('getRuleTypeLabel', () => {
    it('returns correct labels', () => {
        expect(getRuleTypeLabel('trust_score_threshold')).toBe('Trust Score');
        expect(getRuleTypeLabel('risk_level')).toBe('Risk Level');
        expect(getRuleTypeLabel('action_type')).toBe('Action Type');
        expect(getRuleTypeLabel('tier_permission')).toBe('Tier Permission');
        expect(getRuleTypeLabel('rate_limit')).toBe('Rate Limit');
        expect(getRuleTypeLabel('first_time_action')).toBe('First Time');
    });
});

describe('formatThresholdComparison', () => {
    it('formats threshold comparison correctly', () => {
        const rule: TrustGateRule = {
            id: 'test',
            type: 'trust_score_threshold',
            name: 'Test',
            description: 'Test',
            threshold: 600,
            currentValue: 350,
            exceeded: true,
        };
        expect(formatThresholdComparison(rule)).toBe('350 / 600');
    });

    it('returns null when threshold is undefined', () => {
        const rule: TrustGateRule = {
            id: 'test',
            type: 'action_type',
            name: 'Test',
            description: 'Test',
            exceeded: true,
        };
        expect(formatThresholdComparison(rule)).toBeNull();
    });

    it('returns null when currentValue is undefined', () => {
        const rule: TrustGateRule = {
            id: 'test',
            type: 'trust_score_threshold',
            name: 'Test',
            description: 'Test',
            threshold: 600,
            exceeded: true,
        };
        expect(formatThresholdComparison(rule)).toBeNull();
    });
});

describe('getThresholdPercentage', () => {
    it('calculates percentage correctly', () => {
        const rule: TrustGateRule = {
            id: 'test',
            type: 'trust_score_threshold',
            name: 'Test',
            description: 'Test',
            threshold: 600,
            currentValue: 300,
            exceeded: true,
        };
        expect(getThresholdPercentage(rule)).toBe(50);
    });

    it('caps at 100%', () => {
        const rule: TrustGateRule = {
            id: 'test',
            type: 'trust_score_threshold',
            name: 'Test',
            description: 'Test',
            threshold: 100,
            currentValue: 150,
            exceeded: false,
        };
        expect(getThresholdPercentage(rule)).toBe(100);
    });

    it('returns null when values are undefined', () => {
        const rule: TrustGateRule = {
            id: 'test',
            type: 'action_type',
            name: 'Test',
            description: 'Test',
            exceeded: true,
        };
        expect(getThresholdPercentage(rule)).toBeNull();
    });
});

// ============================================================================
// Component Tests
// ============================================================================

describe('TrustGateExplanation', () => {
    // ========================================================================
    // Basic Rendering
    // ========================================================================

    describe('Basic Rendering', () => {
        it('renders with explanation data', () => {
            render(<TrustGateExplanation explanation={mockExplanation} />);

            expect(screen.getByRole('region', { name: 'Trust Gate Explanation' })).toBeInTheDocument();
        });

        it('displays title', () => {
            render(<TrustGateExplanation explanation={mockExplanation} />);

            expect(screen.getByText('Trust Gate Explanation')).toBeInTheDocument();
        });

        it('renders with custom className', () => {
            const { container } = render(
                <TrustGateExplanation explanation={mockExplanation} className="custom-class" />
            );

            expect(container.querySelector('.trust-gate-explanation')).toHaveClass('custom-class');
        });

        it('displays rule count', () => {
            render(<TrustGateExplanation explanation={mockExplanation} />);

            expect(screen.getByText('2 rules triggered')).toBeInTheDocument();
        });

        it('displays singular rule count for single rule', () => {
            render(<TrustGateExplanation explanation={singleRuleExplanation} />);

            expect(screen.getByText('1 rule triggered')).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Agent Info
    // ========================================================================

    describe('Agent Info', () => {
        it('displays agent name', () => {
            render(<TrustGateExplanation explanation={mockExplanation} />);

            expect(screen.getByText('DataProcessor-Alpha')).toBeInTheDocument();
        });

        it('displays agent tier', () => {
            render(<TrustGateExplanation explanation={mockExplanation} />);

            expect(screen.getByLabelText('Tier 1')).toBeInTheDocument();
        });

        it('displays agent trust score', () => {
            render(<TrustGateExplanation explanation={mockExplanation} />);

            expect(screen.getByLabelText('Trust score 350')).toBeInTheDocument();
        });

        it('hides agent info when showAgentInfo is false', () => {
            render(<TrustGateExplanation explanation={mockExplanation} showAgentInfo={false} />);

            expect(screen.queryByText('DataProcessor-Alpha')).not.toBeInTheDocument();
        });
    });

    // ========================================================================
    // Summary
    // ========================================================================

    describe('Summary', () => {
        it('displays summary text', () => {
            render(<TrustGateExplanation explanation={mockExplanation} />);

            expect(screen.getByText('This action required human approval due to 2 governance rules')).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Primary Trigger
    // ========================================================================

    describe('Primary Trigger', () => {
        it('displays primary trigger callout', () => {
            render(<TrustGateExplanation explanation={mockExplanation} />);

            // Primary trigger appears in callout and rule badge
            expect(screen.getAllByLabelText('Primary trigger').length).toBeGreaterThanOrEqual(1);
            expect(screen.getByText('Primary Trigger:')).toBeInTheDocument();
            // Rule name appears in both callout and rules list
            expect(screen.getAllByText('Trust Score Below Threshold').length).toBeGreaterThanOrEqual(1);
        });

        it('shows primary rule first in rules list', () => {
            render(<TrustGateExplanation explanation={mockExplanation} />);

            const rules = screen.getByRole('list', { name: 'Trust gate rules' });
            const ruleItems = rules.querySelectorAll('li');

            // First rule should have the primary class
            expect(ruleItems[0]).toHaveClass('trust-gate-rule--primary');
        });
    });

    // ========================================================================
    // Rules Display
    // ========================================================================

    describe('Rules Display', () => {
        it('displays all rules', () => {
            render(<TrustGateExplanation explanation={mockExplanation} />);

            // Rule names may appear multiple times (callout + list)
            expect(screen.getAllByText('Trust Score Below Threshold').length).toBeGreaterThanOrEqual(1);
            expect(screen.getByText('High-Volume Data Export')).toBeInTheDocument();
        });

        it('displays rules header with count', () => {
            render(<TrustGateExplanation explanation={mockExplanation} />);

            expect(screen.getByText('Triggered Rules (2)')).toBeInTheDocument();
        });

        it('displays rule descriptions', () => {
            render(<TrustGateExplanation explanation={mockExplanation} />);

            expect(screen.getByText(/Agent trust score \(350\) is below the required threshold \(600\)/)).toBeInTheDocument();
        });

        it('displays rule type badges', () => {
            render(<TrustGateExplanation explanation={mockExplanation} />);

            expect(screen.getByLabelText('Rule type: Trust Score')).toBeInTheDocument();
            expect(screen.getByLabelText('Rule type: Action Type')).toBeInTheDocument();
        });

        it('marks primary rules with badge', () => {
            render(<TrustGateExplanation explanation={mockExplanation} />);

            // The primary badge in the rule card
            const primaryBadges = screen.getAllByLabelText('Primary trigger');
            expect(primaryBadges.length).toBeGreaterThanOrEqual(1);
        });

        it('displays multiple rules correctly', () => {
            render(<TrustGateExplanation explanation={multiRuleExplanation} />);

            expect(screen.getByText('Triggered Rules (3)')).toBeInTheDocument();
            // Primary rule appears in both callout and list
            expect(screen.getAllByText('Agent in Error State').length).toBeGreaterThanOrEqual(1);
            expect(screen.getByText('Data Modification Action')).toBeInTheDocument();
            expect(screen.getByText('Critically Low Trust Score')).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Threshold Display
    // ========================================================================

    describe('Threshold Display', () => {
        it('displays threshold comparison for rules with thresholds', () => {
            render(<TrustGateExplanation explanation={mockExplanation} />);

            expect(screen.getByLabelText('Threshold comparison: 350 / 600')).toBeInTheDocument();
        });

        it('displays progress bar for threshold rules', () => {
            render(<TrustGateExplanation explanation={mockExplanation} />);

            const progressBar = screen.getByRole('progressbar');
            expect(progressBar).toHaveAttribute('aria-valuenow', '350');
            expect(progressBar).toHaveAttribute('aria-valuemax', '600');
        });

        it('does not display threshold for rules without thresholds', () => {
            render(<TrustGateExplanation explanation={singleRuleExplanation} />);

            // Only the one rule with threshold should show comparison
            const thresholdComparisons = screen.getAllByLabelText(/Threshold comparison:/);
            expect(thresholdComparisons).toHaveLength(1);
        });
    });

    // ========================================================================
    // Loading State
    // ========================================================================

    describe('Loading State', () => {
        it('shows loading state when isLoading is true', () => {
            render(<TrustGateExplanation explanation={mockExplanation} isLoading={true} />);

            expect(screen.getByLabelText('Loading trust gate explanation')).toBeInTheDocument();
            expect(screen.getByLabelText('Loading trust gate explanation')).toHaveAttribute('aria-busy', 'true');
        });

        it('hides content when loading', () => {
            render(<TrustGateExplanation explanation={mockExplanation} isLoading={true} />);

            expect(screen.queryByText('Trust Gate Explanation')).not.toBeInTheDocument();
        });
    });

    // ========================================================================
    // Error State
    // ========================================================================

    describe('Error State', () => {
        it('shows error message when error prop is set', () => {
            render(
                <TrustGateExplanation
                    explanation={mockExplanation}
                    error="Failed to load trust gate explanation"
                />
            );

            expect(screen.getByRole('alert')).toHaveTextContent('Failed to load trust gate explanation');
        });

        it('hides content when error', () => {
            render(
                <TrustGateExplanation
                    explanation={mockExplanation}
                    error="Error occurred"
                />
            );

            expect(screen.queryByText('Trust Gate Explanation')).not.toBeInTheDocument();
        });
    });

    // ========================================================================
    // Accessibility
    // ========================================================================

    describe('Accessibility', () => {
        it('has accessible region label', () => {
            render(<TrustGateExplanation explanation={mockExplanation} />);

            expect(screen.getByRole('region', { name: 'Trust Gate Explanation' })).toBeInTheDocument();
        });

        it('has accessible rules list', () => {
            render(<TrustGateExplanation explanation={mockExplanation} />);

            expect(screen.getByRole('list', { name: 'Trust gate rules' })).toBeInTheDocument();
        });

        it('rule items have aria-label', () => {
            render(<TrustGateExplanation explanation={mockExplanation} />);

            expect(screen.getByLabelText('Trust Score Below Threshold (Primary trigger)')).toBeInTheDocument();
            expect(screen.getByLabelText('High-Volume Data Export')).toBeInTheDocument();
        });

        it('agent info section has aria-label', () => {
            render(<TrustGateExplanation explanation={mockExplanation} />);

            expect(screen.getByLabelText('Agent information')).toBeInTheDocument();
        });
    });
});
