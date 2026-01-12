import { urls } from '../lib/config'

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="text-xl font-semibold text-gray-900">AgentAnchor</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#platform" className="text-gray-600 hover:text-gray-900 transition text-sm font-medium">Platform</a>
              <a href="#safety" className="text-gray-600 hover:text-gray-900 transition text-sm font-medium">Safety</a>
              <a href="#trust" className="text-gray-600 hover:text-gray-900 transition text-sm font-medium">Trust</a>
              <a href="#developers" className="text-gray-600 hover:text-gray-900 transition text-sm font-medium">Developers</a>
              <a
                href="https://discord.gg/dUQSg8SG"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-gray-900 transition text-sm font-medium"
              >
                Discord
              </a>
              <a
                href="{urls.app}"
                className="px-4 py-2 bg-gradient-to-r from-slate-900 to-slate-700 hover:from-slate-800 hover:to-slate-600 text-white rounded-lg transition text-sm font-medium"
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
          <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-full text-white text-sm font-medium shadow-lg">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
            A3I-OS v2.0 Live — Enterprise AI Governance
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6 leading-tight tracking-tight">
            The A3I<br />
            <span className="bg-gradient-to-r from-slate-700 to-slate-500 bg-clip-text text-transparent">Operating System</span>
          </h1>

          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            Deploy AI agents you can trust. AgentAnchor provides enterprise-grade governance,
            real-time safety controls, and immutable accountability for every agent action.
          </p>
          <p className="text-lg text-emerald-700 font-medium mb-2">
            "Agents you can anchor to."
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="{urls.app}"
              className="px-8 py-4 bg-gradient-to-r from-slate-900 to-slate-700 hover:from-slate-800 hover:to-slate-600 text-white rounded-lg font-semibold transition shadow-lg hover:shadow-xl"
            >
              Enter The Anchor
            </a>
            <a
              href="https://discord.gg/dUQSg8SG"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 bg-white hover:bg-gray-50 text-gray-900 border border-gray-200 rounded-lg font-semibold transition inline-flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              Join Discord
            </a>
          </div>

          {/* Trust indicators */}
          <div className="mt-16 pt-8 border-t border-gray-100">
            <p className="text-sm text-gray-500 mb-6">Built with enterprise security in mind</p>
            <div className="flex flex-wrap justify-center gap-8 text-gray-400">
              <span className="text-sm font-medium">8-Level Agent Hierarchy</span>
              <span className="text-sm font-medium">Council of Nine Governance</span>
              <span className="text-sm font-medium">Cryptographic Truth Chain</span>
              <span className="text-sm font-medium">Human-in-the-Loop Controls</span>
            </div>
          </div>
        </div>
      </section>

      {/* Now Live Features Section */}
      <section className="py-20 bg-emerald-50 border-y border-emerald-100">
        <div className="max-w-7xl mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 bg-emerald-100 rounded-full text-emerald-700 text-sm font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Now Live
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Everything You Need to Deploy Trusted AI
            </h2>
            <p className="text-lg text-gray-600">
              Full-featured platform with sandbox testing, shadow training, real-time safety controls, and comprehensive trust verification.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: 'Sandbox Testing',
                desc: 'Isolated environment to test prompts safely before production deployment',
                icon: '🧪',
                color: 'bg-purple-100 text-purple-700',
              },
              {
                title: 'Shadow Training',
                desc: 'A/B test multiple agents side-by-side to find your best performers',
                icon: '⚡',
                color: 'bg-blue-100 text-blue-700',
              },
              {
                title: 'Trust Verification',
                desc: '0-1000 trust scoring with tier-based autonomy and capability gating',
                icon: '✅',
                color: 'bg-emerald-100 text-emerald-700',
              },
              {
                title: 'Dashboard Analytics',
                desc: 'Role-based views with trust scores, compliance status, and performance metrics',
                icon: '📊',
                color: 'bg-green-100 text-green-700',
              },
              {
                title: 'Circuit Breaker',
                desc: 'Instant pause/resume, global kill switch, cascade halt protocols',
                icon: '🛑',
                color: 'bg-red-100 text-red-700',
              },
              {
                title: 'MIA Protocol',
                desc: 'Automatic inactivity detection with graduated warnings and escalation',
                icon: '👀',
                color: 'bg-orange-100 text-orange-700',
              },
              {
                title: 'Truth Chain',
                desc: 'Cryptographic audit trail with immutable decision logging',
                icon: '⛓️',
                color: 'bg-indigo-100 text-indigo-700',
              },
              {
                title: 'Council Governance',
                desc: 'Multi-validator consensus framework for high-stakes decisions',
                icon: '⚖️',
                color: 'bg-slate-100 text-slate-700',
              },
            ].map((item, i) => (
              <div key={i} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition">
                <div className={`w-12 h-12 ${item.color} rounded-xl flex items-center justify-center text-2xl mb-4`}>
                  {item.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <a
              href="{urls.app}"
              className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition"
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
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              The AI Deployment Challenge
            </h2>
            <p className="text-lg text-gray-600">
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
              <div key={i} className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-700 mb-6">
                  {item.icon}
                </div>
                <div className="text-sm text-red-600 font-medium mb-1">Problem: {item.problem}</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{item.solution}</h3>
                <p className="text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Section */}
      <section id="platform" className="py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Complete Governance Architecture
            </h2>
            <p className="text-lg text-gray-600">
              A separation-of-powers architecture ensuring your AI agents operate safely, transparently, and within defined boundaries.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-slate-300 via-slate-400 to-slate-300"></div>

              {[
                { layer: 'Human Override', desc: 'Circuit breaker controls with pause, resume, and kill switch capabilities', color: 'bg-slate-900' },
                { layer: 'Council Governance', desc: 'Multi-validator consensus framework for high-stakes decisions', color: 'bg-slate-800' },
                { layer: 'Risk-Based Routing', desc: 'Smart routing: low-risk auto-approves, high-risk gets full review', color: 'bg-slate-700' },
                { layer: 'Academy Training', desc: 'Structured training framework with graduation requirements', color: 'bg-slate-600' },
                { layer: 'Truth Chain', desc: 'Cryptographically signed record of every decision and ownership change', color: 'bg-slate-500' },
                { layer: 'Observer System', desc: 'Real-time event logging with anomaly detection capabilities', color: 'bg-slate-400' },
                { layer: 'Worker Agents', desc: 'Trust-scored agents with capability gating based on earned reputation', color: 'bg-slate-300' },
              ].map((item, i) => (
                <div key={i} className="relative flex items-start gap-6 pb-8 last:pb-0">
                  <div className={`relative z-10 w-16 h-16 ${item.color} rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 pt-3">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{item.layer}</h3>
                    <p className="text-gray-600">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Safety Controls Section */}
      <section id="safety" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 bg-red-100 rounded-full text-red-700 text-sm font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Safety First
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Enterprise Safety Controls
            </h2>
            <p className="text-lg text-gray-600">
              When things go wrong, you need instant control. Our circuit breaker system provides multiple layers of protection.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: 'Agent Pause/Resume',
                desc: 'Instantly pause any agent with a documented reason. Resume when ready.',
                icon: '⏸️',
                color: 'bg-amber-100 text-amber-700',
              },
              {
                title: 'Global Kill Switch',
                desc: 'Platform-wide emergency stop. One click halts all agent operations.',
                icon: '🚨',
                color: 'bg-red-100 text-red-700',
              },
              {
                title: 'Cascade Halt',
                desc: 'Automatically pause dependent agents when a parent agent is stopped.',
                icon: '⛓️',
                color: 'bg-orange-100 text-orange-700',
              },
              {
                title: 'MIA Protocol',
                desc: 'Automated trainer inactivity detection with graduated warnings and platform takeover.',
                icon: '👁️',
                color: 'bg-blue-100 text-blue-700',
              },
            ].map((item, i) => (
              <div key={i} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <div className={`w-12 h-12 ${item.color} rounded-xl flex items-center justify-center text-2xl mb-4`}>
                  {item.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Trust Matrix */}
          <div className="mt-16 max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">Risk × Trust Routing</h3>
            <p className="text-gray-600 text-center mb-8">Actions are automatically routed based on agent trust level and action risk.</p>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="grid grid-cols-5 text-center text-sm font-medium">
                <div className="p-4 bg-gray-50 border-b border-r border-gray-200">Trust / Risk</div>
                <div className="p-4 bg-gray-50 border-b border-r border-gray-200">Low</div>
                <div className="p-4 bg-gray-50 border-b border-r border-gray-200">Medium</div>
                <div className="p-4 bg-gray-50 border-b border-r border-gray-200">High</div>
                <div className="p-4 bg-gray-50 border-b border-gray-200">Critical</div>
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
                  <div className="p-3 border-r border-b border-gray-200 font-medium text-gray-700 bg-gray-50">{row.tier}</div>
                  {row.cells.map((cell, j) => (
                    <div key={j} className={`p-3 border-r border-b border-gray-200 last:border-r-0 ${
                      cell === 'green' ? 'bg-green-100 text-green-700' :
                      cell === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {cell === 'green' ? 'Auto' : cell === 'yellow' ? 'Review' : 'Council'}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-center gap-6 text-sm">
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
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 bg-emerald-100 rounded-full text-emerald-700 text-sm font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Trust Framework
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Earned Autonomy Through Verified Trust
            </h2>
            <p className="text-lg text-gray-600">
              Trust isn't given—it's earned. Our scoring system tracks agent behavior over time, unlocking greater autonomy as reliability is proven.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-8 rounded-2xl border border-slate-200">
              <div className="text-4xl mb-4">📈</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Behavioral Scoring</h3>
              <p className="text-gray-600">0-1000 trust score based on actual performance, compliance, and decision quality over time.</p>
            </div>
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-8 rounded-2xl border border-slate-200">
              <div className="text-4xl mb-4">🔓</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Tiered Autonomy</h3>
              <p className="text-gray-600">Six trust tiers from Untrusted to Certified. Higher trust unlocks more independent action.</p>
            </div>
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-8 rounded-2xl border border-slate-200">
              <div className="text-4xl mb-4">⏱️</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Trust Decay</h3>
              <p className="text-gray-600">Inactive agents lose trust over time. Continuous engagement maintains earned privileges.</p>
            </div>
          </div>

          <div className="mt-12 text-center">
            <p className="text-gray-600 mb-6">Every agent action is logged, scored, and contributes to their trust profile.</p>
            <a href="{urls.app}" className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium transition">
              Explore Trust Dashboard
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* Developer Section */}
      <section id="developers" className="py-20 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 bg-white/10 rounded-full text-slate-300 text-sm font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              TypeScript SDK
            </div>
            <h2 className="text-3xl font-bold mb-4">
              Governance SDK
            </h2>
            <p className="text-lg text-slate-400">
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
              <div key={i} className="bg-white/5 p-6 rounded-xl border border-white/10">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-white mb-4">
                  {item.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-slate-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Code Example */}
          <div className="max-w-3xl mx-auto bg-black/50 rounded-xl p-6 font-mono text-sm overflow-x-auto">
            <div className="flex items-center gap-2 mb-4 text-slate-500">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="ml-2">governance-example.ts</span>
            </div>
            <pre className="text-slate-300">
{`import { MatrixRouter, CircuitBreakerService } from '@agentanchor/governance';

// Route action through Risk×Trust Matrix
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
            <p className="text-slate-400 mb-6">
              Full SDK documentation available. Start building governed AI agents with our TypeScript SDK today.
            </p>
            <a
              href="{urls.app}/docs/api"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-slate-900 rounded-lg font-medium hover:bg-gray-100 transition"
            >
              View API Documentation
            </a>
          </div>
        </div>
      </section>

      {/* Get Started Section */}
      <section id="waitlist" className="py-20 bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 bg-emerald-100 rounded-full text-emerald-700 text-sm font-medium">
            <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
            Free to Start
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Start Building Today
          </h2>
          <p className="text-lg text-gray-600 mb-10 max-w-2xl mx-auto">
            Create your account and deploy your first governed AI agent in minutes.
            No credit card required to get started.
          </p>

          {/* CTA Cards */}
          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
              <div className="text-4xl mb-4">🛡️</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">For Enterprises</h3>
              <p className="text-gray-600 mb-6">Deploy AI with confidence using our comprehensive trust and governance framework.</p>
              <a
                href="{urls.app}"
                className="block w-full px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium transition"
              >
                Get Started
              </a>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
              <div className="text-4xl mb-4">💻</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">For Developers</h3>
              <p className="text-gray-600 mb-6">Integrate trust scoring, circuit breakers, and governance into your AI systems.</p>
              <a
                href="{urls.app}/docs/api"
                className="block w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition"
              >
                View API Docs
              </a>
            </div>
          </div>

          <p className="mt-8 text-sm text-gray-500">
            Questions? Join our <a href="https://discord.gg/dUQSg8SG" className="text-emerald-600 hover:underline">Discord community</a> for support.
          </p>
        </div>
      </section>

      {/* Community Section */}
      <section className="py-16 bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-4">Join the Community</h2>
          <p className="text-slate-400 mb-8">
            Connect with us and be part of building the future of AI governance.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="https://discord.gg/dUQSg8SG"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-[#5865F2] hover:bg-[#4752C4] rounded-lg font-medium transition inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              Join Discord
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="text-lg font-semibold text-gray-900">AgentAnchor</span>
            </div>
            <p className="text-gray-500 text-sm">
              © 2026 AgentAnchor · A3I-OS v2.0 · "Agents you can anchor to."
            </p>
          </div>
        </div>
      </footer>
    </main>
  )
}
