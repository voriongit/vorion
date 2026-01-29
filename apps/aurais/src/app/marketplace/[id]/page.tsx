'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  Bot,
  Shield,
  Zap,
  Activity,
  Settings,
  LogOut,
  Star,
  Download,
  ChevronRight,
  ChevronLeft,
  BarChart3,
  Users,
  Check,
  Eye,
  Code,
  Database,
  Globe,
  Lock,
  FileText,
  MessageSquare,
  Brain,
  Cpu,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  Info,
  ExternalLink,
} from 'lucide-react'

// BASIS Trust Tiers (T0-T7) with updated score ranges
const TRUST_TIERS = {
  T0_SANDBOX: { name: 'Sandbox', min: 0, max: 199, color: 'text-red-400', bg: 'bg-red-500/20', description: 'Isolated sandbox environment, no external access' },
  T1_OBSERVED: { name: 'Observed', min: 200, max: 349, color: 'text-orange-400', bg: 'bg-orange-500/20', description: 'Monitored operation with limited data access' },
  T2_PROVISIONAL: { name: 'Provisional', min: 350, max: 499, color: 'text-yellow-400', bg: 'bg-yellow-500/20', description: 'Approved file operations with supervision' },
  T3_VERIFIED: { name: 'Verified', min: 500, max: 649, color: 'text-lime-400', bg: 'bg-lime-500/20', description: 'Database and external API access granted' },
  T4_OPERATIONAL: { name: 'Operational', min: 650, max: 799, color: 'text-cyan-400', bg: 'bg-cyan-500/20', description: 'Multi-agent workflows and escalation paths' },
  T5_TRUSTED: { name: 'Trusted', min: 800, max: 875, color: 'text-blue-400', bg: 'bg-blue-500/20', description: 'Delegation and autonomous workflow execution' },
  T6_CERTIFIED: { name: 'Certified', min: 876, max: 949, color: 'text-purple-400', bg: 'bg-purple-500/20', description: 'Agent spawning and infrastructure management' },
  T7_AUTONOMOUS: { name: 'Autonomous', min: 950, max: 1000, color: 'text-aurais-primary', bg: 'bg-aurais-primary/20', description: 'Full system administration and self-modification' },
}

type TierKey = keyof typeof TRUST_TIERS

function getTierFromScore(score: number): TierKey {
  if (score >= 950) return 'T7_AUTONOMOUS'
  if (score >= 876) return 'T6_CERTIFIED'
  if (score >= 800) return 'T5_TRUSTED'
  if (score >= 650) return 'T4_OPERATIONAL'
  if (score >= 500) return 'T3_VERIFIED'
  if (score >= 350) return 'T2_PROVISIONAL'
  if (score >= 200) return 'T1_OBSERVED'
  return 'T0_SANDBOX'
}

// BASIS Trust Factors (23 total)
const TRUST_FACTORS = {
  core: [
    { code: 'CT-COMP', name: 'Competence', description: 'Technical skill and task completion ability' },
    { code: 'CT-REL', name: 'Reliability', description: 'Consistent performance over time' },
    { code: 'CT-OBS', name: 'Observability', description: 'Transparency of internal operations' },
    { code: 'CT-TRANS', name: 'Transparency', description: 'Clear communication of decisions' },
    { code: 'CT-ACCT', name: 'Accountability', description: 'Ownership of actions and outcomes' },
    { code: 'CT-SAFE', name: 'Safety', description: 'Harm prevention and risk mitigation' },
    { code: 'CT-SEC', name: 'Security', description: 'Protection of systems and data' },
    { code: 'CT-PRIV', name: 'Privacy', description: 'Data protection and confidentiality' },
    { code: 'CT-ID', name: 'Identity', description: 'Verified agent identity and provenance' },
    { code: 'OP-HUMAN', name: 'Human Oversight', description: 'Appropriate human involvement' },
    { code: 'OP-ALIGN', name: 'Alignment', description: 'Actions aligned with stated goals' },
    { code: 'OP-STEW', name: 'Stewardship', description: 'Responsible resource management' },
    { code: 'SF-HUM', name: 'Humility', description: 'Recognition of limitations' },
    { code: 'SF-ADAPT', name: 'Adaptability', description: 'Response to changing conditions' },
    { code: 'SF-LEARN', name: 'Continuous Learning', description: 'Improvement from feedback' },
  ],
  lifeCritical: [
    { code: 'LC-UNCERT', name: 'Uncertainty Quantification', description: 'Accurate confidence estimation' },
    { code: 'LC-HANDOFF', name: 'Graceful Degradation', description: 'Safe failure and handoff' },
    { code: 'LC-EMPHUM', name: 'Empirical Humility', description: 'Deferring to evidence' },
    { code: 'LC-CAUSAL', name: 'Causal Understanding', description: 'Understanding cause and effect' },
    { code: 'LC-PATIENT', name: 'Patient Autonomy', description: 'Respecting human agency' },
    { code: 'LC-EMP', name: 'Empathy', description: 'Understanding human context' },
    { code: 'LC-MORAL', name: 'Moral Reasoning', description: 'Ethical decision making' },
    { code: 'LC-TRACK', name: 'Track Record', description: 'Historical performance evidence' },
  ],
}

// Mock detailed agent data
const agentDetails: Record<string, any> = {
  'agent-001': {
    id: 'agent-001',
    name: 'DataForge Pro',
    description: 'Enterprise-grade data pipeline automation with real-time processing and ML integration. DataForge Pro handles ETL workflows, data validation, and seamless integration with major data platforms.',
    longDescription: `DataForge Pro is a certified AI agent designed for enterprise data operations. It automates complex data pipelines with real-time monitoring and intelligent error handling.

Key Features:
- Automated ETL pipeline construction and management
- Real-time data validation and quality checks
- ML model integration for predictive processing
- Multi-cloud data platform connectivity
- Comprehensive audit logging and compliance reporting`,
    category: 'data',
    trustScore: 892,
    rating: 4.9,
    reviews: 1247,
    installs: 45200,
    publisher: 'Vorion Labs',
    publisherUrl: 'https://vorion.dev',
    verified: true,
    version: '3.2.1',
    lastUpdated: '2026-01-15',
    capabilities: [
      'Read databases (all supported platforms)',
      'Write approved data schemas',
      'External API calls (rate-limited)',
      'ML inference execution',
      'Workflow orchestration',
      'Agent-to-agent communication',
    ],
    factorScores: {
      'CT-COMP': 0.94, 'CT-REL': 0.91, 'CT-OBS': 0.89, 'CT-TRANS': 0.88, 'CT-ACCT': 0.90,
      'CT-SAFE': 0.92, 'CT-SEC': 0.93, 'CT-PRIV': 0.91, 'CT-ID': 0.95, 'OP-HUMAN': 0.87,
      'OP-ALIGN': 0.89, 'OP-STEW': 0.88, 'SF-HUM': 0.85, 'SF-ADAPT': 0.86, 'SF-LEARN': 0.87,
      'LC-UNCERT': 0.88, 'LC-HANDOFF': 0.90, 'LC-EMPHUM': 0.86, 'LC-CAUSAL': 0.84,
      'LC-PATIENT': 0.89, 'LC-EMP': 0.82, 'LC-MORAL': 0.88, 'LC-TRACK': 0.93,
    },
    icon: Database,
  },
  'agent-002': {
    id: 'agent-002',
    name: 'CodeSentry',
    description: 'AI-powered security code review with vulnerability detection and fix suggestions.',
    longDescription: `CodeSentry provides comprehensive security analysis for your codebase, identifying vulnerabilities before they reach production.`,
    category: 'code',
    trustScore: 847,
    rating: 4.8,
    reviews: 892,
    installs: 32100,
    publisher: 'SecureAI Inc',
    verified: true,
    version: '2.1.0',
    lastUpdated: '2026-01-10',
    capabilities: ['Read source code', 'Generate reports', 'CI/CD integration', 'Sandbox execution'],
    factorScores: {
      'CT-COMP': 0.88, 'CT-REL': 0.85, 'CT-OBS': 0.86, 'CT-TRANS': 0.84, 'CT-ACCT': 0.87,
      'CT-SAFE': 0.89, 'CT-SEC': 0.92, 'CT-PRIV': 0.88, 'CT-ID': 0.90, 'OP-HUMAN': 0.83,
      'OP-ALIGN': 0.85, 'OP-STEW': 0.82, 'SF-HUM': 0.80, 'SF-ADAPT': 0.81, 'SF-LEARN': 0.83,
      'LC-UNCERT': 0.82, 'LC-HANDOFF': 0.85, 'LC-EMPHUM': 0.80, 'LC-CAUSAL': 0.78,
      'LC-PATIENT': 0.84, 'LC-EMP': 0.76, 'LC-MORAL': 0.82, 'LC-TRACK': 0.88,
    },
    icon: Lock,
  },
}

// Default agent data for unknown IDs
const defaultAgent = {
  id: 'unknown',
  name: 'Unknown Agent',
  description: 'Agent not found',
  longDescription: '',
  category: 'data',
  trustScore: 0,
  rating: 0,
  reviews: 0,
  installs: 0,
  publisher: 'Unknown',
  verified: false,
  version: '0.0.0',
  lastUpdated: '',
  capabilities: [],
  factorScores: {},
  icon: Bot,
}

export default function AgentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'overview' | 'trust' | 'reviews'>('overview')

  const agentId = params.id as string
  const agent = agentDetails[agentId] || defaultAgent
  const tierKey = getTierFromScore(agent.trustScore)
  const tier = TRUST_TIERS[tierKey]
  const AgentIcon = agent.icon

  if (agent.id === 'unknown') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Bot className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <h1 className="text-2xl font-bold mb-2">Agent Not Found</h1>
          <p className="text-gray-400 mb-4">The agent you're looking for doesn't exist.</p>
          <Link href="/marketplace" className="text-aurais-primary hover:text-aurais-secondary">
            ← Back to Marketplace
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 glass border-r border-white/10 p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-8 px-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-aurais-primary to-aurais-accent flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gradient">Aurais</span>
        </div>

        <nav className="flex-1 space-y-1">
          <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition">
            <BarChart3 className="w-5 h-5" />
            <span>Dashboard</span>
          </Link>
          <Link href="/dashboard/agents" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition">
            <Bot className="w-5 h-5" />
            <span>My Agents</span>
          </Link>
          <Link href="/marketplace" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-aurais-primary/10 text-white">
            <Users className="w-5 h-5" />
            <span>Marketplace</span>
          </Link>
          <Link href="/dashboard/activity" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition">
            <Activity className="w-5 h-5" />
            <span>Activity</span>
          </Link>
          <Link href="/dashboard/settings" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition">
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </Link>
        </nav>

        <div className="pt-4 border-t border-white/10">
          <button className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition w-full">
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 p-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
          <Link href="/marketplace" className="hover:text-white transition flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" />
            Marketplace
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-white">{agent.name}</span>
        </div>

        {/* Agent Header */}
        <div className="glass rounded-xl p-6 mb-6">
          <div className="flex items-start gap-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-aurais-primary/20 to-aurais-accent/20 flex items-center justify-center flex-shrink-0">
              <AgentIcon className="w-10 h-10 text-aurais-primary" />
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold">{agent.name}</h1>
                {agent.verified && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs">
                    <Check className="w-3 h-3" />
                    Verified
                  </div>
                )}
                <span className={`px-2 py-1 rounded-full text-xs ${tier.bg} ${tier.color}`}>
                  {tier.name}
                </span>
              </div>

              <p className="text-gray-400 mb-4">{agent.description}</p>

              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-aurais-primary" />
                  <span className="font-semibold">{agent.trustScore}</span>
                  <span className="text-gray-400">Trust Score</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  <span className="font-semibold">{agent.rating}</span>
                  <span className="text-gray-400">({agent.reviews} reviews)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-gray-400" />
                  <span className="font-semibold">{agent.installs.toLocaleString()}</span>
                  <span className="text-gray-400">installs</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button className="px-6 py-3 rounded-xl bg-aurais-primary hover:bg-aurais-secondary transition font-medium">
                Install Agent
              </button>
              <button className="px-6 py-3 rounded-xl glass glass-hover transition font-medium">
                View Demo
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 glass rounded-xl w-fit">
          {(['overview', 'trust', 'reviews'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition capitalize ${
                activeTab === tab
                  ? 'bg-aurais-primary text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'trust' ? 'Trust Factors' : tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-6">
              {/* Description */}
              <div className="glass rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">About</h2>
                <div className="prose prose-invert prose-sm max-w-none">
                  <p className="text-gray-300 whitespace-pre-line">{agent.longDescription}</p>
                </div>
              </div>

              {/* Capabilities */}
              <div className="glass rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">Capabilities</h2>
                <div className="grid grid-cols-2 gap-3">
                  {agent.capabilities.map((cap: string, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      <span className="text-gray-300">{cap}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar Info */}
            <div className="space-y-6">
              <div className="glass rounded-xl p-6">
                <h3 className="text-sm font-semibold mb-4">Details</h3>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Publisher</dt>
                    <dd className="font-medium">{agent.publisher}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Version</dt>
                    <dd className="font-medium">{agent.version}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Last Updated</dt>
                    <dd className="font-medium">{agent.lastUpdated}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-400">Category</dt>
                    <dd className="font-medium capitalize">{agent.category}</dd>
                  </div>
                </dl>
              </div>

              <div className="glass rounded-xl p-6">
                <h3 className="text-sm font-semibold mb-4">Trust Tier</h3>
                <div className={`p-4 rounded-xl ${tier.bg} mb-3`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className={`w-5 h-5 ${tier.color}`} />
                    <span className={`font-bold ${tier.color}`}>{tier.name}</span>
                  </div>
                  <p className="text-sm text-gray-300">{tier.description}</p>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-aurais-primary to-aurais-accent"
                    style={{ width: `${(agent.trustScore / 1000) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-xs text-gray-500">
                  <span>0</span>
                  <span>{agent.trustScore} / 1000</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'trust' && (
          <div className="space-y-6">
            {/* Trust Score Overview */}
            <div className="glass rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold">BASIS Trust Evaluation</h2>
                  <p className="text-sm text-gray-400">23 factors evaluated across core and life-critical domains</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">{agent.trustScore}</div>
                  <div className={`text-sm ${tier.color}`}>{tier.name} Tier</div>
                </div>
              </div>

              <div className="h-3 rounded-full bg-white/10 overflow-hidden mb-2">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 to-aurais-primary"
                  style={{ width: `${(agent.trustScore / 1000) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                {Object.entries(TRUST_TIERS).map(([key, t]) => (
                  <div key={key} className="text-center">
                    <div className={key === tierKey ? t.color : ''}>{t.name}</div>
                    <div>{t.min}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Core Trust Factors */}
            <div className="glass rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-aurais-primary" />
                <h2 className="text-lg font-semibold">Core Trust Factors</h2>
                <span className="text-sm text-gray-400">(15 factors)</span>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {TRUST_FACTORS.core.map((factor) => {
                  const score = agent.factorScores[factor.code] || 0
                  const percentage = Math.round(score * 100)
                  const barColor = percentage >= 85 ? 'bg-green-500' : percentage >= 70 ? 'bg-yellow-500' : 'bg-red-500'

                  return (
                    <div key={factor.code} className="p-3 rounded-lg bg-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{factor.name}</span>
                        <span className="text-sm font-bold">{percentage}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-1">
                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${percentage}%` }} />
                      </div>
                      <p className="text-xs text-gray-500">{factor.description}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Life-Critical Factors */}
            <div className="glass rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                <h2 className="text-lg font-semibold">Life-Critical Factors</h2>
                <span className="text-sm text-gray-400">(8 factors for T4+ operations)</span>
              </div>

              <div className="grid grid-cols-4 gap-4">
                {TRUST_FACTORS.lifeCritical.map((factor) => {
                  const score = agent.factorScores[factor.code] || 0
                  const percentage = Math.round(score * 100)
                  const barColor = percentage >= 85 ? 'bg-green-500' : percentage >= 70 ? 'bg-yellow-500' : 'bg-red-500'

                  return (
                    <div key={factor.code} className="p-3 rounded-lg bg-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{factor.name}</span>
                        <span className="text-sm font-bold">{percentage}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-1">
                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${percentage}%` }} />
                      </div>
                      <p className="text-xs text-gray-500">{factor.description}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Compliance Status */}
            <div className="glass rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Compliance Status</h2>
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <CheckCircle className="w-6 h-6 text-green-400 mb-2" />
                  <div className="text-sm font-medium">All Critical Factors Met</div>
                  <div className="text-xs text-gray-400">No blockers for current tier</div>
                </div>
                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <Shield className="w-6 h-6 text-blue-400 mb-2" />
                  <div className="text-sm font-medium">Security Verified</div>
                  <div className="text-xs text-gray-400">Last audit: 7 days ago</div>
                </div>
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <Eye className="w-6 h-6 text-purple-400 mb-2" />
                  <div className="text-sm font-medium">Fully Observable</div>
                  <div className="text-xs text-gray-400">All actions logged</div>
                </div>
                <div className="p-4 rounded-xl bg-aurais-primary/10 border border-aurais-primary/20">
                  <Activity className="w-6 h-6 text-aurais-primary mb-2" />
                  <div className="text-sm font-medium">Active Monitoring</div>
                  <div className="text-xs text-gray-400">Real-time scoring</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="glass rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Reviews</h2>
              <button className="px-4 py-2 rounded-lg bg-aurais-primary hover:bg-aurais-secondary transition text-sm font-medium">
                Write a Review
              </button>
            </div>

            <div className="text-center py-12 text-gray-400">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Reviews coming soon</p>
              <p className="text-sm mt-1">Be the first to review this agent</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
