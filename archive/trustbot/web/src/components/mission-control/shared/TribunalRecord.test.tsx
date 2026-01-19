/**
 * TribunalRecord Component Tests
 *
 * Story 3.1: Bot Tribunal Voting Records Display
 * FRs: FR19
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
    TribunalRecord,
    getVoteColor,
    getVoteIcon,
    getVoteLabel,
    getConsensusLabel,
    getConsensusColor,
    formatConfidence,
    getConfidenceLevel,
    getConfidenceColor,
} from './TribunalRecord';
import type { TribunalRecord as TribunalRecordType } from '../../../types';

// ============================================================================
// Test Data
// ============================================================================

const mockTribunalRecord: TribunalRecordType = {
    decisionId: 'ar-001',
    tribunalId: 'trib-001',
    status: 'completed',
    finalRecommendation: 'approve',
    consensus: 'majority',
    votedAt: '2025-12-23T10:00:00Z',
    votes: [
        {
            id: 'vote-001',
            agentId: 'validator-1',
            agentName: 'RiskAssessor-Prime',
            vote: 'approve',
            reasoning: 'Action within normal operational parameters',
            confidence: 0.92,
            votedAt: '2025-12-23T09:59:30Z',
        },
        {
            id: 'vote-002',
            agentId: 'validator-2',
            agentName: 'ComplianceCheck-Alpha',
            vote: 'approve',
            reasoning: 'No compliance violations detected',
            confidence: 0.88,
            votedAt: '2025-12-23T09:59:40Z',
        },
        {
            id: 'vote-003',
            agentId: 'validator-3',
            agentName: 'SecurityGate-Beta',
            vote: 'deny',
            reasoning: 'Elevated risk due to recent failures',
            confidence: 0.75,
            votedAt: '2025-12-23T09:59:50Z',
            dissenting: true,
        },
    ],
    summary: {
        approveCount: 2,
        denyCount: 1,
        abstainCount: 0,
        totalVotes: 3,
        averageConfidence: 0.85,
    },
};

const unanimousRecord: TribunalRecordType = {
    ...mockTribunalRecord,
    consensus: 'unanimous',
    finalRecommendation: 'approve',
    votes: [
        { ...mockTribunalRecord.votes[0], vote: 'approve' },
        { ...mockTribunalRecord.votes[1], vote: 'approve' },
        { ...mockTribunalRecord.votes[2], vote: 'approve', dissenting: false },
    ],
    summary: {
        approveCount: 3,
        denyCount: 0,
        abstainCount: 0,
        totalVotes: 3,
        averageConfidence: 0.85,
    },
};

const denyRecord: TribunalRecordType = {
    ...mockTribunalRecord,
    finalRecommendation: 'deny',
    consensus: 'majority',
    votes: [
        { ...mockTribunalRecord.votes[0], vote: 'deny' },
        { ...mockTribunalRecord.votes[1], vote: 'deny' },
        { ...mockTribunalRecord.votes[2], vote: 'approve', dissenting: true },
    ],
    summary: {
        approveCount: 1,
        denyCount: 2,
        abstainCount: 0,
        totalVotes: 3,
        averageConfidence: 0.85,
    },
};

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('getVoteColor', () => {
    it('returns success color for approve', () => {
        expect(getVoteColor('approve')).toContain('10b981');
    });

    it('returns error color for deny', () => {
        expect(getVoteColor('deny')).toContain('ef4444');
    });

    it('returns muted color for abstain', () => {
        expect(getVoteColor('abstain')).toContain('6b7280');
    });
});

describe('getVoteIcon', () => {
    it('returns checkmark for approve', () => {
        expect(getVoteIcon('approve')).toBe('✓');
    });

    it('returns X for deny', () => {
        expect(getVoteIcon('deny')).toBe('✗');
    });

    it('returns circle for abstain', () => {
        expect(getVoteIcon('abstain')).toBe('○');
    });
});

describe('getVoteLabel', () => {
    it('returns correct labels', () => {
        expect(getVoteLabel('approve')).toBe('Approve');
        expect(getVoteLabel('deny')).toBe('Deny');
        expect(getVoteLabel('abstain')).toBe('Abstain');
    });
});

describe('getConsensusLabel', () => {
    it('returns correct labels', () => {
        expect(getConsensusLabel('unanimous')).toBe('Unanimous');
        expect(getConsensusLabel('majority')).toBe('Majority');
        expect(getConsensusLabel('split')).toBe('Split Decision');
        expect(getConsensusLabel('deadlock')).toBe('Deadlock');
    });
});

describe('getConsensusColor', () => {
    it('returns success color for unanimous', () => {
        expect(getConsensusColor('unanimous')).toContain('10b981');
    });

    it('returns primary color for majority', () => {
        expect(getConsensusColor('majority')).toContain('3b82f6');
    });

    it('returns warning color for split', () => {
        expect(getConsensusColor('split')).toContain('f59e0b');
    });

    it('returns error color for deadlock', () => {
        expect(getConsensusColor('deadlock')).toContain('ef4444');
    });
});

describe('formatConfidence', () => {
    it('formats confidence as percentage', () => {
        expect(formatConfidence(0.92)).toBe('92%');
        expect(formatConfidence(0.5)).toBe('50%');
        expect(formatConfidence(1)).toBe('100%');
        expect(formatConfidence(0)).toBe('0%');
    });
});

describe('getConfidenceLevel', () => {
    it('returns high for >= 0.85', () => {
        expect(getConfidenceLevel(0.85)).toBe('high');
        expect(getConfidenceLevel(0.95)).toBe('high');
    });

    it('returns medium for 0.6-0.84', () => {
        expect(getConfidenceLevel(0.6)).toBe('medium');
        expect(getConfidenceLevel(0.75)).toBe('medium');
    });

    it('returns low for < 0.6', () => {
        expect(getConfidenceLevel(0.59)).toBe('low');
        expect(getConfidenceLevel(0.3)).toBe('low');
    });
});

describe('getConfidenceColor', () => {
    it('returns success color for high confidence', () => {
        expect(getConfidenceColor(0.9)).toContain('10b981');
    });

    it('returns warning color for medium confidence', () => {
        expect(getConfidenceColor(0.7)).toContain('f59e0b');
    });

    it('returns error color for low confidence', () => {
        expect(getConfidenceColor(0.4)).toContain('ef4444');
    });
});

// ============================================================================
// Component Tests
// ============================================================================

describe('TribunalRecord', () => {
    // ========================================================================
    // Basic Rendering
    // ========================================================================

    describe('Basic Rendering', () => {
        it('renders with tribunal record', () => {
            render(<TribunalRecord record={mockTribunalRecord} />);

            expect(screen.getByRole('region', { name: 'Bot Tribunal Record' })).toBeInTheDocument();
        });

        it('displays title', () => {
            render(<TribunalRecord record={mockTribunalRecord} />);

            expect(screen.getByText('Bot Tribunal Record')).toBeInTheDocument();
        });

        it('renders with custom className', () => {
            const { container } = render(
                <TribunalRecord record={mockTribunalRecord} className="custom-class" />
            );

            expect(container.querySelector('.tribunal-record')).toHaveClass('custom-class');
        });
    });

    // ========================================================================
    // Header & Consensus
    // ========================================================================

    describe('Header & Consensus', () => {
        it('displays consensus badge', () => {
            render(<TribunalRecord record={mockTribunalRecord} />);

            expect(screen.getByText('Majority')).toBeInTheDocument();
        });

        it('displays unanimous consensus correctly', () => {
            render(<TribunalRecord record={unanimousRecord} />);

            expect(screen.getByText('Unanimous')).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Summary Section
    // ========================================================================

    describe('Summary Section', () => {
        it('displays final recommendation', () => {
            render(<TribunalRecord record={mockTribunalRecord} />);

            expect(screen.getByText('Recommendation:')).toBeInTheDocument();
            // Check for the approve label - there are multiple "Approve" texts
            // (recommendation + vote badges), so we use getAllByText
            expect(screen.getAllByText(/Approve/).length).toBeGreaterThanOrEqual(1);
        });

        it('displays vote counts', () => {
            render(<TribunalRecord record={mockTribunalRecord} />);

            // Check for the vote count numbers (2 approve, 1 deny)
            expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
        });

        it('displays average confidence', () => {
            render(<TribunalRecord record={mockTribunalRecord} />);

            expect(screen.getByText('Avg Confidence:')).toBeInTheDocument();
            expect(screen.getByText('85%')).toBeInTheDocument();
        });

        it('shows deny recommendation for deny record', () => {
            render(<TribunalRecord record={denyRecord} />);

            expect(screen.getAllByText(/Deny/).length).toBeGreaterThanOrEqual(1);
        });
    });

    // ========================================================================
    // Votes Display
    // ========================================================================

    describe('Votes Display', () => {
        it('displays all votes', () => {
            render(<TribunalRecord record={mockTribunalRecord} />);

            expect(screen.getByText('RiskAssessor-Prime')).toBeInTheDocument();
            expect(screen.getByText('ComplianceCheck-Alpha')).toBeInTheDocument();
            expect(screen.getByText('SecurityGate-Beta')).toBeInTheDocument();
        });

        it('displays vote count in header', () => {
            render(<TribunalRecord record={mockTribunalRecord} />);

            expect(screen.getByText('Votes (3)')).toBeInTheDocument();
        });

        it('displays confidence for each vote', () => {
            render(<TribunalRecord record={mockTribunalRecord} />);

            expect(screen.getByLabelText('Confidence: 92%')).toBeInTheDocument();
            expect(screen.getByLabelText('Confidence: 88%')).toBeInTheDocument();
            expect(screen.getByLabelText('Confidence: 75%')).toBeInTheDocument();
        });

        it('marks dissenting votes', () => {
            render(<TribunalRecord record={mockTribunalRecord} />);

            expect(screen.getByLabelText('Dissenting vote')).toBeInTheDocument();
        });

        it('hides votes section when showDetails is false', () => {
            render(<TribunalRecord record={mockTribunalRecord} showDetails={false} />);

            expect(screen.queryByText('Votes (3)')).not.toBeInTheDocument();
        });
    });

    // ========================================================================
    // Vote Expansion
    // ========================================================================

    describe('Vote Expansion', () => {
        it('expands vote to show reasoning on click', () => {
            render(<TribunalRecord record={mockTribunalRecord} />);

            // Reasoning should not be visible initially
            expect(screen.queryByText('Action within normal operational parameters')).not.toBeInTheDocument();

            // Click expand button on first vote
            const expandButtons = screen.getAllByLabelText('Show reasoning');
            fireEvent.click(expandButtons[0]);

            // Reasoning should now be visible
            expect(screen.getByText('Action within normal operational parameters')).toBeInTheDocument();
        });

        it('collapses vote on second click', () => {
            render(<TribunalRecord record={mockTribunalRecord} />);

            // Expand
            const expandButtons = screen.getAllByLabelText('Show reasoning');
            fireEvent.click(expandButtons[0]);
            expect(screen.getByText('Action within normal operational parameters')).toBeInTheDocument();

            // Collapse
            fireEvent.click(screen.getByLabelText('Hide reasoning'));
            expect(screen.queryByText('Action within normal operational parameters')).not.toBeInTheDocument();
        });

        it('expands all votes with Expand All button', () => {
            render(<TribunalRecord record={mockTribunalRecord} />);

            fireEvent.click(screen.getByText('Expand All'));

            expect(screen.getByText('Action within normal operational parameters')).toBeInTheDocument();
            expect(screen.getByText('No compliance violations detected')).toBeInTheDocument();
            expect(screen.getByText('Elevated risk due to recent failures')).toBeInTheDocument();
        });

        it('collapses all votes with Collapse All button', () => {
            render(<TribunalRecord record={mockTribunalRecord} />);

            // First expand all
            fireEvent.click(screen.getByText('Expand All'));
            expect(screen.getByText('Action within normal operational parameters')).toBeInTheDocument();

            // Then collapse all
            fireEvent.click(screen.getByText('Collapse All'));
            expect(screen.queryByText('Action within normal operational parameters')).not.toBeInTheDocument();
        });
    });

    // ========================================================================
    // Loading State
    // ========================================================================

    describe('Loading State', () => {
        it('shows loading state when isLoading is true', () => {
            render(<TribunalRecord record={mockTribunalRecord} isLoading={true} />);

            expect(screen.getByLabelText('Loading tribunal record')).toBeInTheDocument();
            expect(screen.getByLabelText('Loading tribunal record')).toHaveAttribute('aria-busy', 'true');
        });

        it('hides content when loading', () => {
            render(<TribunalRecord record={mockTribunalRecord} isLoading={true} />);

            expect(screen.queryByText('Bot Tribunal Record')).not.toBeInTheDocument();
        });
    });

    // ========================================================================
    // Error State
    // ========================================================================

    describe('Error State', () => {
        it('shows error message when error prop is set', () => {
            render(
                <TribunalRecord
                    record={mockTribunalRecord}
                    error="Failed to load tribunal record"
                />
            );

            expect(screen.getByRole('alert')).toHaveTextContent('Failed to load tribunal record');
        });

        it('hides content when error', () => {
            render(
                <TribunalRecord
                    record={mockTribunalRecord}
                    error="Error occurred"
                />
            );

            expect(screen.queryByText('Bot Tribunal Record')).not.toBeInTheDocument();
        });
    });

    // ========================================================================
    // Footer
    // ========================================================================

    describe('Footer', () => {
        it('displays deliberation timestamp', () => {
            render(<TribunalRecord record={mockTribunalRecord} />);

            expect(screen.getByText(/Deliberation completed:/)).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Accessibility
    // ========================================================================

    describe('Accessibility', () => {
        it('has accessible region label', () => {
            render(<TribunalRecord record={mockTribunalRecord} />);

            expect(screen.getByRole('region', { name: 'Bot Tribunal Record' })).toBeInTheDocument();
        });

        it('has accessible votes list', () => {
            render(<TribunalRecord record={mockTribunalRecord} />);

            expect(screen.getByRole('list', { name: 'Tribunal votes' })).toBeInTheDocument();
        });

        it('expand buttons have aria-expanded', () => {
            render(<TribunalRecord record={mockTribunalRecord} />);

            const expandButtons = screen.getAllByLabelText('Show reasoning');
            expect(expandButtons[0]).toHaveAttribute('aria-expanded', 'false');

            fireEvent.click(expandButtons[0]);
            expect(screen.getByLabelText('Hide reasoning')).toHaveAttribute('aria-expanded', 'true');
        });

        it('vote badges have aria-label', () => {
            render(<TribunalRecord record={mockTribunalRecord} />);

            expect(screen.getAllByLabelText('Vote: Approve').length).toBeGreaterThanOrEqual(1);
            expect(screen.getByLabelText('Vote: Deny')).toBeInTheDocument();
        });

        it('confidence values have aria-label', () => {
            render(<TribunalRecord record={mockTribunalRecord} />);

            expect(screen.getByLabelText('Confidence: 92%')).toBeInTheDocument();
        });
    });
});
