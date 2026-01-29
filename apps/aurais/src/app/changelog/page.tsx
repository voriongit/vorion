import Link from 'next/link'
import { Bot, Tag, Calendar, ArrowRight, Zap, Shield, Bug, Sparkles } from 'lucide-react'

const releases = [
  {
    version: '2.1.0',
    date: '2026-01-28',
    type: 'feature',
    title: 'Agent Marketplace Launch',
    changes: [
      { type: 'feature', text: 'Browse and deploy pre-verified agents from the marketplace' },
      { type: 'feature', text: 'Filter agents by trust tier, category, and rating' },
      { type: 'feature', text: 'One-click agent installation with automatic trust scoring' },
      { type: 'improvement', text: 'Improved agent detail pages with full trust factor breakdown' },
    ],
  },
  {
    version: '2.0.0',
    date: '2026-01-15',
    type: 'major',
    title: 'BASIS Trust Framework v2',
    changes: [
      { type: 'feature', text: 'Expanded to 23 trust factors (15 core + 8 life-critical)' },
      { type: 'feature', text: 'New 8-tier trust model (T0-T7) with refined score ranges' },
      { type: 'feature', text: 'All factors now evaluated at every tier with progressive thresholds' },
      { type: 'improvement', text: 'Updated capabilities framework with 60+ tools across tiers' },
      { type: 'breaking', text: 'Trust tier score ranges updated - see migration guide' },
    ],
  },
  {
    version: '1.8.0',
    date: '2025-12-20',
    type: 'feature',
    title: 'Multi-Agent Workflows',
    changes: [
      { type: 'feature', text: 'Orchestrate workflows across multiple agents' },
      { type: 'feature', text: 'Built-in delegation with trust boundary enforcement' },
      { type: 'feature', text: 'Human escalation paths for T4+ operations' },
      { type: 'fix', text: 'Fixed trust score calculation for concurrent executions' },
    ],
  },
  {
    version: '1.7.0',
    date: '2025-12-01',
    type: 'feature',
    title: 'Real-Time Analytics',
    changes: [
      { type: 'feature', text: 'Live dashboards for agent monitoring' },
      { type: 'feature', text: 'Custom alerting rules and notifications' },
      { type: 'feature', text: 'Performance metrics and trend analysis' },
      { type: 'improvement', text: 'Faster activity log loading (3x improvement)' },
    ],
  },
  {
    version: '1.6.0',
    date: '2025-11-15',
    type: 'security',
    title: 'Security Enhancements',
    changes: [
      { type: 'feature', text: 'SOC 2 Type II certification complete' },
      { type: 'feature', text: 'SSO/SAML support for enterprise' },
      { type: 'improvement', text: 'Enhanced audit logging with tamper detection' },
      { type: 'fix', text: 'Fixed rate limiting edge case in high-throughput scenarios' },
    ],
  },
]

const typeIcons = {
  feature: Sparkles,
  improvement: Zap,
  fix: Bug,
  breaking: Shield,
}

const typeColors = {
  feature: 'text-green-400',
  improvement: 'text-blue-400',
  fix: 'text-yellow-400',
  breaking: 'text-red-400',
}

export default function ChangelogPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-aurais-primary to-aurais-accent flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gradient">Aurais</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/features" className="text-gray-400 hover:text-white transition">Features</Link>
            <Link href="/pricing" className="text-gray-400 hover:text-white transition">Pricing</Link>
            <Link href="/docs" className="text-gray-400 hover:text-white transition">Docs</Link>
            <Link href="/signup" className="px-4 py-2 rounded-lg bg-aurais-primary hover:bg-aurais-secondary transition">
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold mb-4">Changelog</h1>
          <p className="text-xl text-gray-400">
            New features, improvements, and fixes in Aurais.
          </p>
        </div>
      </section>

      {/* Releases */}
      <section className="px-4 pb-20">
        <div className="max-w-4xl mx-auto">
          <div className="space-y-8">
            {releases.map((release) => (
              <div key={release.version} className="glass rounded-2xl p-8">
                <div className="flex items-center gap-4 mb-4">
                  <span className="px-3 py-1 rounded-full bg-aurais-primary/20 text-aurais-primary font-mono font-medium">
                    v{release.version}
                  </span>
                  <span className="flex items-center gap-1 text-sm text-gray-400">
                    <Calendar className="w-4 h-4" />
                    {release.date}
                  </span>
                  {release.type === 'major' && (
                    <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-medium">
                      Major Release
                    </span>
                  )}
                </div>

                <h2 className="text-2xl font-bold mb-4">{release.title}</h2>

                <ul className="space-y-3">
                  {release.changes.map((change, i) => {
                    const Icon = typeIcons[change.type as keyof typeof typeIcons] || Zap
                    const color = typeColors[change.type as keyof typeof typeColors] || 'text-gray-400'
                    return (
                      <li key={i} className="flex items-start gap-3">
                        <Icon className={`w-5 h-5 mt-0.5 ${color}`} />
                        <span className="text-gray-300">{change.text}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>

          {/* Subscribe */}
          <div className="mt-12 glass rounded-2xl p-8 text-center">
            <h2 className="text-xl font-bold mb-2">Stay Updated</h2>
            <p className="text-gray-400 mb-6">Get notified when we ship new features</p>
            <div className="flex items-center gap-2 max-w-md mx-auto">
              <input
                type="email"
                placeholder="you@example.com"
                className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-aurais-primary focus:outline-none"
              />
              <button className="px-6 py-3 rounded-xl bg-aurais-primary hover:bg-aurais-secondary transition font-medium">
                Subscribe
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
