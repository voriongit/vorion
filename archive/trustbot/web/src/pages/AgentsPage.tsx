/**
 * Agents Page - Agent Dashboard with Card Grid or Table View
 * 
 * Features:
 * 1. View Toggle (Cards vs Table)
 * 2. Agent Roster with trust scores, capabilities
 * 3. Activity Feed
 * 4. Controls (spawn, filters, search)
 */
import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AgentCard } from '../components/AgentCard';
import { AgentTableRow } from '../components/AgentTableRow';
import { ActivityFeed } from '../components/ActivityFeed';
import { Agent, BlackboardEntry, ApprovalRequest, CAPABILITIES } from '../types';
import { api } from '../api';
import './AgentsPage.css';
import '../components/AgentTableRow.css';

interface PageContext {
    agents: Agent[];
    blackboardEntries: BlackboardEntry[];
    approvals: ApprovalRequest[];
    hitlLevel: number;
    refresh: () => Promise<void>;
    openAgentDetail: (id: string) => void;
}

type FilterType = 'all' | 'working' | 'idle' | 'stopped';
type SortType = 'trust' | 'name' | 'tier' | 'status';
type ViewMode = 'cards' | 'table';

export function AgentsPage() {
    const ctx = useOutletContext<PageContext>();
    
    const [filter, setFilter] = useState<FilterType>('all');
    const [sort, setSort] = useState<SortType>('tier');
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<ViewMode>('cards');

    // Filter and sort agents
    const displayedAgents = useMemo(() => {
        let result = [...ctx.agents];

        // Search filter
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(a => 
                a.name.toLowerCase().includes(q) ||
                a.type.toLowerCase().includes(q)
            );
        }

        // Status filter
        if (filter !== 'all') {
            result = result.filter(a => {
                switch (filter) {
                    case 'working': return a.status === 'WORKING';
                    case 'idle': return a.status === 'IDLE';
                    case 'stopped': return a.status === 'ERROR' || a.status === 'TERMINATED';
                    default: return true;
                }
            });
        }

        // Sort
        result.sort((a, b) => {
            switch (sort) {
                case 'trust': return b.trustScore - a.trustScore;
                case 'name': return a.name.localeCompare(b.name);
                case 'tier': return b.tier - a.tier;
                case 'status': return a.status.localeCompare(b.status);
                default: return 0;
            }
        });

        return result;
    }, [ctx.agents, filter, sort, searchQuery]);

    // Stats
    const stats = useMemo(() => ({
        total: ctx.agents.length,
        working: ctx.agents.filter(a => a.status === 'WORKING').length,
        idle: ctx.agents.filter(a => a.status === 'IDLE').length,
        avgTrust: ctx.agents.length > 0 
            ? Math.round(ctx.agents.reduce((sum, a) => sum + a.trustScore, 0) / ctx.agents.length)
            : 0,
    }), [ctx.agents]);

    const capabilityHeaders = Object.values(CAPABILITIES);

    return (
        <div className="agents-page">
            {/* Header with stats */}
            <header className="agents-page__header">
                <div className="agents-page__title-row">
                    <h1>🤖 Agent Dashboard</h1>
                    <button className="btn btn--primary" onClick={() => {}}>
                        + Spawn Agent
                    </button>
                </div>
                
                <div className="agents-page__stats">
                    <div className="stat-card">
                        <span className="stat-card__value">{stats.total}</span>
                        <span className="stat-card__label">Total Agents</span>
                    </div>
                    <div className="stat-card stat-card--working">
                        <span className="stat-card__value">{stats.working}</span>
                        <span className="stat-card__label">🟢 Working</span>
                    </div>
                    <div className="stat-card stat-card--idle">
                        <span className="stat-card__value">{stats.idle}</span>
                        <span className="stat-card__label">🟡 Idle</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-card__value">{stats.avgTrust}</span>
                        <span className="stat-card__label">Avg Trust</span>
                    </div>
                </div>
            </header>

            {/* Controls */}
            <div className="agents-page__controls">
                {/* View Toggle */}
                <div className="view-toggle">
                    <button
                        className={`view-toggle__btn ${viewMode === 'cards' ? 'view-toggle__btn--active' : ''}`}
                        onClick={() => setViewMode('cards')}
                        title="Card View"
                    >
                        🃏 Cards
                    </button>
                    <button
                        className={`view-toggle__btn ${viewMode === 'table' ? 'view-toggle__btn--active' : ''}`}
                        onClick={() => setViewMode('table')}
                        title="Table View"
                    >
                        📊 Table
                    </button>
                </div>

                <input
                    type="search"
                    placeholder="Search agents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                />
                
                <div className="filter-buttons">
                    {(['all', 'working', 'idle', 'stopped'] as FilterType[]).map(f => (
                        <button
                            key={f}
                            className={`filter-btn ${filter === f ? 'filter-btn--active' : ''}`}
                            onClick={() => setFilter(f)}
                        >
                            {f === 'all' ? 'All' : f === 'working' ? '🟢 Working' : f === 'idle' ? '🟡 Idle' : '🔴 Stopped'}
                        </button>
                    ))}
                </div>

                <select 
                    value={sort} 
                    onChange={(e) => setSort(e.target.value as SortType)}
                    className="sort-select"
                >
                    <option value="tier">Sort by Tier</option>
                    <option value="trust">Sort by Trust</option>
                    <option value="name">Sort by Name</option>
                    <option value="status">Sort by Status</option>
                </select>
            </div>

            {/* Main content */}
            <div className="agents-page__content">
                {viewMode === 'cards' ? (
                    /* Card Grid */
                    <div className="agents-page__grid">
                        {displayedAgents.length === 0 ? (
                            <div className="empty-state">
                                <span className="empty-state__icon">🤖</span>
                                <h3>No agents found</h3>
                                <p>Try adjusting your filters or spawn a new agent.</p>
                            </div>
                        ) : (
                            displayedAgents.map(agent => (
                                <AgentCard
                                    key={agent.id}
                                    agent={agent}
                                    onClick={() => ctx.openAgentDetail(agent.id)}
                                    onQuickAction={async (action) => {
                                        if (action === 'pause') {
                                            await api.pauseAgent(agent.id);
                                        } else if (action === 'resume') {
                                            await api.resumeAgent(agent.id);
                                        }
                                        await ctx.refresh();
                                    }}
                                />
                            ))
                        )}
                    </div>
                ) : (
                    /* Table View */
                    <div className="agent-table-container">
                        <table className="agent-table">
                            <thead>
                                <tr>
                                    <th>Status</th>
                                    <th>Name</th>
                                    <th>Type</th>
                                    <th>Tier</th>
                                    <th>Trust</th>
                                    {capabilityHeaders.map(cap => (
                                        <th key={cap.id} className="cap-header" title={cap.name}>
                                            {cap.icon}
                                        </th>
                                    ))}
                                    <th>Skills</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayedAgents.map(agent => (
                                    <AgentTableRow
                                        key={agent.id}
                                        agent={agent}
                                        onClick={() => ctx.openAgentDetail(agent.id)}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Activity Feed Sidebar */}
                <aside className="agents-page__feed">
                    <h3>📡 Live Activity</h3>
                    <ActivityFeed entries={ctx.blackboardEntries.slice(0, 20)} />
                </aside>
            </div>
        </div>
    );
}

