/**
 * TrustGateExplanation Component
 *
 * Story 3.2: Trust Gate Decision Explanations
 * FRs: FR20
 *
 * Displays why an action was routed to HITL review, showing which
 * governance rules triggered the review and threshold comparisons.
 */

import { memo } from 'react';
import type { TrustGateExplanation as TrustGateExplanationType, TrustGateRule, TrustGateRuleType } from '../../../types';

// ============================================================================
// Helper Functions (exported for testing)
// ============================================================================

export function getRuleIcon(type: TrustGateRuleType): string {
    switch (type) {
        case 'trust_score_threshold':
            return '📊';
        case 'risk_level':
            return '⚠️';
        case 'action_type':
            return '🎯';
        case 'tier_permission':
            return '🔒';
        case 'rate_limit':
            return '⏱️';
        case 'first_time_action':
            return '🆕';
        default:
            return '📋';
    }
}

export function getRuleColor(type: TrustGateRuleType): string {
    switch (type) {
        case 'trust_score_threshold':
            return '#f59e0b'; // warning/amber
        case 'risk_level':
            return '#ef4444'; // error/red
        case 'action_type':
            return '#8b5cf6'; // purple
        case 'tier_permission':
            return '#3b82f6'; // primary/blue
        case 'rate_limit':
            return '#6366f1'; // indigo
        case 'first_time_action':
            return '#10b981'; // success/green
        default:
            return '#6b7280'; // muted/gray
    }
}

export function getRuleTypeLabel(type: TrustGateRuleType): string {
    switch (type) {
        case 'trust_score_threshold':
            return 'Trust Score';
        case 'risk_level':
            return 'Risk Level';
        case 'action_type':
            return 'Action Type';
        case 'tier_permission':
            return 'Tier Permission';
        case 'rate_limit':
            return 'Rate Limit';
        case 'first_time_action':
            return 'First Time';
        default:
            return 'Rule';
    }
}

export function formatThresholdComparison(rule: TrustGateRule): string | null {
    if (rule.threshold === undefined || rule.currentValue === undefined) {
        return null;
    }
    return `${rule.currentValue} / ${rule.threshold}`;
}

export function getThresholdPercentage(rule: TrustGateRule): number | null {
    if (rule.threshold === undefined || rule.currentValue === undefined) {
        return null;
    }
    return Math.min(100, Math.round((rule.currentValue / rule.threshold) * 100));
}

// ============================================================================
// Sub-Components
// ============================================================================

interface RuleCardProps {
    rule: TrustGateRule;
}

const RuleCard = memo(function RuleCard({ rule }: RuleCardProps) {
    const icon = getRuleIcon(rule.type);
    const color = getRuleColor(rule.type);
    const typeLabel = getRuleTypeLabel(rule.type);
    const thresholdComparison = formatThresholdComparison(rule);
    const percentage = getThresholdPercentage(rule);

    return (
        <li
            className={`trust-gate-rule ${rule.isPrimary ? 'trust-gate-rule--primary' : ''}`}
            aria-label={`${rule.name}${rule.isPrimary ? ' (Primary trigger)' : ''}`}
        >
            <div className="trust-gate-rule__header">
                <span className="trust-gate-rule__icon" aria-hidden="true">
                    {icon}
                </span>
                <span
                    className="trust-gate-rule__type"
                    style={{ backgroundColor: `${color}20`, color }}
                    aria-label={`Rule type: ${typeLabel}`}
                >
                    {typeLabel}
                </span>
                {rule.isPrimary && (
                    <span
                        className="trust-gate-rule__primary-badge"
                        aria-label="Primary trigger"
                    >
                        Primary
                    </span>
                )}
            </div>

            <h4 className="trust-gate-rule__name">{rule.name}</h4>
            <p className="trust-gate-rule__description">{rule.description}</p>

            {thresholdComparison && percentage !== null && (
                <div className="trust-gate-rule__threshold" aria-label={`Threshold comparison: ${thresholdComparison}`}>
                    <div className="trust-gate-rule__threshold-bar">
                        <div
                            className="trust-gate-rule__threshold-fill"
                            style={{
                                width: `${percentage}%`,
                                backgroundColor: percentage < 100 ? '#ef4444' : '#10b981',
                            }}
                            role="progressbar"
                            aria-valuenow={rule.currentValue}
                            aria-valuemin={0}
                            aria-valuemax={rule.threshold}
                        />
                    </div>
                    <span className="trust-gate-rule__threshold-text">
                        {thresholdComparison}
                    </span>
                </div>
            )}
        </li>
    );
});

// ============================================================================
// Main Component
// ============================================================================

export interface TrustGateExplanationProps {
    explanation: TrustGateExplanationType;
    className?: string;
    isLoading?: boolean;
    error?: string;
    showAgentInfo?: boolean;
}

export const TrustGateExplanation = memo(function TrustGateExplanation({
    explanation,
    className = '',
    isLoading = false,
    error,
    showAgentInfo = true,
}: TrustGateExplanationProps) {
    // Loading state
    if (isLoading) {
        return (
            <div
                className={`trust-gate-explanation trust-gate-explanation--loading ${className}`}
                aria-label="Loading trust gate explanation"
                aria-busy="true"
            >
                <div className="trust-gate-explanation__skeleton" />
                <div className="trust-gate-explanation__skeleton trust-gate-explanation__skeleton--short" />
                <div className="trust-gate-explanation__skeleton" />
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div
                className={`trust-gate-explanation trust-gate-explanation--error ${className}`}
                role="alert"
            >
                <span className="trust-gate-explanation__error-icon">⚠️</span>
                <span>{error}</span>
            </div>
        );
    }

    // Sort rules to show primary first
    const sortedRules = [...explanation.rules].sort((a, b) => {
        if (a.isPrimary && !b.isPrimary) return -1;
        if (!a.isPrimary && b.isPrimary) return 1;
        return 0;
    });

    const primaryRule = sortedRules.find(r => r.isPrimary);

    return (
        <section
            className={`trust-gate-explanation ${className}`}
            aria-label="Trust Gate Explanation"
        >
            {/* Header */}
            <header className="trust-gate-explanation__header">
                <h3 className="trust-gate-explanation__title">
                    <span className="trust-gate-explanation__title-icon" aria-hidden="true">🚦</span>
                    Trust Gate Explanation
                </h3>
                <span className="trust-gate-explanation__rule-count">
                    {explanation.rules.length} rule{explanation.rules.length !== 1 ? 's' : ''} triggered
                </span>
            </header>

            {/* Agent Info */}
            {showAgentInfo && (
                <div className="trust-gate-explanation__agent" aria-label="Agent information">
                    <div className="trust-gate-explanation__agent-name">
                        <span className="trust-gate-explanation__agent-label">Agent:</span>
                        <span>{explanation.agentName}</span>
                    </div>
                    <div className="trust-gate-explanation__agent-stats">
                        <span
                            className="trust-gate-explanation__agent-tier"
                            aria-label={`Tier ${explanation.agentTier}`}
                        >
                            Tier {explanation.agentTier}
                        </span>
                        <span
                            className="trust-gate-explanation__agent-score"
                            aria-label={`Trust score ${explanation.agentTrustScore}`}
                        >
                            Score: {explanation.agentTrustScore}
                        </span>
                    </div>
                </div>
            )}

            {/* Summary */}
            <p className="trust-gate-explanation__summary">{explanation.summary}</p>

            {/* Primary Trigger Callout */}
            {primaryRule && (
                <div className="trust-gate-explanation__primary-callout" aria-label="Primary trigger">
                    <span className="trust-gate-explanation__primary-icon" aria-hidden="true">
                        {getRuleIcon(primaryRule.type)}
                    </span>
                    <div className="trust-gate-explanation__primary-content">
                        <span className="trust-gate-explanation__primary-label">Primary Trigger:</span>
                        <span className="trust-gate-explanation__primary-name">{primaryRule.name}</span>
                    </div>
                </div>
            )}

            {/* Rules List */}
            <div className="trust-gate-explanation__rules-section">
                <h4 className="trust-gate-explanation__rules-header">
                    Triggered Rules ({explanation.rules.length})
                </h4>
                <ul
                    className="trust-gate-explanation__rules"
                    aria-label="Trust gate rules"
                >
                    {sortedRules.map(rule => (
                        <RuleCard key={rule.id} rule={rule} />
                    ))}
                </ul>
            </div>
        </section>
    );
});

// ============================================================================
// Styles
// ============================================================================

const styles = `
.trust-gate-explanation {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 20px;
    color: #e2e8f0;
}

.trust-gate-explanation--loading {
    min-height: 200px;
}

.trust-gate-explanation__skeleton {
    background: linear-gradient(90deg, #334155 0%, #475569 50%, #334155 100%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
    height: 20px;
    margin-bottom: 12px;
}

.trust-gate-explanation__skeleton--short {
    width: 60%;
}

@keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}

.trust-gate-explanation--error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px;
    background: rgba(239, 68, 68, 0.1);
    border-color: #ef4444;
    color: #fca5a5;
}

.trust-gate-explanation__error-icon {
    font-size: 1.25rem;
}

.trust-gate-explanation__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #334155;
}

.trust-gate-explanation__title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #f8fafc;
}

.trust-gate-explanation__title-icon {
    font-size: 1.25rem;
}

.trust-gate-explanation__rule-count {
    font-size: 0.875rem;
    color: #94a3b8;
    background: #1e293b;
    padding: 4px 12px;
    border-radius: 9999px;
}

.trust-gate-explanation__agent {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #0f172a;
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 16px;
}

.trust-gate-explanation__agent-name {
    display: flex;
    align-items: center;
    gap: 8px;
}

.trust-gate-explanation__agent-label {
    color: #64748b;
    font-size: 0.875rem;
}

.trust-gate-explanation__agent-stats {
    display: flex;
    align-items: center;
    gap: 12px;
}

.trust-gate-explanation__agent-tier,
.trust-gate-explanation__agent-score {
    font-size: 0.875rem;
    padding: 4px 10px;
    border-radius: 4px;
    background: #1e293b;
}

.trust-gate-explanation__agent-tier {
    color: #8b5cf6;
    border: 1px solid #8b5cf633;
}

.trust-gate-explanation__agent-score {
    color: #f59e0b;
    border: 1px solid #f59e0b33;
}

.trust-gate-explanation__summary {
    margin: 0 0 16px;
    font-size: 0.9375rem;
    color: #cbd5e1;
    line-height: 1.5;
}

.trust-gate-explanation__primary-callout {
    display: flex;
    align-items: center;
    gap: 12px;
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 16px;
}

.trust-gate-explanation__primary-icon {
    font-size: 1.5rem;
}

.trust-gate-explanation__primary-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.trust-gate-explanation__primary-label {
    font-size: 0.75rem;
    color: #ef4444;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.trust-gate-explanation__primary-name {
    font-weight: 500;
    color: #f8fafc;
}

.trust-gate-explanation__rules-section {
    margin-top: 16px;
}

.trust-gate-explanation__rules-header {
    margin: 0 0 12px;
    font-size: 0.875rem;
    font-weight: 500;
    color: #94a3b8;
}

.trust-gate-explanation__rules {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

/* Rule Card */
.trust-gate-rule {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 8px;
    padding: 14px 16px;
    transition: border-color 0.2s;
}

.trust-gate-rule:hover {
    border-color: #334155;
}

.trust-gate-rule--primary {
    border-color: rgba(239, 68, 68, 0.4);
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, #0f172a 100%);
}

.trust-gate-rule__header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
}

.trust-gate-rule__icon {
    font-size: 1rem;
}

.trust-gate-rule__type {
    font-size: 0.75rem;
    font-weight: 500;
    padding: 2px 8px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.trust-gate-rule__primary-badge {
    font-size: 0.625rem;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
    background: #ef4444;
    color: white;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-left: auto;
}

.trust-gate-rule__name {
    margin: 0 0 4px;
    font-size: 0.9375rem;
    font-weight: 500;
    color: #f8fafc;
}

.trust-gate-rule__description {
    margin: 0;
    font-size: 0.875rem;
    color: #94a3b8;
    line-height: 1.4;
}

.trust-gate-rule__threshold {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 12px;
}

.trust-gate-rule__threshold-bar {
    flex: 1;
    height: 6px;
    background: #1e293b;
    border-radius: 3px;
    overflow: hidden;
}

.trust-gate-rule__threshold-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s ease;
}

.trust-gate-rule__threshold-text {
    font-size: 0.8125rem;
    font-weight: 500;
    color: #cbd5e1;
    white-space: nowrap;
}
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleId = 'trust-gate-explanation-styles';
    if (!document.getElementById(styleId)) {
        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }
}

export default TrustGateExplanation;
