import { useState } from 'react';
import type { Agent } from '../types';

/**
 * Request/Grant Flow
 *
 * Enables lower-tier agents to request assistance from upper-tier agents.
 * Upper-tier agents can grant capabilities, resources, or direct assistance.
 */

interface RequestGrantPanelProps {
    currentAgent: Agent;
    allAgents: Agent[];
    onClose: () => void;
    onSubmitRequest?: (request: AssistanceRequest) => void;
    onGrantRequest?: (requestId: string, grantedCapabilities: string[]) => void;
}

export interface AssistanceRequest {
    id: string;
    requesterId: string;
    requesterName: string;
    requesterTier: number;
    targetTier: number;
    requestType: RequestType;
    title: string;
    description: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    requestedCapabilities: string[];
    justification: string;
    status: 'pending' | 'granted' | 'denied' | 'partial';
    createdAt: string;
    respondedAt?: string;
    responderId?: string;
    grantedCapabilities?: string[];
    denialReason?: string;
}

type RequestType =
    | 'CAPABILITY_GRANT'    // Request access to higher-tier capability
    | 'RESOURCE_ACCESS'     // Request access to restricted resources
    | 'DECISION_APPROVAL'   // Request approval for a decision
    | 'DIRECT_ASSISTANCE'   // Request direct help from upper tier
    | 'ESCALATION'          // Escalate an issue to upper tier
    | 'KNOWLEDGE_SHARE';    // Request knowledge/training from upper tier

const REQUEST_TYPES: { type: RequestType; icon: string; label: string; description: string }[] = [
    { type: 'CAPABILITY_GRANT', icon: '🔓', label: 'Capability Grant', description: 'Request temporary access to a higher-tier capability' },
    { type: 'RESOURCE_ACCESS', icon: '📦', label: 'Resource Access', description: 'Request access to restricted resources or APIs' },
    { type: 'DECISION_APPROVAL', icon: '⚖️', label: 'Decision Approval', description: 'Get approval for a decision above your authority' },
    { type: 'DIRECT_ASSISTANCE', icon: '🤝', label: 'Direct Assistance', description: 'Request hands-on help from an upper-tier agent' },
    { type: 'ESCALATION', icon: '⬆️', label: 'Escalation', description: 'Escalate an issue that requires higher authority' },
    { type: 'KNOWLEDGE_SHARE', icon: '📚', label: 'Knowledge Share', description: 'Request training or knowledge transfer' },
];

const TIER_CAPABILITIES: Record<number, string[]> = {
    5: ['Strategic Planning', 'Agent Spawning', 'System Configuration', 'Cross-Org Decisions'],
    4: ['Resource Allocation', 'Agent Promotion', 'External API Access', 'Workflow Automation'],
    3: ['Task Delegation', 'Meeting Scheduling', 'Report Generation', 'Internal API Access'],
    2: ['Data Analysis', 'Content Generation', 'Basic Automation', 'Notification Sending'],
    1: ['Information Retrieval', 'Status Reporting', 'Basic Queries'],
    0: ['Observation', 'Logging'],
};

// Sample pending requests for demo
const SAMPLE_REQUESTS: AssistanceRequest[] = [
    {
        id: 'req-1',
        requesterId: 'asst-1',
        requesterName: 'ResearchAssistant',
        requesterTier: 1,
        targetTier: 3,
        requestType: 'CAPABILITY_GRANT',
        title: 'Access to External Research APIs',
        description: 'Need to query external research databases to complete competitive analysis task.',
        urgency: 'medium',
        requestedCapabilities: ['External API Access'],
        justification: 'Current task requires data not available in internal systems. One-time access sufficient.',
        status: 'pending',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
        id: 'req-2',
        requesterId: 'listen-1',
        requesterName: 'DecisionListener',
        requesterTier: 0,
        targetTier: 2,
        requestType: 'ESCALATION',
        title: 'Unusual Pattern Detected',
        description: 'Detected anomalous decision pattern requiring analysis beyond my capabilities.',
        urgency: 'high',
        requestedCapabilities: ['Data Analysis'],
        justification: 'Pattern matches potential security concern. Recommend immediate review.',
        status: 'pending',
        createdAt: new Date(Date.now() - 1800000).toISOString(),
    },
];

const URGENCY_COLORS = {
    low: { bg: 'rgba(107, 114, 128, 0.2)', text: '#9ca3af' },
    medium: { bg: 'rgba(59, 130, 246, 0.2)', text: '#3b82f6' },
    high: { bg: 'rgba(245, 158, 11, 0.2)', text: '#f59e0b' },
    critical: { bg: 'rgba(239, 68, 68, 0.2)', text: '#ef4444' },
};

export function RequestGrantPanel({
    currentAgent,
    allAgents,
    onClose,
    onSubmitRequest,
    onGrantRequest,
}: RequestGrantPanelProps) {
    const [activeTab, setActiveTab] = useState<'create' | 'pending' | 'history'>('pending');
    const [selectedType, setSelectedType] = useState<RequestType | null>(null);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        urgency: 'medium' as AssistanceRequest['urgency'],
        capabilities: [] as string[],
        justification: '',
    });
    const [pendingRequests] = useState<AssistanceRequest[]>(SAMPLE_REQUESTS);
    const [selectedRequest, setSelectedRequest] = useState<AssistanceRequest | null>(null);

    // Get available upper-tier agents
    const upperTierAgents = allAgents.filter(a => a.tier > currentAgent.tier);

    // Get capabilities available to request
    const requestableCapabilities = Object.entries(TIER_CAPABILITIES)
        .filter(([tier]) => parseInt(tier) > currentAgent.tier)
        .flatMap(([, caps]) => caps);

    const handleSubmit = () => {
        if (!selectedType || !formData.title) return;

        const request: AssistanceRequest = {
            id: `req-${Date.now()}`,
            requesterId: currentAgent.id,
            requesterName: currentAgent.name,
            requesterTier: currentAgent.tier,
            targetTier: currentAgent.tier + 1,
            requestType: selectedType,
            title: formData.title,
            description: formData.description,
            urgency: formData.urgency,
            requestedCapabilities: formData.capabilities,
            justification: formData.justification,
            status: 'pending',
            createdAt: new Date().toISOString(),
        };

        onSubmitRequest?.(request);

        // Reset form
        setSelectedType(null);
        setFormData({
            title: '',
            description: '',
            urgency: 'medium',
            capabilities: [],
            justification: '',
        });
        setActiveTab('pending');
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '800px', maxHeight: '90vh' }}
            >
                {/* Header */}
                <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.5rem' }}>🤝</span>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Request / Grant</h2>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Request help from upper tiers • {upperTierAgents.length} agents available
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
                        { id: 'pending', label: 'Pending', icon: '⏳', count: pendingRequests.length },
                        { id: 'create', label: 'New Request', icon: '➕', count: 0 },
                        { id: 'history', label: 'History', icon: '📜', count: 0 },
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
                            {tab.count > 0 && (
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
                <div style={{ padding: '20px', overflowY: 'auto', maxHeight: 'calc(90vh - 160px)' }}>
                    {/* Create New Request Tab */}
                    {activeTab === 'create' && (
                        <div>
                            {!selectedType ? (
                                <div>
                                    <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>
                                        What type of assistance do you need?
                                    </h3>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                        gap: '12px',
                                    }}>
                                        {REQUEST_TYPES.map(rt => (
                                            <button
                                                key={rt.type}
                                                onClick={() => setSelectedType(rt.type)}
                                                style={{
                                                    padding: '16px',
                                                    background: 'var(--bg-card)',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: '12px',
                                                    cursor: 'pointer',
                                                    textAlign: 'left',
                                                    transition: 'all 0.2s ease',
                                                }}
                                                onMouseOver={e => {
                                                    e.currentTarget.style.borderColor = 'var(--accent-blue)';
                                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                                }}
                                                onMouseOut={e => {
                                                    e.currentTarget.style.borderColor = 'var(--border-color)';
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                }}
                                            >
                                                <div style={{
                                                    fontSize: '1.5rem',
                                                    marginBottom: '8px',
                                                }}>
                                                    {rt.icon}
                                                </div>
                                                <div style={{
                                                    fontWeight: 600,
                                                    fontSize: '0.9rem',
                                                    color: 'var(--text-primary)',
                                                    marginBottom: '4px',
                                                }}>
                                                    {rt.label}
                                                </div>
                                                <div style={{
                                                    fontSize: '0.75rem',
                                                    color: 'var(--text-muted)',
                                                }}>
                                                    {rt.description}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <button
                                        onClick={() => setSelectedType(null)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '8px 12px',
                                            background: 'var(--bg-card)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '6px',
                                            color: 'var(--text-secondary)',
                                            fontSize: '0.8rem',
                                            cursor: 'pointer',
                                            marginBottom: '20px',
                                        }}
                                    >
                                        ← Back to request types
                                    </button>

                                    <div style={{
                                        padding: '12px',
                                        background: 'var(--bg-secondary)',
                                        borderRadius: '8px',
                                        marginBottom: '20px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                    }}>
                                        <span style={{ fontSize: '1.5rem' }}>
                                            {REQUEST_TYPES.find(t => t.type === selectedType)?.icon}
                                        </span>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                                {REQUEST_TYPES.find(t => t.type === selectedType)?.label}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                {REQUEST_TYPES.find(t => t.type === selectedType)?.description}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Form Fields */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
                                                Request Title *
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.title}
                                                onChange={e => setFormData(f => ({ ...f, title: e.target.value }))}
                                                placeholder="Brief summary of your request..."
                                                style={{
                                                    width: '100%',
                                                    padding: '10px',
                                                    background: 'var(--bg-card)',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: '6px',
                                                    color: 'var(--text-primary)',
                                                    fontSize: '0.9rem',
                                                }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
                                                Description
                                            </label>
                                            <textarea
                                                value={formData.description}
                                                onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                                                placeholder="Detailed description of what you need..."
                                                rows={3}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px',
                                                    background: 'var(--bg-card)',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: '6px',
                                                    color: 'var(--text-primary)',
                                                    fontSize: '0.9rem',
                                                    resize: 'none',
                                                }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
                                                Urgency
                                            </label>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                {(['low', 'medium', 'high', 'critical'] as const).map(u => (
                                                    <button
                                                        key={u}
                                                        onClick={() => setFormData(f => ({ ...f, urgency: u }))}
                                                        style={{
                                                            padding: '8px 16px',
                                                            background: formData.urgency === u
                                                                ? URGENCY_COLORS[u].bg
                                                                : 'var(--bg-card)',
                                                            border: formData.urgency === u
                                                                ? `2px solid ${URGENCY_COLORS[u].text}`
                                                                : '2px solid var(--border-color)',
                                                            borderRadius: '6px',
                                                            color: formData.urgency === u
                                                                ? URGENCY_COLORS[u].text
                                                                : 'var(--text-muted)',
                                                            fontSize: '0.8rem',
                                                            fontWeight: 600,
                                                            cursor: 'pointer',
                                                            textTransform: 'capitalize',
                                                        }}
                                                    >
                                                        {u}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {selectedType === 'CAPABILITY_GRANT' && (
                                            <div>
                                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
                                                    Requested Capabilities
                                                </label>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                    {requestableCapabilities.map(cap => (
                                                        <button
                                                            key={cap}
                                                            onClick={() => {
                                                                setFormData(f => ({
                                                                    ...f,
                                                                    capabilities: f.capabilities.includes(cap)
                                                                        ? f.capabilities.filter(c => c !== cap)
                                                                        : [...f.capabilities, cap],
                                                                }));
                                                            }}
                                                            style={{
                                                                padding: '6px 12px',
                                                                background: formData.capabilities.includes(cap)
                                                                    ? 'var(--accent-blue)'
                                                                    : 'var(--bg-card)',
                                                                border: '1px solid var(--border-color)',
                                                                borderRadius: '16px',
                                                                color: formData.capabilities.includes(cap)
                                                                    ? 'white'
                                                                    : 'var(--text-secondary)',
                                                                fontSize: '0.75rem',
                                                                cursor: 'pointer',
                                                            }}
                                                        >
                                                            {cap}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
                                                Justification *
                                            </label>
                                            <textarea
                                                value={formData.justification}
                                                onChange={e => setFormData(f => ({ ...f, justification: e.target.value }))}
                                                placeholder="Why do you need this? How will it help achieve your goal?"
                                                rows={2}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px',
                                                    background: 'var(--bg-card)',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: '6px',
                                                    color: 'var(--text-primary)',
                                                    fontSize: '0.9rem',
                                                    resize: 'none',
                                                }}
                                            />
                                        </div>

                                        <button
                                            onClick={handleSubmit}
                                            disabled={!formData.title || !formData.justification}
                                            style={{
                                                padding: '12px 20px',
                                                background: formData.title && formData.justification
                                                    ? 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))'
                                                    : 'var(--bg-lighter)',
                                                border: 'none',
                                                borderRadius: '8px',
                                                color: 'white',
                                                fontSize: '0.9rem',
                                                fontWeight: 600,
                                                cursor: formData.title && formData.justification ? 'pointer' : 'not-allowed',
                                            }}
                                        >
                                            📤 Submit Request
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Pending Requests Tab */}
                    {activeTab === 'pending' && (
                        <div style={{ display: 'flex', gap: '16px' }}>
                            {/* Request List */}
                            <div style={{ flex: 1 }}>
                                {pendingRequests.length === 0 ? (
                                    <div style={{
                                        textAlign: 'center',
                                        padding: '40px',
                                        color: 'var(--text-muted)',
                                    }}>
                                        <span style={{ fontSize: '2rem' }}>✨</span>
                                        <p>No pending requests</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {pendingRequests.map(req => {
                                            const typeInfo = REQUEST_TYPES.find(t => t.type === req.requestType);
                                            return (
                                                <div
                                                    key={req.id}
                                                    onClick={() => setSelectedRequest(req)}
                                                    style={{
                                                        padding: '14px',
                                                        background: selectedRequest?.id === req.id
                                                            ? 'var(--bg-card-hover)'
                                                            : 'var(--bg-card)',
                                                        border: selectedRequest?.id === req.id
                                                            ? '2px solid var(--accent-blue)'
                                                            : '1px solid var(--border-color)',
                                                        borderRadius: '10px',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease',
                                                    }}
                                                >
                                                    <div style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '10px',
                                                        marginBottom: '8px',
                                                    }}>
                                                        <span style={{ fontSize: '1.25rem' }}>{typeInfo?.icon}</span>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{
                                                                fontWeight: 600,
                                                                fontSize: '0.9rem',
                                                                marginBottom: '2px',
                                                            }}>
                                                                {req.title}
                                                            </div>
                                                            <div style={{
                                                                fontSize: '0.7rem',
                                                                color: 'var(--text-muted)',
                                                            }}>
                                                                From {req.requesterName} (T{req.requesterTier})
                                                            </div>
                                                        </div>
                                                        <span style={{
                                                            padding: '4px 8px',
                                                            background: URGENCY_COLORS[req.urgency].bg,
                                                            color: URGENCY_COLORS[req.urgency].text,
                                                            borderRadius: '6px',
                                                            fontSize: '0.65rem',
                                                            fontWeight: 600,
                                                            textTransform: 'uppercase',
                                                        }}>
                                                            {req.urgency}
                                                        </span>
                                                    </div>
                                                    <p style={{
                                                        margin: 0,
                                                        fontSize: '0.8rem',
                                                        color: 'var(--text-secondary)',
                                                        display: '-webkit-box',
                                                        WebkitLineClamp: 2,
                                                        WebkitBoxOrient: 'vertical',
                                                        overflow: 'hidden',
                                                    }}>
                                                        {req.description}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Request Detail */}
                            {selectedRequest && (
                                <div style={{
                                    width: '320px',
                                    padding: '16px',
                                    background: 'var(--bg-secondary)',
                                    borderRadius: '12px',
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        marginBottom: '16px',
                                    }}>
                                        <span style={{ fontSize: '1.5rem' }}>
                                            {REQUEST_TYPES.find(t => t.type === selectedRequest.requestType)?.icon}
                                        </span>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                                                {selectedRequest.title}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                {REQUEST_TYPES.find(t => t.type === selectedRequest.requestType)?.label}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: '12px' }}>
                                        <div style={{
                                            fontSize: '0.7rem',
                                            color: 'var(--text-muted)',
                                            marginBottom: '4px',
                                            textTransform: 'uppercase',
                                        }}>
                                            Requester
                                        </div>
                                        <div style={{
                                            padding: '8px',
                                            background: 'var(--bg-card)',
                                            borderRadius: '6px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                        }}>
                                            <div style={{
                                                width: '32px',
                                                height: '32px',
                                                borderRadius: '50%',
                                                background: 'var(--accent-blue)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'white',
                                                fontWeight: 700,
                                                fontSize: '0.8rem',
                                            }}>
                                                T{selectedRequest.requesterTier}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                                                    {selectedRequest.requesterName}
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                    Requesting T{selectedRequest.targetTier} access
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: '12px' }}>
                                        <div style={{
                                            fontSize: '0.7rem',
                                            color: 'var(--text-muted)',
                                            marginBottom: '4px',
                                            textTransform: 'uppercase',
                                        }}>
                                            Description
                                        </div>
                                        <p style={{
                                            margin: 0,
                                            fontSize: '0.8rem',
                                            color: 'var(--text-secondary)',
                                            lineHeight: 1.5,
                                        }}>
                                            {selectedRequest.description}
                                        </p>
                                    </div>

                                    <div style={{ marginBottom: '12px' }}>
                                        <div style={{
                                            fontSize: '0.7rem',
                                            color: 'var(--text-muted)',
                                            marginBottom: '4px',
                                            textTransform: 'uppercase',
                                        }}>
                                            Justification
                                        </div>
                                        <p style={{
                                            margin: 0,
                                            fontSize: '0.8rem',
                                            color: 'var(--text-primary)',
                                            fontStyle: 'italic',
                                            lineHeight: 1.5,
                                        }}>
                                            "{selectedRequest.justification}"
                                        </p>
                                    </div>

                                    {selectedRequest.requestedCapabilities.length > 0 && (
                                        <div style={{ marginBottom: '16px' }}>
                                            <div style={{
                                                fontSize: '0.7rem',
                                                color: 'var(--text-muted)',
                                                marginBottom: '6px',
                                                textTransform: 'uppercase',
                                            }}>
                                                Requested Capabilities
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                {selectedRequest.requestedCapabilities.map(cap => (
                                                    <span
                                                        key={cap}
                                                        style={{
                                                            padding: '4px 8px',
                                                            background: 'var(--accent-purple)',
                                                            color: 'white',
                                                            borderRadius: '4px',
                                                            fontSize: '0.7rem',
                                                            fontWeight: 500,
                                                        }}
                                                    >
                                                        {cap}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
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
                                            ✕ Deny
                                        </button>
                                        <button
                                            onClick={() => {
                                                onGrantRequest?.(selectedRequest.id, selectedRequest.requestedCapabilities);
                                                setSelectedRequest(null);
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
                                            ✓ Grant
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
                            <p>Request history will appear here</p>
                            <p style={{ fontSize: '0.8rem' }}>Past granted and denied requests</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default RequestGrantPanel;
