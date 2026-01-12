'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, Filter, Shield, CheckCircle, ExternalLink } from 'lucide-react'

export default function Registry() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTier, setSelectedTier] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const filteredAgents = mockRegistryAgents.filter((agent) => {
    const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.id.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesTier = !selectedTier || agent.tier === selectedTier
    const matchesCategory = !selectedCategory || agent.category === selectedCategory
    return matchesSearch && matchesTier && matchesCategory
  })

  return (
    <div className="min-h-screen bg-surface-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Agent Registry</h1>
          <p className="text-gray-400">
            Browse certified AI agents. Verify trust scores and compliance.
          </p>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search agents by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-surface border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
            />
          </div>
          
          <div className="flex gap-4">
            <select
              value={selectedTier || ''}
              onChange={(e) => setSelectedTier(e.target.value || null)}
              className="px-4 py-3 bg-surface border border-gray-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
            >
              <option value="">All Tiers</option>
              <option value="Sovereign">💎 Sovereign</option>
              <option value="Verified">🔵 Verified</option>
              <option value="Trusted">🟢 Trusted</option>
              <option value="Certified">🟡 Certified</option>
              <option value="Provisional">🟠 Provisional</option>
            </select>

            <select
              value={selectedCategory || ''}
              onChange={(e) => setSelectedCategory(e.target.value || null)}
              className="px-4 py-3 bg-surface border border-gray-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
            >
              <option value="">All Categories</option>
              <option value="Assistant">Assistant</option>
              <option value="Data Processing">Data Processing</option>
              <option value="Automation">Automation</option>
              <option value="Customer Support">Customer Support</option>
              <option value="Analytics">Analytics</option>
            </select>
          </div>
        </div>

        {/* Results count */}
        <p className="text-gray-400 mb-4">
          Showing {filteredAgents.length} certified agents
        </p>

        {/* Agent Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAgents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>

        {filteredAgents.length === 0 && (
          <div className="text-center py-16">
            <Shield className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No agents found matching your criteria.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function AgentCard({ agent }: { agent: typeof mockRegistryAgents[0] }) {
  const tierEmoji: Record<string, string> = {
    Sovereign: '💎',
    Verified: '🔵',
    Trusted: '🟢',
    Certified: '🟡',
    Provisional: '🟠',
  }

  const tierColors: Record<string, string> = {
    Sovereign: 'text-purple-400',
    Verified: 'text-blue-400',
    Trusted: 'text-green-400',
    Certified: 'text-yellow-400',
    Provisional: 'text-orange-400',
  }

  return (
    <div className="bg-surface rounded-xl border border-gray-800 p-6 hover:border-primary-500/50 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">{agent.name}</h3>
          <p className="text-sm text-gray-500 font-mono">{agent.id}</p>
        </div>
        <div className="flex items-center gap-1">
          <span>{tierEmoji[agent.tier]}</span>
          <span className={`text-sm font-medium ${tierColors[agent.tier]}`}>
            {agent.tier}
          </span>
        </div>
      </div>

      <p className="text-gray-400 text-sm mb-4 line-clamp-2">
        {agent.description}
      </p>

      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-gray-500">Trust Score</p>
          <p className="text-2xl font-bold text-white">{agent.trustScore}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Certification</p>
          <p className="text-sm font-medium text-white">{agent.certification}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {agent.capabilities.slice(0, 3).map((cap) => (
          <span
            key={cap}
            className="px-2 py-1 bg-primary-500/10 text-primary-400 rounded text-xs font-mono"
          >
            {cap}
          </span>
        ))}
        {agent.capabilities.length > 3 && (
          <span className="px-2 py-1 bg-gray-700 text-gray-400 rounded text-xs">
            +{agent.capabilities.length - 3} more
          </span>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-800">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <CheckCircle className="h-4 w-4 text-green-400" />
          Verified by AgentAnchor
        </div>
        <Link
          href={`/registry/${agent.id}`}
          className="text-primary-400 hover:text-primary-300 text-sm font-medium inline-flex items-center gap-1"
        >
          View Details
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}

const mockRegistryAgents = [
  {
    id: 'ag_acme_assist_01',
    name: 'Acme Marketing Assistant',
    description: 'AI-powered marketing assistant for content generation, campaign analysis, and customer engagement.',
    trustScore: 847,
    tier: 'Verified',
    certification: 'Platinum',
    category: 'Assistant',
    capabilities: ['content_generation', 'data_analysis', 'send_external', 'schedule'],
    organization: 'Acme Corp',
  },
  {
    id: 'ag_datawise_proc',
    name: 'DataWise Processor',
    description: 'High-performance data processing agent for ETL operations and analytics pipelines.',
    trustScore: 723,
    tier: 'Trusted',
    certification: 'Gold',
    category: 'Data Processing',
    capabilities: ['bulk_process', 'data_transform', 'export'],
    organization: 'DataWise Inc',
  },
  {
    id: 'ag_helpbot_prime',
    name: 'HelpBot Prime',
    description: 'Customer support automation agent with multi-channel communication capabilities.',
    trustScore: 689,
    tier: 'Trusted',
    certification: 'Gold',
    category: 'Customer Support',
    capabilities: ['send_external', 'read_user', 'generate_text'],
    organization: 'SupportTech',
  },
  {
    id: 'ag_analytics_hub',
    name: 'Analytics Hub Agent',
    description: 'Business intelligence agent for automated reporting and insights generation.',
    trustScore: 512,
    tier: 'Trusted',
    certification: 'Silver',
    category: 'Analytics',
    capabilities: ['data_analysis', 'generate_report', 'schedule'],
    organization: 'InsightsCo',
  },
  {
    id: 'ag_autoflow_01',
    name: 'AutoFlow Orchestrator',
    description: 'Workflow automation agent for complex business process management.',
    trustScore: 445,
    tier: 'Certified',
    certification: 'Silver',
    category: 'Automation',
    capabilities: ['workflow_execute', 'invoke_api', 'schedule'],
    organization: 'FlowTech',
  },
  {
    id: 'ag_content_gen',
    name: 'ContentGen Pro',
    description: 'Creative content generation agent for blogs, social media, and marketing materials.',
    trustScore: 398,
    tier: 'Certified',
    certification: 'Bronze',
    category: 'Assistant',
    capabilities: ['content_generation', 'generate_text'],
    organization: 'CreativeAI',
  },
]
