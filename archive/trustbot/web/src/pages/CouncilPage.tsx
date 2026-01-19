/**
 * Council Page - Bot Tribunal voting and pending decisions
 * T4+ users can view and manage pending council reviews
 */
import { useOutletContext } from 'react-router-dom';
import { CouncilPanel, type CouncilReview } from '../components/CouncilPanel';
import type { ApprovalRequest } from '../types';

interface LayoutContext {
    approvals: ApprovalRequest[];
    refresh: () => Promise<void>;
}

export function CouncilPage() {
    const { approvals, refresh } = useOutletContext<LayoutContext>();

    // Convert approval requests to council review format
    const councilReviews: CouncilReview[] = approvals
        .filter(a => a.status === 'PENDING')
        .map(a => ({
            id: a.id,
            type: a.type,
            requesterId: a.requestor,
            status: 'pending' as const,
            createdAt: a.createdAt,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h from now
            votesReceived: 0,
            requiredVotes: 3,
            priority: 'normal' as const,
            context: a.details as Record<string, unknown>,
        }));

    const handleVote = async (reviewId: string, vote: 'approve' | 'reject' | 'abstain', reasoning: string, confidence: number) => {
        console.log('Vote submitted:', { reviewId, vote, reasoning, confidence });
        // TODO: Implement API call
        await refresh();
    };

    const handleApprove = async (id: string) => {
        console.log('Approved:', id);
        // TODO: Implement API call
        await refresh();
    };

    return (
        <div className="council-page" style={{
            height: '100%',
            overflow: 'auto',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
        }}>
            <div className="page-header">
                <h1 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span>Bot Tribunal Council</span>
                    {approvals.length > 0 && (
                        <span style={{
                            padding: '4px 10px',
                            background: 'var(--accent-gold)',
                            color: '#000',
                            borderRadius: '12px',
                            fontSize: '0.875rem',
                            fontWeight: 600
                        }}>
                            {approvals.length} pending
                        </span>
                    )}
                </h1>
                <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)' }}>
                    Review and vote on agent decisions, tier promotions, and capability grants.
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', flex: 1 }}>
                {/* Council Reviews Panel */}
                <div style={{
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '20px',
                    border: '1px solid var(--border-color)'
                }}>
                    <CouncilPanel
                        reviews={councilReviews}
                        currentAgentId="hitl-primary"
                        onVote={handleVote}
                        onRefresh={refresh}
                    />
                </div>

                {/* Pending Actions Panel */}
                <div style={{
                    background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '20px',
                    border: '1px solid var(--border-color)'
                }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: '1rem' }}>Pending Approvals</h3>
                    {approvals.length === 0 ? (
                        <div style={{
                            padding: '40px',
                            textAlign: 'center',
                            color: 'var(--text-muted)'
                        }}>
                            No pending approvals
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {approvals.map(approval => (
                                <div
                                    key={approval.id}
                                    style={{
                                        padding: '12px 16px',
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-md)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}
                                >
                                    <div>
                                        <div style={{ fontWeight: 500 }}>{approval.type}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            {approval.summary}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleApprove(approval.id)}
                                        style={{
                                            padding: '6px 16px',
                                            background: 'var(--accent-green)',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: 'var(--radius-sm)',
                                            cursor: 'pointer',
                                            fontWeight: 500
                                        }}
                                    >
                                        Approve
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
