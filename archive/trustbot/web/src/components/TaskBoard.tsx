import React, { useEffect, useState } from 'react';
import type { Task } from '../types';
import { api } from '../api';
import './TaskBoard.css';

/**
 * Task Board - Mobile-First with Tabs
 *
 * Displays tasks in three categories:
 * - Pending: Tasks awaiting approval/assignment
 * - Active: Tasks currently in progress
 * - Completed: Finished tasks with results
 */

type TabType = 'pending' | 'active' | 'completed';

interface TaskBoardProps {
    onClose?: () => void;
    embedded?: boolean;
    onApproveTask?: (taskId: string) => Promise<void>;
    onRejectTask?: (taskId: string, reason?: string) => Promise<void>;
}

export const TaskBoard: React.FC<TaskBoardProps> = ({ onClose, embedded = false, onApproveTask, onRejectTask }) => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('active');
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

    // Rejection dialog state
    const [rejectingTask, setRejectingTask] = useState<Task | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchTasks = async () => {
            try {
                const data = await api.getTasks();
                setTasks(data.tasks);
            } catch (error) {
                console.error('Failed to fetch tasks:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchTasks();
        const interval = setInterval(fetchTasks, 3000);
        return () => clearInterval(interval);
    }, []);

    // Filter tasks by tab
    const pendingTasks = tasks.filter(t => t.status === 'PENDING' || t.status === 'ASSIGNED');
    const activeTasks = tasks.filter(t => t.status === 'IN_PROGRESS');
    const completedTasks = tasks.filter(t => t.status === 'COMPLETED' || t.status === 'FAILED');

    const getTabTasks = () => {
        switch (activeTab) {
            case 'pending': return pendingTasks;
            case 'active': return activeTasks;
            case 'completed': return completedTasks;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PENDING': return 'var(--accent-gold)';
            case 'ASSIGNED': return 'var(--accent-blue)';
            case 'IN_PROGRESS': return 'var(--accent-cyan)';
            case 'COMPLETED': return 'var(--accent-green)';
            case 'FAILED': return 'var(--accent-red)';
            default: return 'var(--text-primary)';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'PENDING': return '⏳';
            case 'ASSIGNED': return '📌';
            case 'IN_PROGRESS': return '▶️';
            case 'COMPLETED': return '✅';
            case 'FAILED': return '❌';
            default: return '📋';
        }
    };

    const handleApprove = async (taskId: string) => {
        if (onApproveTask) {
            await onApproveTask(taskId);
        }
    };

    const handleRejectClick = (task: Task) => {
        setRejectingTask(task);
        setRejectReason('');
    };

    const handleRejectCancel = () => {
        setRejectingTask(null);
        setRejectReason('');
    };

    const handleRejectConfirm = async () => {
        if (!rejectingTask || !onRejectTask) return;

        setIsSubmitting(true);
        try {
            await onRejectTask(rejectingTask.id, rejectReason || undefined);
            setRejectingTask(null);
            setRejectReason('');
        } catch (error) {
            console.error('Failed to reject task:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatDuration = (duration?: string) => {
        if (!duration) return '-';
        return duration;
    };

    const tabCounts = {
        pending: pendingTasks.length,
        active: activeTasks.length,
        completed: completedTasks.length,
    };

    // Rejection confirmation dialog
    const RejectDialog = () => {
        if (!rejectingTask) return null;

        return (
            <div
                className="reject-dialog-overlay"
                onClick={handleRejectCancel}
                role="presentation"
            >
                <div
                    className="reject-dialog glass"
                    onClick={e => e.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="reject-dialog-title"
                >
                    <div className="reject-dialog-header">
                        <h3 id="reject-dialog-title">Reject Task</h3>
                        <button
                            className="reject-dialog-close"
                            onClick={handleRejectCancel}
                            aria-label="Cancel"
                        >
                            ×
                        </button>
                    </div>

                    <div className="reject-dialog-content">
                        <p className="reject-dialog-task">
                            <span className="reject-task-label">Task:</span>
                            <span className="reject-task-desc">{rejectingTask.description}</span>
                        </p>

                        <label className="reject-reason-label" htmlFor="reject-reason">
                            Reason for rejection <span className="optional">(optional)</span>
                        </label>
                        <textarea
                            id="reject-reason"
                            className="reject-reason-input"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Explain why this task is being rejected..."
                            rows={3}
                            autoFocus
                        />
                    </div>

                    <div className="reject-dialog-actions">
                        <button
                            className="btn-cancel"
                            onClick={handleRejectCancel}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            className="btn-confirm-reject"
                            onClick={handleRejectConfirm}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // Task card component
    const TaskCard = ({ task }: { task: Task }) => {
        const isExpanded = expandedTaskId === task.id;
        const hasResult = task.result && task.status === 'COMPLETED';

        return (
            <div
                className={`task-card glass ${isExpanded ? 'expanded' : ''}`}
                onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
            >
                <div className="task-card-header">
                    <div className="task-card-status" style={{ color: getStatusColor(task.status) }}>
                        <span className="task-status-icon">{getStatusIcon(task.status)}</span>
                        <span className="task-status-text">{task.status}</span>
                    </div>
                    <span className="task-card-id">#{task.id.split('-')[1] || task.id.slice(-6)}</span>
                </div>

                <h3 className="task-card-title">{task.description}</h3>

                <div className="task-card-meta">
                    <span className="task-card-type">{task.type}</span>
                    {task.assigneeName && (
                        <span className="task-card-handler">
                            <span className="handler-icon">🤖</span>
                            {task.assigneeName}
                        </span>
                    )}
                </div>

                {/* Progress bar for active tasks */}
                {task.status === 'IN_PROGRESS' && (
                    <div className="task-progress-container">
                        <div className="task-progress-bar">
                            <div
                                className="task-progress-fill"
                                style={{
                                    width: `${task.progress || 0}%`,
                                    background: `linear-gradient(90deg, var(--accent-cyan), var(--accent-blue))`
                                }}
                            />
                        </div>
                        <span className="task-progress-text">{task.progress || 0}%</span>
                    </div>
                )}

                {/* Next steps for pending/active */}
                {(task.status === 'PENDING' || task.status === 'IN_PROGRESS') && task.nextSteps && (
                    <div className="task-next-steps">
                        <span className="next-steps-label">Next:</span>
                        <span className="next-steps-text">{task.nextSteps}</span>
                    </div>
                )}

                {/* Expanded content */}
                {isExpanded && (
                    <div className="task-card-expanded">
                        <div className="task-details-grid">
                            <div className="task-detail">
                                <span className="detail-label">Created By</span>
                                <span className="detail-value">{task.creator}</span>
                            </div>
                            <div className="task-detail">
                                <span className="detail-label">Priority</span>
                                <span className="detail-value">{task.priority}</span>
                            </div>
                            {task.startedAt && (
                                <div className="task-detail">
                                    <span className="detail-label">Started</span>
                                    <span className="detail-value">{new Date(task.startedAt).toLocaleString()}</span>
                                </div>
                            )}
                            {task.completedAt && (
                                <div className="task-detail">
                                    <span className="detail-label">Completed</span>
                                    <span className="detail-value">{new Date(task.completedAt).toLocaleString()}</span>
                                </div>
                            )}
                        </div>

                        {/* Result section for completed tasks */}
                        {hasResult && task.result && (
                            <div className="task-result-section">
                                <h4 className="result-header">
                                    <span className="result-icon">📊</span>
                                    Result Summary
                                </h4>
                                <p className="result-summary">{task.result.summary}</p>
                                <div className="result-meta">
                                    <span className="result-meta-item">
                                        <span className="meta-label">Completed by:</span>
                                        <span className="meta-value">{task.result.completedBy}</span>
                                    </span>
                                    <span className="result-meta-item">
                                        <span className="meta-label">Duration:</span>
                                        <span className="meta-value">{formatDuration(task.result.duration)}</span>
                                    </span>
                                    <span className="result-meta-item">
                                        <span className="meta-label">Confidence:</span>
                                        <span className="meta-value confidence" style={{
                                            color: task.result.confidence >= 0.8 ? 'var(--accent-green)' :
                                                   task.result.confidence >= 0.5 ? 'var(--accent-gold)' : 'var(--accent-red)'
                                        }}>
                                            {Math.round(task.result.confidence * 100)}%
                                        </span>
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Action buttons for pending tasks */}
                        {task.status === 'PENDING' && (onApproveTask || onRejectTask) && (
                            <div className="task-actions">
                                {onRejectTask && (
                                    <button
                                        className="btn-reject"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRejectClick(task);
                                        }}
                                        aria-label="Reject task"
                                    >
                                        <span>✕</span> Reject
                                    </button>
                                )}
                                {onApproveTask && (
                                    <button
                                        className="btn-approve"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleApprove(task.id);
                                        }}
                                        aria-label="Approve task"
                                    >
                                        <span>✓</span> Approve
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div className="task-card-chevron">
                    {isExpanded ? '▲' : '▼'}
                </div>
            </div>
        );
    };

    const content = (
        <div className="task-board">
            {/* Tab Navigation */}
            <div className="task-tabs">
                <button
                    className={`task-tab ${activeTab === 'pending' ? 'active' : ''}`}
                    onClick={() => setActiveTab('pending')}
                >
                    <span className="tab-icon">⏳</span>
                    <span className="tab-label">Pending</span>
                    {tabCounts.pending > 0 && (
                        <span className="tab-badge pending">{tabCounts.pending}</span>
                    )}
                </button>
                <button
                    className={`task-tab ${activeTab === 'active' ? 'active' : ''}`}
                    onClick={() => setActiveTab('active')}
                >
                    <span className="tab-icon">▶️</span>
                    <span className="tab-label">Active</span>
                    {tabCounts.active > 0 && (
                        <span className="tab-badge active">{tabCounts.active}</span>
                    )}
                </button>
                <button
                    className={`task-tab ${activeTab === 'completed' ? 'active' : ''}`}
                    onClick={() => setActiveTab('completed')}
                >
                    <span className="tab-icon">✅</span>
                    <span className="tab-label">Completed</span>
                    {tabCounts.completed > 0 && (
                        <span className="tab-badge completed">{tabCounts.completed}</span>
                    )}
                </button>
            </div>

            {/* Task List */}
            <div className="task-list">
                {loading && tasks.length === 0 ? (
                    <div className="task-empty-state">
                        <div className="loading-spinner" />
                        <p>Loading tasks...</p>
                    </div>
                ) : getTabTasks().length === 0 ? (
                    <div className="task-empty-state">
                        <span className="empty-icon">
                            {activeTab === 'pending' ? '⏳' : activeTab === 'active' ? '▶️' : '✅'}
                        </span>
                        <p>No {activeTab} tasks</p>
                        {activeTab === 'pending' && (
                            <span className="empty-hint">Tasks waiting for approval will appear here</span>
                        )}
                        {activeTab === 'active' && (
                            <span className="empty-hint">In-progress tasks will appear here</span>
                        )}
                        {activeTab === 'completed' && (
                            <span className="empty-hint">Completed tasks with results will appear here</span>
                        )}
                    </div>
                ) : (
                    getTabTasks().map(task => (
                        <TaskCard key={task.id} task={task} />
                    ))
                )}
            </div>
        </div>
    );

    // Embedded page mode
    if (embedded) {
        return (
            <>
                <div className="task-board-page">
                    <div className="task-board-header">
                        <h1>Task Board</h1>
                        <div className="task-board-stats">
                            <span className="stat-item">
                                <span className="stat-value">{tasks.length}</span>
                                <span className="stat-label">Total</span>
                            </span>
                        </div>
                    </div>
                    {content}
                </div>
                <RejectDialog />
            </>
        );
    }

    // Modal mode
    return (
        <>
            <div className="modal-overlay" onClick={onClose} role="presentation">
                <div
                    className="modal task-board-modal"
                    onClick={e => e.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="task-board-title"
                >
                    <div className="modal-header">
                        <h2 id="task-board-title">Task Board</h2>
                        <button className="close-btn" onClick={onClose} aria-label="Close">×</button>
                    </div>
                    <div className="modal-content">
                        {content}
                    </div>
                </div>
            </div>
            <RejectDialog />
        </>
    );
};
