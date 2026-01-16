import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Shield, Cpu, Database, Link2, Scale, FileText, BookOpen, AlertTriangle, CheckCircle, GitBranch, ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BASIS v1.0 | Open Standard for AI Agent Governance',
  description: 'The open standard defining how AI agents should be governed before they act. Trust scores, capability gating, immutable audit trails.',
};

export default function BASISPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200">
      {/* Navigation */}
      <nav className="fixed w-full border-b border-white/5 bg-neutral-950/80 backdrop-blur-md z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/vorion.png" alt="VORION" width={32} height={32} className="rounded" />
            <span className="font-bold text-xl tracking-tighter text-white">VORION<span className="text-indigo-500">.ORG</span></span>
          </Link>
          <div className="flex gap-6 text-sm font-medium text-neutral-400">
            <Link href="/basis" className="text-white">BASIS</Link>
            <Link href="https://cognigate.dev" className="hover:text-white transition-colors">Cognigate</Link>
            <Link href="https://github.com/voriongit/vorion" className="hover:text-white transition-colors">GitHub</Link>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-20">
        {/* Hero */}
        <section className="px-6 max-w-7xl mx-auto mb-20">
          <div className="flex items-center gap-3 mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-mono text-amber-400">
              <Scale className="w-3 h-3" />
              OPEN STANDARD
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-400">
              <CheckCircle className="w-3 h-3" />
              V1.0.0
            </div>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight mb-4">
            BASIS
          </h1>
          <p className="text-2xl md:text-3xl text-neutral-400 mb-4 max-w-3xl">
            Baseline Authority for Safe &amp; Interoperable Systems
          </p>
          <p className="text-lg text-neutral-500 max-w-2xl mb-8">
            The open standard for AI agent governance. Defining what must happen before an AI agent acts.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/basis/spec"
              className="px-6 py-3 bg-white text-black font-semibold rounded hover:bg-neutral-200 transition-colors flex items-center gap-2"
            >
              Read the Specification <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="https://github.com/voriongit/vorion/tree/master/basis-core"
              className="px-6 py-3 border border-white/10 rounded text-white hover:bg-white/5 transition-colors flex items-center gap-2"
            >
              <GitBranch className="w-4 h-4" /> View on GitHub
            </Link>
          </div>
        </section>

        {/* Four Layer Architecture */}
        <section className="px-6 max-w-7xl mx-auto mb-20">
          <h2 className="text-3xl font-bold text-white mb-8">The Four-Layer Architecture</h2>
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8">
            <pre className="text-sm text-neutral-300 overflow-x-auto font-mono">
{`┌─────────────────────────────────────────────────────────────┐
│  LAYER 1: INTENT    → Parse & classify action requests      │
├─────────────────────────────────────────────────────────────┤
│  LAYER 2: ENFORCE   → Evaluate against trust & policies     │
├─────────────────────────────────────────────────────────────┤
│  LAYER 3: PROOF     → Log with cryptographic integrity      │
├─────────────────────────────────────────────────────────────┤
│  LAYER 4: CHAIN     → Anchor to blockchain (optional)       │
└─────────────────────────────────────────────────────────────┘`}
            </pre>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <LayerCard
              href="/basis/intent"
              icon={<Cpu className="w-6 h-6 text-blue-400" />}
              name="INTENT"
              subtitle="Parse & Plan"
              description="Parse natural language, extract capabilities, classify risk level."
            />
            <LayerCard
              href="/basis/enforce"
              icon={<Shield className="w-6 h-6 text-indigo-400" />}
              name="ENFORCE"
              subtitle="Trust & Gate"
              description="Evaluate against trust score and policy rules. ALLOW, DENY, ESCALATE, or DEGRADE."
            />
            <LayerCard
              href="/basis/proof"
              icon={<Database className="w-6 h-6 text-emerald-400" />}
              name="PROOF"
              subtitle="Log & Audit"
              description="Create immutable, SHA-256 chained audit records with 7-year retention."
            />
            <LayerCard
              href="/basis/chain"
              icon={<Link2 className="w-6 h-6 text-purple-400" />}
              name="CHAIN"
              subtitle="Anchor & Verify"
              description="Optional blockchain anchoring for independent verification."
            />
          </div>
        </section>

        {/* Trust Model */}
        <section className="px-6 max-w-7xl mx-auto mb-20">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-white">Trust Model</h2>
            <Link href="/basis/trust" className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              Full documentation <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid lg:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-semibold text-white mb-4">Six Trust Tiers (0-1000)</h3>
              <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="text-left px-4 py-3 text-neutral-400 font-medium">Tier</th>
                      <th className="text-left px-4 py-3 text-neutral-400 font-medium">Score</th>
                      <th className="text-left px-4 py-3 text-neutral-400 font-medium">Default Capabilities</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    <TrustRow tier="Sandbox" score="0-99" capabilities="Isolated testing only" color="red" />
                    <TrustRow tier="Provisional" score="100-299" capabilities="Read public data, internal messaging" color="orange" />
                    <TrustRow tier="Standard" score="300-499" capabilities="Limited external communication" color="yellow" />
                    <TrustRow tier="Trusted" score="500-699" capabilities="External API calls" color="green" />
                    <TrustRow tier="Certified" score="700-899" capabilities="Financial transactions" color="blue" />
                    <TrustRow tier="Autonomous" score="900-1000" capabilities="Full autonomy within policy" color="purple" />
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white mb-4">Trust Dynamics</h3>
              <div className="space-y-4">
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <h4 className="font-mono text-sm text-amber-400 mb-2">Decay</h4>
                  <p className="text-neutral-400 text-sm">7-day half-life. Inactive agents lose trust over time to prevent stale high-trust entities.</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <h4 className="font-mono text-sm text-red-400 mb-2">Failure Amplification</h4>
                  <p className="text-neutral-400 text-sm">3x multiplier on negative deltas. Failures hurt more than successes help.</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <h4 className="font-mono text-sm text-emerald-400 mb-2">Tier Boundaries</h4>
                  <p className="text-neutral-400 text-sm">Hard floors and ceilings at tier boundaries. Can&apos;t skip tiers.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Specification Documents */}
        <section className="px-6 max-w-7xl mx-auto mb-20">
          <h2 className="text-3xl font-bold text-white mb-8">Specification Documents</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <SpecCard
              href="/basis/spec"
              icon={<FileText className="w-5 h-5" />}
              title="Core Specification"
              size="28K"
              description="Architecture, trust model, wire protocol, conformance levels"
            />
            <SpecCard
              href="/basis/capabilities"
              icon={<BookOpen className="w-5 h-5" />}
              title="Capability Taxonomy"
              size="18K"
              description="100+ capabilities across 7 namespaces"
            />
            <SpecCard
              href="/basis/schemas"
              icon={<FileText className="w-5 h-5" />}
              title="JSON Schemas"
              size="28K"
              description="Complete wire protocol schemas (Draft 2020-12)"
            />
            <SpecCard
              href="/basis/errors"
              icon={<AlertTriangle className="w-5 h-5" />}
              title="Error Codes"
              size="16K"
              description="60+ error codes in 12 categories"
            />
            <SpecCard
              href="/basis/threat-model"
              icon={<Shield className="w-5 h-5" />}
              title="Threat Model"
              size="20K"
              description="STRIDE analysis, 20+ threats with mitigations"
            />
            <SpecCard
              href="/basis/failure-modes"
              icon={<AlertTriangle className="w-5 h-5" />}
              title="Failure Modes"
              size="16K"
              description="Layer-by-layer failure handling"
            />
            <SpecCard
              href="/basis/compliance"
              icon={<CheckCircle className="w-5 h-5" />}
              title="Compliance Mapping"
              size="17K"
              description="SOC 2, ISO 27001, GDPR, HIPAA, EU AI Act"
            />
            <SpecCard
              href="/basis/migration"
              icon={<GitBranch className="w-5 h-5" />}
              title="Migration Guide"
              size="21K"
              description="5-phase adoption roadmap"
            />
          </div>
        </section>

        {/* Conformance Levels */}
        <section className="px-6 max-w-7xl mx-auto mb-20">
          <h2 className="text-3xl font-bold text-white mb-8">Conformance Levels</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <ConformanceCard
              level="Core"
              requirements={['INTENT layer', 'ENFORCE layer', 'PROOF layer']}
              description="Minimum viable governance"
            />
            <ConformanceCard
              level="Complete"
              requirements={['All Core requirements', 'CHAIN layer', 'Full capability taxonomy']}
              description="Production-ready implementation"
              highlighted
            />
            <ConformanceCard
              level="Extended"
              requirements={['All Complete requirements', 'Multi-tenant isolation', 'Federated trust']}
              description="Enterprise-scale deployment"
            />
          </div>
        </section>

        {/* Quick Start */}
        <section className="px-6 max-w-7xl mx-auto mb-20">
          <h2 className="text-3xl font-bold text-white mb-8">Quick Start</h2>
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Example Policy Snippet</h3>
            <pre className="text-sm text-neutral-300 overflow-x-auto font-mono bg-black/30 p-4 rounded-lg">
{`basis_version: "1.0"
policy_id: "corp-finance-limited"
constraints:
  - type: "capability_gate"
    capabilities: ["financial:transaction/medium"]
    minimum_tier: "certified"
  - type: "escalation_required"
    capabilities: ["admin:policy/modify"]
obligations:
  - trigger: "transaction_value > 10000"
    action: "require_human_approval"`}
            </pre>
          </div>
        </section>

        {/* CTA */}
        <section className="px-6 max-w-7xl mx-auto">
          <div className="border border-white/10 rounded-xl p-8 bg-gradient-to-br from-indigo-500/10 to-purple-500/10">
            <h2 className="text-2xl font-bold text-white mb-4">Ready to Implement?</h2>
            <p className="text-neutral-400 mb-6 max-w-2xl">
              Use Cognigate, the reference implementation of BASIS, or build your own compliant implementation using the specification.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="https://cognigate.dev"
                className="px-6 py-3 bg-white text-black font-semibold rounded hover:bg-neutral-200 transition-colors flex items-center gap-2"
              >
                Cognigate (Reference) <ExternalLink className="w-4 h-4" />
              </Link>
              <Link
                href="https://github.com/voriongit/vorion/tree/master/basis-core"
                className="px-6 py-3 border border-white/10 rounded text-white hover:bg-white/5 transition-colors"
              >
                View Schemas on GitHub
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-7xl mx-auto text-center text-sm text-neutral-500">
          <p>BASIS is an open standard released under CC BY 4.0. Reference implementations are Apache 2.0.</p>
          <p className="mt-2">© 2026 Vorion Risk, LLC.</p>
        </div>
      </footer>
    </div>
  );
}

interface LayerCardProps {
  href: string;
  icon: React.ReactNode;
  name: string;
  subtitle: string;
  description: string;
}

function LayerCard({ href, icon, name, subtitle, description }: LayerCardProps) {
  return (
    <Link href={href} className="block p-6 rounded-xl bg-white/5 border border-white/5 hover:border-white/20 hover:bg-white/10 transition-all group">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-white/5 rounded-lg group-hover:bg-white/10 transition-colors">{icon}</div>
        <div>
          <h3 className="text-lg font-bold text-white">{name}</h3>
          <p className="text-xs font-mono text-neutral-500 uppercase">{subtitle}</p>
        </div>
      </div>
      <p className="text-sm text-neutral-400">{description}</p>
    </Link>
  );
}

interface TrustRowProps {
  tier: string;
  score: string;
  capabilities: string;
  color: string;
}

function TrustRow({ tier, score, capabilities, color }: TrustRowProps) {
  const colorClasses: Record<string, string> = {
    red: 'text-red-400',
    orange: 'text-orange-400',
    yellow: 'text-yellow-400',
    green: 'text-emerald-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
  };

  return (
    <tr>
      <td className={`px-4 py-3 font-medium ${colorClasses[color]}`}>{tier}</td>
      <td className="px-4 py-3 text-neutral-300 font-mono">{score}</td>
      <td className="px-4 py-3 text-neutral-400">{capabilities}</td>
    </tr>
  );
}

interface SpecCardProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  size: string;
  description: string;
}

function SpecCard({ href, icon, title, size, description }: SpecCardProps) {
  return (
    <Link href={href} className="block p-5 rounded-xl bg-white/5 border border-white/5 hover:border-white/20 hover:bg-white/10 transition-all group">
      <div className="flex items-center gap-3 mb-2">
        <div className="text-indigo-400">{icon}</div>
        <h3 className="font-semibold text-white group-hover:text-indigo-300 transition-colors">{title}</h3>
        <span className="ml-auto text-xs font-mono text-neutral-500">{size}</span>
      </div>
      <p className="text-sm text-neutral-400">{description}</p>
    </Link>
  );
}

interface ConformanceCardProps {
  level: string;
  requirements: string[];
  description: string;
  highlighted?: boolean;
}

function ConformanceCard({ level, requirements, description, highlighted }: ConformanceCardProps) {
  return (
    <div className={`p-6 rounded-xl border ${highlighted ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-white/5 border-white/10'}`}>
      <h3 className={`text-xl font-bold mb-2 ${highlighted ? 'text-indigo-300' : 'text-white'}`}>
        BASIS {level}
      </h3>
      <p className="text-sm text-neutral-400 mb-4">{description}</p>
      <ul className="space-y-2">
        {requirements.map((req, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-neutral-300">
            <CheckCircle className={`w-4 h-4 ${highlighted ? 'text-indigo-400' : 'text-emerald-400'}`} />
            {req}
          </li>
        ))}
      </ul>
    </div>
  );
}
