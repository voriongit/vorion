import { BasisLayout } from '@/components/BasisLayout';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PROOF Layer | BASIS',
  description: 'The PROOF layer creates immutable audit records with cryptographic integrity and hash chaining.',
};

export default function ProofPage() {
  return (
    <BasisLayout
      title="PROOF Layer"
      description="Log decisions with cryptographic integrity"
      breadcrumb="PROOF"
    >
      <div className="space-y-12">
        {/* Overview */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Overview</h2>
          <p className="text-neutral-400 leading-relaxed">
            The PROOF layer creates an immutable record of every governance decision. It provides the audit trail that allows reconstruction of exactly what happened, when, and why.
          </p>
        </section>

        {/* Responsibilities */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Responsibilities</h2>
          <ul className="space-y-3">
            <Responsibility title="Generate proof ID" description="Create unique identifier for each decision" />
            <Responsibility title="Create hash" description="Generate SHA-256 hash of decision details" />
            <Responsibility title="Chain proofs" description="Link to previous proof record for integrity" />
            <Responsibility title="Store durably" description="Persist proof records for minimum retention period" />
          </ul>
        </section>

        {/* Requirements */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Requirements</h2>
          <div className="space-y-4">
            <Requirement level="MUST" text="Generate a unique proof_id for each decision" />
            <Requirement level="MUST" text="Include SHA-256 hash of the proof payload" />
            <Requirement level="MUST" text="Include reference to previous proof_id (hash chain)" />
            <Requirement level="MUST" text="Include ISO 8601 timestamp with timezone" />
            <Requirement level="MUST" text="Store proof records for minimum 7 years" />
            <Requirement level="MUST NOT" text="Allow modification of existing proof records" />
          </div>
        </section>

        {/* ProofRecord Schema */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">ProofRecord Schema</h2>
          <div className="bg-black/30 border border-white/10 rounded-xl p-6 overflow-x-auto">
            <pre className="text-sm text-neutral-300 font-mono">
{`{
  "proof_id": "prf_xyz789abc",
  "previous_proof_id": "prf_uvw456def",
  "timestamp": "2026-01-15T10:30:02Z",
  "intent_id": "int_abc123xyz",
  "entity_id": "ent_agent_001",
  "decision": "ALLOW",
  "payload_hash": "sha256:a1b2c3d4e5f6...",
  "chain_hash": "sha256:9z8y7x6w5v4u...",
  "signature": {
    "algorithm": "ECDSA-P256",
    "value": "MEUCIQDk..."
  },
  "metadata": {
    "implementation": "cognigate",
    "version": "1.0.0"
  }
}`}
            </pre>
          </div>
        </section>

        {/* Hash Chain */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Hash Chain Structure</h2>
          <p className="text-neutral-400 leading-relaxed mb-4">
            Each proof record contains a chain_hash that incorporates the previous proof&apos;s hash, creating a tamper-evident chain:
          </p>
          <div className="bg-black/30 border border-white/10 rounded-xl p-6 overflow-x-auto">
            <pre className="text-sm text-neutral-300 font-mono">
{`chain_hash = SHA256(
  previous_proof.chain_hash +
  current_proof.payload_hash +
  current_proof.timestamp
)`}
            </pre>
          </div>
          <div className="mt-6 bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Chain Visualization</h3>
            <pre className="text-sm text-neutral-300 font-mono overflow-x-auto">
{`┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Proof N-2  │────▶│   Proof N-1  │────▶│   Proof N    │
├──────────────┤     ├──────────────┤     ├──────────────┤
│ chain_hash   │     │ chain_hash   │     │ chain_hash   │
│ = SHA256(    │     │ = SHA256(    │     │ = SHA256(    │
│   prev +     │     │   prev +     │     │   prev +     │
│   payload +  │     │   payload +  │     │   payload +  │
│   timestamp) │     │   timestamp) │     │   timestamp) │
└──────────────┘     └──────────────┘     └──────────────┘`}
            </pre>
          </div>
        </section>

        {/* Integrity Verification */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Integrity Verification</h2>
          <p className="text-neutral-400 leading-relaxed mb-4">
            To verify chain integrity, implementations MUST:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-neutral-400">
            <li>Retrieve the proof record to verify</li>
            <li>Recompute payload_hash from stored payload</li>
            <li>Verify payload_hash matches stored value</li>
            <li>Retrieve previous proof record</li>
            <li>Recompute chain_hash using previous chain_hash</li>
            <li>Verify chain_hash matches stored value</li>
            <li>Optionally verify digital signature</li>
          </ol>
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mt-4">
            <p className="text-sm text-red-400">
              <strong>Security Alert:</strong> If any hash mismatch is detected, this indicates potential tampering. The system MUST halt proof operations and alert security personnel.
            </p>
          </div>
        </section>

        {/* Retention */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Retention Requirements</h2>
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Decision Type</th>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Minimum Retention</th>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr>
                  <td className="px-4 py-3 text-white">ALLOW</td>
                  <td className="px-4 py-3 text-neutral-300 font-mono">7 years</td>
                  <td className="px-4 py-3 text-neutral-400">Standard audit requirement</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white">DENY</td>
                  <td className="px-4 py-3 text-neutral-300 font-mono">7 years</td>
                  <td className="px-4 py-3 text-neutral-400">Required for security analysis</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white">ESCALATE</td>
                  <td className="px-4 py-3 text-neutral-300 font-mono">7 years</td>
                  <td className="px-4 py-3 text-neutral-400">Includes approval decision</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white">Financial</td>
                  <td className="px-4 py-3 text-neutral-300 font-mono">10 years</td>
                  <td className="px-4 py-3 text-neutral-400">Regulatory compliance (SOX)</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white">Healthcare (PHI)</td>
                  <td className="px-4 py-3 text-neutral-300 font-mono">6 years</td>
                  <td className="px-4 py-3 text-neutral-400">HIPAA requirement</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </BasisLayout>
  );
}

function Responsibility({ title, description }: { title: string; description: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="text-emerald-400 mt-1">•</span>
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
