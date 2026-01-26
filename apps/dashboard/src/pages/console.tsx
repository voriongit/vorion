import Layout from '../components/Layout'
import SocialCard from '../components/SocialCard'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useToast } from '../contexts/ToastContext'
import { CommandHistory, useSaveToHistory } from '../components/CommandHistory'
import { IntentPreview } from '../components/IntentPreview'
import { motion, AnimatePresence } from 'framer-motion'

// Agent configuration
const AGENTS = [
  { id: 'herald', name: 'Herald', color: 'bg-indigo-500', icon: '🎺', desc: 'Natural language' },
  { id: 'sentinel', name: 'Sentinel', color: 'bg-blue-500', icon: '🛡️', desc: 'Security audit' },
  { id: 'scribe', name: 'Scribe', color: 'bg-purple-500', icon: '📝', desc: 'Documentation' },
  { id: 'curator', name: 'Curator', color: 'bg-cyan-500', icon: '🧹', desc: 'Code hygiene' },
  { id: 'watchman', name: 'Watchman', color: 'bg-emerald-500', icon: '👁️', desc: 'Monitoring' },
  { id: 'envoy', name: 'Envoy', color: 'bg-pink-500', icon: '📣', desc: 'Social content' },
  { id: 'librarian', name: 'Librarian', color: 'bg-amber-500', icon: '📚', desc: 'Knowledge' },
  { id: 'ts-fixer', name: 'TS-Fixer', color: 'bg-yellow-500', icon: '🔧', desc: 'TypeScript' },
] as const;

// Quick action commands
const QUICK_ACTIONS = [
  { agent: 'sentinel', command: 'audit', label: 'Audit Code', icon: '🛡️', color: 'blue' },
  { agent: 'scribe', command: 'map', label: 'Map System', icon: '🗺️', color: 'purple' },
  { agent: 'curator', command: 'scan', label: 'Scan Files', icon: '🧹', color: 'cyan' },
  { agent: 'watchman', command: 'monitor', label: 'Status Check', icon: '📊', color: 'emerald' },
  { agent: 'librarian', command: 'index', label: 'Index Docs', icon: '📚', color: 'amber' },
];

export default function Console() {
  const [history, setHistory] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [mode, setMode] = useState<'chat' | 'direct'>('chat');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const saveToHistory = useSaveToHistory();

  // Command History (in-session for arrow navigation)
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  useEffect(() => {
      setHistory([{
        role: 'system',
        content: 'Vorion OS v2.1 Online. Use Quick Actions below or type naturally.'
      }]);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (historyIndex < cmdHistory.length - 1) {
              const newIndex = historyIndex + 1;
              setHistoryIndex(newIndex);
              setInput(cmdHistory[cmdHistory.length - 1 - newIndex] || '');
          }
      } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (historyIndex > 0) {
              const newIndex = historyIndex - 1;
              setHistoryIndex(newIndex);
              setInput(cmdHistory[cmdHistory.length - 1 - newIndex] || '');
          } else if (historyIndex === 0) {
              setHistoryIndex(-1);
              setInput('');
          }
      } else if (e.key === 'h' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          setShowHistory(true);
      } else if (e.key === 'Tab') {
          e.preventDefault();
          setMode(m => m === 'chat' ? 'direct' : 'chat');
      }
  };

  useEffect(() => {
      if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
  }, [history]);

  useEffect(() => {
      const handleGlobalKeyDown = (e: KeyboardEvent) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
              e.preventDefault();
              setShowHistory(true);
          }
      };
      window.addEventListener('keydown', handleGlobalKeyDown);
      return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleReplay = useCallback((command: string) => {
      setInput(command);
      inputRef.current?.focus();
  }, []);

  // Execute a direct agent command
  const executeCommand = async (agent: string, command: string, prompt?: string) => {
    const displayName = agent.toUpperCase();
    const actionLabel = prompt || `${agent}:${command}`;
    const startTime = Date.now();

    setHistory(prev => [...prev, { role: 'user', content: actionLabel }]);
    setLoading(true);
    setActiveAgent(agent);

    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent, command, prompt })
      });
      const data = await res.json();
      const duration = Date.now() - startTime;

      if (data.output) {
        // Try to parse JSON output
        let content = data.output;
        let isSocial = false;

        try {
          const parsed = JSON.parse(data.output.trim());
          content = parsed.text || parsed.message || JSON.stringify(parsed, null, 2);
          isSocial = content.includes('[Twitter Draft]') || content.includes('[LinkedIn Draft]');
        } catch {
          // Use raw output
        }

        setHistory(prev => [...prev, {
          role: 'agent',
          agent: displayName,
          content,
          isSocial,
          duration
        }]);
        saveToHistory(actionLabel, content, agent, true, duration);
        toast.success(`${displayName} completed`);
      } else {
        const errorMsg = data.error || 'Command failed';
        toast.error(errorMsg);
        setHistory(prev => [...prev, {
          role: 'agent',
          agent: 'SYSTEM',
          content: errorMsg,
          isError: true
        }]);
        saveToHistory(actionLabel, errorMsg, agent, false, Date.now() - startTime);
      }
    } catch (e) {
      toast.error('Connection failed');
      setHistory(prev => [...prev, { role: 'system', content: 'Connection Error.', isError: true }]);
    } finally {
      setLoading(false);
      setActiveAgent(null);
    }
  };

  // Quick action handler
  const handleQuickAction = (action: typeof QUICK_ACTIONS[number]) => {
    executeCommand(action.agent, action.command);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input;
    setCmdHistory(prev => [...prev, userMsg]);
    setHistoryIndex(-1);
    setInput('');

    // Route through herald for natural language
    executeCommand('herald', 'run', userMsg);
  };

  const getAgentColor = (agentId: string) => {
    return AGENTS.find(a => a.id === agentId.toLowerCase())?.color || 'bg-slate-500';
  };

  return (
    <Layout title="Console">
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-500">
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-slate-400 text-xs">Tab</kbd> toggle mode
            </div>
            <div className={`px-2 py-1 rounded text-xs font-medium ${
              mode === 'chat' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 text-emerald-400'
            }`}>
              {mode === 'chat' ? 'Natural Language' : 'Direct Commands'}
            </div>
          </div>
          <button
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-slate-400 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            History
          </button>
        </div>

        {/* Quick Actions Bar */}
        <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-white/5">
          {QUICK_ACTIONS.map((action) => (
            <motion.button
              key={`${action.agent}:${action.command}`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleQuickAction(action)}
              disabled={loading}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
                ${loading && activeAgent === action.agent
                  ? `bg-${action.color}-500/30 text-${action.color}-300 animate-pulse`
                  : `bg-${action.color}-500/10 text-${action.color}-400 hover:bg-${action.color}-500/20`
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              <span>{action.icon}</span>
              <span className="hidden sm:inline">{action.label}</span>
            </motion.button>
          ))}
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto mb-4 custom-scrollbar space-y-4" ref={scrollRef}>
          <AnimatePresence>
            {history.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] sm:max-w-[80%] rounded-2xl p-4 sm:p-5 ${
                    msg.role === 'user' ? 'bg-indigo-600 text-white' :
                    msg.role === 'agent' ? `bg-[#151515] border ${msg.isError ? 'border-red-500/50' : 'border-[#222]'}` :
                    'text-slate-500 text-sm'
                }`}>
                    {msg.role === 'agent' && (
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${getAgentColor(msg.agent)}`} />
                          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                            {msg.agent}
                          </span>
                        </div>
                        {msg.duration && (
                          <span className="text-[10px] text-slate-600">
                            {msg.duration}ms
                          </span>
                        )}
                      </div>
                    )}

                    {msg.isSocial ? (
                        <div>
                          <p className="mb-4 text-slate-300">I have drafted the content for you:</p>
                          {msg.content.includes('[Twitter Draft]') && (
                              <SocialCard platform="twitter" content={msg.content.split('[Twitter Draft]')[1].split('---')[0].trim()} />
                          )}
                          {msg.content.includes('[LinkedIn Draft]') && (
                              <SocialCard platform="linkedin" content={msg.content.split('[LinkedIn Draft]')[1].trim()} />
                          )}
                        </div>
                    ) : (
                        <pre className={`whitespace-pre-wrap font-sans text-sm leading-relaxed ${
                          msg.isError ? 'text-red-400' : ''
                        }`}>{msg.content}</pre>
                    )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="bg-[#151515] px-4 py-3 rounded-2xl border border-[#222]">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  {activeAgent && (
                    <span className="text-xs text-slate-500">
                      {activeAgent.charAt(0).toUpperCase() + activeAgent.slice(1)} working...
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Input Area */}
        <div className="relative">
          <form onSubmit={handleSubmit} className="relative">
            <IntentPreview input={input} />

            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={mode === 'chat' ? 'Ask the swarm anything...' : 'agent:command (e.g., sentinel:audit)'}
                className="flex-1 bg-[#151515] border border-[#333] rounded-xl px-4 py-4 focus:outline-none focus:border-indigo-500 transition-colors pl-6 shadow-xl"
                disabled={loading}
              />
              <motion.button
                type="submit"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={loading || !input.trim()}
                className="px-6 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-xl text-white font-medium transition-colors shadow-xl"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </motion.button>
            </div>
          </form>

          {/* Agent Chips (Direct Mode) */}
          {mode === 'direct' && (
            <div className="flex flex-wrap gap-2 mt-3">
              {AGENTS.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => setInput(`${agent.id}:`)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${agent.color}/10 hover:${agent.color}/20 transition-colors`}
                  title={agent.desc}
                >
                  <span>{agent.icon}</span>
                  <span className="text-slate-400">{agent.id}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <CommandHistory
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        onReplay={handleReplay}
      />
    </Layout>
  )
}
