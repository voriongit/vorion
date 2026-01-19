/**
 * InvestigationCard Component
 *
 * Epic 6: Investigation Management
 * Story 6.1: Initiate Investigation (FR31)
 * Story 6.2: Expand Investigation Scope (FR32)
 * Story 6.3: Link Related Events (FR33)
 * Story 6.4: Rollback Review Capability (FR34)
 * Story 6.5: Pattern Anomaly Detection (FR35)
 */

import { memo, useState } from 'react';
import type {
    Investigation,
    InvestigationStatus,
    InvestigationPriority,
    InvestigationType,
    PatternAnomaly,
    RollbackRecord,
    LinkedEvent,
} from '../../../types';

// ============================================================================
// Helper Functions
// ============================================================================

export function getStatusColor(status: InvestigationStatus): string {
    const colors: Record<InvestigationStatus, string> = {
        open: '#3b82f6',
        in_progress: '#f59e0b',
        pending_review: '#8b5cf6',
        closed: '#10b981',
        merged: '#6b7280',
    };
    return colors[status];
}

export function getStatusIcon(status: InvestigationStatus): string {
    const icons: Record<InvestigationStatus, string> = {
        open: '📂',
        in_progress: '🔍',
        pending_review: '⏳',
        closed: '✅',
        merged: '🔗',
    };
    return icons[status];
}

export function getPriorityColor(priority: InvestigationPriority): string {
    const colors: Record<InvestigationPriority, string> = {
        low: '#10b981',
        medium: '#f59e0b',
        high: '#f97316',
        critical: '#ef4444',
    };
    return colors[priority];
}

export function getTypeLabel(type: InvestigationType): string {
    const labels: Record<InvestigationType, string> = {
        suspicious_activity: 'Suspicious Activity',
        trust_violation: 'Trust Violation',
        data_anomaly: 'Data Anomaly',
        pattern_alert: 'Pattern Alert',
        manual: 'Manual Investigation',
    };
    return labels[type];
}

export function formatTimeAgo(timestamp: string): string {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return then.toLocaleDateString();
}

// ============================================================================
// Sub-Components
// ============================================================================

interface PriorityBadgeProps {
    priority: InvestigationPriority;
}

export const PriorityBadge = memo(function PriorityBadge({ priority }: PriorityBadgeProps) {
    return (
        <span
            className="investigation__priority"
            style={{ backgroundColor: getPriorityColor(priority) }}
            aria-label={`Priority: ${priority}`}
        >
            {priority.toUpperCase()}
        </span>
    );
});

interface StatusBadgeProps {
    status: InvestigationStatus;
}

export const StatusBadge = memo(function StatusBadge({ status }: StatusBadgeProps) {
    return (
        <span
            className="investigation__status"
            style={{ color: getStatusColor(status) }}
        >
            {getStatusIcon(status)} {status.replace('_', ' ')}
        </span>
    );
});

interface AnomalyCardProps {
    anomaly: PatternAnomaly;
    onUpdateStatus?: (id: string, status: string) => void;
}

export const AnomalyCard = memo(function AnomalyCard({ anomaly, onUpdateStatus }: AnomalyCardProps) {
    return (
        <div className="investigation__anomaly" aria-label={`Anomaly: ${anomaly.pattern}`}>
            <div className="investigation__anomaly-header">
                <span
                    className="investigation__anomaly-severity"
                    style={{ backgroundColor: getPriorityColor(anomaly.severity as InvestigationPriority) }}
                >
                    {anomaly.severity.toUpperCase()}
                </span>
                <span className="investigation__anomaly-time">
                    {formatTimeAgo(anomaly.detectedAt)}
                </span>
            </div>
            <p className="investigation__anomaly-desc">{anomaly.description}</p>
            <div className="investigation__anomaly-baseline">
                <span>Expected: {(anomaly.baseline.expectedValue * 100).toFixed(0)}%</span>
                <span>Actual: {(anomaly.baseline.actualValue * 100).toFixed(0)}%</span>
                <span className="investigation__anomaly-deviation">
                    +{anomaly.baseline.deviationPercent}%
                </span>
            </div>
            {onUpdateStatus && anomaly.status !== 'confirmed' && anomaly.status !== 'dismissed' && (
                <div className="investigation__anomaly-actions">
                    <button onClick={() => onUpdateStatus(anomaly.id, 'confirmed')}>Confirm</button>
                    <button onClick={() => onUpdateStatus(anomaly.id, 'dismissed')}>Dismiss</button>
                </div>
            )}
        </div>
    );
});

interface RollbackCardProps {
    rollback: RollbackRecord;
}

export const RollbackCard = memo(function RollbackCard({ rollback }: RollbackCardProps) {
    const statusColors = { pending: '#f59e0b', completed: '#10b981', failed: '#ef4444' };
    return (
        <div className="investigation__rollback">
            <div className="investigation__rollback-header">
                <span
                    className="investigation__rollback-status"
                    style={{ color: statusColors[rollback.status as keyof typeof statusColors] }}
                >
                    {rollback.status.toUpperCase()}
                </span>
                <span className="investigation__rollback-time">
                    {formatTimeAgo(rollback.rolledBackAt)}
                </span>
            </div>
            <p className="investigation__rollback-reason">{rollback.reason}</p>
            <div className="investigation__rollback-details">
                <span>Decision: {rollback.decisionId}</span>
                <span>Affected: {rollback.affectedRecords} records</span>
            </div>
        </div>
    );
});

interface LinkedEventCardProps {
    event: LinkedEvent;
}

export const LinkedEventCard = memo(function LinkedEventCard({ event }: LinkedEventCardProps) {
    const relationColors = { related: '#3b82f6', cause: '#f97316', effect: '#10b981', duplicate: '#6b7280' };
    return (
        <div className="investigation__linked-event">
            <span
                className="investigation__linked-event-relation"
                style={{ backgroundColor: relationColors[event.relationship] }}
            >
                {event.relationship}
            </span>
            <span className="investigation__linked-event-type">{event.eventType}</span>
            <span className="investigation__linked-event-id">{event.eventId}</span>
            {event.notes && <p className="investigation__linked-event-notes">{event.notes}</p>}
        </div>
    );
});

// ============================================================================
// Main Component
// ============================================================================

export interface InvestigationCardProps {
    investigation: Investigation;
    onViewDetails?: (id: string) => void;
    onExpandScope?: (id: string) => void;
    onLinkEvent?: (id: string) => void;
    onRequestRollback?: (id: string) => void;
    onUpdateAnomalyStatus?: (investigationId: string, anomalyId: string, status: string) => void;
    expanded?: boolean;
    className?: string;
}

export const InvestigationCard = memo(function InvestigationCard({
    investigation,
    onViewDetails,
    onExpandScope,
    onLinkEvent,
    onRequestRollback,
    onUpdateAnomalyStatus,
    expanded = false,
    className = '',
}: InvestigationCardProps) {
    const [isExpanded, setIsExpanded] = useState(expanded);

    return (
        <article
            className={`investigation ${className}`}
            aria-label={`Investigation: ${investigation.title}`}
        >
            <div className="investigation__header">
                <div className="investigation__title-row">
                    <PriorityBadge priority={investigation.priority} />
                    <h3 className="investigation__title">{investigation.title}</h3>
                </div>
                <StatusBadge status={investigation.status} />
            </div>

            <div className="investigation__meta">
                <span className="investigation__type">{getTypeLabel(investigation.type)}</span>
                <span className="investigation__created">
                    Created {formatTimeAgo(investigation.createdAt)}
                </span>
                {investigation.assignedTo && (
                    <span className="investigation__assignee">
                        Assigned to: {investigation.assignedTo}
                    </span>
                )}
            </div>

            <p className="investigation__description">{investigation.description}</p>

            <div className="investigation__scope">
                <span className="investigation__scope-label">Scope:</span>
                <span className="investigation__scope-agents">
                    {investigation.scope.agentIds.length} agent(s)
                </span>
                {investigation.scope.expanded && (
                    <span className="investigation__scope-expanded">🔄 Expanded</span>
                )}
            </div>

            <div className="investigation__stats">
                <div className="investigation__stat">
                    <span className="investigation__stat-value">{investigation.linkedEvents.length}</span>
                    <span className="investigation__stat-label">Linked Events</span>
                </div>
                <div className="investigation__stat">
                    <span className="investigation__stat-value">{investigation.findings.length}</span>
                    <span className="investigation__stat-label">Findings</span>
                </div>
                <div className="investigation__stat">
                    <span className="investigation__stat-value">{investigation.rollbacks.length}</span>
                    <span className="investigation__stat-label">Rollbacks</span>
                </div>
                <div className="investigation__stat">
                    <span className="investigation__stat-value">{investigation.anomalies.length}</span>
                    <span className="investigation__stat-label">Anomalies</span>
                </div>
            </div>

            {isExpanded && (
                <div className="investigation__details">
                    {investigation.anomalies.length > 0 && (
                        <div className="investigation__section">
                            <h4>Pattern Anomalies</h4>
                            {investigation.anomalies.map((anomaly) => (
                                <AnomalyCard
                                    key={anomaly.id}
                                    anomaly={anomaly}
                                    onUpdateStatus={
                                        onUpdateAnomalyStatus
                                            ? (anomalyId, status) =>
                                                  onUpdateAnomalyStatus(investigation.id, anomalyId, status)
                                            : undefined
                                    }
                                />
                            ))}
                        </div>
                    )}

                    {investigation.rollbacks.length > 0 && (
                        <div className="investigation__section">
                            <h4>Rollbacks</h4>
                            {investigation.rollbacks.map((rollback) => (
                                <RollbackCard key={rollback.id} rollback={rollback} />
                            ))}
                        </div>
                    )}

                    {investigation.linkedEvents.length > 0 && (
                        <div className="investigation__section">
                            <h4>Linked Events</h4>
                            {investigation.linkedEvents.map((event) => (
                                <LinkedEventCard key={event.id} event={event} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="investigation__actions">
                <button
                    className="investigation__btn investigation__btn--toggle"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    {isExpanded ? 'Collapse' : 'Expand'}
                </button>

                {onViewDetails && (
                    <button
                        className="investigation__btn"
                        onClick={() => onViewDetails(investigation.id)}
                    >
                        View Details
                    </button>
                )}

                {onExpandScope && investigation.status !== 'closed' && (
                    <button
                        className="investigation__btn"
                        onClick={() => onExpandScope(investigation.id)}
                    >
                        Expand Scope
                    </button>
                )}

                {onLinkEvent && investigation.status !== 'closed' && (
                    <button
                        className="investigation__btn"
                        onClick={() => onLinkEvent(investigation.id)}
                    >
                        Link Event
                    </button>
                )}

                {onRequestRollback && investigation.status !== 'closed' && (
                    <button
                        className="investigation__btn investigation__btn--warning"
                        onClick={() => onRequestRollback(investigation.id)}
                    >
                        Request Rollback
                    </button>
                )}
            </div>
        </article>
    );
});

// ============================================================================
// List Component
// ============================================================================

export interface InvestigationListProps {
    investigations: Investigation[];
    onViewDetails?: (id: string) => void;
    onExpandScope?: (id: string) => void;
    onLinkEvent?: (id: string) => void;
    onRequestRollback?: (id: string) => void;
    onUpdateAnomalyStatus?: (investigationId: string, anomalyId: string, status: string) => void;
    className?: string;
}

export const InvestigationList = memo(function InvestigationList({
    investigations,
    onViewDetails,
    onExpandScope,
    onLinkEvent,
    onRequestRollback,
    onUpdateAnomalyStatus,
    className = '',
}: InvestigationListProps) {
    const openInvestigations = investigations.filter((inv) => inv.status !== 'closed' && inv.status !== 'merged');
    const closedInvestigations = investigations.filter((inv) => inv.status === 'closed' || inv.status === 'merged');

    return (
        <section className={`investigation-list ${className}`} aria-label="Investigations">
            <div className="investigation-list__header">
                <h2 className="investigation-list__title">Investigations</h2>
                <span className="investigation-list__count">
                    {openInvestigations.length} open
                </span>
            </div>

            {investigations.length === 0 ? (
                <div className="investigation-list__empty">
                    <span className="investigation-list__empty-icon">🔍</span>
                    <p>No investigations found</p>
                </div>
            ) : (
                <div className="investigation-list__items">
                    {openInvestigations.map((inv) => (
                        <InvestigationCard
                            key={inv.id}
                            investigation={inv}
                            onViewDetails={onViewDetails}
                            onExpandScope={onExpandScope}
                            onLinkEvent={onLinkEvent}
                            onRequestRollback={onRequestRollback}
                            onUpdateAnomalyStatus={onUpdateAnomalyStatus}
                        />
                    ))}
                    {closedInvestigations.length > 0 && openInvestigations.length > 0 && (
                        <div className="investigation-list__divider">Closed Investigations</div>
                    )}
                    {closedInvestigations.map((inv) => (
                        <InvestigationCard
                            key={inv.id}
                            investigation={inv}
                            onViewDetails={onViewDetails}
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
.investigation {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 16px;
    color: #e2e8f0;
}

.investigation__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
}

.investigation__title-row {
    display: flex;
    align-items: center;
    gap: 12px;
}

.investigation__priority {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.6875rem;
    font-weight: 700;
    color: white;
}

.investigation__title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #f8fafc;
}

.investigation__status {
    font-size: 0.8125rem;
    font-weight: 500;
    text-transform: capitalize;
}

.investigation__meta {
    display: flex;
    gap: 16px;
    font-size: 0.8125rem;
    color: #64748b;
    margin-bottom: 12px;
}

.investigation__type {
    padding: 2px 8px;
    background: #334155;
    border-radius: 4px;
}

.investigation__description {
    margin: 0 0 12px;
    font-size: 0.875rem;
    color: #94a3b8;
    line-height: 1.5;
}

.investigation__scope {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8125rem;
    color: #94a3b8;
    margin-bottom: 16px;
}

.investigation__scope-expanded {
    color: #3b82f6;
}

.investigation__stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    padding: 12px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 6px;
    margin-bottom: 16px;
}

.investigation__stat {
    text-align: center;
}

.investigation__stat-value {
    display: block;
    font-size: 1.25rem;
    font-weight: 700;
    color: #f8fafc;
}

.investigation__stat-label {
    font-size: 0.6875rem;
    color: #64748b;
}

.investigation__details {
    margin-bottom: 16px;
}

.investigation__section {
    margin-bottom: 16px;
}

.investigation__section h4 {
    margin: 0 0 12px;
    font-size: 0.875rem;
    font-weight: 600;
    color: #94a3b8;
}

.investigation__anomaly,
.investigation__rollback,
.investigation__linked-event {
    padding: 12px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 6px;
    margin-bottom: 8px;
}

.investigation__anomaly-header,
.investigation__rollback-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
}

.investigation__anomaly-severity,
.investigation__linked-event-relation {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.6875rem;
    font-weight: 600;
    color: white;
}

.investigation__anomaly-time,
.investigation__rollback-time {
    font-size: 0.75rem;
    color: #64748b;
}

.investigation__anomaly-desc,
.investigation__rollback-reason {
    margin: 0 0 8px;
    font-size: 0.8125rem;
    color: #94a3b8;
}

.investigation__anomaly-baseline {
    display: flex;
    gap: 16px;
    font-size: 0.75rem;
    color: #64748b;
}

.investigation__anomaly-deviation {
    color: #ef4444;
    font-weight: 600;
}

.investigation__anomaly-actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
}

.investigation__anomaly-actions button {
    padding: 4px 12px;
    background: #334155;
    border: none;
    border-radius: 4px;
    color: #e2e8f0;
    font-size: 0.75rem;
    cursor: pointer;
}

.investigation__rollback-status {
    font-size: 0.6875rem;
    font-weight: 600;
}

.investigation__rollback-details {
    display: flex;
    gap: 16px;
    font-size: 0.75rem;
    color: #64748b;
}

.investigation__linked-event {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
}

.investigation__linked-event-type {
    font-size: 0.75rem;
    color: #94a3b8;
}

.investigation__linked-event-id {
    font-family: monospace;
    font-size: 0.75rem;
    color: #64748b;
}

.investigation__linked-event-notes {
    width: 100%;
    margin: 8px 0 0;
    font-size: 0.75rem;
    color: #64748b;
    font-style: italic;
}

.investigation__actions {
    display: flex;
    gap: 8px;
    padding-top: 12px;
    border-top: 1px solid #334155;
    flex-wrap: wrap;
}

.investigation__btn {
    padding: 6px 12px;
    background: #334155;
    border: none;
    border-radius: 4px;
    color: #e2e8f0;
    font-size: 0.8125rem;
    cursor: pointer;
    transition: background 0.2s;
}

.investigation__btn:hover {
    background: #475569;
}

.investigation__btn--toggle {
    background: transparent;
    border: 1px solid #334155;
}

.investigation__btn--warning {
    background: #f97316;
    color: white;
}

.investigation__btn--warning:hover {
    background: #ea580c;
}

/* List styles */
.investigation-list {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 20px;
    color: #e2e8f0;
}

.investigation-list__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
}

.investigation-list__title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #f8fafc;
}

.investigation-list__count {
    padding: 4px 10px;
    background: rgba(59, 130, 246, 0.2);
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    color: #3b82f6;
}

.investigation-list__items {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.investigation-list__divider {
    padding: 8px 0;
    font-size: 0.75rem;
    color: #64748b;
    text-align: center;
    border-top: 1px solid #334155;
    margin-top: 8px;
}

.investigation-list__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 48px;
    text-align: center;
}

.investigation-list__empty-icon {
    font-size: 3rem;
    margin-bottom: 12px;
}

.investigation-list__empty p {
    margin: 0;
    color: #64748b;
}
`;

if (typeof document !== 'undefined') {
    const styleId = 'investigation-card-styles';
    if (!document.getElementById(styleId)) {
        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }
}

export default InvestigationCard;
