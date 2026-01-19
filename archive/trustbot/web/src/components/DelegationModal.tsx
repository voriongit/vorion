/**
 * DelegationModal - Request temporary capability delegation
 *
 * TRUST-5.8: Modal for agents to request additional capabilities
 * - Select capabilities to request
 * - Specify duration and reason
 * - Shows auto-approval eligibility
 * - Displays active delegations
 */

import { useState } from 'react';

export interface DelegationRequest {
    capabilities: string[];
    reason: string;
    duration: number; // milliseconds
}

export interface ActiveDelegation {
    id: string;
    capabilities: string[];
    grantedAt: string;
    expiresAt: string;
    reason: string;
    approvedBy: string;
    usageCount: number;
}

interface DelegationModalProps {
    agentId: string;
    agentTier: number;
    activeDelegations: ActiveDelegation[];
    onRequest: (request: DelegationRequest) => Promise<{ autoApproved: boolean; status: string }>;
    onRevoke?: (delegationId: string, reason: string) => Promise<void>;
    onClose: () => void;
}

// Available capabilities that can be delegated
const DELEGATABLE_CAPABILITIES = [
    { id: 'SPAWN_AGENT', name: 'Spawn Agent', description: 'Create new agent instances', minTier: 3 },
    { id: 'BLACKBOARD_RESOLVE', name: 'Resolve Entries', description: 'Mark blackboard entries as resolved', minTier: 2 },
    { id: 'BLACKBOARD_DELETE', name: 'Delete Entries', description: 'Remove blackboard entries', minTier: 3 },
    { id: 'TRUST_REWARD', name: 'Reward Trust', description: 'Grant trust score rewards', minTier: 4 },
    { id: 'VIEW_AUDIT_LOG', name: 'View Audit', description: 'Access audit log entries', minTier: 2 },
] as const;

// Duration options
const DURATION_OPTIONS = [
    { label: '15 minutes', value: 15 * 60 * 1000 },
    { label: '30 minutes', value: 30 * 60 * 1000 },
    { label: '1 hour', value: 60 * 60 * 1000 },
    { label: '2 hours', value: 2 * 60 * 60 * 1000 },
    { label: '4 hours', value: 4 * 60 * 60 * 1000 },
    { label: '8 hours', value: 8 * 60 * 60 * 1000 },
    { label: '24 hours', value: 24 * 60 * 60 * 1000 },
];

function formatTimeRemaining(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();

    if (diffMs <= 0) return 'Expired';

    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ${diffMins % 60}m`;
}

export function DelegationModal({
    agentId: _agentId,
    agentTier,
    activeDelegations,
    onRequest,
    onRevoke,
    onClose,
}: DelegationModalProps) {
    const [tab, setTab] = useState<'request' | 'active'>('request');
    const [selectedCaps, setSelectedCaps] = useState<string[]>([]);
    const [duration, setDuration] = useState(DURATION_OPTIONS[2].value); // Default 1 hour
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ autoApproved: boolean; status: string } | null>(null);

    const canAutoApprove = agentTier >= 4 && duration <= 60 * 60 * 1000;
    const availableCaps = DELEGATABLE_CAPABILITIES.filter(c => c.minTier <= agentTier);

    const toggleCapability = (capId: string) => {
        setSelectedCaps(prev =>
            prev.includes(capId)
                ? prev.filter(c => c !== capId)
                : [...prev, capId]
        );
    };

    const handleSubmit = async () => {
        if (selectedCaps.length === 0 || !reason.trim()) return;

        setSubmitting(true);
        setResult(null);

        try {
            const res = await onRequest({
                capabilities: selectedCaps,
                reason: reason.trim(),
                duration,
            });
            setResult(res);

            if (res.autoApproved) {
                // Auto-clear after success
                setTimeout(() => {
                    setSelectedCaps([]);
                    setReason('');
                    setResult(null);
                    setTab('active');
                }, 2000);
            }
        } catch (error) {
            console.error('Delegation request failed:', error);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            className="modal-overlay"
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
            }}
        >
            <div
                className="modal"
                onClick={e => e.stopPropagation()}
                style={{
                    background: '#1a1a2e',
                    borderRadius: 16,
                    width: '100%',
                    maxWidth: 500,
                    maxHeight: '80vh',
                    overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.1)',
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                        Capability Delegation
                    </h2>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'rgba(255,255,255,0.6)',
                            cursor: 'pointer',
                            fontSize: 20,
                            lineHeight: 1,
                        }}
                    >
                        &times;
                    </button>
                </div>

                {/* Tabs */}
                <div style={{
                    display: 'flex',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                }}>
                    {(['request', 'active'] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            style={{
                                flex: 1,
                                padding: '12px',
                                background: 'transparent',
                                border: 'none',
                                borderBottom: tab === t ? '2px solid #3b82f6' : '2px solid transparent',
                                color: tab === t ? '#3b82f6' : 'rgba(255,255,255,0.6)',
                                cursor: 'pointer',
                                fontWeight: tab === t ? 600 : 400,
                                textTransform: 'capitalize',
                            }}
                        >
                            {t === 'active' && activeDelegations.length > 0 && (
                                <span style={{
                                    marginRight: 6,
                                    padding: '2px 6px',
                                    background: '#10b981',
                                    borderRadius: 10,
                                    fontSize: 10,
                                }}>
                                    {activeDelegations.length}
                                </span>
                            )}
                            {t}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div style={{ padding: 20, overflowY: 'auto', maxHeight: 'calc(80vh - 120px)' }}>
                    {tab === 'request' && (
                        <>
                            {/* Auto-approval indicator */}
                            {canAutoApprove && (
                                <div style={{
                                    padding: '10px 12px',
                                    background: 'rgba(16,185,129,0.15)',
                                    borderRadius: 8,
                                    marginBottom: 16,
                                    fontSize: 13,
                                    color: '#10b981',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                }}>
                                    <span>&#10003;</span>
                                    <span>Eligible for auto-approval (T{agentTier}+, &le;1hr)</span>
                                </div>
                            )}

                            {/* Capability selection */}
                            <div style={{ marginBottom: 20 }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: 12,
                                    color: 'rgba(255,255,255,0.6)',
                                    marginBottom: 8,
                                }}>
                                    Select Capabilities
                                </label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {availableCaps.map(cap => (
                                        <div
                                            key={cap.id}
                                            onClick={() => toggleCapability(cap.id)}
                                            style={{
                                                padding: '10px 12px',
                                                background: selectedCaps.includes(cap.id)
                                                    ? 'rgba(59,130,246,0.2)'
                                                    : 'rgba(255,255,255,0.05)',
                                                border: `1px solid ${selectedCaps.includes(cap.id) ? '#3b82f6' : 'rgba(255,255,255,0.1)'}`,
                                                borderRadius: 8,
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                            }}
                                        >
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                            }}>
                                                <span style={{
                                                    width: 16,
                                                    height: 16,
                                                    borderRadius: 4,
                                                    border: `2px solid ${selectedCaps.includes(cap.id) ? '#3b82f6' : 'rgba(255,255,255,0.3)'}`,
                                                    background: selectedCaps.includes(cap.id) ? '#3b82f6' : 'transparent',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: 'white',
                                                    fontSize: 10,
                                                }}>
                                                    {selectedCaps.includes(cap.id) && '&#10003;'}
                                                </span>
                                                <span style={{ fontWeight: 500 }}>{cap.name}</span>
                                            </div>
                                            <div style={{
                                                marginTop: 4,
                                                marginLeft: 24,
                                                fontSize: 12,
                                                color: 'rgba(255,255,255,0.5)',
                                            }}>
                                                {cap.description}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Duration */}
                            <div style={{ marginBottom: 20 }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: 12,
                                    color: 'rgba(255,255,255,0.6)',
                                    marginBottom: 8,
                                }}>
                                    Duration
                                </label>
                                <select
                                    value={duration}
                                    onChange={e => setDuration(parseInt(e.target.value))}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        background: 'rgba(0,0,0,0.2)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: 8,
                                        color: 'white',
                                        fontSize: 14,
                                    }}
                                >
                                    {DURATION_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Reason */}
                            <div style={{ marginBottom: 20 }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: 12,
                                    color: 'rgba(255,255,255,0.6)',
                                    marginBottom: 8,
                                }}>
                                    Reason (required)
                                </label>
                                <textarea
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                    placeholder="Explain why you need these capabilities..."
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

                            {/* Result message */}
                            {result && (
                                <div style={{
                                    padding: '12px',
                                    background: result.autoApproved
                                        ? 'rgba(16,185,129,0.15)'
                                        : 'rgba(245,158,11,0.15)',
                                    borderRadius: 8,
                                    marginBottom: 16,
                                    color: result.autoApproved ? '#10b981' : '#f59e0b',
                                }}>
                                    {result.autoApproved
                                        ? '&#10003; Request auto-approved!'
                                        : '&#9201; Request submitted for review'}
                                </div>
                            )}

                            {/* Submit button */}
                            <button
                                onClick={handleSubmit}
                                disabled={selectedCaps.length === 0 || !reason.trim() || submitting}
                                style={{
                                    width: '100%',
                                    padding: '12px 24px',
                                    background: selectedCaps.length > 0 && reason.trim()
                                        ? '#3b82f6'
                                        : 'rgba(255,255,255,0.1)',
                                    border: 'none',
                                    borderRadius: 8,
                                    color: 'white',
                                    fontWeight: 600,
                                    cursor: selectedCaps.length > 0 && reason.trim()
                                        ? 'pointer'
                                        : 'not-allowed',
                                    opacity: submitting ? 0.7 : 1,
                                }}
                            >
                                {submitting ? 'Submitting...' : 'Request Delegation'}
                            </button>
                        </>
                    )}

                    {tab === 'active' && (
                        <>
                            {activeDelegations.length === 0 ? (
                                <div style={{
                                    textAlign: 'center',
                                    padding: 24,
                                    color: 'rgba(255,255,255,0.5)',
                                }}>
                                    <div style={{ fontSize: 32, marginBottom: 8 }}>&#128274;</div>
                                    <div>No active delegations</div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {activeDelegations.map(delegation => (
                                        <div
                                            key={delegation.id}
                                            style={{
                                                padding: 12,
                                                background: 'rgba(255,255,255,0.05)',
                                                borderRadius: 8,
                                                border: '1px solid rgba(255,255,255,0.1)',
                                            }}
                                        >
                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                marginBottom: 8,
                                            }}>
                                                <div style={{
                                                    display: 'flex',
                                                    gap: 6,
                                                    flexWrap: 'wrap',
                                                }}>
                                                    {delegation.capabilities.map(cap => (
                                                        <span
                                                            key={cap}
                                                            style={{
                                                                padding: '2px 8px',
                                                                background: 'rgba(59,130,246,0.2)',
                                                                borderRadius: 4,
                                                                fontSize: 11,
                                                                color: '#3b82f6',
                                                            }}
                                                        >
                                                            {cap}
                                                        </span>
                                                    ))}
                                                </div>
                                                <span style={{
                                                    fontSize: 11,
                                                    color: '#10b981',
                                                    fontFamily: 'monospace',
                                                }}>
                                                    {formatTimeRemaining(delegation.expiresAt)}
                                                </span>
                                            </div>

                                            <div style={{
                                                fontSize: 12,
                                                color: 'rgba(255,255,255,0.6)',
                                                marginBottom: 8,
                                            }}>
                                                {delegation.reason}
                                            </div>

                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                fontSize: 11,
                                                color: 'rgba(255,255,255,0.4)',
                                            }}>
                                                <span>
                                                    Approved by: {delegation.approvedBy}
                                                    {delegation.usageCount > 0 && ` | Used ${delegation.usageCount}x`}
                                                </span>
                                                {onRevoke && (
                                                    <button
                                                        onClick={() => onRevoke(delegation.id, 'User revoked')}
                                                        style={{
                                                            background: 'transparent',
                                                            border: '1px solid rgba(239,68,68,0.5)',
                                                            color: '#ef4444',
                                                            padding: '4px 8px',
                                                            borderRadius: 4,
                                                            fontSize: 10,
                                                            cursor: 'pointer',
                                                        }}
                                                    >
                                                        Revoke
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default DelegationModal;
