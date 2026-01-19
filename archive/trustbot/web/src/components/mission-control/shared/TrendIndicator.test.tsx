import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
    TrendIndicator,
    calculateTrendDirection,
    calculateTrendFromHistory,
    TREND_CONFIG,
} from './TrendIndicator';

describe('calculateTrendDirection', () => {
    it('returns "rising" for percentage change > 5%', () => {
        expect(calculateTrendDirection(5.1)).toBe('rising');
        expect(calculateTrendDirection(10)).toBe('rising');
        expect(calculateTrendDirection(100)).toBe('rising');
    });

    it('returns "falling" for percentage change < -5%', () => {
        expect(calculateTrendDirection(-5.1)).toBe('falling');
        expect(calculateTrendDirection(-10)).toBe('falling');
        expect(calculateTrendDirection(-100)).toBe('falling');
    });

    it('returns "stable" for percentage change within -5% to 5%', () => {
        expect(calculateTrendDirection(0)).toBe('stable');
        expect(calculateTrendDirection(5)).toBe('stable');
        expect(calculateTrendDirection(-5)).toBe('stable');
        expect(calculateTrendDirection(2.5)).toBe('stable');
        expect(calculateTrendDirection(-2.5)).toBe('stable');
    });

    it('handles edge cases at thresholds', () => {
        expect(calculateTrendDirection(5)).toBe('stable');
        expect(calculateTrendDirection(5.0001)).toBe('rising');
        expect(calculateTrendDirection(-5)).toBe('stable');
        expect(calculateTrendDirection(-5.0001)).toBe('falling');
    });
});

describe('calculateTrendFromHistory', () => {
    it('returns stable for empty history', () => {
        const result = calculateTrendFromHistory([]);
        expect(result.direction).toBe('stable');
        expect(result.percentChange).toBe(0);
    });

    it('returns stable for single-item history', () => {
        const result = calculateTrendFromHistory([500]);
        expect(result.direction).toBe('stable');
        expect(result.percentChange).toBe(0);
    });

    it('calculates rising trend correctly', () => {
        // 10% increase: 500 -> 550
        const result = calculateTrendFromHistory([500, 520, 530, 540, 550]);
        expect(result.direction).toBe('rising');
        expect(result.percentChange).toBeCloseTo(10);
    });

    it('calculates falling trend correctly', () => {
        // 10% decrease: 500 -> 450
        const result = calculateTrendFromHistory([500, 480, 470, 460, 450]);
        expect(result.direction).toBe('falling');
        expect(result.percentChange).toBeCloseTo(-10);
    });

    it('calculates stable trend for minimal change', () => {
        // 2% change: 500 -> 510
        const result = calculateTrendFromHistory([500, 502, 505, 508, 510]);
        expect(result.direction).toBe('stable');
        expect(result.percentChange).toBeCloseTo(2);
    });

    it('handles zero starting value', () => {
        const result = calculateTrendFromHistory([0, 50, 100]);
        expect(result.direction).toBe('rising');
        expect(result.percentChange).toBe(100);
    });

    it('handles history going to zero', () => {
        const result = calculateTrendFromHistory([100, 50, 0]);
        expect(result.direction).toBe('falling');
        expect(result.percentChange).toBe(-100);
    });

    it('uses first and last values only', () => {
        // First: 500, Last: 600 = 20% increase
        // Middle values don't affect calculation
        const result = calculateTrendFromHistory([500, 1000, 100, 800, 600]);
        expect(result.percentChange).toBeCloseTo(20);
    });
});

describe('TREND_CONFIG', () => {
    it('has configuration for all trend directions', () => {
        expect(TREND_CONFIG.rising).toBeDefined();
        expect(TREND_CONFIG.stable).toBeDefined();
        expect(TREND_CONFIG.falling).toBeDefined();
    });

    it('has required properties for each trend', () => {
        ['rising', 'stable', 'falling'].forEach(trend => {
            const config = TREND_CONFIG[trend as keyof typeof TREND_CONFIG];
            expect(config).toHaveProperty('icon');
            expect(config).toHaveProperty('color');
            expect(config).toHaveProperty('bgColor');
            expect(config).toHaveProperty('label');
            expect(config).toHaveProperty('ariaLabel');
        });
    });

    it('has appropriate icons for each trend', () => {
        expect(TREND_CONFIG.rising.icon).toBe('↑');
        expect(TREND_CONFIG.stable.icon).toBe('→');
        expect(TREND_CONFIG.falling.icon).toBe('↓');
    });
});

describe('TrendIndicator component', () => {
    it('renders rising trend correctly', () => {
        render(<TrendIndicator trend="rising" />);
        expect(screen.getByTestId('trend-indicator')).toBeInTheDocument();
        expect(screen.getByTestId('trend-indicator-icon')).toHaveTextContent('↑');
    });

    it('renders stable trend correctly', () => {
        render(<TrendIndicator trend="stable" />);
        expect(screen.getByTestId('trend-indicator-icon')).toHaveTextContent('→');
    });

    it('renders falling trend correctly', () => {
        render(<TrendIndicator trend="falling" />);
        expect(screen.getByTestId('trend-indicator-icon')).toHaveTextContent('↓');
    });

    it('hides percentage by default', () => {
        render(<TrendIndicator trend="rising" percentChange={10} />);
        expect(screen.queryByTestId('trend-indicator-percentage')).not.toBeInTheDocument();
    });

    it('shows percentage when showPercentage is true', () => {
        render(<TrendIndicator trend="rising" percentChange={10} showPercentage />);
        expect(screen.getByTestId('trend-indicator-percentage')).toBeInTheDocument();
        expect(screen.getByTestId('trend-indicator-percentage')).toHaveTextContent('+10.0%');
    });

    it('formats positive percentage with plus sign', () => {
        render(<TrendIndicator trend="rising" percentChange={15.5} showPercentage />);
        expect(screen.getByTestId('trend-indicator-percentage')).toHaveTextContent('+15.5%');
    });

    it('formats negative percentage with minus sign', () => {
        render(<TrendIndicator trend="falling" percentChange={-8.3} showPercentage />);
        expect(screen.getByTestId('trend-indicator-percentage')).toHaveTextContent('-8.3%');
    });

    it('formats zero percentage without sign', () => {
        render(<TrendIndicator trend="stable" percentChange={0} showPercentage />);
        expect(screen.getByTestId('trend-indicator-percentage')).toHaveTextContent('0.0%');
    });

    it('renders with sm size', () => {
        render(<TrendIndicator trend="stable" size="sm" />);
        expect(screen.getByTestId('trend-indicator')).toBeInTheDocument();
    });

    it('renders with lg size', () => {
        render(<TrendIndicator trend="stable" size="lg" />);
        expect(screen.getByTestId('trend-indicator')).toBeInTheDocument();
    });

    it('applies custom className', () => {
        render(<TrendIndicator trend="stable" className="custom-trend" />);
        expect(screen.getByTestId('trend-indicator')).toHaveClass('custom-trend');
    });

    it('uses custom testId', () => {
        render(<TrendIndicator trend="stable" testId="my-trend" />);
        expect(screen.getByTestId('my-trend')).toBeInTheDocument();
    });

    it('has accessible aria-label for trend only', () => {
        render(<TrendIndicator trend="rising" />);
        const indicator = screen.getByTestId('trend-indicator');
        expect(indicator).toHaveAttribute('role', 'status');
        expect(indicator.getAttribute('aria-label')).toBe('Trust score is trending upward');
    });

    it('has accessible aria-label with percentage', () => {
        render(<TrendIndicator trend="rising" percentChange={12.5} showPercentage />);
        const indicator = screen.getByTestId('trend-indicator');
        expect(indicator.getAttribute('aria-label')).toBe(
            'Trust score is trending upward by 12.5 percent'
        );
    });

    it('marks icon as aria-hidden', () => {
        render(<TrendIndicator trend="stable" />);
        const icon = screen.getByTestId('trend-indicator-icon');
        expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
});
