/**
 * CouncilPanel - Council review and voting panel
 *
 * TRUST-5.7: Panel for council members to view and vote on reviews
 * - List of pending reviews
 * - Review detail view
 * - Vote submission form
 * - Shows other votes after submission
 */

import { useState } from 'react';

export interface CouncilReview {
    id: string;
    type: string;
    requesterId: string;
    status: 'pending' | 'approved' | 'rejected' | 'expired';
    createdAt: string;
    expiresAt: string;
    votesReceived: number;
    requiredVotes: number;
    priority: 'low' | 'normal' | 'high' | 'critical';
    context?: Record<string, unknown>;
    votes?: Array<{
        agentId: string;
        vote: 'approve' | 'reject' | 'abstain';
        reasoning: string;
        confidence: number;
        timestamp: string;
    }>;
    outcome?: {
        decision: 'approve' | 'reject';
        consensus: number;
    };
}

interface CouncilPanelProps {
    reviews: CouncilReview[];
    currentAgentId: string;
    onVote: (reviewId: string, vote: 'approve' | 'reject' | 'abstain', reasoning: string, confidence: number) => Promise<void>;
    onRefresh?: () => void;
}

const PRIORITY_COLORS = {
    critical: '#ef4444',
    high: '#f59e0b',
    normal: '#3b82f6',
    low: '#6b7280',
};

// Reserved for future use
// const STATUS_COLORS = { pending: '#f59e0b', approved: '#10b981', rejected: '#ef4444', expired: '#6b7280' };

function formatTimeRemaining(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();

    if (diffMs <= 0) return 'Expired';

    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m left`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h left`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d left`;
}

export function CouncilPanel({ reviews, currentAgentId, onVote, onRefresh }: CouncilPanelProps) {
    const [selectedReview, setSelectedReview] = useState<CouncilReview | null>(null);
    const [voteForm, setVoteForm] = useState({
        vote: '' as 'approve' | 'reject' | 'abstain' | '',
        reasoning: '',
        confidence: 0.8,
    });
    const [submitting, setSubmitting] = useState(false);

    const pendingReviews = reviews.filter(r => r.status === 'pending');
    const hasVoted = (review: CouncilReview) =>
        review.votes?.some(v => v.agentId === currentAgentId);

    const handleSubmitVote = async () => {
        if (!selectedReview || !voteForm.vote || !voteForm.reasoning.trim()) return;

        setSubmitting(true);
        try {
            await onVote(
                selectedReview.id,
                voteForm.vote,
                voteForm.reasoning,
                voteForm.confidence
            );
            setVoteForm({ vote: '', reasoning: '', confidence: 0.8 });
            setSelectedReview(null);
            onRefresh?.();
        } catch (error) {
            console.error('Vote failed:', error);
        } finally {
            setSubmitting(false);
        }
    };

    if (pendingReviews.length === 0 && !selectedReview) {
        return (
            <div
                className="council-panel-empty"
                style={{
                    padding: 24,
                    textAlign: 'center',
                    color: 'rgba(255,255,255,0.5)',
                }}
            >
                <div style={{ fontSize: 32, marginBottom: 8 }}>&#9878;</div>
                <div>No pending reviews</div>
                {onRefresh && (
                    <button
                        onClick={onRefresh}
                        style={{
                            marginTop: 12,
                            padding: '6px 12px',
                            background: 'rgba(255,255,255,0.1)',
                            border: 'none',
                            borderRadius: 6,
                            color: 'inherit',
                            cursor: 'pointer',
                        }}
                    >
                        Refresh
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="council-panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                    Council Reviews
                    {pendingReviews.length > 0 && (
                        <span style={{
                            marginLeft: 8,
                            padding: '2px 8px',
                            background: '#f59e0b',
                            borderRadius: 10,
                            fontSize: 12,
                            fontWeight: 500,
                        }}>
                            {pendingReviews.length}
                        </span>
                    )}
                </h3>
                {onRefresh && (
                    <button
                        onClick={onRefresh}
                        style={{
                            padding: '4px 8px',
                            background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: 4,
                            color: 'rgba(255,255,255,0.7)',
                            cursor: 'pointer',
                            fontSize: 12,
                        }}
                    >
                        &#8635;
                    </button>
                )}
            </div>

            {/* Review List */}
            {!selectedReview && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {pendingReviews.map(review => (
                        <div
                            key={review.id}
                            onClick={() => !hasVoted(review) && setSelectedReview(review)}
                            style={{
                                padding: 12,
                                background: 'rgba(255,255,255,0.05)',
                                borderRadius: 8,
                                border: `1px solid ${hasVoted(review) ? 'rgba(255,255,255,0.1)' : PRIORITY_COLORS[review.priority]}40`,
                                cursor: hasVoted(review) ? 'default' : 'pointer',
                                opacity: hasVoted(review) ? 0.6 : 1,
                                transition: 'border-color 0.2s',
                            }}
                        >
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                marginBottom: 8,
                            }}>
                                <div>
                                    <span style={{
                                        fontSize: 10,
                                        padding: '2px 6px',
                                        background: `${PRIORITY_COLORS[review.priority]}30`,
                                        color: PRIORITY_COLORS[review.priority],
                                        borderRadius: 4,
                                        textTransform: 'uppercase',
                                        fontWeight: 600,
                                    }}>
                                        {review.type}
                                    </span>
                                </div>
                                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                                    {formatTimeRemaining(review.expiresAt)}
                                </span>
                            </div>

                            <div style={{
                                fontSize: 13,
                                color: 'rgba(255,255,255,0.8)',
                                marginBottom: 8,
                            }}>
                                From: {review.requesterId}
                            </div>

                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: 11,
                                color: 'rgba(255,255,255,0.5)',
                            }}>
                                <span>Votes: {review.votesReceived}/{review.requiredVotes}</span>
                                {hasVoted(review) && (
                                    <span style={{ color: '#10b981' }}>&#10003; Voted</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Review Detail + Vote Form */}
            {selectedReview && (
                <div style={{
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: 12,
                    padding: 16,
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: 16,
                    }}>
                        <button
                            onClick={() => setSelectedReview(null)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'rgba(255,255,255,0.6)',
                                cursor: 'pointer',
                                fontSize: 14,
                            }}
                        >
                            &#8592; Back
                        </button>
                        <span style={{
                            padding: '2px 8px',
                            background: `${PRIORITY_COLORS[selectedReview.priority]}30`,
                            color: PRIORITY_COLORS[selectedReview.priority],
                            borderRadius: 4,
                            fontSize: 11,
                            textTransform: 'uppercase',
                        }}>
                            {selectedReview.priority}
                        </span>
                    </div>

                    <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>
                        {selectedReview.type} Request
                    </h4>
                    <p style={{
                        margin: '0 0 16px',
                        fontSize: 13,
                        color: 'rgba(255,255,255,0.7)',
                    }}>
                        From: {selectedReview.requesterId}
                    </p>

                    {/* Vote Form */}
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 12, marginBottom: 8, color: 'rgba(255,255,255,0.6)' }}>
                            Your Vote
                        </label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {(['approve', 'reject', 'abstain'] as const).map(vote => (
                                <button
                                    key={vote}
                                    onClick={() => setVoteForm(f => ({ ...f, vote }))}
                                    style={{
                                        flex: 1,
                                        padding: '8px 12px',
                                        background: voteForm.vote === vote
                                            ? vote === 'approve' ? '#10b981' : vote === 'reject' ? '#ef4444' : '#6b7280'
                                            : 'rgba(255,255,255,0.1)',
                                        border: 'none',
                                        borderRadius: 6,
                                        color: 'white',
                                        cursor: 'pointer',
                                        textTransform: 'capitalize',
                                        fontWeight: voteForm.vote === vote ? 600 : 400,
                                    }}
                                >
                                    {vote}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 12, marginBottom: 8, color: 'rgba(255,255,255,0.6)' }}>
                            Reasoning (required)
                        </label>
                        <textarea
                            value={voteForm.reasoning}
                            onChange={e => setVoteForm(f => ({ ...f, reasoning: e.target.value }))}
                            placeholder="Explain your vote..."
                            style={{
                                width: '100%',
                                minHeight: 80,
                                padding: 12,
                                background: 'rgba(0,0,0,0.2)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 8,
                                color: 'white',
                                resize: 'vertical',
                                fontFamily: 'inherit',
                                fontSize: 13,
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 12, marginBottom: 8, color: 'rgba(255,255,255,0.6)' }}>
                            Confidence: {Math.round(voteForm.confidence * 100)}%
                        </label>
                        <input
                            type="range"
                            min={0}
                            max={100}
                            value={voteForm.confidence * 100}
                            onChange={e => setVoteForm(f => ({ ...f, confidence: parseInt(e.target.value) / 100 }))}
                            style={{ width: '100%' }}
                        />
                    </div>

                    <button
                        onClick={handleSubmitVote}
                        disabled={!voteForm.vote || !voteForm.reasoning.trim() || submitting}
                        style={{
                            width: '100%',
                            padding: '12px 24px',
                            background: voteForm.vote && voteForm.reasoning.trim() ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                            border: 'none',
                            borderRadius: 8,
                            color: 'white',
                            fontWeight: 600,
                            cursor: voteForm.vote && voteForm.reasoning.trim() ? 'pointer' : 'not-allowed',
                            opacity: submitting ? 0.7 : 1,
                        }}
                    >
                        {submitting ? 'Submitting...' : 'Submit Vote'}
                    </button>
                </div>
            )}
        </div>
    );
}

export default CouncilPanel;
