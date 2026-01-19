/**
 * SupervisorDashboard Component
 *
 * Epic 7: Team & Executive Dashboards
 * Story 7.1: Supervisor View - Team Operators (FR36)
 * Story 7.2: Cross-Operator Activity Patterns (FR37)
 * Story 7.3: Team Decision Metrics (FR38)
 */

import { memo } from 'react';
import type {
    TeamOperator,
    SupervisorTeamView,
    CrossOperatorPatterns,
    TeamDecisionMetrics,
} from '../../../types';

// ============================================================================
// Helper Functions
// ============================================================================

export function getStatusColor(status: TeamOperator['status']): string {
    const colors = { online: '#10b981', away: '#f59e0b', offline: '#6b7280' };
    return colors[status];
}

export function getStatusIcon(status: TeamOperator['status']): string {
    const icons = { online: '🟢', away: '🟡', offline: '⚫' };
    return icons[status];
}

export function formatDuration(ms: number): string {
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
    return `${Math.round(ms / 3600000)}h`;
}

export function getQualityColor(score: number): string {
    if (score >= 90) return '#10b981';
    if (score >= 80) return '#3b82f6';
    if (score >= 70) return '#f59e0b';
    return '#ef4444';
}

export function getDeviationColor(deviation: number): string {
    const abs = Math.abs(deviation);
    if (abs < 10) return '#10b981';
    if (abs < 20) return '#f59e0b';
    return '#ef4444';
}

// ============================================================================
// Sub-Components
// ============================================================================

interface OperatorCardProps {
    operator: TeamOperator;
    onClick?: (id: string) => void;
}

export const OperatorCard = memo(function OperatorCard({ operator, onClick }: OperatorCardProps) {
    return (
        <div
            className="supervisor__operator"
            onClick={() => onClick?.(operator.id)}
            aria-label={`Operator: ${operator.name}`}
        >
            <div className="supervisor__operator-header">
                <span className="supervisor__operator-status">
                    {getStatusIcon(operator.status)}
                </span>
                <div className="supervisor__operator-info">
                    <span className="supervisor__operator-name">{operator.name}</span>
                    <span className="supervisor__operator-role">{operator.role}</span>
                </div>
                <span
                    className="supervisor__operator-quality"
                    style={{ backgroundColor: getQualityColor(operator.qualityScore) }}
                >
                    {operator.qualityScore}%
                </span>
            </div>
            <div className="supervisor__operator-stats">
                <div className="supervisor__operator-stat">
                    <span className="supervisor__operator-stat-value">{operator.pendingReviews}</span>
                    <span className="supervisor__operator-stat-label">Pending</span>
                </div>
                <div className="supervisor__operator-stat">
                    <span className="supervisor__operator-stat-value">{operator.completedToday}</span>
                    <span className="supervisor__operator-stat-label">Today</span>
                </div>
                <div className="supervisor__operator-stat">
                    <span className="supervisor__operator-stat-value">{formatDuration(operator.avgResponseTime)}</span>
                    <span className="supervisor__operator-stat-label">Avg Time</span>
                </div>
            </div>
        </div>
    );
});

interface TeamSummaryProps {
    view: SupervisorTeamView;
}

export const TeamSummary = memo(function TeamSummary({ view }: TeamSummaryProps) {
    return (
        <div className="supervisor__summary" aria-label="Team Summary">
            <h3 className="supervisor__summary-title">{view.supervisorName}'s Team</h3>
            <div className="supervisor__summary-stats">
                <div className="supervisor__summary-stat">
                    <span className="supervisor__summary-stat-value">{view.teamSize}</span>
                    <span className="supervisor__summary-stat-label">Team Size</span>
                </div>
                <div className="supervisor__summary-stat">
                    <span className="supervisor__summary-stat-value" style={{ color: '#10b981' }}>
                        {view.onlineCount}
                    </span>
                    <span className="supervisor__summary-stat-label">Online</span>
                </div>
                <div className="supervisor__summary-stat">
                    <span className="supervisor__summary-stat-value" style={{ color: '#f59e0b' }}>
                        {view.pendingTotal}
                    </span>
                    <span className="supervisor__summary-stat-label">Pending</span>
                </div>
                <div className="supervisor__summary-stat">
                    <span className="supervisor__summary-stat-value" style={{ color: getQualityColor(view.avgTeamQuality) }}>
                        {view.avgTeamQuality}%
                    </span>
                    <span className="supervisor__summary-stat-label">Avg Quality</span>
                </div>
            </div>
        </div>
    );
});

interface OutlierAlertProps {
    outlier: CrossOperatorPatterns['outliers'][0];
}

export const OutlierAlert = memo(function OutlierAlert({ outlier }: OutlierAlertProps) {
    const severityColors = { low: '#3b82f6', medium: '#f59e0b', high: '#ef4444' };
    return (
        <div className="supervisor__outlier" aria-label={`Outlier: ${outlier.operatorName}`}>
            <span
                className="supervisor__outlier-severity"
                style={{ backgroundColor: severityColors[outlier.severity] }}
            >
                {outlier.severity.toUpperCase()}
            </span>
            <span className="supervisor__outlier-name">{outlier.operatorName}</span>
            <span className="supervisor__outlier-metric">{outlier.metric}</span>
            <span
                className="supervisor__outlier-deviation"
                style={{ color: getDeviationColor(outlier.deviation) }}
            >
                {outlier.deviation > 0 ? '+' : ''}{outlier.deviation.toFixed(1)}%
            </span>
        </div>
    );
});

interface MetricsTrendProps {
    metrics: TeamDecisionMetrics;
}

export const MetricsTrend = memo(function MetricsTrend({ metrics }: MetricsTrendProps) {
    return (
        <div className="supervisor__metrics" aria-label="Team Metrics">
            <div className="supervisor__metrics-header">
                <h4>Team Decision Metrics</h4>
                <span className="supervisor__metrics-total">{metrics.totalDecisions} decisions</span>
            </div>
            <div className="supervisor__metrics-rates">
                <div className="supervisor__metrics-rate">
                    <span className="supervisor__metrics-rate-label">Approval Rate</span>
                    <span className="supervisor__metrics-rate-value" style={{ color: '#10b981' }}>
                        {metrics.approvalRate.toFixed(1)}%
                    </span>
                </div>
                <div className="supervisor__metrics-rate">
                    <span className="supervisor__metrics-rate-label">Denial Rate</span>
                    <span className="supervisor__metrics-rate-value" style={{ color: '#ef4444' }}>
                        {metrics.denialRate.toFixed(1)}%
                    </span>
                </div>
                <div className="supervisor__metrics-rate">
                    <span className="supervisor__metrics-rate-label">Avg Review Time</span>
                    <span className="supervisor__metrics-rate-value">
                        {formatDuration(metrics.avgReviewTime)}
                    </span>
                </div>
            </div>
            <div className="supervisor__metrics-breakdown">
                {metrics.byDecisionType.map((dt) => (
                    <div key={dt.type} className="supervisor__metrics-type">
                        <span className="supervisor__metrics-type-name">{dt.type.replace('_', ' ')}</span>
                        <span className="supervisor__metrics-type-count">{dt.count}</span>
                        <span className="supervisor__metrics-type-rate">{dt.approvalRate.toFixed(0)}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
});

// ============================================================================
// Main Component
// ============================================================================

export interface SupervisorDashboardProps {
    teamView: SupervisorTeamView;
    patterns?: CrossOperatorPatterns;
    metrics?: TeamDecisionMetrics;
    onOperatorClick?: (id: string) => void;
    className?: string;
}

export const SupervisorDashboard = memo(function SupervisorDashboard({
    teamView,
    patterns,
    metrics,
    onOperatorClick,
    className = '',
}: SupervisorDashboardProps) {
    return (
        <section className={`supervisor ${className}`} aria-label="Supervisor Dashboard">
            <TeamSummary view={teamView} />

            <div className="supervisor__content">
                <div className="supervisor__operators">
                    <h4>Team Operators</h4>
                    <div className="supervisor__operators-list">
                        {teamView.operators.map((op) => (
                            <OperatorCard key={op.id} operator={op} onClick={onOperatorClick} />
                        ))}
                    </div>
                </div>

                {patterns && patterns.outliers.length > 0 && (
                    <div className="supervisor__outliers">
                        <h4>Activity Outliers</h4>
                        {patterns.outliers.map((outlier, i) => (
                            <OutlierAlert key={i} outlier={outlier} />
                        ))}
                    </div>
                )}

                {metrics && <MetricsTrend metrics={metrics} />}
            </div>
        </section>
    );
});

// ============================================================================
// Styles
// ============================================================================

const styles = `
.supervisor {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 20px;
    color: #e2e8f0;
}

.supervisor__summary {
    margin-bottom: 20px;
}

.supervisor__summary-title {
    margin: 0 0 16px;
    font-size: 1.125rem;
    font-weight: 600;
    color: #f8fafc;
}

.supervisor__summary-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    padding: 16px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
}

.supervisor__summary-stat {
    text-align: center;
}

.supervisor__summary-stat-value {
    display: block;
    font-size: 1.5rem;
    font-weight: 700;
    color: #f8fafc;
}

.supervisor__summary-stat-label {
    font-size: 0.75rem;
    color: #64748b;
}

.supervisor__content {
    display: grid;
    gap: 20px;
}

.supervisor__operators h4,
.supervisor__outliers h4 {
    margin: 0 0 12px;
    font-size: 0.875rem;
    font-weight: 600;
    color: #94a3b8;
}

.supervisor__operators-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.supervisor__operator {
    padding: 12px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    cursor: pointer;
    transition: border-color 0.2s;
}

.supervisor__operator:hover {
    border-color: #3b82f6;
}

.supervisor__operator-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
}

.supervisor__operator-status {
    font-size: 0.75rem;
}

.supervisor__operator-info {
    flex: 1;
}

.supervisor__operator-name {
    display: block;
    font-weight: 600;
    color: #f8fafc;
}

.supervisor__operator-role {
    font-size: 0.75rem;
    color: #64748b;
}

.supervisor__operator-quality {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    color: white;
}

.supervisor__operator-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
}

.supervisor__operator-stat {
    text-align: center;
    padding: 8px;
    background: #1e293b;
    border-radius: 4px;
}

.supervisor__operator-stat-value {
    display: block;
    font-size: 1rem;
    font-weight: 600;
    color: #f8fafc;
}

.supervisor__operator-stat-label {
    font-size: 0.625rem;
    color: #64748b;
}

.supervisor__outliers {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.supervisor__outlier {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 6px;
}

.supervisor__outlier-severity {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.625rem;
    font-weight: 600;
    color: white;
}

.supervisor__outlier-name {
    flex: 1;
    font-size: 0.875rem;
    color: #f8fafc;
}

.supervisor__outlier-metric {
    font-size: 0.75rem;
    color: #64748b;
}

.supervisor__outlier-deviation {
    font-size: 0.875rem;
    font-weight: 600;
}

.supervisor__metrics {
    padding: 16px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
}

.supervisor__metrics-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
}

.supervisor__metrics-header h4 {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: #94a3b8;
}

.supervisor__metrics-total {
    font-size: 0.875rem;
    color: #64748b;
}

.supervisor__metrics-rates {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-bottom: 16px;
}

.supervisor__metrics-rate {
    text-align: center;
}

.supervisor__metrics-rate-label {
    display: block;
    font-size: 0.75rem;
    color: #64748b;
    margin-bottom: 4px;
}

.supervisor__metrics-rate-value {
    font-size: 1.25rem;
    font-weight: 700;
}

.supervisor__metrics-breakdown {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.supervisor__metrics-type {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px;
    background: #1e293b;
    border-radius: 4px;
}

.supervisor__metrics-type-name {
    flex: 1;
    font-size: 0.8125rem;
    color: #94a3b8;
    text-transform: capitalize;
}

.supervisor__metrics-type-count {
    font-size: 0.875rem;
    font-weight: 600;
    color: #f8fafc;
}

.supervisor__metrics-type-rate {
    font-size: 0.75rem;
    color: #10b981;
    min-width: 40px;
    text-align: right;
}
`;

if (typeof document !== 'undefined') {
    const styleId = 'supervisor-dashboard-styles';
    if (!document.getElementById(styleId)) {
        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }
}

export default SupervisorDashboard;
