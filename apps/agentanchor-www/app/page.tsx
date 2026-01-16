import { urls } from '../lib/config'

export default function Home() {
  return (
    <main className="min-h-screen bg-[#05050a] text-gray-200">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#05050a]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="text-xl font-semibold text-white">AgentAnchor</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#platform" className="text-gray-400 hover:text-white transition text-sm font-medium">Platform</a>
              <a href="#safety" className="text-gray-400 hover:text-white transition text-sm font-medium">Safety</a>
              <a href="#trust" className="text-gray-400 hover:text-white transition text-sm font-medium">Trust</a>
              <a href="#developers" className="text-gray-400 hover:text-white transition text-sm font-medium">Developers</a>
              <a
                href="https://discord.gg/basis-protocol"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition text-sm font-medium"
              >
                Discord
              </a>
              <a
                href={urls.app}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white rounded-lg transition text-sm font-medium"
              >
                Launch App
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-cyan-400 text-sm font-medium">
            <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span>
            Now Live — Enterprise AI Governance Platform
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight tracking-tight">
            AI Governance<br />
            <span className="bg-gradient-to-r from-cyan-400 to-cyan-300 bg-clip-text text-transparent">Infrastructure</span>
          </h1>

          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Deploy AI agents you can trust. AgentAnchor provides enterprise-grade governance,
            real-time trust scoring, capability gating, and immutable audit trails for every agent action.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={urls.app}
              className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white rounded-lg font-semibold transition shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40"
            >
              Get Started
            </a>
            <a
              href="https://discord.gg/basis-protocol"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg font-semibold transition inline-flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              Join Discord
            </a>
          </div>

          {/* Trust indicators */}
          <div className="mt-16 pt-8 border-t border-white/5">
            <p className="text-sm text-gray-500 mb-6">Built with enterprise security in mind</p>
            <div className="flex flex-wrap justify-center gap-8 text-gray-500">
              <span className="text-sm font-medium">6-Tier Trust Scoring</span>
              <span className="text-sm font-medium">Capability Gating</span>
              <span className="text-sm font-medium">Cryptographic Audit Trail</span>
              <span className="text-sm font-medium">Human-in-the-Loop Escalation</span>
            </div>
          </div>
        </div>
      </section>

      {/* Now Live Features Section */}
      <section className="py-20 bg-cyan-500/5 border-y border-cyan-500/10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-cyan-400 text-sm font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Now Live
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">
              Everything You Need to Deploy Trusted AI
            </h2>
            <p className="text-lg text-gray-400">
              Full-featured platform with sandbox testing, shadow training, real-time safety controls, and comprehensive trust verification.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: 'Sandbox Testing',
                desc: 'Isolated environment to test prompts safely before production deployment',
                icon: '🧪',
                color: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
              },
              {
                title: 'Shadow Training',
                desc: 'A/B test multiple agents side-by-side to find your best performers',
                icon: '⚡',
                color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
              },
              {
                title: 'Trust Verification',
                desc: '0-1000 trust scoring with tier-based autonomy and capability gating',
                icon: '✅',
                color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
              },
              {
                title: 'Dashboard Analytics',
                desc: 'Role-based views with trust scores, compliance status, and performance metrics',
                icon: '📊',
                color: 'bg-green-500/10 text-green-400 border-green-500/20',
              },
              {
                title: 'Circuit Breaker',
                desc: 'Instant pause/resume, global kill switch, cascade halt protocols',
                icon: '🛑',
                color: 'bg-red-500/10 text-red-400 border-red-500/20',
              },
              {
                title: 'MIA Protocol',
                desc: 'Automatic inactivity detection with graduated warnings and escalation',
                icon: '👀',
                color: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
              },
              {
                title: 'Truth Chain',
                desc: 'Cryptographic audit trail with immutable decision logging',
                icon: '⛓️',
                color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
              },
              {
                title: 'Council Governance',
                desc: 'Multi-validator consensus framework for high-stakes decisions',
                icon: '⚖️',
                color: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
              },
            ].map((item, i) => (
              <div key={i} className="bg-white/5 p-6 rounded-xl border border-white/5 hover:border-cyan-500/30 transition">
                <div className={`w-12 h-12 ${item.color} border rounded-xl flex items-center justify-center text-2xl mb-4`}>
                  {item.icon}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <a
              href={urls.app}
              className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg font-medium transition"
            >
              Explore All Features
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* Problem/Solution Section */}
      <section className="py-20 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">
              The AI Deployment Challenge
            </h2>
            <p className="text-lg text-gray-400">
              Organizations want to leverage AI agents, but face critical governance gaps.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                problem: 'No Visibility',
                solution: 'Complete Audit Trail',
                desc: 'Every decision logged, every action recorded. Full transparency for compliance and review.',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                ),
              },
              {
                problem: 'No Control',
                solution: 'Real-Time Safety Controls',
                desc: 'Emergency stop, pause/resume, circuit breakers. Instant control when you need it.',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                ),
              },
              {
                problem: 'No Trust',
                solution: 'Earned Autonomy',
                desc: 'Agents prove reliability through behavior. Trust scores determine what they can do independently.',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                ),
              },
            ].map((item, i) => (
              <div key={i} className="bg-white/5 p-8 rounded-2xl border border-white/5 hover:border-cyan-500/30 transition">
                <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-cyan-400 mb-6">
                  {item.icon}
                </div>
                <div className="text-sm text-red-400 font-medium mb-1">Problem: {item.problem}</div>
                <h3 className="text-xl font-semibold text-white mb-3">{item.solution}</h3>
                <p className="text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Section */}
      <section id="platform" className="py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">
              Complete Governance Architecture
            </h2>
            <p className="text-lg text-gray-400">
              A separation-of-powers architecture ensuring your AI agents operate safely, transparently, and within defined boundaries.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-cyan-500/50 via-cyan-500/20 to-cyan-500/50"></div>

              {[
                { layer: 'Human Override', desc: 'Circuit breaker controls with pause, resume, and kill switch capabilities', color: 'bg-cyan-500' },
                { layer: 'Council Governance', desc: 'Multi-validator consensus framework for high-stakes decisions', color: 'bg-cyan-500/90' },
                { layer: 'Risk-Based Routing', desc: 'Smart routing: low-risk auto-approves, high-risk gets full review', color: 'bg-cyan-500/80' },
                { layer: 'Academy Training', desc: 'Structured training framework with graduation requirements', color: 'bg-cyan-500/70' },
                { layer: 'Truth Chain', desc: 'Cryptographically signed record of every decision and ownership change', color: 'bg-cyan-500/60' },
                { layer: 'Observer System', desc: 'Real-time event logging with anomaly detection capabilities', color: 'bg-cyan-500/50' },
                { layer: 'Worker Agents', desc: 'Trust-scored agents with capability gating based on earned reputation', color: 'bg-cyan-500/40' },
              ].map((item, i) => (
                <div key={i} className="relative flex items-start gap-6 pb-8 last:pb-0">
                  <div className={`relative z-10 w-16 h-16 ${item.color} rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-cyan-500/25`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 pt-3">
                    <h3 className="text-lg font-semibold text-white mb-1">{item.layer}</h3>
                    <p className="text-gray-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Safety Controls Section */}
      <section id="safety" className="py-20 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-full text-red-400 text-sm font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Safety First
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">
              Enterprise Safety Controls
            </h2>
            <p className="text-lg text-gray-400">
              When things go wrong, you need instant control. Our circuit breaker system provides multiple layers of protection.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: 'Agent Pause/Resume',
                desc: 'Instantly pause any agent with a documented reason. Resume when ready.',
                icon: '⏸️',
                color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
              },
              {
                title: 'Global Kill Switch',
                desc: 'Platform-wide emergency stop. One click halts all agent operations.',
                icon: '🚨',
                color: 'bg-red-500/10 text-red-400 border-red-500/20',
              },
              {
                title: 'Cascade Halt',
                desc: 'Automatically pause dependent agents when a parent agent is stopped.',
                icon: '⛓️',
                color: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
              },
              {
                title: 'MIA Protocol',
                desc: 'Automated trainer inactivity detection with graduated warnings and platform takeover.',
                icon: '👁️',
                color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
              },
            ].map((item, i) => (
              <div key={i} className="bg-white/5 p-6 rounded-xl border border-white/5 hover:border-cyan-500/30 transition">
                <div className={`w-12 h-12 ${item.color} border rounded-xl flex items-center justify-center text-2xl mb-4`}>
                  {item.icon}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Trust Matrix */}
          <div className="mt-16 max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-white mb-6 text-center">Risk x Trust Routing</h3>
            <p className="text-gray-400 text-center mb-8">Actions are automatically routed based on agent trust level and action risk.</p>

            <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
              <div className="grid grid-cols-5 text-center text-sm font-medium">
                <div className="p-4 bg-white/5 border-b border-r border-white/10 text-gray-300">Trust / Risk</div>
                <div className="p-4 bg-white/5 border-b border-r border-white/10 text-gray-300">Low</div>
                <div className="p-4 bg-white/5 border-b border-r border-white/10 text-gray-300">Medium</div>
                <div className="p-4 bg-white/5 border-b border-r border-white/10 text-gray-300">High</div>
                <div className="p-4 bg-white/5 border-b border-white/10 text-gray-300">Critical</div>
              </div>
              {[
                { tier: 'Certified (900+)', cells: ['green', 'green', 'yellow', 'red'] },
                { tier: 'Verified (800+)', cells: ['green', 'yellow', 'yellow', 'red'] },
                { tier: 'Trusted (600+)', cells: ['yellow', 'yellow', 'red', 'red'] },
                { tier: 'Established (400+)', cells: ['yellow', 'yellow', 'red', 'red'] },
                { tier: 'Provisional (200+)', cells: ['yellow', 'red', 'red', 'red'] },
                { tier: 'Untrusted (0+)', cells: ['red', 'red', 'red', 'red'] },
              ].map((row, i) => (
                <div key={i} className="grid grid-cols-5 text-center text-sm">
                  <div className="p-3 border-r border-b border-white/10 font-medium text-gray-300 bg-white/5">{row.tier}</div>
                  {row.cells.map((cell, j) => (
                    <div key={j} className={`p-3 border-r border-b border-white/10 last:border-r-0 ${
                      cell === 'green' ? 'bg-green-500/20 text-green-400' :
                      cell === 'yellow' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {cell === 'green' ? 'Auto' : cell === 'yellow' ? 'Review' : 'Council'}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-center gap-6 text-sm text-gray-400">
              <span className="flex items-center gap-2"><span className="w-3 h-3 bg-green-500 rounded"></span> Express Path (Auto-approve)</span>
              <span className="flex items-center gap-2"><span className="w-3 h-3 bg-yellow-500 rounded"></span> Standard Path (Policy Check)</span>
              <span className="flex items-center gap-2"><span className="w-3 h-3 bg-red-500 rounded"></span> Full Governance (Council)</span>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section id="trust" className="py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-cyan-400 text-sm font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Trust Framework
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">
              Earned Autonomy Through Verified Trust
            </h2>
            <p className="text-lg text-gray-400">
              Trust is not given—it is earned. Our scoring system tracks agent behavior over time, unlocking greater autonomy as reliability is proven.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white/5 p-8 rounded-2xl border border-white/5 hover:border-cyan-500/30 transition">
              <div className="text-4xl mb-4">📈</div>
              <h3 className="text-xl font-semibold text-white mb-2">Behavioral Scoring</h3>
              <p className="text-gray-400">0-1000 trust score based on actual performance, compliance, and decision quality over time.</p>
            </div>
            <div className="bg-white/5 p-8 rounded-2xl border border-white/5 hover:border-cyan-500/30 transition">
              <div className="text-4xl mb-4">🔓</div>
              <h3 className="text-xl font-semibold text-white mb-2">Tiered Autonomy</h3>
              <p className="text-gray-400">Six trust tiers from Untrusted to Certified. Higher trust unlocks more independent action.</p>
            </div>
            <div className="bg-white/5 p-8 rounded-2xl border border-white/5 hover:border-cyan-500/30 transition">
              <div className="text-4xl mb-4">⏱️</div>
              <h3 className="text-xl font-semibold text-white mb-2">Trust Decay</h3>
              <p className="text-gray-400">Inactive agents lose trust over time. Continuous engagement maintains earned privileges.</p>
            </div>
          </div>

          <div className="mt-12 text-center">
            <p className="text-gray-400 mb-6">Every agent action is logged, scored, and contributes to their trust profile.</p>
            <a href={urls.app} className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg font-medium transition">
              Explore Trust Dashboard
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* Developer Section */}
      <section id="developers" className="py-20 bg-white/[0.02] border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-gray-300 text-sm font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              TypeScript SDK
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">
              Governance SDK
            </h2>
            <p className="text-lg text-gray-400">
              Everything you need to build governed AI agents. Trust scoring, persona injection, capability gating, and immutable audit - all in one SDK.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {[
              {
                title: 'Trust Engine',
                desc: '0-1000 scoring with decay mechanics and tier-based autonomy unlocks',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                ),
              },
              {
                title: 'Circuit Breaker',
                desc: 'Pause, resume, kill switch with cascade halt and truth chain logging',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
              },
              {
                title: 'Risk Router',
                desc: 'Automatic action routing based on trust level and risk assessment',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                  </svg>
                ),
              },
              {
                title: 'Truth Chain',
                desc: 'Cryptographically signed audit logging with Merkle proof verification',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                ),
              },
              {
                title: 'MIA Protocol',
                desc: 'Trainer activity tracking with graduated warnings and platform takeover',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                ),
              },
              {
                title: 'Sandbox API',
                desc: 'Isolated testing environment for safe prompt experimentation',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                ),
              },
              {
                title: 'Shadow Training',
                desc: 'A/B test multiple agents with parallel execution and scoring',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                  </svg>
                ),
              },
            ].map((item, i) => (
              <div key={i} className="bg-white/5 p-6 rounded-xl border border-white/5 hover:border-cyan-500/30 transition">
                <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-cyan-400 mb-4">
                  {item.icon}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Code Example */}
          <div className="max-w-3xl mx-auto bg-black/50 rounded-xl p-6 font-mono text-sm overflow-x-auto border border-white/10">
            <div className="flex items-center gap-2 mb-4 text-gray-500">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="ml-2">governance-example.ts</span>
            </div>
            <pre className="text-gray-300">
{`import { MatrixRouter, CircuitBreakerService } from '@agentanchor/governance';

// Route action through Risk x Trust Matrix
const routing = await MatrixRouter.route({
  trustScore: agent.trustScore,
  riskLevel: 'medium',
  actionType: 'customer_refund'
});

if (routing.route.path === 'red') {
  // Requires council consensus
  await escalateToCouncil(action);
} else if (routing.canProceed) {
  // Auto-approved or policy-checked
  await executeAction(action);
}

// Emergency controls available anytime
await CircuitBreakerService.pauseAgent({
  agentId: agent.id,
  reason: 'investigation',
  cascadeToDependent: true
});`}
            </pre>
          </div>

          <div className="mt-12 text-center">
            <p className="text-gray-400 mb-6">
              Full SDK documentation available. Start building governed AI agents with our TypeScript SDK today.
            </p>
            <a
              href={`${urls.app}/docs/api`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition"
            >
              View API Documentation
            </a>
          </div>
        </div>
      </section>

      {/* Get Started Section */}
      <section id="waitlist" className="py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-cyan-400 text-sm font-medium">
            <span className="w-2 h-2 bg-cyan-400 rounded-full"></span>
            Free to Start
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">
            Start Building Today
          </h2>
          <p className="text-lg text-gray-400 mb-10 max-w-2xl mx-auto">
            Create your account and deploy your first governed AI agent in minutes.
            No credit card required to get started.
          </p>

          {/* CTA Cards */}
          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <div className="bg-white/5 p-8 rounded-2xl border border-white/5 hover:border-cyan-500/30 transition">
              <div className="text-4xl mb-4">🛡️</div>
              <h3 className="text-xl font-semibold text-white mb-2">For Enterprises</h3>
              <p className="text-gray-400 mb-6">Deploy AI with confidence using our comprehensive trust and governance framework.</p>
              <a
                href={urls.app}
                className="block w-full px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg font-medium transition"
              >
                Get Started
              </a>
            </div>
            <div className="bg-white/5 p-8 rounded-2xl border border-white/5 hover:border-cyan-500/30 transition">
              <div className="text-4xl mb-4">💻</div>
              <h3 className="text-xl font-semibold text-white mb-2">For Developers</h3>
              <p className="text-gray-400 mb-6">Integrate trust scoring, circuit breakers, and governance into your AI systems.</p>
              <a
                href={`${urls.app}/docs/api`}
                className="block w-full px-6 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg font-medium transition"
              >
                View API Docs
              </a>
            </div>
          </div>

          <p className="mt-8 text-sm text-gray-500">
            Questions? Join our <a href="https://discord.gg/basis-protocol" className="text-cyan-400 hover:underline">Discord community</a> for support.
          </p>
        </div>
      </section>

      {/* Community Section */}
      <section className="py-16 bg-cyan-500/5 border-y border-cyan-500/10">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Join the Community</h2>
          <p className="text-gray-400 mb-8">
            Connect with us and be part of building the future of AI governance.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="https://discord.gg/basis-protocol"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-lg font-medium transition inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              Join Discord
            </a>
          </div>
        </div>
      </section>

      {/* Footer - Unified Vorion Pattern */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-gray-500">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="text-white font-semibold">AgentAnchor</span>
            <span className="text-gray-600">|</span>
            <span>© {new Date().getFullYear()} Vorion Risk, LLC.</span>
          </div>
          <div className="flex gap-6">
            <a href="https://vorion.org" className="hover:text-cyan-400 transition-colors">
              Vorion
            </a>
            <a href="https://vorion.org/basis" className="hover:text-cyan-400 transition-colors">
              BASIS
            </a>
            <a href="https://discord.gg/basis-protocol" className="hover:text-cyan-400 transition-colors flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              Discord
            </a>
            <a href="https://github.com/voriongit" className="hover:text-cyan-400 transition-colors flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </main>
  )
}
