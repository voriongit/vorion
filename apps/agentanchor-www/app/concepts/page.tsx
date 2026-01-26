'use client';

import Link from 'next/link';
import {
  ArrowRight,
  ArrowLeft,
  Shield,
  Brain,
  Scale,
  FileCheck,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  Zap,
  Lock,
  Unlock,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

const urls = {
  app: process.env.NEXT_PUBLIC_APP_URL || 'https://app.agentanchorai.com',
};

export default function ConceptsPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Navigation */}
      <nav className="fixed w-full border-b border-white/5 bg-gray-950/90 backdrop-blur-md z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <div className="flex gap-4">
            <Link href={urls.app} className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-medium rounded-lg transition-colors">
              Try AgentAnchor
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-16 px-6 max-w-5xl mx-auto text-center">
        <span className="text-cyan-400 text-sm font-medium uppercase tracking-wider">Understanding AI Governance</span>
        <h1 className="text-4xl md:text-5xl font-bold mt-4 mb-6">
          How AgentAnchor Works
        </h1>
        <p className="text-xl text-gray-400 max-w-3xl mx-auto">
          A complete guide to AI agent governance—from basic concepts to advanced implementation.
          No prior knowledge required.
        </p>
      </section>

      {/* Table of Contents */}
      <section className="py-8 px-6 max-w-5xl mx-auto">
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-bold mb-4">In This Guide</h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <a href="#what-is" className="flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-colors">
              <span className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 text-xs">1</span>
              What is AI Governance?
            </a>
            <a href="#trust-scores" className="flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-colors">
              <span className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 text-xs">2</span>
              Trust Scores Explained
            </a>
            <a href="#capability-gating" className="flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-colors">
              <span className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 text-xs">3</span>
              Capability Gating
            </a>
            <a href="#risk-matrix" className="flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-colors">
              <span className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 text-xs">4</span>
              Risk × Trust Matrix
            </a>
            <a href="#circuit-breakers" className="flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-colors">
              <span className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 text-xs">5</span>
              Circuit Breakers & Safety
            </a>
            <a href="#getting-started" className="flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-colors">
              <span className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 text-xs">6</span>
              Getting Started
            </a>
          </div>
        </div>
      </section>

      {/* Section 1: What is AI Governance */}
      <section id="what-is" className="py-16 px-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
            <Brain className="w-5 h-5 text-cyan-400" />
          </div>
          <h2 className="text-3xl font-bold">What is AI Governance?</h2>
        </div>

        <div className="prose prose-invert max-w-none">
          <p className="text-lg text-gray-300 mb-6">
            <strong>AI Governance</strong> is the system of rules, checks, and balances that controls what AI agents can do.
            Think of it like the management structure for AI employees.
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
              <div className="flex items-center gap-2 text-red-400 font-bold mb-3">
                <XCircle className="w-5 h-5" />
                Without Governance
              </div>
              <ul className="text-gray-400 text-sm space-y-2">
                <li>• AI makes decisions with no oversight</li>
                <li>• No way to prove what AI did or why</li>
                <li>• Compliance violations go undetected</li>
                <li>• Rogue agents can cause damage</li>
                <li>• No accountability for AI actions</li>
              </ul>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6">
              <div className="flex items-center gap-2 text-green-400 font-bold mb-3">
                <CheckCircle className="w-5 h-5" />
                With AgentAnchor
              </div>
              <ul className="text-gray-400 text-sm space-y-2">
                <li>• Every action is checked and logged</li>
                <li>• Complete audit trail for compliance</li>
                <li>• Trust-based access control</li>
                <li>• Instant emergency shutoff capability</li>
                <li>• Clear accountability chain</li>
              </ul>
            </div>
          </div>

          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Real-World Analogy: The New Employee</h3>
            <p className="text-gray-400 text-sm">
              Imagine hiring a new employee. You wouldn&apos;t give them access to all company systems on day one.
              They start with limited access, prove themselves over time, and gradually earn more responsibility.
              <br /><br />
              <strong className="text-white">AgentAnchor does the same for AI agents.</strong> New agents start in a &quot;sandbox&quot;
              with minimal permissions. As they demonstrate reliable behavior, they earn higher trust levels and unlock
              more capabilities. Make a mistake? Trust drops and permissions are revoked.
            </p>
          </div>
        </div>
      </section>

      {/* Section 2: Trust Scores */}
      <section id="trust-scores" className="py-16 px-6 max-w-5xl mx-auto border-t border-gray-800">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
            <Scale className="w-5 h-5 text-cyan-400" />
          </div>
          <h2 className="text-3xl font-bold">Trust Scores Explained</h2>
        </div>

        <p className="text-lg text-gray-300 mb-8">
          Every AI agent has a <strong>Trust Score</strong> from 0 to 1000. This score determines
          what the agent can do—higher scores unlock more capabilities.
        </p>

        {/* Trust Tiers Visual */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8 mb-8">
          <h3 className="text-xl font-bold mb-6 text-center">The 6 Trust Tiers</h3>
          <div className="space-y-4">
            {[
              { tier: 'T5', name: 'Certified', range: '900-1000', color: 'emerald', desc: 'Full autonomy. Can perform any action without human approval. Reserved for thoroughly audited, long-running agents.' },
              { tier: 'T4', name: 'Verified', range: '700-899', color: 'blue', desc: 'High trust. Can handle sensitive operations. Minimal oversight required.' },
              { tier: 'T3', name: 'Trusted', range: '500-699', color: 'cyan', desc: 'Extended capabilities. Can perform most standard operations independently.' },
              { tier: 'T2', name: 'Established', range: '300-499', color: 'yellow', desc: 'Proven reliability. Basic operations approved, complex ones need review.' },
              { tier: 'T1', name: 'Provisional', range: '100-299', color: 'orange', desc: 'Learning phase. Limited actions, frequent human checkpoints.' },
              { tier: 'T0', name: 'Sandbox', range: '0-99', color: 'red', desc: 'New or untrusted. Read-only access, all actions require approval.' },
            ].map((t, i) => (
              <div key={t.tier} className="flex items-center gap-4">
                <div className={`w-20 text-center py-2 rounded-lg bg-${t.color}-500/20 border border-${t.color}-500/30`}>
                  <div className={`text-lg font-bold text-${t.color}-400`}>{t.tier}</div>
                  <div className="text-xs text-gray-500">{t.range}</div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium text-${t.color}-400`}>{t.name}</span>
                    <div className={`flex-1 h-2 rounded-full bg-gray-800`}>
                      <div className={`h-full rounded-full bg-${t.color}-500`} style={{ width: `${100 - i * 16}%` }} />
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How Scores Change */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-2 text-green-400 font-bold mb-4">
              <TrendingUp className="w-5 h-5" />
              Trust Increases When...
            </div>
            <ul className="text-gray-400 text-sm space-y-2">
              <li>✓ Tasks completed successfully</li>
              <li>✓ Consistent uptime and reliability</li>
              <li>✓ Compliance checks passed</li>
              <li>✓ Security audits cleared</li>
              <li>✓ Positive human feedback</li>
            </ul>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-2 text-red-400 font-bold mb-4">
              <TrendingDown className="w-5 h-5" />
              Trust Decreases When...
            </div>
            <ul className="text-gray-400 text-sm space-y-2">
              <li>✗ Tasks fail or produce errors</li>
              <li>✗ Security violations detected</li>
              <li>✗ Policy breaches occur</li>
              <li>✗ Extended periods of inactivity</li>
              <li>✗ Anomalous behavior flagged</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Section 3: Capability Gating */}
      <section id="capability-gating" className="py-16 px-6 max-w-5xl mx-auto border-t border-gray-800">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
            <Lock className="w-5 h-5 text-cyan-400" />
          </div>
          <h2 className="text-3xl font-bold">Capability Gating</h2>
        </div>

        <p className="text-lg text-gray-300 mb-8">
          <strong>Capability Gating</strong> is like a bouncer at a club. Before any action is taken,
          the system checks if the agent has enough trust for that specific action.
        </p>

        {/* Decision Flow */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8 mb-8">
          <h3 className="text-lg font-bold mb-6 text-center">Every Action Goes Through This Check</h3>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-cyan-500/20 flex items-center justify-center mx-auto mb-2">
                <Brain className="w-8 h-8 text-cyan-400" />
              </div>
              <p className="text-sm text-gray-400">Agent requests action</p>
            </div>
            <ArrowRight className="w-6 h-6 text-gray-600 rotate-90 md:rotate-0" />
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-2">
                <Scale className="w-8 h-8 text-purple-400" />
              </div>
              <p className="text-sm text-gray-400">Trust vs. Risk checked</p>
            </div>
            <ArrowRight className="w-6 h-6 text-gray-600 rotate-90 md:rotate-0" />
            <div className="text-center space-y-2">
              <div className="flex gap-2">
                <div className="px-3 py-1 rounded bg-green-500/20 text-green-400 text-xs font-medium">ALLOW</div>
                <div className="px-3 py-1 rounded bg-red-500/20 text-red-400 text-xs font-medium">DENY</div>
              </div>
              <div className="flex gap-2">
                <div className="px-3 py-1 rounded bg-yellow-500/20 text-yellow-400 text-xs font-medium">ESCALATE</div>
                <div className="px-3 py-1 rounded bg-orange-500/20 text-orange-400 text-xs font-medium">DEGRADE</div>
              </div>
              <p className="text-sm text-gray-400">Decision made</p>
            </div>
          </div>
        </div>

        {/* Decision Types */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-5">
            <div className="flex items-center gap-2 font-bold text-green-400 mb-2">
              <Unlock className="w-4 h-4" /> ALLOW
            </div>
            <p className="text-sm text-gray-400">Trust is sufficient. Action proceeds immediately.</p>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5">
            <div className="flex items-center gap-2 font-bold text-red-400 mb-2">
              <XCircle className="w-4 h-4" /> DENY
            </div>
            <p className="text-sm text-gray-400">Trust is too low. Action blocked completely.</p>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-5">
            <div className="flex items-center gap-2 font-bold text-yellow-400 mb-2">
              <Users className="w-4 h-4" /> ESCALATE
            </div>
            <p className="text-sm text-gray-400">Borderline case. Sent to human for approval.</p>
          </div>
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-5">
            <div className="flex items-center gap-2 font-bold text-orange-400 mb-2">
              <AlertTriangle className="w-4 h-4" /> DEGRADE
            </div>
            <p className="text-sm text-gray-400">Allowed with reduced scope or added restrictions.</p>
          </div>
        </div>
      </section>

      {/* Section 4: Risk Matrix */}
      <section id="risk-matrix" className="py-16 px-6 max-w-5xl mx-auto border-t border-gray-800">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-cyan-400" />
          </div>
          <h2 className="text-3xl font-bold">Risk × Trust Matrix</h2>
        </div>

        <p className="text-lg text-gray-300 mb-8">
          The decision isn&apos;t just about trust—it also considers how risky the action is.
          High-risk actions need higher trust. Low-risk actions can proceed with lower trust.
        </p>

        {/* Matrix Visual */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8 overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr>
                <th className="text-left text-gray-500 text-sm pb-4">Trust Level</th>
                <th className="text-center text-gray-500 text-sm pb-4">Low Risk</th>
                <th className="text-center text-gray-500 text-sm pb-4">Medium Risk</th>
                <th className="text-center text-gray-500 text-sm pb-4">High Risk</th>
                <th className="text-center text-gray-500 text-sm pb-4">Critical Risk</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {[
                { tier: 'T5 Certified', cells: ['green', 'green', 'green', 'yellow'] },
                { tier: 'T4 Verified', cells: ['green', 'green', 'yellow', 'yellow'] },
                { tier: 'T3 Trusted', cells: ['green', 'yellow', 'yellow', 'red'] },
                { tier: 'T2 Established', cells: ['green', 'yellow', 'red', 'red'] },
                { tier: 'T1 Provisional', cells: ['yellow', 'red', 'red', 'red'] },
                { tier: 'T0 Sandbox', cells: ['red', 'red', 'red', 'red'] },
              ].map((row) => (
                <tr key={row.tier} className="border-t border-gray-800">
                  <td className="py-3 text-white font-medium">{row.tier}</td>
                  {row.cells.map((color, i) => (
                    <td key={i} className="py-3 text-center">
                      <span className={`inline-block w-8 h-8 rounded-lg ${
                        color === 'green' ? 'bg-green-500/30' :
                        color === 'yellow' ? 'bg-yellow-500/30' : 'bg-red-500/30'
                      }`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-center gap-6 mt-6 text-xs">
            <div className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-green-500/30" /> Auto-approved</div>
            <div className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-yellow-500/30" /> Needs review</div>
            <div className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-red-500/30" /> Denied</div>
          </div>
        </div>
      </section>

      {/* Section 5: Circuit Breakers */}
      <section id="circuit-breakers" className="py-16 px-6 max-w-5xl mx-auto border-t border-gray-800">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
            <Zap className="w-5 h-5 text-red-400" />
          </div>
          <h2 className="text-3xl font-bold">Circuit Breakers & Safety</h2>
        </div>

        <p className="text-lg text-gray-300 mb-8">
          Sometimes you need to stop an AI agent immediately. Circuit breakers provide instant control.
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center mb-4">
              <Clock className="w-6 h-6 text-yellow-400" />
            </div>
            <h3 className="font-bold text-white mb-2">Pause</h3>
            <p className="text-sm text-gray-400">
              Temporarily halt an agent&apos;s actions. Agent can resume when you&apos;re ready.
            </p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-orange-400" />
            </div>
            <h3 className="font-bold text-white mb-2">Restrict</h3>
            <p className="text-sm text-gray-400">
              Reduce an agent&apos;s trust level immediately. Capabilities automatically limited.
            </p>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
              <XCircle className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="font-bold text-white mb-2">Kill Switch</h3>
            <p className="text-sm text-gray-400">
              Complete shutdown. Revokes all permissions and halts all activity instantly.
            </p>
          </div>
        </div>
      </section>

      {/* Section 6: Getting Started */}
      <section id="getting-started" className="py-16 px-6 max-w-5xl mx-auto border-t border-gray-800">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
            <ArrowRight className="w-5 h-5 text-cyan-400" />
          </div>
          <h2 className="text-3xl font-bold">Getting Started</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-xl p-8">
            <h3 className="text-xl font-bold mb-4">For Enterprises</h3>
            <p className="text-gray-400 mb-6">
              Get a demo of AgentAnchor configured for your use case. See how governance
              integrates with your existing AI infrastructure.
            </p>
            <Link href={`${urls.app}/demo`} className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-medium rounded-lg transition-colors">
              Request Demo <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/20 rounded-xl p-8">
            <h3 className="text-xl font-bold mb-4">For Developers</h3>
            <p className="text-gray-400 mb-6">
              Install the ACI spec and start building governed agents. Full TypeScript support
              with comprehensive documentation.
            </p>
            <div className="bg-black/30 rounded-lg p-4 font-mono text-sm text-cyan-400 mb-4">
              npm install @vorionsys/aci-spec
            </div>
            <a href="https://npmjs.com/package/@vorionsys/aci-spec" target="_blank" className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors text-sm">
              View Documentation <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-12 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500">© {new Date().getFullYear()} AgentAnchor. Built on ACI Spec v1.1.0</p>
          <div className="flex gap-6 text-sm text-gray-500">
            <Link href="/" className="hover:text-cyan-400 transition-colors">Home</Link>
            <Link href="/pricing" className="hover:text-cyan-400 transition-colors">Pricing</Link>
            <a href={urls.app} className="hover:text-cyan-400 transition-colors">Dashboard</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
