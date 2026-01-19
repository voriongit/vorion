import React, { useState, useEffect } from 'react';
import { TrustTierBadge } from './TrustTierBadge';
import type { Agent, AgentType } from '../types';

/**
 * SpawnWizard - Aria's Step-by-Step Agent Creation Flow
 *
 * Guides users through creating a new agent with full transparency
 * about capabilities, trust levels, and delegation chains.
 */

interface SpawnWizardProps {
    onClose: () => void;
    onSpawn: (config: SpawnConfig) => Promise<void>;
    allAgents: Agent[];
    parentAgent?: Agent;
    ariaInsight?: string;
}

export interface SpawnConfig {
    name: string;
    type: AgentType;
    tier: number;
    parentId: string | null;
    sitterId: string | null;
    capabilities: string[];
    purpose: string;
    guardrails: {
        maxTokensPerDay: number;
        requireApprovalFor: string[];
        auditLevel: 'MINIMAL' | 'STANDARD' | 'FULL';
    };
}

interface WizardStep {
    id: string;
    title: string;
    icon: string;
}

const WIZARD_STEPS: WizardStep[] = [
    { id: 'purpose', title: 'Purpose', icon: '🎯' },
    { id: 'trust', title: 'Trust Level', icon: '🛡️' },
    { id: 'delegation', title: 'Delegation', icon: '🏛️' },
    { id: 'permissions', title: 'Permissions', icon: '🔐' },
    { id: 'confirm', title: 'Confirm', icon: '✅' },
];

const AGENT_TYPE_INFO: Record<string, { icon: string; description: string; suggestedTier: number; capabilities: string[] }> = {
    WORKER: {
        icon: '🤖',
        description: 'General purpose agent for basic tasks',
        suggestedTier: 1,
        capabilities: ['execute_tasks', 'report_status'],
    },
    SPECIALIST: {
        icon: '🔬',
        description: 'Domain expert for focused work',
        suggestedTier: 2,
        capabilities: ['execute_tasks', 'research', 'analyze'],
    },
    PLANNER: {
        icon: '🧠',
        description: 'Strategic planning and task decomposition',
        suggestedTier: 3,
        capabilities: ['plan', 'decompose', 'prioritize'],
    },
    VALIDATOR: {
        icon: '🛡️',
        description: 'Quality assurance and verification',
        suggestedTier: 3,
        capabilities: ['validate', 'review', 'audit'],
    },
    EXECUTOR: {
        icon: '🎖️',
        description: 'High-trust execution of critical tasks',
        suggestedTier: 4,
        capabilities: ['execute_critical', 'override', 'escalate'],
    },
    SITTER: {
        icon: '👔',
        description: 'Deputy that handles routine approvals for HITL',
        suggestedTier: 4,
        capabilities: ['triage', 'approve_routine', 'escalate', 'delegate'],
    },
    SPAWNER: {
        icon: '🏭',
        description: 'Can create and manage child agents',
        suggestedTier: 4,
        capabilities: ['spawn', 'terminate', 'monitor_children'],
    },
    ORCHESTRATOR: {
        icon: '🎯',
        description: 'Coordinates multiple agents on complex tasks',
        suggestedTier: 4,
        capabilities: ['orchestrate', 'delegate', 'coordinate', 'synthesize'],
    },
};

const TIER_INFO = [
    { tier: 0, name: 'Untrusted', color: '#6b7280', description: 'New agent, maximum oversight required' },
    { tier: 1, name: 'Probationary', color: '#f59e0b', description: 'Basic trust, still learning' },
    { tier: 2, name: 'Trusted', color: '#3b82f6', description: 'Reliable for standard tasks' },
    { tier: 3, name: 'Verified', color: '#8b5cf6', description: 'Can delegate to lower tiers' },
    { tier: 4, name: 'Certified', color: '#10b981', description: 'Can spawn new agents' },
    { tier: 5, name: 'Elite', color: '#f43f5e', description: 'Maximum autonomy' },
];

export const SpawnWizard: React.FC<SpawnWizardProps> = ({
    onClose,
    onSpawn,
    allAgents,
    parentAgent,
    ariaInsight,
}) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [isSpawning, setIsSpawning] = useState(false);

    // Form state
    const [purpose, setPurpose] = useState('');
    const [selectedType, setSelectedType] = useState<AgentType>('WORKER');
    const [selectedTier, setSelectedTier] = useState(1);
    const [agentName, setAgentName] = useState('');
    const [selectedParent, setSelectedParent] = useState<string | null>(parentAgent?.id || null);
    const [selectedSitter, setSelectedSitter] = useState<string | null>(null);
    const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);
    const [maxTokens, setMaxTokens] = useState(50000);
    const [auditLevel, setAuditLevel] = useState<'MINIMAL' | 'STANDARD' | 'FULL'>('STANDARD');
    const [requireApprovalFor, setRequireApprovalFor] = useState<string[]>(['external_api', 'spawn']);

    // Aria's analysis
    const [ariaAnalysis, setAriaAnalysis] = useState<string>('');

    // Get potential parent agents (T4+)
    const potentialParents = allAgents.filter(a => a.tier >= 4 && a.type !== 'SITTER');

    // Get sitter agents
    const sitterAgents = allAgents.filter(a => a.type === 'SITTER');

    // Analyze purpose and suggest type
    useEffect(() => {
        if (purpose.length > 10) {
            const lowerPurpose = purpose.toLowerCase();
            let suggestion = 'WORKER';
            let analysis = '';

            if (lowerPurpose.includes('research') || lowerPurpose.includes('analyze') || lowerPurpose.includes('investigate')) {
                suggestion = 'SPECIALIST';
                analysis = 'Task requires focused domain expertise. Recommending SPECIALIST agent.';
            } else if (lowerPurpose.includes('plan') || lowerPurpose.includes('strategy') || lowerPurpose.includes('design')) {
                suggestion = 'PLANNER';
                analysis = 'Task involves strategic planning. Recommending PLANNER agent.';
            } else if (lowerPurpose.includes('validate') || lowerPurpose.includes('review') || lowerPurpose.includes('audit')) {
                suggestion = 'VALIDATOR';
                analysis = 'Task requires quality verification. Recommending VALIDATOR agent.';
            } else if (lowerPurpose.includes('coordinate') || lowerPurpose.includes('manage') || lowerPurpose.includes('orchestrate')) {
                suggestion = 'ORCHESTRATOR';
                analysis = 'Task requires multi-agent coordination. Recommending ORCHESTRATOR agent.';
            } else if (lowerPurpose.includes('approve') || lowerPurpose.includes('triage') || lowerPurpose.includes('deputy')) {
                suggestion = 'SITTER';
                analysis = 'Task involves delegation buffering. Recommending SITTER agent.';
            } else {
                analysis = 'General purpose task. WORKER agent is suitable.';
            }

            setSelectedType(suggestion as AgentType);
            setAriaAnalysis(analysis);

            // Update suggested tier based on type
            const typeInfo = AGENT_TYPE_INFO[suggestion];
            if (typeInfo) {
                setSelectedTier(typeInfo.suggestedTier);
                setSelectedCapabilities(typeInfo.capabilities);
            }

            // Generate name suggestion
            if (!agentName) {
                const words = purpose.split(' ').filter(w => w.length > 3).slice(0, 2);
                const nameSuggestion = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
                setAgentName(nameSuggestion || 'NewAgent');
            }
        }
    }, [purpose]);

    const handleSpawn = async () => {
        setIsSpawning(true);
        try {
            await onSpawn({
                name: agentName,
                type: selectedType,
                tier: selectedTier,
                parentId: selectedParent,
                sitterId: selectedSitter,
                capabilities: selectedCapabilities,
                purpose,
                guardrails: {
                    maxTokensPerDay: maxTokens,
                    requireApprovalFor,
                    auditLevel,
                },
            });
            onClose();
        } catch (e) {
            console.error('Failed to spawn agent:', e);
        } finally {
            setIsSpawning(false);
        }
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 0: // Purpose
                return (
                    <div>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>
                            What should this agent do?
                        </h3>
                        <textarea
                            value={purpose}
                            onChange={e => setPurpose(e.target.value)}
                            placeholder="Describe the agent's purpose... (e.g., 'Research competitor pricing strategies and summarize findings')"
                            style={{
                                width: '100%',
                                minHeight: '100px',
                                padding: '12px',
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--text-primary)',
                                fontSize: '0.9rem',
                                resize: 'vertical',
                            }}
                        />

                        {ariaAnalysis && (
                            <div style={{
                                marginTop: '16px',
                                padding: '16px',
                                background: 'rgba(139, 92, 246, 0.1)',
                                borderRadius: 'var(--radius-md)',
                                borderLeft: '3px solid var(--accent-purple)',
                            }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '8px', color: 'var(--accent-purple)' }}>
                                    🤖 Aria's Analysis:
                                </div>
                                <div style={{ fontSize: '0.85rem' }}>{ariaAnalysis}</div>
                                <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '1.5rem' }}>{AGENT_TYPE_INFO[selectedType]?.icon}</span>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>Suggested: {selectedType}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {AGENT_TYPE_INFO[selectedType]?.description}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div style={{ marginTop: '16px' }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Agent Name:</label>
                            <input
                                type="text"
                                value={agentName}
                                onChange={e => setAgentName(e.target.value)}
                                placeholder="Enter agent name..."
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    marginTop: '4px',
                                    background: 'var(--bg-tertiary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-md)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.9rem',
                                }}
                            />
                        </div>
                    </div>
                );

            case 1: // Trust Level
                return (
                    <div>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>
                            Select Trust Level
                        </h3>

                        <div style={{
                            padding: '12px',
                            background: 'rgba(245, 158, 11, 0.1)',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: '16px',
                            fontSize: '0.85rem',
                        }}>
                            <strong>Recommended: T{AGENT_TYPE_INFO[selectedType]?.suggestedTier}</strong>
                            <br />
                            <span style={{ color: 'var(--text-muted)' }}>
                                Based on agent type and typical use case.
                            </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {TIER_INFO.map(tier => (
                                <div
                                    key={tier.tier}
                                    onClick={() => setSelectedTier(tier.tier)}
                                    style={{
                                        padding: '12px 16px',
                                        background: selectedTier === tier.tier
                                            ? `${tier.color}20`
                                            : 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-md)',
                                        border: selectedTier === tier.tier
                                            ? `2px solid ${tier.color}`
                                            : '2px solid transparent',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                    }}
                                >
                                    <TrustTierBadge tier={tier.tier} size="medium" />
                                    <div>
                                        <div style={{ fontWeight: 500 }}>{tier.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {tier.description}
                                        </div>
                                    </div>
                                    {tier.tier >= 3 && (
                                        <span style={{
                                            marginLeft: 'auto',
                                            fontSize: '0.7rem',
                                            padding: '2px 6px',
                                            background: 'rgba(16, 185, 129, 0.2)',
                                            borderRadius: 'var(--radius-sm)',
                                            color: 'var(--accent-green)',
                                        }}>
                                            {tier.tier >= 4 ? 'Can Spawn' : 'Can Delegate'}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div style={{
                            marginTop: '16px',
                            padding: '12px',
                            background: 'var(--bg-tertiary)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.8rem',
                        }}>
                            <strong>Starting Capabilities at T{selectedTier}:</strong>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                                {selectedCapabilities.map(cap => (
                                    <span key={cap} style={{
                                        padding: '2px 8px',
                                        background: 'rgba(59, 130, 246, 0.2)',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: '0.7rem',
                                    }}>
                                        {cap}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                );

            case 2: // Delegation
                return (
                    <div>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>
                            Delegation & Hierarchy
                        </h3>

                        {/* Parent Selection */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>
                                Parent Agent (supervises this agent):
                            </label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div
                                    onClick={() => setSelectedParent(null)}
                                    style={{
                                        padding: '10px 14px',
                                        background: selectedParent === null ? 'rgba(139, 92, 246, 0.2)' : 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-md)',
                                        border: selectedParent === null ? '2px solid var(--accent-purple)' : '2px solid transparent',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                    }}
                                >
                                    <span>👤</span>
                                    <span>HITL (Direct human oversight)</span>
                                </div>
                                {potentialParents.map(agent => (
                                    <div
                                        key={agent.id}
                                        onClick={() => setSelectedParent(agent.id)}
                                        style={{
                                            padding: '10px 14px',
                                            background: selectedParent === agent.id ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-tertiary)',
                                            borderRadius: 'var(--radius-md)',
                                            border: selectedParent === agent.id ? '2px solid var(--accent-blue)' : '2px solid transparent',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                        }}
                                    >
                                        <span>{AGENT_TYPE_INFO[agent.type]?.icon || '🤖'}</span>
                                        <span>{agent.name}</span>
                                        <TrustTierBadge tier={agent.tier} size="small" />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Sitter Selection */}
                        <div>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>
                                Sitter Agent (handles routine check-ins):
                            </label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div
                                    onClick={() => setSelectedSitter(null)}
                                    style={{
                                        padding: '10px 14px',
                                        background: selectedSitter === null ? 'rgba(107, 114, 128, 0.2)' : 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-md)',
                                        border: selectedSitter === null ? '2px solid var(--text-muted)' : '2px solid transparent',
                                        cursor: 'pointer',
                                    }}
                                >
                                    No Sitter (all approvals go to parent/HITL)
                                </div>
                                {sitterAgents.map(agent => (
                                    <div
                                        key={agent.id}
                                        onClick={() => setSelectedSitter(agent.id)}
                                        style={{
                                            padding: '10px 14px',
                                            background: selectedSitter === agent.id ? 'rgba(245, 158, 11, 0.2)' : 'var(--bg-tertiary)',
                                            borderRadius: 'var(--radius-md)',
                                            border: selectedSitter === agent.id ? '2px solid var(--accent-yellow)' : '2px solid transparent',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                        }}
                                    >
                                        <span>👔</span>
                                        <span>{agent.name}</span>
                                        <TrustTierBadge tier={agent.tier} size="small" />
                                    </div>
                                ))}
                                {sitterAgents.length === 0 && (
                                    <div style={{
                                        padding: '12px',
                                        background: 'rgba(245, 158, 11, 0.1)',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: '0.8rem',
                                    }}>
                                        No Sitter agents available. Consider creating one to reduce HITL bottleneck.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Delegation Chain Preview */}
                        <div style={{
                            marginTop: '20px',
                            padding: '12px',
                            background: 'var(--bg-tertiary)',
                            borderRadius: 'var(--radius-md)',
                        }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                Delegation Chain Preview:
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span style={{ padding: '4px 8px', background: 'rgba(139, 92, 246, 0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem' }}>
                                    👤 HITL
                                </span>
                                {selectedSitter && (
                                    <>
                                        <span>→</span>
                                        <span style={{ padding: '4px 8px', background: 'rgba(245, 158, 11, 0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem' }}>
                                            👔 Sitter
                                        </span>
                                    </>
                                )}
                                {selectedParent && (
                                    <>
                                        <span>→</span>
                                        <span style={{ padding: '4px 8px', background: 'rgba(59, 130, 246, 0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem' }}>
                                            {AGENT_TYPE_INFO[potentialParents.find(p => p.id === selectedParent)?.type || 'WORKER']?.icon} Parent
                                        </span>
                                    </>
                                )}
                                <span>→</span>
                                <span style={{ padding: '4px 8px', background: 'rgba(16, 185, 129, 0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 600 }}>
                                    {AGENT_TYPE_INFO[selectedType]?.icon} {agentName || 'New Agent'}
                                </span>
                            </div>
                        </div>
                    </div>
                );

            case 3: // Permissions
                return (
                    <div>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>
                            Permissions & Guardrails
                        </h3>

                        {/* Token Limit */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                Max Tokens Per Day:
                            </label>
                            <input
                                type="range"
                                min="10000"
                                max="500000"
                                step="10000"
                                value={maxTokens}
                                onChange={e => setMaxTokens(parseInt(e.target.value))}
                                style={{ width: '100%', marginTop: '8px' }}
                            />
                            <div style={{ textAlign: 'center', fontSize: '0.85rem', fontWeight: 600 }}>
                                {maxTokens.toLocaleString()} tokens
                            </div>
                        </div>

                        {/* Audit Level */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>
                                Audit Level:
                            </label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {(['MINIMAL', 'STANDARD', 'FULL'] as const).map(level => (
                                    <button
                                        key={level}
                                        onClick={() => setAuditLevel(level)}
                                        style={{
                                            flex: 1,
                                            padding: '10px',
                                            background: auditLevel === level ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
                                            border: 'none',
                                            borderRadius: 'var(--radius-md)',
                                            color: 'var(--text-primary)',
                                            cursor: 'pointer',
                                            fontSize: '0.8rem',
                                        }}
                                    >
                                        {level}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Require Approval For */}
                        <div>
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>
                                Require Approval For:
                            </label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {['external_api', 'spawn', 'delete', 'trust_change', 'code_execution', 'file_write'].map(action => (
                                    <label
                                        key={action}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '6px 10px',
                                            background: requireApprovalFor.includes(action) ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-tertiary)',
                                            borderRadius: 'var(--radius-sm)',
                                            cursor: 'pointer',
                                            fontSize: '0.75rem',
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={requireApprovalFor.includes(action)}
                                            onChange={e => {
                                                if (e.target.checked) {
                                                    setRequireApprovalFor([...requireApprovalFor, action]);
                                                } else {
                                                    setRequireApprovalFor(requireApprovalFor.filter(a => a !== action));
                                                }
                                            }}
                                        />
                                        {action.replace('_', ' ')}
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Capabilities Summary */}
                        <div style={{
                            marginTop: '20px',
                            padding: '12px',
                            background: 'var(--bg-tertiary)',
                            borderRadius: 'var(--radius-md)',
                        }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                This agent will be able to:
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {selectedCapabilities.map(cap => (
                                    <span key={cap} style={{
                                        padding: '4px 8px',
                                        background: 'rgba(16, 185, 129, 0.2)',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: '0.7rem',
                                        color: 'var(--accent-green)',
                                    }}>
                                        ✓ {cap}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                );

            case 4: // Confirm
                return (
                    <div>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>
                            Confirm Agent Creation
                        </h3>

                        <div style={{
                            background: 'var(--bg-tertiary)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '20px',
                        }}>
                            {/* Agent Summary */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                                <div style={{
                                    width: '60px',
                                    height: '60px',
                                    borderRadius: '50%',
                                    background: 'var(--bg-secondary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '2rem',
                                }}>
                                    {AGENT_TYPE_INFO[selectedType]?.icon}
                                </div>
                                <div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{agentName}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>{selectedType}</span>
                                        <TrustTierBadge tier={selectedTier} size="medium" />
                                    </div>
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.8rem' }}>
                                <div>
                                    <div style={{ color: 'var(--text-muted)' }}>Purpose:</div>
                                    <div>{purpose}</div>
                                </div>
                                <div>
                                    <div style={{ color: 'var(--text-muted)' }}>Parent:</div>
                                    <div>{selectedParent ? potentialParents.find(p => p.id === selectedParent)?.name : 'HITL (Direct)'}</div>
                                </div>
                                <div>
                                    <div style={{ color: 'var(--text-muted)' }}>Sitter:</div>
                                    <div>{selectedSitter ? sitterAgents.find(s => s.id === selectedSitter)?.name : 'None'}</div>
                                </div>
                                <div>
                                    <div style={{ color: 'var(--text-muted)' }}>Token Limit:</div>
                                    <div>{maxTokens.toLocaleString()}/day</div>
                                </div>
                                <div>
                                    <div style={{ color: 'var(--text-muted)' }}>Audit Level:</div>
                                    <div>{auditLevel}</div>
                                </div>
                            </div>

                            {/* Aria's Final Note */}
                            {ariaInsight && (
                                <div style={{
                                    marginTop: '16px',
                                    padding: '12px',
                                    background: 'rgba(139, 92, 246, 0.1)',
                                    borderRadius: 'var(--radius-md)',
                                    borderLeft: '3px solid var(--accent-purple)',
                                    fontSize: '0.8rem',
                                }}>
                                    <strong>🤖 Aria:</strong> {ariaInsight}
                                </div>
                            )}
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '600px', maxHeight: '85vh' }}
            >
                {/* Header */}
                <div className="modal-header">
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🤖 Aria: Agent Creation Wizard
                    </h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                {/* Progress Steps */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '16px 24px',
                    background: 'var(--bg-secondary)',
                    borderBottom: '1px solid var(--border-color)',
                }}>
                    {WIZARD_STEPS.map((step, idx) => (
                        <div
                            key={step.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                opacity: idx <= currentStep ? 1 : 0.4,
                                cursor: idx < currentStep ? 'pointer' : 'default',
                            }}
                            onClick={() => idx < currentStep && setCurrentStep(idx)}
                        >
                            <div style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                background: idx === currentStep
                                    ? 'var(--accent-purple)'
                                    : idx < currentStep
                                        ? 'var(--accent-green)'
                                        : 'var(--bg-tertiary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.8rem',
                            }}>
                                {idx < currentStep ? '✓' : step.icon}
                            </div>
                            <span style={{ fontSize: '0.75rem', display: 'none' }}>
                                {step.title}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Content */}
                <div className="modal-content" style={{ padding: '24px', overflowY: 'auto', maxHeight: '50vh' }}>
                    {renderStepContent()}
                </div>

                {/* Footer */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '16px 24px',
                    borderTop: '1px solid var(--border-color)',
                }}>
                    <button
                        className="btn"
                        onClick={() => currentStep > 0 ? setCurrentStep(currentStep - 1) : onClose()}
                    >
                        {currentStep === 0 ? 'Cancel' : '← Back'}
                    </button>

                    {currentStep < WIZARD_STEPS.length - 1 ? (
                        <button
                            className="btn btn-primary"
                            onClick={() => setCurrentStep(currentStep + 1)}
                            disabled={currentStep === 0 && (!purpose || !agentName)}
                        >
                            Next →
                        </button>
                    ) : (
                        <button
                            className="btn btn-primary"
                            onClick={handleSpawn}
                            disabled={isSpawning}
                        >
                            {isSpawning ? '⏳ Creating...' : '✅ Create Agent'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SpawnWizard;
