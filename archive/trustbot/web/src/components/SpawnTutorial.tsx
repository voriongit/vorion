import { useState } from 'react';
import { TIERS, AGENT_TYPES, HITL_LEVELS } from '../constants';

interface SpawnTutorialProps {
    onClose: () => void;
    onSpawn?: (name: string, type: string, tier: number) => void;
}

type TutorialStep = 'intro' | 'tiers' | 'types' | 'hitl' | 'spawn' | 'done';

const TIER_DETAILS = [
    {
        tier: 0,
        name: 'Untrusted',
        description: 'New agents start here. No autonomous actions allowed.',
        permissions: ['Observe only', 'Request approval for everything', 'Cannot delegate'],
        example: 'A brand new agent learning the system'
    },
    {
        tier: 1,
        name: 'Probationary',
        description: 'Building trust. Can perform low-risk tasks with monitoring.',
        permissions: ['Execute low-risk tasks', 'Still requires frequent approval', 'Actions logged'],
        example: 'Agent that completed initial training'
    },
    {
        tier: 2,
        name: 'Trusted',
        description: 'Proven reliable. Can handle routine tasks independently.',
        permissions: ['Execute routine tasks', 'Moderate autonomy', 'Periodic check-ins'],
        example: 'Agent with consistent good behavior'
    },
    {
        tier: 3,
        name: 'Verified',
        description: 'Highly trusted. Can make decisions and delegate to lower tiers.',
        permissions: ['Make decisions', 'Delegate to Tier 0-2', 'Strategic input'],
        example: 'Senior agent leading small projects'
    },
    {
        tier: 4,
        name: 'Certified',
        description: 'Expert level. Can manage teams and approve other agents.',
        permissions: ['Manage agent teams', 'Approve lower-tier requests', 'High autonomy'],
        example: 'Department lead or specialist'
    },
    {
        tier: 5,
        name: 'Elite',
        description: 'Maximum trust. Near-autonomous operation with strategic authority.',
        permissions: ['Full autonomy within bounds', 'Strategic decisions', 'System-wide influence'],
        example: 'Executive-level AI leadership'
    },
];

const TYPE_DETAILS = Object.entries(AGENT_TYPES).map(([key, value]) => ({
    type: key,
    ...value,
    useCases: getUseCases(key),
}));

function getUseCases(type: string): string[] {
    const cases: Record<string, string[]> = {
        EXECUTOR: ['Running approved actions', 'Completing assigned tasks', 'Following workflows'],
        PLANNER: ['Creating project plans', 'Breaking down complex tasks', 'Strategy development'],
        VALIDATOR: ['Code review', 'Quality assurance', 'Compliance checking'],
        EVOLVER: ['System optimization', 'Performance tuning', 'Learning improvements'],
        SPAWNER: ['Creating specialized agents', 'Team composition', 'Resource allocation'],
        LISTENER: ['Monitoring systems', 'Gathering data', 'Alerting on anomalies'],
        WORKER: ['General tasks', 'Data processing', 'Routine operations'],
        SPECIALIST: ['Domain expertise', 'Technical analysis', 'Specialized knowledge'],
        ORCHESTRATOR: ['Workflow management', 'Agent coordination', 'Task routing'],
    };
    return cases[type] || ['General purpose tasks'];
}

export function SpawnTutorial({ onClose, onSpawn }: SpawnTutorialProps) {
    const [step, setStep] = useState<TutorialStep>('intro');
    const [selectedTier, setSelectedTier] = useState<number | null>(null);
    const [selectedType, setSelectedType] = useState<string | null>(null);

    // For the interactive spawn
    const [spawnName, setSpawnName] = useState('');
    const [spawnType, setSpawnType] = useState('WORKER');
    const [spawnTier, setSpawnTier] = useState(1);

    const handleSpawn = () => {
        if (spawnName.trim() && onSpawn) {
            onSpawn(spawnName.trim(), spawnType, spawnTier);
            setStep('done');
        }
    };

    const renderStep = () => {
        switch (step) {
            case 'intro':
                return (
                    <div className="tutorial-step">
                        <div className="tutorial-icon-large">🤖</div>
                        <h2>Welcome to Aurais Agents</h2>
                        <p className="tutorial-subtitle">
                            AI agents that work autonomously within trust boundaries you define.
                        </p>

                        <div className="tutorial-highlights">
                            <div className="highlight-card">
                                <span className="highlight-icon">🛡️</span>
                                <h4>6-Tier Trust System</h4>
                                <p>Graduated autonomy levels from Untrusted to Elite</p>
                            </div>
                            <div className="highlight-card">
                                <span className="highlight-icon">🎭</span>
                                <h4>9 Agent Types</h4>
                                <p>Specialized roles from Workers to Orchestrators</p>
                            </div>
                            <div className="highlight-card">
                                <span className="highlight-icon">🎛️</span>
                                <h4>HITL Governance</h4>
                                <p>Human-in-the-Loop control from 0-100%</p>
                            </div>
                        </div>

                        <div className="tutorial-actions">
                            <button className="btn-tutorial-primary" onClick={() => setStep('tiers')}>
                                Learn About Trust Tiers →
                            </button>
                            <button className="btn-tutorial-secondary" onClick={() => setStep('spawn')}>
                                Skip to Spawning
                            </button>
                        </div>
                    </div>
                );

            case 'tiers':
                return (
                    <div className="tutorial-step">
                        <h2>🛡️ The 6 Trust Tiers</h2>
                        <p className="tutorial-subtitle">
                            Agents earn trust through consistent, reliable behavior. Higher tiers = more autonomy.
                        </p>

                        <div className="tier-grid">
                            {TIER_DETAILS.map((t) => (
                                <div
                                    key={t.tier}
                                    className={`tier-card ${selectedTier === t.tier ? 'selected' : ''}`}
                                    onClick={() => setSelectedTier(selectedTier === t.tier ? null : t.tier)}
                                    style={{ borderColor: TIERS[t.tier as keyof typeof TIERS].color }}
                                >
                                    <div className="tier-header">
                                        <span
                                            className="tier-badge"
                                            style={{ background: TIERS[t.tier as keyof typeof TIERS].gradient }}
                                        >
                                            T{t.tier}
                                        </span>
                                        <span className="tier-name">{t.name}</span>
                                    </div>
                                    <p className="tier-desc">{t.description}</p>

                                    {selectedTier === t.tier && (
                                        <div className="tier-details">
                                            <strong>Permissions:</strong>
                                            <ul>
                                                {t.permissions.map((p, i) => (
                                                    <li key={i}>{p}</li>
                                                ))}
                                            </ul>
                                            <div className="tier-example">
                                                <strong>Example:</strong> {t.example}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="tutorial-actions">
                            <button className="btn-tutorial-secondary" onClick={() => setStep('intro')}>
                                ← Back
                            </button>
                            <button className="btn-tutorial-primary" onClick={() => setStep('types')}>
                                Agent Types →
                            </button>
                        </div>
                    </div>
                );

            case 'types':
                return (
                    <div className="tutorial-step">
                        <h2>🎭 Agent Types</h2>
                        <p className="tutorial-subtitle">
                            Each type has specialized capabilities. Choose based on what you need done.
                        </p>

                        <div className="type-grid">
                            {TYPE_DETAILS.map((t) => (
                                <div
                                    key={t.type}
                                    className={`type-card ${selectedType === t.type ? 'selected' : ''}`}
                                    onClick={() => setSelectedType(selectedType === t.type ? null : t.type)}
                                >
                                    <div className="type-header">
                                        <span className="type-icon">{t.icon}</span>
                                        <span className="type-label">{t.label}</span>
                                    </div>
                                    <p className="type-desc">{t.description}</p>

                                    {selectedType === t.type && (
                                        <div className="type-details">
                                            <strong>Best for:</strong>
                                            <ul>
                                                {t.useCases.map((u, i) => (
                                                    <li key={i}>{u}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="tutorial-actions">
                            <button className="btn-tutorial-secondary" onClick={() => setStep('tiers')}>
                                ← Back
                            </button>
                            <button className="btn-tutorial-primary" onClick={() => setStep('hitl')}>
                                HITL Governance →
                            </button>
                        </div>
                    </div>
                );

            case 'hitl':
                return (
                    <div className="tutorial-step">
                        <h2>🎛️ HITL Governance</h2>
                        <p className="tutorial-subtitle">
                            Human-in-the-Loop (HITL) controls how much human approval agents need.
                        </p>

                        <div className="hitl-scale">
                            {Object.entries(HITL_LEVELS).map(([key, level]) => (
                                <div key={key} className="hitl-level">
                                    <div className="hitl-range">
                                        <span className="hitl-icon">{level.icon}</span>
                                        <span className="hitl-percent">{level.min}-{level.max}%</span>
                                    </div>
                                    <div className="hitl-info">
                                        <strong>{level.label}</strong>
                                        <p>{level.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="hitl-tip">
                            <strong>💡 Tip:</strong> Start with higher HITL (70-80%) while learning,
                            then reduce as you build confidence in your agents.
                        </div>

                        <div className="tutorial-actions">
                            <button className="btn-tutorial-secondary" onClick={() => setStep('types')}>
                                ← Back
                            </button>
                            <button className="btn-tutorial-primary" onClick={() => setStep('spawn')}>
                                Spawn Your First Agent →
                            </button>
                        </div>
                    </div>
                );

            case 'spawn':
                return (
                    <div className="tutorial-step">
                        <h2>🚀 Spawn Your First Agent</h2>
                        <p className="tutorial-subtitle">
                            Create an agent with a name, type, and starting trust tier.
                        </p>

                        <div className="spawn-form">
                            <div className="spawn-field">
                                <label>Agent Name</label>
                                <input
                                    type="text"
                                    value={spawnName}
                                    onChange={(e) => setSpawnName(e.target.value)}
                                    placeholder="e.g., DataAnalyst, CodeHelper, TaskRunner"
                                    className="spawn-input"
                                />
                                <span className="field-hint">Choose a descriptive name for your agent</span>
                            </div>

                            <div className="spawn-field">
                                <label>Agent Type</label>
                                <div className="type-selector">
                                    {Object.entries(AGENT_TYPES).map(([key, val]) => (
                                        <button
                                            key={key}
                                            className={`type-option ${spawnType === key ? 'selected' : ''}`}
                                            onClick={() => setSpawnType(key)}
                                        >
                                            <span>{val.icon}</span>
                                            <span>{val.label}</span>
                                        </button>
                                    ))}
                                </div>
                                <span className="field-hint">
                                    {AGENT_TYPES[spawnType as keyof typeof AGENT_TYPES]?.description}
                                </span>
                            </div>

                            <div className="spawn-field">
                                <label>Starting Trust Tier</label>
                                <div className="tier-selector">
                                    {[0, 1, 2, 3, 4, 5].map((t) => (
                                        <button
                                            key={t}
                                            className={`tier-option ${spawnTier === t ? 'selected' : ''}`}
                                            onClick={() => setSpawnTier(t)}
                                            style={{
                                                borderColor: spawnTier === t ? TIERS[t as keyof typeof TIERS].color : undefined,
                                                background: spawnTier === t ? TIERS[t as keyof typeof TIERS].gradient : undefined,
                                            }}
                                        >
                                            T{t}
                                        </button>
                                    ))}
                                </div>
                                <span className="field-hint">
                                    {TIER_DETAILS[spawnTier]?.description}
                                </span>
                            </div>

                            <div className="spawn-preview">
                                <strong>Preview Command:</strong>
                                <code>spawn {spawnType.toLowerCase()} "{spawnName || 'AgentName'}" tier={spawnTier}</code>
                            </div>
                        </div>

                        <div className="tutorial-actions">
                            <button className="btn-tutorial-secondary" onClick={() => setStep('hitl')}>
                                ← Back
                            </button>
                            <button
                                className="btn-tutorial-primary"
                                onClick={handleSpawn}
                                disabled={!spawnName.trim()}
                            >
                                🚀 Spawn Agent
                            </button>
                        </div>
                    </div>
                );

            case 'done':
                return (
                    <div className="tutorial-step tutorial-done">
                        <div className="tutorial-icon-large">🎉</div>
                        <h2>Agent Spawned!</h2>
                        <p className="tutorial-subtitle">
                            Your agent <strong>{spawnName}</strong> is now active in the system.
                        </p>

                        <div className="done-summary">
                            <div className="summary-item">
                                <span className="summary-label">Name</span>
                                <span className="summary-value">{spawnName}</span>
                            </div>
                            <div className="summary-item">
                                <span className="summary-label">Type</span>
                                <span className="summary-value">
                                    {AGENT_TYPES[spawnType as keyof typeof AGENT_TYPES]?.icon}{' '}
                                    {AGENT_TYPES[spawnType as keyof typeof AGENT_TYPES]?.label}
                                </span>
                            </div>
                            <div className="summary-item">
                                <span className="summary-label">Trust Tier</span>
                                <span
                                    className="summary-value tier-badge"
                                    style={{ background: TIERS[spawnTier as keyof typeof TIERS].gradient }}
                                >
                                    T{spawnTier} - {TIERS[spawnTier as keyof typeof TIERS].label}
                                </span>
                            </div>
                        </div>

                        <div className="next-steps">
                            <h4>What's Next?</h4>
                            <ul>
                                <li><strong>tick</strong> - Run a system cycle to see your agent work</li>
                                <li><strong>agents</strong> - View all active agents</li>
                                <li><strong>task "description"</strong> - Assign work to agents</li>
                            </ul>
                        </div>

                        <div className="tutorial-actions">
                            <button className="btn-tutorial-primary" onClick={onClose}>
                                Start Using Aurais →
                            </button>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="tutorial-overlay" onClick={onClose}>
            <div className="tutorial-modal" onClick={(e) => e.stopPropagation()}>
                <button className="tutorial-close" onClick={onClose}>×</button>

                {/* Progress indicator */}
                <div className="tutorial-progress">
                    {(['intro', 'tiers', 'types', 'hitl', 'spawn', 'done'] as TutorialStep[]).map((s, i) => (
                        <div
                            key={s}
                            className={`progress-dot ${step === s ? 'active' : ''} ${
                                ['intro', 'tiers', 'types', 'hitl', 'spawn', 'done'].indexOf(step) > i ? 'completed' : ''
                            }`}
                        />
                    ))}
                </div>

                {renderStep()}
            </div>
        </div>
    );
}
