import { useState } from 'react'
import useSWR from 'swr'
import Layout from '../components/Layout'
import { useToast } from '../contexts/ToastContext'
import { ActivityFeed } from '../components/ActivityFeed'
import { TelemetryGrid, TelemetrySummary } from '../components/TelemetryCard'

// Fetcher for SWR
const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function Home() {
  const { data: status } = useSWR('/api/status', fetcher, { refreshInterval: 30000 })
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
    <Layout title="Dashboard">
      {/* Header with Telemetry Summary */}
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
            Mission Control
          </h1>
          <p className="text-sm text-slate-500 mt-1">Real-time agent monitoring and orchestration</p>
        </div>
        <div className="flex items-center gap-4">
          <TelemetrySummary />
          <button
            onClick={() => {
              runAgent('sentinel', 'audit');
              setTimeout(() => runAgent('scribe', 'map'), 1000);
              setTimeout(() => runAgent('builder', 'build'), 2000);
              setTimeout(() => runAgent('tester', 'test'), 3000);
            }}
            className="bg-gradient-to-r from-indigo-600 to-cyan-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:from-indigo-500 hover:to-cyan-500 transition-all shadow-lg shadow-indigo-900/30 active:scale-95 flex items-center gap-2"
          >
            Initialize Swarm
          </button>
        </div>
      </header>

      {/* Systems Status Grid */}
      <section className="mb-8">
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

      {/* Bootstrap Agent Workforce */}
      <section className="mb-8">
        <h2 className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-4 ml-1">Bootstrap Agents</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">

          {/* Architect */}
          <AgentCard
            name="Architect"
            role="Design"
            color="amber"
            desc="Architecture decisions & ADRs"
            btnText="Review"
            onClick={() => runAgent('architect', 'review')}
            isLoading={loadingAction === 'architect'}
          />

          {/* Scribe */}
          <AgentCard
            name="Scribe"
            role="Docs"
            color="purple"
            desc="Documentation & specs"
            btnText="Generate"
            onClick={() => runAgent('scribe', 'map')}
            isLoading={loadingAction === 'scribe'}
          />

          {/* Sentinel */}
          <AgentCard
            name="Sentinel"
            role="Security"
            color="blue"
            desc="Security & compliance"
            btnText="Audit"
            onClick={() => runAgent('sentinel', 'audit')}
            isLoading={loadingAction === 'sentinel'}
          />

          {/* Builder */}
          <AgentCard
            name="Builder"
            role="Code"
            color="emerald"
            desc="Implementation & generation"
            btnText="Build"
            onClick={() => runAgent('builder', 'build')}
            isLoading={loadingAction === 'builder'}
          />

          {/* Tester */}
          <AgentCard
            name="Tester"
            role="Quality"
            color="cyan"
            desc="Test generation & validation"
            btnText="Test"
            onClick={() => runAgent('tester', 'test')}
            isLoading={loadingAction === 'tester'}
          />

        </div>
      </section>

      {/* Agent Telemetry Grid */}
      <section className="mb-8">
        <h2 className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-4 ml-1">Agent Telemetry</h2>
        <TelemetryGrid compact />
      </section>

      {/* Output Console & Activity Feed */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
    </Layout>
  )
}

// Reusable Agent Card Component
function AgentCard({ name, role, color, desc, btnText, onClick, isLoading }: any) {
    const colorStyles: Record<string, { bg: string; badge: string; btn: string }> = {
        amber: {
            bg: 'bg-amber-500/5 border-amber-500/10 hover:border-amber-500/30',
            badge: 'text-amber-400 ring-amber-500/30 bg-amber-500/10',
            btn: 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/20',
        },
        purple: {
            bg: 'bg-purple-500/5 border-purple-500/10 hover:border-purple-500/30',
            badge: 'text-purple-400 ring-purple-500/30 bg-purple-500/10',
            btn: 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/20',
        },
        blue: {
            bg: 'bg-blue-500/5 border-blue-500/10 hover:border-blue-500/30',
            badge: 'text-blue-400 ring-blue-500/30 bg-blue-500/10',
            btn: 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20',
        },
        emerald: {
            bg: 'bg-emerald-500/5 border-emerald-500/10 hover:border-emerald-500/30',
            badge: 'text-emerald-400 ring-emerald-500/30 bg-emerald-500/10',
            btn: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20',
        },
        cyan: {
            bg: 'bg-cyan-500/5 border-cyan-500/10 hover:border-cyan-500/30',
            badge: 'text-cyan-400 ring-cyan-500/30 bg-cyan-500/10',
            btn: 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-900/20',
        },
    };

    const styles = colorStyles[color] || colorStyles.emerald;

    return (
        <div className={`group relative backdrop-blur-sm border p-4 rounded-xl transition-all duration-300 ${styles.bg}`}>
            <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-bold text-slate-100">{name}</h3>
                <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ring-1 ring-inset ${styles.badge}`}>
                    {role}
                </span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed mb-4 min-h-[32px]">
                {desc}
            </p>
            <button
                onClick={onClick}
                disabled={isLoading}
                className={`w-full py-2 rounded-lg font-semibold text-white text-sm transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex justify-center items-center gap-2 ${styles.btn}`}
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
