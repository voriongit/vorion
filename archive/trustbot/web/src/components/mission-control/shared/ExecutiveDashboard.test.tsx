/**
 * ExecutiveDashboard Component Tests
 *
 * Epic 7: Team & Executive Dashboards
 * Stories 7.4-7.6: Executive view tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
    ExecutiveDashboard,
    HealthIndicator,
    KPICard,
    TrustDistribution,
    HITLLoadCard,
    IncidentCard,
    CostAvoidedCard,
    getHealthColor,
    getKPIStatusColor,
    formatCurrency,
    formatTrend,
    getQueueHealthIcon,
    getIncidentSeverityColor,
} from './ExecutiveDashboard';
import type { ExecutiveDashboard as ExecutiveDashboardData, FleetHealthKPIs, HITLLoadMetrics, IncidentSummary, ActiveIncident } from '../../../types';

// ============================================================================
// Test Data
// ============================================================================

const mockKPI: FleetHealthKPIs['kpis'][0] = {
    name: 'Agent Uptime',
    value: 99.7,
    unit: '%',
    target: 99.5,
    status: 'above_target',
    trend: 0.2,
};

const mockFleetHealth: FleetHealthKPIs = {
    timestamp: new Date().toISOString(),
    totalAgents: 156,
    activeAgents: 142,
    avgTrustScore: 724,
    trustDistribution: {
        'Elite': 8,
        'Certified': 23,
        'Verified': 45,
        'Trusted': 52,
        'Probationary': 18,
        'Untrusted': 10,
    },
    healthIndicators: {
        overall: 'healthy',
        trustTrend: 'improving',
        riskLevel: 'low',
    },
    kpis: [mockKPI],
};

const mockHITLLoad: HITLLoadMetrics = {
    period: { start: new Date(Date.now() - 86400000).toISOString(), end: new Date().toISOString() },
    totalDecisions: 847,
    hitlRequired: 224,
    autonomousDecisions: 623,
    autonomousRate: 73.5,
    hitlLoadByHour: [],
    capacityUtilization: 68.5,
    queueHealth: 'healthy',
};

const mockIncident: ActiveIncident = {
    id: 'inc-001',
    title: 'Elevated Trust Score Volatility',
    severity: 'medium',
    status: 'investigating',
    startedAt: new Date(Date.now() - 7200000).toISOString(),
    assignedTo: 'Alice Chen',
    affectedAgents: 12,
    potentialImpact: 15000,
};

const mockIncidentSummary: IncidentSummary = {
    activeCount: 1,
    resolvingCount: 1,
    resolvedLast24h: 5,
    incidents: [mockIncident],
    costAvoided: {
        period: { start: new Date(Date.now() - 30 * 86400000).toISOString(), end: new Date().toISOString() },
        totalCostAvoided: 284500,
        byCategory: [
            { category: 'Trust Violations Prevented', amount: 125000, incidents: 8 },
        ],
        byMonth: [],
        topPreventedIncidents: [],
    },
};

const mockDashboardData: ExecutiveDashboardData = {
    fleetHealth: mockFleetHealth,
    hitlLoad: mockHITLLoad,
    incidents: mockIncidentSummary,
    lastUpdated: new Date().toISOString(),
};

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('Helper Functions', () => {
    describe('getHealthColor', () => {
        it('returns correct colors for health statuses', () => {
            expect(getHealthColor('healthy')).toBe('#10b981');
            expect(getHealthColor('warning')).toBe('#f59e0b');
            expect(getHealthColor('critical')).toBe('#ef4444');
        });

        it('returns correct colors for trends', () => {
            expect(getHealthColor('improving')).toBe('#10b981');
            expect(getHealthColor('stable')).toBe('#3b82f6');
            expect(getHealthColor('declining')).toBe('#ef4444');
        });

        it('returns correct colors for risk levels', () => {
            expect(getHealthColor('low')).toBe('#10b981');
            expect(getHealthColor('medium')).toBe('#f59e0b');
            expect(getHealthColor('high')).toBe('#ef4444');
        });
    });

    describe('getKPIStatusColor', () => {
        it('returns correct colors for KPI statuses', () => {
            expect(getKPIStatusColor('above_target')).toBe('#10b981');
            expect(getKPIStatusColor('on_target')).toBe('#3b82f6');
            expect(getKPIStatusColor('below_target')).toBe('#ef4444');
        });
    });

    describe('formatCurrency', () => {
        it('formats millions correctly', () => {
            expect(formatCurrency(1500000)).toBe('$1.5M');
        });

        it('formats thousands correctly', () => {
            expect(formatCurrency(15000)).toBe('$15K');
        });

        it('formats small amounts correctly', () => {
            expect(formatCurrency(500)).toBe('$500');
        });
    });

    describe('formatTrend', () => {
        it('adds + for positive trends', () => {
            expect(formatTrend(2.5)).toBe('+2.5%');
        });

        it('does not add + for negative trends', () => {
            expect(formatTrend(-2.5)).toBe('-2.5%');
        });

        it('adds + for zero', () => {
            expect(formatTrend(0)).toBe('+0.0%');
        });
    });

    describe('getQueueHealthIcon', () => {
        it('returns correct icons', () => {
            expect(getQueueHealthIcon('healthy')).toBe('✅');
            expect(getQueueHealthIcon('backlogged')).toBe('⚠️');
            expect(getQueueHealthIcon('overloaded')).toBe('🔴');
        });
    });

    describe('getIncidentSeverityColor', () => {
        it('returns correct colors for severities', () => {
            expect(getIncidentSeverityColor('low')).toBe('#10b981');
            expect(getIncidentSeverityColor('medium')).toBe('#f59e0b');
            expect(getIncidentSeverityColor('high')).toBe('#f97316');
            expect(getIncidentSeverityColor('critical')).toBe('#ef4444');
        });
    });
});

// ============================================================================
// Sub-Component Tests
// ============================================================================

describe('HealthIndicator', () => {
    it('renders label and status', () => {
        render(<HealthIndicator label="Overall" status="healthy" />);
        expect(screen.getByText('Overall')).toBeInTheDocument();
        expect(screen.getByText('healthy')).toBeInTheDocument();
    });
});

describe('KPICard', () => {
    it('renders KPI name', () => {
        render(<KPICard kpi={mockKPI} />);
        expect(screen.getByText('Agent Uptime')).toBeInTheDocument();
    });

    it('renders KPI value with unit', () => {
        render(<KPICard kpi={mockKPI} />);
        expect(screen.getByText('99.7%')).toBeInTheDocument();
    });

    it('renders target', () => {
        render(<KPICard kpi={mockKPI} />);
        expect(screen.getByText('Target: 99.5%')).toBeInTheDocument();
    });

    it('renders trend', () => {
        render(<KPICard kpi={mockKPI} />);
        expect(screen.getByText('+0.2%')).toBeInTheDocument();
    });

    it('renders status', () => {
        render(<KPICard kpi={mockKPI} />);
        expect(screen.getByText('above target')).toBeInTheDocument();
    });

    it('has correct aria-label', () => {
        render(<KPICard kpi={mockKPI} />);
        expect(screen.getByLabelText('KPI: Agent Uptime')).toBeInTheDocument();
    });
});

describe('TrustDistribution', () => {
    it('renders all tiers', () => {
        render(<TrustDistribution distribution={mockFleetHealth.trustDistribution} />);
        expect(screen.getByText('Elite')).toBeInTheDocument();
        expect(screen.getByText('Certified')).toBeInTheDocument();
        expect(screen.getByText('Verified')).toBeInTheDocument();
        expect(screen.getByText('Trusted')).toBeInTheDocument();
        expect(screen.getByText('Probationary')).toBeInTheDocument();
        expect(screen.getByText('Untrusted')).toBeInTheDocument();
    });

    it('renders counts', () => {
        render(<TrustDistribution distribution={mockFleetHealth.trustDistribution} />);
        expect(screen.getByText('8')).toBeInTheDocument();
        expect(screen.getByText('23')).toBeInTheDocument();
    });

    it('has correct aria-label', () => {
        render(<TrustDistribution distribution={mockFleetHealth.trustDistribution} />);
        expect(screen.getByLabelText('Trust Distribution')).toBeInTheDocument();
    });
});

describe('HITLLoadCard', () => {
    it('renders autonomous rate', () => {
        render(<HITLLoadCard metrics={mockHITLLoad} />);
        expect(screen.getByText('73.5%')).toBeInTheDocument();
        expect(screen.getByText('Autonomous Rate')).toBeInTheDocument();
    });

    it('renders capacity utilization', () => {
        render(<HITLLoadCard metrics={mockHITLLoad} />);
        expect(screen.getByText('69%')).toBeInTheDocument();
        expect(screen.getByText('Capacity Used')).toBeInTheDocument();
    });

    it('renders queue status', () => {
        render(<HITLLoadCard metrics={mockHITLLoad} />);
        expect(screen.getByText(/healthy/i)).toBeInTheDocument();
    });

    it('renders decision counts', () => {
        render(<HITLLoadCard metrics={mockHITLLoad} />);
        expect(screen.getByText('847')).toBeInTheDocument();
        expect(screen.getByText('224')).toBeInTheDocument();
        expect(screen.getByText('623')).toBeInTheDocument();
    });

    it('has correct aria-label', () => {
        render(<HITLLoadCard metrics={mockHITLLoad} />);
        expect(screen.getByLabelText('HITL Load Metrics')).toBeInTheDocument();
    });
});

describe('IncidentCard', () => {
    it('renders incident title', () => {
        render(<IncidentCard incident={mockIncident} />);
        expect(screen.getByText('Elevated Trust Score Volatility')).toBeInTheDocument();
    });

    it('renders severity badge', () => {
        render(<IncidentCard incident={mockIncident} />);
        expect(screen.getByText('MEDIUM')).toBeInTheDocument();
    });

    it('renders status', () => {
        render(<IncidentCard incident={mockIncident} />);
        expect(screen.getByText('investigating')).toBeInTheDocument();
    });

    it('renders affected agents count', () => {
        render(<IncidentCard incident={mockIncident} />);
        expect(screen.getByText('12 agents')).toBeInTheDocument();
    });

    it('renders potential impact', () => {
        render(<IncidentCard incident={mockIncident} />);
        expect(screen.getByText('$15K impact')).toBeInTheDocument();
    });

    it('has correct aria-label', () => {
        render(<IncidentCard incident={mockIncident} />);
        expect(screen.getByLabelText('Incident: Elevated Trust Score Volatility')).toBeInTheDocument();
    });
});

describe('CostAvoidedCard', () => {
    it('renders total cost avoided', () => {
        render(<CostAvoidedCard summary={mockIncidentSummary} />);
        // formatCurrency rounds K values to whole numbers: 284500 -> $285K
        expect(screen.getByText('$285K')).toBeInTheDocument();
    });

    it('renders category breakdown', () => {
        render(<CostAvoidedCard summary={mockIncidentSummary} />);
        expect(screen.getByText('Trust Violations Prevented')).toBeInTheDocument();
        expect(screen.getByText('$125K')).toBeInTheDocument();
    });

    it('has correct aria-label', () => {
        render(<CostAvoidedCard summary={mockIncidentSummary} />);
        expect(screen.getByLabelText('Cost Avoided')).toBeInTheDocument();
    });
});

// ============================================================================
// ExecutiveDashboard Tests
// ============================================================================

describe('ExecutiveDashboard', () => {
    it('renders dashboard title', () => {
        render(<ExecutiveDashboard data={mockDashboardData} />);
        expect(screen.getByText('Executive Dashboard')).toBeInTheDocument();
    });

    it('renders health indicators', () => {
        render(<ExecutiveDashboard data={mockDashboardData} />);
        expect(screen.getByText('Overall')).toBeInTheDocument();
        expect(screen.getByText('Trust Trend')).toBeInTheDocument();
        expect(screen.getByText('Risk Level')).toBeInTheDocument();
    });

    it('renders fleet summary stats', () => {
        render(<ExecutiveDashboard data={mockDashboardData} />);
        expect(screen.getByText('156')).toBeInTheDocument(); // Total agents
        expect(screen.getByText('142')).toBeInTheDocument(); // Active agents
        expect(screen.getByText('724')).toBeInTheDocument(); // Avg trust
    });

    it('renders KPIs section', () => {
        render(<ExecutiveDashboard data={mockDashboardData} />);
        expect(screen.getByText('Key Performance Indicators')).toBeInTheDocument();
        expect(screen.getByText('Agent Uptime')).toBeInTheDocument();
    });

    it('renders trust distribution', () => {
        render(<ExecutiveDashboard data={mockDashboardData} />);
        expect(screen.getByText('Trust Distribution')).toBeInTheDocument();
    });

    it('renders HITL load metrics', () => {
        render(<ExecutiveDashboard data={mockDashboardData} />);
        expect(screen.getByText('HITL Load & Autonomous Rate')).toBeInTheDocument();
    });

    it('renders active incidents section', () => {
        render(<ExecutiveDashboard data={mockDashboardData} />);
        expect(screen.getByText('Active Incidents')).toBeInTheDocument();
        expect(screen.getByText('1 active, 1 resolving')).toBeInTheDocument();
    });

    it('renders cost avoided section', () => {
        render(<ExecutiveDashboard data={mockDashboardData} />);
        expect(screen.getByText('Cost Avoided (30 days)')).toBeInTheDocument();
    });

    it('applies custom className', () => {
        const { container } = render(<ExecutiveDashboard data={mockDashboardData} className="custom-class" />);
        expect(container.querySelector('.executive.custom-class')).toBeInTheDocument();
    });

    it('has correct aria-label', () => {
        render(<ExecutiveDashboard data={mockDashboardData} />);
        expect(screen.getByLabelText('Executive Dashboard')).toBeInTheDocument();
    });
});
