/**
 * HITLMetricsCard Component Tests
 * Story 4.4
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
    HITLMetricsCard,
    HITLMetricsSummaryCard,
    MetricGauge,
    RiskBadge,
    formatDuration,
    formatPercentage,
    getRiskColor,
    getRiskIcon,
    getMetricStatus,
} from './HITLMetricsCard';
import type { HITLQualityMetrics, HITLMetricsSummary } from '../../../types';

const mockMetrics: HITLQualityMetrics = {
    userId: 'user-001',
    userName: 'John Doe',
    period: 'Last 7 days',
    avgReviewTimeMs: 45000,
    detailViewRate: 0.85,
    sampleDataViewRate: 0.6,
    avgScrollDepth: 0.92,
    totalDecisions: 156,
    automationBiasRisk: 'low',
};

const mockSummary: HITLMetricsSummary = {
    period: 'Last 7 days',
    totalOperators: 12,
    totalDecisions: 1520,
    avgReviewTimeMs: 38000,
    avgDetailViewRate: 0.72,
    operatorsByRisk: {
        low: 8,
        medium: 3,
        high: 1,
    },
};

describe('HITLMetricsCard Helper Functions', () => {
    describe('formatDuration', () => {
        it('formats milliseconds correctly', () => {
            expect(formatDuration(500)).toBe('500ms');
        });

        it('formats seconds correctly', () => {
            expect(formatDuration(5500)).toBe('5.5s');
        });

        it('formats minutes correctly', () => {
            expect(formatDuration(125000)).toBe('2m 5s');
        });
    });

    describe('formatPercentage', () => {
        it('formats decimal to percentage', () => {
            expect(formatPercentage(0.85)).toBe('85.0%');
            expect(formatPercentage(0.333)).toBe('33.3%');
        });
    });

    describe('getRiskColor', () => {
        it('returns correct colors for risk levels', () => {
            expect(getRiskColor('low')).toBe('#10b981');
            expect(getRiskColor('medium')).toBe('#f59e0b');
            expect(getRiskColor('high')).toBe('#ef4444');
        });
    });

    describe('getRiskIcon', () => {
        it('returns correct icons for risk levels', () => {
            expect(getRiskIcon('low')).toBe('✓');
            expect(getRiskIcon('medium')).toBe('⚠');
            expect(getRiskIcon('high')).toBe('⛔');
        });
    });

    describe('getMetricStatus', () => {
        it('returns good status when value meets good threshold', () => {
            expect(getMetricStatus(0.8, { good: 0.7, warning: 0.4 })).toBe('good');
        });

        it('returns warning status when value is between thresholds', () => {
            expect(getMetricStatus(0.5, { good: 0.7, warning: 0.4 })).toBe('warning');
        });

        it('returns poor status when value is below warning threshold', () => {
            expect(getMetricStatus(0.2, { good: 0.7, warning: 0.4 })).toBe('poor');
        });
    });
});

describe('RiskBadge Component', () => {
    it('renders low risk correctly', () => {
        render(<RiskBadge risk="low" />);
        expect(screen.getByText('LOW')).toBeInTheDocument();
        expect(screen.getByLabelText('Automation bias risk: low')).toBeInTheDocument();
    });

    it('renders medium risk correctly', () => {
        render(<RiskBadge risk="medium" />);
        expect(screen.getByText('MEDIUM')).toBeInTheDocument();
    });

    it('renders high risk correctly', () => {
        render(<RiskBadge risk="high" />);
        expect(screen.getByText('HIGH')).toBeInTheDocument();
    });
});

describe('MetricGauge Component', () => {
    it('renders percentage formatted value', () => {
        render(<MetricGauge label="Test Metric" value={0.85} format="percentage" />);
        expect(screen.getByText('85.0%')).toBeInTheDocument();
    });

    it('renders duration formatted value', () => {
        render(<MetricGauge label="Test Metric" value={45000} format="duration" />);
        expect(screen.getByText('45.0s')).toBeInTheDocument();
    });

    it('renders label', () => {
        render(<MetricGauge label="Detail View Rate" value={0.85} format="percentage" />);
        expect(screen.getByText('Detail View Rate')).toBeInTheDocument();
    });
});

describe('HITLMetricsCard Component', () => {
    it('renders user name', () => {
        render(<HITLMetricsCard metrics={mockMetrics} />);
        expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('renders aria-label with user name', () => {
        render(<HITLMetricsCard metrics={mockMetrics} />);
        expect(screen.getByLabelText('HITL metrics for John Doe')).toBeInTheDocument();
    });

    it('renders risk badge', () => {
        render(<HITLMetricsCard metrics={mockMetrics} />);
        expect(screen.getByText('LOW')).toBeInTheDocument();
    });

    it('renders period', () => {
        render(<HITLMetricsCard metrics={mockMetrics} />);
        expect(screen.getByText('Last 7 days')).toBeInTheDocument();
    });

    it('renders total decisions', () => {
        render(<HITLMetricsCard metrics={mockMetrics} />);
        expect(screen.getByText('156 decisions')).toBeInTheDocument();
    });

    it('renders all metric gauges', () => {
        render(<HITLMetricsCard metrics={mockMetrics} />);
        expect(screen.getByText('Avg Review Time')).toBeInTheDocument();
        expect(screen.getByText('Detail View Rate')).toBeInTheDocument();
        expect(screen.getByText('Sample Data View')).toBeInTheDocument();
        expect(screen.getByText('Scroll Depth')).toBeInTheDocument();
    });

    it('calls onViewDetails when button clicked', () => {
        const onViewDetails = vi.fn();
        render(<HITLMetricsCard metrics={mockMetrics} onViewDetails={onViewDetails} />);

        fireEvent.click(screen.getByText('View Details'));
        expect(onViewDetails).toHaveBeenCalledWith('user-001');
    });

    it('hides View Details button when no handler provided', () => {
        render(<HITLMetricsCard metrics={mockMetrics} />);
        expect(screen.queryByText('View Details')).not.toBeInTheDocument();
    });

    it('applies custom className', () => {
        const { container } = render(
            <HITLMetricsCard metrics={mockMetrics} className="custom-class" />
        );
        expect(container.firstChild).toHaveClass('custom-class');
    });

    it('displays high risk metrics correctly', () => {
        const highRiskMetrics = { ...mockMetrics, automationBiasRisk: 'high' as const };
        render(<HITLMetricsCard metrics={highRiskMetrics} />);
        expect(screen.getByText('HIGH')).toBeInTheDocument();
    });
});

describe('HITLMetricsSummaryCard Component', () => {
    it('renders summary title', () => {
        render(<HITLMetricsSummaryCard summary={mockSummary} />);
        expect(screen.getByText('HITL Quality Overview')).toBeInTheDocument();
    });

    it('renders aria-label', () => {
        render(<HITLMetricsSummaryCard summary={mockSummary} />);
        expect(screen.getByLabelText('HITL metrics summary')).toBeInTheDocument();
    });

    it('renders period', () => {
        render(<HITLMetricsSummaryCard summary={mockSummary} />);
        expect(screen.getByText(/Last 7 days/)).toBeInTheDocument();
    });

    it('renders total operators', () => {
        render(<HITLMetricsSummaryCard summary={mockSummary} />);
        expect(screen.getByText('12')).toBeInTheDocument();
        expect(screen.getByText('Operators')).toBeInTheDocument();
    });

    it('renders total decisions', () => {
        render(<HITLMetricsSummaryCard summary={mockSummary} />);
        expect(screen.getByText('1520')).toBeInTheDocument();
        expect(screen.getByText('Decisions')).toBeInTheDocument();
    });

    it('renders risk distribution', () => {
        render(<HITLMetricsSummaryCard summary={mockSummary} />);
        expect(screen.getByText('Risk Distribution')).toBeInTheDocument();
        expect(screen.getByText('8 Low')).toBeInTheDocument();
        expect(screen.getByText('3 Medium')).toBeInTheDocument();
        expect(screen.getByText('1 High')).toBeInTheDocument();
    });

    it('applies custom className', () => {
        const { container } = render(
            <HITLMetricsSummaryCard summary={mockSummary} className="custom-class" />
        );
        expect(container.firstChild).toHaveClass('custom-class');
    });
});
