/**
 * HITLMetricsCard Component
 *
 * Story 4.4: HITL Quality Metrics Display
 * FRs: FR26, FR27
 */

import { memo } from 'react';
import type { HITLQualityMetrics, HITLMetricsSummary } from '../../../types';

// ============================================================================
// Helper Functions
// ============================================================================

export function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
}

export function formatPercentage(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
}

export function getRiskColor(risk: 'low' | 'medium' | 'high'): string {
    const colors = {
        low: '#10b981',
        medium: '#f59e0b',
        high: '#ef4444',
    };
    return colors[risk];
}

export function getRiskIcon(risk: 'low' | 'medium' | 'high'): string {
    const icons = {
        low: '✓',
        medium: '⚠',
        high: '⛔',
    };
    return icons[risk];
}

export function getMetricStatus(value: number, thresholds: { good: number; warning: number }): 'good' | 'warning' | 'poor' {
    if (value >= thresholds.good) return 'good';
    if (value >= thresholds.warning) return 'warning';
    return 'poor';
}

// ============================================================================
// Sub-Components
// ============================================================================

interface MetricGaugeProps {
    label: string;
    value: number;
    format: 'percentage' | 'duration';
    thresholds?: { good: number; warning: number };
    helpText?: string;
}

export const MetricGauge = memo(function MetricGauge({
    label,
    value,
    format,
    thresholds,
    helpText,
}: MetricGaugeProps) {
    const displayValue = format === 'percentage' ? formatPercentage(value) : formatDuration(value);
    const status = thresholds ? getMetricStatus(value, thresholds) : 'good';
    const statusColors = { good: '#10b981', warning: '#f59e0b', poor: '#ef4444' };

    return (
        <div className="hitl-metrics__gauge" title={helpText}>
            <span className="hitl-metrics__gauge-label">{label}</span>
            <span
                className="hitl-metrics__gauge-value"
                style={{ color: statusColors[status] }}
            >
                {displayValue}
            </span>
        </div>
    );
});

interface RiskBadgeProps {
    risk: 'low' | 'medium' | 'high';
}

export const RiskBadge = memo(function RiskBadge({ risk }: RiskBadgeProps) {
    return (
        <span
            className={`hitl-metrics__risk-badge hitl-metrics__risk-badge--${risk}`}
            style={{ backgroundColor: getRiskColor(risk) }}
            aria-label={`Automation bias risk: ${risk}`}
        >
            <span className="hitl-metrics__risk-icon">{getRiskIcon(risk)}</span>
            <span className="hitl-metrics__risk-label">{risk.toUpperCase()}</span>
        </span>
    );
});

// ============================================================================
// Main Component
// ============================================================================

export interface HITLMetricsCardProps {
    metrics: HITLQualityMetrics;
    onViewDetails?: (userId: string) => void;
    className?: string;
}

export const HITLMetricsCard = memo(function HITLMetricsCard({
    metrics,
    onViewDetails,
    className = '',
}: HITLMetricsCardProps) {
    return (
        <article
            className={`hitl-metrics ${className}`}
            aria-label={`HITL metrics for ${metrics.userName}`}
        >
            <div className="hitl-metrics__header">
                <div className="hitl-metrics__user">
                    <span className="hitl-metrics__user-icon" aria-hidden="true">👤</span>
                    <span className="hitl-metrics__user-name">{metrics.userName}</span>
                </div>
                <RiskBadge risk={metrics.automationBiasRisk} />
            </div>

            <div className="hitl-metrics__period">
                <span className="hitl-metrics__period-label">Period:</span>
                <span className="hitl-metrics__period-value">{metrics.period}</span>
                <span className="hitl-metrics__decisions">
                    {metrics.totalDecisions} decisions
                </span>
            </div>

            <div className="hitl-metrics__gauges">
                <MetricGauge
                    label="Avg Review Time"
                    value={metrics.avgReviewTimeMs}
                    format="duration"
                    helpText="Average time spent reviewing each decision"
                />
                <MetricGauge
                    label="Detail View Rate"
                    value={metrics.detailViewRate}
                    format="percentage"
                    thresholds={{ good: 0.7, warning: 0.4 }}
                    helpText="Percentage of decisions where details were viewed"
                />
                <MetricGauge
                    label="Sample Data View"
                    value={metrics.sampleDataViewRate}
                    format="percentage"
                    thresholds={{ good: 0.5, warning: 0.25 }}
                    helpText="Percentage of decisions where sample data was examined"
                />
                <MetricGauge
                    label="Scroll Depth"
                    value={metrics.avgScrollDepth}
                    format="percentage"
                    thresholds={{ good: 0.8, warning: 0.5 }}
                    helpText="Average scroll depth through decision content"
                />
            </div>

            {onViewDetails && (
                <div className="hitl-metrics__actions">
                    <button
                        className="hitl-metrics__btn"
                        onClick={() => onViewDetails(metrics.userId)}
                    >
                        View Details
                    </button>
                </div>
            )}
        </article>
    );
});

// ============================================================================
// Summary Component
// ============================================================================

export interface HITLMetricsSummaryProps {
    summary: HITLMetricsSummary;
    className?: string;
}

export const HITLMetricsSummaryCard = memo(function HITLMetricsSummaryCard({
    summary,
    className = '',
}: HITLMetricsSummaryProps) {
    return (
        <section
            className={`hitl-metrics-summary ${className}`}
            aria-label="HITL metrics summary"
        >
            <h3 className="hitl-metrics-summary__title">HITL Quality Overview</h3>
            <p className="hitl-metrics-summary__subtitle">Period: {summary.period}</p>

            <div className="hitl-metrics-summary__stats">
                <div className="hitl-metrics-summary__stat">
                    <span className="hitl-metrics-summary__stat-value">
                        {summary.totalOperators}
                    </span>
                    <span className="hitl-metrics-summary__stat-label">Operators</span>
                </div>
                <div className="hitl-metrics-summary__stat">
                    <span className="hitl-metrics-summary__stat-value">
                        {summary.totalDecisions}
                    </span>
                    <span className="hitl-metrics-summary__stat-label">Decisions</span>
                </div>
                <div className="hitl-metrics-summary__stat">
                    <span className="hitl-metrics-summary__stat-value">
                        {formatDuration(summary.avgReviewTimeMs)}
                    </span>
                    <span className="hitl-metrics-summary__stat-label">Avg Review</span>
                </div>
                <div className="hitl-metrics-summary__stat">
                    <span className="hitl-metrics-summary__stat-value">
                        {formatPercentage(summary.avgDetailViewRate)}
                    </span>
                    <span className="hitl-metrics-summary__stat-label">Detail Rate</span>
                </div>
            </div>

            <div className="hitl-metrics-summary__risk-breakdown">
                <h4 className="hitl-metrics-summary__risk-title">Risk Distribution</h4>
                <div className="hitl-metrics-summary__risk-bars">
                    <div className="hitl-metrics-summary__risk-bar">
                        <span
                            className="hitl-metrics-summary__risk-fill"
                            style={{
                                width: `${(summary.operatorsByRisk.low / summary.totalOperators) * 100}%`,
                                backgroundColor: '#10b981',
                            }}
                        />
                        <span className="hitl-metrics-summary__risk-count">
                            {summary.operatorsByRisk.low} Low
                        </span>
                    </div>
                    <div className="hitl-metrics-summary__risk-bar">
                        <span
                            className="hitl-metrics-summary__risk-fill"
                            style={{
                                width: `${(summary.operatorsByRisk.medium / summary.totalOperators) * 100}%`,
                                backgroundColor: '#f59e0b',
                            }}
                        />
                        <span className="hitl-metrics-summary__risk-count">
                            {summary.operatorsByRisk.medium} Medium
                        </span>
                    </div>
                    <div className="hitl-metrics-summary__risk-bar">
                        <span
                            className="hitl-metrics-summary__risk-fill"
                            style={{
                                width: `${(summary.operatorsByRisk.high / summary.totalOperators) * 100}%`,
                                backgroundColor: '#ef4444',
                            }}
                        />
                        <span className="hitl-metrics-summary__risk-count">
                            {summary.operatorsByRisk.high} High
                        </span>
                    </div>
                </div>
            </div>
        </section>
    );
});

// ============================================================================
// Styles
// ============================================================================

const styles = `
.hitl-metrics {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 16px;
    color: #e2e8f0;
}

.hitl-metrics__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.hitl-metrics__user {
    display: flex;
    align-items: center;
    gap: 8px;
}

.hitl-metrics__user-icon {
    font-size: 1.25rem;
}

.hitl-metrics__user-name {
    font-size: 1rem;
    font-weight: 600;
    color: #f8fafc;
}

.hitl-metrics__risk-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    color: white;
}

.hitl-metrics__period {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.875rem;
    color: #94a3b8;
    margin-bottom: 16px;
}

.hitl-metrics__decisions {
    margin-left: auto;
    color: #64748b;
}

.hitl-metrics__gauges {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
}

.hitl-metrics__gauge {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 6px;
}

.hitl-metrics__gauge-label {
    font-size: 0.75rem;
    color: #64748b;
}

.hitl-metrics__gauge-value {
    font-size: 1.125rem;
    font-weight: 600;
}

.hitl-metrics__actions {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #334155;
    display: flex;
    justify-content: flex-end;
}

.hitl-metrics__btn {
    background: #334155;
    border: none;
    border-radius: 4px;
    color: #e2e8f0;
    padding: 6px 12px;
    font-size: 0.8125rem;
    cursor: pointer;
    transition: background 0.2s;
}

.hitl-metrics__btn:hover {
    background: #475569;
}

/* Summary styles */
.hitl-metrics-summary {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 20px;
    color: #e2e8f0;
}

.hitl-metrics-summary__title {
    margin: 0 0 4px;
    font-size: 1.125rem;
    font-weight: 600;
    color: #f8fafc;
}

.hitl-metrics-summary__subtitle {
    margin: 0 0 16px;
    font-size: 0.875rem;
    color: #64748b;
}

.hitl-metrics-summary__stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 20px;
}

.hitl-metrics-summary__stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
}

.hitl-metrics-summary__stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #f8fafc;
}

.hitl-metrics-summary__stat-label {
    font-size: 0.75rem;
    color: #64748b;
}

.hitl-metrics-summary__risk-breakdown {
    padding-top: 16px;
    border-top: 1px solid #334155;
}

.hitl-metrics-summary__risk-title {
    margin: 0 0 12px;
    font-size: 0.875rem;
    font-weight: 500;
    color: #94a3b8;
}

.hitl-metrics-summary__risk-bars {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.hitl-metrics-summary__risk-bar {
    position: relative;
    height: 24px;
    background: #0f172a;
    border-radius: 4px;
    overflow: hidden;
}

.hitl-metrics-summary__risk-fill {
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    transition: width 0.3s ease;
}

.hitl-metrics-summary__risk-count {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    height: 100%;
    padding-left: 8px;
    font-size: 0.75rem;
    font-weight: 500;
    color: #e2e8f0;
}
`;

if (typeof document !== 'undefined') {
    const styleId = 'hitl-metrics-styles';
    if (!document.getElementById(styleId)) {
        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }
}

export default HITLMetricsCard;
