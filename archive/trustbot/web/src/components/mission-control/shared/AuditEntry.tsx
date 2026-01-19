/**
 * AuditEntry Component
 *
 * Story 4.1: Record Review Module - Audit Trail View
 * Story 4.2: Hash Chain Verification Badges
 * Story 4.5: Tamper-Proof Indicators
 * FRs: FR23, FR24, FR30
 */

import { memo } from 'react';
import type { AuditEntry as AuditEntryType, HashStatus, AuditActionType, AuditOutcome } from '../../../types';

// ============================================================================
// Helper Functions
// ============================================================================

export function getActionTypeLabel(type: AuditActionType): string {
    const labels: Record<AuditActionType, string> = {
        decision_approved: 'Decision Approved',
        decision_denied: 'Decision Denied',
        task_started: 'Task Started',
        task_completed: 'Task Completed',
        task_failed: 'Task Failed',
        agent_spawned: 'Agent Spawned',
        agent_terminated: 'Agent Terminated',
        trust_changed: 'Trust Changed',
        override_applied: 'Override Applied',
        investigation_started: 'Investigation Started',
    };
    return labels[type] || type;
}

export function getActionTypeIcon(type: AuditActionType): string {
    const icons: Record<AuditActionType, string> = {
        decision_approved: '✅',
        decision_denied: '❌',
        task_started: '▶️',
        task_completed: '✔️',
        task_failed: '⚠️',
        agent_spawned: '🤖',
        agent_terminated: '🛑',
        trust_changed: '📊',
        override_applied: '🔄',
        investigation_started: '🔍',
    };
    return icons[type] || '📋';
}

export function getOutcomeColor(outcome: AuditOutcome): string {
    const colors: Record<AuditOutcome, string> = {
        success: '#10b981',
        failure: '#ef4444',
        pending: '#f59e0b',
        cancelled: '#6b7280',
    };
    return colors[outcome];
}

export function getHashStatusColor(status: HashStatus): string {
    const colors: Record<HashStatus, string> = {
        verified: '#10b981',
        unverified: '#6b7280',
        invalid: '#ef4444',
        checking: '#3b82f6',
    };
    return colors[status];
}

export function getHashStatusIcon(status: HashStatus): string {
    const icons: Record<HashStatus, string> = {
        verified: '🔒✓',
        unverified: '🔒',
        invalid: '🔓⚠',
        checking: '🔒⏳',
    };
    return icons[status];
}

export function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleString();
}

export function formatRelativeTime(timestamp: string): string {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
}

// ============================================================================
// Sub-Components
// ============================================================================

interface HashBadgeProps {
    status: HashStatus;
    onVerify?: () => void;
    isVerifying?: boolean;
}

export const HashBadge = memo(function HashBadge({ status, onVerify, isVerifying }: HashBadgeProps) {
    return (
        <button
            className={`audit-entry__hash-badge audit-entry__hash-badge--${status}`}
            onClick={onVerify}
            disabled={isVerifying}
            title={`Hash status: ${status}`}
            aria-label={`Hash ${status}. Click to verify.`}
            style={{ color: getHashStatusColor(status) }}
        >
            <span className="audit-entry__hash-icon">{getHashStatusIcon(status)}</span>
            <span className="audit-entry__hash-label">{status}</span>
        </button>
    );
});

interface TamperProofIndicatorProps {
    verified: boolean;
    chainIntact: boolean;
}

export const TamperProofIndicator = memo(function TamperProofIndicator({
    verified,
    chainIntact,
}: TamperProofIndicatorProps) {
    const isSecure = verified && chainIntact;
    return (
        <div
            className={`audit-entry__tamper-indicator ${isSecure ? 'audit-entry__tamper-indicator--secure' : 'audit-entry__tamper-indicator--warning'}`}
            title={isSecure ? 'Tamper-proof: Hash verified, chain intact' : 'Warning: Verification needed'}
            aria-label={isSecure ? 'Entry is tamper-proof' : 'Entry requires verification'}
        >
            <span className="audit-entry__tamper-icon">{isSecure ? '🔐' : '⚠️'}</span>
        </div>
    );
});

// ============================================================================
// Main Component
// ============================================================================

export interface AuditEntryProps {
    entry: AuditEntryType;
    onVerifyHash?: (entryId: string) => void;
    onViewAccountability?: (entryId: string) => void;
    onAgentClick?: (agentId: string) => void;
    isVerifying?: boolean;
    className?: string;
}

export const AuditEntry = memo(function AuditEntry({
    entry,
    onVerifyHash,
    onViewAccountability,
    onAgentClick,
    isVerifying = false,
    className = '',
}: AuditEntryProps) {
    return (
        <article
            className={`audit-entry ${className}`}
            aria-label={`Audit entry: ${getActionTypeLabel(entry.actionType)}`}
        >
            <div className="audit-entry__header">
                <div className="audit-entry__timestamp">
                    <time dateTime={entry.timestamp} title={formatTimestamp(entry.timestamp)}>
                        {formatRelativeTime(entry.timestamp)}
                    </time>
                </div>
                <TamperProofIndicator
                    verified={entry.hashStatus === 'verified'}
                    chainIntact={true}
                />
            </div>

            <div className="audit-entry__content">
                <div className="audit-entry__action">
                    <span className="audit-entry__action-icon" aria-hidden="true">
                        {getActionTypeIcon(entry.actionType)}
                    </span>
                    <span className="audit-entry__action-label">
                        {getActionTypeLabel(entry.actionType)}
                    </span>
                </div>

                <button
                    className="audit-entry__agent"
                    onClick={() => onAgentClick?.(entry.agentId)}
                    title={`View agent: ${entry.agentName}`}
                >
                    {entry.agentName}
                </button>

                <p className="audit-entry__details">{entry.actionDetails}</p>

                <div className="audit-entry__meta">
                    <span
                        className="audit-entry__outcome"
                        style={{ color: getOutcomeColor(entry.outcome) }}
                    >
                        {entry.outcome.toUpperCase()}
                    </span>
                    <HashBadge
                        status={entry.hashStatus}
                        onVerify={() => onVerifyHash?.(entry.id)}
                        isVerifying={isVerifying}
                    />
                </div>
            </div>

            <div className="audit-entry__actions">
                <button
                    className="audit-entry__btn"
                    onClick={() => onViewAccountability?.(entry.id)}
                    title="View accountability chain"
                >
                    View Chain
                </button>
            </div>
        </article>
    );
});

// ============================================================================
// Styles
// ============================================================================

const styles = `
.audit-entry {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 16px;
    color: #e2e8f0;
    transition: border-color 0.2s;
}

.audit-entry:hover {
    border-color: #475569;
}

.audit-entry__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.audit-entry__timestamp {
    font-size: 0.8125rem;
    color: #64748b;
}

.audit-entry__tamper-indicator {
    font-size: 1rem;
}

.audit-entry__content {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.audit-entry__action {
    display: flex;
    align-items: center;
    gap: 8px;
}

.audit-entry__action-icon {
    font-size: 1.25rem;
}

.audit-entry__action-label {
    font-size: 1rem;
    font-weight: 600;
    color: #f8fafc;
}

.audit-entry__agent {
    background: none;
    border: none;
    color: #3b82f6;
    cursor: pointer;
    font-size: 0.875rem;
    padding: 0;
    text-align: left;
    text-decoration: underline;
}

.audit-entry__agent:hover {
    color: #60a5fa;
}

.audit-entry__details {
    margin: 0;
    font-size: 0.875rem;
    color: #94a3b8;
}

.audit-entry__meta {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 8px;
}

.audit-entry__outcome {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.audit-entry__hash-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    background: rgba(51, 65, 85, 0.5);
    border: 1px solid #334155;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
}

.audit-entry__hash-badge:hover:not(:disabled) {
    background: rgba(51, 65, 85, 0.8);
}

.audit-entry__hash-badge:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.audit-entry__hash-icon {
    font-size: 0.875rem;
}

.audit-entry__hash-label {
    text-transform: uppercase;
    letter-spacing: 0.03em;
}

.audit-entry__actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #334155;
}

.audit-entry__btn {
    background: #334155;
    border: none;
    border-radius: 4px;
    color: #e2e8f0;
    padding: 6px 12px;
    font-size: 0.8125rem;
    cursor: pointer;
    transition: background 0.2s;
}

.audit-entry__btn:hover {
    background: #475569;
}
`;

if (typeof document !== 'undefined') {
    const styleId = 'audit-entry-styles';
    if (!document.getElementById(styleId)) {
        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }
}

export default AuditEntry;
