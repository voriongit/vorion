import { useState } from 'react';
import { api } from '../api';
import { FormField, SelectField, useToast } from './ui';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { Tooltip, InfoTooltip } from './Tooltip';

interface ControlPanelProps {
    hitlLevel: number;
    onSetHITL: (level: number) => void;
    onSpawn: (name: string, type: string, tier: number) => void;
    onClose: () => void;
    onOpenSpawnWizard?: () => void;
    onOpenInsights?: () => void;
}

export function ControlPanel({ hitlLevel, onSetHITL, onSpawn, onClose, onOpenSpawnWizard, onOpenInsights }: ControlPanelProps) {
    const toast = useToast();
    const { containerRef } = useFocusTrap({ enabled: true, onEscape: onClose });

    const [spawnName, setSpawnName] = useState('');
    const [spawnType, setSpawnType] = useState('WORKER');
    const [spawnTier, setSpawnTier] = useState(1);
    const [localHITL, setLocalHITL] = useState(hitlLevel);

    // Tick system state
    const [tickLoading, setTickLoading] = useState(false);
    const [tickResult, setTickResult] = useState<{
        processed: number;
        assigned: number;
        completed: number;
        events: string[];
    } | null>(null);

    // Task creation state
    const [taskDescription, setTaskDescription] = useState('');
    const [taskLoading, setTaskLoading] = useState(false);

    const handleSpawn = () => {
        if (spawnName.trim()) {
            onSpawn(spawnName, spawnType, spawnTier);
            toast.success(`Agent "${spawnName}" spawned as ${spawnType}`, { title: 'Agent Created' });
            setSpawnName('');
        }
    };

    const handleTick = async () => {
        setTickLoading(true);
        setTickResult(null);
        try {
            const result = await api.tick();
            setTickResult({
                processed: result.processed,
                assigned: result.assigned,
                completed: result.completed,
                events: result.events || [],
            });
            toast.success(`Processed ${result.processed} tasks, ${result.completed} completed`, { title: 'Tick Complete' });
        } catch (e) {
            console.error('Tick failed:', e);
            toast.error('Failed to run agent tick', { title: 'Tick Error' });
        }
        setTickLoading(false);
    };

    const handleCreateTask = async () => {
        if (!taskDescription.trim()) return;
        setTaskLoading(true);
        try {
            const result = await api.createTask(taskDescription, 'Founder', 'NORMAL');
            toast.success(result.message || 'Task created and queued for processing', { title: 'Task Created' });
            setTaskDescription('');
        } catch (e) {
            toast.error('Failed to create task', { title: 'Task Error' });
        }
        setTaskLoading(false);
    };

    return (
        <div className="modal-overlay" onClick={onClose} role="presentation">
            <div
                ref={containerRef}
                className="modal control-panel"
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="control-panel-title"
                tabIndex={-1}
            >
                <div className="modal-header">
                    <h2 id="control-panel-title">🎛️ Control Panel</h2>
                    <button className="close-btn" onClick={onClose} aria-label="Close control panel">✕</button>
                </div>

                <div className="modal-content">
                    {/* Quick Actions - Insights & Wizard */}
                    <div className="control-section" style={{
                        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(59, 130, 246, 0.15))',
                        border: '1px solid var(--accent-purple)',
                        borderRadius: '8px',
                        padding: '16px',
                        marginBottom: '20px'
                    }}>
                        <h3 style={{ color: 'var(--accent-purple)', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            ✨ Intelligence & Tools
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            {onOpenInsights && (
                                <button
                                    className="btn"
                                    onClick={() => {
                                        onClose();
                                        onOpenInsights();
                                    }}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '16px',
                                        background: 'rgba(139, 92, 246, 0.2)',
                                        border: '1px solid var(--accent-purple)',
                                    }}
                                >
                                    <span style={{ fontSize: '1.5rem' }}>💡</span>
                                    <span style={{ fontWeight: 600 }}>Insights</span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                        Patterns & Suggestions
                                    </span>
                                </button>
                            )}
                            {onOpenSpawnWizard && (
                                <button
                                    className="btn"
                                    onClick={() => {
                                        onClose();
                                        onOpenSpawnWizard();
                                    }}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '16px',
                                        background: 'rgba(16, 185, 129, 0.2)',
                                        border: '1px solid var(--accent-green)',
                                    }}
                                >
                                    <span style={{ fontSize: '1.5rem' }}>🤖</span>
                                    <span style={{ fontWeight: 600 }}>Spawn Wizard</span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                        Aria-guided creation
                                    </span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Agent Tick System */}
                    <div className="control-section" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--accent-green)', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
                        <h3 style={{ color: 'var(--accent-green)', marginTop: 0 }}>⚡ Agent Work Loop</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                            Trigger agents to process tasks, make progress, and complete work.
                        </p>
                        <button
                            className="btn btn-primary"
                            onClick={handleTick}
                            disabled={tickLoading}
                            style={{ width: '100%', marginBottom: '12px' }}
                        >
                            {tickLoading ? '⏳ Processing...' : '▶️ Run Agent Tick'}
                        </button>

                        {tickResult && (
                            <div style={{ fontSize: '0.85rem', background: 'var(--bg-card)', padding: '12px', borderRadius: '6px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '8px' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--accent-blue)' }}>{tickResult.processed}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Processed</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--accent-gold)' }}>{tickResult.assigned}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Assigned</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--accent-green)' }}>{tickResult.completed}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Completed</div>
                                    </div>
                                </div>
                                {tickResult.events.length > 0 && (
                                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px', marginTop: '8px' }}>
                                        {tickResult.events.map((e, i) => (
                                            <div key={i} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{e}</div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Create Task */}
                    <div className="control-section" style={{ marginBottom: '20px' }}>
                        <h3>📝 Create Task for Agents</h3>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="text"
                                placeholder="Research market trends, Analyze user data..."
                                value={taskDescription}
                                onChange={e => setTaskDescription(e.target.value)}
                                className="spawn-input"
                                style={{ flex: 1 }}
                                onKeyDown={e => e.key === 'Enter' && handleCreateTask()}
                            />
                            <button
                                className="btn btn-secondary"
                                onClick={handleCreateTask}
                                disabled={taskLoading || !taskDescription.trim()}
                            >
                                {taskLoading ? '...' : 'Create'}
                            </button>
                        </div>
                    </div>

                    {/* HITL Level Control */}
                    <div className="control-section">
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            📊 Governance Level
                            <InfoTooltip
                                title="Human-in-the-Loop (HITL)"
                                content="Controls how much human oversight agents require. Higher values = more human approval needed. Lower values = more agent autonomy."
                            />
                        </h3>
                        <div className="hitl-slider-container">
                            <Tooltip
                                content={
                                    localHITL >= 80 ? 'Full human control. Every agent action requires your explicit approval before proceeding.' :
                                    localHITL >= 50 ? 'Balanced oversight. Agents handle routine work, humans review important decisions.' :
                                    localHITL >= 20 ? 'Autonomous mode. Agents work independently, escalating only critical issues.' :
                                    'Minimal oversight. Full agent autonomy - only use with highly trusted agents.'
                                }
                                title={
                                    localHITL >= 80 ? 'Full Control (80-100%)' :
                                    localHITL >= 50 ? 'Balanced (50-79%)' :
                                    localHITL >= 20 ? 'Autonomous (20-49%)' :
                                    'Minimal (0-19%)'
                                }
                                position="top"
                            >
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={localHITL}
                                    onChange={e => setLocalHITL(Number(e.target.value))}
                                    onMouseUp={() => onSetHITL(localHITL)}
                                    onTouchEnd={() => onSetHITL(localHITL)}
                                    className="hitl-slider"
                                />
                            </Tooltip>
                            <div className="hitl-value">{localHITL}%</div>
                        </div>
                        <p className="helper-text">
                            {localHITL >= 80 ? '🔒 Full oversight - all decisions require approval' :
                                localHITL >= 50 ? '🔓 Shared control - major decisions need approval' :
                                    localHITL >= 20 ? '🤖 Mostly autonomous - only critical decisions escalate' :
                                        '🚀 Full autonomy - system operates independently'}
                        </p>
                    </div>

                    {/* Spawn Agent */}
                    <div className="control-section">
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            🏭 Spawn New Agent
                            <InfoTooltip
                                title="Agent Spawning"
                                content="Create new AI agents with specific roles and trust levels. New agents start with basic capabilities and earn more autonomy through demonstrated reliability."
                            />
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <FormField
                                label="Agent Name"
                                value={spawnName}
                                onChange={setSpawnName}
                                placeholder="Enter agent name..."
                                required
                                minLength={2}
                                maxLength={30}
                                helperText="2-30 characters, unique identifier"
                                onSubmit={handleSpawn}
                            />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <SelectField
                                    label="Agent Type"
                                    value={spawnType}
                                    onChange={setSpawnType}
                                    options={[
                                        { value: 'LISTENER', label: 'Listener (T0)', icon: '👂' },
                                        { value: 'WORKER', label: 'Worker (T1)', icon: '🤖' },
                                        { value: 'SPECIALIST', label: 'Specialist (T2)', icon: '🔧' },
                                        { value: 'ORCHESTRATOR', label: 'Orchestrator (T3)', icon: '📋' },
                                    ]}
                                    helperText="Role determines capabilities"
                                />
                                <SelectField
                                    label="Trust Tier"
                                    value={spawnTier}
                                    onChange={(v) => setSpawnTier(Number(v))}
                                    options={[
                                        { value: 0, label: 'Tier 0 - Untrusted' },
                                        { value: 1, label: 'Tier 1 - Probationary' },
                                        { value: 2, label: 'Tier 2 - Trusted' },
                                        { value: 3, label: 'Tier 3 - Verified' },
                                    ]}
                                    helperText="Starting trust level"
                                />
                            </div>
                            <button
                                className="btn btn-primary"
                                onClick={handleSpawn}
                                disabled={!spawnName.trim() || spawnName.length < 2}
                                style={{ marginTop: '8px' }}
                            >
                                🚀 Spawn Agent
                            </button>
                        </div>
                    </div>

                    {/* MCP Tools */}
                    <div className="control-section" style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid var(--accent-purple)', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
                        <h3 style={{ color: 'var(--accent-purple)', marginTop: 0 }}>🔌 MCP Integration</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                            External AI clients (Claude Desktop, Cursor) can control agents via MCP.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => window.open('/api/mcp', '_blank')}
                                style={{ fontSize: '0.8rem' }}
                            >
                                📋 View MCP Tools
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => window.open('/api/delegate', '_blank')}
                                style={{ fontSize: '0.8rem' }}
                            >
                                🔀 Delegation Rules
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => window.open('/api/stream', '_blank')}
                                style={{ fontSize: '0.8rem' }}
                            >
                                📡 Stream Snapshot
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => window.open('/api/executor', '_blank')}
                                style={{ fontSize: '0.8rem' }}
                            >
                                🤖 Executor Info
                            </button>
                        </div>
                        <div style={{ marginTop: '12px', padding: '8px', background: 'var(--bg-card)', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <strong>MCP Endpoint:</strong> <code style={{ color: 'var(--accent-cyan)' }}>/api/mcp</code><br />
                            <strong>10 Tools:</strong> get_state, list_agents, create_task, delegate_task, spawn_agent, etc.
                        </div>
                    </div>

                    {/* Trust Tier Info */}
                    <div className="control-section" style={{ marginBottom: '20px' }}>
                        <h3>🏆 Trust Tier System</h3>
                        <div style={{ fontSize: '0.8rem', display: 'grid', gap: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: 'rgba(244, 63, 94, 0.1)', borderRadius: '4px' }}>
                                <span>🔴 ELITE (950+)</span><span>Full Control</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '4px' }}>
                                <span>🟢 CERTIFIED (800+)</span><span>Delegate + Spawn</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '4px' }}>
                                <span>🟣 VERIFIED (600+)</span><span>Can Delegate</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '4px' }}>
                                <span>🔵 TRUSTED (400+)</span><span>Must Execute</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '4px' }}>
                                <span>🟡 PROBATIONARY (200+)</span><span>Must Execute</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: 'rgba(107, 114, 128, 0.1)', borderRadius: '4px' }}>
                                <span>⚫ UNTRUSTED (0+)</span><span>Must Execute</span>
                            </div>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                            Max 2 delegations per task. After that, agent MUST execute.
                        </p>
                    </div>

                </div>
            </div>
        </div>
    );
}
