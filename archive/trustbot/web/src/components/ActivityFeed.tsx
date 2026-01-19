/**
 * Activity Feed - Real-time stream of agent actions
 * Like a live scoreboard showing what each agent just did
 */
import type { BlackboardEntry } from '../types';
import './ActivityFeed.css';

interface ActivityFeedProps {
    entries: BlackboardEntry[];
}

export function ActivityFeed({ entries }: ActivityFeedProps) {
    const getIcon = (type: string) => {
        switch (type) {
            case 'TASK': return '📋';
            case 'OBSERVATION': return '👁️';
            case 'DECISION': return '🧠';
            case 'ACTION': return '⚡';
            case 'RESULT': return '✅';
            case 'PROBLEM': return '⚠️';
            case 'MILESTONE': return '🏆';
            default: return '📌';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'COMPLETED': case 'RESOLVED': return 'var(--accent-green)';
            case 'OPEN': case 'IN_PROGRESS': return 'var(--accent-blue)';
            case 'FAILED': return 'var(--accent-red)';
            default: return 'var(--text-muted)';
        }
    };

    const formatTime = (date: Date) => {
        const now = new Date();
        const diff = (now.getTime() - date.getTime()) / 1000;
        
        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return date.toLocaleDateString();
    };

    if (entries.length === 0) {
        return (
            <div className="activity-feed activity-feed--empty">
                <span className="activity-feed__empty-icon">📡</span>
                <p>No activity yet. Run a tick to see updates.</p>
            </div>
        );
    }

    return (
        <div className="activity-feed">
            {entries.map(entry => (
                <div key={entry.id} className="activity-item">
                    <span className="activity-item__icon">{getIcon(entry.type)}</span>
                    <div className="activity-item__content">
                        <span className="activity-item__author">{entry.author}</span>
                        <span className="activity-item__title">{entry.title}</span>
                        <span 
                            className="activity-item__status"
                            style={{ color: getStatusColor(entry.status) }}
                        >
                            {entry.status}
                        </span>
                    </div>
                    <span className="activity-item__time">
                        {formatTime(entry.timestamp)}
                    </span>
                </div>
            ))}
        </div>
    );
}
