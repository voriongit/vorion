import { BasisLayout } from '@/components/BasisLayout';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Capability Taxonomy | BASIS',
  description: 'The BASIS capability taxonomy: 100+ capabilities across 7 namespaces with tier requirements.',
};

export default function CapabilitiesPage() {
  return (
    <BasisLayout
      title="Capability Taxonomy"
      description="100+ capabilities across 7 namespaces"
      breadcrumb="Capabilities"
    >
      <div className="space-y-12">
        {/* Overview */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Overview</h2>
          <p className="text-neutral-400 leading-relaxed">
            Capabilities are permissions that control what actions an entity can perform. They are organized hierarchically in namespaces and gated by trust tier.
          </p>
        </section>

        {/* Capability Syntax */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Capability Syntax</h2>
          <div className="bg-black/30 border border-white/10 rounded-xl p-6">
            <pre className="text-sm text-emerald-400 font-mono">namespace:category/action[/scope]</pre>
          </div>
          <div className="mt-4 space-y-2 text-sm text-neutral-400">
            <p><strong className="text-white">namespace</strong> — Top-level domain (e.g., data, comm, execute)</p>
            <p><strong className="text-white">category</strong> — Functional grouping within namespace</p>
            <p><strong className="text-white">action</strong> — Specific operation</p>
            <p><strong className="text-white">scope</strong> — Optional: restricts to specific resources</p>
          </div>
          <div className="mt-4 bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-sm text-neutral-400 mb-2">Examples:</p>
            <ul className="space-y-1 font-mono text-sm">
              <li className="text-emerald-400">data:read/public</li>
              <li className="text-yellow-400">comm:external/email</li>
              <li className="text-blue-400">financial:transaction/medium</li>
              <li className="text-purple-400">admin:policy/modify</li>
            </ul>
          </div>
        </section>

        {/* Namespaces */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Seven Namespaces</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <NamespaceCard
              name="sandbox"
              description="Isolated testing capabilities"
              examples={['sandbox:test/execute', 'sandbox:mock/api']}
              minTier="Sandbox"
            />
            <NamespaceCard
              name="data"
              description="Data access and manipulation"
              examples={['data:read/public', 'data:write/internal', 'data:delete/owned']}
              minTier="Provisional"
            />
            <NamespaceCard
              name="comm"
              description="Communication channels"
              examples={['comm:internal/message', 'comm:external/email', 'comm:external/api']}
              minTier="Standard"
            />
            <NamespaceCard
              name="execute"
              description="Code and workflow execution"
              examples={['execute:workflow/approved', 'execute:code/sandboxed']}
              minTier="Standard"
            />
            <NamespaceCard
              name="financial"
              description="Financial operations"
              examples={['financial:transaction/low', 'financial:transaction/high']}
              minTier="Certified"
            />
            <NamespaceCard
              name="admin"
              description="Administrative functions"
              examples={['admin:entity/create', 'admin:policy/modify']}
              minTier="Autonomous"
            />
            <NamespaceCard
              name="custom"
              description="Organization-defined capabilities"
              examples={['custom:org/workflow', 'custom:dept/approve']}
              minTier="Configurable"
            />
          </div>
        </section>

        {/* Tier to Capability Matrix */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Tier-to-Capability Matrix</h2>
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Capability</th>
                  <th className="text-center px-3 py-3 text-red-400 font-medium">Sand</th>
                  <th className="text-center px-3 py-3 text-orange-400 font-medium">Prov</th>
                  <th className="text-center px-3 py-3 text-yellow-400 font-medium">Std</th>
                  <th className="text-center px-3 py-3 text-emerald-400 font-medium">Trust</th>
                  <th className="text-center px-3 py-3 text-blue-400 font-medium">Cert</th>
                  <th className="text-center px-3 py-3 text-purple-400 font-medium">Auto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <CapabilityRow cap="sandbox:test/*" tiers={[true, true, true, true, true, true]} />
                <CapabilityRow cap="data:read/public" tiers={[false, true, true, true, true, true]} />
                <CapabilityRow cap="data:read/internal" tiers={[false, false, true, true, true, true]} />
                <CapabilityRow cap="data:write/internal" tiers={[false, false, true, true, true, true]} />
                <CapabilityRow cap="data:read/sensitive" tiers={[false, false, false, true, true, true]} />
                <CapabilityRow cap="comm:internal/*" tiers={[false, true, true, true, true, true]} />
                <CapabilityRow cap="comm:external/read" tiers={[false, false, true, true, true, true]} />
                <CapabilityRow cap="comm:external/write" tiers={[false, false, false, true, true, true]} />
                <CapabilityRow cap="execute:workflow/*" tiers={[false, false, true, true, true, true]} />
                <CapabilityRow cap="financial:transaction/low" tiers={[false, false, false, true, true, true]} />
                <CapabilityRow cap="financial:transaction/medium" tiers={[false, false, false, false, true, true]} />
                <CapabilityRow cap="financial:transaction/high" tiers={[false, false, false, false, true, true]} />
                <CapabilityRow cap="admin:entity/*" tiers={[false, false, false, false, false, true]} />
                <CapabilityRow cap="admin:policy/*" tiers={[false, false, false, false, false, true]} />
              </tbody>
            </table>
          </div>
        </section>

        {/* Capability Checking */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Capability Checking Algorithm</h2>
          <div className="bg-black/30 border border-white/10 rounded-xl p-6 overflow-x-auto">
            <pre className="text-sm text-neutral-300 font-mono">
{`def check_capability(
    entity_id: str,
    capability: str,
    context: dict
) -> CapabilityResult:
    # 1. Get entity's current trust tier
    entity = get_entity(entity_id)
    tier = get_trust_tier(entity.trust_score)

    # 2. Parse capability
    namespace, category, action, scope = parse_capability(capability)

    # 3. Check if tier unlocks this capability
    min_tier = get_minimum_tier(capability)
    if tier_order(tier) < tier_order(min_tier):
        return CapabilityResult(
            granted=False,
            reason="tier_insufficient",
            required_tier=min_tier,
            current_tier=tier
        )

    # 4. Check entity-specific grants/revocations
    if is_explicitly_revoked(entity_id, capability):
        return CapabilityResult(granted=False, reason="explicitly_revoked")

    if is_explicitly_granted(entity_id, capability):
        return CapabilityResult(granted=True, reason="explicitly_granted")

    # 5. Check inheritance (wildcard matching)
    if matches_granted_wildcard(entity_id, capability):
        return CapabilityResult(granted=True, reason="wildcard_match")

    # 6. Default: granted if tier sufficient
    return CapabilityResult(granted=True, reason="tier_sufficient")`}
            </pre>
          </div>
        </section>

        {/* Full Taxonomy Link */}
        <section className="border-t border-white/10 pt-8">
          <p className="text-neutral-400 mb-4">
            For the complete capability taxonomy with all 100+ capabilities, see the full specification on GitHub.
          </p>
          <Link
            href="https://github.com/voriongit/vorion/blob/master/basis-core/specs/BASIS-CAPABILITY-TAXONOMY.md"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-semibold rounded hover:bg-neutral-200 transition-colors"
          >
            View Full Taxonomy on GitHub
          </Link>
        </section>
      </div>
    </BasisLayout>
  );
}

function NamespaceCard({ name, description, examples, minTier }: {
  name: string;
  description: string;
  examples: string[];
  minTier: string;
}) {
  return (
    <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold font-mono text-white">{name}:</h3>
        <span className="text-xs text-neutral-500">Min: {minTier}</span>
      </div>
      <p className="text-sm text-neutral-400 mb-3">{description}</p>
      <div className="space-y-1">
        {examples.map((ex, i) => (
          <code key={i} className="block text-xs font-mono text-emerald-400">{ex}</code>
        ))}
      </div>
    </div>
  );
}

function CapabilityRow({ cap, tiers }: { cap: string; tiers: boolean[] }) {
  return (
    <tr>
      <td className="px-4 py-2 font-mono text-sm text-neutral-300">{cap}</td>
      {tiers.map((granted, i) => (
        <td key={i} className="px-3 py-2 text-center">
          {granted ? (
            <span className="text-emerald-400">✓</span>
          ) : (
            <span className="text-neutral-600">—</span>
          )}
        </td>
      ))}
    </tr>
  );
}
