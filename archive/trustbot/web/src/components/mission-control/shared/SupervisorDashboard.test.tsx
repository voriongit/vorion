/**
 * SupervisorDashboard Component Tests
 *
 * Epic 7: Team & Executive Dashboards
 * Stories 7.1-7.3: Supervisor view tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
    SupervisorDashboard,
    OperatorCard,
    TeamSummary,
    OutlierAlert,
    MetricsTrend,
    getStatusColor,
    getStatusIcon,
    formatDuration,
    getQualityColor,
    getDeviationColor,
} from './SupervisorDashboard';
import type { TeamOperator, SupervisorTeamView, CrossOperatorPatterns, TeamDecisionMetrics } from '../../../types';

// ============================================================================
// Test Data
// ============================================================================

const mockOperator: TeamOperator = {
    id: 'op-001',
    name: 'Alice Chen',
    role: 'Senior Operator',
    status: 'online',
    lastActive: new Date().toISOString(),
    pendingReviews: 5,
    completedToday: 23,
    avgResponseTime: 45000,
    qualityScore: 94,
};

const mockTeamView: SupervisorTeamView = {
    supervisorId: 'sup-001',
    supervisorName: 'Sarah Thompson',
    teamSize: 4,
    operators: [
        mockOperator,
        { ...mockOperator, id: 'op-002', name: 'Bob Martinez', status: 'online', qualityScore: 87 },
        { ...mockOperator, id: 'op-003', name: 'Carol Wilson', status: 'away', qualityScore: 91 },
        { ...mockOperator, id: 'op-004', name: 'David Kim', status: 'offline', qualityScore: 82 },
    ],
    onlineCount: 2,
    pendingTotal: 16,
    avgTeamQuality: 88.5,
};

const mockPatterns: CrossOperatorPatterns = {
    period: { start: new Date(Date.now() - 86400000).toISOString(), end: new Date().toISOString() },
    patterns: [],
    teamAverages: { avgApprovalRate: 82.5, avgReviewTime: 52000, avgReviewsPerHour: 5.2 },
    outliers: [
        { operatorId: 'op-002', operatorName: 'Bob Martinez', metric: 'avgReviewTime', deviation: 18.5, severity: 'low' },
        { operatorId: 'op-004', operatorName: 'David Kim', metric: 'approvalRate', deviation: -12.3, severity: 'medium' },
    ],
};

const mockMetrics: TeamDecisionMetrics = {
    period: { start: new Date(Date.now() - 604800000).toISOString(), end: new Date().toISOString() },
    totalDecisions: 587,
    approvalRate: 81.5,
    denialRate: 18.5,
    avgReviewTime: 54000,
    byOperator: [],
    byDecisionType: [
        { type: 'data_access', count: 245, approvalRate: 88.2 },
        { type: 'action_execution', count: 180, approvalRate: 76.5 },
    ],
    trend: [],
};

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('Helper Functions', () => {
    describe('getStatusColor', () => {
        it('returns correct color for each status', () => {
            expect(getStatusColor('online')).toBe('#10b981');
            expect(getStatusColor('away')).toBe('#f59e0b');
            expect(getStatusColor('offline')).toBe('#6b7280');
        });
    });

    describe('getStatusIcon', () => {
        it('returns correct icon for each status', () => {
            expect(getStatusIcon('online')).toBe('🟢');
            expect(getStatusIcon('away')).toBe('🟡');
            expect(getStatusIcon('offline')).toBe('⚫');
        });
    });

    describe('formatDuration', () => {
        it('formats seconds correctly', () => {
            expect(formatDuration(30000)).toBe('30s');
        });

        it('formats minutes correctly', () => {
            expect(formatDuration(90000)).toBe('2m');
        });

        it('formats hours correctly', () => {
            expect(formatDuration(7200000)).toBe('2h');
        });
    });

    describe('getQualityColor', () => {
        it('returns green for 90+', () => {
            expect(getQualityColor(95)).toBe('#10b981');
        });

        it('returns blue for 80-89', () => {
            expect(getQualityColor(85)).toBe('#3b82f6');
        });

        it('returns amber for 70-79', () => {
            expect(getQualityColor(75)).toBe('#f59e0b');
        });

        it('returns red for below 70', () => {
            expect(getQualityColor(65)).toBe('#ef4444');
        });
    });

    describe('getDeviationColor', () => {
        it('returns green for small deviations', () => {
            expect(getDeviationColor(5)).toBe('#10b981');
            expect(getDeviationColor(-5)).toBe('#10b981');
        });

        it('returns amber for medium deviations', () => {
            expect(getDeviationColor(15)).toBe('#f59e0b');
        });

        it('returns red for large deviations', () => {
            expect(getDeviationColor(25)).toBe('#ef4444');
        });
    });
});

// ============================================================================
// Sub-Component Tests
// ============================================================================

describe('OperatorCard', () => {
    it('renders operator name and role', () => {
        render(<OperatorCard operator={mockOperator} />);
        expect(screen.getByText('Alice Chen')).toBeInTheDocument();
        expect(screen.getByText('Senior Operator')).toBeInTheDocument();
    });

    it('renders quality score', () => {
        render(<OperatorCard operator={mockOperator} />);
        expect(screen.getByText('94%')).toBeInTheDocument();
    });

    it('renders pending reviews count', () => {
        render(<OperatorCard operator={mockOperator} />);
        expect(screen.getByText('5')).toBeInTheDocument();
        expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('renders completed today count', () => {
        render(<OperatorCard operator={mockOperator} />);
        expect(screen.getByText('23')).toBeInTheDocument();
        expect(screen.getByText('Today')).toBeInTheDocument();
    });

    it('calls onClick when clicked', () => {
        const handleClick = vi.fn();
        render(<OperatorCard operator={mockOperator} onClick={handleClick} />);
        fireEvent.click(screen.getByLabelText('Operator: Alice Chen'));
        expect(handleClick).toHaveBeenCalledWith('op-001');
    });

    it('has correct aria-label', () => {
        render(<OperatorCard operator={mockOperator} />);
        expect(screen.getByLabelText('Operator: Alice Chen')).toBeInTheDocument();
    });
});

describe('TeamSummary', () => {
    it('renders supervisor name', () => {
        render(<TeamSummary view={mockTeamView} />);
        expect(screen.getByText("Sarah Thompson's Team")).toBeInTheDocument();
    });

    it('renders team size', () => {
        render(<TeamSummary view={mockTeamView} />);
        expect(screen.getByText('4')).toBeInTheDocument();
        expect(screen.getByText('Team Size')).toBeInTheDocument();
    });

    it('renders online count', () => {
        render(<TeamSummary view={mockTeamView} />);
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('Online')).toBeInTheDocument();
    });

    it('renders pending total', () => {
        render(<TeamSummary view={mockTeamView} />);
        expect(screen.getByText('16')).toBeInTheDocument();
        expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('renders average team quality', () => {
        render(<TeamSummary view={mockTeamView} />);
        expect(screen.getByText('88.5%')).toBeInTheDocument();
        expect(screen.getByText('Avg Quality')).toBeInTheDocument();
    });

    it('has correct aria-label', () => {
        render(<TeamSummary view={mockTeamView} />);
        expect(screen.getByLabelText('Team Summary')).toBeInTheDocument();
    });
});

describe('OutlierAlert', () => {
    const outlier = mockPatterns.outliers[0];

    it('renders operator name', () => {
        render(<OutlierAlert outlier={outlier} />);
        expect(screen.getByText('Bob Martinez')).toBeInTheDocument();
    });

    it('renders severity badge', () => {
        render(<OutlierAlert outlier={outlier} />);
        expect(screen.getByText('LOW')).toBeInTheDocument();
    });

    it('renders metric name', () => {
        render(<OutlierAlert outlier={outlier} />);
        expect(screen.getByText('avgReviewTime')).toBeInTheDocument();
    });

    it('renders positive deviation with +', () => {
        render(<OutlierAlert outlier={outlier} />);
        expect(screen.getByText('+18.5%')).toBeInTheDocument();
    });

    it('renders negative deviation without +', () => {
        render(<OutlierAlert outlier={mockPatterns.outliers[1]} />);
        expect(screen.getByText('-12.3%')).toBeInTheDocument();
    });

    it('has correct aria-label', () => {
        render(<OutlierAlert outlier={outlier} />);
        expect(screen.getByLabelText('Outlier: Bob Martinez')).toBeInTheDocument();
    });
});

describe('MetricsTrend', () => {
    it('renders total decisions', () => {
        render(<MetricsTrend metrics={mockMetrics} />);
        expect(screen.getByText('587 decisions')).toBeInTheDocument();
    });

    it('renders approval rate', () => {
        render(<MetricsTrend metrics={mockMetrics} />);
        expect(screen.getByText('81.5%')).toBeInTheDocument();
        expect(screen.getByText('Approval Rate')).toBeInTheDocument();
    });

    it('renders denial rate', () => {
        render(<MetricsTrend metrics={mockMetrics} />);
        expect(screen.getByText('18.5%')).toBeInTheDocument();
        expect(screen.getByText('Denial Rate')).toBeInTheDocument();
    });

    it('renders decision types', () => {
        render(<MetricsTrend metrics={mockMetrics} />);
        expect(screen.getByText('data access')).toBeInTheDocument();
        expect(screen.getByText('245')).toBeInTheDocument();
    });

    it('has correct aria-label', () => {
        render(<MetricsTrend metrics={mockMetrics} />);
        expect(screen.getByLabelText('Team Metrics')).toBeInTheDocument();
    });
});

// ============================================================================
// SupervisorDashboard Tests
// ============================================================================

describe('SupervisorDashboard', () => {
    it('renders team summary', () => {
        render(<SupervisorDashboard teamView={mockTeamView} />);
        expect(screen.getByText("Sarah Thompson's Team")).toBeInTheDocument();
    });

    it('renders all operators', () => {
        render(<SupervisorDashboard teamView={mockTeamView} />);
        expect(screen.getByText('Alice Chen')).toBeInTheDocument();
        expect(screen.getByText('Bob Martinez')).toBeInTheDocument();
        expect(screen.getByText('Carol Wilson')).toBeInTheDocument();
        expect(screen.getByText('David Kim')).toBeInTheDocument();
    });

    it('renders Team Operators heading', () => {
        render(<SupervisorDashboard teamView={mockTeamView} />);
        expect(screen.getByText('Team Operators')).toBeInTheDocument();
    });

    it('renders outliers when patterns provided', () => {
        render(<SupervisorDashboard teamView={mockTeamView} patterns={mockPatterns} />);
        expect(screen.getByText('Activity Outliers')).toBeInTheDocument();
        expect(screen.getAllByText('Bob Martinez')).toHaveLength(2); // In operators and outliers
    });

    it('does not render outliers section when no patterns', () => {
        render(<SupervisorDashboard teamView={mockTeamView} />);
        expect(screen.queryByText('Activity Outliers')).not.toBeInTheDocument();
    });

    it('does not render outliers section when no outliers', () => {
        const emptyPatterns = { ...mockPatterns, outliers: [] };
        render(<SupervisorDashboard teamView={mockTeamView} patterns={emptyPatterns} />);
        expect(screen.queryByText('Activity Outliers')).not.toBeInTheDocument();
    });

    it('renders metrics when provided', () => {
        render(<SupervisorDashboard teamView={mockTeamView} metrics={mockMetrics} />);
        expect(screen.getByText('Team Decision Metrics')).toBeInTheDocument();
    });

    it('calls onOperatorClick when operator clicked', () => {
        const handleClick = vi.fn();
        render(<SupervisorDashboard teamView={mockTeamView} onOperatorClick={handleClick} />);
        fireEvent.click(screen.getByLabelText('Operator: Alice Chen'));
        expect(handleClick).toHaveBeenCalledWith('op-001');
    });

    it('applies custom className', () => {
        const { container } = render(<SupervisorDashboard teamView={mockTeamView} className="custom-class" />);
        expect(container.querySelector('.supervisor.custom-class')).toBeInTheDocument();
    });

    it('has correct aria-label', () => {
        render(<SupervisorDashboard teamView={mockTeamView} />);
        expect(screen.getByLabelText('Supervisor Dashboard')).toBeInTheDocument();
    });
});
