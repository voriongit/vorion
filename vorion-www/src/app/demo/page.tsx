import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Terminal, Package, Zap, CheckCircle, Copy, ExternalLink, Play, Book, Code } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Demo | VORION - Try AI Governance in 5 Minutes',
  description: 'Get hands-on with AI agent trust scoring. Install atsf-core and see governance in action with a working demo.',
};

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200">
      {/* Navigation */}
      <nav className="fixed w-full border-b border-white/5 bg-neutral-950/80 backdrop-blur-md z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/vorion.png" alt="VORION" width={32} height={32} className="rounded" />
            <span className="font-bold text-xl tracking-tighter text-white">VORION</span>
          </Link>
          <div className="flex gap-6 text-sm font-medium text-neutral-400">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Link href="/basis" className="hover:text-white transition-colors">BASIS</Link>
            <Link href="/demo" className="text-indigo-400">Demo</Link>
          </div>
        </div>
      </nav>

      <article className="pt-32 pb-20 px-6 max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>

        {/* Hero */}
        <div className="mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-mono text-indigo-400 mb-6">
            <Play className="w-3 h-3" />
            QUICK START
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-6">
            Try AI Governance in 5 Minutes
          </h1>
          <p className="text-xl text-neutral-400">
            Install atsf-core and see trust scoring in action. No account required.
          </p>
        </div>

        {/* Quick Install */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Terminal className="w-6 h-6 text-indigo-400" />
            Step 1: Install
          </h2>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-neutral-800/50 border-b border-neutral-800">
              <span className="text-xs text-neutral-500 font-mono">Terminal</span>
              <button className="text-neutral-500 hover:text-white transition-colors">
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <pre className="p-4 text-sm overflow-x-auto">
              <code className="text-emerald-400">npm install @vorion/atsf-core</code>
            </pre>
          </div>
        </section>

        {/* Quick Demo */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Code className="w-6 h-6 text-indigo-400" />
            Step 2: Run Demo
          </h2>
          <p className="text-neutral-400 mb-4">
            Create a file called <code className="text-indigo-400 bg-neutral-800 px-2 py-1 rounded">demo.ts</code> and paste:
          </p>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-neutral-800/50 border-b border-neutral-800">
              <span className="text-xs text-neutral-500 font-mono">demo.ts</span>
            </div>
            <pre className="p-4 text-sm overflow-x-auto">
              <code className="text-neutral-300">{`import { createTrustEngine } from '@vorion/atsf-core';

async function main() {
  const engine = createTrustEngine();

  // Initialize an AI agent at Level 2 (Limited)
  const agent = await engine.initializeEntity('aurais-001', 2);
  console.log(\`🤖 Agent initialized: Score \${agent.score}/1000 (L\${agent.level})\`);

  // Simulate successful task
  await engine.recordSignal({
    id: crypto.randomUUID(),
    entityId: 'aurais-001',
    type: 'behavioral.task_success',
    value: 0.95, // High success
    source: 'demo',
    timestamp: new Date().toISOString(),
    metadata: { task: 'send_email' },
  });

  const afterSuccess = await engine.getScore('aurais-001');
  console.log(\`✅ After success: Score \${afterSuccess?.score}/1000\`);

  // Simulate failure
  await engine.recordSignal({
    id: crypto.randomUUID(),
    entityId: 'aurais-001',
    type: 'behavioral.task_failure',
    value: 0.1, // Low value = failure
    source: 'demo',
    timestamp: new Date().toISOString(),
    metadata: { task: 'unauthorized_action' },
  });

  const afterFailure = await engine.getScore('aurais-001');
  console.log(\`❌ After failure: Score \${afterFailure?.score}/1000 (L\${afterFailure?.level})\`);

  // Check if accelerated decay is active
  const isAccelerated = engine.isAcceleratedDecayActive('aurais-001');
  console.log(\`⚡ Accelerated decay: \${isAccelerated ? 'ACTIVE' : 'inactive'}\`);
}

main();`}</code>
            </pre>
          </div>
          <div className="mt-4 bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-neutral-800/50 border-b border-neutral-800">
              <span className="text-xs text-neutral-500 font-mono">Run with</span>
            </div>
            <pre className="p-4 text-sm">
              <code className="text-emerald-400">npx tsx demo.ts</code>
            </pre>
          </div>
        </section>

        {/* Expected Output */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Zap className="w-6 h-6 text-indigo-400" />
            Step 3: See Results
          </h2>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-neutral-800/50 border-b border-neutral-800">
              <span className="text-xs text-neutral-500 font-mono">Output</span>
            </div>
            <pre className="p-4 text-sm">
              <code className="text-neutral-300">{`🤖 Agent initialized: Score 400/1000 (L2)
✅ After success: Score 436/1000
❌ After failure: Score 392/1000 (L2)
⚡ Accelerated decay: inactive`}</code>
            </pre>
          </div>
        </section>

        {/* Key Concepts */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6">What You Just Did</h2>
          <div className="grid gap-4">
            <ConceptCard
              icon={<CheckCircle className="w-5 h-5 text-emerald-400" />}
              title="Created a Trust Engine"
              description="The engine tracks trust scores for AI agents using a 0-1000 scale across 6 tiers."
            />
            <ConceptCard
              icon={<CheckCircle className="w-5 h-5 text-emerald-400" />}
              title="Initialized an Agent"
              description="Agents start at a specific trust level. L2 (Limited) starts at 400 points."
            />
            <ConceptCard
              icon={<CheckCircle className="w-5 h-5 text-emerald-400" />}
              title="Recorded Behavioral Signals"
              description="Signals are weighted by recency. Success raises trust; failure lowers it."
            />
            <ConceptCard
              icon={<CheckCircle className="w-5 h-5 text-emerald-400" />}
              title="Monitored Decay"
              description="After 2+ failures in an hour, decay accelerates 3x to force accountability."
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
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Level</th>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Name</th>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Score</th>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Capabilities</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <TrustRow level="L0" name="Sandbox" score="0-99" capabilities="Sandbox only; no external effects" color="red" />
                <TrustRow level="L1" name="Provisional" score="100-299" capabilities="Basic read; internal messaging" color="orange" />
                <TrustRow level="L2" name="Standard" score="300-499" capabilities="Standard ops; limited external" color="yellow" />
                <TrustRow level="L3" name="Trusted" score="500-699" capabilities="Extended ops; external APIs" color="green" />
                <TrustRow level="L4" name="Certified" score="700-899" capabilities="Privileged ops; financial" color="blue" />
                <TrustRow level="L5" name="Autonomous" score="900-1000" capabilities="Full autonomy within policy" color="purple" />
              </tbody>
            </table>
          </div>
        </section>

        {/* Next Steps */}
        <section className="border-t border-white/10 pt-12">
          <h2 className="text-2xl font-bold text-white mb-6">Next Steps</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <NextStepCard
              icon={<Package className="w-5 h-5 text-indigo-400" />}
              title="npm Documentation"
              description="Full API reference and advanced configuration"
              href="https://npmjs.com/package/@vorion/atsf-core"
            />
            <NextStepCard
              icon={<Book className="w-5 h-5 text-indigo-400" />}
              title="Learn Platform"
              description="Deep dive into AI governance concepts"
              href="https://learn.vorion.org"
            />
            <NextStepCard
              icon={<ExternalLink className="w-5 h-5 text-indigo-400" />}
              title="Cognigate API"
              description="Full runtime with HTTP API"
              href="https://cognigate.dev"
            />
            <NextStepCard
              icon={<ExternalLink className="w-5 h-5 text-indigo-400" />}
              title="AgentAnchor Platform"
              description="Enterprise governance dashboard"
              href="https://agentanchorai.com"
            />
          </div>
        </section>
      </article>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-7xl mx-auto text-center text-sm text-neutral-500">
          <p>VORION • Trust Scoring for AI Agents</p>
          <p className="mt-2">© 2026 Vorion Risk, LLC.</p>
        </div>
      </footer>
    </div>
  );
}

function ConceptCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex gap-4 p-4 rounded-xl bg-white/5 border border-white/5">
      <div className="flex-shrink-0 mt-1">{icon}</div>
      <div>
        <h3 className="font-semibold text-white mb-1">{title}</h3>
        <p className="text-sm text-neutral-400">{description}</p>
      </div>
    </div>
  );
}

function TrustRow({ level, name, score, capabilities, color }: { level: string; name: string; score: string; capabilities: string; color: string }) {
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
      <td className="px-4 py-3 font-mono text-neutral-300">{level}</td>
      <td className={`px-4 py-3 font-medium ${colorClasses[color]}`}>{name}</td>
      <td className="px-4 py-3 text-neutral-400 font-mono">{score}</td>
      <td className="px-4 py-3 text-neutral-400">{capabilities}</td>
    </tr>
  );
}

function NextStepCard({ icon, title, description, href }: { icon: React.ReactNode; title: string; description: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/5 hover:border-indigo-500/50 transition-all group"
    >
      <div className="p-2 rounded-lg bg-white/5">{icon}</div>
      <div>
        <h3 className="font-semibold text-white mb-1 group-hover:text-indigo-400 transition-colors">{title}</h3>
        <p className="text-sm text-neutral-400">{description}</p>
      </div>
    </a>
  );
}
