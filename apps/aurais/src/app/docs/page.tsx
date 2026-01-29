'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Bot,
  Book,
  Code,
  Shield,
  Zap,
  Settings,
  Terminal,
  FileText,
  ChevronRight,
  Search,
  ExternalLink,
} from 'lucide-react'

const docSections = [
  {
    title: 'Getting Started',
    icon: Zap,
    items: [
      { title: 'Introduction to Aurais', href: '#introduction' },
      { title: 'Quick Start Guide', href: '#quickstart' },
      { title: 'Creating Your First Agent', href: '#first-agent' },
      { title: 'Understanding Trust Tiers', href: '#trust-tiers' },
    ],
  },
  {
    title: 'Core Concepts',
    icon: Book,
    items: [
      { title: 'BASIS Trust Framework', href: '#basis' },
      { title: 'Trust Factors (23 Total)', href: '#factors' },
      { title: 'Capabilities by Tier', href: '#capabilities' },
      { title: 'Agent Lifecycle', href: '#lifecycle' },
    ],
  },
  {
    title: 'API Reference',
    icon: Code,
    items: [
      { title: 'Authentication', href: '#auth' },
      { title: 'Agents API', href: '#agents-api' },
      { title: 'Trust Scoring API', href: '#trust-api' },
      { title: 'Governance API', href: '#governance-api' },
    ],
  },
  {
    title: 'Security',
    icon: Shield,
    items: [
      { title: 'Security Model', href: '#security-model' },
      { title: 'Data Protection', href: '#data-protection' },
      { title: 'Compliance', href: '#compliance' },
      { title: 'Audit Logs', href: '#audit-logs' },
    ],
  },
]

export default function DocsPage() {
  const [searchQuery, setSearchQuery] = useState('')

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
            <span className="text-gray-400 ml-2">Docs</span>
          </Link>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search docs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-aurais-primary focus:outline-none text-sm w-64"
              />
            </div>
            <Link href="/dashboard" className="px-4 py-2 rounded-lg bg-aurais-primary hover:bg-aurais-secondary transition text-sm font-medium">
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="flex pt-16">
        {/* Sidebar */}
        <aside className="fixed left-0 top-16 bottom-0 w-64 glass border-r border-white/10 p-4 overflow-y-auto">
          <nav className="space-y-6">
            {docSections.map((section) => (
              <div key={section.title}>
                <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-300">
                  <section.icon className="w-4 h-4" />
                  {section.title}
                </div>
                <ul className="space-y-1 ml-6">
                  {section.items.map((item) => (
                    <li key={item.href}>
                      <a
                        href={item.href}
                        className="block px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition"
                      >
                        {item.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="ml-64 flex-1 p-8 max-w-4xl">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-4">Aurais Documentation</h1>
            <p className="text-xl text-gray-400">
              Learn how to deploy and manage trust-verified AI agents with Aurais.
            </p>
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-2 gap-4 mb-12">
            <Link href="#quickstart" className="glass rounded-xl p-6 hover:bg-white/10 transition group">
              <Zap className="w-8 h-8 text-aurais-primary mb-3" />
              <h3 className="font-semibold mb-2 group-hover:text-aurais-primary transition">Quick Start</h3>
              <p className="text-sm text-gray-400">Get up and running in 5 minutes</p>
            </Link>
            <Link href="#basis" className="glass rounded-xl p-6 hover:bg-white/10 transition group">
              <Shield className="w-8 h-8 text-aurais-primary mb-3" />
              <h3 className="font-semibold mb-2 group-hover:text-aurais-primary transition">BASIS Framework</h3>
              <p className="text-sm text-gray-400">Understand trust-based governance</p>
            </Link>
            <Link href="#agents-api" className="glass rounded-xl p-6 hover:bg-white/10 transition group">
              <Terminal className="w-8 h-8 text-aurais-primary mb-3" />
              <h3 className="font-semibold mb-2 group-hover:text-aurais-primary transition">API Reference</h3>
              <p className="text-sm text-gray-400">Complete API documentation</p>
            </Link>
            <Link href="/docs/examples" className="glass rounded-xl p-6 hover:bg-white/10 transition group">
              <FileText className="w-8 h-8 text-aurais-primary mb-3" />
              <h3 className="font-semibold mb-2 group-hover:text-aurais-primary transition">Examples</h3>
              <p className="text-sm text-gray-400">Sample code and use cases</p>
            </Link>
          </div>

          {/* Introduction Section */}
          <section id="introduction" className="mb-12">
            <h2 className="text-2xl font-bold mb-4">Introduction to Aurais</h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-gray-300 mb-4">
                Aurais is a platform for deploying and managing autonomous AI agents with built-in trust verification. Every agent operates within the BASIS (Behavioral AI Safety & Integrity Standard) framework, ensuring safe, transparent, and accountable AI operations.
              </p>
              <h3 className="text-lg font-semibold mt-6 mb-3">Key Features</h3>
              <ul className="list-disc pl-6 text-gray-300 space-y-2">
                <li><strong>Trust-Based Capabilities:</strong> Agents earn capabilities through demonstrated trustworthiness</li>
                <li><strong>23 Trust Factors:</strong> Comprehensive evaluation across safety, security, and performance</li>
                <li><strong>8-Tier System:</strong> Progressive autonomy from T0 (Sandbox) to T7 (Autonomous)</li>
                <li><strong>Full Observability:</strong> Every action logged and auditable</li>
                <li><strong>Marketplace:</strong> Deploy pre-verified agents or create your own</li>
              </ul>
            </div>
          </section>

          {/* Quick Start Section */}
          <section id="quickstart" className="mb-12">
            <h2 className="text-2xl font-bold mb-4">Quick Start Guide</h2>
            <div className="space-y-6">
              <div className="glass rounded-xl p-6">
                <h3 className="font-semibold mb-3">1. Create an Account</h3>
                <p className="text-gray-400 mb-4">Sign up for free at aurais.net to get started.</p>
                <Link href="/signup" className="inline-flex items-center gap-2 text-aurais-primary hover:text-aurais-secondary">
                  Create Account <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="glass rounded-xl p-6">
                <h3 className="font-semibold mb-3">2. Install the SDK</h3>
                <p className="text-gray-400 mb-4">Install the Aurais SDK in your project:</p>
                <pre className="bg-black/50 rounded-lg p-4 text-sm overflow-x-auto">
                  <code className="text-green-400">npm install @vorion/aurais-sdk</code>
                </pre>
              </div>

              <div className="glass rounded-xl p-6">
                <h3 className="font-semibold mb-3">3. Deploy Your First Agent</h3>
                <p className="text-gray-400 mb-4">Create and deploy an agent:</p>
                <pre className="bg-black/50 rounded-lg p-4 text-sm overflow-x-auto">
                  <code className="text-gray-300">{`import { Aurais } from '@vorion/aurais-sdk'

const aurais = new Aurais({ apiKey: 'your-api-key' })

const agent = await aurais.agents.create({
  name: 'MyFirstAgent',
  template: 'data-processor',
})

console.log('Agent deployed:', agent.id)`}</code>
                </pre>
              </div>
            </div>
          </section>

          {/* Trust Tiers Section */}
          <section id="trust-tiers" className="mb-12">
            <h2 className="text-2xl font-bold mb-4">Understanding Trust Tiers</h2>
            <p className="text-gray-400 mb-6">
              Aurais uses an 8-tier trust model (T0-T7) based on the BASIS framework. Each tier grants progressively more capabilities as agents demonstrate trustworthy behavior.
            </p>
            <div className="glass rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left px-4 py-3 font-medium">Tier</th>
                    <th className="text-left px-4 py-3 font-medium">Score Range</th>
                    <th className="text-left px-4 py-3 font-medium">Key Capabilities</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { tier: 'T0 Sandbox', range: '0-199', caps: 'Read-only, no external access' },
                    { tier: 'T1 Observed', range: '200-349', caps: 'Internal data read, transforms' },
                    { tier: 'T2 Provisional', range: '350-499', caps: 'Supervised writes, DB read' },
                    { tier: 'T3 Verified', range: '500-649', caps: 'Full DB, external APIs, code' },
                    { tier: 'T4 Operational', range: '650-799', caps: 'Agent comms, workflows' },
                    { tier: 'T5 Trusted', range: '800-875', caps: 'Delegation, autonomous' },
                    { tier: 'T6 Certified', range: '876-949', caps: 'Spawn agents, infrastructure' },
                    { tier: 'T7 Autonomous', range: '950-1000', caps: 'Full admin, governance' },
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td className="px-4 py-3 font-medium">{row.tier}</td>
                      <td className="px-4 py-3 text-gray-400">{row.range}</td>
                      <td className="px-4 py-3 text-gray-400">{row.caps}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
