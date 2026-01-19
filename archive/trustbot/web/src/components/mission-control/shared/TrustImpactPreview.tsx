/**
 * Trust Impact Preview Component
 *
 * Shows the predicted trust score impact for approve/deny decisions.
 * Helps operators make informed decisions about trust implications.
 *
 * Story 2.5: Trust Impact Preview
 * FRs: FR17
 */

import { memo, useMemo } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface TrustImpactFactor {
    name: string;
    value: number;
}

export interface TrustImpactOutcome {
    scoreDelta: number;
    newScore: number;
    factors: TrustImpactFactor[];
}

export interface TrustImpactData {
    currentTrust: number;
    agentId: string;
    agentName: string;
    approveImpact: TrustImpactOutcome;
    denyImpact: TrustImpactOutcome;
}

export interface TrustImpactPreviewProps {
    impact: TrustImpactData;
    isLoading?: boolean;
    error?: string | null;
    className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get color for score delta
 */
export function getDeltaColor(delta: number): string {
    if (delta > 0) return 'var(--color-success, #22c55e)';
    if (delta < 0) return 'var(--color-danger, #ef4444)';
    return 'var(--color-muted, #6b7280)';
}

/**
 * Format delta with sign
 */
export function formatDelta(delta: number): string {
    if (delta > 0) return `+${delta}`;
    return String(delta);
}

/**
 * Get trust tier from score
 */
export function getTrustTier(score: number): { tier: number; label: string } {
    if (score >= 800) return { tier: 5, label: 'Executive' };
    if (score >= 600) return { tier: 4, label: 'Senior' };
    if (score >= 400) return { tier: 3, label: 'Standard' };
    if (score >= 200) return { tier: 2, label: 'Junior' };
    return { tier: 1, label: 'Probationary' };
}

// ============================================================================
// Sub-Components
// ============================================================================

interface ImpactCardProps {
    title: string;
    outcome: TrustImpactOutcome;
    variant: 'approve' | 'deny';
}

const ImpactCard = memo(function ImpactCard({ title, outcome, variant }: ImpactCardProps) {
    const tierInfo = getTrustTier(outcome.newScore);
    // Note: Could use outcome.scoreDelta > 0 for conditional styling

    return (
        <div className={`trust-impact-preview__card trust-impact-preview__card--${variant}`}>
            <div className="trust-impact-preview__card-header">
                <span className="trust-impact-preview__card-title">{title}</span>
                <span
                    className="trust-impact-preview__delta"
                    style={{ color: getDeltaColor(outcome.scoreDelta) }}
                    aria-label={`Trust score change: ${formatDelta(outcome.scoreDelta)}`}
                >
                    {formatDelta(outcome.scoreDelta)}
                </span>
            </div>

            <div className="trust-impact-preview__new-score">
                <span className="trust-impact-preview__score-value">{outcome.newScore}</span>
                <span className="trust-impact-preview__tier-badge">
                    T{tierInfo.tier} {tierInfo.label}
                </span>
            </div>

            <div className="trust-impact-preview__factors">
                <span className="trust-impact-preview__factors-label">Factors:</span>
                <ul className="trust-impact-preview__factor-list">
                    {outcome.factors.map((factor, idx) => (
                        <li
                            key={idx}
                            className="trust-impact-preview__factor"
                            style={{ color: getDeltaColor(factor.value) }}
                        >
                            <span className="trust-impact-preview__factor-name">{factor.name}</span>
                            <span className="trust-impact-preview__factor-value">
                                {formatDelta(factor.value)}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
});

// ============================================================================
// Main Component
// ============================================================================

export const TrustImpactPreview = memo(function TrustImpactPreview({
    impact,
    isLoading = false,
    error = null,
    className = '',
}: TrustImpactPreviewProps) {
    const currentTierInfo = useMemo(() => getTrustTier(impact.currentTrust), [impact.currentTrust]);

    if (isLoading) {
        return (
            <div
                className={`trust-impact-preview trust-impact-preview--loading ${className}`}
                aria-busy="true"
                aria-label="Loading trust impact preview"
            >
                <div className="trust-impact-preview__skeleton" />
            </div>
        );
    }

    if (error) {
        return (
            <div
                className={`trust-impact-preview trust-impact-preview--error ${className}`}
                role="alert"
            >
                <span className="trust-impact-preview__error-icon" aria-hidden="true">
                    !
                </span>
                <span className="trust-impact-preview__error-text">{error}</span>
            </div>
        );
    }

    return (
        <div className={`trust-impact-preview ${className}`}>
            <div className="trust-impact-preview__header">
                <span className="trust-impact-preview__label">Trust Impact Preview</span>
                <div className="trust-impact-preview__current">
                    <span className="trust-impact-preview__current-label">Current:</span>
                    <span className="trust-impact-preview__current-score">
                        {impact.currentTrust}
                    </span>
                    <span className="trust-impact-preview__current-tier">
                        (T{currentTierInfo.tier})
                    </span>
                </div>
            </div>

            <div className="trust-impact-preview__outcomes">
                <ImpactCard
                    title="If Approved"
                    outcome={impact.approveImpact}
                    variant="approve"
                />
                <ImpactCard
                    title="If Denied"
                    outcome={impact.denyImpact}
                    variant="deny"
                />
            </div>
        </div>
    );
});

// ============================================================================
// Styles
// ============================================================================

export const trustImpactPreviewStyles = `
.trust-impact-preview {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    background: var(--color-surface-alt, #151525);
    border-radius: 8px;
    font-size: 13px;
}

.trust-impact-preview--loading {
    min-height: 120px;
}

.trust-impact-preview__skeleton {
    width: 100%;
    height: 100px;
    background: linear-gradient(90deg, #1a1a2e 25%, #252545 50%, #1a1a2e 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
}

@keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}

.trust-impact-preview--error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
}

.trust-impact-preview__error-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    background: #ef4444;
    color: white;
    border-radius: 50%;
    font-weight: bold;
    font-size: 12px;
}

.trust-impact-preview__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--color-border, #333);
}

.trust-impact-preview__label {
    font-weight: 600;
    color: var(--color-text, #fff);
}

.trust-impact-preview__current {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--color-muted, #6b7280);
}

.trust-impact-preview__current-score {
    font-weight: 600;
    color: var(--color-text, #fff);
}

.trust-impact-preview__outcomes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}

.trust-impact-preview__card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    border-radius: 6px;
    border: 1px solid transparent;
}

.trust-impact-preview__card--approve {
    background: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.3);
}

.trust-impact-preview__card--deny {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
}

.trust-impact-preview__card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.trust-impact-preview__card-title {
    font-weight: 500;
    color: var(--color-text, #fff);
}

.trust-impact-preview__delta {
    font-weight: 700;
    font-size: 14px;
}

.trust-impact-preview__new-score {
    display: flex;
    align-items: baseline;
    gap: 6px;
}

.trust-impact-preview__score-value {
    font-size: 20px;
    font-weight: 700;
    color: var(--color-text, #fff);
}

.trust-impact-preview__tier-badge {
    font-size: 11px;
    padding: 2px 6px;
    background: var(--color-surface, #1a1a2e);
    border-radius: 4px;
    color: var(--color-muted, #6b7280);
}

.trust-impact-preview__factors {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.trust-impact-preview__factors-label {
    font-size: 11px;
    color: var(--color-muted, #6b7280);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.trust-impact-preview__factor-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.trust-impact-preview__factor {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
}

.trust-impact-preview__factor-name {
    color: var(--color-muted, #6b7280);
}

.trust-impact-preview__factor-value {
    font-weight: 500;
    font-family: monospace;
}
`;

export default TrustImpactPreview;
