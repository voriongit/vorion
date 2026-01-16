import { BasisLayout } from '@/components/BasisLayout';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Migration Guide | BASIS',
  description: 'Five-phase adoption roadmap for implementing BASIS in existing AI agent systems.',
};

export default function MigrationPage() {
  return (
    <BasisLayout
      title="Migration Guide"
      description="5-phase adoption roadmap"
      breadcrumb="Migration"
    >
      <div className="space-y-12">
        {/* Overview */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Overview</h2>
          <p className="text-neutral-400 leading-relaxed">
            This guide provides a phased approach to adopting BASIS in existing AI agent systems. Each phase builds on the previous, allowing gradual integration with minimal disruption.
          </p>
        </section>

        {/* Five Phases */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Five-Phase Roadmap</h2>
          <div className="space-y-4">
            <PhaseCard
              number={1}
              name="Assessment"
              description="Inventory current agent capabilities, identify governance gaps, define trust requirements"
              activities={[
                'Catalog all agent actions and capabilities',
                'Map current permissions to BASIS capability taxonomy',
                'Identify high-risk operations requiring governance',
                'Define initial trust tier requirements'
              ]}
            />
            <PhaseCard
              number={2}
              name="Audit-Only"
              description="Deploy BASIS in observation mode, logging all decisions without enforcement"
              activities={[
                'Deploy INTENT and PROOF layers',
                'Log all agent actions without blocking',
                'Establish baseline metrics and patterns',
                'Validate risk classification accuracy'
              ]}
            />
            <PhaseCard
              number={3}
              name="Shadow Mode"
              description="Run ENFORCE layer in parallel, compare decisions to actual outcomes"
              activities={[
                'Deploy ENFORCE layer in shadow mode',
                'Compare governance decisions to actual behavior',
                'Tune policies based on false positives/negatives',
                'Train teams on escalation procedures'
              ]}
            />
            <PhaseCard
              number={4}
              name="Gradual Enforcement"
              description="Enable enforcement for low-risk operations, expand progressively"
              activities={[
                'Enable enforcement for lowest-risk capabilities first',
                'Monitor for unexpected blocks or escalations',
                'Gradually expand to medium and high-risk operations',
                'Implement CHAIN layer if required'
              ]}
            />
            <PhaseCard
              number={5}
              name="Full Enforcement"
              description="Complete governance coverage with continuous optimization"
              activities={[
                'Enable enforcement for all operations',
                'Establish ongoing monitoring and alerting',
                'Conduct regular policy reviews',
                'Maintain compliance certifications'
              ]}
            />
          </div>
        </section>

        {/* Integration Patterns */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Integration Patterns</h2>

          <h3 className="text-xl font-semibold text-white mb-3 mt-6">LangChain Integration</h3>
          <div className="bg-black/30 border border-white/10 rounded-xl p-6 overflow-x-auto">
            <pre className="text-sm text-neutral-300 font-mono">
{`from langchain.tools import BaseTool
from basis import BasisClient

basis = BasisClient(api_key="...")

class GovernedTool(BaseTool):
    def _run(self, query: str) -> str:
        # Submit to INTENT layer
        intent = basis.intent.parse(
            entity_id=self.agent_id,
            action=query,
            capabilities=self.required_capabilities
        )

        # Get governance decision
        decision = basis.enforce.evaluate(intent)

        if decision.result == "DENY":
            raise PermissionError(decision.reason)

        if decision.result == "ESCALATE":
            decision = basis.escalate.wait(decision)

        # Execute with proof logging
        result = self._execute(query)
        basis.proof.record(intent, decision, result)

        return result`}
            </pre>
          </div>

          <h3 className="text-xl font-semibold text-white mb-3 mt-6">REST API Integration</h3>
          <div className="bg-black/30 border border-white/10 rounded-xl p-6 overflow-x-auto">
            <pre className="text-sm text-neutral-300 font-mono">
{`// Before action execution
const intent = await fetch('https://api.cognigate.dev/v1/intent', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ...' },
  body: JSON.stringify({
    entity_id: 'ent_agent_001',
    raw_input: 'Send email to customer@example.com',
    capabilities_required: ['comm:external/email']
  })
}).then(r => r.json());

const decision = await fetch('https://api.cognigate.dev/v1/enforce', {
  method: 'POST',
  body: JSON.stringify({ intent_id: intent.intent_id })
}).then(r => r.json());

if (decision.decision === 'ALLOW') {
  // Execute action
  await sendEmail(...);

  // Log proof
  await fetch('https://api.cognigate.dev/v1/proof', {
    method: 'POST',
    body: JSON.stringify({
      intent_id: intent.intent_id,
      decision: decision.decision,
      outcome: 'success'
    })
  });
}`}
            </pre>
          </div>
        </section>

        {/* Common Challenges */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Common Challenges</h2>
          <div className="space-y-4">
            <ChallengeCard
              challenge="Legacy agents without structured actions"
              solution="Start with INTENT layer to parse and structure existing agent outputs before enforcement."
            />
            <ChallengeCard
              challenge="High volume of false positives during shadow mode"
              solution="Use the shadow period to tune risk classification. Conservative initially, then adjust based on observed patterns."
            />
            <ChallengeCard
              challenge="Resistance to escalation workflow changes"
              solution="Begin with high-risk operations only. Demonstrate value through audit trail and compliance reporting."
            />
            <ChallengeCard
              challenge="Performance concerns with synchronous governance"
              solution="Use async proof logging. Consider caching for repeat capability checks. ENFORCE typically adds < 50ms."
            />
          </div>
        </section>

        {/* Full Guide Link */}
        <section className="border-t border-white/10 pt-8">
          <p className="text-neutral-400 mb-4">
            For the complete migration guide including detailed checklists, rollback procedures, and case studies, see the full document on GitHub.
          </p>
          <Link
            href="https://github.com/voriongit/vorion/blob/master/basis-core/specs/BASIS-MIGRATION-GUIDE.md"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-semibold rounded hover:bg-neutral-200 transition-colors"
          >
            View Full Migration Guide on GitHub
          </Link>
        </section>
      </div>
    </BasisLayout>
  );
}

function PhaseCard({ number, name, description, activities }: {
  number: number;
  name: string;
  description: string;
  activities: string[];
}) {
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500', 'bg-blue-500'];

  return (
    <div className="flex gap-4 p-5 bg-white/5 border border-white/10 rounded-xl">
      <div className={`flex-shrink-0 w-10 h-10 ${colors[number - 1]} rounded-full flex items-center justify-center text-white font-bold`}>
        {number}
      </div>
      <div className="flex-1">
        <h3 className="text-lg font-bold text-white mb-1">{name}</h3>
        <p className="text-sm text-neutral-400 mb-3">{description}</p>
        <ul className="space-y-1">
          {activities.map((activity, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-neutral-300">
              <span className="text-emerald-400 mt-0.5">•</span> {activity}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ChallengeCard({ challenge, solution }: { challenge: string; solution: string }) {
  return (
    <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
      <p className="text-sm text-amber-400 mb-2"><strong>Challenge:</strong> {challenge}</p>
      <p className="text-sm text-emerald-400"><strong>Solution:</strong> {solution}</p>
    </div>
  );
}
