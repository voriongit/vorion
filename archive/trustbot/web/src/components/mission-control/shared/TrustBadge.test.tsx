import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrustBadge, getTierFromScore, getTierByNumber, TIERS } from './TrustBadge';

describe('getTierFromScore', () => {
    it('returns T5 SOVEREIGN for scores 900-1000', () => {
        expect(getTierFromScore(900).tier).toBe(5);
        expect(getTierFromScore(950).tier).toBe(5);
        expect(getTierFromScore(1000).tier).toBe(5);
        expect(getTierFromScore(1000).name).toBe('SOVEREIGN');
    });

    it('returns T4 EXECUTIVE for scores 700-899', () => {
        expect(getTierFromScore(700).tier).toBe(4);
        expect(getTierFromScore(800).tier).toBe(4);
        expect(getTierFromScore(899).tier).toBe(4);
        expect(getTierFromScore(750).name).toBe('EXECUTIVE');
    });

    it('returns T3 TACTICAL for scores 500-699', () => {
        expect(getTierFromScore(500).tier).toBe(3);
        expect(getTierFromScore(600).tier).toBe(3);
        expect(getTierFromScore(699).tier).toBe(3);
        expect(getTierFromScore(550).name).toBe('TACTICAL');
    });

    it('returns T2 OPERATIONAL for scores 300-499', () => {
        expect(getTierFromScore(300).tier).toBe(2);
        expect(getTierFromScore(400).tier).toBe(2);
        expect(getTierFromScore(499).tier).toBe(2);
        expect(getTierFromScore(350).name).toBe('OPERATIONAL');
    });

    it('returns T1 WORKER for scores 100-299', () => {
        expect(getTierFromScore(100).tier).toBe(1);
        expect(getTierFromScore(200).tier).toBe(1);
        expect(getTierFromScore(299).tier).toBe(1);
        expect(getTierFromScore(150).name).toBe('WORKER');
    });

    it('returns T0 PASSIVE for scores 0-99', () => {
        expect(getTierFromScore(0).tier).toBe(0);
        expect(getTierFromScore(50).tier).toBe(0);
        expect(getTierFromScore(99).tier).toBe(0);
        expect(getTierFromScore(25).name).toBe('PASSIVE');
    });

    it('clamps scores above 1000 to T5', () => {
        expect(getTierFromScore(1500).tier).toBe(5);
    });

    it('clamps scores below 0 to T0', () => {
        expect(getTierFromScore(-100).tier).toBe(0);
    });

    it('handles edge cases at tier boundaries', () => {
        expect(getTierFromScore(99).tier).toBe(0);
        expect(getTierFromScore(100).tier).toBe(1);
        expect(getTierFromScore(299).tier).toBe(1);
        expect(getTierFromScore(300).tier).toBe(2);
        expect(getTierFromScore(499).tier).toBe(2);
        expect(getTierFromScore(500).tier).toBe(3);
        expect(getTierFromScore(699).tier).toBe(3);
        expect(getTierFromScore(700).tier).toBe(4);
        expect(getTierFromScore(899).tier).toBe(4);
        expect(getTierFromScore(900).tier).toBe(5);
    });
});

describe('getTierByNumber', () => {
    it('returns correct tier info for each tier number', () => {
        expect(getTierByNumber(0).name).toBe('PASSIVE');
        expect(getTierByNumber(1).name).toBe('WORKER');
        expect(getTierByNumber(2).name).toBe('OPERATIONAL');
        expect(getTierByNumber(3).name).toBe('TACTICAL');
        expect(getTierByNumber(4).name).toBe('EXECUTIVE');
        expect(getTierByNumber(5).name).toBe('SOVEREIGN');
    });

    it('returns fallback tier for invalid tier numbers', () => {
        expect(getTierByNumber(6).name).toBe('PASSIVE');
        expect(getTierByNumber(-1).name).toBe('PASSIVE');
    });
});

describe('TIERS constant', () => {
    it('has 6 tiers defined', () => {
        expect(TIERS).toHaveLength(6);
    });

    it('has all required properties for each tier', () => {
        TIERS.forEach(tier => {
            expect(tier).toHaveProperty('tier');
            expect(tier).toHaveProperty('name');
            expect(tier).toHaveProperty('color');
            expect(tier).toHaveProperty('bgColor');
            expect(tier).toHaveProperty('borderColor');
            expect(tier).toHaveProperty('minScore');
            expect(tier).toHaveProperty('maxScore');
            expect(tier).toHaveProperty('ariaLabel');
        });
    });

    it('has non-overlapping score ranges', () => {
        const sortedTiers = [...TIERS].sort((a, b) => a.minScore - b.minScore);
        for (let i = 1; i < sortedTiers.length; i++) {
            expect(sortedTiers[i].minScore).toBeGreaterThan(sortedTiers[i - 1].maxScore);
        }
    });
});

describe('TrustBadge component', () => {
    it('renders with default props', () => {
        render(<TrustBadge score={750} />);
        expect(screen.getByTestId('trust-badge')).toBeInTheDocument();
        expect(screen.getByTestId('trust-badge-tier')).toHaveTextContent('T4');
        expect(screen.getByTestId('trust-badge-name')).toHaveTextContent('EXECUTIVE');
        expect(screen.getByTestId('trust-badge-score')).toHaveTextContent('750');
    });

    it('hides score when showScore is false', () => {
        render(<TrustBadge score={750} showScore={false} />);
        expect(screen.queryByTestId('trust-badge-score')).not.toBeInTheDocument();
    });

    it('hides tier name when showTierName is false', () => {
        render(<TrustBadge score={750} showTierName={false} />);
        expect(screen.queryByTestId('trust-badge-name')).not.toBeInTheDocument();
    });

    it('renders with sm size', () => {
        render(<TrustBadge score={500} size="sm" />);
        const badge = screen.getByTestId('trust-badge');
        expect(badge).toBeInTheDocument();
    });

    it('renders with lg size', () => {
        render(<TrustBadge score={500} size="lg" />);
        const badge = screen.getByTestId('trust-badge');
        expect(badge).toBeInTheDocument();
    });

    it('applies custom className', () => {
        render(<TrustBadge score={500} className="custom-class" />);
        expect(screen.getByTestId('trust-badge')).toHaveClass('custom-class');
    });

    it('uses custom testId', () => {
        render(<TrustBadge score={500} testId="my-badge" />);
        expect(screen.getByTestId('my-badge')).toBeInTheDocument();
    });

    it('has accessible aria-label', () => {
        render(<TrustBadge score={950} />);
        const badge = screen.getByTestId('trust-badge');
        expect(badge).toHaveAttribute('role', 'status');
        expect(badge).toHaveAttribute('aria-label');
        expect(badge.getAttribute('aria-label')).toContain('Sovereign');
    });

    it('rounds decimal scores', () => {
        render(<TrustBadge score={750.7} />);
        expect(screen.getByTestId('trust-badge-score')).toHaveTextContent('751');
    });

    it('renders correct tier for each tier level', () => {
        const { rerender } = render(<TrustBadge score={50} />);
        expect(screen.getByTestId('trust-badge-tier')).toHaveTextContent('T0');
        expect(screen.getByTestId('trust-badge-name')).toHaveTextContent('PASSIVE');

        rerender(<TrustBadge score={150} />);
        expect(screen.getByTestId('trust-badge-tier')).toHaveTextContent('T1');
        expect(screen.getByTestId('trust-badge-name')).toHaveTextContent('WORKER');

        rerender(<TrustBadge score={400} />);
        expect(screen.getByTestId('trust-badge-tier')).toHaveTextContent('T2');
        expect(screen.getByTestId('trust-badge-name')).toHaveTextContent('OPERATIONAL');

        rerender(<TrustBadge score={600} />);
        expect(screen.getByTestId('trust-badge-tier')).toHaveTextContent('T3');
        expect(screen.getByTestId('trust-badge-name')).toHaveTextContent('TACTICAL');

        rerender(<TrustBadge score={800} />);
        expect(screen.getByTestId('trust-badge-tier')).toHaveTextContent('T4');
        expect(screen.getByTestId('trust-badge-name')).toHaveTextContent('EXECUTIVE');

        rerender(<TrustBadge score={950} />);
        expect(screen.getByTestId('trust-badge-tier')).toHaveTextContent('T5');
        expect(screen.getByTestId('trust-badge-name')).toHaveTextContent('SOVEREIGN');
    });
});
