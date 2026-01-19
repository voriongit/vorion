/**
 * ThoughtLogPanel - Agent Reasoning Transparency Display
 *
 * Shows the complete reasoning chain for agent decisions:
 * Observation → Reasoning → Intent → Action → Result → Delta
 *
 * Key principle: "Understanding a consequence without knowing
 * the antecedent is false logic" - full chain must be auditable
 */

import { useState } from 'react';

// Thought Log Entry structure
export interface ThoughtLogEntry {
    id: string;
    agentId: string;
    agentName: string;
    timestamp: string;
    observation: {
        context: string;
        trigger: string;
        inputs: Record<string, unknown>;
    };
    reasoning: ReasoningStep[];
    intent: {
        goal: string;
        expectedOutcome: string;
        confidence: number;
    };
    action: {
        type: string;
        description: string;
        parameters: Record<string, unknown>;
    };
    result: {
        status: 'success' | 'failure' | 'partial' | 'pending';
        output: string;
        sideEffects?: string[];
    };
    delta: {
        intentMatched: boolean;
        trustImpact: number;
        lessonsLearned?: string;
    };
}

interface ReasoningStep {
    step: number;
    thought: string;
    consideration: string;
    conclusion: string;
}

// Props
interface ThoughtLogPanelProps {
    entries: ThoughtLogEntry[];
    agentId?: string;
    maxEntries?: number;
    onClose?: () => void;
    compact?: boolean;
}

// Color coding for result status
const STATUS_CONFIG = {
    success: { color: '#10b981', icon: '✅', label: 'Success' },
    failure: { color: '#ef4444', icon: '❌', label: 'Failed' },
    partial: { color: '#f59e0b', icon: '⚠️', label: 'Partial' },
    pending: { color: '#6b7280', icon: '⏳', label: 'Pending' },
};

export function ThoughtLogPanel({
    entries,
    agentId,
    maxEntries = 10,
    onClose,
    compact = false,
}: ThoughtLogPanelProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'success' | 'failure'>('all');

    // Filter entries
    const filteredEntries = entries
        .filter(e => !agentId || e.agentId === agentId)
        .filter(e => filter === 'all' || e.result.status === filter)
        .slice(0, maxEntries);

    if (compact) {
        return (
            <div style={{
                background: 'var(--bg-card)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                overflow: 'hidden',
            }}>
                <div style={{
                    padding: '12px 16px',
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(59, 130, 246, 0.2))',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>🧠</span>
                        <span style={{ fontWeight: 700 }}>Thought Log</span>
                    </div>
                    <span style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                    }}>
                        {filteredEntries.length} entries
                    </span>
                </div>
                <div style={{
                    maxHeight: '200px',
                    overflowY: 'auto',
                }}>
                    {filteredEntries.slice(0, 3).map(entry => (
                        <CompactThoughtEntry key={entry.id} entry={entry} />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '800px', maxHeight: '90vh' }}
            >
                {/* Header */}
                <div className="modal-header" style={{
                    background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))',
                    color: 'white',
                    borderBottom: 'none',
                }}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.5rem' }}>🧠</span>
                        Agent Thought Log
                    </h2>
                    <button
                        className="close-btn"
                        onClick={onClose}
                        style={{ color: 'white' }}
                    >
                        ✕
                    </button>
                </div>

                {/* Filters */}
                <div style={{
                    padding: '12px 20px',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    gap: '8px',
                }}>
                    {(['all', 'success', 'failure'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            style={{
                                padding: '6px 14px',
                                borderRadius: '999px',
                                border: 'none',
                                background: filter === f ? 'var(--accent-purple)' : 'var(--bg-card)',
                                color: filter === f ? 'white' : 'var(--text-secondary)',
                                fontSize: '0.8rem',
                                fontWeight: 500,
                                cursor: 'pointer',
                            }}
                        >
                            {f === 'all' ? '🔍 All' : f === 'success' ? '✅ Success' : '❌ Failed'}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="modal-content" style={{
                    maxHeight: 'calc(90vh - 150px)',
                    overflowY: 'auto',
                    padding: '16px 20px',
                }}>
                    {filteredEntries.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '60px 20px',
                            color: 'var(--text-muted)',
                        }}>
                            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🧠</div>
                            <div style={{ fontWeight: 600 }}>No Thoughts Yet</div>
                            <div style={{ fontSize: '0.85rem' }}>
                                Agent reasoning will appear here as they work
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {filteredEntries.map(entry => (
                                <ThoughtEntry
                                    key={entry.id}
                                    entry={entry}
                                    expanded={expandedId === entry.id}
                                    onToggle={() => setExpandedId(
                                        expandedId === entry.id ? null : entry.id
                                    )}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Full thought entry component
function ThoughtEntry({
    entry,
    expanded,
    onToggle,
}: {
    entry: ThoughtLogEntry;
    expanded: boolean;
    onToggle: () => void;
}) {
    const status = STATUS_CONFIG[entry.result.status];

    return (
        <div style={{
            background: 'var(--bg-card)',
            borderRadius: '12px',
            border: `1px solid ${expanded ? 'var(--accent-purple)' : 'var(--border-color)'}`,
            overflow: 'hidden',
            transition: 'border-color 0.2s ease',
        }}>
            {/* Header - Always visible */}
            <div
                onClick={onToggle}
                style={{
                    padding: '16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                }}
            >
                <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: `${status.color}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    flexShrink: 0,
                }}>
                    {status.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '4px',
                    }}>
                        <span style={{ fontWeight: 700 }}>{entry.agentName}</span>
                        <span style={{
                            padding: '2px 8px',
                            background: `${status.color}20`,
                            color: status.color,
                            borderRadius: '999px',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                        }}>
                            {status.label}
                        </span>
                    </div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '8px' }}>
                        <strong>Intent:</strong> {entry.intent.goal}
                    </div>
                    <div style={{
                        display: 'flex',
                        gap: '16px',
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                    }}>
                        <span>🕐 {new Date(entry.timestamp).toLocaleTimeString()}</span>
                        <span>📊 Confidence: {Math.round(entry.intent.confidence * 100)}%</span>
                        <span style={{
                            color: entry.delta.trustImpact >= 0 ? '#10b981' : '#ef4444',
                        }}>
                            {entry.delta.trustImpact >= 0 ? '↑' : '↓'} Trust: {entry.delta.trustImpact > 0 ? '+' : ''}{entry.delta.trustImpact}
                        </span>
                    </div>
                </div>
                <span style={{
                    color: 'var(--text-muted)',
                    fontSize: '1.25rem',
                    transition: 'transform 0.2s ease',
                    transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                }}>
                    ▼
                </span>
            </div>

            {/* Expanded Details */}
            {expanded && (
                <div style={{
                    padding: '0 16px 16px',
                    borderTop: '1px solid var(--border-color)',
                    marginTop: '-1px',
                }}>
                    {/* Reasoning Chain Visualization */}
                    <div style={{
                        display: 'flex',
                        gap: '4px',
                        padding: '16px 0',
                        justifyContent: 'center',
                    }}>
                        {['Observation', 'Reasoning', 'Intent', 'Action', 'Result', 'Delta'].map((step, i) => (
                            <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
                                <div style={{
                                    padding: '4px 10px',
                                    background: i === 5
                                        ? (entry.delta.intentMatched ? '#10b98120' : '#ef444420')
                                        : 'var(--bg-secondary)',
                                    borderRadius: '999px',
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    color: i === 5
                                        ? (entry.delta.intentMatched ? '#10b981' : '#ef4444')
                                        : 'var(--text-secondary)',
                                }}>
                                    {step}
                                </div>
                                {i < 5 && (
                                    <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>→</span>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Observation */}
                    <Section title="👁️ Observation" color="#06b6d4">
                        <div style={{ marginBottom: '8px' }}>
                            <strong>Trigger:</strong> {entry.observation.trigger}
                        </div>
                        <div>
                            <strong>Context:</strong> {entry.observation.context}
                        </div>
                    </Section>

                    {/* Reasoning Steps */}
                    <Section title="🧠 Reasoning Chain" color="#8b5cf6">
                        {entry.reasoning.map(step => (
                            <div key={step.step} style={{
                                padding: '10px',
                                background: 'var(--bg-secondary)',
                                borderRadius: '8px',
                                marginBottom: '8px',
                                borderLeft: '3px solid var(--accent-purple)',
                            }}>
                                <div style={{
                                    fontSize: '0.75rem',
                                    color: 'var(--accent-purple)',
                                    fontWeight: 600,
                                    marginBottom: '4px',
                                }}>
                                    Step {step.step}
                                </div>
                                <div style={{ fontSize: '0.85rem', marginBottom: '4px' }}>
                                    <strong>Thought:</strong> {step.thought}
                                </div>
                                <div style={{ fontSize: '0.85rem', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                                    <strong>Considered:</strong> {step.consideration}
                                </div>
                                <div style={{ fontSize: '0.85rem', color: '#10b981' }}>
                                    <strong>Conclusion:</strong> {step.conclusion}
                                </div>
                            </div>
                        ))}
                    </Section>

                    {/* Intent */}
                    <Section title="🎯 Intent" color="#f59e0b">
                        <div style={{ marginBottom: '8px' }}>
                            <strong>Goal:</strong> {entry.intent.goal}
                        </div>
                        <div style={{ marginBottom: '8px' }}>
                            <strong>Expected Outcome:</strong> {entry.intent.expectedOutcome}
                        </div>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                        }}>
                            <strong>Confidence:</strong>
                            <div style={{
                                flex: 1,
                                height: '6px',
                                background: 'var(--bg-secondary)',
                                borderRadius: '3px',
                                overflow: 'hidden',
                            }}>
                                <div style={{
                                    width: `${entry.intent.confidence * 100}%`,
                                    height: '100%',
                                    background: '#f59e0b',
                                    borderRadius: '3px',
                                }} />
                            </div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                                {Math.round(entry.intent.confidence * 100)}%
                            </span>
                        </div>
                    </Section>

                    {/* Action */}
                    <Section title="⚡ Action Taken" color="#3b82f6">
                        <div style={{ marginBottom: '8px' }}>
                            <strong>Type:</strong>{' '}
                            <span style={{
                                padding: '2px 8px',
                                background: '#3b82f620',
                                borderRadius: '4px',
                                fontFamily: 'monospace',
                            }}>
                                {entry.action.type}
                            </span>
                        </div>
                        <div>{entry.action.description}</div>
                    </Section>

                    {/* Result */}
                    <Section title={`${status.icon} Result`} color={status.color}>
                        <div style={{ marginBottom: '8px' }}>{entry.result.output}</div>
                        {entry.result.sideEffects && entry.result.sideEffects.length > 0 && (
                            <div>
                                <strong>Side Effects:</strong>
                                <ul style={{ margin: '4px 0 0 20px', padding: 0 }}>
                                    {entry.result.sideEffects.map((effect, i) => (
                                        <li key={i} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                            {effect}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </Section>

                    {/* Delta Analysis */}
                    <Section
                        title={entry.delta.intentMatched ? '✅ Intent Matched' : '⚠️ Intent Mismatch'}
                        color={entry.delta.intentMatched ? '#10b981' : '#f59e0b'}
                    >
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            marginBottom: entry.delta.lessonsLearned ? '12px' : 0,
                        }}>
                            <div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Trust Impact</div>
                                <div style={{
                                    fontSize: '1.25rem',
                                    fontWeight: 700,
                                    color: entry.delta.trustImpact >= 0 ? '#10b981' : '#ef4444',
                                }}>
                                    {entry.delta.trustImpact > 0 ? '+' : ''}{entry.delta.trustImpact}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Outcome</div>
                                <div style={{ fontWeight: 600 }}>
                                    {entry.delta.intentMatched ? 'As Expected' : 'Deviated'}
                                </div>
                            </div>
                        </div>
                        {entry.delta.lessonsLearned && (
                            <div style={{
                                padding: '10px',
                                background: 'rgba(139, 92, 246, 0.1)',
                                borderRadius: '8px',
                                fontSize: '0.85rem',
                            }}>
                                <strong>📝 Lesson Learned:</strong> {entry.delta.lessonsLearned}
                            </div>
                        )}
                    </Section>
                </div>
            )}
        </div>
    );
}

// Section component for expanded view
function Section({
    title,
    color,
    children,
}: {
    title: string;
    color: string;
    children: React.ReactNode;
}) {
    return (
        <div style={{ marginBottom: '16px' }}>
            <div style={{
                fontWeight: 700,
                fontSize: '0.9rem',
                color,
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
            }}>
                {title}
            </div>
            <div style={{
                padding: '12px',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                fontSize: '0.85rem',
            }}>
                {children}
            </div>
        </div>
    );
}

// Compact entry for inline display
function CompactThoughtEntry({ entry }: { entry: ThoughtLogEntry }) {
    const status = STATUS_CONFIG[entry.result.status];

    return (
        <div style={{
            padding: '10px 16px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
        }}>
            <span style={{ fontSize: '1rem' }}>{status.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                }}>
                    {entry.intent.goal}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {entry.agentName} • {new Date(entry.timestamp).toLocaleTimeString()}
                </div>
            </div>
            <span style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: entry.delta.trustImpact >= 0 ? '#10b981' : '#ef4444',
            }}>
                {entry.delta.trustImpact > 0 ? '+' : ''}{entry.delta.trustImpact}
            </span>
        </div>
    );
}

// Demo data generator for testing
export function generateDemoThoughtLog(): ThoughtLogEntry {
    return {
        id: `thought-${Date.now()}`,
        agentId: 'agent-1',
        agentName: 'T5-EXECUTOR',
        timestamp: new Date().toISOString(),
        observation: {
            context: 'User requested customer support automation analysis',
            trigger: 'New task assigned from queue',
            inputs: { taskId: 'task-123', priority: 'high' },
        },
        reasoning: [
            {
                step: 1,
                thought: 'This task requires analyzing current support workflow',
                consideration: 'Should I delegate to a specialist or handle directly?',
                conclusion: 'My tier allows handling - proceeding with analysis',
            },
            {
                step: 2,
                thought: 'Need to gather metrics on current response times',
                consideration: 'Data could come from CRM or internal logs',
                conclusion: 'Will query internal analytics API for accurate data',
            },
        ],
        intent: {
            goal: 'Generate comprehensive support automation analysis',
            expectedOutcome: 'Detailed report with actionable recommendations',
            confidence: 0.87,
        },
        action: {
            type: 'ANALYZE_AND_REPORT',
            description: 'Executed support workflow analysis and generated report',
            parameters: { format: 'detailed', includeRecommendations: true },
        },
        result: {
            status: 'success',
            output: 'Analysis complete: Identified 3 automation opportunities that could reduce response time by 45%',
            sideEffects: ['Updated analytics dashboard', 'Notified stakeholders'],
        },
        delta: {
            intentMatched: true,
            trustImpact: 10,
            lessonsLearned: 'Parallel data queries improved analysis speed by 30%',
        },
    };
}

export default ThoughtLogPanel;
