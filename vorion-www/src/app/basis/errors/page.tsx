import { BasisLayout } from '@/components/BasisLayout';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Error Codes | BASIS',
  description: 'Complete taxonomy of 60+ BASIS error codes organized in 12 categories.',
};

export default function ErrorsPage() {
  return (
    <BasisLayout
      title="Error Codes"
      description="60+ error codes in 12 categories"
      breadcrumb="Errors"
    >
      <div className="space-y-12">
        {/* Overview */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Overview</h2>
          <p className="text-neutral-400 leading-relaxed">
            BASIS defines a comprehensive error taxonomy with 60+ error codes organized into 12 categories. All errors follow a consistent format and include actionable information for debugging and monitoring.
          </p>
        </section>

        {/* Error Format */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Error Response Format</h2>
          <div className="bg-black/30 border border-white/10 rounded-xl p-6 overflow-x-auto">
            <pre className="text-sm text-neutral-300 font-mono">
{`{
  "error_code": "E1201",
  "error_category": "INTENT",
  "error_message": "Failed to parse action intent",
  "timestamp": "2026-01-15T10:30:00Z",
  "request_id": "req_abc123xyz",
  "details": {
    "parse_stage": "extraction",
    "failure_reason": "Ambiguous action target"
  },
  "retryable": false,
  "retry_after": null,
  "documentation_url": "https://vorion.org/basis/errors#E1201"
}`}
            </pre>
          </div>
        </section>

        {/* Error Categories */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Error Categories</h2>
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Category</th>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Code Range</th>
                  <th className="text-left px-4 py-3 text-neutral-400 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr><td className="px-4 py-3 text-white font-mono">TRUST</td><td className="px-4 py-3 text-neutral-400">E1000-E1099</td><td className="px-4 py-3 text-neutral-400">Trust score errors</td></tr>
                <tr><td className="px-4 py-3 text-white font-mono">CAPABILITY</td><td className="px-4 py-3 text-neutral-400">E1100-E1199</td><td className="px-4 py-3 text-neutral-400">Capability check failures</td></tr>
                <tr><td className="px-4 py-3 text-white font-mono">INTENT</td><td className="px-4 py-3 text-neutral-400">E1200-E1299</td><td className="px-4 py-3 text-neutral-400">Intent parsing errors</td></tr>
                <tr><td className="px-4 py-3 text-white font-mono">ENFORCE</td><td className="px-4 py-3 text-neutral-400">E1300-E1399</td><td className="px-4 py-3 text-neutral-400">Policy enforcement errors</td></tr>
                <tr><td className="px-4 py-3 text-white font-mono">PROOF</td><td className="px-4 py-3 text-neutral-400">E1400-E1499</td><td className="px-4 py-3 text-neutral-400">Proof generation/verification</td></tr>
                <tr><td className="px-4 py-3 text-white font-mono">CHAIN</td><td className="px-4 py-3 text-neutral-400">E1500-E1599</td><td className="px-4 py-3 text-neutral-400">Blockchain anchoring</td></tr>
                <tr><td className="px-4 py-3 text-white font-mono">ENTITY</td><td className="px-4 py-3 text-neutral-400">E1600-E1699</td><td className="px-4 py-3 text-neutral-400">Entity management</td></tr>
                <tr><td className="px-4 py-3 text-white font-mono">POLICY</td><td className="px-4 py-3 text-neutral-400">E1700-E1799</td><td className="px-4 py-3 text-neutral-400">Policy configuration</td></tr>
                <tr><td className="px-4 py-3 text-white font-mono">RATE_LIMIT</td><td className="px-4 py-3 text-neutral-400">E1800-E1899</td><td className="px-4 py-3 text-neutral-400">Rate limiting</td></tr>
                <tr><td className="px-4 py-3 text-white font-mono">SYSTEM</td><td className="px-4 py-3 text-neutral-400">E1900-E1999</td><td className="px-4 py-3 text-neutral-400">System-level errors</td></tr>
                <tr><td className="px-4 py-3 text-white font-mono">AUTH</td><td className="px-4 py-3 text-neutral-400">E2000-E2099</td><td className="px-4 py-3 text-neutral-400">Authentication/authorization</td></tr>
                <tr><td className="px-4 py-3 text-white font-mono">VALIDATION</td><td className="px-4 py-3 text-neutral-400">E2100-E2199</td><td className="px-4 py-3 text-neutral-400">Input validation</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Common Errors */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Common Error Codes</h2>
          <div className="space-y-4">
            <ErrorCard
              code="E1010"
              message="Trust score unavailable"
              category="TRUST"
              retryable={true}
              description="Cannot retrieve entity trust score. Usually transient database issue."
            />
            <ErrorCard
              code="E1103"
              message="Capability not granted"
              category="CAPABILITY"
              retryable={false}
              description="Entity does not have required capability. Check trust tier or request capability grant."
            />
            <ErrorCard
              code="E1201"
              message="Failed to parse action intent"
              category="INTENT"
              retryable={false}
              description="Could not extract structured intent from input. Reformulate request."
            />
            <ErrorCard
              code="E1310"
              message="Governance unavailable"
              category="ENFORCE"
              retryable={true}
              description="ENFORCE layer cannot evaluate. System defaults to DENY."
            />
            <ErrorCard
              code="E1403"
              message="Proof chain integrity violation"
              category="PROOF"
              retryable={false}
              description="Hash chain verification failed. SECURITY ALERT: Potential tampering."
            />
            <ErrorCard
              code="E2001"
              message="Authentication required"
              category="AUTH"
              retryable={false}
              description="No valid authentication provided. Include API key or token."
            />
          </div>
        </section>

        {/* Full Error Codes Link */}
        <section className="border-t border-white/10 pt-8">
          <p className="text-neutral-400 mb-4">
            For the complete error taxonomy with all 60+ codes, see the full document on GitHub.
          </p>
          <Link
            href="https://github.com/voriongit/vorion/blob/master/basis-core/specs/BASIS-ERROR-CODES.md"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-semibold rounded hover:bg-neutral-200 transition-colors"
          >
            View All Error Codes on GitHub
          </Link>
        </section>
      </div>
    </BasisLayout>
  );
}

function ErrorCard({ code, message, category, retryable, description }: {
  code: string;
  message: string;
  category: string;
  retryable: boolean;
  description: string;
}) {
  return (
    <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
      <div className="flex items-center gap-3 mb-2">
        <code className="text-red-400 font-mono font-bold">{code}</code>
        <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-neutral-400">{category}</span>
        <span className={`text-xs px-2 py-0.5 rounded ${retryable ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
          {retryable ? 'Retryable' : 'Not Retryable'}
        </span>
      </div>
      <h3 className="font-semibold text-white mb-1">{message}</h3>
      <p className="text-sm text-neutral-400">{description}</p>
    </div>
  );
}
