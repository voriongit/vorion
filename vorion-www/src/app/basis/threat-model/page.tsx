import { BasisLayout } from '@/components/BasisLayout';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Threat Model | BASIS',
  description: 'Security threat model for BASIS implementations including STRIDE analysis and 20+ threats with mitigations.',
};

export default function ThreatModelPage() {
  return (
    <BasisLayout
      title="Threat Model"
      description="STRIDE analysis with 20+ threats and mitigations"
      breadcrumb="Threat Model"
    >
      <div className="space-y-12">
        {/* Overview */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Overview</h2>
          <p className="text-neutral-400 leading-relaxed">
            This document defines the security threat model for BASIS-conformant implementations. It identifies threats, attack vectors, and required mitigations for AI agent governance systems.
          </p>
        </section>

        {/* STRIDE Analysis */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">STRIDE Analysis</h2>
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Category</th>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Description</th>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Applicable Components</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr><td className="px-4 py-3 text-red-400 font-bold">S</td><td className="px-4 py-3 text-neutral-300">Spoofing</td><td className="px-4 py-3 text-neutral-400">Authentication, Entity IDs</td></tr>
                <tr><td className="px-4 py-3 text-orange-400 font-bold">T</td><td className="px-4 py-3 text-neutral-300">Tampering</td><td className="px-4 py-3 text-neutral-400">Trust scores, Proofs, Policies</td></tr>
                <tr><td className="px-4 py-3 text-yellow-400 font-bold">R</td><td className="px-4 py-3 text-neutral-300">Repudiation</td><td className="px-4 py-3 text-neutral-400">Audit logs, Proof chain</td></tr>
                <tr><td className="px-4 py-3 text-emerald-400 font-bold">I</td><td className="px-4 py-3 text-neutral-300">Information Disclosure</td><td className="px-4 py-3 text-neutral-400">API responses, Logs</td></tr>
                <tr><td className="px-4 py-3 text-blue-400 font-bold">D</td><td className="px-4 py-3 text-neutral-300">Denial of Service</td><td className="px-4 py-3 text-neutral-400">All API endpoints</td></tr>
                <tr><td className="px-4 py-3 text-purple-400 font-bold">E</td><td className="px-4 py-3 text-neutral-300">Elevation of Privilege</td><td className="px-4 py-3 text-neutral-400">Trust scoring, Capability gating</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Key Threats */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Key Threats</h2>
          <div className="space-y-6">
            <ThreatCard
              id="T-TRUST-001"
              name="Direct Score Modification"
              impact="Critical"
              category="Trust Score Manipulation"
              description="Attacker directly modifies trust scores in the database via SQL injection, credential theft, or insider threat."
              mitigations={[
                'Trust score modifications MUST go through ENFORCE layer',
                'Database credentials MUST use principle of least privilege',
                'All score changes MUST be logged in PROOF layer'
              ]}
            />
            <ThreatCard
              id="T-INTENT-001"
              name="Prompt Injection"
              impact="Critical"
              category="Intent Manipulation"
              description="Attacker embeds malicious instructions in action requests to manipulate INTENT layer parsing."
              mitigations={[
                'INTENT layer MUST treat all input as untrusted',
                'Implement prompt injection detection patterns',
                'Use structured extraction, not free-form interpretation',
                'Never execute trust modifications from intent content'
              ]}
            />
            <ThreatCard
              id="T-PROOF-001"
              name="Proof Tampering"
              impact="Critical"
              category="Proof Chain Attacks"
              description="Attacker modifies existing proof records to hide actions or change history."
              mitigations={[
                'Proof storage MUST be append-only',
                'Proof records MUST be cryptographically chained',
                'Implement hash verification on read',
                'Separate proof storage from operational database'
              ]}
            />
            <ThreatCard
              id="T-AUTH-001"
              name="Entity Spoofing"
              impact="Critical"
              category="Authentication"
              description="Attacker impersonates a trusted entity to leverage their trust score."
              mitigations={[
                'Strong authentication required for all entities',
                'Implement entity-specific API keys',
                'Session binding to IP/device where possible',
                'MFA for high-privilege operations'
              ]}
            />
          </div>
        </section>

        {/* Security Requirements */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Security Requirements Summary</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <RequirementGroup
              title="Authentication"
              requirements={[
                'All API endpoints require authentication',
                'Tokens expire within 24 hours',
                'Failed auth attempts logged'
              ]}
            />
            <RequirementGroup
              title="Cryptographic"
              requirements={[
                'TLS 1.2+ for all transport',
                'SHA-256 for proof hashing',
                'RSA-2048 or ECDSA P-256 for signing'
              ]}
            />
            <RequirementGroup
              title="Audit"
              requirements={[
                'Log all authentication attempts',
                'Log all ENFORCE decisions',
                'Logs retained minimum 1 year'
              ]}
            />
            <RequirementGroup
              title="Input Validation"
              requirements={[
                'Validate all input against schema',
                'Parameterize all database queries',
                'Implement prompt injection detection'
              ]}
            />
          </div>
        </section>

        {/* Full Threat Model Link */}
        <section className="border-t border-white/10 pt-8">
          <p className="text-neutral-400 mb-4">
            For the complete threat model with all 20+ threats, incident response procedures, and compliance mapping, see the full document on GitHub.
          </p>
          <Link
            href="https://github.com/voriongit/vorion/blob/master/basis-core/specs/BASIS-THREAT-MODEL.md"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-semibold rounded hover:bg-neutral-200 transition-colors"
          >
            View Full Threat Model on GitHub
          </Link>
        </section>
      </div>
    </BasisLayout>
  );
}

function ThreatCard({ id, name, impact, category, description, mitigations }: {
  id: string;
  name: string;
  impact: string;
  category: string;
  description: string;
  mitigations: string[];
}) {
  const impactColors: Record<string, string> = {
    Critical: 'bg-red-500/20 text-red-400',
    High: 'bg-orange-500/20 text-orange-400',
    Medium: 'bg-yellow-500/20 text-yellow-400',
  };

  return (
    <div className="p-5 bg-white/5 border border-white/10 rounded-xl">
      <div className="flex items-center gap-3 mb-3">
        <code className="text-amber-400 font-mono text-sm">{id}</code>
        <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-neutral-400">{category}</span>
        <span className={`text-xs px-2 py-0.5 rounded ${impactColors[impact]}`}>{impact}</span>
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{name}</h3>
      <p className="text-neutral-400 text-sm mb-4">{description}</p>
      <div>
        <h4 className="text-xs font-semibold text-emerald-400 uppercase mb-2">Mitigations</h4>
        <ul className="space-y-1">
          {mitigations.map((m, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-neutral-300">
              <span className="text-emerald-400 mt-0.5">•</span> {m}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function RequirementGroup({ title, requirements }: { title: string; requirements: string[] }) {
  return (
    <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
      <h3 className="font-semibold text-white mb-3">{title}</h3>
      <ul className="space-y-2">
        {requirements.map((req, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-neutral-400">
            <span className="text-emerald-400">✓</span> {req}
          </li>
        ))}
      </ul>
    </div>
  );
}
