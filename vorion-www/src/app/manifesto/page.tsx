import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'The Manifesto | VORION',
  description: 'The BASIS Solution: Separating Reasoning from Authority in autonomous AI systems.',
};

export default function Manifesto() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200">
      {/* Navigation */}
      <nav className="fixed w-full border-b border-white/5 bg-neutral-950/80 backdrop-blur-md z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/vorion.png" alt="VORION" width={32} height={32} className="rounded" />
            <span className="font-bold text-xl tracking-tighter text-white">VORION<span className="text-indigo-500">.ORG</span></span>
          </Link>
        </div>
      </nav>

      <article className="pt-32 pb-20 px-6 max-w-3xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>

        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-8">
          The Manifesto
        </h1>

        <div className="prose prose-invert prose-lg max-w-none">
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">The Paradox of Autonomy</h2>
            <p className="text-neutral-400 leading-relaxed">
              As AI models gain agency, the risk shifts from &ldquo;generation&rdquo; (what they say) to
              &ldquo;execution&rdquo; (what they do). A model that can execute API calls, sign contracts,
              or move funds cannot be governed by &ldquo;prompt engineering&rdquo; alone.
            </p>
            <p className="text-neutral-400 leading-relaxed mt-4">
              It requires a <span className="text-white font-semibold">hard constraint layer</span>.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">The BASIS Solution</h2>
            <p className="text-neutral-400 leading-relaxed mb-6">
              BASIS separates <span className="text-indigo-400 font-semibold">Reasoning</span> from{' '}
              <span className="text-indigo-400 font-semibold">Authority</span>.
            </p>

            <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
              <h3 className="text-lg font-bold text-white mb-3">1. The Separation of Powers</h3>
              <ul className="space-y-2 text-neutral-400">
                <li className="flex items-start gap-2">
                  <span className="text-indigo-400 mt-1">•</span>
                  <span><strong className="text-white">The Reasoner (LLM)</strong> calculates the <em>best</em> path to a goal.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-400 mt-1">•</span>
                  <span><strong className="text-white">The Governor (BASIS)</strong> determines the <em>allowable</em> path.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-400 mt-1">•</span>
                  <span>These two functions must never exist in the same runtime memory.</span>
                </li>
              </ul>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-3">2. The Chain of Custody</h3>
              <p className="text-neutral-400 mb-4">
                Every autonomous action must be traceable to a specific, authorized Human Intent.
              </p>
              <div className="font-mono text-sm space-y-1 text-neutral-500">
                <p><span className="text-blue-400">Intent:</span> &ldquo;Buy a server.&rdquo;</p>
                <p><span className="text-amber-400">Plan:</span> &ldquo;Use AWS API to provision t3.micro.&rdquo;</p>
                <p><span className="text-emerald-400">Proof:</span> &ldquo;User ID 123 authorized this at 10:00 AM.&rdquo;</p>
              </div>
              <p className="text-neutral-400 mt-4">
                Without this chain, the action is <span className="text-red-400 font-semibold">Unauthorized</span> and
                must be blocked by the ENFORCE layer.
              </p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">Core Directives</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h3 className="font-bold text-white mb-2">01. Binding</h3>
                <p className="text-sm text-neutral-400">
                  Reasoning layers (INTENT) must never override BASIS constraints.
                </p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h3 className="font-bold text-white mb-2">02. Identification</h3>
                <p className="text-sm text-neutral-400">
                  All autonomous agents must carry a cryptographically verifiable Identity (VID).
                </p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h3 className="font-bold text-white mb-2">03. Least Privilege</h3>
                <p className="text-sm text-neutral-400">
                  Execution is denied by default until explicitly allowed by an ENFORCE gate.
                </p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h3 className="font-bold text-white mb-2">04. Immutability</h3>
                <p className="text-sm text-neutral-400">
                  All enforcement decisions must be written to the PROOF ledger.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Adoption</h2>
            <p className="text-neutral-400 leading-relaxed">
              BASIS is open-source and jurisdiction-agnostic. It is designed to be implemented by
              any organization, ensuring that safety is not a proprietary feature, but a{' '}
              <span className="text-white font-semibold">baseline requirement</span>.
            </p>
            <div className="mt-8">
              <Link
                href="https://basis.vorion.org"
                className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded hover:bg-indigo-500 transition-colors"
              >
                Read the Technical Standard →
              </Link>
            </div>
          </section>
        </div>
      </article>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-7xl mx-auto text-center text-sm text-neutral-500">
          <p>© 2026 Vorion Risk, LLC.</p>
        </div>
      </footer>
    </div>
  );
}
