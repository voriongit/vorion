/**
 * Tribunal Record Component
 *
 * Displays Bot Tribunal voting records for high-risk decisions.
 * Shows each voting agent's vote, reasoning, and confidence score.
 *
 * Story 3.1: Bot Tribunal Voting Records Display
 * FRs: FR19
 */

import { memo, useMemo, useState, useCallback } from 'react';
import type {
    TribunalRecord as TribunalRecordType,
    TribunalVote,
    TribunalVoteType,
    TribunalConsensus,
} from '../../../types';
import { AgentLink } from './AgentLink';

// ============================================================================
// Types
// ============================================================================

export interface TribunalRecordProps {
    record: TribunalRecordType;
    isLoading?: boolean;
    error?: string | null;
    showDetails?: boolean;
    className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

export function getVoteColor(vote: TribunalVoteType): string {
    switch (vote) {
        case 'approve':
            return 'var(--color-success, #10b981)';
        case 'deny':
            return 'var(--color-error, #ef4444)';
        case 'abstain':
            return 'var(--color-muted, #6b7280)';
        default:
            return 'var(--color-text, #fff)';
    }
}

export function getVoteIcon(vote: TribunalVoteType): string {
    switch (vote) {
        case 'approve':
            return '✓';
        case 'deny':
            return '✗';
        case 'abstain':
            return '○';
        default:
            return '?';
    }
}

export function getVoteLabel(vote: TribunalVoteType): string {
    switch (vote) {
        case 'approve':
            return 'Approve';
        case 'deny':
            return 'Deny';
        case 'abstain':
            return 'Abstain';
        default:
            return 'Unknown';
    }
}

export function getConsensusLabel(consensus: TribunalConsensus): string {
    switch (consensus) {
        case 'unanimous':
            return 'Unanimous';
        case 'majority':
            return 'Majority';
        case 'split':
            return 'Split Decision';
        case 'deadlock':
            return 'Deadlock';
        default:
            return 'Unknown';
    }
}

export function getConsensusColor(consensus: TribunalConsensus): string {
    switch (consensus) {
        case 'unanimous':
            return 'var(--color-success, #10b981)';
        case 'majority':
            return 'var(--color-primary, #3b82f6)';
        case 'split':
            return 'var(--color-warning, #f59e0b)';
        case 'deadlock':
            return 'var(--color-error, #ef4444)';
        default:
            return 'var(--color-muted, #6b7280)';
    }
}

export function formatConfidence(confidence: number): string {
    return `${Math.round(confidence * 100)}%`;
}

export function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
    if (confidence >= 0.85) return 'high';
    if (confidence >= 0.6) return 'medium';
    return 'low';
}

export function getConfidenceColor(confidence: number): string {
    const level = getConfidenceLevel(confidence);
    switch (level) {
        case 'high':
            return 'var(--color-success, #10b981)';
        case 'medium':
            return 'var(--color-warning, #f59e0b)';
        case 'low':
            return 'var(--color-error, #ef4444)';
        default:
            return 'var(--color-muted, #6b7280)';
    }
}

// ============================================================================
// Vote Card Component
// ============================================================================

interface VoteCardProps {
    vote: TribunalVote;
    isExpanded: boolean;
    onToggle: () => void;
}

const VoteCard = memo(function VoteCard({ vote, isExpanded, onToggle }: VoteCardProps) {
    const voteColor = getVoteColor(vote.vote);
    const voteIcon = getVoteIcon(vote.vote);
    const confidenceColor = getConfidenceColor(vote.confidence);

    return (
        <div
            className={`tribunal-record__vote-card ${vote.dissenting ? 'tribunal-record__vote-card--dissenting' : ''}`}
            style={{ borderLeftColor: voteColor }}
        >
            <div className="tribunal-record__vote-header">
                {/* Vote badge */}
                <span
                    className="tribunal-record__vote-badge"
                    style={{ backgroundColor: voteColor }}
                    aria-label={`Vote: ${getVoteLabel(vote.vote)}`}
                >
                    <span className="tribunal-record__vote-icon">{voteIcon}</span>
                    <span className="tribunal-record__vote-label">{getVoteLabel(vote.vote)}</span>
                </span>

                {/* Agent info */}
                <div className="tribunal-record__vote-agent">
                    <AgentLink
                        agentId={vote.agentId}
                        agentName={vote.agentName}
                        showId={false}
                        showTooltip={false}
                        size="sm"
                    />
                </div>

                {/* Confidence */}
                <span
                    className="tribunal-record__confidence"
                    style={{ color: confidenceColor }}
                    aria-label={`Confidence: ${formatConfidence(vote.confidence)}`}
                >
                    {formatConfidence(vote.confidence)}
                </span>

                {/* Dissenting indicator */}
                {vote.dissenting && (
                    <span className="tribunal-record__dissenting-badge" aria-label="Dissenting vote">
                        Dissent
                    </span>
                )}

                {/* Expand button */}
                <button
                    type="button"
                    className="tribunal-record__expand-btn"
                    onClick={onToggle}
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? 'Hide reasoning' : 'Show reasoning'}
                >
                    {isExpanded ? '▲' : '▼'}
                </button>
            </div>

            {/* Reasoning (expanded) */}
            {isExpanded && (
                <div className="tribunal-record__vote-reasoning">
                    <span className="tribunal-record__reasoning-label">Reasoning:</span>
                    <p className="tribunal-record__reasoning-text">{vote.reasoning}</p>
                    <span className="tribunal-record__vote-time">
                        Voted: {new Date(vote.votedAt).toLocaleTimeString()}
                    </span>
                </div>
            )}
        </div>
    );
});

// ============================================================================
// Main Component
// ============================================================================

export const TribunalRecord = memo(function TribunalRecord({
    record,
    isLoading = false,
    error = null,
    showDetails = true,
    className = '',
}: TribunalRecordProps) {
    const [expandedVotes, setExpandedVotes] = useState<Set<string>>(new Set());

    const toggleVote = useCallback((voteId: string) => {
        setExpandedVotes((prev) => {
            const next = new Set(prev);
            if (next.has(voteId)) {
                next.delete(voteId);
            } else {
                next.add(voteId);
            }
            return next;
        });
    }, []);

    const expandAll = useCallback(() => {
        setExpandedVotes(new Set(record.votes.map((v) => v.id)));
    }, [record.votes]);

    const collapseAll = useCallback(() => {
        setExpandedVotes(new Set());
    }, []);

    // Sort votes: recommendation-aligned first, then dissenting, then abstain
    const sortedVotes = useMemo(() => {
        return [...record.votes].sort((a, b) => {
            // Votes matching recommendation come first
            if (a.vote === record.finalRecommendation && b.vote !== record.finalRecommendation) return -1;
            if (b.vote === record.finalRecommendation && a.vote !== record.finalRecommendation) return 1;
            // Then non-abstain
            if (a.vote !== 'abstain' && b.vote === 'abstain') return -1;
            if (b.vote !== 'abstain' && a.vote === 'abstain') return 1;
            // Then by confidence
            return b.confidence - a.confidence;
        });
    }, [record.votes, record.finalRecommendation]);

    // Loading state
    if (isLoading) {
        return (
            <div
                className={`tribunal-record tribunal-record--loading ${className}`}
                aria-busy="true"
                aria-label="Loading tribunal record"
            >
                <div className="tribunal-record__skeleton">
                    <div className="tribunal-record__skeleton-header" />
                    <div className="tribunal-record__skeleton-votes">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="tribunal-record__skeleton-vote" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className={`tribunal-record tribunal-record--error ${className}`}>
                <p className="tribunal-record__error" role="alert">
                    {error}
                </p>
            </div>
        );
    }

    const recommendationColor = getVoteColor(record.finalRecommendation);
    const consensusColor = getConsensusColor(record.consensus);

    return (
        <div className={`tribunal-record ${className}`} role="region" aria-label="Bot Tribunal Record">
            {/* Header */}
            <div className="tribunal-record__header">
                <h4 className="tribunal-record__title">Bot Tribunal Record</h4>
                <span
                    className="tribunal-record__consensus-badge"
                    style={{ backgroundColor: consensusColor }}
                >
                    {getConsensusLabel(record.consensus)}
                </span>
            </div>

            {/* Summary */}
            <div className="tribunal-record__summary">
                {/* Final Recommendation */}
                <div className="tribunal-record__recommendation">
                    <span className="tribunal-record__summary-label">Recommendation:</span>
                    <span
                        className="tribunal-record__recommendation-value"
                        style={{ color: recommendationColor }}
                    >
                        {getVoteIcon(record.finalRecommendation)} {getVoteLabel(record.finalRecommendation)}
                    </span>
                </div>

                {/* Vote counts */}
                <div className="tribunal-record__vote-counts">
                    <span className="tribunal-record__count tribunal-record__count--approve">
                        <span className="tribunal-record__count-icon">✓</span>
                        {record.summary.approveCount}
                    </span>
                    <span className="tribunal-record__count tribunal-record__count--deny">
                        <span className="tribunal-record__count-icon">✗</span>
                        {record.summary.denyCount}
                    </span>
                    {record.summary.abstainCount > 0 && (
                        <span className="tribunal-record__count tribunal-record__count--abstain">
                            <span className="tribunal-record__count-icon">○</span>
                            {record.summary.abstainCount}
                        </span>
                    )}
                </div>

                {/* Average confidence */}
                <div className="tribunal-record__avg-confidence">
                    <span className="tribunal-record__summary-label">Avg Confidence:</span>
                    <span
                        className="tribunal-record__confidence-value"
                        style={{ color: getConfidenceColor(record.summary.averageConfidence) }}
                    >
                        {formatConfidence(record.summary.averageConfidence)}
                    </span>
                </div>
            </div>

            {/* Votes detail section */}
            {showDetails && (
                <div className="tribunal-record__votes-section">
                    <div className="tribunal-record__votes-header">
                        <span className="tribunal-record__votes-title">
                            Votes ({record.summary.totalVotes})
                        </span>
                        <div className="tribunal-record__votes-actions">
                            <button
                                type="button"
                                className="tribunal-record__action-btn"
                                onClick={expandAll}
                            >
                                Expand All
                            </button>
                            <button
                                type="button"
                                className="tribunal-record__action-btn"
                                onClick={collapseAll}
                            >
                                Collapse All
                            </button>
                        </div>
                    </div>

                    <div className="tribunal-record__votes-list" role="list" aria-label="Tribunal votes">
                        {sortedVotes.map((vote) => (
                            <VoteCard
                                key={vote.id}
                                vote={vote}
                                isExpanded={expandedVotes.has(vote.id)}
                                onToggle={() => toggleVote(vote.id)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="tribunal-record__footer">
                <span className="tribunal-record__voted-at">
                    Deliberation completed: {new Date(record.votedAt).toLocaleString()}
                </span>
            </div>
        </div>
    );
});

// ============================================================================
// Styles
// ============================================================================

export const tribunalRecordStyles = `
.tribunal-record {
    background: var(--color-surface, #1a1a2e);
    border: 1px solid var(--color-border, #2a2a4a);
    border-radius: 8px;
    overflow: hidden;
}

.tribunal-record--loading,
.tribunal-record--error {
    padding: 24px;
}

.tribunal-record__skeleton-header {
    height: 40px;
    background: linear-gradient(90deg, var(--color-border) 25%, var(--color-surface-hover) 50%, var(--color-border) 75%);
    background-size: 200% 100%;
    animation: tribunal-shimmer 1.5s infinite;
    border-radius: 4px;
    margin-bottom: 16px;
}

.tribunal-record__skeleton-vote {
    height: 60px;
    background: linear-gradient(90deg, var(--color-border) 25%, var(--color-surface-hover) 50%, var(--color-border) 75%);
    background-size: 200% 100%;
    animation: tribunal-shimmer 1.5s infinite;
    border-radius: 4px;
    margin-bottom: 8px;
}

@keyframes tribunal-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}

.tribunal-record__error {
    color: var(--color-error, #ef4444);
    margin: 0;
    text-align: center;
}

.tribunal-record__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-border, #2a2a4a);
    background: var(--color-surface-alt, #151525);
}

.tribunal-record__title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text, #fff);
}

.tribunal-record__consensus-badge {
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 4px;
    color: white;
    text-transform: uppercase;
}

.tribunal-record__summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-border, #2a2a4a);
    flex-wrap: wrap;
    gap: 12px;
}

.tribunal-record__recommendation {
    display: flex;
    align-items: center;
    gap: 8px;
}

.tribunal-record__summary-label {
    font-size: 12px;
    color: var(--color-muted, #6b7280);
}

.tribunal-record__recommendation-value {
    font-size: 14px;
    font-weight: 600;
}

.tribunal-record__vote-counts {
    display: flex;
    gap: 12px;
}

.tribunal-record__count {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 14px;
    font-weight: 600;
}

.tribunal-record__count--approve {
    color: var(--color-success, #10b981);
}

.tribunal-record__count--deny {
    color: var(--color-error, #ef4444);
}

.tribunal-record__count--abstain {
    color: var(--color-muted, #6b7280);
}

.tribunal-record__count-icon {
    font-size: 12px;
}

.tribunal-record__avg-confidence {
    display: flex;
    align-items: center;
    gap: 8px;
}

.tribunal-record__confidence-value {
    font-size: 14px;
    font-weight: 600;
}

/* Votes Section */
.tribunal-record__votes-section {
    padding: 12px 16px;
}

.tribunal-record__votes-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
}

.tribunal-record__votes-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-muted, #6b7280);
    text-transform: uppercase;
}

.tribunal-record__votes-actions {
    display: flex;
    gap: 8px;
}

.tribunal-record__action-btn {
    padding: 4px 8px;
    font-size: 11px;
    background: transparent;
    border: 1px solid var(--color-border, #2a2a4a);
    border-radius: 4px;
    color: var(--color-muted, #6b7280);
    cursor: pointer;
    transition: all 0.15s ease;
}

.tribunal-record__action-btn:hover {
    border-color: var(--color-primary, #3b82f6);
    color: var(--color-text, #fff);
}

.tribunal-record__votes-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

/* Vote Card */
.tribunal-record__vote-card {
    background: var(--color-surface-alt, #151525);
    border: 1px solid var(--color-border, #2a2a4a);
    border-left-width: 3px;
    border-radius: 4px;
    overflow: hidden;
}

.tribunal-record__vote-card--dissenting {
    background: rgba(239, 68, 68, 0.05);
}

.tribunal-record__vote-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
}

.tribunal-record__vote-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    color: white;
}

.tribunal-record__vote-icon {
    font-size: 10px;
}

.tribunal-record__vote-label {
    text-transform: capitalize;
}

.tribunal-record__vote-agent {
    flex: 1;
    min-width: 0;
}

.tribunal-record__confidence {
    font-size: 13px;
    font-weight: 600;
    min-width: 40px;
    text-align: right;
}

.tribunal-record__dissenting-badge {
    padding: 2px 8px;
    font-size: 10px;
    font-weight: 600;
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid var(--color-error, #ef4444);
    border-radius: 4px;
    color: var(--color-error, #ef4444);
    text-transform: uppercase;
}

.tribunal-record__expand-btn {
    padding: 4px 8px;
    font-size: 10px;
    background: transparent;
    border: none;
    color: var(--color-muted, #6b7280);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s ease;
}

.tribunal-record__expand-btn:hover {
    background: var(--color-surface-hover, #252540);
    color: var(--color-text, #fff);
}

/* Vote Reasoning */
.tribunal-record__vote-reasoning {
    padding: 12px;
    border-top: 1px solid var(--color-border, #2a2a4a);
    background: var(--color-surface, #1a1a2e);
}

.tribunal-record__reasoning-label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: var(--color-muted, #6b7280);
    text-transform: uppercase;
    margin-bottom: 6px;
}

.tribunal-record__reasoning-text {
    margin: 0 0 8px 0;
    font-size: 13px;
    color: var(--color-text, #fff);
    line-height: 1.5;
}

.tribunal-record__vote-time {
    font-size: 11px;
    color: var(--color-muted, #6b7280);
}

/* Footer */
.tribunal-record__footer {
    padding: 10px 16px;
    border-top: 1px solid var(--color-border, #2a2a4a);
    background: var(--color-surface-alt, #151525);
}

.tribunal-record__voted-at {
    font-size: 12px;
    color: var(--color-muted, #6b7280);
}
`;

export default TribunalRecord;
