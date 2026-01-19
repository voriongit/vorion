import { useState } from 'react';
import { resetGenesis } from './GenesisProtocol';

interface HelpArticle {
    id: string;
    category: string;
    title: string;
    content: string;
    keywords: string[];
}

const HELP_ARTICLES: HelpArticle[] = [
    // Getting Started
    {
        id: 'overview',
        category: 'Getting Started',
        title: 'What is Aurais?',
        content: `Aurais is an autonomous AI agent orchestration system. It manages a swarm of AI agents that work together, earn trust, and complete tasks.

Key concepts:
• Agents have trust scores (0-1000)
• Higher trust = more permissions
• Agents can delegate or spawn others
• Work is tracked on a shared blackboard`,
        keywords: ['intro', 'overview', 'what', 'about', 'start'],
    },
    {
        id: 'first-task',
        category: 'Getting Started',
        title: 'Creating Your First Task',
        content: `To give agents work:

1. Click the ⚙️ gear icon to open Control Panel
2. Find "Create Task for Agents"
3. Enter a description (e.g., "Research market trends")
4. Click Create

The task enters PENDING status and will be picked up by a capable agent on the next tick.`,
        keywords: ['task', 'create', 'first', 'work', 'how'],
    },
    {
        id: 'running-ticks',
        category: 'Getting Started',
        title: 'Running the Agent Tick',
        content: `The "tick" is the heartbeat of Aurais. Each tick:

1. Routes PENDING tasks to capable agents
2. Progresses IN_PROGRESS tasks
3. Completes finished work
4. Updates trust scores

Run manually: Control Panel → "Run Agent Tick"
Auto-run: System ticks every minute via Vercel Cron`,
        keywords: ['tick', 'run', 'process', 'work', 'auto'],
    },

    // Trust System
    {
        id: 'trust-tiers',
        category: 'Trust System',
        title: 'Trust Tiers Explained',
        content: `Agents have 6 trust tiers:

🔴 ELITE (950-1000): Full control, all permissions
🟢 CERTIFIED (800-949): Can delegate + spawn agents
🟣 VERIFIED (600-799): Can delegate tasks
🔵 TRUSTED (400-599): Must execute directly
🟡 PROBATIONARY (200-399): Must execute directly
⚫ UNTRUSTED (0-199): Must execute directly

Trust increases +10 per completed task, decreases -15 per failure.`,
        keywords: ['trust', 'tier', 'score', 'level', 'permission'],
    },
    {
        id: 'delegation-rules',
        category: 'Trust System',
        title: 'Anti-Delegation Rules',
        content: `To prevent infinite delegation loops:

1. Only VERIFIED+ (600+ trust) can delegate
2. Max 2 delegations per task
3. After max delegations, agent MUST execute

If an agent tries to delegate when not allowed:
• -20 trust penalty for invalid delegation
• -25 trust penalty for excessive delegation

This ensures work gets done, not just passed around.`,
        keywords: ['delegate', 'delegation', 'rules', 'prevent', 'loop'],
    },
    {
        id: 'trust-rewards',
        category: 'Trust System',
        title: 'Trust Rewards & Penalties',
        content: `Rewards:
• +10 Task completed successfully
• +5 Good review score
• +3 Subtask completed

Penalties:
• -15 Task failed
• -10 Task timeout
• -20 Invalid delegation attempt
• -25 Excessive delegation attempt
• -50 Security violation`,
        keywords: ['reward', 'penalty', 'points', 'score', 'gain', 'lose'],
    },

    // Agents
    {
        id: 'agent-types',
        category: 'Agents',
        title: 'Agent Types',
        content: `Each agent has a specialized role:

🎖️ EXECUTOR: Task execution, emergency override
🧠 PLANNER: Strategy design, goal decomposition
🛡️ VALIDATOR: Compliance check, security audit
🧬 EVOLVER: System optimization, pattern recognition
🏭 SPAWNER: Create new agents, resource allocation
👂 LISTENER: Observation, monitoring
🤖 WORKER: General task execution`,
        keywords: ['agent', 'type', 'role', 'executor', 'planner', 'validator'],
    },
    {
        id: 'agent-status',
        category: 'Agents',
        title: 'Agent Status',
        content: `Agents can be in these states:

🟢 IDLE: Available for work
🔵 WORKING: Currently on a task
🟡 IN_MEETING: Collaborating with other agents
🔴 ERROR: Encountered a problem
⚫ TERMINATED: No longer active

Idle agents are assigned pending tasks during each tick.`,
        keywords: ['status', 'state', 'idle', 'working', 'busy'],
    },
    {
        id: 'spawn-agent',
        category: 'Agents',
        title: 'Spawning New Agents',
        content: `Only CERTIFIED+ (800+ trust) agents can spawn new agents.

To spawn manually:
1. Open Control Panel
2. Enter agent name
3. Select type (Listener, Worker, etc.)
4. Select starting tier
5. Click Spawn

New agents start with low trust (100-200) and must earn higher tiers.`,
        keywords: ['spawn', 'create', 'new', 'agent', 'add'],
    },

    // Mission Control
    {
        id: 'mission-control-overview',
        category: 'Mission Control',
        title: 'Using Mission Control',
        content: `Mission Control is the shared intelligence hub for all agents:

Entry Types:
• PROBLEM: Issues identified
• SOLUTION: Proposed fixes
• DECISION: Choices made
• OBSERVATION: Findings
• TASK: Work items
• PATTERN: Recurring themes

Click entry type counts to filter. Add comments to guide agents.`,
        keywords: ['mission', 'control', 'blackboard', 'shared', 'intelligence', 'post', 'entry'],
    },
    {
        id: 'posting-entries',
        category: 'Mission Control',
        title: 'Posting to Mission Control',
        content: `To add a new entry:

1. Find the blackboard section in the sidebar
2. Click "New Entry" button
3. Select type (Problem, Solution, etc.)
4. Enter title and content
5. Click Post

Or open Mission Control for the full view with threaded conversations.`,
        keywords: ['post', 'add', 'entry', 'mission', 'control', 'new'],
    },

    // MCP Integration
    {
        id: 'mcp-overview',
        category: 'MCP Integration',
        title: 'What is MCP?',
        content: `MCP (Model Context Protocol) lets external AI clients control Aurais.

Supported clients:
• Claude Desktop
• Cursor
• Any MCP-compatible tool

Endpoint: /api/mcp

This allows you to manage agents via natural language in other AI tools.`,
        keywords: ['mcp', 'integration', 'claude', 'cursor', 'external'],
    },
    {
        id: 'mcp-tools',
        category: 'MCP Integration',
        title: 'Available MCP Tools',
        content: `Aurais exposes 10 MCP tools:

• aurais_get_state - World state
• aurais_list_agents - Agent list
• aurais_get_agent - Agent details
• aurais_create_task - New task
• aurais_list_tasks - Task list
• aurais_delegate_task - Delegate work
• aurais_spawn_agent - Create agent
• aurais_send_message - Inter-agent comms
• aurais_get_metrics - System stats
• aurais_run_tick - Process tick`,
        keywords: ['mcp', 'tools', 'commands', 'api', 'list'],
    },

    // Control Panel
    {
        id: 'hitl-level',
        category: 'Control Panel',
        title: 'HITL (Human-In-The-Loop) Level',
        content: `The HITL slider controls human oversight:

100%: Full oversight - all decisions need approval
50%: Shared control - major decisions escalate
20%: Mostly autonomous - only critical items
0%: Full autonomy - agents operate independently

Adjust based on your comfort with autonomous operation.`,
        keywords: ['hitl', 'human', 'loop', 'oversight', 'control', 'autonomy'],
    },
];

interface HelpPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onRestartTour: () => void;
}

export function HelpPanel({ isOpen, onClose, onRestartTour }: HelpPanelProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);

    if (!isOpen) return null;

    // Filter articles by search query
    const filteredArticles = searchQuery.trim()
        ? HELP_ARTICLES.filter(article =>
            article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            article.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
            article.keywords.some(k => k.includes(searchQuery.toLowerCase()))
          )
        : HELP_ARTICLES;

    // Group by category
    const categories = [...new Set(filteredArticles.map(a => a.category))];

    const handleRestartGenesis = () => {
        resetGenesis();
        onRestartTour();
        onClose();
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: '400px',
            maxWidth: '100vw',
            background: 'var(--bg-primary)',
            borderLeft: '1px solid var(--border-color)',
            zIndex: 9000,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '-4px 0 20px rgba(0,0,0,0.3)',
        }}>
            {/* Header */}
            <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem' }}>📚 Help Center</h2>
                <button
                    onClick={onClose}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        fontSize: '1.5rem',
                        cursor: 'pointer',
                        padding: '4px',
                    }}
                >
                    ✕
                </button>
            </div>

            {/* Search */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-color)' }}>
                <input
                    type="text"
                    placeholder="Search help articles..."
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setSelectedArticle(null); }}
                    style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem',
                    }}
                />
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '12px 20px' }}>
                {selectedArticle ? (
                    // Article View
                    <div>
                        <button
                            onClick={() => setSelectedArticle(null)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--accent-blue)',
                                cursor: 'pointer',
                                padding: '4px 0',
                                marginBottom: '12px',
                                fontSize: '0.85rem',
                            }}
                        >
                            ← Back to articles
                        </button>
                        <span style={{
                            fontSize: '0.7rem',
                            color: 'var(--accent-purple)',
                            textTransform: 'uppercase',
                            letterSpacing: '1px',
                        }}>
                            {selectedArticle.category}
                        </span>
                        <h3 style={{ margin: '8px 0 16px 0', fontSize: '1.1rem' }}>
                            {selectedArticle.title}
                        </h3>
                        <p style={{
                            fontSize: '0.9rem',
                            color: 'var(--text-secondary)',
                            lineHeight: 1.7,
                            whiteSpace: 'pre-line',
                        }}>
                            {selectedArticle.content}
                        </p>
                    </div>
                ) : (
                    // Article List
                    <div>
                        {categories.map(category => (
                            <div key={category} style={{ marginBottom: '20px' }}>
                                <h4 style={{
                                    fontSize: '0.75rem',
                                    color: 'var(--text-muted)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '1px',
                                    marginBottom: '8px',
                                }}>
                                    {category}
                                </h4>
                                {filteredArticles
                                    .filter(a => a.category === category)
                                    .map(article => (
                                        <div
                                            key={article.id}
                                            onClick={() => setSelectedArticle(article)}
                                            style={{
                                                padding: '10px 12px',
                                                marginBottom: '4px',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                transition: 'background 0.15s ease',
                                                background: 'var(--bg-secondary)',
                                            }}
                                            onMouseOver={e => e.currentTarget.style.background = 'var(--bg-card)'}
                                            onMouseOut={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                                        >
                                            <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                                                {article.title}
                                            </div>
                                        </div>
                                    ))
                                }
                            </div>
                        ))}

                        {filteredArticles.length === 0 && (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 20px' }}>
                                No articles found for "{searchQuery}"
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div style={{
                padding: '12px 20px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                gap: '8px',
            }}>
                <button
                    onClick={handleRestartGenesis}
                    style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: 'transparent',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                    }}
                >
                    Restart Genesis
                </button>
                <button
                    onClick={() => window.open('/api/mcp', '_blank')}
                    style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'var(--accent-purple)',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                    }}
                >
                    📋 API Docs
                </button>
            </div>
        </div>
    );
}
