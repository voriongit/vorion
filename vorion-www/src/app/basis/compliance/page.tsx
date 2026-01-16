import { BasisLayout } from '@/components/BasisLayout';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Compliance Mapping | BASIS',
  description: 'How BASIS maps to SOC 2, ISO 27001, GDPR, HIPAA, PCI DSS, and EU AI Act compliance requirements.',
};

export default function CompliancePage() {
  return (
    <BasisLayout
      title="Compliance Mapping"
      description="SOC 2, ISO 27001, GDPR, HIPAA, PCI DSS, EU AI Act"
      breadcrumb="Compliance"
    >
      <div className="space-y-12">
        {/* Overview */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Overview</h2>
          <p className="text-neutral-400 leading-relaxed">
            BASIS provides built-in support for major regulatory and compliance frameworks. This document maps BASIS capabilities to specific compliance requirements.
          </p>
        </section>

        {/* Framework Summary */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Supported Frameworks</h2>
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Framework</th>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Jurisdiction</th>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Focus</th>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">BASIS Relevance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr>
                  <td className="px-4 py-3 text-white">SOC 2 Type II</td>
                  <td className="px-4 py-3 text-neutral-400">Global</td>
                  <td className="px-4 py-3 text-neutral-400">Security, Availability</td>
                  <td className="px-4 py-3 text-emerald-400">High</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white">ISO 27001:2022</td>
                  <td className="px-4 py-3 text-neutral-400">Global</td>
                  <td className="px-4 py-3 text-neutral-400">Information Security</td>
                  <td className="px-4 py-3 text-emerald-400">High</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white">GDPR</td>
                  <td className="px-4 py-3 text-neutral-400">EU/EEA</td>
                  <td className="px-4 py-3 text-neutral-400">Data Protection</td>
                  <td className="px-4 py-3 text-emerald-400">High</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white">HIPAA</td>
                  <td className="px-4 py-3 text-neutral-400">US</td>
                  <td className="px-4 py-3 text-neutral-400">Health Information</td>
                  <td className="px-4 py-3 text-emerald-400">High</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white">PCI DSS 4.0</td>
                  <td className="px-4 py-3 text-neutral-400">Global</td>
                  <td className="px-4 py-3 text-neutral-400">Payment Card Data</td>
                  <td className="px-4 py-3 text-yellow-400">Medium</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white">EU AI Act</td>
                  <td className="px-4 py-3 text-neutral-400">EU</td>
                  <td className="px-4 py-3 text-neutral-400">AI Systems</td>
                  <td className="px-4 py-3 text-red-400">Critical</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* SOC 2 */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">SOC 2 Type II</h2>
          <p className="text-neutral-400 leading-relaxed mb-4">
            BASIS provides comprehensive coverage for SOC 2 Trust Services Criteria:
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <ComplianceCard title="Security (CC)" coverage="Full" items={['Access control via trust tiers', 'Capability gating', 'Audit logging']} />
            <ComplianceCard title="Availability (A)" coverage="Full" items={['Failure mode handling', 'Circuit breakers', 'Graceful degradation']} />
            <ComplianceCard title="Processing Integrity (PI)" coverage="Full" items={['ENFORCE layer validation', 'PROOF layer integrity', 'Hash chains']} />
            <ComplianceCard title="Confidentiality (C)" coverage="Full" items={['Data capability restrictions', 'Tier-based access', 'Encryption requirements']} />
          </div>
        </section>

        {/* GDPR */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">GDPR</h2>
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Article</th>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Requirement</th>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">BASIS Implementation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr>
                  <td className="px-4 py-3 text-white font-mono">Art. 5(1)(f)</td>
                  <td className="px-4 py-3 text-neutral-400">Integrity & confidentiality</td>
                  <td className="px-4 py-3 text-neutral-300">Cryptographic proofs, access control</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white font-mono">Art. 5(2)</td>
                  <td className="px-4 py-3 text-neutral-400">Accountability</td>
                  <td className="px-4 py-3 text-neutral-300">Complete audit trail in PROOF layer</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white font-mono">Art. 25</td>
                  <td className="px-4 py-3 text-neutral-400">Data protection by design</td>
                  <td className="px-4 py-3 text-neutral-300">Governance-before-execution</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white font-mono">Art. 30</td>
                  <td className="px-4 py-3 text-neutral-400">Records of processing</td>
                  <td className="px-4 py-3 text-neutral-300">PROOF layer records all decisions</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white font-mono">Art. 32</td>
                  <td className="px-4 py-3 text-neutral-400">Security of processing</td>
                  <td className="px-4 py-3 text-neutral-300">Trust boundaries, capability gating</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* EU AI Act */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">EU AI Act</h2>
          <p className="text-neutral-400 leading-relaxed mb-4">
            BASIS provides critical support for high-risk AI system requirements:
          </p>
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Article</th>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Requirement</th>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">BASIS Implementation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr>
                  <td className="px-4 py-3 text-white font-mono">Art. 9</td>
                  <td className="px-4 py-3 text-neutral-400">Risk management</td>
                  <td className="px-4 py-3 text-neutral-300">Risk classification, trust scoring</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white font-mono">Art. 11</td>
                  <td className="px-4 py-3 text-neutral-400">Technical documentation</td>
                  <td className="px-4 py-3 text-neutral-300">PROOF layer records</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white font-mono">Art. 12</td>
                  <td className="px-4 py-3 text-neutral-400">Record-keeping</td>
                  <td className="px-4 py-3 text-neutral-300">7-year retention, hash chain</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white font-mono">Art. 13</td>
                  <td className="px-4 py-3 text-neutral-400">Transparency</td>
                  <td className="px-4 py-3 text-neutral-300">Audit trail, decision explanations</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white font-mono">Art. 14</td>
                  <td className="px-4 py-3 text-neutral-400">Human oversight</td>
                  <td className="px-4 py-3 text-neutral-300">Escalation mechanism</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white font-mono">Art. 15</td>
                  <td className="px-4 py-3 text-neutral-400">Accuracy & robustness</td>
                  <td className="px-4 py-3 text-neutral-300">Trust decay, failure handling</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Minimum Conformance */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Minimum Conformance by Framework</h2>
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Framework</th>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Min BASIS Level</th>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Key Components</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr>
                  <td className="px-4 py-3 text-white">SOC 2</td>
                  <td className="px-4 py-3 text-emerald-400">BASIS Core</td>
                  <td className="px-4 py-3 text-neutral-400">ENFORCE + PROOF</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white">ISO 27001</td>
                  <td className="px-4 py-3 text-emerald-400">BASIS Core</td>
                  <td className="px-4 py-3 text-neutral-400">Full capability gating</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white">GDPR</td>
                  <td className="px-4 py-3 text-blue-400">BASIS Complete</td>
                  <td className="px-4 py-3 text-neutral-400">Data capabilities + PROOF</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white">HIPAA</td>
                  <td className="px-4 py-3 text-blue-400">BASIS Complete</td>
                  <td className="px-4 py-3 text-neutral-400">PHI capabilities + encryption</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white">EU AI Act</td>
                  <td className="px-4 py-3 text-blue-400">BASIS Complete</td>
                  <td className="px-4 py-3 text-neutral-400">Full governance + human oversight</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Full Mapping Link */}
        <section className="border-t border-white/10 pt-8">
          <p className="text-neutral-400 mb-4">
            For complete compliance mappings including HIPAA, PCI DSS, NIST AI RMF, and audit evidence guidance, see the full document on GitHub.
          </p>
          <Link
            href="https://github.com/voriongit/vorion/blob/master/basis-core/specs/BASIS-COMPLIANCE-MAPPING.md"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-semibold rounded hover:bg-neutral-200 transition-colors"
          >
            View Full Compliance Mapping on GitHub
          </Link>
        </section>
      </div>
    </BasisLayout>
  );
}

function ComplianceCard({ title, coverage, items }: { title: string; coverage: string; items: string[] }) {
  const coverageColors: Record<string, string> = {
    Full: 'text-emerald-400',
    Partial: 'text-yellow-400',
  };

  return (
    <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-white">{title}</h3>
        <span className={`text-xs font-mono ${coverageColors[coverage]}`}>{coverage}</span>
      </div>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-neutral-400">
            <span className="text-emerald-400">✓</span> {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
