import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface CommandEntry {
    id: string;
    command: string;
    response: string;
    agent: string;
    success: boolean;
    timestamp: number;
    duration?: number;
    tags?: string[];
}

interface CommandHistoryResponse {
    entries: CommandEntry[];
    total: number;
    hasMore: boolean;
}

interface CommandHistoryProps {
    isOpen: boolean;
    onClose: () => void;
    onReplay: (command: string) => void;
}

const AGENT_COLORS: Record<string, string> = {
    herald: 'text-indigo-400',
    sentinel: 'text-blue-400',
    watchman: 'text-emerald-400',
    envoy: 'text-pink-400',
    scribe: 'text-purple-400',
    librarian: 'text-amber-400',
    curator: 'text-cyan-400',
    'ts-fixer': 'text-yellow-400',
};

function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
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

export function CommandHistory({ isOpen, onClose, onReplay }: CommandHistoryProps) {
    const [search, setSearch] = useState('');
    const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(timer);
    }, [search]);

    // Build query URL
    const queryParams = new URLSearchParams();
    if (debouncedSearch) queryParams.set('search', debouncedSearch);
    if (selectedAgent) queryParams.set('agent', selectedAgent);
    queryParams.set('limit', '50');

    const { data, mutate } = useSWR<CommandHistoryResponse>(
        isOpen ? `/api/command-history?${queryParams.toString()}` : null,
        fetcher
    );

    const handleReplay = useCallback((command: string) => {
        onReplay(command);
        onClose();
    }, [onReplay, onClose]);

    const handleDelete = async (id: string) => {
        await fetch(`/api/command-history?id=${id}`, { method: 'DELETE' });
        mutate();
    };

    const handleClearAll = async () => {
        if (confirm('Clear all command history?')) {
            await fetch('/api/command-history', { method: 'DELETE' });
            mutate();
        }
    };

    if (!isOpen) return null;

    const agents = Array.from(new Set(data?.entries.map(e => e.agent) || []));

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    onClick={e => e.stopPropagation()}
                    className="bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
                >
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-slate-200">Command History</h2>
                            <p className="text-sm text-slate-500 mt-1">
                                {data?.total || 0} commands
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleClearAll}
                                className="text-xs text-slate-500 hover:text-red-400 transition-colors px-2 py-1"
                            >
                                Clear All
                            </button>
                            <button
                                onClick={onClose}
                                className="text-slate-400 hover:text-white transition-colors p-1"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Search & Filters */}
                    <div className="px-6 py-3 border-b border-white/5 space-y-3">
                        <div className="relative">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search commands..."
                                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
                            />
                        </div>

                        {/* Agent Filters */}
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setSelectedAgent(null)}
                                className={`px-2 py-1 text-xs rounded transition-colors ${!selectedAgent ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                            >
                                All
                            </button>
                            {agents.map(agent => (
                                <button
                                    key={agent}
                                    onClick={() => setSelectedAgent(agent)}
                                    className={`px-2 py-1 text-xs rounded transition-colors ${selectedAgent === agent ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                                >
                                    {agent}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Command List */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {data?.entries.length === 0 ? (
                            <div className="p-12 text-center">
                                <div className="text-4xl mb-4">
                                    <svg className="w-12 h-12 mx-auto text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div className="text-slate-500">No commands found</div>
                                <div className="text-xs text-slate-600 mt-1">
                                    {search ? 'Try a different search term' : 'Start typing commands in the console'}
                                </div>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {data?.entries.map(entry => (
                                    <div
                                        key={entry.id}
                                        className="px-6 py-4 hover:bg-white/5 transition-colors group"
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-xs font-bold uppercase ${AGENT_COLORS[entry.agent] || 'text-slate-400'}`}>
                                                        {entry.agent}
                                                    </span>
                                                    <span className="text-xs text-slate-600">
                                                        {formatTime(entry.timestamp)}
                                                    </span>
                                                    {!entry.success && (
                                                        <span className="text-xs text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                                                            Failed
                                                        </span>
                                                    )}
                                                    {entry.duration && (
                                                        <span className="text-xs text-slate-600">
                                                            {entry.duration}ms
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="font-mono text-sm text-slate-300 truncate">
                                                    {entry.command}
                                                </div>
                                                {entry.response && (
                                                    <div className="text-xs text-slate-500 mt-1 truncate">
                                                        {entry.response.slice(0, 100)}...
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleReplay(entry.command)}
                                                    className="p-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-white transition-colors"
                                                    title="Replay command"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => navigator.clipboard.writeText(entry.command)}
                                                    className="p-1.5 bg-white/10 hover:bg-white/20 rounded text-slate-400 transition-colors"
                                                    title="Copy command"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(entry.id)}
                                                    className="p-1.5 bg-white/10 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-400 transition-colors"
                                                    title="Delete"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-500">
                        <span>Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-slate-400">Esc</kbd> to close</span>
                        {data?.hasMore && (
                            <span>Showing {data.entries.length} of {data.total}</span>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

// Hook to save commands to history
export function useSaveToHistory() {
    return async (command: string, response: string, agent: string, success: boolean, duration?: number) => {
        try {
            await fetch('/api/command-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command, response, agent, success, duration }),
            });
        } catch (e) {
            console.error('Failed to save command to history:', e);
        }
    };
}
