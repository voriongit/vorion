/**
 * BiasAlertCard Component
 *
 * Story 4.5: Automation Bias Alerts
 * FRs: FR28
 */

import { memo } from 'react';
import type { AutomationBiasAlert, BiasAlertSeverity, BiasAlertStatus } from '../../../types';

// ============================================================================
// Helper Functions
// ============================================================================

export function getSeverityColor(severity: BiasAlertSeverity): string {
    const colors: Record<BiasAlertSeverity, string> = {
        low: '#f59e0b',
        medium: '#f97316',
        high: '#ef4444',
        critical: '#dc2626',
    };
    return colors[severity];
}

export function getSeverityIcon(severity: BiasAlertSeverity): string {
    const icons: Record<BiasAlertSeverity, string> = {
        low: '⚠️',
        medium: '🔶',
        high: '🔴',
        critical: '⛔',
    };
    return icons[severity];
}

export function getStatusColor(status: BiasAlertStatus): string {
    const colors: Record<BiasAlertStatus, string> = {
        active: '#ef4444',
        acknowledged: '#f59e0b',
        resolved: '#10b981',
        dismissed: '#6b7280',
    };
    return colors[status];
}

export function formatAlertTime(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleString();
}

export function formatRelativeAlertTime(timestamp: string): string {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hr ago`;
    return then.toLocaleDateString();
}

// ============================================================================
// Sub-Components
// ============================================================================

interface SeverityBadgeProps {
    severity: BiasAlertSeverity;
}

export const SeverityBadge = memo(function SeverityBadge({ severity }: SeverityBadgeProps) {
    return (
        <span
            className={`bias-alert__severity bias-alert__severity--${severity}`}
            style={{ backgroundColor: getSeverityColor(severity) }}
            aria-label={`Severity: ${severity}`}
        >
            <span className="bias-alert__severity-icon">{getSeverityIcon(severity)}</span>
            <span className="bias-alert__severity-label">{severity.toUpperCase()}</span>
        </span>
    );
});

interface StatusBadgeProps {
    status: BiasAlertStatus;
}

export const StatusBadge = memo(function StatusBadge({ status }: StatusBadgeProps) {
    return (
        <span
            className={`bias-alert__status bias-alert__status--${status}`}
            style={{ color: getStatusColor(status) }}
        >
            {status}
        </span>
    );
});

interface MetricsDisplayProps {
    metrics: AutomationBiasAlert['metrics'];
}

export const MetricsDisplay = memo(function MetricsDisplay({ metrics }: MetricsDisplayProps) {
    return (
        <div className="bias-alert__metrics" aria-label="Alert metrics">
            <div className="bias-alert__metric">
                <span className="bias-alert__metric-label">Avg Review Time</span>
                <span className="bias-alert__metric-value">
                    {(metrics.avgReviewTimeMs / 1000).toFixed(1)}s
                </span>
            </div>
            <div className="bias-alert__metric">
                <span className="bias-alert__metric-label">Decisions</span>
                <span className="bias-alert__metric-value">{metrics.decisionCount}</span>
            </div>
            <div className="bias-alert__metric">
                <span className="bias-alert__metric-label">Detail View Rate</span>
                <span className="bias-alert__metric-value">
                    {(metrics.detailViewRate * 100).toFixed(0)}%
                </span>
            </div>
        </div>
    );
});

// ============================================================================
// Main Component
// ============================================================================

export interface BiasAlertCardProps {
    alert: AutomationBiasAlert;
    onAcknowledge?: (alertId: string) => void;
    onDismiss?: (alertId: string) => void;
    onViewUser?: (userId: string) => void;
    isAcknowledging?: boolean;
    className?: string;
}

export const BiasAlertCard = memo(function BiasAlertCard({
    alert,
    onAcknowledge,
    onDismiss,
    onViewUser,
    isAcknowledging = false,
    className = '',
}: BiasAlertCardProps) {
    const isActionable = alert.status === 'active';

    return (
        <article
            className={`bias-alert ${className} ${isActionable ? 'bias-alert--actionable' : ''}`}
            aria-label={`Automation bias alert for ${alert.userName}`}
            style={{ borderLeftColor: getSeverityColor(alert.severity) }}
        >
            <div className="bias-alert__header">
                <SeverityBadge severity={alert.severity} />
                <StatusBadge status={alert.status} />
                <span
                    className="bias-alert__time"
                    title={formatAlertTime(alert.detectedAt)}
                >
                    {formatRelativeAlertTime(alert.detectedAt)}
                </span>
            </div>

            <div className="bias-alert__content">
                <div className="bias-alert__user">
                    <span className="bias-alert__user-icon" aria-hidden="true">👤</span>
                    <button
                        className="bias-alert__user-name"
                        onClick={() => onViewUser?.(alert.userId)}
                    >
                        {alert.userName}
                    </button>
                </div>

                <p className="bias-alert__reason">{alert.reason}</p>

                <MetricsDisplay metrics={alert.metrics} />
            </div>

            {isActionable && (onAcknowledge || onDismiss) && (
                <div className="bias-alert__actions">
                    {onAcknowledge && (
                        <button
                            className="bias-alert__btn bias-alert__btn--primary"
                            onClick={() => onAcknowledge(alert.id)}
                            disabled={isAcknowledging}
                        >
                            {isAcknowledging ? 'Acknowledging...' : 'Acknowledge'}
                        </button>
                    )}
                    {onDismiss && (
                        <button
                            className="bias-alert__btn bias-alert__btn--secondary"
                            onClick={() => onDismiss(alert.id)}
                        >
                            Dismiss
                        </button>
                    )}
                </div>
            )}
        </article>
    );
});

// ============================================================================
// Alert List Component
// ============================================================================

export interface BiasAlertListProps {
    alerts: AutomationBiasAlert[];
    onAcknowledge?: (alertId: string) => void;
    onDismiss?: (alertId: string) => void;
    onViewUser?: (userId: string) => void;
    acknowledgingId?: string;
    className?: string;
}

export const BiasAlertList = memo(function BiasAlertList({
    alerts,
    onAcknowledge,
    onDismiss,
    onViewUser,
    acknowledgingId,
    className = '',
}: BiasAlertListProps) {
    const activeAlerts = alerts.filter((a) => a.status === 'active');
    const otherAlerts = alerts.filter((a) => a.status !== 'active');

    return (
        <section
            className={`bias-alert-list ${className}`}
            aria-label="Automation bias alerts"
        >
            <div className="bias-alert-list__header">
                <h3 className="bias-alert-list__title">Automation Bias Alerts</h3>
                {activeAlerts.length > 0 && (
                    <span className="bias-alert-list__count">
                        {activeAlerts.length} active
                    </span>
                )}
            </div>

            {alerts.length === 0 ? (
                <div className="bias-alert-list__empty">
                    <span className="bias-alert-list__empty-icon">✓</span>
                    <p className="bias-alert-list__empty-text">No bias alerts detected</p>
                </div>
            ) : (
                <div className="bias-alert-list__alerts">
                    {activeAlerts.map((alert) => (
                        <BiasAlertCard
                            key={alert.id}
                            alert={alert}
                            onAcknowledge={onAcknowledge}
                            onDismiss={onDismiss}
                            onViewUser={onViewUser}
                            isAcknowledging={acknowledgingId === alert.id}
                        />
                    ))}
                    {otherAlerts.length > 0 && activeAlerts.length > 0 && (
                        <div className="bias-alert-list__divider">
                            <span>Past Alerts</span>
                        </div>
                    )}
                    {otherAlerts.map((alert) => (
                        <BiasAlertCard
                            key={alert.id}
                            alert={alert}
                            onViewUser={onViewUser}
                        />
                    ))}
                </div>
            )}
        </section>
    );
});

// ============================================================================
// Styles
// ============================================================================

const styles = `
.bias-alert {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border: 1px solid #334155;
    border-left: 4px solid;
    border-radius: 8px;
    padding: 16px;
    color: #e2e8f0;
    transition: border-color 0.2s;
}

.bias-alert--actionable {
    box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.2);
}

.bias-alert__header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
}

.bias-alert__severity {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    color: white;
}

.bias-alert__status {
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: capitalize;
}

.bias-alert__time {
    margin-left: auto;
    font-size: 0.75rem;
    color: #64748b;
}

.bias-alert__content {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.bias-alert__user {
    display: flex;
    align-items: center;
    gap: 8px;
}

.bias-alert__user-icon {
    font-size: 1.125rem;
}

.bias-alert__user-name {
    background: none;
    border: none;
    color: #3b82f6;
    cursor: pointer;
    font-size: 0.9375rem;
    font-weight: 500;
    padding: 0;
    text-decoration: underline;
}

.bias-alert__user-name:hover {
    color: #60a5fa;
}

.bias-alert__reason {
    margin: 0;
    font-size: 0.875rem;
    color: #94a3b8;
    line-height: 1.5;
}

.bias-alert__metrics {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    padding: 12px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 6px;
}

.bias-alert__metric {
    display: flex;
    flex-direction: column;
    gap: 2px;
    text-align: center;
}

.bias-alert__metric-label {
    font-size: 0.6875rem;
    color: #64748b;
}

.bias-alert__metric-value {
    font-size: 1rem;
    font-weight: 600;
    color: #f8fafc;
}

.bias-alert__actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #334155;
}

.bias-alert__btn {
    flex: 1;
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.bias-alert__btn--primary {
    background: #3b82f6;
    border: none;
    color: white;
}

.bias-alert__btn--primary:hover:not(:disabled) {
    background: #2563eb;
}

.bias-alert__btn--primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.bias-alert__btn--secondary {
    background: transparent;
    border: 1px solid #334155;
    color: #94a3b8;
}

.bias-alert__btn--secondary:hover {
    background: #334155;
    color: #e2e8f0;
}

/* Alert List styles */
.bias-alert-list {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 20px;
    color: #e2e8f0;
}

.bias-alert-list__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
}

.bias-alert-list__title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #f8fafc;
}

.bias-alert-list__count {
    padding: 4px 10px;
    background: rgba(239, 68, 68, 0.2);
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    color: #ef4444;
}

.bias-alert-list__alerts {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.bias-alert-list__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 32px;
    text-align: center;
}

.bias-alert-list__empty-icon {
    font-size: 2rem;
    color: #10b981;
    margin-bottom: 8px;
}

.bias-alert-list__empty-text {
    margin: 0;
    font-size: 0.875rem;
    color: #64748b;
}

.bias-alert-list__divider {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 8px 0;
    font-size: 0.75rem;
    color: #64748b;
}

.bias-alert-list__divider::before,
.bias-alert-list__divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #334155;
}
`;

if (typeof document !== 'undefined') {
    const styleId = 'bias-alert-styles';
    if (!document.getElementById(styleId)) {
        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }
}

export default BiasAlertCard;
