/**
 * GovernanceRuleCard Component Tests
 *
 * Story 3.4: Director Governance Rule Approval
 * FRs: FR22
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
    GovernanceRuleCard,
    MIN_REASON_LENGTH,
    MAX_REASON_LENGTH,
    getRuleTypeLabel,
    getRuleTypeIcon,
    getStatusColor,
    getRiskLevelColor,
    formatApprovalRateChange,
    validateReason,
} from './GovernanceRuleCard';
import type { GovernanceRule } from '../../../types';

// ============================================================================
// Test Data
// ============================================================================

const mockPendingRule: GovernanceRule = {
    id: 'rule-001',
    orgId: 'demo-org',
    name: 'High-Risk Action Trust Threshold',
    status: 'pending',
    version: 2,
    currentDefinition: {
        type: 'trust_threshold',
        threshold: 600,
        actions: ['data_delete', 'bulk_update'],
        description: 'Minimum trust score for high-risk data operations',
    },
    proposedDefinition: {
        type: 'trust_threshold',
        threshold: 700,
        actions: ['data_delete', 'bulk_update', 'schema_modify'],
        description: 'Increased threshold and added schema modifications',
    },
    impact: {
        affectedAgentCount: 12,
        estimatedApprovalRateChange: -15,
        affectedActionTypes: ['data_delete', 'bulk_update', 'schema_modify'],
        riskLevel: 'medium',
    },
    proposedBy: 'user-456',
    proposedByName: 'Jane Supervisor',
    proposedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    proposalReason: 'Recent security audit recommended stricter thresholds',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
};

const mockApprovedRule: GovernanceRule = {
    id: 'rule-002',
    orgId: 'demo-org',
    name: 'After-Hours Restrictions',
    status: 'approved',
    version: 1,
    currentDefinition: {
        type: 'time_restriction',
        schedule: { start: '18:00', end: '08:00' },
        actions: ['bulk_update', 'data_export'],
        description: 'Restrict bulk operations to business hours',
    },
    proposedBy: 'user-123',
    proposedByName: 'Operations Manager',
    proposedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    proposalReason: 'Reduce risk of unattended bulk operations',
    decidedBy: 'director-001',
    decidedByName: 'Director Smith',
    decidedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    decisionReason: 'Approved as part of operational risk reduction initiative',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
};

const validReason = 'This change is approved after review and impact analysis.';
const shortReason = 'Too short';

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('getRuleTypeLabel', () => {
    it('returns correct label for trust_threshold', () => {
        expect(getRuleTypeLabel('trust_threshold')).toBe('Trust Threshold');
    });

    it('returns correct label for rate_limit', () => {
        expect(getRuleTypeLabel('rate_limit')).toBe('Rate Limit');
    });

    it('returns correct label for tier_requirement', () => {
        expect(getRuleTypeLabel('tier_requirement')).toBe('Tier Requirement');
    });
});

describe('getRuleTypeIcon', () => {
    it('returns icon for trust_threshold', () => {
        expect(getRuleTypeIcon('trust_threshold')).toBe('📊');
    });

    it('returns icon for action_permission', () => {
        expect(getRuleTypeIcon('action_permission')).toBe('🔐');
    });

    it('returns icon for time_restriction', () => {
        expect(getRuleTypeIcon('time_restriction')).toBe('🕐');
    });
});

describe('getStatusColor', () => {
    it('returns orange for pending', () => {
        expect(getStatusColor('pending')).toContain('f59e0b');
    });

    it('returns green for approved', () => {
        expect(getStatusColor('approved')).toContain('10b981');
    });

    it('returns red for denied', () => {
        expect(getStatusColor('denied')).toContain('ef4444');
    });
});

describe('getRiskLevelColor', () => {
    it('returns green for low', () => {
        expect(getRiskLevelColor('low')).toContain('10b981');
    });

    it('returns orange for medium', () => {
        expect(getRiskLevelColor('medium')).toContain('f59e0b');
    });

    it('returns red for high', () => {
        expect(getRiskLevelColor('high')).toContain('ef4444');
    });
});

describe('formatApprovalRateChange', () => {
    it('formats positive change with plus sign', () => {
        expect(formatApprovalRateChange(15)).toBe('+15%');
    });

    it('formats negative change with minus sign', () => {
        expect(formatApprovalRateChange(-15)).toBe('-15%');
    });

    it('formats zero change with plus sign', () => {
        expect(formatApprovalRateChange(0)).toBe('+0%');
    });
});

describe('validateReason', () => {
    it('returns invalid for empty string', () => {
        const result = validateReason('');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('required');
    });

    it('returns invalid for whitespace only', () => {
        const result = validateReason('   ');
        expect(result.valid).toBe(false);
    });

    it('returns invalid when below minimum length', () => {
        const result = validateReason(shortReason);
        expect(result.valid).toBe(false);
        expect(result.error).toContain(`${MIN_REASON_LENGTH}`);
    });

    it('returns valid for sufficient length', () => {
        const result = validateReason(validReason);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
    });

    it('returns invalid when exceeding max length', () => {
        const longReason = 'a'.repeat(MAX_REASON_LENGTH + 1);
        const result = validateReason(longReason);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('exceed');
    });
});

// ============================================================================
// Component Tests
// ============================================================================

describe('GovernanceRuleCard', () => {
    const defaultProps = {
        rule: mockPendingRule,
        onDecide: vi.fn().mockResolvedValue(undefined),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ========================================================================
    // Basic Rendering
    // ========================================================================

    describe('Basic Rendering', () => {
        it('renders rule card', () => {
            render(<GovernanceRuleCard {...defaultProps} />);

            expect(screen.getByRole('article', { name: /High-Risk Action Trust Threshold/i })).toBeInTheDocument();
        });

        it('displays rule name', () => {
            render(<GovernanceRuleCard {...defaultProps} />);

            expect(screen.getByText('High-Risk Action Trust Threshold')).toBeInTheDocument();
        });

        it('displays rule version', () => {
            render(<GovernanceRuleCard {...defaultProps} />);

            expect(screen.getByText('Version 2')).toBeInTheDocument();
        });

        it('displays status badge', () => {
            render(<GovernanceRuleCard {...defaultProps} />);

            expect(screen.getByText('PENDING')).toBeInTheDocument();
        });

        it('renders with custom className', () => {
            const { container } = render(
                <GovernanceRuleCard {...defaultProps} className="custom-class" />
            );

            expect(container.querySelector('.governance-rule')).toHaveClass('custom-class');
        });
    });

    // ========================================================================
    // Proposal Info
    // ========================================================================

    describe('Proposal Info', () => {
        it('shows proposer name', () => {
            render(<GovernanceRuleCard {...defaultProps} />);

            expect(screen.getByText(/Jane Supervisor/)).toBeInTheDocument();
        });

        it('shows proposal reason', () => {
            render(<GovernanceRuleCard {...defaultProps} />);

            expect(screen.getByText(/Recent security audit/)).toBeInTheDocument();
        });

        it('shows time since proposal', () => {
            render(<GovernanceRuleCard {...defaultProps} />);

            expect(screen.getByText(/day.*ago/i)).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Definition Comparison
    // ========================================================================

    describe('Definition Comparison', () => {
        it('shows current rule definition', () => {
            render(<GovernanceRuleCard {...defaultProps} />);

            expect(screen.getByText('Current Rule')).toBeInTheDocument();
            expect(screen.getByText(/Minimum trust score for high-risk/)).toBeInTheDocument();
        });

        it('shows proposed rule definition', () => {
            render(<GovernanceRuleCard {...defaultProps} />);

            expect(screen.getByText('Proposed Change')).toBeInTheDocument();
            expect(screen.getByText(/Increased threshold and added/)).toBeInTheDocument();
        });

        it('shows comparison arrow', () => {
            render(<GovernanceRuleCard {...defaultProps} />);

            expect(screen.getByText('→')).toBeInTheDocument();
        });

        it('shows threshold values', () => {
            render(<GovernanceRuleCard {...defaultProps} />);

            expect(screen.getByText('600')).toBeInTheDocument();
            expect(screen.getByText('700')).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Impact Analysis
    // ========================================================================

    describe('Impact Analysis', () => {
        it('shows impact section', () => {
            render(<GovernanceRuleCard {...defaultProps} />);

            expect(screen.getByLabelText('Impact analysis')).toBeInTheDocument();
        });

        it('shows affected agent count', () => {
            render(<GovernanceRuleCard {...defaultProps} />);

            expect(screen.getByText('12')).toBeInTheDocument();
        });

        it('shows approval rate change', () => {
            render(<GovernanceRuleCard {...defaultProps} />);

            expect(screen.getByText('-15%')).toBeInTheDocument();
        });

        it('shows risk level', () => {
            render(<GovernanceRuleCard {...defaultProps} />);

            expect(screen.getByText('MEDIUM')).toBeInTheDocument();
        });

        it('shows affected action types', () => {
            render(<GovernanceRuleCard {...defaultProps} />);

            // Get from within impact analysis section (not definition comparison)
            const impactSection = screen.getByLabelText('Impact analysis');
            expect(impactSection).toHaveTextContent(/data delete, bulk update, schema modify/i);
        });
    });

    // ========================================================================
    // Director Decision Interface
    // ========================================================================

    describe('Director Decision Interface', () => {
        it('shows decision section for directors viewing pending rules', () => {
            render(<GovernanceRuleCard {...defaultProps} isDirector={true} />);

            expect(screen.getByLabelText(/Decision Reason/)).toBeInTheDocument();
        });

        it('hides decision section for non-directors', () => {
            render(<GovernanceRuleCard {...defaultProps} isDirector={false} />);

            expect(screen.queryByLabelText(/Decision Reason/)).not.toBeInTheDocument();
        });

        it('shows approve and deny buttons', () => {
            render(<GovernanceRuleCard {...defaultProps} isDirector={true} />);

            expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Deny' })).toBeInTheDocument();
        });

        it('disables buttons when reason is invalid', () => {
            render(<GovernanceRuleCard {...defaultProps} isDirector={true} />);

            expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
            expect(screen.getByRole('button', { name: 'Deny' })).toBeDisabled();
        });

        it('enables buttons when reason is valid', () => {
            render(<GovernanceRuleCard {...defaultProps} isDirector={true} />);

            const textarea = screen.getByLabelText(/Decision Reason/);
            fireEvent.change(textarea, { target: { value: validReason } });

            expect(screen.getByRole('button', { name: 'Approve' })).not.toBeDisabled();
            expect(screen.getByRole('button', { name: 'Deny' })).not.toBeDisabled();
        });
    });

    // ========================================================================
    // Validation
    // ========================================================================

    describe('Validation', () => {
        it('shows error when reason too short on blur', () => {
            render(<GovernanceRuleCard {...defaultProps} isDirector={true} />);

            const textarea = screen.getByLabelText(/Decision Reason/);
            fireEvent.change(textarea, { target: { value: shortReason } });
            fireEvent.blur(textarea);

            expect(screen.getByText(/at least/)).toBeInTheDocument();
        });

        it('shows character count', () => {
            render(<GovernanceRuleCard {...defaultProps} isDirector={true} />);

            expect(screen.getByText(/0\/\d+/)).toBeInTheDocument();
        });

        it('updates character count on input', () => {
            render(<GovernanceRuleCard {...defaultProps} isDirector={true} />);

            const textarea = screen.getByLabelText(/Decision Reason/);
            fireEvent.change(textarea, { target: { value: 'Test input' } });

            expect(screen.getByText(/10\/\d+/)).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Form Submission
    // ========================================================================

    describe('Form Submission', () => {
        it('calls onDecide with approve action', async () => {
            const onDecide = vi.fn().mockResolvedValue(undefined);
            render(<GovernanceRuleCard {...defaultProps} onDecide={onDecide} isDirector={true} />);

            const textarea = screen.getByLabelText(/Decision Reason/);
            fireEvent.change(textarea, { target: { value: validReason } });

            fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

            await waitFor(() => {
                expect(onDecide).toHaveBeenCalledWith('rule-001', 'approve', validReason);
            });
        });

        it('calls onDecide with deny action', async () => {
            const onDecide = vi.fn().mockResolvedValue(undefined);
            render(<GovernanceRuleCard {...defaultProps} onDecide={onDecide} isDirector={true} />);

            const textarea = screen.getByLabelText(/Decision Reason/);
            fireEvent.change(textarea, { target: { value: validReason } });

            fireEvent.click(screen.getByRole('button', { name: 'Deny' }));

            await waitFor(() => {
                expect(onDecide).toHaveBeenCalledWith('rule-001', 'deny', validReason);
            });
        });

        it('shows submitting state for approve', () => {
            render(<GovernanceRuleCard {...defaultProps} isDirector={true} isSubmitting={true} />);

            const textarea = screen.getByLabelText(/Decision Reason/);
            expect(textarea).toBeDisabled();
        });

        it('shows error on submission failure', async () => {
            const error = new Error('Network error');
            const onDecide = vi.fn().mockRejectedValue(error);
            render(<GovernanceRuleCard {...defaultProps} onDecide={onDecide} isDirector={true} />);

            const textarea = screen.getByLabelText(/Decision Reason/);
            fireEvent.change(textarea, { target: { value: validReason } });

            fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

            await waitFor(() => {
                expect(screen.getByText('Network error')).toBeInTheDocument();
            });
        });
    });

    // ========================================================================
    // Already Decided Rules
    // ========================================================================

    describe('Already Decided Rules', () => {
        it('shows decision record for approved rules', () => {
            render(<GovernanceRuleCard rule={mockApprovedRule} />);

            expect(screen.getByText(/Approved by Director Smith/)).toBeInTheDocument();
        });

        it('shows decision reason', () => {
            render(<GovernanceRuleCard rule={mockApprovedRule} />);

            expect(screen.getByLabelText('Decision reason')).toHaveTextContent(/operational risk reduction/);
        });

        it('shows decision date', () => {
            render(<GovernanceRuleCard rule={mockApprovedRule} />);

            // Should show date of decision
            expect(screen.getByText(/\d{1,2}\/\d{1,2}\/\d{4}/)).toBeInTheDocument();
        });

        it('does not show decision section for already decided rules', () => {
            render(<GovernanceRuleCard rule={mockApprovedRule} isDirector={true} />);

            // No textarea for reason since rule is already decided
            expect(screen.queryByLabelText(/Decision Reason/)).not.toBeInTheDocument();
        });
    });

    // ========================================================================
    // Accessibility
    // ========================================================================

    describe('Accessibility', () => {
        it('has accessible article role with name', () => {
            render(<GovernanceRuleCard {...defaultProps} />);

            expect(screen.getByRole('article', { name: /High-Risk Action Trust Threshold/i })).toBeInTheDocument();
        });

        it('textarea has aria-describedby', () => {
            render(<GovernanceRuleCard {...defaultProps} isDirector={true} />);

            const textarea = screen.getByLabelText(/Decision Reason/);
            expect(textarea).toHaveAttribute('aria-describedby');
        });

        it('shows aria-invalid when validation fails', () => {
            render(<GovernanceRuleCard {...defaultProps} isDirector={true} />);

            const textarea = screen.getByLabelText(/Decision Reason/);
            fireEvent.change(textarea, { target: { value: shortReason } });
            fireEvent.blur(textarea);

            expect(textarea).toHaveAttribute('aria-invalid', 'true');
        });

        it('buttons have aria-busy when submitting', () => {
            render(<GovernanceRuleCard {...defaultProps} isDirector={true} isSubmitting={true} />);

            // Buttons should be in loading state
            expect(screen.getByRole('button', { name: /Approv/i })).toHaveAttribute('aria-busy');
        });
    });
});
