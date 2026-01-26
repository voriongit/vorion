import Layout from '../components/Layout'
import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface DocFile {
    id: string;
    filename: string;
    path: string;
    extension: string;
    size: number;
    lastModified: string;
    preview: string;
    folder?: string;
}

// File type icons and colors
const FILE_TYPES: Record<string, { icon: string; color: string; label: string }> = {
    md: { icon: '📝', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30', label: 'Markdown' },
    ts: { icon: '🔷', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30', label: 'TypeScript' },
    tsx: { icon: '⚛️', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30', label: 'React TSX' },
    js: { icon: '🟨', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30', label: 'JavaScript' },
    jsx: { icon: '⚛️', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30', label: 'React JSX' },
    json: { icon: '📋', color: 'bg-orange-500/10 text-orange-400 border-orange-500/30', label: 'JSON' },
    yaml: { icon: '⚙️', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30', label: 'YAML' },
    yml: { icon: '⚙️', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30', label: 'YAML' },
    txt: { icon: '📄', color: 'bg-slate-500/10 text-slate-400 border-slate-500/30', label: 'Text' },
    css: { icon: '🎨', color: 'bg-pink-500/10 text-pink-400 border-pink-500/30', label: 'CSS' },
    html: { icon: '🌐', color: 'bg-orange-500/10 text-orange-400 border-orange-500/30', label: 'HTML' },
    sql: { icon: '🗃️', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', label: 'SQL' },
    default: { icon: '📄', color: 'bg-slate-500/10 text-slate-400 border-slate-500/30', label: 'File' },
};

const DEFAULT_FILE_TYPE = { icon: '📄', color: 'bg-slate-500/10 text-slate-400 border-slate-500/30', label: 'File' };

function getFileType(extension: string): { icon: string; color: string; label: string } {
    return FILE_TYPES[extension.toLowerCase()] || DEFAULT_FILE_TYPE;
}

function extractFolder(path: string): string {
    const parts = path.split('/');
    if (parts.length > 1) {
        return parts.slice(0, -1).join('/');
    }
    return 'Root';
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Knowledge() {
    const [docs, setDocs] = useState<DocFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('name');

    useEffect(() => {
        setLoading(true);
        fetch('/api/docs')
            .then(res => res.json())
            .then(data => {
                // Add folder info to each doc
                const docsWithFolders = data.map((doc: DocFile) => ({
                    ...doc,
                    folder: extractFolder(doc.path)
                }));
                setDocs(docsWithFolders);
            })
            .finally(() => setLoading(false));
    }, []);

    // Get unique folders and types
    const folders = useMemo(() => {
        const folderSet = new Set(docs.map(d => d.folder));
        return Array.from(folderSet).sort();
    }, [docs]);

    const fileTypes = useMemo(() => {
        const typeSet = new Set(docs.map(d => d.extension.toLowerCase()));
        return Array.from(typeSet).sort();
    }, [docs]);

    // Filter and sort docs
    const filteredDocs = useMemo(() => {
        let result = docs;

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(doc =>
                doc.filename.toLowerCase().includes(query) ||
                doc.path.toLowerCase().includes(query) ||
                doc.preview?.toLowerCase().includes(query)
            );
        }

        // Folder filter
        if (selectedFolder) {
            result = result.filter(doc => doc.folder === selectedFolder);
        }

        // Type filter
        if (selectedType) {
            result = result.filter(doc => doc.extension.toLowerCase() === selectedType);
        }

        // Sort
        result = [...result].sort((a, b) => {
            switch (sortBy) {
                case 'date':
                    return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
                case 'size':
                    return b.size - a.size;
                default:
                    return a.filename.localeCompare(b.filename);
            }
        });

        return result;
    }, [docs, searchQuery, selectedFolder, selectedType, sortBy]);

    // Stats
    const stats = useMemo(() => ({
        total: docs.length,
        filtered: filteredDocs.length,
        totalSize: docs.reduce((sum, d) => sum + d.size, 0),
    }), [docs, filteredDocs]);

    return (
        <Layout title="Knowledge">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
                        Knowledge Base
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        {stats.filtered} of {stats.total} documents • {formatSize(stats.totalSize)} total
                    </p>
                </div>

                {/* View Controls */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                        </svg>
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Search & Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                {/* Search */}
                <div className="relative flex-1">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search documents..."
                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Folder Filter */}
                <select
                    value={selectedFolder || ''}
                    onChange={(e) => setSelectedFolder(e.target.value || null)}
                    className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 min-w-[150px]"
                >
                    <option value="" className="bg-[#0a0a0a]">All Folders</option>
                    {folders.map(folder => (
                        <option key={folder} value={folder} className="bg-[#0a0a0a]">
                            {folder}
                        </option>
                    ))}
                </select>

                {/* Type Filter */}
                <select
                    value={selectedType || ''}
                    onChange={(e) => setSelectedType(e.target.value || null)}
                    className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 min-w-[130px]"
                >
                    <option value="" className="bg-[#0a0a0a]">All Types</option>
                    {fileTypes.map(type => (
                        <option key={type} value={type} className="bg-[#0a0a0a]">
                            {getFileType(type).label} (.{type})
                        </option>
                    ))}
                </select>

                {/* Sort */}
                <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'name' | 'date' | 'size')}
                    className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 min-w-[120px]"
                >
                    <option value="name" className="bg-[#0a0a0a]">Sort: Name</option>
                    <option value="date" className="bg-[#0a0a0a]">Sort: Date</option>
                    <option value="size" className="bg-[#0a0a0a]">Sort: Size</option>
                </select>
            </div>

            {/* Active Filters */}
            {(selectedFolder || selectedType || searchQuery) && (
                <div className="flex flex-wrap items-center gap-2 mb-6">
                    <span className="text-xs text-slate-500">Filters:</span>
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="flex items-center gap-1 px-2 py-1 bg-indigo-500/20 text-indigo-400 text-xs rounded-full hover:bg-indigo-500/30"
                        >
                            Search: "{searchQuery}"
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                    {selectedFolder && (
                        <button
                            onClick={() => setSelectedFolder(null)}
                            className="flex items-center gap-1 px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full hover:bg-purple-500/30"
                        >
                            Folder: {selectedFolder}
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                    {selectedType && (
                        <button
                            onClick={() => setSelectedType(null)}
                            className="flex items-center gap-1 px-2 py-1 bg-cyan-500/20 text-cyan-400 text-xs rounded-full hover:bg-cyan-500/30"
                        >
                            Type: .{selectedType}
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                    <button
                        onClick={() => {
                            setSearchQuery('');
                            setSelectedFolder(null);
                            setSelectedType(null);
                        }}
                        className="text-xs text-slate-500 hover:text-slate-300 ml-2"
                    >
                        Clear all
                    </button>
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="animate-pulse bg-white/5 h-40 rounded-xl" />
                    ))}
                </div>
            )}

            {/* Empty State */}
            {!loading && filteredDocs.length === 0 && (
                <div className="text-center py-20 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                    {docs.length === 0 ? (
                        <>
                            <div className="text-4xl mb-4">📚</div>
                            <p>No documents indexed.</p>
                            <p className="text-sm mt-2">
                                Run <code className="bg-slate-800 px-2 py-1 rounded">npx librarian index</code> to populate.
                            </p>
                        </>
                    ) : (
                        <>
                            <div className="text-4xl mb-4">🔍</div>
                            <p>No documents match your filters.</p>
                            <button
                                onClick={() => {
                                    setSearchQuery('');
                                    setSelectedFolder(null);
                                    setSelectedType(null);
                                }}
                                className="text-sm text-indigo-400 hover:text-indigo-300 mt-2"
                            >
                                Clear filters
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Grid View */}
            {!loading && viewMode === 'grid' && filteredDocs.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    <AnimatePresence mode="popLayout">
                        {filteredDocs.map((doc) => {
                            const fileType = getFileType(doc.extension);
                            return (
                                <motion.div
                                    key={doc.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className={`bg-slate-800/50 border border-white/5 rounded-xl p-4 hover:bg-slate-800 transition-all cursor-pointer group ${fileType.color.split(' ')[0]}`}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div className={`p-2 rounded-lg ${fileType.color}`}>
                                            <span className="text-xl">{fileType.icon}</span>
                                        </div>
                                        <span className="text-[10px] text-slate-500 font-mono uppercase">
                                            {doc.extension}
                                        </span>
                                    </div>
                                    <h3 className="font-semibold text-sm mb-1 group-hover:text-indigo-400 transition-colors truncate" title={doc.path}>
                                        {doc.filename}
                                    </h3>
                                    <p className="text-xs text-slate-500 truncate mb-2" title={doc.folder}>
                                        {doc.folder}
                                    </p>
                                    {doc.preview && (
                                        <p className="text-xs text-slate-400 line-clamp-2 mb-3">
                                            {doc.preview}
                                        </p>
                                    )}
                                    <div className="text-[10px] text-slate-600 flex justify-between">
                                        <span>{formatSize(doc.size)}</span>
                                        <span>{new Date(doc.lastModified).toLocaleDateString()}</span>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}

            {/* List View */}
            {!loading && viewMode === 'list' && filteredDocs.length > 0 && (
                <div className="bg-slate-800/30 border border-white/5 rounded-xl overflow-hidden">
                    <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 bg-white/5 text-xs text-slate-500 font-medium uppercase">
                        <div className="col-span-5">Name</div>
                        <div className="col-span-3">Folder</div>
                        <div className="col-span-2">Size</div>
                        <div className="col-span-2">Modified</div>
                    </div>
                    <AnimatePresence mode="popLayout">
                        {filteredDocs.map((doc) => {
                            const fileType = getFileType(doc.extension);
                            return (
                                <motion.div
                                    key={doc.id}
                                    layout
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-4 py-3 border-t border-white/5 hover:bg-white/5 transition-colors cursor-pointer group"
                                >
                                    <div className="md:col-span-5 flex items-center gap-3">
                                        <span className="text-lg">{fileType.icon}</span>
                                        <div className="min-w-0">
                                            <div className="font-medium text-sm group-hover:text-indigo-400 transition-colors truncate">
                                                {doc.filename}
                                            </div>
                                            <div className="text-xs text-slate-500 md:hidden">
                                                {doc.folder}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="hidden md:flex md:col-span-3 items-center text-sm text-slate-400 truncate">
                                        {doc.folder}
                                    </div>
                                    <div className="md:col-span-2 flex items-center text-sm text-slate-500">
                                        {formatSize(doc.size)}
                                    </div>
                                    <div className="md:col-span-2 flex items-center text-sm text-slate-500">
                                        {new Date(doc.lastModified).toLocaleDateString()}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}
        </Layout>
    )
}
