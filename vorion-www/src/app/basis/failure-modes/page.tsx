import { BasisLayout } from '@/components/BasisLayout';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Failure Modes | BASIS',
  description: 'How BASIS implementations must handle failure conditions with fail-secure, fail-auditable principles.',
};

export default function FailureModesPage() {
  return (
    <BasisLayout
      title="Failure Modes"
      description="Layer-by-layer failure handling"
      breadcrumb="Failure Modes"
    >
      <div className="space-y-12">
        {/* Core Principles */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Core Principles</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <PrincipleCard
              title="Fail Secure"
              description="On failure, default to DENY, not ALLOW. No action proceeds when governance cannot be evaluated."
              color="red"
            />
            <PrincipleCard
              title="Fail Auditable"
              description="All failures MUST be logged. No silent failures allowed in governance systems."
              color="amber"
            />
            <PrincipleCard
              title="Fail Gracefully"
              description="Provide meaningful errors to clients with actionable information."
              color="blue"
            />
            <PrincipleCard
              title="Fail Recoverable"
              description="Design for eventual recovery. Queue operations for retry when appropriate."
              color="emerald"
            />
          </div>
        </section>

        {/* Default Behavior */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Default Behavior</h2>
          <p className="text-neutral-400 leading-relaxed mb-4">
            When any governance component fails, the default behavior is:
          </p>
          <div className="bg-black/30 border border-white/10 rounded-xl p-6">
            <pre className="text-sm text-neutral-300 font-mono">
{`Decision: DENY
Reason: "governance_unavailable"
Code: E1310
Retryable: true`}
            </pre>
          </div>
          <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <p className="text-sm text-red-400">
              <strong>Critical:</strong> Implementations MUST NOT allow actions to proceed when governance cannot be evaluated.
            </p>
          </div>
        </section>

        {/* Layer Failures */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Layer Failure Modes</h2>

          <div className="space-y-6">
            <LayerFailures
              layer="INTENT"
              failures={[
                { id: 'F-INTENT-001', name: 'Parse Failure', behavior: 'DENY', retryable: false },
                { id: 'F-INTENT-002', name: 'Risk Assessment Failure', behavior: 'ESCALATE', retryable: true },
                { id: 'F-INTENT-003', name: 'Service Timeout', behavior: 'DENY', retryable: true },
              ]}
            />
            <LayerFailures
              layer="ENFORCE"
              failures={[
                { id: 'F-ENFORCE-001', name: 'Trust Score Unavailable', behavior: 'DENY', retryable: true },
                { id: 'F-ENFORCE-002', name: 'Policy Evaluation Failure', behavior: 'DENY', retryable: true },
                { id: 'F-ENFORCE-003', name: 'Escalation Target Unavailable', behavior: 'DENY', retryable: true },
              ]}
            />
            <LayerFailures
              layer="PROOF"
              failures={[
                { id: 'F-PROOF-001', name: 'Proof Generation Failure', behavior: 'WARN (action proceeds)', retryable: true },
                { id: 'F-PROOF-002', name: 'Proof Storage Failure', behavior: 'WARN (buffered)', retryable: true },
                { id: 'F-PROOF-003', name: 'Chain Integrity Failure', behavior: 'HALT + ALERT', retryable: false },
              ]}
            />
            <LayerFailures
              layer="CHAIN"
              failures={[
                { id: 'F-CHAIN-001', name: 'Blockchain Unavailable', behavior: 'WARN (queued)', retryable: true },
                { id: 'F-CHAIN-002', name: 'Anchor Transaction Failed', behavior: 'WARN (retry)', retryable: true },
              ]}
            />
          </div>
        </section>

        {/* Recovery */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Recovery Configuration</h2>
          <div className="bg-black/30 border border-white/10 rounded-xl p-6 overflow-x-auto">
            <pre className="text-sm text-neutral-300 font-mono">
{`retry_config:
  default:
    max_attempts: 3
    initial_delay_ms: 100
    max_delay_ms: 5000
    backoff_multiplier: 2.0
    jitter: 0.1

  database:
    max_attempts: 5
    initial_delay_ms: 50
    max_delay_ms: 2000

  blockchain:
    max_attempts: 10
    initial_delay_ms: 1000
    max_delay_ms: 60000`}
            </pre>
          </div>
        </section>

        {/* Monitoring */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Required Monitoring</h2>
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Metric</th>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Alert Threshold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr><td className="px-4 py-3 text-neutral-300 font-mono">intent_parse_failure_rate</td><td className="px-4 py-3 text-red-400">&gt; 5%</td></tr>
                <tr><td className="px-4 py-3 text-neutral-300 font-mono">enforce_decision_latency_p99</td><td className="px-4 py-3 text-red-400">&gt; 500ms</td></tr>
                <tr><td className="px-4 py-3 text-neutral-300 font-mono">proof_generation_failure_rate</td><td className="px-4 py-3 text-red-400">&gt; 1%</td></tr>
                <tr><td className="px-4 py-3 text-neutral-300 font-mono">trust_score_unavailable_rate</td><td className="px-4 py-3 text-red-400">&gt; 0.1%</td></tr>
                <tr><td className="px-4 py-3 text-neutral-300 font-mono">circuit_breaker_open_count</td><td className="px-4 py-3 text-red-400">&gt; 0</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Full Document Link */}
        <section className="border-t border-white/10 pt-8">
          <p className="text-neutral-400 mb-4">
            For complete failure handling including circuit breaker patterns, chaos testing requirements, and game day scenarios, see the full document on GitHub.
          </p>
          <Link
            href="https://github.com/voriongit/vorion/blob/master/basis-core/specs/BASIS-FAILURE-MODES.md"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-semibold rounded hover:bg-neutral-200 transition-colors"
          >
            View Full Failure Modes on GitHub
          </Link>
        </section>
      </div>
    </BasisLayout>
  );
}

function PrincipleCard({ title, description, color }: { title: string; description: string; color: string }) {
  const colors: Record<string, string> = {
    red: 'border-red-500/30 bg-red-500/10',
    amber: 'border-amber-500/30 bg-amber-500/10',
    blue: 'border-blue-500/30 bg-blue-500/10',
    emerald: 'border-emerald-500/30 bg-emerald-500/10',
  };
  const textColors: Record<string, string> = {
    red: 'text-red-400',
    amber: 'text-amber-400',
    blue: 'text-blue-400',
    emerald: 'text-emerald-400',
  };

  return (
    <div className={`p-4 rounded-xl border ${colors[color]}`}>
      <h3 className={`font-bold mb-2 ${textColors[color]}`}>{title}</h3>
      <p className="text-sm text-neutral-400">{description}</p>
    </div>
  );
}

function LayerFailures({ layer, failures }: {
  layer: string;
  failures: Array<{ id: string; name: string; behavior: string; retryable: boolean }>;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-white/5 border-b border-white/5">
        <h3 className="font-bold text-white">{layer} Layer</h3>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-white/5">
          <tr>
            <th className="text-left px-4 py-2 text-neutral-400 font-medium">ID</th>
            <th className="text-left px-4 py-2 text-neutral-400 font-medium">Failure</th>
            <th className="text-left px-4 py-2 text-neutral-400 font-medium">Behavior</th>
            <th className="text-left px-4 py-2 text-neutral-400 font-medium">Retry</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {failures.map((f) => (
            <tr key={f.id}>
              <td className="px-4 py-2 font-mono text-amber-400 text-xs">{f.id}</td>
              <td className="px-4 py-2 text-neutral-300">{f.name}</td>
              <td className="px-4 py-2 text-neutral-400">{f.behavior}</td>
              <td className="px-4 py-2">
                {f.retryable ? (
                  <span className="text-emerald-400">Yes</span>
                ) : (
                  <span className="text-red-400">No</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
