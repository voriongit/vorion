import { BasisLayout } from '@/components/BasisLayout';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ENFORCE Layer | BASIS',
  description: 'The ENFORCE layer evaluates structured intents against trust scores and policies, returning governance decisions.',
};

export default function EnforcePage() {
  return (
    <BasisLayout
      title="ENFORCE Layer"
      description="Evaluate intent against trust score and policies"
      breadcrumb="ENFORCE"
    >
      <div className="space-y-12">
        {/* Overview */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Overview</h2>
          <p className="text-neutral-400 leading-relaxed">
            The ENFORCE layer evaluates structured intents against the entity&apos;s trust score and applicable policies. It is the decision-making core of the governance system.
          </p>
        </section>

        {/* Responsibilities */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Responsibilities</h2>
          <ul className="space-y-3">
            <Responsibility title="Retrieve trust score" description="Get current trust score for the requesting entity" />
            <Responsibility title="Check capabilities" description="Verify required capabilities are unlocked at current trust tier" />
            <Responsibility title="Apply policy rules" description="Evaluate organization-specific policy constraints and obligations" />
            <Responsibility title="Determine decision" description="Return ALLOW, DENY, ESCALATE, or DEGRADE" />
            <Responsibility title="Calculate impact" description="Determine trust score impact of the decision" />
          </ul>
        </section>

        {/* Governance Decisions */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Governance Decisions</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <DecisionCard
              decision="ALLOW"
              color="emerald"
              description="Action may proceed as requested"
              behavior="Pass intent to execution with full approval"
            />
            <DecisionCard
              decision="DENY"
              color="red"
              description="Action is blocked; no execution permitted"
              behavior="Return error to agent with denial reason"
            />
            <DecisionCard
              decision="ESCALATE"
              color="amber"
              description="Action requires human approval"
              behavior="Queue for human review, block until approved"
            />
            <DecisionCard
              decision="DEGRADE"
              color="blue"
              description="Action may proceed with reduced scope"
              behavior="Allow partial execution with constraints"
            />
          </div>
        </section>

        {/* Requirements */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Requirements</h2>
          <div className="space-y-4">
            <Requirement level="MUST" text="Return exactly one decision: ALLOW, DENY, ESCALATE, or DEGRADE" />
            <Requirement level="MUST" text="Include the trust score at decision time" />
            <Requirement level="MUST" text="Include denial reason if decision is DENY" />
            <Requirement level="MUST" text="Include escalation target if decision is ESCALATE" />
            <Requirement level="MUST" text="Include degraded capability if decision is DEGRADE" />
            <Requirement level="MUST NOT" text="Modify trust score within this layer (scoring happens post-action)" />
          </div>
        </section>

        {/* EnforceResponse Schema */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">EnforceResponse Schema</h2>
          <div className="bg-black/30 border border-white/10 rounded-xl p-6 overflow-x-auto">
            <pre className="text-sm text-neutral-300 font-mono">
{`{
  "decision": "ALLOW",
  "intent_id": "int_abc123xyz",
  "entity_id": "ent_agent_001",
  "timestamp": "2026-01-15T10:30:01Z",
  "trust_score_at_decision": 650,
  "trust_tier_at_decision": "trusted",
  "policies_evaluated": [
    "pol_default",
    "pol_finance_restricted"
  ],
  "capabilities_checked": [
    {
      "capability": "comm:internal/message",
      "granted": true,
      "reason": "tier_sufficient"
    }
  ],
  "denial_reason": null,
  "escalation_target": null,
  "degraded_to": null,
  "trust_impact": {
    "projected_delta": 5,
    "reason": "successful_low_risk_action"
  }
}`}
            </pre>
          </div>
        </section>

        {/* Policy Evaluation */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Policy Evaluation</h2>
          <p className="text-neutral-400 leading-relaxed mb-4">
            Policies are evaluated in the following order:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-neutral-400">
            <li><strong className="text-white">Default deny</strong> — Start with DENY as baseline</li>
            <li><strong className="text-white">Trust tier check</strong> — Does entity&apos;s tier unlock required capabilities?</li>
            <li><strong className="text-white">Policy constraints</strong> — Do any policies explicitly block this action?</li>
            <li><strong className="text-white">Policy permissions</strong> — Do any policies explicitly allow this action?</li>
            <li><strong className="text-white">Obligations</strong> — Are there any obligations (escalation, logging) that apply?</li>
          </ol>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mt-4">
            <p className="text-sm text-amber-400">
              <strong>Important:</strong> Policy evaluation MUST be atomic. There MUST NOT be time-of-check to time-of-use (TOCTOU) vulnerabilities.
            </p>
          </div>
        </section>

        {/* Escalation */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Escalation Handling</h2>
          <p className="text-neutral-400 leading-relaxed mb-4">
            When decision is ESCALATE, the following fields MUST be included:
          </p>
          <div className="bg-black/30 border border-white/10 rounded-xl p-6 overflow-x-auto">
            <pre className="text-sm text-neutral-300 font-mono">
{`{
  "decision": "ESCALATE",
  "escalation_target": {
    "type": "human_reviewer",
    "pool": "security_team",
    "timeout_minutes": 60,
    "fallback_decision": "DENY"
  },
  "escalation_context": {
    "reason": "high_value_transaction",
    "threshold_exceeded": "transaction_value > 10000",
    "additional_info": "First transaction of this type for entity"
  }
}`}
            </pre>
          </div>
        </section>
      </div>
    </BasisLayout>
  );
}

function Responsibility({ title, description }: { title: string; description: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="text-indigo-400 mt-1">•</span>
      <div>
        <strong className="text-white">{title}</strong>
        <span className="text-neutral-400"> — {description}</span>
      </div>
    </li>
  );
}

function Requirement({ level, text }: { level: string; text: string }) {
  const colors: Record<string, string> = {
    MUST: 'bg-red-500/20 text-red-400 border-red-500/30',
    'MUST NOT': 'bg-red-500/20 text-red-400 border-red-500/30',
    SHOULD: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    MAY: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg">
      <span className={`px-2 py-1 text-xs font-mono font-bold rounded border ${colors[level]}`}>{level}</span>
      <span className="text-neutral-300">{text}</span>
    </div>
  );
}

function DecisionCard({ decision, color, description, behavior }: { decision: string; color: string; description: string; behavior: string }) {
  const colors: Record<string, string> = {
    emerald: 'border-emerald-500/30 bg-emerald-500/10',
    red: 'border-red-500/30 bg-red-500/10',
    amber: 'border-amber-500/30 bg-amber-500/10',
    blue: 'border-blue-500/30 bg-blue-500/10',
  };
  const textColors: Record<string, string> = {
    emerald: 'text-emerald-400',
    red: 'text-red-400',
    amber: 'text-amber-400',
    blue: 'text-blue-400',
  };

  return (
    <div className={`p-4 rounded-xl border ${colors[color]}`}>
      <h3 className={`text-lg font-bold font-mono mb-2 ${textColors[color]}`}>{decision}</h3>
      <p className="text-neutral-300 text-sm mb-2">{description}</p>
      <p className="text-neutral-500 text-xs">{behavior}</p>
    </div>
  );
}
