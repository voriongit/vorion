/**
 * ExecutiveDashboard Component
 *
 * Epic 7: Team & Executive Dashboards
 * Story 7.4: Executive View - Fleet Health KPIs (FR39, FR40, FR41)
 * Story 7.5: HITL Load & Autonomous Rate Metrics (FR42, FR43)
 * Story 7.6: Active Incidents & Cost Avoided (FR44, FR45)
 */

import { memo } from 'react';
import type {
    FleetHealthKPIs,
    HITLLoadMetrics,
    ActiveIncident,
    IncidentSummary,
    ExecutiveDashboard as ExecutiveDashboardData,
} from '../../../types';

// ============================================================================
// Helper Functions
// ============================================================================

export function getHealthColor(status: string): string {
    const colors: Record<string, string> = {
        healthy: '#10b981',
        warning: '#f59e0b',
        critical: '#ef4444',
        improving: '#10b981',
        stable: '#3b82f6',
        declining: '#ef4444',
        low: '#10b981',
        medium: '#f59e0b',
        high: '#ef4444',
    };
    return colors[status] || '#6b7280';
}

export function getKPIStatusColor(status: string): string {
    const colors: Record<string, string> = {
        above_target: '#10b981',
        on_target: '#3b82f6',
        below_target: '#ef4444',
    };
    return colors[status] || '#6b7280';
}

export function formatCurrency(amount: number): string {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount}`;
}

export function formatTrend(trend: number): string {
    const sign = trend >= 0 ? '+' : '';
    return `${sign}${trend.toFixed(1)}%`;
}

export function getQueueHealthIcon(health: string): string {
    const icons: Record<string, string> = {
        healthy: '✅',
        backlogged: '⚠️',
        overloaded: '🔴',
    };
    return icons[health] || '❓';
}

export function getIncidentSeverityColor(severity: string): string {
    const colors: Record<string, string> = {
        low: '#10b981',
        medium: '#f59e0b',
        high: '#f97316',
        critical: '#ef4444',
    };
    return colors[severity] || '#6b7280';
}

// ============================================================================
// Sub-Components
// ============================================================================

interface HealthIndicatorProps {
    label: string;
    status: string;
}

export const HealthIndicator = memo(function HealthIndicator({ label, status }: HealthIndicatorProps) {
    return (
        <div className="executive__health-indicator">
            <span className="executive__health-label">{label}</span>
            <span
                className="executive__health-status"
                style={{ color: getHealthColor(status) }}
            >
                {status.replace('_', ' ')}
            </span>
        </div>
    );
});

interface KPICardProps {
    kpi: FleetHealthKPIs['kpis'][0];
}

export const KPICard = memo(function KPICard({ kpi }: KPICardProps) {
    return (
        <div className="executive__kpi" aria-label={`KPI: ${kpi.name}`}>
            <div className="executive__kpi-header">
                <span className="executive__kpi-name">{kpi.name}</span>
                <span
                    className="executive__kpi-trend"
                    style={{ color: kpi.trend >= 0 ? '#10b981' : '#ef4444' }}
                >
                    {formatTrend(kpi.trend)}
                </span>
            </div>
            <div className="executive__kpi-value">
                {kpi.value}{kpi.unit !== 'count' ? kpi.unit : ''}
            </div>
            <div className="executive__kpi-footer">
                <span className="executive__kpi-target">Target: {kpi.target}{kpi.unit !== 'count' ? kpi.unit : ''}</span>
                <span
                    className="executive__kpi-status"
                    style={{ color: getKPIStatusColor(kpi.status) }}
                >
                    {kpi.status.replace(/_/g, ' ')}
                </span>
            </div>
        </div>
    );
});

interface TrustDistributionProps {
    distribution: Record<string, number>;
}

export const TrustDistribution = memo(function TrustDistribution({ distribution }: TrustDistributionProps) {
    const tierColors: Record<string, string> = {
        Elite: '#f43f5e',
        Certified: '#10b981',
        Verified: '#8b5cf6',
        Trusted: '#3b82f6',
        Probationary: '#f59e0b',
        Untrusted: '#6b7280',
    };
    const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);

    return (
        <div className="executive__distribution" aria-label="Trust Distribution">
            <h4>Trust Distribution</h4>
            <div className="executive__distribution-bars">
                {Object.entries(distribution).map(([tier, count]) => (
                    <div key={tier} className="executive__distribution-tier">
                        <span className="executive__distribution-label">{tier}</span>
                        <div className="executive__distribution-bar-container">
                            <div
                                className="executive__distribution-bar"
                                style={{
                                    width: `${(count / total) * 100}%`,
                                    backgroundColor: tierColors[tier] || '#6b7280',
                                }}
                            />
                        </div>
                        <span className="executive__distribution-count">{count}</span>
                    </div>
                ))}
            </div>
        </div>
    );
});

interface HITLLoadCardProps {
    metrics: HITLLoadMetrics;
}

export const HITLLoadCard = memo(function HITLLoadCard({ metrics }: HITLLoadCardProps) {
    return (
        <div className="executive__hitl" aria-label="HITL Load Metrics">
            <h4>HITL Load & Autonomous Rate</h4>
            <div className="executive__hitl-stats">
                <div className="executive__hitl-stat">
                    <span className="executive__hitl-stat-value">{metrics.autonomousRate.toFixed(1)}%</span>
                    <span className="executive__hitl-stat-label">Autonomous Rate</span>
                </div>
                <div className="executive__hitl-stat">
                    <span className="executive__hitl-stat-value">{metrics.capacityUtilization.toFixed(0)}%</span>
                    <span className="executive__hitl-stat-label">Capacity Used</span>
                </div>
                <div className="executive__hitl-stat">
                    <span className="executive__hitl-stat-value">
                        {getQueueHealthIcon(metrics.queueHealth)} {metrics.queueHealth}
                    </span>
                    <span className="executive__hitl-stat-label">Queue Status</span>
                </div>
            </div>
            <div className="executive__hitl-breakdown">
                <div className="executive__hitl-count">
                    <span>Total Decisions</span>
                    <span>{metrics.totalDecisions}</span>
                </div>
                <div className="executive__hitl-count">
                    <span>HITL Required</span>
                    <span style={{ color: '#f59e0b' }}>{metrics.hitlRequired}</span>
                </div>
                <div className="executive__hitl-count">
                    <span>Autonomous</span>
                    <span style={{ color: '#10b981' }}>{metrics.autonomousDecisions}</span>
                </div>
            </div>
        </div>
    );
});

interface IncidentCardProps {
    incident: ActiveIncident;
}

export const IncidentCard = memo(function IncidentCard({ incident }: IncidentCardProps) {
    const statusColors: Record<string, string> = {
        active: '#ef4444',
        investigating: '#f59e0b',
        mitigating: '#3b82f6',
        resolved: '#10b981',
    };
    return (
        <div className="executive__incident" aria-label={`Incident: ${incident.title}`}>
            <div className="executive__incident-header">
                <span
                    className="executive__incident-severity"
                    style={{ backgroundColor: getIncidentSeverityColor(incident.severity) }}
                >
                    {incident.severity.toUpperCase()}
                </span>
                <span
                    className="executive__incident-status"
                    style={{ color: statusColors[incident.status] }}
                >
                    {incident.status}
                </span>
            </div>
            <p className="executive__incident-title">{incident.title}</p>
            <div className="executive__incident-details">
                <span>{incident.affectedAgents} agents</span>
                <span>{formatCurrency(incident.potentialImpact)} impact</span>
            </div>
        </div>
    );
});

interface CostAvoidedCardProps {
    summary: IncidentSummary;
}

export const CostAvoidedCard = memo(function CostAvoidedCard({ summary }: CostAvoidedCardProps) {
    return (
        <div className="executive__cost" aria-label="Cost Avoided">
            <h4>Cost Avoided (30 days)</h4>
            <div className="executive__cost-total">
                {formatCurrency(summary.costAvoided.totalCostAvoided)}
            </div>
            <div className="executive__cost-categories">
                {summary.costAvoided.byCategory.slice(0, 3).map((cat, i) => (
                    <div key={i} className="executive__cost-category">
                        <span className="executive__cost-category-name">{cat.category}</span>
                        <span className="executive__cost-category-amount">{formatCurrency(cat.amount)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
});

// ============================================================================
// Main Component
// ============================================================================

export interface ExecutiveDashboardProps {
    data: ExecutiveDashboardData;
    onIncidentClick?: (id: string) => void;
    className?: string;
}

export const ExecutiveDashboard = memo(function ExecutiveDashboard({
    data,
    onIncidentClick: _onIncidentClick,
    className = '',
}: ExecutiveDashboardProps) {
    const { fleetHealth, hitlLoad, incidents } = data;

    return (
        <section className={`executive ${className}`} aria-label="Executive Dashboard">
            <div className="executive__header">
                <h2 className="executive__title">Executive Dashboard</h2>
                <div className="executive__health-indicators">
                    <HealthIndicator label="Overall" status={fleetHealth.healthIndicators.overall} />
                    <HealthIndicator label="Trust Trend" status={fleetHealth.healthIndicators.trustTrend} />
                    <HealthIndicator label="Risk Level" status={fleetHealth.healthIndicators.riskLevel} />
                </div>
            </div>

            <div className="executive__fleet-summary">
                <div className="executive__fleet-stat">
                    <span className="executive__fleet-stat-value">{fleetHealth.totalAgents}</span>
                    <span className="executive__fleet-stat-label">Total Agents</span>
                </div>
                <div className="executive__fleet-stat">
                    <span className="executive__fleet-stat-value" style={{ color: '#10b981' }}>
                        {fleetHealth.activeAgents}
                    </span>
                    <span className="executive__fleet-stat-label">Active</span>
                </div>
                <div className="executive__fleet-stat">
                    <span className="executive__fleet-stat-value" style={{ color: '#3b82f6' }}>
                        {fleetHealth.avgTrustScore}
                    </span>
                    <span className="executive__fleet-stat-label">Avg Trust</span>
                </div>
            </div>

            <div className="executive__content">
                <div className="executive__kpis">
                    <h4>Key Performance Indicators</h4>
                    <div className="executive__kpis-grid">
                        {fleetHealth.kpis.map((kpi) => (
                            <KPICard key={kpi.name} kpi={kpi} />
                        ))}
                    </div>
                </div>

                <TrustDistribution distribution={fleetHealth.trustDistribution} />

                <HITLLoadCard metrics={hitlLoad} />

                <div className="executive__incidents-section">
                    <div className="executive__incidents-header">
                        <h4>Active Incidents</h4>
                        <span className="executive__incidents-count">
                            {incidents.activeCount} active, {incidents.resolvingCount} resolving
                        </span>
                    </div>
                    <div className="executive__incidents-list">
                        {incidents.incidents.map((incident) => (
                            <IncidentCard key={incident.id} incident={incident} />
                        ))}
                    </div>
                </div>

                <CostAvoidedCard summary={incidents} />
            </div>
        </section>
    );
});

// ============================================================================
// Styles
// ============================================================================

const styles = `
.executive {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 24px;
    color: #e2e8f0;
}

.executive__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    flex-wrap: wrap;
    gap: 16px;
}

.executive__title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #f8fafc;
}

.executive__health-indicators {
    display: flex;
    gap: 24px;
}

.executive__health-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.executive__health-label {
    font-size: 0.75rem;
    color: #64748b;
}

.executive__health-status {
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: capitalize;
}

.executive__fleet-summary {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    padding: 20px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    margin-bottom: 24px;
}

.executive__fleet-stat {
    text-align: center;
}

.executive__fleet-stat-value {
    display: block;
    font-size: 2rem;
    font-weight: 700;
    color: #f8fafc;
}

.executive__fleet-stat-label {
    font-size: 0.8125rem;
    color: #64748b;
}

.executive__content {
    display: grid;
    gap: 24px;
}

.executive__kpis h4,
.executive__distribution h4,
.executive__hitl h4,
.executive__cost h4 {
    margin: 0 0 16px;
    font-size: 0.9375rem;
    font-weight: 600;
    color: #94a3b8;
}

.executive__kpis-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
}

.executive__kpi {
    padding: 16px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
}

.executive__kpi-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.executive__kpi-name {
    font-size: 0.8125rem;
    color: #94a3b8;
}

.executive__kpi-trend {
    font-size: 0.75rem;
    font-weight: 600;
}

.executive__kpi-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #f8fafc;
    margin-bottom: 8px;
}

.executive__kpi-footer {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
}

.executive__kpi-target {
    color: #64748b;
}

.executive__kpi-status {
    font-weight: 500;
    text-transform: capitalize;
}

.executive__distribution {
    padding: 16px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
}

.executive__distribution-bars {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.executive__distribution-tier {
    display: grid;
    grid-template-columns: 100px 1fr 40px;
    align-items: center;
    gap: 12px;
}

.executive__distribution-label {
    font-size: 0.8125rem;
    color: #94a3b8;
}

.executive__distribution-bar-container {
    height: 8px;
    background: #1e293b;
    border-radius: 4px;
    overflow: hidden;
}

.executive__distribution-bar {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s;
}

.executive__distribution-count {
    font-size: 0.875rem;
    font-weight: 600;
    color: #f8fafc;
    text-align: right;
}

.executive__hitl {
    padding: 16px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
}

.executive__hitl-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-bottom: 16px;
}

.executive__hitl-stat {
    text-align: center;
}

.executive__hitl-stat-value {
    display: block;
    font-size: 1.25rem;
    font-weight: 700;
    color: #f8fafc;
}

.executive__hitl-stat-label {
    font-size: 0.75rem;
    color: #64748b;
}

.executive__hitl-breakdown {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.executive__hitl-count {
    display: flex;
    justify-content: space-between;
    padding: 8px;
    background: #1e293b;
    border-radius: 4px;
    font-size: 0.8125rem;
}

.executive__hitl-count span:first-child {
    color: #94a3b8;
}

.executive__hitl-count span:last-child {
    font-weight: 600;
    color: #f8fafc;
}

.executive__incidents-section {
    padding: 16px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
}

.executive__incidents-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.executive__incidents-header h4 {
    margin: 0;
}

.executive__incidents-count {
    font-size: 0.75rem;
    color: #64748b;
}

.executive__incidents-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.executive__incident {
    padding: 12px;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 6px;
}

.executive__incident-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.executive__incident-severity {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.625rem;
    font-weight: 600;
    color: white;
}

.executive__incident-status {
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: capitalize;
}

.executive__incident-title {
    margin: 0 0 8px;
    font-size: 0.875rem;
    color: #f8fafc;
}

.executive__incident-details {
    display: flex;
    gap: 16px;
    font-size: 0.75rem;
    color: #64748b;
}

.executive__cost {
    padding: 16px;
    background: linear-gradient(135deg, #064e3b 0%, #0f172a 100%);
    border: 1px solid #10b981;
    border-radius: 8px;
}

.executive__cost-total {
    font-size: 2rem;
    font-weight: 700;
    color: #10b981;
    margin-bottom: 16px;
}

.executive__cost-categories {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.executive__cost-category {
    display: flex;
    justify-content: space-between;
    padding: 8px;
    background: rgba(16, 185, 129, 0.1);
    border-radius: 4px;
}

.executive__cost-category-name {
    font-size: 0.8125rem;
    color: #94a3b8;
}

.executive__cost-category-amount {
    font-size: 0.875rem;
    font-weight: 600;
    color: #10b981;
}
`;

if (typeof document !== 'undefined') {
    const styleId = 'executive-dashboard-styles';
    if (!document.getElementById(styleId)) {
        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }
}

export default ExecutiveDashboard;
