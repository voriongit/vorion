import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';

interface Command {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'navigation' | 'agent' | 'action';
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onRunAgent?: (agent: string, command: string) => void;
}

export function CommandPalette({ isOpen, onClose, onRunAgent }: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const commands: Command[] = [
    // Navigation
    { id: 'nav-dashboard', name: 'Dashboard', description: 'Go to main dashboard', icon: '⚡', category: 'navigation', action: () => router.push('/') },
    { id: 'nav-console', name: 'Console', description: 'Open agent console', icon: '💬', category: 'navigation', action: () => router.push('/console') },
    { id: 'nav-knowledge', name: 'Knowledge', description: 'Browse knowledge base', icon: '📚', category: 'navigation', action: () => router.push('/knowledge') },
    { id: 'nav-schedules', name: 'Schedules', description: 'Manage schedules', icon: '⏱️', category: 'navigation', action: () => router.push('/schedules') },
    { id: 'nav-governance', name: 'Governance', description: 'Council chamber', icon: '⚖️', category: 'navigation', action: () => router.push('/governance') },

    // Agent Actions
    { id: 'agent-sentinel', name: 'Run Sentinel Audit', description: 'Audit policy compliance', icon: '🛡️', category: 'agent', action: () => onRunAgent?.('sentinel', 'audit') },
    { id: 'agent-scribe', name: 'Run Scribe Mapping', description: 'Map architecture', icon: '📝', category: 'agent', action: () => onRunAgent?.('scribe', 'map') },
    { id: 'agent-envoy', name: 'Run Envoy Planning', description: 'Generate content plan', icon: '📣', category: 'agent', action: () => onRunAgent?.('envoy', 'plan') },
    { id: 'agent-curator', name: 'Run Curator Scan', description: 'Clean workspaces', icon: '🧹', category: 'agent', action: () => onRunAgent?.('curator', 'scan') },
    { id: 'agent-watchman', name: 'Run Watchman Monitor', description: 'Check system health', icon: '👁️', category: 'agent', action: () => onRunAgent?.('watchman', 'monitor') },
    { id: 'agent-librarian', name: 'Run Librarian Index', description: 'Index documentation', icon: '📖', category: 'agent', action: () => onRunAgent?.('librarian', 'index') },

    // Actions
    { id: 'action-swarm', name: 'Initialize Swarm', description: 'Start all agents', icon: '🚀', category: 'action', action: () => {
      onRunAgent?.('watchman', 'monitor');
      setTimeout(() => onRunAgent?.('curator', 'scan'), 1000);
      setTimeout(() => onRunAgent?.('sentinel', 'audit'), 2000);
    }},
  ];

  const filteredCommands = commands.filter(cmd =>
    cmd.name.toLowerCase().includes(search.toLowerCase()) ||
    cmd.description.toLowerCase().includes(search.toLowerCase())
  );

  const executeCommand = useCallback((command: Command) => {
    command.action();
    onClose();
    setSearch('');
    setSelectedIndex(0);
  }, [onClose]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        const cmd = filteredCommands[selectedIndex];
        if (cmd) {
          e.preventDefault();
          executeCommand(cmd);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose, executeCommand]);

  const categoryLabels = {
    navigation: 'Navigation',
    agent: 'Run Agent',
    action: 'Actions',
  };

  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category]!.push(cmd);
    return acc;
  }, {} as Record<string, Command[]>);

  let flatIndex = 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-xl z-50"
          >
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              {/* Search Input */}
              <div className="p-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    ref={inputRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search commands..."
                    className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none text-lg"
                  />
                  <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-slate-500 font-mono">ESC</kbd>
                </div>
              </div>

              {/* Commands List */}
              <div className="max-h-80 overflow-y-auto p-2">
                {Object.entries(groupedCommands).map(([category, cmds]) => (
                  <div key={category} className="mb-2">
                    <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {categoryLabels[category as keyof typeof categoryLabels]}
                    </div>
                    {cmds.map((cmd) => {
                      const currentIndex = flatIndex++;
                      const isSelected = currentIndex === selectedIndex;
                      return (
                        <button
                          key={cmd.id}
                          onClick={() => executeCommand(cmd)}
                          onMouseEnter={() => setSelectedIndex(currentIndex)}
                          className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                            isSelected ? 'bg-indigo-500/20 text-white' : 'text-slate-300 hover:bg-white/5'
                          }`}
                        >
                          <span className="text-xl">{cmd.icon}</span>
                          <div className="flex-1 text-left">
                            <div className="font-medium">{cmd.name}</div>
                            <div className="text-xs text-slate-500">{cmd.description}</div>
                          </div>
                          {isSelected && (
                            <kbd className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-slate-500 font-mono">
                              Enter
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
                {filteredCommands.length === 0 && (
                  <div className="px-3 py-8 text-center text-slate-500">
                    No commands found
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-white/10 bg-white/5 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded font-mono">↑↓</kbd>
                    Navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded font-mono">Enter</kbd>
                    Select
                  </span>
                </div>
                <span>Vorion Command Palette</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
