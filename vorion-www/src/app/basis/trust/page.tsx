import { BasisLayout } from '@/components/BasisLayout';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trust Model | BASIS',
  description: 'The BASIS trust model: 0-1000 scoring, six tiers, decay mechanics, and failure amplification.',
};

export default function TrustPage() {
  return (
    <BasisLayout
      title="Trust Model"
      description="Quantified trust scoring with tiers and dynamics"
      breadcrumb="Trust Model"
    >
      <div className="space-y-12">
        {/* Overview */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Overview</h2>
          <p className="text-neutral-400 leading-relaxed">
            BASIS uses a quantified trust model where entities earn trust through successful operations. Trust is not binary (allow/deny) but graduated on a 0-1000 scale with six tiers that progressively unlock capabilities.
          </p>
        </section>

        {/* Trust Score Range */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Trust Score Range</h2>
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-red-400 font-mono">0</span>
              <span className="text-purple-400 font-mono">1000</span>
            </div>
            <div className="h-4 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 to-purple-500 mb-4"></div>
            <div className="flex justify-between text-xs text-neutral-500">
              <span>Sandbox</span>
              <span>Provisional</span>
              <span>Standard</span>
              <span>Trusted</span>
              <span>Certified</span>
              <span>Autonomous</span>
            </div>
          </div>
        </section>

        {/* Trust Tiers */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Six Trust Tiers</h2>
          <div className="space-y-4">
            <TierCard
              name="Sandbox"
              range="0-99"
              color="red"
              capabilities={['Isolated testing only', 'No external access', 'No data persistence']}
              description="New or untrusted entities. Completely sandboxed for evaluation."
            />
            <TierCard
              name="Provisional"
              range="100-299"
              color="orange"
              capabilities={['Read public data', 'Internal messaging', 'Basic queries']}
              description="Initial trust established. Limited read access, heavy monitoring."
            />
            <TierCard
              name="Standard"
              range="300-499"
              color="yellow"
              capabilities={['Write internal data', 'Limited external read', 'Standard workflows']}
              description="Established track record. Standard operations with normal oversight."
            />
            <TierCard
              name="Trusted"
              range="500-699"
              color="green"
              capabilities={['External API calls', 'Email communication', 'Extended permissions']}
              description="Proven reliability. External interactions permitted with light oversight."
            />
            <TierCard
              name="Certified"
              range="700-899"
              color="blue"
              capabilities={['Financial transactions', 'Sensitive data access', 'Privileged operations']}
              description="High trust verified. Financial and sensitive operations with minimal oversight."
            />
            <TierCard
              name="Autonomous"
              range="900-1000"
              color="purple"
              capabilities={['Full autonomy within policy', 'Administrative functions', 'Audit-only oversight']}
              description="Maximum trust achieved. Complete autonomy within defined policy boundaries."
            />
          </div>
        </section>

        {/* Trust Dynamics */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Trust Dynamics</h2>

          <h3 className="text-xl font-semibold text-white mb-3 mt-6">Decay</h3>
          <p className="text-neutral-400 leading-relaxed mb-4">
            Trust scores decay over time to prevent stale high-trust entities. The decay follows a half-life model:
          </p>
          <div className="bg-black/30 border border-white/10 rounded-xl p-6 mb-4">
            <pre className="text-sm text-neutral-300 font-mono">
{`DECAY_HALF_LIFE_DAYS = 7

decay_factor = 0.5 ^ (days_since_last_action / DECAY_HALF_LIFE_DAYS)
decayed_score = current_score * decay_factor`}
            </pre>
          </div>
          <p className="text-neutral-400 text-sm">
            Example: An agent with score 800 that takes no action for 7 days decays to 400.
          </p>

          <h3 className="text-xl font-semibold text-white mb-3 mt-8">Failure Amplification</h3>
          <p className="text-neutral-400 leading-relaxed mb-4">
            Failures hurt trust more than successes help. This asymmetry encourages conservative behavior:
          </p>
          <div className="bg-black/30 border border-white/10 rounded-xl p-6 mb-4">
            <pre className="text-sm text-neutral-300 font-mono">
{`FAILURE_MULTIPLIER = 3.0

if action_delta < 0:
    action_delta = action_delta * FAILURE_MULTIPLIER`}
            </pre>
          </div>
          <p className="text-neutral-400 text-sm">
            Example: A failed action that would normally cost -10 points instead costs -30 points.
          </p>

          <h3 className="text-xl font-semibold text-white mb-3 mt-8">Tier Boundaries</h3>
          <p className="text-neutral-400 leading-relaxed mb-4">
            Trust tiers have hard boundaries. An entity cannot skip tiers and must progress through each level:
          </p>
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Transition</th>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Minimum Actions</th>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Success Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr><td className="px-4 py-3 text-neutral-300">Sandbox → Provisional</td><td className="px-4 py-3 font-mono text-neutral-400">10</td><td className="px-4 py-3 text-neutral-400">100%</td></tr>
                <tr><td className="px-4 py-3 text-neutral-300">Provisional → Standard</td><td className="px-4 py-3 font-mono text-neutral-400">50</td><td className="px-4 py-3 text-neutral-400">95%</td></tr>
                <tr><td className="px-4 py-3 text-neutral-300">Standard → Trusted</td><td className="px-4 py-3 font-mono text-neutral-400">100</td><td className="px-4 py-3 text-neutral-400">98%</td></tr>
                <tr><td className="px-4 py-3 text-neutral-300">Trusted → Certified</td><td className="px-4 py-3 font-mono text-neutral-400">500</td><td className="px-4 py-3 text-neutral-400">99%</td></tr>
                <tr><td className="px-4 py-3 text-neutral-300">Certified → Autonomous</td><td className="px-4 py-3 font-mono text-neutral-400">1000</td><td className="px-4 py-3 text-neutral-400">99.9%</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Trust Score Algorithm */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Trust Score Algorithm</h2>
          <div className="bg-black/30 border border-white/10 rounded-xl p-6 overflow-x-auto">
            <pre className="text-sm text-neutral-300 font-mono">
{`# Constants
DECAY_HALF_LIFE_DAYS = 7
FAILURE_MULTIPLIER = 3.0

# Action deltas by outcome
ACTION_DELTAS = {
    "success_low_risk": 5,
    "success_medium_risk": 10,
    "success_high_risk": 25,
    "success_critical_risk": 50,
    "failure_low_risk": -10,
    "failure_medium_risk": -25,
    "failure_high_risk": -50,
    "failure_critical_risk": -100,
    "policy_violation": -200,
    "security_incident": -500
}

def calculate_trust_score(
    current_score: int,
    days_since_last_action: float,
    action_outcome: str
) -> int:
    # Apply decay
    decay_factor = 0.5 ** (days_since_last_action / DECAY_HALF_LIFE_DAYS)
    decayed_score = current_score * decay_factor

    # Get delta for action
    delta = ACTION_DELTAS.get(action_outcome, 0)

    # Apply failure multiplier
    if delta < 0:
        delta = delta * FAILURE_MULTIPLIER

    # Calculate new score with bounds
    new_score = max(0, min(1000, int(decayed_score + delta)))

    return new_score`}
            </pre>
          </div>
        </section>

        {/* Tier Derivation */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Tier Derivation</h2>
          <div className="bg-black/30 border border-white/10 rounded-xl p-6 overflow-x-auto">
            <pre className="text-sm text-neutral-300 font-mono">
{`def get_trust_tier(score: int) -> str:
    if score >= 900:
        return "autonomous"
    elif score >= 700:
        return "certified"
    elif score >= 500:
        return "trusted"
    elif score >= 300:
        return "standard"
    elif score >= 100:
        return "provisional"
    else:
        return "sandbox"`}
            </pre>
          </div>
        </section>
      </div>
    </BasisLayout>
  );
}

function TierCard({ name, range, color, capabilities, description }: {
  name: string;
  range: string;
  color: string;
  capabilities: string[];
  description: string;
}) {
  const colors: Record<string, string> = {
    red: 'border-red-500/30 bg-red-500/10',
    orange: 'border-orange-500/30 bg-orange-500/10',
    yellow: 'border-yellow-500/30 bg-yellow-500/10',
    green: 'border-emerald-500/30 bg-emerald-500/10',
    blue: 'border-blue-500/30 bg-blue-500/10',
    purple: 'border-purple-500/30 bg-purple-500/10',
  };
  const textColors: Record<string, string> = {
    red: 'text-red-400',
    orange: 'text-orange-400',
    yellow: 'text-yellow-400',
    green: 'text-emerald-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
  };

  return (
    <div className={`p-5 rounded-xl border ${colors[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className={`text-xl font-bold ${textColors[color]}`}>{name}</h3>
        <span className="font-mono text-sm text-neutral-400">{range}</span>
      </div>
      <p className="text-neutral-400 text-sm mb-3">{description}</p>
      <ul className="space-y-1">
        {capabilities.map((cap, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-neutral-300">
            <span className={textColors[color]}>•</span> {cap}
          </li>
        ))}
      </ul>
    </div>
  );
}
