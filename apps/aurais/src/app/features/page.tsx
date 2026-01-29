import Link from 'next/link'
import {
  Bot,
  Shield,
  Zap,
  Eye,
  Lock,
  Users,
  BarChart3,
  Code,
  Globe,
  CheckCircle,
  ArrowRight,
  Cpu,
  GitBranch,
  Activity,
} from 'lucide-react'

const features = [
  {
    icon: Shield,
    title: 'Trust-Based Security',
    description: 'Every agent operates within the BASIS framework with 23 trust factors evaluated continuously. Capabilities are earned, not granted.',
    highlights: ['8-tier trust model (T0-T7)', '23 trust factors', 'Real-time scoring'],
  },
  {
    icon: Eye,
    title: 'Full Observability',
    description: 'Complete visibility into every agent action. Immutable audit logs, real-time monitoring, and anomaly detection built in.',
    highlights: ['Action logging', 'Anomaly detection', 'Audit trails'],
  },
  {
    icon: Cpu,
    title: 'Progressive Capabilities',
    description: 'Agents start in sandbox and earn capabilities through demonstrated trustworthiness. From read-only to full autonomy.',
    highlights: ['Sandbox isolation', 'Earned access', 'Capability governance'],
  },
  {
    icon: Users,
    title: 'Agent Marketplace',
    description: 'Deploy pre-verified agents from the marketplace or create custom agents. All agents come with trust scores and capability listings.',
    highlights: ['Pre-verified agents', 'One-click deploy', 'Trust transparency'],
  },
  {
    icon: GitBranch,
    title: 'Multi-Agent Workflows',
    description: 'Orchestrate complex workflows across multiple agents. Built-in coordination, delegation, and escalation paths.',
    highlights: ['Workflow builder', 'Agent delegation', 'Human escalation'],
  },
  {
    icon: Code,
    title: 'Developer-First API',
    description: 'Comprehensive REST API and SDKs for TypeScript, Python, and Go. Deploy and manage agents programmatically.',
    highlights: ['REST API', 'TypeScript SDK', 'Webhooks'],
  },
  {
    icon: Lock,
    title: 'Enterprise Security',
    description: 'SOC 2 Type II certified, GDPR compliant, and ISO 27001 certified. Enterprise-grade security for sensitive operations.',
    highlights: ['SOC 2 certified', 'GDPR compliant', 'SSO/SAML'],
  },
  {
    icon: Activity,
    title: 'Real-Time Analytics',
    description: 'Monitor agent performance, trust scores, and resource usage in real-time. Custom dashboards and alerting.',
    highlights: ['Live dashboards', 'Custom alerts', 'Performance metrics'],
  },
]

export default function FeaturesPage() {
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
            <Link href="/features" className="text-white font-medium">Features</Link>
            <Link href="/pricing" className="text-gray-400 hover:text-white transition">Pricing</Link>
            <Link href="/docs" className="text-gray-400 hover:text-white transition">Docs</Link>
            <Link href="/login" className="text-gray-400 hover:text-white transition">Sign In</Link>
            <Link href="/signup" className="px-4 py-2 rounded-lg bg-aurais-primary hover:bg-aurais-secondary transition">
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-6">
            Everything you need to deploy <span className="text-gradient">trusted AI agents</span>
          </h1>
          <p className="text-xl text-gray-400 mb-8">
            Aurais provides the complete platform for building, deploying, and governing autonomous AI agents with built-in trust verification.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/signup" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-aurais-primary hover:bg-aurais-secondary transition font-medium">
              Start Free <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/demo" className="px-6 py-3 rounded-xl glass glass-hover transition font-medium">
              View Demo
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 gap-6">
            {features.map((feature, i) => (
              <div key={i} className="glass rounded-2xl p-8">
                <div className="w-12 h-12 rounded-xl bg-aurais-primary/20 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-aurais-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-gray-400 mb-4">{feature.description}</p>
                <div className="flex flex-wrap gap-2">
                  {feature.highlights.map((h, j) => (
                    <span key={j} className="inline-flex items-center gap-1 text-sm text-gray-300">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Framework Section */}
      <section className="py-16 px-4 bg-aurais-primary/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Built on the BASIS Trust Framework</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Every Aurais agent is evaluated against 23 trust factors across safety, security, and performance dimensions.
            </p>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Core Factors', count: 15, desc: 'Foundational trust metrics' },
              { label: 'Life-Critical', count: 8, desc: 'For healthcare/safety apps' },
              { label: 'Trust Tiers', count: 8, desc: 'T0-T7 progression' },
              { label: 'Capabilities', count: '60+', desc: 'Tools and permissions' },
            ].map((stat, i) => (
              <div key={i} className="glass rounded-xl p-6 text-center">
                <div className="text-3xl font-bold text-aurais-primary mb-2">{stat.count}</div>
                <div className="font-medium mb-1">{stat.label}</div>
                <div className="text-sm text-gray-400">{stat.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to deploy trusted AI agents?</h2>
          <p className="text-gray-400 mb-8">Start free and scale as you grow. No credit card required.</p>
          <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-aurais-primary hover:bg-aurais-secondary transition font-medium text-lg">
            Get Started Free <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </div>
  )
}
