import Link from 'next/link'
import { Shield, CheckCircle, Search, Coins, ArrowRight, Layers } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 lg:py-32">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900/20 via-transparent to-purple-900/20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
              The{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-purple-400">
                Certification Authority
              </span>
              <br />for AI Agents
            </h1>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-8">
              Trust scores. Certification. Registry. The UL Listing for AI.
              Verify that AI agents meet governance standards before deployment.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="inline-flex items-center px-8 py-4 bg-primary-600 hover:bg-primary-500 text-white font-semibold rounded-lg transition-colors"
              >
                Get Your Agent Certified
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <Link
                href="/registry"
                className="inline-flex items-center px-8 py-4 bg-surface-light hover:bg-surface text-white font-semibold rounded-lg border border-gray-700 transition-colors"
              >
                Browse Registry
                <Search className="ml-2 h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Score Demo */}
      <section className="py-16 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-white mb-4">
                Quantified Trust (0-1000)
              </h2>
              <p className="text-gray-400 mb-6">
                Every agent gets a dynamic trust score based on compliance, performance,
                reputation, stake, history, and verification. Higher scores unlock more capabilities.
              </p>
              <div className="space-y-3">
                {trustTiers.map((tier) => (
                  <div key={tier.name} className="flex items-center gap-3">
                    <span className={`text-2xl`}>{tier.emoji}</span>
                    <span className="font-medium text-white w-24">{tier.name}</span>
                    <span className="text-gray-500">{tier.range}</span>
                    <span className="text-gray-400 text-sm">{tier.desc}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-surface-dark rounded-2xl p-8 border border-gray-800">
              <TrustScoreDemo />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">
              Built on the BASIS Standard
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              AgentAnchor implements the open BASIS governance standard,
              ensuring interoperability and transparency.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-surface rounded-xl p-6 border border-gray-800 hover:border-primary-500/50 transition-colors"
              >
                <div className="w-12 h-12 bg-primary-500/10 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-primary-900/30 to-purple-900/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Get Certified?
          </h2>
          <p className="text-gray-400 mb-8">
            Join the growing ecosystem of trusted AI agents.
            Start with a free sandbox account.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center px-8 py-4 bg-primary-600 hover:bg-primary-500 text-white font-semibold rounded-lg transition-colors"
          >
            Create Free Account
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </div>
      </section>
    </div>
  )
}

const trustTiers = [
  { name: 'Unverified', range: '0-99', emoji: '🔴', desc: 'Sandbox only' },
  { name: 'Provisional', range: '100-299', emoji: '🟠', desc: 'Basic ops' },
  { name: 'Certified', range: '300-499', emoji: '🟡', desc: 'Standard ops' },
  { name: 'Trusted', range: '500-699', emoji: '🟢', desc: 'Extended ops' },
  { name: 'Verified', range: '700-899', emoji: '🔵', desc: 'Privileged ops' },
  { name: 'Sovereign', range: '900-1000', emoji: '💎', desc: 'Full autonomy' },
]

const features = [
  {
    title: 'Trust Scores',
    description: 'Real-time trust scores based on compliance, performance, and community signals.',
    icon: Shield,
  },
  {
    title: 'Certification',
    description: 'Third-party validation that your agent meets BASIS governance standards.',
    icon: CheckCircle,
  },
  {
    title: 'Public Registry',
    description: 'Discover and verify certified agents. Search by capability, tier, or category.',
    icon: Search,
  },
  {
    title: 'Token Economy',
    description: 'Stake ANCR tokens for certification. Earn rewards for good behavior.',
    icon: Coins,
  },
]

function TrustScoreDemo() {
  const score = 687
  const tier = 'Trusted'
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Example Agent</p>
          <p className="text-lg font-mono text-white">ag_demo_agent_x7k</p>
        </div>
        <span className="px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-sm font-medium">
          🟢 {tier}
        </span>
      </div>
      
      <div>
        <div className="flex justify-between mb-2">
          <span className="text-sm text-gray-400">Trust Score</span>
          <span className="text-2xl font-bold text-white">{score}</span>
        </div>
        <div className="h-4 bg-surface rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all"
            style={{ width: `${(score / 1000) * 100}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Compliance', value: 92 },
          { label: 'Performance', value: 88 },
          { label: 'Reputation', value: 76 },
          { label: 'History', value: 94 },
        ].map((item) => (
          <div key={item.label} className="bg-surface rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">{item.label}</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-surface-dark rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full"
                  style={{ width: `${item.value}%` }}
                />
              </div>
              <span className="text-sm font-medium text-white">{item.value}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-4 border-t border-gray-800">
        <p className="text-xs text-gray-500 mb-2">Unlocked Capabilities</p>
        <div className="flex flex-wrap gap-2">
          {['data/read_user', 'send_internal', 'send_external', 'schedule'].map((cap) => (
            <span key={cap} className="px-2 py-1 bg-primary-500/10 text-primary-400 rounded text-xs font-mono">
              {cap}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
