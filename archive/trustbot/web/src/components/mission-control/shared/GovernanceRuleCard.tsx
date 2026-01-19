/**
 * GovernanceRuleCard Component
 *
 * Story 3.4: Director Governance Rule Approval
 * FRs: FR22
 *
 * Displays governance rule proposals with current vs proposed definitions,
 * impact analysis, and approve/deny workflow for directors.
 */

import { memo, useState, useCallback } from 'react';
import type {
    GovernanceRule,
    GovernanceRuleDefinition,
    GovernanceRuleImpact,
    GovernanceRuleStatus,
    GovernanceRuleType,
} from '../../../types';

// ============================================================================
// Constants
// ============================================================================

export const MIN_REASON_LENGTH = 20;
export const MAX_REASON_LENGTH = 1000;

// ============================================================================
// Helper Functions (exported for testing)
// ============================================================================

export function getRuleTypeLabel(type: GovernanceRuleType): string {
    const labels: Record<GovernanceRuleType, string> = {
        trust_threshold: 'Trust Threshold',
        action_permission: 'Action Permission',
        rate_limit: 'Rate Limit',
        tier_requirement: 'Tier Requirement',
        time_restriction: 'Time Restriction',
    };
    return labels[type] || type;
}

export function getRuleTypeIcon(type: GovernanceRuleType): string {
    const icons: Record<GovernanceRuleType, string> = {
        trust_threshold: '📊',
        action_permission: '🔐',
        rate_limit: '⏱️',
        tier_requirement: '🎖️',
        time_restriction: '🕐',
    };
    return icons[type] || '📋';
}

export function getStatusColor(status: GovernanceRuleStatus): string {
    const colors: Record<GovernanceRuleStatus, string> = {
        draft: '#64748b',
        pending: '#f59e0b',
        approved: '#10b981',
        denied: '#ef4444',
        archived: '#6b7280',
    };
    return colors[status] || '#64748b';
}

export function getRiskLevelColor(level: 'low' | 'medium' | 'high'): string {
    const colors = {
        low: '#10b981',
        medium: '#f59e0b',
        high: '#ef4444',
    };
    return colors[level];
}

export function formatApprovalRateChange(change: number): string {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change}%`;
}

export function validateReason(reason: string): { valid: boolean; error?: string } {
    const trimmed = reason.trim();

    if (!trimmed) {
        return { valid: false, error: 'Decision reason is required' };
    }

    if (trimmed.length < MIN_REASON_LENGTH) {
        return {
            valid: false,
            error: `Reason must be at least ${MIN_REASON_LENGTH} characters (${trimmed.length}/${MIN_REASON_LENGTH})`,
        };
    }

    if (trimmed.length > MAX_REASON_LENGTH) {
        return {
            valid: false,
            error: `Reason must not exceed ${MAX_REASON_LENGTH} characters`,
        };
    }

    return { valid: true };
}

// ============================================================================
// Sub-Components
// ============================================================================

interface RuleDefinitionDisplayProps {
    definition: GovernanceRuleDefinition;
    label: string;
    isProposed?: boolean;
}

const RuleDefinitionDisplay = memo(function RuleDefinitionDisplay({
    definition,
    label,
    isProposed = false,
}: RuleDefinitionDisplayProps) {
    return (
        <div className={`governance-rule__definition ${isProposed ? 'governance-rule__definition--proposed' : ''}`}>
            <h4 className="governance-rule__definition-label">{label}</h4>
            <div className="governance-rule__definition-content">
                <div className="governance-rule__definition-row">
                    <span className="governance-rule__definition-key">Type:</span>
                    <span className="governance-rule__definition-value">
                        {getRuleTypeIcon(definition.type)} {getRuleTypeLabel(definition.type)}
                    </span>
                </div>
                {definition.threshold !== undefined && (
                    <div className="governance-rule__definition-row">
                        <span className="governance-rule__definition-key">Threshold:</span>
                        <span className="governance-rule__definition-value">{definition.threshold}</span>
                    </div>
                )}
                {definition.tierRequired !== undefined && (
                    <div className="governance-rule__definition-row">
                        <span className="governance-rule__definition-key">Required Tier:</span>
                        <span className="governance-rule__definition-value">Tier {definition.tierRequired}</span>
                    </div>
                )}
                {definition.actions && definition.actions.length > 0 && (
                    <div className="governance-rule__definition-row">
                        <span className="governance-rule__definition-key">Actions:</span>
                        <span className="governance-rule__definition-value">
                            {definition.actions.map((a) => a.replace(/_/g, ' ')).join(', ')}
                        </span>
                    </div>
                )}
                {definition.schedule && (
                    <div className="governance-rule__definition-row">
                        <span className="governance-rule__definition-key">Schedule:</span>
                        <span className="governance-rule__definition-value">
                            {definition.schedule.start} - {definition.schedule.end}
                        </span>
                    </div>
                )}
                <div className="governance-rule__definition-row governance-rule__definition-row--description">
                    <span className="governance-rule__definition-key">Description:</span>
                    <span className="governance-rule__definition-value">{definition.description}</span>
                </div>
            </div>
        </div>
    );
});

interface ImpactDisplayProps {
    impact: GovernanceRuleImpact;
}

const ImpactDisplay = memo(function ImpactDisplay({ impact }: ImpactDisplayProps) {
    return (
        <div className="governance-rule__impact" aria-label="Impact analysis">
            <h4 className="governance-rule__impact-title">Impact Analysis</h4>
            <div className="governance-rule__impact-grid">
                <div className="governance-rule__impact-item">
                    <span className="governance-rule__impact-label">Affected Agents</span>
                    <span className="governance-rule__impact-value">{impact.affectedAgentCount}</span>
                </div>
                <div className="governance-rule__impact-item">
                    <span className="governance-rule__impact-label">Approval Rate Change</span>
                    <span
                        className="governance-rule__impact-value"
                        style={{ color: impact.estimatedApprovalRateChange < 0 ? '#ef4444' : '#10b981' }}
                    >
                        {formatApprovalRateChange(impact.estimatedApprovalRateChange)}
                    </span>
                </div>
                <div className="governance-rule__impact-item">
                    <span className="governance-rule__impact-label">Risk Level</span>
                    <span
                        className="governance-rule__impact-value governance-rule__impact-risk"
                        style={{ color: getRiskLevelColor(impact.riskLevel) }}
                    >
                        {impact.riskLevel.toUpperCase()}
                    </span>
                </div>
                <div className="governance-rule__impact-item governance-rule__impact-item--full">
                    <span className="governance-rule__impact-label">Affected Action Types</span>
                    <span className="governance-rule__impact-value">
                        {impact.affectedActionTypes.map((a) => a.replace(/_/g, ' ')).join(', ')}
                    </span>
                </div>
            </div>
        </div>
    );
});

// ============================================================================
// Main Component
// ============================================================================

export interface GovernanceRuleCardProps {
    rule: GovernanceRule;
    onDecide?: (ruleId: string, action: 'approve' | 'deny', reason: string) => Promise<void>;
    isDirector?: boolean;
    isSubmitting?: boolean;
    className?: string;
}

export const GovernanceRuleCard = memo(function GovernanceRuleCard({
    rule,
    onDecide,
    isDirector = false,
    isSubmitting = false,
    className = '',
}: GovernanceRuleCardProps) {
    const [reason, setReason] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [touched, setTouched] = useState(false);
    const [selectedAction, setSelectedAction] = useState<'approve' | 'deny' | null>(null);

    const validation = validateReason(reason);
    const isPending = rule.status === 'pending';
    const canDecide = isDirector && isPending && onDecide;

    const handleReasonChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setReason(e.target.value);
        setError(null);
    }, []);

    const handleReasonBlur = useCallback(() => {
        setTouched(true);
    }, []);

    const handleDecide = useCallback(async (action: 'approve' | 'deny') => {
        setTouched(true);
        setSelectedAction(action);

        const validationResult = validateReason(reason);
        if (!validationResult.valid) {
            setError(validationResult.error || 'Invalid reason');
            return;
        }

        if (!onDecide) return;

        try {
            await onDecide(rule.id, action, reason.trim());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to submit decision');
        }
    }, [reason, onDecide, rule.id]);

    const timeSinceProposal = new Date().getTime() - new Date(rule.proposedAt).getTime();
    const daysSinceProposal = Math.floor(timeSinceProposal / (1000 * 60 * 60 * 24));

    return (
        <article
            className={`governance-rule ${className}`}
            aria-label={`Governance rule: ${rule.name}`}
        >
            {/* Header */}
            <header className="governance-rule__header">
                <div className="governance-rule__header-left">
                    <span className="governance-rule__icon" aria-hidden="true">
                        {getRuleTypeIcon(rule.currentDefinition.type)}
                    </span>
                    <div className="governance-rule__header-text">
                        <h3 className="governance-rule__name">{rule.name}</h3>
                        <span className="governance-rule__version">Version {rule.version}</span>
                    </div>
                </div>
                <span
                    className="governance-rule__status"
                    style={{ backgroundColor: `${getStatusColor(rule.status)}20`, color: getStatusColor(rule.status) }}
                >
                    {rule.status.toUpperCase()}
                </span>
            </header>

            {/* Proposal Info */}
            <div className="governance-rule__proposal-info">
                <p className="governance-rule__proposal-meta">
                    Proposed by <strong>{rule.proposedByName}</strong>
                    {' • '}
                    {daysSinceProposal === 0 ? 'Today' : `${daysSinceProposal} day${daysSinceProposal !== 1 ? 's' : ''} ago`}
                </p>
                <p className="governance-rule__proposal-reason">{rule.proposalReason}</p>
            </div>

            {/* Definitions Comparison */}
            <div className="governance-rule__comparison">
                <RuleDefinitionDisplay
                    definition={rule.currentDefinition}
                    label="Current Rule"
                />
                {rule.proposedDefinition && (
                    <>
                        <div className="governance-rule__comparison-arrow" aria-hidden="true">→</div>
                        <RuleDefinitionDisplay
                            definition={rule.proposedDefinition}
                            label="Proposed Change"
                            isProposed
                        />
                    </>
                )}
            </div>

            {/* Impact Analysis */}
            {rule.impact && <ImpactDisplay impact={rule.impact} />}

            {/* Decision Section (for directors reviewing pending rules) */}
            {canDecide && (
                <div className="governance-rule__decision-section">
                    <label htmlFor={`reason-${rule.id}`} className="governance-rule__reason-label">
                        Decision Reason <span className="governance-rule__required">*</span>
                    </label>
                    <textarea
                        id={`reason-${rule.id}`}
                        className={`governance-rule__reason-textarea ${touched && !validation.valid ? 'governance-rule__reason-textarea--error' : ''}`}
                        value={reason}
                        onChange={handleReasonChange}
                        onBlur={handleReasonBlur}
                        placeholder="Provide justification for your decision..."
                        disabled={isSubmitting}
                        rows={3}
                        maxLength={MAX_REASON_LENGTH}
                        aria-describedby={`reason-hint-${rule.id} reason-error-${rule.id}`}
                        aria-invalid={touched && !validation.valid}
                    />
                    <div className="governance-rule__reason-footer">
                        <span id={`reason-hint-${rule.id}`} className="governance-rule__reason-hint">
                            Minimum {MIN_REASON_LENGTH} characters
                        </span>
                        <span className="governance-rule__reason-count">
                            {reason.trim().length}/{MAX_REASON_LENGTH}
                        </span>
                    </div>
                    {touched && !validation.valid && (
                        <p id={`reason-error-${rule.id}`} className="governance-rule__error" role="alert">
                            {validation.error}
                        </p>
                    )}
                    {error && (
                        <p className="governance-rule__error governance-rule__error--submit" role="alert">
                            {error}
                        </p>
                    )}

                    <div className="governance-rule__actions">
                        <button
                            type="button"
                            className="governance-rule__btn governance-rule__btn--deny"
                            onClick={() => handleDecide('deny')}
                            disabled={isSubmitting || !validation.valid}
                            aria-busy={isSubmitting && selectedAction === 'deny'}
                        >
                            {isSubmitting && selectedAction === 'deny' ? 'Denying...' : 'Deny'}
                        </button>
                        <button
                            type="button"
                            className="governance-rule__btn governance-rule__btn--approve"
                            onClick={() => handleDecide('approve')}
                            disabled={isSubmitting || !validation.valid}
                            aria-busy={isSubmitting && selectedAction === 'approve'}
                        >
                            {isSubmitting && selectedAction === 'approve' ? 'Approving...' : 'Approve'}
                        </button>
                    </div>
                </div>
            )}

            {/* Decision Record (for already decided rules) */}
            {rule.decidedBy && (
                <div className="governance-rule__decision-record">
                    <h4 className="governance-rule__decision-title">
                        {rule.status === 'approved' ? 'Approved' : 'Denied'} by {rule.decidedByName}
                    </h4>
                    <p className="governance-rule__decision-date">
                        {new Date(rule.decidedAt!).toLocaleDateString()} at{' '}
                        {new Date(rule.decidedAt!).toLocaleTimeString()}
                    </p>
                    <p className="governance-rule__decision-reason" aria-label="Decision reason">
                        {rule.decisionReason}
                    </p>
                </div>
            )}
        </article>
    );
});

// ============================================================================
// Styles
// ============================================================================

const styles = `
.governance-rule {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 20px;
    color: #e2e8f0;
}

.governance-rule__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #334155;
}

.governance-rule__header-left {
    display: flex;
    align-items: flex-start;
    gap: 12px;
}

.governance-rule__icon {
    font-size: 1.5rem;
    flex-shrink: 0;
}

.governance-rule__header-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.governance-rule__name {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #f8fafc;
}

.governance-rule__version {
    font-size: 0.8125rem;
    color: #64748b;
}

.governance-rule__status {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 9999px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.governance-rule__proposal-info {
    margin-bottom: 16px;
}

.governance-rule__proposal-meta {
    margin: 0 0 8px;
    font-size: 0.875rem;
    color: #94a3b8;
}

.governance-rule__proposal-reason {
    margin: 0;
    font-size: 0.9375rem;
    color: #e2e8f0;
    font-style: italic;
}

.governance-rule__comparison {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 16px;
    margin-bottom: 16px;
    align-items: start;
}

@media (max-width: 768px) {
    .governance-rule__comparison {
        grid-template-columns: 1fr;
    }
    .governance-rule__comparison-arrow {
        transform: rotate(90deg);
        justify-self: center;
    }
}

.governance-rule__comparison-arrow {
    font-size: 1.5rem;
    color: #64748b;
    align-self: center;
}

.governance-rule__definition {
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 12px;
}

.governance-rule__definition--proposed {
    border-color: #3b82f6;
    background: rgba(59, 130, 246, 0.05);
}

.governance-rule__definition-label {
    margin: 0 0 12px;
    font-size: 0.875rem;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.governance-rule__definition--proposed .governance-rule__definition-label {
    color: #3b82f6;
}

.governance-rule__definition-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.governance-rule__definition-row {
    display: flex;
    gap: 8px;
    font-size: 0.875rem;
}

.governance-rule__definition-row--description {
    flex-direction: column;
    gap: 4px;
}

.governance-rule__definition-key {
    color: #64748b;
    flex-shrink: 0;
}

.governance-rule__definition-value {
    color: #e2e8f0;
}

.governance-rule__impact {
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
}

.governance-rule__impact-title {
    margin: 0 0 12px;
    font-size: 0.875rem;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.governance-rule__impact-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
}

@media (max-width: 600px) {
    .governance-rule__impact-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

.governance-rule__impact-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.governance-rule__impact-item--full {
    grid-column: 1 / -1;
}

.governance-rule__impact-label {
    font-size: 0.75rem;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.03em;
}

.governance-rule__impact-value {
    font-size: 1rem;
    font-weight: 600;
    color: #e2e8f0;
}

.governance-rule__impact-risk {
    text-transform: uppercase;
    font-size: 0.875rem;
}

.governance-rule__decision-section {
    border-top: 1px solid #334155;
    padding-top: 16px;
    margin-top: 16px;
}

.governance-rule__reason-label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: #94a3b8;
    margin-bottom: 8px;
}

.governance-rule__required {
    color: #ef4444;
}

.governance-rule__reason-textarea {
    width: 100%;
    padding: 12px;
    border: 1px solid #334155;
    border-radius: 8px;
    background: #0f172a;
    color: #e2e8f0;
    font-size: 0.9375rem;
    font-family: inherit;
    line-height: 1.5;
    resize: vertical;
    min-height: 80px;
    transition: border-color 0.2s;
}

.governance-rule__reason-textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.governance-rule__reason-textarea--error {
    border-color: #ef4444;
}

.governance-rule__reason-textarea::placeholder {
    color: #64748b;
}

.governance-rule__reason-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 8px;
}

.governance-rule__reason-hint {
    font-size: 0.8125rem;
    color: #64748b;
}

.governance-rule__reason-count {
    font-size: 0.8125rem;
    color: #64748b;
}

.governance-rule__error {
    margin: 8px 0 0;
    font-size: 0.875rem;
    color: #ef4444;
}

.governance-rule__error--submit {
    margin-top: 0;
    padding: 8px 12px;
    background: rgba(239, 68, 68, 0.1);
    border-radius: 4px;
}

.governance-rule__actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 16px;
}

.governance-rule__btn {
    padding: 10px 24px;
    border: none;
    border-radius: 6px;
    font-size: 0.9375rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.governance-rule__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.governance-rule__btn--deny {
    background: #334155;
    color: #e2e8f0;
}

.governance-rule__btn--deny:hover:not(:disabled) {
    background: #475569;
}

.governance-rule__btn--approve {
    background: #10b981;
    color: white;
}

.governance-rule__btn--approve:hover:not(:disabled) {
    background: #059669;
}

.governance-rule__decision-record {
    border-top: 1px solid #334155;
    padding-top: 16px;
    margin-top: 16px;
}

.governance-rule__decision-title {
    margin: 0 0 4px;
    font-size: 0.9375rem;
    font-weight: 600;
    color: #f8fafc;
}

.governance-rule__decision-date {
    margin: 0 0 12px;
    font-size: 0.8125rem;
    color: #64748b;
}

.governance-rule__decision-reason {
    margin: 0;
    font-size: 0.9375rem;
    color: #e2e8f0;
    font-style: italic;
    padding: 12px;
    background: #0f172a;
    border-radius: 6px;
}
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleId = 'governance-rule-card-styles';
    if (!document.getElementById(styleId)) {
        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }
}

export default GovernanceRuleCard;
