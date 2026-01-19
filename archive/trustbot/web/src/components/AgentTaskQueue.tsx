import { useState } from 'react';

/**
 * Agent Task Queue - Like a print queue for agent tasks
 *
 * Features:
 * - View all tasks for an agent
 * - Add new tasks
 * - Delete tasks
 * - Hold/Pause tasks
 * - Reorder by priority
 * - Track status (pending, running, paused, completed, failed)
 */

interface AgentTask {
    id: string;
    title: string;
    description?: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
    assignedBy?: string;
    progress?: number; // 0-100
}

interface AgentTaskQueueProps {
    agentId: string;
    agentName: string;
    tasks?: AgentTask[];
    onClose: () => void;
    onAddTask?: (agentId: string, task: Omit<AgentTask, 'id' | 'createdAt' | 'status'>) => void;
    onDeleteTask?: (agentId: string, taskId: string) => void;
    onPauseTask?: (agentId: string, taskId: string) => void;
    onResumeTask?: (agentId: string, taskId: string) => void;
    onReorderTask?: (agentId: string, taskId: string, direction: 'up' | 'down') => void;
}

const PRIORITY_COLORS = {
    low: '#6b7280',
    medium: '#3b82f6',
    high: '#f59e0b',
    critical: '#ef4444',
};

const STATUS_ICONS = {
    pending: '⏳',
    running: '▶️',
    paused: '⏸️',
    completed: '✅',
    failed: '❌',
};

// Demo tasks for display
const DEMO_TASKS: AgentTask[] = [
    {
        id: 'task-1',
        title: 'Process daily reports',
        description: 'Aggregate and summarize daily metrics from all sources',
        priority: 'high',
        status: 'running',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        startedAt: new Date(Date.now() - 1800000).toISOString(),
        assignedBy: 'HITL-9901',
        progress: 65,
    },
    {
        id: 'task-2',
        title: 'Update knowledge base',
        description: 'Sync new documentation entries',
        priority: 'medium',
        status: 'pending',
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        assignedBy: 'HITL-9901',
    },
    {
        id: 'task-3',
        title: 'Review flagged items',
        description: 'Check items flagged by T1 agents for approval',
        priority: 'low',
        status: 'paused',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        assignedBy: 'System',
    },
];

export function AgentTaskQueue({
    agentId,
    agentName,
    tasks: propTasks,
    onClose,
    onAddTask,
    onDeleteTask,
    onPauseTask,
    onResumeTask,
    onReorderTask,
}: AgentTaskQueueProps) {
    const [tasks, setTasks] = useState<AgentTask[]>(propTasks || DEMO_TASKS);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newTask, setNewTask] = useState({
        title: '',
        description: '',
        priority: 'medium' as AgentTask['priority'],
    });
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const handleAddTask = () => {
        if (!newTask.title.trim()) return;

        const task: AgentTask = {
            id: `task-${Date.now()}`,
            title: newTask.title,
            description: newTask.description || undefined,
            priority: newTask.priority,
            status: 'pending',
            createdAt: new Date().toISOString(),
            assignedBy: 'HITL-9901',
        };

        setTasks(prev => [task, ...prev]);
        onAddTask?.(agentId, { title: task.title, description: task.description, priority: task.priority, assignedBy: task.assignedBy });
        setNewTask({ title: '', description: '', priority: 'medium' });
        setShowAddForm(false);
    };

    const handleDeleteTask = (taskId: string) => {
        setTasks(prev => prev.filter(t => t.id !== taskId));
        onDeleteTask?.(agentId, taskId);
        setDeleteConfirm(null);
    };

    const handleTogglePause = (task: AgentTask) => {
        setTasks(prev => prev.map(t => {
            if (t.id === task.id) {
                const newStatus = t.status === 'paused' ? 'pending' : 'paused';
                if (newStatus === 'paused') {
                    onPauseTask?.(agentId, task.id);
                } else {
                    onResumeTask?.(agentId, task.id);
                }
                return { ...t, status: newStatus };
            }
            return t;
        }));
    };

    const handleMoveTask = (taskId: string, direction: 'up' | 'down') => {
        setTasks(prev => {
            const index = prev.findIndex(t => t.id === taskId);
            if (index === -1) return prev;
            if (direction === 'up' && index === 0) return prev;
            if (direction === 'down' && index === prev.length - 1) return prev;

            const newTasks = [...prev];
            const swapIndex = direction === 'up' ? index - 1 : index + 1;
            [newTasks[index], newTasks[swapIndex]] = [newTasks[swapIndex], newTasks[index]];
            return newTasks;
        });
        onReorderTask?.(agentId, taskId, direction);
    };

    const pendingCount = tasks.filter(t => t.status === 'pending').length;
    const runningCount = tasks.filter(t => t.status === 'running').length;
    const pausedCount = tasks.filter(t => t.status === 'paused').length;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '700px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
            >
                {/* Header */}
                <div className="modal-header" style={{ borderBottom: 'none', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.5rem' }}>📋</span>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Task Queue</h2>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {agentName}
                            </p>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                {/* Stats Bar */}
                <div style={{
                    display: 'flex',
                    gap: '16px',
                    padding: '12px 20px',
                    background: 'var(--bg-secondary)',
                    borderBottom: '1px solid var(--border-color)',
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                        <span>⏳</span>
                        <span style={{ color: 'var(--text-muted)' }}>Pending:</span>
                        <span style={{ fontWeight: 600 }}>{pendingCount}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                        <span>▶️</span>
                        <span style={{ color: 'var(--text-muted)' }}>Running:</span>
                        <span style={{ fontWeight: 600, color: 'var(--accent-green)' }}>{runningCount}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
                        <span>⏸️</span>
                        <span style={{ color: 'var(--text-muted)' }}>Paused:</span>
                        <span style={{ fontWeight: 600, color: 'var(--accent-gold)' }}>{pausedCount}</span>
                    </div>
                    <div style={{ marginLeft: 'auto' }}>
                        <button
                            onClick={() => setShowAddForm(true)}
                            style={{
                                padding: '6px 12px',
                                background: 'var(--accent-blue)',
                                border: 'none',
                                borderRadius: '6px',
                                color: 'white',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                            }}
                        >
                            <span>+</span> Add Task
                        </button>
                    </div>
                </div>

                {/* Add Task Form */}
                {showAddForm && (
                    <div style={{
                        padding: '16px 20px',
                        background: 'var(--bg-tertiary)',
                        borderBottom: '1px solid var(--border-color)',
                        flexShrink: 0,
                    }}>
                        <div style={{ marginBottom: '12px' }}>
                            <input
                                type="text"
                                placeholder="Task title..."
                                value={newTask.title}
                                onChange={e => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    background: 'var(--bg-primary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '6px',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.9rem',
                                }}
                                autoFocus
                            />
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                            <textarea
                                placeholder="Description (optional)..."
                                value={newTask.description}
                                onChange={e => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    background: 'var(--bg-primary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '6px',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.85rem',
                                    resize: 'vertical',
                                    minHeight: '60px',
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Priority:</span>
                                {(['low', 'medium', 'high', 'critical'] as const).map(p => (
                                    <button
                                        key={p}
                                        onClick={() => setNewTask(prev => ({ ...prev, priority: p }))}
                                        style={{
                                            padding: '4px 10px',
                                            background: newTask.priority === p ? PRIORITY_COLORS[p] : 'var(--bg-secondary)',
                                            border: `1px solid ${PRIORITY_COLORS[p]}`,
                                            borderRadius: '4px',
                                            color: newTask.priority === p ? 'white' : PRIORITY_COLORS[p],
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            textTransform: 'capitalize',
                                        }}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => setShowAddForm(false)}
                                    style={{
                                        padding: '8px 16px',
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '6px',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddTask}
                                    disabled={!newTask.title.trim()}
                                    style={{
                                        padding: '8px 16px',
                                        background: newTask.title.trim() ? 'var(--accent-green)' : 'var(--bg-tertiary)',
                                        border: 'none',
                                        borderRadius: '6px',
                                        color: newTask.title.trim() ? 'white' : 'var(--text-muted)',
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        cursor: newTask.title.trim() ? 'pointer' : 'not-allowed',
                                    }}
                                >
                                    Add Task
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Task List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
                    {tasks.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '40px 20px',
                            color: 'var(--text-muted)',
                        }}>
                            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📭</div>
                            <p>No tasks in queue</p>
                            <button
                                onClick={() => setShowAddForm(true)}
                                style={{
                                    marginTop: '12px',
                                    padding: '8px 16px',
                                    background: 'var(--accent-blue)',
                                    border: 'none',
                                    borderRadius: '6px',
                                    color: 'white',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                }}
                            >
                                Add First Task
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {tasks.map((task, index) => (
                                <div
                                    key={task.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'stretch',
                                        background: 'var(--bg-secondary)',
                                        border: `1px solid ${task.status === 'running' ? 'var(--accent-green)' : 'var(--border-color)'}`,
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        opacity: task.status === 'completed' || task.status === 'failed' ? 0.6 : 1,
                                    }}
                                >
                                    {/* Priority indicator */}
                                    <div style={{
                                        width: '4px',
                                        background: PRIORITY_COLORS[task.priority],
                                        flexShrink: 0,
                                    }} />

                                    {/* Task content */}
                                    <div style={{ flex: 1, padding: '12px 16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '1rem' }}>{STATUS_ICONS[task.status]}</span>
                                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{task.title}</span>
                                            <span style={{
                                                padding: '2px 6px',
                                                background: PRIORITY_COLORS[task.priority],
                                                borderRadius: '4px',
                                                fontSize: '0.65rem',
                                                color: 'white',
                                                fontWeight: 600,
                                                textTransform: 'uppercase',
                                            }}>
                                                {task.priority}
                                            </span>
                                        </div>
                                        {task.description && (
                                            <p style={{
                                                margin: '4px 0 0 0',
                                                fontSize: '0.8rem',
                                                color: 'var(--text-muted)',
                                            }}>
                                                {task.description}
                                            </p>
                                        )}
                                        {task.progress !== undefined && task.status === 'running' && (
                                            <div style={{ marginTop: '8px' }}>
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    fontSize: '0.7rem',
                                                    color: 'var(--text-muted)',
                                                    marginBottom: '4px',
                                                }}>
                                                    <span>Progress</span>
                                                    <span>{task.progress}%</span>
                                                </div>
                                                <div style={{
                                                    height: '4px',
                                                    background: 'var(--bg-tertiary)',
                                                    borderRadius: '2px',
                                                    overflow: 'hidden',
                                                }}>
                                                    <div style={{
                                                        width: `${task.progress}%`,
                                                        height: '100%',
                                                        background: 'var(--accent-green)',
                                                        transition: 'width 0.3s ease',
                                                    }} />
                                                </div>
                                            </div>
                                        )}
                                        <div style={{
                                            display: 'flex',
                                            gap: '12px',
                                            marginTop: '8px',
                                            fontSize: '0.7rem',
                                            color: 'var(--text-muted)',
                                        }}>
                                            <span>Added: {new Date(task.createdAt).toLocaleString()}</span>
                                            {task.assignedBy && <span>By: {task.assignedBy}</span>}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        borderLeft: '1px solid var(--border-color)',
                                        background: 'var(--bg-tertiary)',
                                    }}>
                                        {/* Reorder buttons */}
                                        <button
                                            onClick={() => handleMoveTask(task.id, 'up')}
                                            disabled={index === 0}
                                            style={{
                                                padding: '8px 12px',
                                                background: 'transparent',
                                                border: 'none',
                                                borderBottom: '1px solid var(--border-color)',
                                                color: index === 0 ? 'var(--text-muted)' : 'var(--text-secondary)',
                                                cursor: index === 0 ? 'not-allowed' : 'pointer',
                                                fontSize: '0.8rem',
                                            }}
                                            title="Move up"
                                        >
                                            ↑
                                        </button>
                                        <button
                                            onClick={() => handleMoveTask(task.id, 'down')}
                                            disabled={index === tasks.length - 1}
                                            style={{
                                                padding: '8px 12px',
                                                background: 'transparent',
                                                border: 'none',
                                                borderBottom: '1px solid var(--border-color)',
                                                color: index === tasks.length - 1 ? 'var(--text-muted)' : 'var(--text-secondary)',
                                                cursor: index === tasks.length - 1 ? 'not-allowed' : 'pointer',
                                                fontSize: '0.8rem',
                                            }}
                                            title="Move down"
                                        >
                                            ↓
                                        </button>
                                        {/* Pause/Resume */}
                                        {task.status !== 'completed' && task.status !== 'failed' && (
                                            <button
                                                onClick={() => handleTogglePause(task)}
                                                style={{
                                                    padding: '8px 12px',
                                                    background: 'transparent',
                                                    border: 'none',
                                                    borderBottom: '1px solid var(--border-color)',
                                                    color: task.status === 'paused' ? 'var(--accent-green)' : 'var(--accent-gold)',
                                                    cursor: 'pointer',
                                                    fontSize: '0.8rem',
                                                }}
                                                title={task.status === 'paused' ? 'Resume' : 'Pause'}
                                            >
                                                {task.status === 'paused' ? '▶' : '⏸'}
                                            </button>
                                        )}
                                        {/* Delete */}
                                        <button
                                            onClick={() => setDeleteConfirm(task.id)}
                                            style={{
                                                padding: '8px 12px',
                                                background: 'transparent',
                                                border: 'none',
                                                color: 'var(--accent-red)',
                                                cursor: 'pointer',
                                                fontSize: '0.8rem',
                                            }}
                                            title="Delete task"
                                        >
                                            🗑
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Delete Confirmation */}
                {deleteConfirm && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0,0,0,0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10,
                    }}>
                        <div style={{
                            background: 'var(--bg-primary)',
                            padding: '24px',
                            borderRadius: '12px',
                            textAlign: 'center',
                            maxWidth: '300px',
                        }}>
                            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🗑️</div>
                            <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem' }}>Delete Task?</h3>
                            <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                This action cannot be undone.
                            </p>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                                <button
                                    onClick={() => setDeleteConfirm(null)}
                                    style={{
                                        padding: '8px 20px',
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '6px',
                                        color: 'var(--text-primary)',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleDeleteTask(deleteConfirm)}
                                    style={{
                                        padding: '8px 20px',
                                        background: 'var(--accent-red)',
                                        border: 'none',
                                        borderRadius: '6px',
                                        color: 'white',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                    }}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default AgentTaskQueue;
