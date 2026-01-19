/**
 * TrustImpactPreview Component Tests
 *
 * Story 2.5: Trust Impact Preview
 * FRs: FR17
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
    TrustImpactPreview,
    getDeltaColor,
    formatDelta,
    getTrustTier,
} from './TrustImpactPreview';
import type { TrustImpactData } from './TrustImpactPreview';

// ============================================================================
// Test Data
// ============================================================================

const mockImpact: TrustImpactData = {
    currentTrust: 500,
    agentId: 'agent-1',
    agentName: 'DataProcessor-Alpha',
    approveImpact: {
        scoreDelta: 27,
        newScore: 527,
        factors: [
            { name: 'Action completion', value: 20 },
            { name: 'Action type bonus', value: 5 },
            { name: 'History modifier', value: 2 },
        ],
    },
    denyImpact: {
        scoreDelta: -22,
        newScore: 478,
        factors: [
            { name: 'Failed request', value: -20 },
            { name: 'Operator override', value: -2 },
        ],
    },
};

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('getDeltaColor', () => {
    it('returns success color for positive delta', () => {
        const color = getDeltaColor(15);
        expect(color).toContain('22c55e'); // Green
    });

    it('returns danger color for negative delta', () => {
        const color = getDeltaColor(-10);
        expect(color).toContain('ef4444'); // Red
    });

    it('returns muted color for zero delta', () => {
        const color = getDeltaColor(0);
        expect(color).toContain('6b7280'); // Gray
    });
});

describe('formatDelta', () => {
    it('adds + sign to positive numbers', () => {
        expect(formatDelta(15)).toBe('+15');
    });

    it('keeps - sign for negative numbers', () => {
        expect(formatDelta(-10)).toBe('-10');
    });

    it('returns 0 without sign', () => {
        expect(formatDelta(0)).toBe('0');
    });
});

describe('getTrustTier', () => {
    it('returns tier 5 for scores >= 800', () => {
        expect(getTrustTier(800)).toEqual({ tier: 5, label: 'Executive' });
        expect(getTrustTier(1000)).toEqual({ tier: 5, label: 'Executive' });
    });

    it('returns tier 4 for scores 600-799', () => {
        expect(getTrustTier(600)).toEqual({ tier: 4, label: 'Senior' });
        expect(getTrustTier(799)).toEqual({ tier: 4, label: 'Senior' });
    });

    it('returns tier 3 for scores 400-599', () => {
        expect(getTrustTier(400)).toEqual({ tier: 3, label: 'Standard' });
        expect(getTrustTier(500)).toEqual({ tier: 3, label: 'Standard' });
    });

    it('returns tier 2 for scores 200-399', () => {
        expect(getTrustTier(200)).toEqual({ tier: 2, label: 'Junior' });
        expect(getTrustTier(350)).toEqual({ tier: 2, label: 'Junior' });
    });

    it('returns tier 1 for scores < 200', () => {
        expect(getTrustTier(100)).toEqual({ tier: 1, label: 'Probationary' });
        expect(getTrustTier(0)).toEqual({ tier: 1, label: 'Probationary' });
    });
});

// ============================================================================
// Component Tests
// ============================================================================

describe('TrustImpactPreview', () => {
    // ========================================================================
    // Basic Rendering
    // ========================================================================

    describe('Basic Rendering', () => {
        it('renders with impact data', () => {
            render(<TrustImpactPreview impact={mockImpact} />);

            expect(screen.getByText('Trust Impact Preview')).toBeInTheDocument();
        });

        it('displays current trust score', () => {
            render(<TrustImpactPreview impact={mockImpact} />);

            expect(screen.getByText('Current:')).toBeInTheDocument();
            expect(screen.getByText('500')).toBeInTheDocument();
            expect(screen.getByText('(T3)')).toBeInTheDocument();
        });

        it('renders with custom className', () => {
            const { container } = render(
                <TrustImpactPreview impact={mockImpact} className="custom-class" />
            );

            expect(container.querySelector('.trust-impact-preview')).toHaveClass('custom-class');
        });
    });

    // ========================================================================
    // Approve Impact Card
    // ========================================================================

    describe('Approve Impact Card', () => {
        it('displays approve card title', () => {
            render(<TrustImpactPreview impact={mockImpact} />);

            expect(screen.getByText('If Approved')).toBeInTheDocument();
        });

        it('displays positive delta with + sign', () => {
            render(<TrustImpactPreview impact={mockImpact} />);

            expect(screen.getByLabelText('Trust score change: +27')).toBeInTheDocument();
        });

        it('displays new score after approval', () => {
            render(<TrustImpactPreview impact={mockImpact} />);

            expect(screen.getByText('527')).toBeInTheDocument();
        });

        it('displays approve factors', () => {
            render(<TrustImpactPreview impact={mockImpact} />);

            expect(screen.getByText('Action completion')).toBeInTheDocument();
            expect(screen.getByText('+20')).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Deny Impact Card
    // ========================================================================

    describe('Deny Impact Card', () => {
        it('displays deny card title', () => {
            render(<TrustImpactPreview impact={mockImpact} />);

            expect(screen.getByText('If Denied')).toBeInTheDocument();
        });

        it('displays negative delta', () => {
            render(<TrustImpactPreview impact={mockImpact} />);

            expect(screen.getByLabelText('Trust score change: -22')).toBeInTheDocument();
        });

        it('displays new score after denial', () => {
            render(<TrustImpactPreview impact={mockImpact} />);

            expect(screen.getByText('478')).toBeInTheDocument();
        });

        it('displays deny factors', () => {
            render(<TrustImpactPreview impact={mockImpact} />);

            expect(screen.getByText('Failed request')).toBeInTheDocument();
            expect(screen.getByText('-20')).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Loading State
    // ========================================================================

    describe('Loading State', () => {
        it('shows loading state when isLoading is true', () => {
            render(<TrustImpactPreview impact={mockImpact} isLoading={true} />);

            const loading = screen.getByLabelText('Loading trust impact preview');
            expect(loading).toBeInTheDocument();
            expect(loading).toHaveAttribute('aria-busy', 'true');
        });

        it('hides content when loading', () => {
            render(<TrustImpactPreview impact={mockImpact} isLoading={true} />);

            expect(screen.queryByText('If Approved')).not.toBeInTheDocument();
        });
    });

    // ========================================================================
    // Error State
    // ========================================================================

    describe('Error State', () => {
        it('shows error message when error prop is set', () => {
            render(
                <TrustImpactPreview
                    impact={mockImpact}
                    error="Failed to load trust impact"
                />
            );

            const alert = screen.getByRole('alert');
            expect(alert).toBeInTheDocument();
            expect(alert).toHaveTextContent('Failed to load trust impact');
        });

        it('hides content when error', () => {
            render(
                <TrustImpactPreview
                    impact={mockImpact}
                    error="Failed to load"
                />
            );

            expect(screen.queryByText('If Approved')).not.toBeInTheDocument();
        });
    });

    // ========================================================================
    // Tier Transitions
    // ========================================================================

    describe('Tier Transitions', () => {
        it('shows tier badge on impact cards', () => {
            render(<TrustImpactPreview impact={mockImpact} />);

            // Both cards should show tier badges
            expect(screen.getAllByText(/T3 Standard/)).toHaveLength(2);
        });

        it('shows different tiers when impact crosses tier boundary', () => {
            const crossTierImpact: TrustImpactData = {
                ...mockImpact,
                currentTrust: 395,
                approveImpact: {
                    scoreDelta: 10,
                    newScore: 405, // Crosses to tier 3
                    factors: [{ name: 'Test', value: 10 }],
                },
                denyImpact: {
                    scoreDelta: -100,
                    newScore: 295, // Stays in tier 2
                    factors: [{ name: 'Test', value: -100 }],
                },
            };

            render(<TrustImpactPreview impact={crossTierImpact} />);

            expect(screen.getByText('T3 Standard')).toBeInTheDocument();
            expect(screen.getByText('T2 Junior')).toBeInTheDocument();
        });
    });

    // ========================================================================
    // Accessibility
    // ========================================================================

    describe('Accessibility', () => {
        it('has accessible delta labels', () => {
            render(<TrustImpactPreview impact={mockImpact} />);

            expect(screen.getByLabelText('Trust score change: +27')).toBeInTheDocument();
            expect(screen.getByLabelText('Trust score change: -22')).toBeInTheDocument();
        });

        it('loading state has aria-busy', () => {
            render(<TrustImpactPreview impact={mockImpact} isLoading={true} />);

            expect(screen.getByLabelText('Loading trust impact preview')).toHaveAttribute(
                'aria-busy',
                'true'
            );
        });

        it('error state has role alert', () => {
            render(<TrustImpactPreview impact={mockImpact} error="Error" />);

            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
    });
});
