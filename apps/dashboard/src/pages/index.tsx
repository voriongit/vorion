import Head from 'next/head'
import { useState } from 'react'
import useSWR from 'swr'
import { useToast } from '../contexts/ToastContext'
import { ActivityFeed } from '../components/ActivityFeed'
import { TelemetryGrid, TelemetrySummary } from '../components/TelemetryCard'

// Fetcher for SWR
const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function Home() {
  const { data: status } = useSWR('/api/status', fetcher, { refreshInterval: 5000 })
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [actionResult, setActionResult] = useState<string | null>(null)
  const toast = useToast()

  const runAgent = async (agent: string, command: string) => {
    setLoadingAction(agent);
    setActionResult(null);
    toast.info(`Starting ${agent}...`);
    try {
        const res = await fetch('/api/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agent, command })
        });
        const data = await res.json();
        if (data.error) {
            toast.error(`${agent}: ${data.error}`);
            setActionResult(data.error);
        } else {
            toast.success(`${agent} completed successfully`);
            setActionResult(data.output);
        }
    } catch (e) {
        toast.error(`${agent}: Connection failed`);
        setActionResult("Error executing command");
    } finally {
        setLoadingAction(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#030712] text-slate-200 font-sans selection:bg-indigo-500/30">
      <Head>
        <title>Vorion Mission Control</title>
      </Head>

      {/* Background Ambience */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto p-6 md:p-12">
          
      <header className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
                <h1 className="text-5xl font-extrabold tracking-tight text-white mb-2">
                    Mission Control
                </h1>
                <nav className="flex gap-4 mt-4">
                    <a href="/" className="text-indigo-400 font-bold border-b-2 border-indigo-400">Dashboard</a>
                    <a href="/console" className="text-slate-400 hover:text-indigo-300">Console</a>
                    <a href="/knowledge" className="text-slate-400 hover:text-indigo-300">Knowledge</a>
                    <a href="/governance" className="text-slate-400 hover:text-indigo-300 border border-slate-700 px-2 rounded">Governance</a>
                </nav>
            </div>
            <TelemetrySummary />
            
            <button
                onClick={() => {
                    runAgent('watchman', 'monitor');
                    setTimeout(() => runAgent('curator', 'scan'), 1000);
                    setTimeout(() => runAgent('sentinel', 'audit'), 2000);
                    setTimeout(() => runAgent('envoy', 'plan'), 3000);
                    setTimeout(() => runAgent('librarian', 'index'), 4000);
                }} 
                className="bg-white text-black px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-200 transition-colors shadow-lg shadow-white/10 active:scale-95 flex items-center gap-2"
            >
                <span>🚀</span> Initialize Swarm
            </button>
        </header>

        {/* Watchman Status Grid */}
        <section className="mb-12">
            <h2 className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-4 ml-1">Live Systems</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {status?.systems?.map((sys: any) => (
                    <div key={sys.name} className="group relative bg-white/5 backdrop-blur-sm border border-white/5 p-4 rounded-xl hover:bg-white/10 transition-all duration-300">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-medium text-slate-200">{sys.name}</h3>
                                <p className="text-xs text-slate-500 mt-1 font-mono">LATENCY: {Math.round(sys.latencyMs)}ms</p>
                            </div>
                            <div className={`px-2 py-1 rounded text-xs font-bold ${sys.status === 'UP' ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20' : 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20'}`}>
                                {sys.status}
                            </div>
                        </div>
                    </div>
                )) || (
                    [1,2,3].map(i => (
                        <div key={i} className="animate-pulse bg-white/5 h-20 rounded-xl" />
                    ))
                )}
            </div>
        </section>

        <section>
            <h2 className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-4 ml-1">Agent Workforce</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Sentinel */}
                <AgentCard 
                    name="Sentinel"
                    role="Governance"
                    color="blue"
                    desc="Audits policy compliance & structural integrity."
                    btnText="Run Audit"
                    onClick={() => runAgent('sentinel', 'audit')}
                    isLoading={loadingAction === 'sentinel'}
                />

                {/* Scribe */}
                <AgentCard 
                    name="Scribe"
                    role="Documentation"
                    color="purple"
                    desc="Maps architecture & generates live docs."
                    btnText="Map Architecture"
                    onClick={() => runAgent('scribe', 'map')}
                    isLoading={loadingAction === 'scribe'}
                />

                {/* Envoy */}
                <AgentCard 
                    name="Envoy"
                    role="Growth"
                    color="pink"
                    desc="Plans roadmap content & drafts posts."
                    btnText="Generate Plan"
                    onClick={() => runAgent('envoy', 'plan')}
                    isLoading={loadingAction === 'envoy'}
                />

                {/* TS-Fixer */}
                <AgentCard 
                    name="TS-Fixer"
                    role="Repair"
                    color="yellow"
                    desc="Auto-fixes compilation errors."
                    btnText="Fix Code"
                    onClick={() => runAgent('ts-fixer', 'run')}
                    isLoading={loadingAction === 'ts-fixer'}
                />

                {/* Curator */}
                <AgentCard 
                    name="Curator"
                    role="Hygiene"
                    color="cyan"
                    desc="Cleans workspaces & git repos."
                    btnText="Run Janitor"
                    onClick={() => runAgent('curator', 'scan')}
                    isLoading={loadingAction === 'curator'}
                />

            </div>
        </section>

        {/* Agent Telemetry Grid */}
        <section className="mt-12">
            <h2 className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-4 ml-1">Agent Telemetry</h2>
            <TelemetryGrid compact />
        </section>

        {/* Output Console & Activity Feed */}
        <section className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Terminal Output */}
            <div className="lg:col-span-2 bg-[#0a0a0a] rounded-xl border border-white/10 overflow-hidden shadow-2xl">
                <div className="bg-white/5 px-4 py-2 border-b border-white/10 flex items-center gap-2">
                    <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                        <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
                    </div>
                    <span className="text-xs font-mono text-slate-500 ml-2">TERMINAL_OUTPUT</span>
                </div>
                <div className="p-6 font-mono text-sm max-h-80 overflow-y-auto custom-scrollbar">
                    {actionResult ? (
                        <pre className="whitespace-pre-wrap text-emerald-400/90">{actionResult}</pre>
                    ) : (
                        <div className="text-slate-600 italic"> // Waiting for agent command...</div>
                    )}
                </div>
            </div>

            {/* Activity Feed */}
            <div className="bg-[#0a0a0a] rounded-xl border border-white/10 overflow-hidden shadow-2xl">
                <div className="bg-white/5 px-4 py-2 border-b border-white/10 flex items-center gap-2">
                    <div className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </div>
                    <span className="text-xs font-mono text-slate-500">ACTIVITY_FEED</span>
                </div>
                <div className="p-4">
                    <ActivityFeed />
                </div>
            </div>
        </section>

      </div>
    </div>
  )
}

// Reusable Agent Card Component
function AgentCard({ name, role, color, desc, btnText, onClick, isLoading }: any) {
    // Flatten styles to avoid runtime lookups failing
    let bgClass = 'bg-white/[0.03] border-white/5 hover:bg-white/[0.07]';
    let badgeClass = 'text-slate-400 ring-slate-500/20 bg-slate-500/10';
    let btnClass = 'bg-slate-700 hover:bg-slate-600 shadow-lg';

    if (color === 'blue') {
        bgClass = 'bg-blue-500/5 border-blue-500/10 hover:border-blue-500/30';
        badgeClass = 'text-blue-400 ring-blue-500/30 bg-blue-500/10';
        btnClass = 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20';
    } else if (color === 'purple') {
        bgClass = 'bg-purple-500/5 border-purple-500/10 hover:border-purple-500/30';
        badgeClass = 'text-purple-400 ring-purple-500/30 bg-purple-500/10';
        btnClass = 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/20';
    } else if (color === 'pink') {
        bgClass = 'bg-pink-500/5 border-pink-500/10 hover:border-pink-500/30';
        badgeClass = 'text-pink-400 ring-pink-500/30 bg-pink-500/10';
        btnClass = 'bg-pink-600 hover:bg-pink-500 shadow-pink-900/20';
    } else if (color === 'yellow') {
        bgClass = 'bg-yellow-500/5 border-yellow-500/10 hover:border-yellow-500/30';
        badgeClass = 'text-yellow-400 ring-yellow-500/30 bg-yellow-500/10';
        btnClass = 'bg-yellow-600 hover:bg-yellow-500 shadow-yellow-900/20';
    } else if (color === 'cyan') {
        bgClass = 'bg-cyan-500/5 border-cyan-500/10 hover:border-cyan-500/30';
        badgeClass = 'text-cyan-400 ring-cyan-500/30 bg-cyan-500/10';
        btnClass = 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-900/20';
    }

    return (
        <div className={`group relative backdrop-blur-sm border p-6 rounded-2xl transition-all duration-300 ${bgClass}`}>
            <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-slate-100">{name}</h3>
                <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded ring-1 ring-inset ${badgeClass}`}>
                    {role}
                </span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-8 min-h-[40px]">
                {desc}
            </p>
            <button 
                onClick={onClick}
                disabled={isLoading}
                className={`w-full py-2.5 rounded-lg font-semibold text-white transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex justify-center items-center gap-2 ${btnClass}`}
            >
                {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Running...
                    </span>
                ) : btnText}
            </button>
        </div>
    )
}
