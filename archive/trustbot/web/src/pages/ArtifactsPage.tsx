/**
 * Artifacts Page - View and manage agent-produced artifacts
 */
import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useArtifacts, artifactApi, type Artifact, type ArtifactType, type ArtifactStatus } from '../api';
import './ArtifactsPage.css';

// Type icons
const TYPE_ICONS: Record<ArtifactType, string> = {
    CODE: '💻',
    DOCUMENT: '📄',
    IMAGE: '🖼️',
    DATA: '📊',
    REPORT: '📋',
    CONFIG: '⚙️',
    LOG: '📝',
    ARCHIVE: '📦',
};

// Status colors
const STATUS_COLORS: Record<ArtifactStatus, string> = {
    DRAFT: '#6b7280',
    PENDING_REVIEW: '#f59e0b',
    APPROVED: '#10b981',
    REJECTED: '#ef4444',
    ARCHIVED: '#8b5cf6',
};

// Format file size
function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Format date
function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function ArtifactsPage() {
    const { artifacts, stats, loading, error, refresh } = useArtifacts();
    const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
    const [contentPreview, setContentPreview] = useState<string | null>(null);
    const [loadingContent, setLoadingContent] = useState(false);
    const [filter, setFilter] = useState<{
        type?: ArtifactType;
        status?: ArtifactStatus;
        search: string;
    }>({ search: '' });

    // Load artifact content for preview
    const loadContent = useCallback(async (artifact: Artifact) => {
        setSelectedArtifact(artifact);
        setContentPreview(null);

        // Only load content for text-based artifacts
        if (artifact.mimeType.startsWith('text/') || artifact.mimeType === 'application/json') {
            setLoadingContent(true);
            try {
                const { content } = await artifactApi.getContent(artifact.id);
                if (typeof content === 'string') {
                    setContentPreview(content);
                }
            } catch (e) {
                console.error('Failed to load content:', e);
            } finally {
                setLoadingContent(false);
            }
        }
    }, []);

    // Download artifact
    const downloadArtifact = useCallback(async (artifact: Artifact) => {
        try {
            const { content, mimeType } = await artifactApi.getContent(artifact.id);
            const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = artifact.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Failed to download:', e);
        }
    }, []);

    // Filter artifacts
    const filteredArtifacts = artifacts.filter(a => {
        if (filter.type && a.type !== filter.type) return false;
        if (filter.status && a.status !== filter.status) return false;
        if (filter.search) {
            const search = filter.search.toLowerCase();
            return (
                a.name.toLowerCase().includes(search) ||
                a.description?.toLowerCase().includes(search) ||
                a.tags.some(t => t.toLowerCase().includes(search))
            );
        }
        return true;
    });

    if (loading && artifacts.length === 0) {
        return (
            <div className="artifacts-page">
                <div className="artifacts-loading">
                    <div className="loading-spinner" />
                    <p>Loading artifacts...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="artifacts-page">
            {/* Header */}
            <header className="artifacts-header">
                <div className="artifacts-title">
                    <h1>📦 Artifacts</h1>
                    <button className="btn-refresh" onClick={refresh} title="Refresh">
                        🔄
                    </button>
                    <div className="header-actions">
                        <Link to="/tasks" className="btn-new-task">
                            ➕ New Task Request
                        </Link>
                    </div>
                </div>

                {stats && (
                    <div className="artifacts-stats">
                        <div className="stat-card">
                            <span className="stat-value">{stats.total}</span>
                            <span className="stat-label">Total</span>
                        </div>
                        <div className="stat-card">
                            <span className="stat-value">{formatSize(stats.totalSizeBytes)}</span>
                            <span className="stat-label">Size</span>
                        </div>
                        {Object.entries(stats.byType).slice(0, 3).map(([type, count]) => (
                            <div key={type} className="stat-card">
                                <span className="stat-value">{count}</span>
                                <span className="stat-label">{TYPE_ICONS[type as ArtifactType]} {type}</span>
                            </div>
                        ))}
                    </div>
                )}
            </header>

            {error && (
                <div className="artifacts-error">
                    <span>⚠️ {error}</span>
                    <button onClick={refresh}>Retry</button>
                </div>
            )}

            {/* Filters */}
            <div className="artifacts-filters">
                <input
                    type="text"
                    className="filter-search"
                    placeholder="Search artifacts..."
                    value={filter.search}
                    onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
                />
                <select
                    className="filter-select"
                    value={filter.type || ''}
                    onChange={e => setFilter(f => ({ ...f, type: e.target.value as ArtifactType || undefined }))}
                >
                    <option value="">All Types</option>
                    {Object.keys(TYPE_ICONS).map(type => (
                        <option key={type} value={type}>{TYPE_ICONS[type as ArtifactType]} {type}</option>
                    ))}
                </select>
                <select
                    className="filter-select"
                    value={filter.status || ''}
                    onChange={e => setFilter(f => ({ ...f, status: e.target.value as ArtifactStatus || undefined }))}
                >
                    <option value="">All Statuses</option>
                    <option value="DRAFT">Draft</option>
                    <option value="PENDING_REVIEW">Pending Review</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="ARCHIVED">Archived</option>
                </select>
            </div>

            {/* Main content */}
            <div className="artifacts-content">
                {/* Artifact list */}
                <div className="artifacts-list">
                    {filteredArtifacts.length === 0 ? (
                        <div className="artifacts-empty">
                            <span className="empty-icon">📭</span>
                            <p>No artifacts found</p>
                            {filter.search || filter.type || filter.status ? (
                                <button onClick={() => setFilter({ search: '' })}>Clear filters</button>
                            ) : (
                                <p className="empty-hint">Artifacts created by agents will appear here</p>
                            )}
                        </div>
                    ) : (
                        filteredArtifacts.map(artifact => (
                            <div
                                key={artifact.id}
                                className={`artifact-card ${selectedArtifact?.id === artifact.id ? 'selected' : ''}`}
                                onClick={() => loadContent(artifact)}
                            >
                                <div className="artifact-icon">
                                    {TYPE_ICONS[artifact.type]}
                                </div>
                                <div className="artifact-info">
                                    <div className="artifact-name">{artifact.name}</div>
                                    <div className="artifact-meta">
                                        <span className="artifact-size">{formatSize(artifact.size)}</span>
                                        <span className="artifact-date">{formatDate(artifact.createdAt)}</span>
                                    </div>
                                    {artifact.tags.length > 0 && (
                                        <div className="artifact-tags">
                                            {artifact.tags.slice(0, 3).map(tag => (
                                                <span key={tag} className="tag">{tag}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="artifact-status">
                                    <span
                                        className="status-badge"
                                        style={{ backgroundColor: STATUS_COLORS[artifact.status] }}
                                    >
                                        {artifact.status.replace('_', ' ')}
                                    </span>
                                    <span className="version-badge">v{artifact.version}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Detail panel */}
                {selectedArtifact && (
                    <div className="artifact-detail">
                        <div className="detail-header">
                            <div className="detail-title">
                                <span className="detail-icon">{TYPE_ICONS[selectedArtifact.type]}</span>
                                <h2>{selectedArtifact.name}</h2>
                            </div>
                            <button
                                className="btn-close"
                                onClick={() => setSelectedArtifact(null)}
                            >
                                ✕
                            </button>
                        </div>

                        <div className="detail-meta">
                            <div className="meta-row">
                                <span className="meta-label">Type</span>
                                <span className="meta-value">{selectedArtifact.type}</span>
                            </div>
                            <div className="meta-row">
                                <span className="meta-label">MIME</span>
                                <span className="meta-value">{selectedArtifact.mimeType}</span>
                            </div>
                            <div className="meta-row">
                                <span className="meta-label">Size</span>
                                <span className="meta-value">{formatSize(selectedArtifact.size)}</span>
                            </div>
                            <div className="meta-row">
                                <span className="meta-label">Created</span>
                                <span className="meta-value">{formatDate(selectedArtifact.createdAt)}</span>
                            </div>
                            <div className="meta-row">
                                <span className="meta-label">Created By</span>
                                <span className="meta-value">{selectedArtifact.createdBy}</span>
                            </div>
                            <div className="meta-row">
                                <span className="meta-label">Version</span>
                                <span className="meta-value">v{selectedArtifact.version}</span>
                            </div>
                            <div className="meta-row">
                                <span className="meta-label">Status</span>
                                <span
                                    className="status-badge"
                                    style={{ backgroundColor: STATUS_COLORS[selectedArtifact.status] }}
                                >
                                    {selectedArtifact.status.replace('_', ' ')}
                                </span>
                            </div>
                            {selectedArtifact.checksum && (
                                <div className="meta-row">
                                    <span className="meta-label">Checksum</span>
                                    <span className="meta-value checksum">{selectedArtifact.checksum.slice(0, 16)}...</span>
                                </div>
                            )}
                        </div>

                        {selectedArtifact.description && (
                            <div className="detail-description">
                                <h3>Description</h3>
                                <p>{selectedArtifact.description}</p>
                            </div>
                        )}

                        {selectedArtifact.tags.length > 0 && (
                            <div className="detail-tags">
                                <h3>Tags</h3>
                                <div className="tags-list">
                                    {selectedArtifact.tags.map(tag => (
                                        <span key={tag} className="tag">{tag}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Content preview */}
                        {(selectedArtifact.mimeType.startsWith('text/') || selectedArtifact.mimeType === 'application/json') && (
                            <div className="detail-content">
                                <h3>Content Preview</h3>
                                {loadingContent ? (
                                    <div className="content-loading">Loading...</div>
                                ) : contentPreview ? (
                                    <pre className="content-preview">{contentPreview}</pre>
                                ) : (
                                    <p className="content-empty">No content available</p>
                                )}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="detail-actions">
                            <button
                                className="btn-primary"
                                onClick={() => downloadArtifact(selectedArtifact)}
                            >
                                ⬇️ Download
                            </button>
                            {selectedArtifact.taskId && (
                                <button className="btn-secondary">
                                    📋 View Task
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
