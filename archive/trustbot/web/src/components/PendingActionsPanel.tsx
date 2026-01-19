import React, { useState, useMemo } from 'react';
import { Tooltip } from './Tooltip';
import type { ApprovalRequest, BlackboardEntry, Agent } from '../types';

/**
 * Pending Actions Panel
 *
 * Central hub for all items requiring human attention:
 * - HITL Approval Requests (spawn, decisions, strategies)
 * - Tasks awaiting assignment or stuck
 * - Problems needing resolution
 *
 * "Sleep soundly" means knowing exactly what needs your attention.
 */

interface PendingActionsPanelProps {
    approvals: ApprovalRequest[];
    blackboardEntries: BlackboardEntry[];
    agents: Agent[];
    hitlLevel: number;
    onApprove: (id: string, approved: boolean) => void;
    onClose: () => void;
    onViewTask?: (taskId: string) => void;
    onOpenGlossary?: () => void;
}

type TabType = 'all' | 'approvals' | 'tasks' | 'problems';

export const PendingActionsPanel: React.FC<PendingActionsPanelProps> = ({
    approvals = [],
    blackboardEntries = [],
    agents = [],
    hitlLevel = 100,
    onApprove,
    onClose,
    onOpenGlossary,
}) => {
    const [activeTab, setActiveTab] = useState<TabType>('all');
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

    // Safe arrays with fallbacks
    const safeApprovals = approvals || [];
    const safeEntries = blackboardEntries || [];
    const safeAgents = agents || [];

    // Categorize pending items
    const pendingTasks = useMemo(() =>
        safeEntries.filter(e =>
            e.type === 'TASK' &&
            (e.status === 'OPEN' || e.status === 'IN_PROGRESS')
        ),
        [safeEntries]
    );

    const openProblems = useMemo(() =>
        safeEntries.filter(e =>
            e.type === 'PROBLEM' && e.status === 'OPEN'
        ),
        [safeEntries]
    );

    const pendingApprovals = useMemo(() =>
        safeApprovals.filter(a => a.status === 'PENDING'),
        [safeApprovals]
    );

    // Get all pending items for "all" tab
    const allPendingItems = useMemo(() => {
        const items: Array<{
            id: string;
            type: 'approval' | 'task' | 'problem';
            title: string;
            description: string;
            priority: string;
            timestamp: Date;
            data: ApprovalRequest | BlackboardEntry;
        }> = [];

        // Add approvals
        pendingApprovals.forEach(a => {
            items.push({
                id: a.id,
                type: 'approval',
                title: a.summary,
                description: `${a.type} request from ${a.requestor}`,
                priority: 'HIGH',
                timestamp: new Date(a.createdAt),
                data: a,
            });
        });

        // Add tasks
        pendingTasks.forEach(t => {
            items.push({
                id: t.id,
                type: 'task',
                title: t.title,
                description: t.content,
                priority: t.priority,
                timestamp: t.timestamp,
                data: t,
            });
        });

        // Add problems
        openProblems.forEach(p => {
            items.push({
                id: p.id,
                type: 'problem',
                title: p.title,
                description: p.content,
                priority: p.priority,
                timestamp: p.timestamp,
                data: p,
            });
        });

        // Sort by priority then timestamp
        const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        return items.sort((a, b) => {
            const pA = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2;
            const pB = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2;
            if (pA !== pB) return pA - pB;
            return b.timestamp.getTime() - a.timestamp.getTime();
        });
    }, [pendingApprovals, pendingTasks, openProblems]);

    const filteredItems = useMemo(() => {
        switch (activeTab) {
            case 'approvals':
                return allPendingItems.filter(i => i.type === 'approval');
            case 'tasks':
                return allPendingItems.filter(i => i.type === 'task');
            case 'problems':
                return allPendingItems.filter(i => i.type === 'problem');
            default:
                return allPendingItems;
        }
    }, [activeTab, allPendingItems]);

    const toggleExpanded = (id: string) => {
        const newExpanded = new Set(expandedItems);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedItems(newExpanded);
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'approval': return '⏳';
            case 'task': return '📋';
            case 'problem': return '⚠️';
            default: return '📌';
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'approval': return 'var(--accent-gold)';
            case 'task': return 'var(--accent-blue)';
            case 'problem': return 'var(--accent-red)';
            default: return 'var(--text-muted)';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'CRITICAL': return 'var(--accent-red)';
            case 'HIGH': return 'var(--accent-gold)';
            case 'MEDIUM': return 'var(--accent-blue)';
            case 'LOW': return 'var(--text-muted)';
            default: return 'var(--text-secondary)';
        }
    };

    const formatTimeAgo = (date: Date) => {
        const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    };

    const totalPending = allPendingItems.length;

    return (
        <div className="modal-overlay" onClick={onClose} role="presentation">
            <div
                className="modal pending-actions-panel"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '800px', height: '80vh', display: 'flex', flexDirection: 'column' }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="pending-actions-title"
            >
                {/* Header */}
                <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <h2 id="pending-actions-title" style={{ margin: 0 }}>
                            ⏳ Pending Actions
                        </h2>
                        {totalPending > 0 && (
                            <span style={{
                                padding: '4px 10px',
                                background: 'var(--accent-gold)',
                                color: 'var(--bg-primary)',
                                borderRadius: '12px',
                                fontSize: '0.85rem',
                                fontWeight: 700,
                            }}>
                                {totalPending}
                            </span>
                        )}
                    </div>
                    <button className="close-btn" onClick={onClose} aria-label="Close pending actions">✕</button>
                </div>

                {/* HITL Status Bar */}
                <div style={{
                    padding: '12px 20px',
                    background: hitlLevel >= 80 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Tooltip
                            title="Governance Level"
                            content="Higher HITL means more items require your approval. Lower HITL gives agents more autonomy."
                            position="bottom"
                        >
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                cursor: 'help',
                            }}>
                                <span style={{ fontSize: '1.2rem' }}>
                                    {hitlLevel >= 80 ? '🔒' : hitlLevel >= 50 ? '🔓' : hitlLevel >= 20 ? '🤖' : '🚀'}
                                </span>
                                <span style={{ fontWeight: 600 }}>HITL: {hitlLevel}%</span>
                            </div>
                        </Tooltip>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            {hitlLevel >= 80 ? 'Full oversight mode' :
                             hitlLevel >= 50 ? 'Balanced oversight' :
                             hitlLevel >= 20 ? 'Autonomous mode' : 'Minimal oversight'}
                        </span>
                    </div>
                    {onOpenGlossary && (
                        <button
                            onClick={onOpenGlossary}
                            style={{
                                padding: '6px 12px',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px',
                                color: 'var(--text-secondary)',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                            }}
                        >
                            📖 What is HITL?
                        </button>
                    )}
                </div>

                {/* Tabs */}
                <div style={{
                    display: 'flex',
                    padding: '0 20px',
                    borderBottom: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                }}>
                    {[
                        { id: 'all', label: 'All', count: allPendingItems.length },
                        { id: 'approvals', label: 'Approvals', count: pendingApprovals.length, icon: '⏳' },
                        { id: 'tasks', label: 'Tasks', count: pendingTasks.length, icon: '📋' },
                        { id: 'problems', label: 'Problems', count: openProblems.length, icon: '⚠️' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabType)}
                            style={{
                                padding: '12px 16px',
                                background: 'transparent',
                                border: 'none',
                                borderBottom: activeTab === tab.id ? '2px solid var(--accent-purple)' : '2px solid transparent',
                                color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                                fontWeight: activeTab === tab.id ? 600 : 400,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.15s ease',
                            }}
                        >
                            {tab.icon && <span>{tab.icon}</span>}
                            {tab.label}
                            {tab.count > 0 && (
                                <span style={{
                                    padding: '2px 6px',
                                    background: activeTab === tab.id ? 'var(--accent-purple)' : 'var(--bg-card)',
                                    color: activeTab === tab.id ? 'white' : 'var(--text-muted)',
                                    borderRadius: '8px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                }}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                    {filteredItems.length === 0 ? (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            color: 'var(--text-muted)',
                            textAlign: 'center',
                        }}>
                            <span style={{ fontSize: '3rem', marginBottom: '16px' }}>✅</span>
                            <h3 style={{ margin: '0 0 8px', color: 'var(--accent-green)' }}>All Clear!</h3>
                            <p style={{ margin: 0 }}>
                                {activeTab === 'all'
                                    ? 'No pending actions. Your agents are working autonomously.'
                                    : `No pending ${activeTab}. Check back later.`}
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {filteredItems.map(item => {
                                const isExpanded = expandedItems.has(item.id);
                                const isApproval = item.type === 'approval';

                                return (
                                    <div
                                        key={item.id}
                                        style={{
                                            background: 'var(--bg-card)',
                                            border: `1px solid ${isApproval ? 'var(--accent-gold)' : 'var(--border-color)'}`,
                                            borderRadius: 'var(--radius-md)',
                                            overflow: 'hidden',
                                        }}
                                    >
                                        {/* Item Header */}
                                        <div
                                            onClick={() => toggleExpanded(item.id)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                                padding: '14px 16px',
                                                cursor: 'pointer',
                                                transition: 'background 0.15s ease',
                                            }}
                                            className="pending-item-header"
                                        >
                                            {/* Type Icon */}
                                            <span style={{
                                                width: '36px',
                                                height: '36px',
                                                borderRadius: '50%',
                                                background: `${getTypeColor(item.type)}20`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '1.1rem',
                                                flexShrink: 0,
                                            }}>
                                                {getTypeIcon(item.type)}
                                            </span>

                                            {/* Content */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    marginBottom: '4px',
                                                }}>
                                                    <span style={{ fontWeight: 600 }}>{item.title}</span>
                                                    <span style={{
                                                        padding: '2px 6px',
                                                        background: `${getPriorityColor(item.priority)}20`,
                                                        color: getPriorityColor(item.priority),
                                                        borderRadius: '4px',
                                                        fontSize: '0.65rem',
                                                        fontWeight: 600,
                                                        textTransform: 'uppercase',
                                                    }}>
                                                        {item.priority}
                                                    </span>
                                                </div>
                                                <div style={{
                                                    fontSize: '0.8rem',
                                                    color: 'var(--text-muted)',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}>
                                                    {item.description}
                                                </div>
                                            </div>

                                            {/* Time */}
                                            <span style={{
                                                fontSize: '0.75rem',
                                                color: 'var(--text-muted)',
                                                flexShrink: 0,
                                            }}>
                                                {formatTimeAgo(item.timestamp)}
                                            </span>

                                            {/* Expand Arrow */}
                                            <span style={{
                                                color: 'var(--text-muted)',
                                                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                                transition: 'transform 0.2s ease',
                                            }}>
                                                ▼
                                            </span>
                                        </div>

                                        {/* Expanded Content */}
                                        {isExpanded && (
                                            <div style={{
                                                padding: '0 16px 16px',
                                                borderTop: '1px solid var(--border-color)',
                                                paddingTop: '12px',
                                            }}>
                                                {/* Full Description */}
                                                <div style={{
                                                    padding: '12px',
                                                    background: 'var(--bg-secondary)',
                                                    borderRadius: '6px',
                                                    fontSize: '0.85rem',
                                                    lineHeight: 1.6,
                                                    marginBottom: '12px',
                                                }}>
                                                    {item.description}
                                                </div>

                                                {/* Approval-specific details */}
                                                {isApproval && (
                                                    <div style={{
                                                        display: 'flex',
                                                        gap: '8px',
                                                        marginBottom: '12px',
                                                    }}>
                                                        <span style={{
                                                            padding: '4px 8px',
                                                            background: 'var(--bg-secondary)',
                                                            borderRadius: '4px',
                                                            fontSize: '0.8rem',
                                                        }}>
                                                            Type: <strong>{(item.data as ApprovalRequest).type}</strong>
                                                        </span>
                                                        <span style={{
                                                            padding: '4px 8px',
                                                            background: 'var(--bg-secondary)',
                                                            borderRadius: '4px',
                                                            fontSize: '0.8rem',
                                                        }}>
                                                            From: <strong>{(item.data as ApprovalRequest).requestor}</strong>
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Task-specific: show author */}
                                                {item.type === 'task' && (
                                                    <div style={{
                                                        display: 'flex',
                                                        gap: '8px',
                                                        marginBottom: '12px',
                                                    }}>
                                                        <span style={{
                                                            padding: '4px 8px',
                                                            background: 'var(--bg-secondary)',
                                                            borderRadius: '4px',
                                                            fontSize: '0.8rem',
                                                        }}>
                                                            Author: <strong>{(item.data as BlackboardEntry).author}</strong>
                                                        </span>
                                                        <span style={{
                                                            padding: '4px 8px',
                                                            background: 'var(--bg-secondary)',
                                                            borderRadius: '4px',
                                                            fontSize: '0.8rem',
                                                        }}>
                                                            Status: <strong>{(item.data as BlackboardEntry).status}</strong>
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Actions */}
                                                <div style={{
                                                    display: 'flex',
                                                    gap: '8px',
                                                    justifyContent: 'flex-end',
                                                }}>
                                                    {isApproval && (
                                                        <>
                                                            <button
                                                                onClick={() => onApprove(item.id, false)}
                                                                style={{
                                                                    padding: '8px 16px',
                                                                    background: 'transparent',
                                                                    border: '1px solid var(--accent-red)',
                                                                    color: 'var(--accent-red)',
                                                                    borderRadius: '6px',
                                                                    fontWeight: 600,
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.15s ease',
                                                                }}
                                                            >
                                                                ✗ Deny
                                                            </button>
                                                            <button
                                                                onClick={() => onApprove(item.id, true)}
                                                                style={{
                                                                    padding: '8px 16px',
                                                                    background: 'var(--accent-green)',
                                                                    border: 'none',
                                                                    color: 'white',
                                                                    borderRadius: '6px',
                                                                    fontWeight: 600,
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.15s ease',
                                                                }}
                                                            >
                                                                ✓ Approve
                                                            </button>
                                                        </>
                                                    )}
                                                    {item.type === 'task' && (
                                                        <Tooltip
                                                            content="Run a tick to process this task"
                                                            title="Process Task"
                                                            position="top"
                                                        >
                                                            <button
                                                                style={{
                                                                    padding: '8px 16px',
                                                                    background: 'var(--accent-blue)',
                                                                    border: 'none',
                                                                    color: 'white',
                                                                    borderRadius: '6px',
                                                                    fontWeight: 600,
                                                                    cursor: 'pointer',
                                                                }}
                                                            >
                                                                ⚡ Run Tick
                                                            </button>
                                                        </Tooltip>
                                                    )}
                                                    {item.type === 'problem' && (
                                                        <button
                                                            style={{
                                                                padding: '8px 16px',
                                                                background: 'var(--accent-purple)',
                                                                border: 'none',
                                                                color: 'white',
                                                                borderRadius: '6px',
                                                                fontWeight: 600,
                                                                cursor: 'pointer',
                                                            }}
                                                        >
                                                            🔍 Investigate
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '12px 20px',
                    background: 'var(--bg-secondary)',
                    borderTop: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                }}>
                    <span>
                        💡 Tip: Type <code style={{ color: 'var(--accent-cyan)' }}>approve</code> or <code style={{ color: 'var(--accent-cyan)' }}>tasks</code> in Aria console
                    </span>
                    <span>
                        {safeAgents.filter(a => a.status === 'WORKING').length} agents working
                    </span>
                </div>
            </div>
        </div>
    );
};

export default PendingActionsPanel;
