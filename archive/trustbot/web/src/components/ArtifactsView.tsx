/**
 * ArtifactsView - Comprehensive File/Artifact Management
 *
 * View, download, edit, organize artifacts produced by agents.
 * Supports categorization, tagging, versioning, and agent access control.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../api';

// Artifact types (matching backend)
type ArtifactType = 'CODE' | 'DOCUMENT' | 'IMAGE' | 'DATA' | 'REPORT' | 'CONFIG' | 'LOG' | 'ARCHIVE';
type ArtifactStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';

interface Artifact {
    id: string;
    name: string;
    type: ArtifactType;
    mimeType: string;
    content?: string;
    storagePath?: string;
    storageUrl?: string;
    size: number;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    taskId?: string;
    visibility: string;
    status: ArtifactStatus;
    tags: string[];
    description?: string;
    version: number;
    isLatest: boolean;
}

interface ArtifactsViewProps {
    onClose: () => void;
}

const TYPE_ICONS: Record<ArtifactType, string> = {
    CODE: '💻',
    DOCUMENT: '📄',
    IMAGE: '🖼️',
    DATA: '📊',
    REPORT: '📋',
    CONFIG: '⚙️',
    LOG: '📜',
    ARCHIVE: '📦',
};

const STATUS_STYLES: Record<ArtifactStatus, { bg: string; color: string; label: string }> = {
    DRAFT: { bg: 'rgba(156, 163, 175, 0.2)', color: 'var(--text-muted)', label: 'Draft' },
    PENDING_REVIEW: { bg: 'rgba(245, 158, 11, 0.2)', color: 'var(--accent-gold)', label: 'Pending' },
    APPROVED: { bg: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-green)', label: 'Approved' },
    REJECTED: { bg: 'rgba(239, 68, 68, 0.2)', color: 'var(--accent-red)', label: 'Rejected' },
    ARCHIVED: { bg: 'rgba(107, 114, 128, 0.2)', color: 'var(--text-muted)', label: 'Archived' },
};

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

export const ArtifactsView: React.FC<ArtifactsViewProps> = ({ onClose }) => {
    const [artifacts, setArtifacts] = useState<Artifact[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
    const [showUpload, setShowUpload] = useState(false);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<ArtifactType | 'ALL'>('ALL');
    const [statusFilter, setStatusFilter] = useState<ArtifactStatus | 'ALL'>('ALL');
    const [sortBy, setSortBy] = useState<'createdAt' | 'name' | 'size'>('createdAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // Upload state
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadName, setUploadName] = useState('');
    const [uploadDescription, setUploadDescription] = useState('');
    const [uploadTags, setUploadTags] = useState('');
    const [uploading, setUploading] = useState(false);

    const fetchArtifacts = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params: Record<string, string> = {
                latestOnly: 'true',
                sortBy,
                sortOrder,
                limit: '100',
            };
            if (typeFilter !== 'ALL') params.type = typeFilter;
            if (statusFilter !== 'ALL') params.status = statusFilter;

            const queryString = new URLSearchParams(params).toString();
            const response = await fetch(`${API_URL}/api/artifacts?${queryString}`);

            if (!response.ok) {
                if (response.status === 503) {
                    setError('Artifact storage not configured. Supabase required.');
                    setArtifacts([]);
                    return;
                }
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            setArtifacts(data.artifacts || []);
        } catch (e: any) {
            setError(e.message || 'Failed to load artifacts');
            setArtifacts([]);
        } finally {
            setLoading(false);
        }
    }, [typeFilter, statusFilter, sortBy, sortOrder]);

    useEffect(() => {
        fetchArtifacts();
    }, [fetchArtifacts]);

    // Filter artifacts by search query
    const filteredArtifacts = artifacts.filter(a => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            a.name.toLowerCase().includes(query) ||
            a.description?.toLowerCase().includes(query) ||
            a.tags.some(t => t.toLowerCase().includes(query)) ||
            a.createdBy.toLowerCase().includes(query)
        );
    });

    const handleDownload = async (artifact: Artifact) => {
        try {
            const response = await fetch(`${API_URL}/api/artifacts/${artifact.id}/content`);
            if (!response.ok) throw new Error('Download failed');

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = artifact.name;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e: any) {
            alert('Download failed: ' + e.message);
        }
    };

    const handleDelete = async (artifact: Artifact) => {
        if (!confirm(`Delete "${artifact.name}"? This cannot be undone.`)) return;

        try {
            const response = await fetch(`${API_URL}/api/artifacts/${artifact.id}`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Delete failed');

            setArtifacts(prev => prev.filter(a => a.id !== artifact.id));
            setSelectedArtifact(null);
        } catch (e: any) {
            alert('Delete failed: ' + e.message);
        }
    };

    const handleUpload = async () => {
        if (!uploadFile) return;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', uploadFile);
            formData.append('metadata', JSON.stringify({
                name: uploadName || uploadFile.name,
                description: uploadDescription,
                tags: uploadTags.split(',').map(t => t.trim()).filter(Boolean),
                createdBy: 'HITL-USER',
                visibility: 'PUBLIC',
            }));

            const response = await fetch(`${API_URL}/api/artifacts`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) throw new Error('Upload failed');

            await fetchArtifacts();
            setShowUpload(false);
            setUploadFile(null);
            setUploadName('');
            setUploadDescription('');
            setUploadTags('');
        } catch (e: any) {
            alert('Upload failed: ' + e.message);
        } finally {
            setUploading(false);
        }
    };

    // Aggregate stats
    const stats = {
        total: artifacts.length,
        byType: Object.entries(
            artifacts.reduce((acc, a) => ({ ...acc, [a.type]: (acc[a.type] || 0) + 1 }), {} as Record<string, number>)
        ).sort((a, b) => b[1] - a[1]).slice(0, 4),
        totalSize: artifacts.reduce((sum, a) => sum + a.size, 0),
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div
                className="modal-content"
                style={{
                    width: '95vw',
                    maxWidth: '1400px',
                    height: '90vh',
                    maxHeight: '900px',
                    display: 'flex',
                    flexDirection: 'column',
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--border-color)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.5rem' }}>📦</span>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Artifacts</h2>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {stats.total} files • {formatBytes(stats.totalSize)} total
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                            onClick={() => setShowUpload(true)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 14px',
                                background: 'var(--accent-blue)',
                                border: 'none',
                                borderRadius: 'var(--radius-sm)',
                                color: 'white',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            <span>⬆️</span> Upload
                        </button>
                        <button onClick={onClose} className="modal-close-btn">✕</button>
                    </div>
                </div>

                {/* Toolbar */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 20px',
                    borderBottom: '1px solid var(--border-color)',
                    flexWrap: 'wrap',
                }}>
                    {/* Search */}
                    <div style={{ flex: '1 1 200px', minWidth: '200px' }}>
                        <input
                            type="text"
                            placeholder="Search artifacts..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-sm)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                            }}
                        />
                    </div>

                    {/* Type filter */}
                    <select
                        value={typeFilter}
                        onChange={e => setTypeFilter(e.target.value as any)}
                        style={{
                            padding: '8px 12px',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem',
                        }}
                    >
                        <option value="ALL">All Types</option>
                        <option value="CODE">💻 Code</option>
                        <option value="DOCUMENT">📄 Documents</option>
                        <option value="IMAGE">🖼️ Images</option>
                        <option value="DATA">📊 Data</option>
                        <option value="REPORT">📋 Reports</option>
                        <option value="CONFIG">⚙️ Config</option>
                        <option value="LOG">📜 Logs</option>
                        <option value="ARCHIVE">📦 Archives</option>
                    </select>

                    {/* Status filter */}
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value as any)}
                        style={{
                            padding: '8px 12px',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem',
                        }}
                    >
                        <option value="ALL">All Status</option>
                        <option value="DRAFT">Draft</option>
                        <option value="PENDING_REVIEW">Pending Review</option>
                        <option value="APPROVED">Approved</option>
                        <option value="REJECTED">Rejected</option>
                        <option value="ARCHIVED">Archived</option>
                    </select>

                    {/* Sort */}
                    <select
                        value={`${sortBy}-${sortOrder}`}
                        onChange={e => {
                            const [by, order] = e.target.value.split('-');
                            setSortBy(by as any);
                            setSortOrder(order as any);
                        }}
                        style={{
                            padding: '8px 12px',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem',
                        }}
                    >
                        <option value="createdAt-desc">Newest First</option>
                        <option value="createdAt-asc">Oldest First</option>
                        <option value="name-asc">Name A-Z</option>
                        <option value="name-desc">Name Z-A</option>
                        <option value="size-desc">Largest First</option>
                        <option value="size-asc">Smallest First</option>
                    </select>

                    {/* View mode toggle */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                            onClick={() => setViewMode('grid')}
                            style={{
                                padding: '8px 10px',
                                background: viewMode === 'grid' ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-sm) 0 0 var(--radius-sm)',
                                color: viewMode === 'grid' ? 'white' : 'var(--text-primary)',
                                cursor: 'pointer',
                            }}
                        >
                            ▦
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            style={{
                                padding: '8px 10px',
                                background: viewMode === 'list' ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                                color: viewMode === 'list' ? 'white' : 'var(--text-primary)',
                                cursor: 'pointer',
                            }}
                        >
                            ☰
                        </button>
                    </div>

                    {/* Refresh */}
                    <button
                        onClick={fetchArtifacts}
                        style={{
                            padding: '8px 10px',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                        }}
                    >
                        🔄
                    </button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⏳</div>
                            Loading artifacts...
                        </div>
                    ) : error ? (
                        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⚠️</div>
                            <p>{error}</p>
                            <button
                                onClick={fetchArtifacts}
                                style={{
                                    marginTop: '12px',
                                    padding: '8px 16px',
                                    background: 'var(--accent-blue)',
                                    border: 'none',
                                    borderRadius: 'var(--radius-sm)',
                                    color: 'white',
                                    cursor: 'pointer',
                                }}
                            >
                                Retry
                            </button>
                        </div>
                    ) : filteredArtifacts.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📭</div>
                            <h3 style={{ margin: '0 0 8px' }}>No Artifacts Yet</h3>
                            <p style={{ margin: '0 0 20px', fontSize: '0.9rem' }}>
                                Artifacts are files and deliverables produced by agents.
                                <br />Upload files or let agents create them during task execution.
                            </p>
                            <button
                                onClick={() => setShowUpload(true)}
                                style={{
                                    padding: '10px 20px',
                                    background: 'var(--accent-blue)',
                                    border: 'none',
                                    borderRadius: 'var(--radius-md)',
                                    color: 'white',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                ⬆️ Upload First Artifact
                            </button>
                        </div>
                    ) : viewMode === 'grid' ? (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                            gap: '16px',
                        }}>
                            {filteredArtifacts.map(artifact => (
                                <div
                                    key={artifact.id}
                                    onClick={() => setSelectedArtifact(artifact)}
                                    style={{
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-md)',
                                        padding: '16px',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                    }}
                                    onMouseOver={e => {
                                        e.currentTarget.style.borderColor = 'var(--accent-blue)';
                                        e.currentTarget.style.background = 'var(--bg-card-hover)';
                                    }}
                                    onMouseOut={e => {
                                        e.currentTarget.style.borderColor = 'var(--border-color)';
                                        e.currentTarget.style.background = 'var(--bg-secondary)';
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                        <span style={{ fontSize: '2rem' }}>{TYPE_ICONS[artifact.type]}</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{
                                                fontWeight: 600,
                                                fontSize: '0.9rem',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                            }}>
                                                {artifact.name}
                                            </div>
                                            <div style={{
                                                fontSize: '0.75rem',
                                                color: 'var(--text-muted)',
                                                marginTop: '2px',
                                            }}>
                                                {formatBytes(artifact.size)} • {formatDate(artifact.createdAt)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Status badge */}
                                    <div style={{
                                        display: 'inline-block',
                                        marginTop: '10px',
                                        padding: '2px 8px',
                                        background: STATUS_STYLES[artifact.status].bg,
                                        color: STATUS_STYLES[artifact.status].color,
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: '0.7rem',
                                        fontWeight: 600,
                                    }}>
                                        {STATUS_STYLES[artifact.status].label}
                                    </div>

                                    {/* Tags */}
                                    {artifact.tags.length > 0 && (
                                        <div style={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: '4px',
                                            marginTop: '8px',
                                        }}>
                                            {artifact.tags.slice(0, 3).map(tag => (
                                                <span
                                                    key={tag}
                                                    style={{
                                                        padding: '2px 6px',
                                                        background: 'var(--bg-tertiary)',
                                                        borderRadius: 'var(--radius-sm)',
                                                        fontSize: '0.65rem',
                                                        color: 'var(--text-muted)',
                                                    }}
                                                >
                                                    #{tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{
                            background: 'var(--bg-secondary)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-color)',
                            overflow: 'hidden',
                        }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{
                                        background: 'var(--bg-tertiary)',
                                        fontSize: '0.75rem',
                                        color: 'var(--text-muted)',
                                        textTransform: 'uppercase',
                                    }}>
                                        <th style={{ padding: '10px 12px', textAlign: 'left' }}>Name</th>
                                        <th style={{ padding: '10px 12px', textAlign: 'left' }}>Type</th>
                                        <th style={{ padding: '10px 12px', textAlign: 'left' }}>Size</th>
                                        <th style={{ padding: '10px 12px', textAlign: 'left' }}>Status</th>
                                        <th style={{ padding: '10px 12px', textAlign: 'left' }}>Created</th>
                                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredArtifacts.map(artifact => (
                                        <tr
                                            key={artifact.id}
                                            style={{
                                                borderTop: '1px solid var(--border-color)',
                                                cursor: 'pointer',
                                            }}
                                            onClick={() => setSelectedArtifact(artifact)}
                                            onMouseOver={e => {
                                                e.currentTarget.style.background = 'var(--bg-card-hover)';
                                            }}
                                            onMouseOut={e => {
                                                e.currentTarget.style.background = '';
                                            }}
                                        >
                                            <td style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span>{TYPE_ICONS[artifact.type]}</span>
                                                <span style={{ fontWeight: 500 }}>{artifact.name}</span>
                                            </td>
                                            <td style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                {artifact.type}
                                            </td>
                                            <td style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                {formatBytes(artifact.size)}
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                                <span style={{
                                                    padding: '2px 8px',
                                                    background: STATUS_STYLES[artifact.status].bg,
                                                    color: STATUS_STYLES[artifact.status].color,
                                                    borderRadius: 'var(--radius-sm)',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                }}>
                                                    {STATUS_STYLES[artifact.status].label}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                {formatDate(artifact.createdAt)}
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'right' }}>
                                                <button
                                                    onClick={e => {
                                                        e.stopPropagation();
                                                        handleDownload(artifact);
                                                    }}
                                                    style={{
                                                        padding: '4px 8px',
                                                        background: 'var(--bg-tertiary)',
                                                        border: '1px solid var(--border-color)',
                                                        borderRadius: 'var(--radius-sm)',
                                                        color: 'var(--text-primary)',
                                                        cursor: 'pointer',
                                                        marginRight: '4px',
                                                    }}
                                                >
                                                    ⬇️
                                                </button>
                                                <button
                                                    onClick={e => {
                                                        e.stopPropagation();
                                                        handleDelete(artifact);
                                                    }}
                                                    style={{
                                                        padding: '4px 8px',
                                                        background: 'rgba(239, 68, 68, 0.1)',
                                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                                        borderRadius: 'var(--radius-sm)',
                                                        color: 'var(--accent-red)',
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    🗑️
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Detail panel */}
                {selectedArtifact && (
                    <div
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0, 0, 0, 0.7)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1100,
                        }}
                        onClick={() => setSelectedArtifact(null)}
                    >
                        <div
                            style={{
                                background: 'var(--bg-primary)',
                                borderRadius: 'var(--radius-lg)',
                                padding: '24px',
                                maxWidth: '600px',
                                width: '90%',
                                maxHeight: '80vh',
                                overflow: 'auto',
                            }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '20px' }}>
                                <span style={{ fontSize: '3rem' }}>{TYPE_ICONS[selectedArtifact.type]}</span>
                                <div style={{ flex: 1 }}>
                                    <h2 style={{ margin: '0 0 4px', fontSize: '1.2rem' }}>{selectedArtifact.name}</h2>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                        {selectedArtifact.mimeType} • {formatBytes(selectedArtifact.size)}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedArtifact(null)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text-muted)',
                                        fontSize: '1.5rem',
                                        cursor: 'pointer',
                                    }}
                                >
                                    ✕
                                </button>
                            </div>

                            {selectedArtifact.description && (
                                <p style={{
                                    margin: '0 0 16px',
                                    padding: '12px',
                                    background: 'var(--bg-secondary)',
                                    borderRadius: 'var(--radius-md)',
                                    fontSize: '0.9rem',
                                }}>
                                    {selectedArtifact.description}
                                </p>
                            )}

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(2, 1fr)',
                                gap: '12px',
                                marginBottom: '20px',
                            }}>
                                <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>STATUS</div>
                                    <span style={{
                                        padding: '4px 10px',
                                        background: STATUS_STYLES[selectedArtifact.status].bg,
                                        color: STATUS_STYLES[selectedArtifact.status].color,
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                    }}>
                                        {STATUS_STYLES[selectedArtifact.status].label}
                                    </span>
                                </div>
                                <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>VERSION</div>
                                    <span style={{ fontSize: '0.9rem' }}>v{selectedArtifact.version}</span>
                                    {selectedArtifact.isLatest && (
                                        <span style={{
                                            marginLeft: '8px',
                                            padding: '2px 6px',
                                            background: 'rgba(16, 185, 129, 0.2)',
                                            color: 'var(--accent-green)',
                                            borderRadius: 'var(--radius-sm)',
                                            fontSize: '0.7rem',
                                        }}>
                                            Latest
                                        </span>
                                    )}
                                </div>
                                <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>CREATED BY</div>
                                    <span style={{ fontSize: '0.9rem' }}>{selectedArtifact.createdBy}</span>
                                </div>
                                <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>CREATED</div>
                                    <span style={{ fontSize: '0.9rem' }}>{new Date(selectedArtifact.createdAt).toLocaleString()}</span>
                                </div>
                            </div>

                            {selectedArtifact.tags.length > 0 && (
                                <div style={{ marginBottom: '20px' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>TAGS</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {selectedArtifact.tags.map(tag => (
                                            <span
                                                key={tag}
                                                style={{
                                                    padding: '4px 10px',
                                                    background: 'var(--bg-tertiary)',
                                                    borderRadius: 'var(--radius-sm)',
                                                    fontSize: '0.8rem',
                                                }}
                                            >
                                                #{tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Preview for text content */}
                            {selectedArtifact.content && (
                                <div style={{ marginBottom: '20px' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>PREVIEW</div>
                                    <pre style={{
                                        padding: '12px',
                                        background: 'var(--bg-secondary)',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: '0.8rem',
                                        maxHeight: '200px',
                                        overflow: 'auto',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                    }}>
                                        {selectedArtifact.content.slice(0, 2000)}
                                        {selectedArtifact.content.length > 2000 && '...'}
                                    </pre>
                                </div>
                            )}

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => handleDelete(selectedArtifact)}
                                    style={{
                                        padding: '10px 16px',
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        borderRadius: 'var(--radius-md)',
                                        color: 'var(--accent-red)',
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                    }}
                                >
                                    🗑️ Delete
                                </button>
                                <button
                                    onClick={() => handleDownload(selectedArtifact)}
                                    style={{
                                        padding: '10px 20px',
                                        background: 'var(--accent-blue)',
                                        border: 'none',
                                        borderRadius: 'var(--radius-md)',
                                        color: 'white',
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                    }}
                                >
                                    ⬇️ Download
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Upload modal */}
                {showUpload && (
                    <div
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0, 0, 0, 0.7)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1100,
                        }}
                        onClick={() => setShowUpload(false)}
                    >
                        <div
                            style={{
                                background: 'var(--bg-primary)',
                                borderRadius: 'var(--radius-lg)',
                                padding: '24px',
                                maxWidth: '500px',
                                width: '90%',
                            }}
                            onClick={e => e.stopPropagation()}
                        >
                            <h2 style={{ margin: '0 0 20px', fontSize: '1.2rem' }}>⬆️ Upload Artifact</h2>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-muted)' }}>
                                    File
                                </label>
                                <input
                                    type="file"
                                    onChange={e => setUploadFile(e.target.files?.[0] || null)}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-md)',
                                        color: 'var(--text-primary)',
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-muted)' }}>
                                    Name (optional)
                                </label>
                                <input
                                    type="text"
                                    value={uploadName}
                                    onChange={e => setUploadName(e.target.value)}
                                    placeholder="Leave blank to use filename"
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-md)',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.9rem',
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-muted)' }}>
                                    Description (optional)
                                </label>
                                <textarea
                                    value={uploadDescription}
                                    onChange={e => setUploadDescription(e.target.value)}
                                    placeholder="What is this artifact for?"
                                    rows={2}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-md)',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.9rem',
                                        resize: 'none',
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-muted)' }}>
                                    Tags (comma-separated)
                                </label>
                                <input
                                    type="text"
                                    value={uploadTags}
                                    onChange={e => setUploadTags(e.target.value)}
                                    placeholder="docs, api, v1"
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-md)',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.9rem',
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => setShowUpload(false)}
                                    style={{
                                        padding: '10px 16px',
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-md)',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleUpload}
                                    disabled={!uploadFile || uploading}
                                    style={{
                                        padding: '10px 20px',
                                        background: uploadFile && !uploading ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
                                        border: 'none',
                                        borderRadius: 'var(--radius-md)',
                                        color: uploadFile && !uploading ? 'white' : 'var(--text-muted)',
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        cursor: uploadFile && !uploading ? 'pointer' : 'not-allowed',
                                    }}
                                >
                                    {uploading ? 'Uploading...' : '⬆️ Upload'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ArtifactsView;
