import { BasisLayout } from '@/components/BasisLayout';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Core Specification | BASIS',
  description: 'The normative specification for BASIS - Baseline Authority for Safe & Interoperable Systems. Architecture, trust model, wire protocol.',
};

export default function SpecPage() {
  return (
    <BasisLayout
      title="Core Specification"
      description="The normative specification for BASIS v1.0.0"
      breadcrumb="Specification"
    >
      <div className="space-y-12">
        {/* Status */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-white/5">
              <tr>
                <td className="py-2 text-neutral-500 w-32">Version</td>
                <td className="py-2 text-white font-mono">1.0.0</td>
              </tr>
              <tr>
                <td className="py-2 text-neutral-500">Status</td>
                <td className="py-2 text-emerald-400">Draft Specification</td>
              </tr>
              <tr>
                <td className="py-2 text-neutral-500">Published</td>
                <td className="py-2 text-neutral-300">2026-01-15</td>
              </tr>
              <tr>
                <td className="py-2 text-neutral-500">Editors</td>
                <td className="py-2 text-neutral-300">Vorion Risk, LLC</td>
              </tr>
              <tr>
                <td className="py-2 text-neutral-500">License</td>
                <td className="py-2 text-neutral-300">CC BY 4.0</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Abstract */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Abstract</h2>
          <p className="text-neutral-400 leading-relaxed">
            BASIS is an open standard for AI agent governance that defines how autonomous systems must be controlled, monitored, and audited before taking action. The standard establishes a universal framework for trust quantification, capability gating, and immutable audit trails.
          </p>
          <p className="text-neutral-400 leading-relaxed mt-4">
            This document is the normative specification. Implementations claiming BASIS compliance MUST conform to the requirements herein.
          </p>
        </section>

        {/* Introduction */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">1. Introduction</h2>

          <h3 className="text-xl font-semibold text-white mb-3 mt-6">1.1 Purpose</h3>
          <p className="text-neutral-400 leading-relaxed">
            AI agents are increasingly making autonomous decisions in enterprise environments. These decisions may involve accessing sensitive data, communicating with external parties, processing financial transactions, or modifying critical systems.
          </p>
          <p className="text-neutral-400 leading-relaxed mt-4">
            BASIS addresses a fundamental gap: <strong className="text-white">there is no standard way to verify that an AI agent will behave within defined boundaries before it acts.</strong>
          </p>

          <h3 className="text-xl font-semibold text-white mb-3 mt-6">1.2 Scope</h3>
          <p className="text-neutral-400 leading-relaxed mb-4">This specification defines:</p>
          <ul className="list-disc list-inside space-y-2 text-neutral-400">
            <li><strong className="text-white">Architecture</strong> — The four-layer governance stack (INTENT, ENFORCE, PROOF, CHAIN)</li>
            <li><strong className="text-white">Trust Model</strong> — Quantified trust scoring with tiers and decay mechanics</li>
            <li><strong className="text-white">Capability Model</strong> — Hierarchical capability taxonomy and gating rules</li>
            <li><strong className="text-white">Wire Protocol</strong> — Data formats for interoperability between systems</li>
            <li><strong className="text-white">Audit Requirements</strong> — What must be logged and how</li>
          </ul>

          <h3 className="text-xl font-semibold text-white mb-3 mt-6">1.3 Terminology</h3>
          <p className="text-neutral-400 leading-relaxed mb-4">
            The key words &quot;MUST&quot;, &quot;MUST NOT&quot;, &quot;REQUIRED&quot;, &quot;SHALL&quot;, &quot;SHALL NOT&quot;, &quot;SHOULD&quot;, &quot;SHOULD NOT&quot;, &quot;RECOMMENDED&quot;, &quot;MAY&quot;, and &quot;OPTIONAL&quot; in this document are to be interpreted as described in RFC 2119.
          </p>
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Term</th>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Definition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr>
                  <td className="px-4 py-3 text-white font-mono">Agent</td>
                  <td className="px-4 py-3 text-neutral-400">An autonomous software system capable of taking actions without direct human instruction for each action</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white font-mono">Entity</td>
                  <td className="px-4 py-3 text-neutral-400">Any agent, user, or system that can be assigned a trust score</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white font-mono">Action</td>
                  <td className="px-4 py-3 text-neutral-400">Any operation an agent attempts to perform</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white font-mono">Capability</td>
                  <td className="px-4 py-3 text-neutral-400">A permission to perform a category of actions</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white font-mono">Trust Score</td>
                  <td className="px-4 py-3 text-neutral-400">A numeric value (0-1000) representing earned confidence in an entity</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white font-mono">Governance Decision</td>
                  <td className="px-4 py-3 text-neutral-400">The result of evaluating an action request (ALLOW, DENY, ESCALATE, DEGRADE)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Design Principles */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">1.4 Design Principles</h2>
          <div className="grid gap-4">
            <Principle
              number="1"
              title="Governance Before Execution"
              description="No autonomous action proceeds without passing through governance checks. The governance layer is not optional or bypassable."
            />
            <Principle
              number="2"
              title="Trust is Quantified"
              description="Trust is not binary (allow/deny) but graduated (0-1000) with defined tiers that unlock capabilities progressively."
            />
            <Principle
              number="3"
              title="Everything is Auditable"
              description="Every governance decision is logged with sufficient detail to reconstruct exactly what happened, when, and why."
            />
            <Principle
              number="4"
              title="Open Standard, Many Implementations"
              description="BASIS is the specification. Anyone can build a compliant implementation. No vendor lock-in."
            />
          </div>
        </section>

        {/* Architecture */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">2. Architecture</h2>
          <p className="text-neutral-400 leading-relaxed mb-6">
            BASIS defines a four-layer governance stack. Each layer has distinct responsibilities and interfaces.
          </p>
          <div className="bg-black/30 border border-white/10 rounded-xl p-6 mb-6 overflow-x-auto">
            <pre className="text-sm text-neutral-300 font-mono">
{`┌─────────────────────────────────────────────────────────────┐
│                      Agent Action Request                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1: INTENT                                             │
│  Parse, plan, and classify the requested action              │
│  Output: Structured intent with risk classification          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 2: ENFORCE                                            │
│  Evaluate intent against trust score and policies            │
│  Output: Governance decision (ALLOW/DENY/ESCALATE/DEGRADE)   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 3: PROOF                                              │
│  Log the decision with cryptographic integrity               │
│  Output: Proof record with hash chain                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 4: CHAIN (OPTIONAL)                                   │
│  Anchor proof to external verification system                │
│  Output: Blockchain/ledger commitment                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Action Execution (if ALLOW)             │
└─────────────────────────────────────────────────────────────┘`}
            </pre>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <LayerLink href="/basis/intent" name="INTENT" description="Parse & classify action requests" />
            <LayerLink href="/basis/enforce" name="ENFORCE" description="Evaluate against trust & policies" />
            <LayerLink href="/basis/proof" name="PROOF" description="Log with cryptographic integrity" />
            <LayerLink href="/basis/chain" name="CHAIN" description="Anchor to blockchain (optional)" />
          </div>
        </section>

        {/* Trust Model Summary */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">3. Trust Model</h2>
          <p className="text-neutral-400 leading-relaxed mb-6">
            See the full <Link href="/basis/trust" className="text-indigo-400 hover:text-indigo-300">Trust Model documentation</Link> for complete details.
          </p>
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Tier</th>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Score Range</th>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Default Capabilities</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr><td className="px-4 py-3 text-red-400">Sandbox</td><td className="px-4 py-3 font-mono text-neutral-300">0-99</td><td className="px-4 py-3 text-neutral-400">Isolated testing only</td></tr>
                <tr><td className="px-4 py-3 text-orange-400">Provisional</td><td className="px-4 py-3 font-mono text-neutral-300">100-299</td><td className="px-4 py-3 text-neutral-400">Read public data, internal messaging</td></tr>
                <tr><td className="px-4 py-3 text-yellow-400">Standard</td><td className="px-4 py-3 font-mono text-neutral-300">300-499</td><td className="px-4 py-3 text-neutral-400">Limited external communication</td></tr>
                <tr><td className="px-4 py-3 text-emerald-400">Trusted</td><td className="px-4 py-3 font-mono text-neutral-300">500-699</td><td className="px-4 py-3 text-neutral-400">External API calls</td></tr>
                <tr><td className="px-4 py-3 text-blue-400">Certified</td><td className="px-4 py-3 font-mono text-neutral-300">700-899</td><td className="px-4 py-3 text-neutral-400">Financial transactions</td></tr>
                <tr><td className="px-4 py-3 text-purple-400">Autonomous</td><td className="px-4 py-3 font-mono text-neutral-300">900-1000</td><td className="px-4 py-3 text-neutral-400">Full autonomy within policy</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Conformance */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">8. Conformance Levels</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <h3 className="text-lg font-bold text-white mb-2">BASIS Core</h3>
              <ul className="text-sm text-neutral-400 space-y-1">
                <li>• INTENT layer</li>
                <li>• ENFORCE layer</li>
                <li>• PROOF layer</li>
              </ul>
            </div>
            <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-5">
              <h3 className="text-lg font-bold text-indigo-300 mb-2">BASIS Complete</h3>
              <ul className="text-sm text-neutral-400 space-y-1">
                <li>• All Core requirements</li>
                <li>• CHAIN layer</li>
                <li>• Full capability taxonomy</li>
              </ul>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <h3 className="text-lg font-bold text-white mb-2">BASIS Extended</h3>
              <ul className="text-sm text-neutral-400 space-y-1">
                <li>• All Complete requirements</li>
                <li>• Multi-tenant isolation</li>
                <li>• Federated trust</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Full Spec Link */}
        <section className="border-t border-white/10 pt-8">
          <p className="text-neutral-400 mb-4">
            For the complete specification including wire protocol schemas, API requirements, and detailed conformance criteria, see the full specification on GitHub.
          </p>
          <Link
            href="https://github.com/voriongit/vorion/blob/master/basis-core/specs/BASIS-SPECIFICATION.md"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-semibold rounded hover:bg-neutral-200 transition-colors"
          >
            View Full Specification on GitHub <ArrowRight className="w-4 h-4" />
          </Link>
        </section>
      </div>
    </BasisLayout>
  );
}

function Principle({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex gap-4 p-4 bg-white/5 border border-white/10 rounded-xl">
      <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-indigo-500/20 rounded-lg text-indigo-400 font-mono font-bold">
        {number}
      </div>
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
        <p className="text-neutral-400 text-sm">{description}</p>
      </div>
    </div>
  );
}

function LayerLink({ href, name, description }: { href: string; name: string; description: string }) {
  return (
    <Link href={href} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-white/20 transition-all group">
      <div>
        <h3 className="font-bold text-white">{name}</h3>
        <p className="text-sm text-neutral-400">{description}</p>
      </div>
      <ArrowRight className="w-5 h-5 text-neutral-500 group-hover:text-white transition-colors" />
    </Link>
  );
}
