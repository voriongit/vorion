interface EmptyStateProps {
    icon?: string;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
        icon?: string;
    };
    secondaryAction?: {
        label: string;
        onClick: () => void;
    };
    size?: 'small' | 'medium' | 'large';
}

export function EmptyState({
    icon = '📭',
    title,
    description,
    action,
    secondaryAction,
    size = 'medium',
}: EmptyStateProps) {
    const sizes = {
        small: { icon: '2rem', title: '0.9rem', desc: '0.8rem', padding: '24px' },
        medium: { icon: '3rem', title: '1.1rem', desc: '0.9rem', padding: '40px' },
        large: { icon: '4rem', title: '1.25rem', desc: '1rem', padding: '60px' },
    };

    const s = sizes[size];

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: s.padding,
                background: 'var(--bg-card, #1a2234)',
                borderRadius: '12px',
                border: '1px dashed var(--border-color, #374151)',
            }}
        >
            {/* Icon */}
            <div
                style={{
                    fontSize: s.icon,
                    marginBottom: '16px',
                    opacity: 0.8,
                }}
                aria-hidden="true"
            >
                {icon}
            </div>

            {/* Title */}
            <h3
                style={{
                    margin: 0,
                    marginBottom: description ? '8px' : action ? '16px' : 0,
                    fontSize: s.title,
                    fontWeight: 600,
                    color: 'var(--text-primary, #f9fafb)',
                }}
            >
                {title}
            </h3>

            {/* Description */}
            {description && (
                <p
                    style={{
                        margin: 0,
                        marginBottom: action ? '20px' : 0,
                        fontSize: s.desc,
                        color: 'var(--text-muted, #6b7280)',
                        maxWidth: '300px',
                        lineHeight: 1.5,
                    }}
                >
                    {description}
                </p>
            )}

            {/* Actions */}
            {(action || secondaryAction) && (
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {action && (
                        <button
                            onClick={action.onClick}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 20px',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                background: 'var(--accent-blue, #3b82f6)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                            }}
                            onMouseOver={e => {
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
                            }}
                            onMouseOut={e => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            {action.icon && <span aria-hidden="true">{action.icon}</span>}
                            {action.label}
                        </button>
                    )}
                    {secondaryAction && (
                        <button
                            onClick={secondaryAction.onClick}
                            style={{
                                padding: '10px 20px',
                                fontSize: '0.9rem',
                                fontWeight: 500,
                                background: 'transparent',
                                color: 'var(--text-secondary, #9ca3af)',
                                border: '1px solid var(--border-color, #374151)',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                transition: 'background 0.15s ease',
                            }}
                            onMouseOver={e => e.currentTarget.style.background = 'var(--bg-card-hover, #232d42)'}
                            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                        >
                            {secondaryAction.label}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

// Preset empty states for common scenarios
export const EmptyStates = {
    noAgents: (onSpawn: () => void) => (
        <EmptyState
            icon="🤖"
            title="No agents yet"
            description="Create your first agent to get started with autonomous task processing."
            action={{ label: 'Spawn Agent', onClick: onSpawn, icon: '➕' }}
        />
    ),

    noTasks: (onCreate: () => void) => (
        <EmptyState
            icon="📋"
            title="No tasks in queue"
            description="Create a task to give your agents something to work on."
            action={{ label: 'Create Task', onClick: onCreate, icon: '➕' }}
        />
    ),

    noBlackboardEntries: (onPost: () => void) => (
        <EmptyState
            icon="📝"
            title="Blackboard is empty"
            description="Agents will post observations, decisions, and solutions here as they work."
            action={{ label: 'Post Entry', onClick: onPost, icon: '✏️' }}
        />
    ),

    noApprovals: () => (
        <EmptyState
            icon="✅"
            title="All caught up!"
            description="No pending approvals. Agents are operating autonomously within their trust levels."
            size="small"
        />
    ),

    noSearchResults: (query: string, onClear: () => void) => (
        <EmptyState
            icon="🔍"
            title="No results found"
            description={`No matches for "${query}". Try a different search term.`}
            action={{ label: 'Clear Search', onClick: onClear }}
            size="small"
        />
    ),

    noSkills: (onBrowse: () => void) => (
        <EmptyState
            icon="🎯"
            title="No skills assigned"
            description="Assign skills to enhance this agent's capabilities."
            action={{ label: 'Browse Skills', onClick: onBrowse, icon: '📚' }}
        />
    ),

    error: (message: string, onRetry: () => void) => (
        <EmptyState
            icon="⚠️"
            title="Something went wrong"
            description={message}
            action={{ label: 'Try Again', onClick: onRetry, icon: '🔄' }}
        />
    ),

    loading: () => (
        <EmptyState
            icon="⏳"
            title="Loading..."
            description="Please wait while we fetch the data."
            size="small"
        />
    ),
};
