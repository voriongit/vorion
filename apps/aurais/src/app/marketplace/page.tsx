'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Bot,
  Shield,
  Zap,
  Activity,
  Settings,
  LogOut,
  Search,
  Filter,
  Star,
  Download,
  ChevronRight,
  BarChart3,
  Users,
  Check,
  X,
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
} from 'lucide-react'

// BASIS Trust Tiers (T0-T7) with updated score ranges
const TRUST_TIERS = {
  T0_SANDBOX: { name: 'Sandbox', min: 0, max: 199, color: 'text-red-400', bg: 'bg-red-500/20' },
  T1_OBSERVED: { name: 'Observed', min: 200, max: 349, color: 'text-orange-400', bg: 'bg-orange-500/20' },
  T2_PROVISIONAL: { name: 'Provisional', min: 350, max: 499, color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  T3_VERIFIED: { name: 'Verified', min: 500, max: 649, color: 'text-lime-400', bg: 'bg-lime-500/20' },
  T4_OPERATIONAL: { name: 'Operational', min: 650, max: 799, color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
  T5_TRUSTED: { name: 'Trusted', min: 800, max: 875, color: 'text-blue-400', bg: 'bg-blue-500/20' },
  T6_CERTIFIED: { name: 'Certified', min: 876, max: 949, color: 'text-purple-400', bg: 'bg-purple-500/20' },
  T7_AUTONOMOUS: { name: 'Autonomous', min: 950, max: 1000, color: 'text-aurais-primary', bg: 'bg-aurais-primary/20' },
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

// Categories for filtering
const CATEGORIES = [
  { id: 'all', name: 'All Agents', icon: Bot },
  { id: 'data', name: 'Data & Analytics', icon: Database },
  { id: 'code', name: 'Code & Development', icon: Code },
  { id: 'communication', name: 'Communication', icon: MessageSquare },
  { id: 'automation', name: 'Automation', icon: Cpu },
  { id: 'research', name: 'Research & AI', icon: Brain },
]

// Mock marketplace agents with varying trust scores
const marketplaceAgents = [
  {
    id: 'agent-001',
    name: 'DataForge Pro',
    description: 'Enterprise-grade data pipeline automation with real-time processing and ML integration.',
    category: 'data',
    trustScore: 892,
    rating: 4.9,
    reviews: 1247,
    installs: 45200,
    publisher: 'Vorion Labs',
    verified: true,
    capabilities: ['Read databases', 'Write approved data', 'External API calls', 'ML inference'],
    icon: Database,
  },
  {
    id: 'agent-002',
    name: 'CodeSentry',
    description: 'AI-powered security code review with vulnerability detection and fix suggestions.',
    category: 'code',
    trustScore: 847,
    rating: 4.8,
    reviews: 892,
    installs: 32100,
    publisher: 'SecureAI Inc',
    verified: true,
    capabilities: ['Read source code', 'Generate reports', 'CI/CD integration', 'Sandbox execution'],
    icon: Lock,
  },
  {
    id: 'agent-003',
    name: 'DocuMind',
    description: 'Intelligent document processing with extraction, summarization, and knowledge graph building.',
    category: 'research',
    trustScore: 723,
    rating: 4.7,
    reviews: 654,
    installs: 28400,
    publisher: 'CogniDocs',
    verified: true,
    capabilities: ['Read documents', 'Generate summaries', 'Knowledge extraction', 'Search integration'],
    icon: FileText,
  },
  {
    id: 'agent-004',
    name: 'FlowMaster',
    description: 'Visual workflow automation builder with 200+ integrations and conditional logic.',
    category: 'automation',
    trustScore: 681,
    rating: 4.6,
    reviews: 1089,
    installs: 51300,
    publisher: 'AutomateNow',
    verified: true,
    capabilities: ['Workflow execution', 'API integrations', 'Scheduled tasks', 'Event triggers'],
    icon: Zap,
  },
  {
    id: 'agent-005',
    name: 'CommBot',
    description: 'Multi-channel customer communication agent with sentiment analysis and auto-routing.',
    category: 'communication',
    trustScore: 598,
    rating: 4.5,
    reviews: 423,
    installs: 18700,
    publisher: 'ChatFlow',
    verified: false,
    capabilities: ['Read messages', 'Send responses', 'Sentiment analysis', 'Ticket routing'],
    icon: MessageSquare,
  },
  {
    id: 'agent-006',
    name: 'InsightEngine',
    description: 'Business intelligence agent that generates reports, dashboards, and predictive analytics.',
    category: 'data',
    trustScore: 534,
    rating: 4.4,
    reviews: 312,
    installs: 14200,
    publisher: 'AnalyticsPro',
    verified: false,
    capabilities: ['Read analytics', 'Generate reports', 'Dashboard creation', 'Trend analysis'],
    icon: Activity,
  },
  {
    id: 'agent-007',
    name: 'TestPilot',
    description: 'Automated testing agent for web applications with visual regression and accessibility checks.',
    category: 'code',
    trustScore: 456,
    rating: 4.3,
    reviews: 287,
    installs: 12800,
    publisher: 'QA Labs',
    verified: true,
    capabilities: ['Run test suites', 'Generate screenshots', 'Accessibility audit', 'Report generation'],
    icon: Eye,
  },
  {
    id: 'agent-008',
    name: 'ResearchAssist',
    description: 'Academic research assistant for literature review, citation management, and synthesis.',
    category: 'research',
    trustScore: 389,
    rating: 4.2,
    reviews: 198,
    installs: 8900,
    publisher: 'AcademicAI',
    verified: false,
    capabilities: ['Search papers', 'Citation formatting', 'Summary generation', 'Export documents'],
    icon: Brain,
  },
  {
    id: 'agent-009',
    name: 'WebScraper Pro',
    description: 'Intelligent web data extraction with anti-detection and structured output.',
    category: 'data',
    trustScore: 267,
    rating: 4.0,
    reviews: 156,
    installs: 6400,
    publisher: 'DataHarvest',
    verified: false,
    capabilities: ['Read web pages', 'Extract data', 'Rate limiting', 'JSON export'],
    icon: Globe,
  },
  {
    id: 'agent-010',
    name: 'CodeGen Alpha',
    description: 'Experimental code generation agent using latest LLM models. Sandbox environment only.',
    category: 'code',
    trustScore: 142,
    rating: 3.8,
    reviews: 89,
    installs: 3200,
    publisher: 'AI Experiments',
    verified: false,
    capabilities: ['Generate code', 'Sandbox execution', 'Limited file access'],
    icon: Sparkles,
  },
]

export default function MarketplacePage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedTier, setSelectedTier] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<typeof marketplaceAgents[0] | null>(null)

  const filteredAgents = marketplaceAgents.filter((agent) => {
    const matchesSearch =
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.publisher.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesCategory = selectedCategory === 'all' || agent.category === selectedCategory

    const agentTier = getTierFromScore(agent.trustScore)
    const matchesTier = selectedTier === 'all' || agentTier === selectedTier

    return matchesSearch && matchesCategory && matchesTier
  })

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
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition"
          >
            <BarChart3 className="w-5 h-5" />
            <span>Dashboard</span>
          </Link>
          <Link
            href="/dashboard/agents"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition"
          >
            <Bot className="w-5 h-5" />
            <span>My Agents</span>
          </Link>
          <Link
            href="/marketplace"
            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-aurais-primary/10 text-white"
          >
            <Users className="w-5 h-5" />
            <span>Marketplace</span>
          </Link>
          <Link
            href="/dashboard/activity"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition"
          >
            <Activity className="w-5 h-5" />
            <span>Activity</span>
          </Link>
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition"
          >
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
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Agent Marketplace</h1>
            <p className="text-gray-400">Discover and deploy trust-verified AI agents</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-aurais-primary focus:outline-none text-sm w-80"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg border transition ${
                showFilters
                  ? 'bg-aurais-primary/20 border-aurais-primary text-aurais-primary'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
              }`}
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="glass rounded-xl p-6 mb-6">
            <div className="grid grid-cols-2 gap-6">
              {/* Category Filter */}
              <div>
                <h3 className="text-sm font-medium mb-3 text-gray-300">Category</h3>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition ${
                        selectedCategory === cat.id
                          ? 'bg-aurais-primary text-white'
                          : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <cat.icon className="w-4 h-4" />
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Trust Tier Filter */}
              <div>
                <h3 className="text-sm font-medium mb-3 text-gray-300">Trust Tier (BASIS)</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedTier('all')}
                    className={`px-3 py-1.5 rounded-lg text-sm transition ${
                      selectedTier === 'all'
                        ? 'bg-aurais-primary text-white'
                        : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    All Tiers
                  </button>
                  {Object.entries(TRUST_TIERS).map(([key, tier]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedTier(key)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition ${
                        selectedTier === key
                          ? `${tier.bg} ${tier.color} border border-current`
                          : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {tier.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results Count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-400">
            Showing {filteredAgents.length} of {marketplaceAgents.length} agents
          </p>
          <select className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-aurais-primary">
            <option value="popular">Most Popular</option>
            <option value="rating">Highest Rated</option>
            <option value="trust">Highest Trust Score</option>
            <option value="recent">Recently Added</option>
          </select>
        </div>

        {/* Agent Grid */}
        <div className="grid grid-cols-2 gap-4">
          {filteredAgents.map((agent) => {
            const tierKey = getTierFromScore(agent.trustScore)
            const tier = TRUST_TIERS[tierKey]
            const AgentIcon = agent.icon

            return (
              <div
                key={agent.id}
                onClick={() => router.push(`/marketplace/${agent.id}`)}
                className="glass rounded-xl p-5 hover:bg-white/10 transition cursor-pointer group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-aurais-primary/20 to-aurais-accent/20 flex items-center justify-center flex-shrink-0">
                    <AgentIcon className="w-7 h-7 text-aurais-primary" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">{agent.name}</h3>
                      {agent.verified && (
                        <div className="w-4 h-4 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                          <Check className="w-3 h-3 text-blue-400" />
                        </div>
                      )}
                    </div>

                    <p className="text-sm text-gray-400 line-clamp-2 mb-3">{agent.description}</p>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Shield className="w-4 h-4 text-gray-500" />
                        <span className="font-medium">{agent.trustScore}</span>
                        <span className={`text-xs ${tier.color}`}>{tier.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        <span>{agent.rating}</span>
                        <span className="text-gray-500">({agent.reviews})</span>
                      </div>
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-white transition flex-shrink-0" />
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>{agent.publisher}</span>
                    <span>•</span>
                    <span>{agent.installs.toLocaleString()} installs</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      // Handle install
                    }}
                    className="px-3 py-1.5 rounded-lg bg-aurais-primary hover:bg-aurais-secondary transition text-sm font-medium"
                  >
                    Install
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {filteredAgents.length === 0 && (
          <div className="text-center py-16 glass rounded-xl">
            <Bot className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <h3 className="text-lg font-medium mb-2">No agents found</h3>
            <p className="text-gray-400 mb-4">Try adjusting your search or filters</p>
            <button
              onClick={() => {
                setSearchQuery('')
                setSelectedCategory('all')
                setSelectedTier('all')
              }}
              className="text-aurais-primary hover:text-aurais-secondary transition"
            >
              Clear all filters
            </button>
          </div>
        )}
      </main>

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-8">
          <div className="glass rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-aurais-primary/20 to-aurais-accent/20 flex items-center justify-center">
                    <selectedAgent.icon className="w-8 h-8 text-aurais-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-xl font-bold">{selectedAgent.name}</h2>
                      {selectedAgent.verified && (
                        <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
                          <Check className="w-3 h-3 text-blue-400" />
                        </div>
                      )}
                    </div>
                    <p className="text-gray-400">{selectedAgent.publisher}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAgent(null)}
                  className="p-2 rounded-lg hover:bg-white/10 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <p className="text-gray-300">{selectedAgent.description}</p>

              {/* Trust Score Section */}
              <div className="glass rounded-xl p-4">
                <h3 className="text-sm font-medium mb-3">Trust Score (BASIS)</h3>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl font-bold">{selectedAgent.trustScore}</span>
                      <span className={`px-2 py-1 rounded-full text-xs ${TRUST_TIERS[getTierFromScore(selectedAgent.trustScore)].bg} ${TRUST_TIERS[getTierFromScore(selectedAgent.trustScore)].color}`}>
                        {TRUST_TIERS[getTierFromScore(selectedAgent.trustScore)].name}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-aurais-primary to-aurais-accent"
                        style={{ width: `${(selectedAgent.trustScore / 1000) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1 text-xs text-gray-500">
                      <span>0</span>
                      <span>1000</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Capabilities */}
              <div>
                <h3 className="text-sm font-medium mb-3">Capabilities</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedAgent.capabilities.map((cap, i) => (
                    <span
                      key={i}
                      className="px-3 py-1.5 rounded-lg bg-white/5 text-sm text-gray-300"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="glass rounded-xl p-4 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    <span className="text-xl font-bold">{selectedAgent.rating}</span>
                  </div>
                  <p className="text-xs text-gray-400">{selectedAgent.reviews} reviews</p>
                </div>
                <div className="glass rounded-xl p-4 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Download className="w-4 h-4 text-aurais-primary" />
                    <span className="text-xl font-bold">{(selectedAgent.installs / 1000).toFixed(1)}K</span>
                  </div>
                  <p className="text-xs text-gray-400">Installs</p>
                </div>
                <div className="glass rounded-xl p-4 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Shield className="w-4 h-4 text-green-400" />
                    <span className="text-xl font-bold">T{getTierFromScore(selectedAgent.trustScore).charAt(1)}</span>
                  </div>
                  <p className="text-xs text-gray-400">Trust Tier</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button className="flex-1 py-3 rounded-xl bg-aurais-primary hover:bg-aurais-secondary transition font-medium">
                  Install Agent
                </button>
                <button className="px-4 py-3 rounded-xl glass glass-hover transition">
                  <Eye className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
