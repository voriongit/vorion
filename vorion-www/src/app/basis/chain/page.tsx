import { BasisLayout } from '@/components/BasisLayout';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CHAIN Layer | BASIS',
  description: 'The optional CHAIN layer anchors proof records to blockchain for independent verification.',
};

export default function ChainPage() {
  return (
    <BasisLayout
      title="CHAIN Layer"
      description="Anchor proofs to blockchain (optional)"
      breadcrumb="CHAIN"
    >
      <div className="space-y-12">
        {/* Overview */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Overview</h2>
          <p className="text-neutral-400 leading-relaxed">
            The CHAIN layer is an <strong className="text-white">optional</strong> component that anchors proof records to an external blockchain or distributed ledger. This provides independent verification that proof records existed at a specific time and have not been tampered with.
          </p>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mt-4">
            <p className="text-sm text-amber-400">
              <strong>Note:</strong> CHAIN layer is required for BASIS Complete conformance but optional for BASIS Core.
            </p>
          </div>
        </section>

        {/* Responsibilities */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Responsibilities</h2>
          <ul className="space-y-3">
            <Responsibility title="Batch proofs" description="Aggregate multiple proof records for efficient anchoring" />
            <Responsibility title="Create anchor" description="Submit Merkle root or aggregate hash to blockchain" />
            <Responsibility title="Store reference" description="Record blockchain transaction ID with proof records" />
            <Responsibility title="Verify anchors" description="Provide verification that proofs were anchored at claimed time" />
          </ul>
        </section>

        {/* Requirements */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Requirements</h2>
          <div className="space-y-4">
            <Requirement level="MUST" text="Anchor proof batches within 24 hours of creation" />
            <Requirement level="MUST" text="Store blockchain transaction reference with anchored proofs" />
            <Requirement level="MUST" text="Provide API to verify anchor for any proof" />
            <Requirement level="SHOULD" text="Use established blockchain (Ethereum, Polygon, etc.)" />
            <Requirement level="MAY" text="Support multiple blockchain targets" />
          </div>
        </section>

        {/* Anchoring Process */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Anchoring Process</h2>
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <pre className="text-sm text-neutral-300 font-mono overflow-x-auto">
{`┌─────────────────────────────────────────────────────────────┐
│                     Proof Records                            │
│  prf_001  prf_002  prf_003  prf_004  prf_005  ...           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ Batch (e.g., every hour)
┌─────────────────────────────────────────────────────────────┐
│                     Merkle Tree                              │
│                                                              │
│                         ROOT                                 │
│                        /    \\                                │
│                    H(01+02)  H(03+04)                        │
│                    /    \\    /    \\                          │
│                 H(01)  H(02) H(03) H(04)                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ Submit Merkle root
┌─────────────────────────────────────────────────────────────┐
│                     Blockchain                               │
│  Transaction: 0xabc123...                                   │
│  Data: Merkle root hash                                     │
│  Timestamp: Block #12345678                                 │
└─────────────────────────────────────────────────────────────┘`}
            </pre>
          </div>
        </section>

        {/* AnchorRecord Schema */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">AnchorRecord Schema</h2>
          <div className="bg-black/30 border border-white/10 rounded-xl p-6 overflow-x-auto">
            <pre className="text-sm text-neutral-300 font-mono">
{`{
  "anchor_id": "anc_def456ghi",
  "timestamp": "2026-01-15T11:00:00Z",
  "proof_ids": [
    "prf_xyz789abc",
    "prf_uvw456def",
    "prf_rst123jkl"
  ],
  "merkle_root": "sha256:b3c4d5e6f7g8...",
  "blockchain": {
    "network": "polygon",
    "chain_id": 137,
    "transaction_hash": "0x1a2b3c4d5e6f...",
    "block_number": 52345678,
    "block_timestamp": "2026-01-15T11:00:15Z"
  },
  "verification_url": "https://polygonscan.com/tx/0x1a2b3c..."
}`}
            </pre>
          </div>
        </section>

        {/* Supported Blockchains */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Supported Blockchains</h2>
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Network</th>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Chain ID</th>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Cost</th>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Finality</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr>
                  <td className="px-4 py-3 text-white">Ethereum Mainnet</td>
                  <td className="px-4 py-3 text-neutral-300 font-mono">1</td>
                  <td className="px-4 py-3 text-neutral-400">~$5-50/tx</td>
                  <td className="px-4 py-3 text-neutral-400">~15 minutes</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white">Polygon</td>
                  <td className="px-4 py-3 text-neutral-300 font-mono">137</td>
                  <td className="px-4 py-3 text-neutral-400">~$0.01/tx</td>
                  <td className="px-4 py-3 text-neutral-400">~2 minutes</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white">Arbitrum One</td>
                  <td className="px-4 py-3 text-neutral-300 font-mono">42161</td>
                  <td className="px-4 py-3 text-neutral-400">~$0.10/tx</td>
                  <td className="px-4 py-3 text-neutral-400">~1 minute</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-white">Base</td>
                  <td className="px-4 py-3 text-neutral-300 font-mono">8453</td>
                  <td className="px-4 py-3 text-neutral-400">~$0.01/tx</td>
                  <td className="px-4 py-3 text-neutral-400">~2 minutes</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Verification */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Verification Process</h2>
          <p className="text-neutral-400 leading-relaxed mb-4">
            To verify a proof was anchored:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-neutral-400">
            <li>Retrieve the proof record and its anchor reference</li>
            <li>Fetch the Merkle proof (path from proof to root)</li>
            <li>Recompute the Merkle root using the proof and path</li>
            <li>Fetch the blockchain transaction</li>
            <li>Verify the transaction contains the expected Merkle root</li>
            <li>Verify the block timestamp matches expected anchor time</li>
          </ol>
        </section>

        {/* Failure Handling */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Failure Handling</h2>
          <div className="space-y-4">
            <FailureCase
              scenario="Blockchain unavailable"
              impact="Non-critical — proofs remain valid in PROOF layer"
              action="Queue for later anchoring, retry with backoff"
            />
            <FailureCase
              scenario="Transaction fails"
              impact="Anchoring delayed, proofs unaffected"
              action="Retry with adjusted gas, alert if persistent"
            />
            <FailureCase
              scenario="Verification fails"
              impact="Potential tampering or data corruption"
              action="Security alert, do not trust affected proofs"
            />
          </div>
        </section>
      </div>
    </BasisLayout>
  );
}

function Responsibility({ title, description }: { title: string; description: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="text-purple-400 mt-1">•</span>
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

function FailureCase({ scenario, impact, action }: { scenario: string; impact: string; action: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <h4 className="font-semibold text-white mb-2">{scenario}</h4>
      <p className="text-sm text-neutral-400 mb-1"><strong className="text-amber-400">Impact:</strong> {impact}</p>
      <p className="text-sm text-neutral-400"><strong className="text-emerald-400">Action:</strong> {action}</p>
    </div>
  );
}
