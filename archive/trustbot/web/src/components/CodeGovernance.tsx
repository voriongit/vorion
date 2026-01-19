import { useState } from 'react';
import type { Agent } from '../types';

/**
 * Code Modification Governance
 *
 * Tier-based access control for code modifications.
 * Higher tiers can modify more, lower tiers need approvals.
 */

interface CodeGovernanceProps {
    onClose: () => void;
    currentAgent?: Agent;
    onApproveChange?: (changeId: string) => void;
    onRejectChange?: (changeId: string, reason: string) => void;
}

interface CodePermission {
    action: string;
    description: string;
    minTier: number;
    requiresApproval: boolean;
    approverMinTier: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface PendingChange {
    id: string;
    agentId: string;
    agentName: string;
    agentTier: number;
    action: string;
    targetFile: string;
    description: string;
    diff: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    requestedAt: string;
    status: 'pending' | 'approved' | 'rejected';
}

const CODE_PERMISSIONS: CodePermission[] = [
    // T0 - Passive: No code access
    { action: 'READ_LOGS', description: 'View execution logs', minTier: 0, requiresApproval: false, approverMinTier: 0, riskLevel: 'low' },

    // T1 - Worker: Read-only
    { action: 'READ_CODE', description: 'Read source files', minTier: 1, requiresApproval: false, approverMinTier: 0, riskLevel: 'low' },
    { action: 'ANALYZE_CODE', description: 'Run static analysis', minTier: 1, requiresApproval: false, approverMinTier: 0, riskLevel: 'low' },

    // T2 - Operational: Documentation & comments
    { action: 'EDIT_COMMENTS', description: 'Modify code comments', minTier: 2, requiresApproval: true, approverMinTier: 3, riskLevel: 'low' },
    { action: 'EDIT_DOCS', description: 'Update documentation', minTier: 2, requiresApproval: true, approverMinTier: 3, riskLevel: 'low' },
    { action: 'FORMAT_CODE', description: 'Apply code formatting', minTier: 2, requiresApproval: true, approverMinTier: 3, riskLevel: 'low' },

    // T3 - Tactical: Non-breaking changes
    { action: 'ADD_TESTS', description: 'Add new test cases', minTier: 3, requiresApproval: true, approverMinTier: 4, riskLevel: 'medium' },
    { action: 'FIX_BUGS', description: 'Fix identified bugs', minTier: 3, requiresApproval: true, approverMinTier: 4, riskLevel: 'medium' },
    { action: 'REFACTOR_LOCAL', description: 'Refactor within a file', minTier: 3, requiresApproval: true, approverMinTier: 4, riskLevel: 'medium' },

    // T4 - Executive: Significant changes
    { action: 'ADD_FEATURES', description: 'Implement new features', minTier: 4, requiresApproval: true, approverMinTier: 5, riskLevel: 'high' },
    { action: 'MODIFY_API', description: 'Change API contracts', minTier: 4, requiresApproval: true, approverMinTier: 5, riskLevel: 'high' },
    { action: 'REFACTOR_CROSS', description: 'Cross-file refactoring', minTier: 4, requiresApproval: true, approverMinTier: 5, riskLevel: 'high' },

    // T5 - Sovereign: All access
    { action: 'MODIFY_CORE', description: 'Modify core systems', minTier: 5, requiresApproval: false, approverMinTier: 5, riskLevel: 'critical' },
    { action: 'DELETE_FILES', description: 'Delete source files', minTier: 5, requiresApproval: false, approverMinTier: 5, riskLevel: 'critical' },
    { action: 'MODIFY_CONFIG', description: 'Change system config', minTier: 5, requiresApproval: false, approverMinTier: 5, riskLevel: 'critical' },
    { action: 'DEPLOY', description: 'Deploy to production', minTier: 5, requiresApproval: false, approverMinTier: 5, riskLevel: 'critical' },
];

const SAMPLE_PENDING_CHANGES: PendingChange[] = [
    {
        id: 'chg-1',
        agentId: 'asst-1',
        agentName: 'ResearchAssistant',
        agentTier: 1,
        action: 'EDIT_DOCS',
        targetFile: 'README.md',
        description: 'Update installation instructions with new dependencies',
        diff: `@@ -15,6 +15,8 @@
 npm install
+npm install @anthropic-ai/sdk
+npm install zod
 npm run dev`,
        riskLevel: 'low',
        requestedAt: new Date(Date.now() - 1800000).toISOString(),
        status: 'pending',
    },
    {
        id: 'chg-2',
        agentId: 'plan-1',
        agentName: 'T5-PLANNER',
        agentTier: 5,
        action: 'ADD_FEATURES',
        targetFile: 'src/core/TrustEngine.ts',
        description: 'Add batch trust score update method for efficiency',
        diff: `@@ -145,6 +145,25 @@
+  /**
+   * Batch update trust scores for multiple agents
+   */
+  async batchUpdateTrust(updates: Array<{agentId: string, delta: number}>) {
+    const results = await Promise.all(
+      updates.map(u => this.updateTrust(u.agentId, u.delta))
+    );
+    return results;
+  }`,
        riskLevel: 'high',
        requestedAt: new Date(Date.now() - 3600000).toISOString(),
        status: 'pending',
    },
];

const TIER_NAMES = ['PASSIVE', 'WORKER', 'OPERATIONAL', 'TACTICAL', 'EXECUTIVE', 'SOVEREIGN'];
const TIER_COLORS = ['#6b7280', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#fbbf24'];

const RISK_STYLES = {
    low: { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', text: '#10b981' },
    medium: { bg: 'rgba(59, 130, 246, 0.15)', border: '#3b82f6', text: '#3b82f6' },
    high: { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', text: '#f59e0b' },
    critical: { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#ef4444' },
};

export function CodeGovernance({
    onClose,
    currentAgent,
    onApproveChange,
    onRejectChange,
}: CodeGovernanceProps) {
    const [activeTab, setActiveTab] = useState<'permissions' | 'pending' | 'history'>('permissions');
    const [selectedChange, setSelectedChange] = useState<PendingChange | null>(null);
    const [pendingChanges] = useState<PendingChange[]>(SAMPLE_PENDING_CHANGES);

    const currentTier = currentAgent?.tier ?? 5;

    // Group permissions by tier
    const permissionsByTier = CODE_PERMISSIONS.reduce((acc, perm) => {
        if (!acc[perm.minTier]) acc[perm.minTier] = [];
        acc[perm.minTier].push(perm);
        return acc;
    }, {} as Record<number, CodePermission[]>);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '900px', maxHeight: '90vh' }}
            >
                {/* Header */}
                <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.5rem' }}>🔐</span>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Code Governance</h2>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Tier-based code modification controls
                            </p>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                {/* Tabs */}
                <div style={{
                    display: 'flex',
                    borderBottom: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                }}>
                    {[
                        { id: 'permissions', label: 'Permission Matrix', icon: '📋' },
                        { id: 'pending', label: 'Pending Changes', icon: '⏳', count: pendingChanges.filter(c => c.status === 'pending').length },
                        { id: 'history', label: 'Change History', icon: '📜' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as typeof activeTab)}
                            style={{
                                flex: 1,
                                padding: '12px',
                                background: activeTab === tab.id ? 'var(--bg-card)' : 'transparent',
                                border: 'none',
                                borderBottom: activeTab === tab.id ? '2px solid var(--accent-blue)' : '2px solid transparent',
                                color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                            }}
                        >
                            {tab.icon} {tab.label}
                            {tab.count !== undefined && tab.count > 0 && (
                                <span style={{
                                    padding: '2px 6px',
                                    background: 'var(--accent-gold)',
                                    color: 'black',
                                    borderRadius: '10px',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                }}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div style={{ padding: '20px', overflowY: 'auto', maxHeight: 'calc(90vh - 140px)' }}>
                    {/* Permission Matrix Tab */}
                    {activeTab === 'permissions' && (
                        <div>
                            {/* Current Tier Indicator */}
                            <div style={{
                                padding: '16px',
                                background: `linear-gradient(135deg, ${TIER_COLORS[currentTier]}20, transparent)`,
                                border: `1px solid ${TIER_COLORS[currentTier]}`,
                                borderRadius: '12px',
                                marginBottom: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '16px',
                            }}>
                                <div style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '50%',
                                    background: TIER_COLORS[currentTier],
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontWeight: 700,
                                    fontSize: '1.25rem',
                                }}>
                                    T{currentTier}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                                        Your Access Level: {TIER_NAMES[currentTier]}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        {CODE_PERMISSIONS.filter(p => p.minTier <= currentTier).length} of {CODE_PERMISSIONS.length} permissions available
                                    </div>
                                </div>
                            </div>

                            {/* Permission Grid */}
                            {Object.entries(permissionsByTier).map(([tier, perms]) => (
                                <div key={tier} style={{ marginBottom: '20px' }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        marginBottom: '12px',
                                    }}>
                                        <div style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '50%',
                                            background: TIER_COLORS[parseInt(tier)],
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'white',
                                            fontWeight: 700,
                                            fontSize: '0.8rem',
                                        }}>
                                            T{tier}
                                        </div>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                            {TIER_NAMES[parseInt(tier)]}
                                        </div>
                                        {parseInt(tier) > currentTier && (
                                            <span style={{
                                                padding: '2px 8px',
                                                background: 'rgba(239, 68, 68, 0.15)',
                                                color: 'var(--accent-red)',
                                                borderRadius: '4px',
                                                fontSize: '0.65rem',
                                                fontWeight: 600,
                                            }}>
                                                🔒 LOCKED
                                            </span>
                                        )}
                                    </div>

                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                                        gap: '8px',
                                    }}>
                                        {perms.map(perm => {
                                            const hasAccess = currentTier >= perm.minTier;
                                            const riskStyle = RISK_STYLES[perm.riskLevel];

                                            return (
                                                <div
                                                    key={perm.action}
                                                    style={{
                                                        padding: '12px',
                                                        background: hasAccess ? 'var(--bg-card)' : 'var(--bg-secondary)',
                                                        border: `1px solid ${hasAccess ? riskStyle.border : 'var(--border-color)'}`,
                                                        borderRadius: '8px',
                                                        opacity: hasAccess ? 1 : 0.5,
                                                    }}
                                                >
                                                    <div style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        marginBottom: '6px',
                                                    }}>
                                                        <span style={{
                                                            fontWeight: 600,
                                                            fontSize: '0.8rem',
                                                            color: hasAccess ? 'var(--text-primary)' : 'var(--text-muted)',
                                                        }}>
                                                            {perm.action.replace(/_/g, ' ')}
                                                        </span>
                                                        <span style={{
                                                            padding: '2px 6px',
                                                            background: riskStyle.bg,
                                                            color: riskStyle.text,
                                                            borderRadius: '4px',
                                                            fontSize: '0.6rem',
                                                            fontWeight: 600,
                                                            textTransform: 'uppercase',
                                                        }}>
                                                            {perm.riskLevel}
                                                        </span>
                                                    </div>
                                                    <div style={{
                                                        fontSize: '0.75rem',
                                                        color: 'var(--text-muted)',
                                                        marginBottom: '6px',
                                                    }}>
                                                        {perm.description}
                                                    </div>
                                                    {perm.requiresApproval && (
                                                        <div style={{
                                                            fontSize: '0.65rem',
                                                            color: 'var(--accent-gold)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                        }}>
                                                            ✋ Requires T{perm.approverMinTier}+ approval
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Pending Changes Tab */}
                    {activeTab === 'pending' && (
                        <div style={{ display: 'flex', gap: '16px' }}>
                            {/* Change List */}
                            <div style={{ flex: 1 }}>
                                {pendingChanges.filter(c => c.status === 'pending').length === 0 ? (
                                    <div style={{
                                        textAlign: 'center',
                                        padding: '40px',
                                        color: 'var(--text-muted)',
                                    }}>
                                        <span style={{ fontSize: '2rem' }}>✅</span>
                                        <p>No pending code changes</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {pendingChanges.filter(c => c.status === 'pending').map(change => {
                                            const riskStyle = RISK_STYLES[change.riskLevel];
                                            return (
                                                <div
                                                    key={change.id}
                                                    onClick={() => setSelectedChange(change)}
                                                    style={{
                                                        padding: '14px',
                                                        background: selectedChange?.id === change.id
                                                            ? 'var(--bg-card-hover)'
                                                            : 'var(--bg-card)',
                                                        border: selectedChange?.id === change.id
                                                            ? `2px solid ${riskStyle.border}`
                                                            : '1px solid var(--border-color)',
                                                        borderRadius: '10px',
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    <div style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '10px',
                                                        marginBottom: '8px',
                                                    }}>
                                                        <div style={{
                                                            width: '28px',
                                                            height: '28px',
                                                            borderRadius: '50%',
                                                            background: TIER_COLORS[change.agentTier],
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            color: 'white',
                                                            fontWeight: 700,
                                                            fontSize: '0.7rem',
                                                        }}>
                                                            T{change.agentTier}
                                                        </div>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                                                                {change.action.replace(/_/g, ' ')}
                                                            </div>
                                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                                {change.agentName} → {change.targetFile}
                                                            </div>
                                                        </div>
                                                        <span style={{
                                                            padding: '4px 8px',
                                                            background: riskStyle.bg,
                                                            color: riskStyle.text,
                                                            borderRadius: '6px',
                                                            fontSize: '0.65rem',
                                                            fontWeight: 600,
                                                            textTransform: 'uppercase',
                                                        }}>
                                                            {change.riskLevel}
                                                        </span>
                                                    </div>
                                                    <p style={{
                                                        margin: 0,
                                                        fontSize: '0.8rem',
                                                        color: 'var(--text-secondary)',
                                                    }}>
                                                        {change.description}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Change Detail with Diff View */}
                            {selectedChange && (
                                <div style={{
                                    width: '400px',
                                    padding: '16px',
                                    background: 'var(--bg-secondary)',
                                    borderRadius: '12px',
                                }}>
                                    <div style={{ marginBottom: '16px' }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            marginBottom: '8px',
                                        }}>
                                            <span style={{
                                                padding: '4px 8px',
                                                background: RISK_STYLES[selectedChange.riskLevel].bg,
                                                color: RISK_STYLES[selectedChange.riskLevel].text,
                                                borderRadius: '6px',
                                                fontSize: '0.7rem',
                                                fontWeight: 600,
                                            }}>
                                                {selectedChange.riskLevel.toUpperCase()} RISK
                                            </span>
                                        </div>
                                        <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem' }}>
                                            {selectedChange.action.replace(/_/g, ' ')}
                                        </h3>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            📄 {selectedChange.targetFile}
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: '16px' }}>
                                        <div style={{
                                            fontSize: '0.7rem',
                                            color: 'var(--text-muted)',
                                            marginBottom: '6px',
                                            textTransform: 'uppercase',
                                        }}>
                                            Requested By
                                        </div>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                        }}>
                                            <div style={{
                                                width: '24px',
                                                height: '24px',
                                                borderRadius: '50%',
                                                background: TIER_COLORS[selectedChange.agentTier],
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'white',
                                                fontWeight: 700,
                                                fontSize: '0.6rem',
                                            }}>
                                                T{selectedChange.agentTier}
                                            </div>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                                                {selectedChange.agentName}
                                            </span>
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: '16px' }}>
                                        <div style={{
                                            fontSize: '0.7rem',
                                            color: 'var(--text-muted)',
                                            marginBottom: '6px',
                                            textTransform: 'uppercase',
                                        }}>
                                            Description
                                        </div>
                                        <p style={{
                                            margin: 0,
                                            fontSize: '0.85rem',
                                            color: 'var(--text-secondary)',
                                            lineHeight: 1.5,
                                        }}>
                                            {selectedChange.description}
                                        </p>
                                    </div>

                                    <div style={{ marginBottom: '16px' }}>
                                        <div style={{
                                            fontSize: '0.7rem',
                                            color: 'var(--text-muted)',
                                            marginBottom: '6px',
                                            textTransform: 'uppercase',
                                        }}>
                                            Diff Preview
                                        </div>
                                        <pre style={{
                                            margin: 0,
                                            padding: '12px',
                                            background: '#1e1e1e',
                                            borderRadius: '8px',
                                            fontSize: '0.7rem',
                                            fontFamily: 'monospace',
                                            overflow: 'auto',
                                            maxHeight: '200px',
                                        }}>
                                            {selectedChange.diff.split('\n').map((line, i) => (
                                                <div
                                                    key={i}
                                                    style={{
                                                        color: line.startsWith('+')
                                                            ? '#4ade80'
                                                            : line.startsWith('-')
                                                                ? '#f87171'
                                                                : line.startsWith('@')
                                                                    ? '#60a5fa'
                                                                    : '#9ca3af',
                                                        background: line.startsWith('+')
                                                            ? 'rgba(74, 222, 128, 0.1)'
                                                            : line.startsWith('-')
                                                                ? 'rgba(248, 113, 113, 0.1)'
                                                                : 'transparent',
                                                    }}
                                                >
                                                    {line}
                                                </div>
                                            ))}
                                        </pre>
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            onClick={() => {
                                                onRejectChange?.(selectedChange.id, 'Rejected by reviewer');
                                                setSelectedChange(null);
                                            }}
                                            style={{
                                                flex: 1,
                                                padding: '10px',
                                                background: 'var(--accent-red)',
                                                border: 'none',
                                                borderRadius: '8px',
                                                color: 'white',
                                                fontSize: '0.8rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                            }}
                                        >
                                            ✕ Reject
                                        </button>
                                        <button
                                            onClick={() => {
                                                onApproveChange?.(selectedChange.id);
                                                setSelectedChange(null);
                                            }}
                                            style={{
                                                flex: 1,
                                                padding: '10px',
                                                background: 'var(--accent-green)',
                                                border: 'none',
                                                borderRadius: '8px',
                                                color: 'white',
                                                fontSize: '0.8rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                            }}
                                        >
                                            ✓ Approve
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* History Tab */}
                    {activeTab === 'history' && (
                        <div style={{
                            textAlign: 'center',
                            padding: '40px',
                            color: 'var(--text-muted)',
                        }}>
                            <span style={{ fontSize: '2rem' }}>📜</span>
                            <p>Change history will appear here</p>
                            <p style={{ fontSize: '0.8rem' }}>Approved and rejected changes with audit trail</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default CodeGovernance;
