import Link from 'next/link'
import { Bot, ArrowLeft, Shield, Lock, Eye, CheckCircle, Server, Key } from 'lucide-react'

export default function SecurityPage() {
  return (
    <div className="min-h-screen py-12 px-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-aurais-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-aurais-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-aurais-primary to-aurais-accent flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-gradient">Aurais</span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
        </div>

        {/* Content */}
        <div className="glass rounded-2xl p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-8 h-8 text-aurais-primary" />
            <div>
              <h1 className="text-3xl font-bold">Security</h1>
              <p className="text-gray-400">How we protect your data and agents</p>
            </div>
          </div>

          <p className="text-gray-300 mb-8">
            Security is foundational to Aurais. Our platform is built on the BASIS (Behavioral AI Safety & Integrity Standard) framework, ensuring that every AI agent operates within verified trust boundaries.
          </p>

          {/* Security Features */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="p-4 rounded-xl bg-white/5">
              <Lock className="w-6 h-6 text-aurais-primary mb-3" />
              <h3 className="font-semibold mb-2">Encryption</h3>
              <p className="text-sm text-gray-400">
                All data is encrypted at rest (AES-256) and in transit (TLS 1.3). Agent credentials are stored using industry-standard key management.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white/5">
              <Eye className="w-6 h-6 text-aurais-primary mb-3" />
              <h3 className="font-semibold mb-2">Full Observability</h3>
              <p className="text-sm text-gray-400">
                Every agent action is logged with immutable audit trails. Real-time monitoring detects anomalies and policy violations.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white/5">
              <Server className="w-6 h-6 text-aurais-primary mb-3" />
              <h3 className="font-semibold mb-2">Isolated Execution</h3>
              <p className="text-sm text-gray-400">
                Agents run in sandboxed environments with strict resource limits. Network access is controlled based on trust tier.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white/5">
              <Key className="w-6 h-6 text-aurais-primary mb-3" />
              <h3 className="font-semibold mb-2">Identity Verification</h3>
              <p className="text-sm text-gray-400">
                Cryptographic agent identities prevent impersonation. KYA (Know Your Agent) protocols ensure provenance tracking.
              </p>
            </div>
          </div>
        </div>

        {/* Trust-Based Security */}
        <div className="glass rounded-2xl p-8 mb-6">
          <h2 className="text-xl font-semibold mb-4">Trust-Based Security Model</h2>
          <p className="text-gray-300 mb-6">
            Aurais uses the 8-tier BASIS trust model (T0-T7) to progressively grant capabilities as agents demonstrate trustworthy behavior.
          </p>

          <div className="space-y-3">
            {[
              { tier: 'T0 Sandbox', desc: 'No external access, read-only operations', color: 'text-red-400' },
              { tier: 'T1-T2', desc: 'Supervised operations with logging', color: 'text-yellow-400' },
              { tier: 'T3-T4', desc: 'Verified identity, external API access', color: 'text-lime-400' },
              { tier: 'T5-T6', desc: 'Delegation, autonomous workflows', color: 'text-blue-400' },
              { tier: 'T7', desc: 'Full autonomy with governance participation', color: 'text-aurais-primary' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                <CheckCircle className={`w-5 h-5 ${item.color}`} />
                <span className={`font-medium ${item.color}`}>{item.tier}:</span>
                <span className="text-gray-300">{item.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Compliance */}
        <div className="glass rounded-2xl p-8">
          <h2 className="text-xl font-semibold mb-4">Compliance & Certifications</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-xl bg-white/5">
              <div className="text-2xl font-bold text-aurais-primary mb-1">SOC 2</div>
              <p className="text-xs text-gray-400">Type II Certified</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-white/5">
              <div className="text-2xl font-bold text-aurais-primary mb-1">GDPR</div>
              <p className="text-xs text-gray-400">Compliant</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-white/5">
              <div className="text-2xl font-bold text-aurais-primary mb-1">ISO 27001</div>
              <p className="text-xs text-gray-400">Certified</p>
            </div>
          </div>

          <div className="mt-6 p-4 rounded-xl bg-aurais-primary/10 border border-aurais-primary/20">
            <h3 className="font-medium mb-2">Report a Security Issue</h3>
            <p className="text-sm text-gray-400">
              Found a vulnerability? Please report it responsibly to{' '}
              <a href="mailto:security@aurais.net" className="text-aurais-primary hover:text-aurais-secondary">
                security@aurais.net
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
