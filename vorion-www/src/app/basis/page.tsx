import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, Shield, Cpu, Database, Link2, Scale, ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BASIS | Open Standard for AI Agent Governance',
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
            <Link href="https://github.com/voriongit" className="hover:text-white transition-colors">GitHub</Link>
          </div>
        </div>
      </nav>

      <article className="pt-32 pb-20 px-6 max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>

        {/* Hero */}
        <div className="mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-mono text-amber-400 mb-6">
            <Scale className="w-3 h-3" />
            OPEN STANDARD
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tight mb-6">
            BASIS
          </h1>
          <p className="text-2xl text-neutral-400 mb-4">
            Baseline Authority for Safe & Interoperable Systems
          </p>
          <p className="text-lg text-neutral-500 max-w-2xl">
            The open standard for AI agent governance. Defining what must happen before an AI agent acts.
          </p>
        </div>

        {/* The Problem */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6">The Problem</h2>
          <p className="text-neutral-400 leading-relaxed mb-4">
            AI agents are making autonomous decisions. Right now, there&apos;s no standard way to:
          </p>
          <ul className="space-y-2 text-neutral-400">
            <li className="flex items-start gap-3">
              <span className="text-red-400 mt-1">•</span>
              <span><strong className="text-white">Verify</strong> an agent will behave within bounds</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-red-400 mt-1">•</span>
              <span><strong className="text-white">Trust</strong> that governance checks happen before action</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-red-400 mt-1">•</span>
              <span><strong className="text-white">Audit</strong> what decisions were made and why</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-red-400 mt-1">•</span>
              <span><strong className="text-white">Interoperate</strong> between different agent systems</span>
            </li>
          </ul>
        </section>

        {/* The Stack */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6">The Four Layers</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <LayerCard
              icon={<Cpu className="w-6 h-6 text-blue-400" />}
              name="INTENT"
              subtitle="Parse & Plan"
              description="Understand what the agent wants to do. Parse, plan, and classify risk."
              href="https://vorion.org/basis/layers/intent"
              color="blue"
            />
            <LayerCard
              icon={<Shield className="w-6 h-6 text-indigo-400" />}
              name="ENFORCE"
              subtitle="Trust & Gate"
              description="Check if it's allowed based on trust score and policy."
              href="https://vorion.org/basis/layers/enforce"
              color="indigo"
            />
            <LayerCard
              icon={<Database className="w-6 h-6 text-emerald-400" />}
              name="PROOF"
              subtitle="Log & Audit"
              description="Create immutable, cryptographically chained audit trail."
              href="https://vorion.org/basis/layers/proof"
              color="emerald"
            />
            <LayerCard
              icon={<Link2 className="w-6 h-6 text-purple-400" />}
              name="CHAIN"
              subtitle="Anchor & Verify"
              description="Commit proofs to blockchain for independent verification."
              href="https://vorion.org/basis/layers/chain"
              color="purple"
            />
          </div>
        </section>

        {/* Core Principles */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6">Core Principles</h2>
          <div className="space-y-6">
            <Principle
              number="01"
              title="Governance Before Execution"
              description="No autonomous action proceeds without passing through governance checks. Period."
            />
            <Principle
              number="02"
              title="Trust is Quantified"
              description="Not binary allow/deny, but graduated trust scores (0-1000) that unlock capabilities progressively."
            />
            <Principle
              number="03"
              title="Everything is Auditable"
              description="Every governance decision is logged with enough detail to reconstruct exactly what happened."
            />
            <Principle
              number="04"
              title="Open Standard, Many Implementations"
              description="BASIS is the spec. Anyone can build a compliant implementation. No vendor lock-in."
            />
          </div>
        </section>

        {/* Trust Tiers */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6">Trust Tiers</h2>
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Tier</th>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Score</th>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Capabilities</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <TrustRow tier="Unverified" score="0-99" capabilities="Sandbox only" color="red" />
                <TrustRow tier="Provisional" score="100-299" capabilities="Basic operations" color="orange" />
                <TrustRow tier="Certified" score="300-499" capabilities="Standard operations" color="yellow" />
                <TrustRow tier="Trusted" score="500-699" capabilities="Extended operations" color="green" />
                <TrustRow tier="Verified" score="700-899" capabilities="Privileged operations" color="blue" />
                <TrustRow tier="Sovereign" score="900-1000" capabilities="Full autonomy" color="purple" />
              </tbody>
            </table>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-white/10 pt-12">
          <h2 className="text-2xl font-bold text-white mb-6">Get Started</h2>
          <div className="flex flex-wrap gap-4">
            <Link
              href="https://vorion.org/basis"
              className="px-6 py-3 bg-white text-black font-semibold rounded hover:bg-neutral-200 transition-colors flex items-center gap-2"
            >
              Read the Full Spec <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="https://vorion.org/basis/implement/getting-started"
              className="px-6 py-3 border border-white/10 rounded text-white hover:bg-white/5 transition-colors flex items-center gap-2"
            >
              Implementation Guide <ExternalLink className="w-4 h-4" />
            </Link>
            <Link
              href="https://github.com/voriongit/cognigate"
              className="px-6 py-3 border border-white/10 rounded text-white hover:bg-white/5 transition-colors"
            >
              View on GitHub
            </Link>
          </div>
        </section>
      </article>

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
  icon: React.ReactNode;
  name: string;
  subtitle: string;
  description: string;
  href: string;
  color: string;
}

function LayerCard({ icon, name, subtitle, description, href }: LayerCardProps) {
  const isExternal = href.startsWith('http');
  return (
    <Link
      href={href}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      className="block p-6 rounded-xl bg-white/5 border border-white/5 hover:border-indigo-500/50 transition-all hover:translate-y-[-2px] group"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/5 rounded-lg">{icon}</div>
          <div>
            <h3 className="text-lg font-bold text-white">{name}</h3>
            <p className="text-xs font-mono text-neutral-500 uppercase">{subtitle}</p>
          </div>
        </div>
        {isExternal && <ExternalLink className="w-4 h-4 text-neutral-600 group-hover:text-neutral-400 transition-colors" />}
      </div>
      <p className="text-sm text-neutral-400">{description}</p>
    </Link>
  );
}

interface PrincipleProps {
  number: string;
  title: string;
  description: string;
}

function Principle({ number, title, description }: PrincipleProps) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-indigo-500/10 rounded-lg text-indigo-400 font-mono text-sm">
        {number}
      </div>
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
        <p className="text-neutral-400">{description}</p>
      </div>
    </div>
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
