'use client'

import { useState, useEffect, useMemo } from 'react'
import { Store, RefreshCw, Sparkles, TrendingUp, Search, Filter, Bot, LayoutGrid, List } from 'lucide-react'
import Link from 'next/link'

interface Agent {
  id: string
  name: string
  description: string | null
  specialization: string | null
  trust_score: number
  trust_tier: string
  capabilities: string[]
  personality_traits: string[]
  avatar_url: string | null
  created_at: string
}

// Group agents by first letter
function groupByFirstLetter(agents: Agent[]): Map<string, Agent[]> {
  const groups = new Map<string, Agent[]>()
  for (const agent of agents) {
    const firstLetter = (agent.name?.[0] || '#').toUpperCase()
    const key = /[A-Z]/.test(firstLetter) ? firstLetter : '#'
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(agent)
  }
  // Sort keys alphabetically with # at the end
  return new Map([...groups.entries()].sort((a, b) => {
    if (a[0] === '#') return 1
    if (b[0] === '#') return -1
    return a[0].localeCompare(b[0])
  }))
}

// Agent Card Component
function AgentCard({ agent, getTrustBadgeColor }: { agent: Agent; getTrustBadgeColor: (tier: string) => string }) {
  return (
    <Link
      href={`/marketplace/${agent.id}`}
      className="bg-neutral-900 rounded-lg border border-neutral-800 p-4 hover:border-neutral-700 transition-colors group"
    >
      {/* Avatar & Name */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
          {agent.name?.charAt(0) || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-neutral-100 truncate group-hover:text-blue-400 transition-colors">
            {agent.name}
          </h3>
          <p className="text-sm text-neutral-500 truncate">
            {agent.specialization || 'General Assistant'}
          </p>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-neutral-400 line-clamp-2 mb-3">
        {agent.description || 'No description available'}
      </p>

      {/* Trust Badge */}
      <div className="flex items-center justify-between">
        <span className={`px-2 py-1 rounded text-xs font-medium ${getTrustBadgeColor(agent.trust_tier)}`}>
          {agent.trust_tier || 'Untrusted'}
        </span>
        <span className="text-sm text-neutral-500">
          Score: {agent.trust_score}
        </span>
      </div>

      {/* Capabilities */}
      {agent.capabilities && agent.capabilities.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {agent.capabilities.slice(0, 3).map((cap, i) => (
            <span
              key={i}
              className="px-2 py-0.5 bg-neutral-800 rounded text-xs text-neutral-400"
            >
              {cap}
            </span>
          ))}
          {agent.capabilities.length > 3 && (
            <span className="px-2 py-0.5 text-xs text-neutral-500">
              +{agent.capabilities.length - 3} more
            </span>
          )}
        </div>
      )}
    </Link>
  )
}

export default function MarketplacePage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState('name')
  const [viewMode, setViewMode] = useState<'grid' | 'grouped'>('grouped')

  // Group agents alphabetically when in grouped mode
  const groupedAgents = useMemo(() => {
    if (sortBy === 'name') {
      return groupByFirstLetter(agents)
    }
    return null
  }, [agents, sortBy])

  useEffect(() => {
    fetchAgents()
  }, [page, selectedCategory, sortBy])

  async function fetchAgents(reset = false) {
    setLoading(true)
    try {
      const currentPage = reset ? 1 : page
      const params = new URLSearchParams({
        page: String(currentPage),
        per_page: '24',
        sort_by: sortBy,
      })

      if (searchQuery) params.set('query', searchQuery)
      if (selectedCategory !== 'all') params.set('category', selectedCategory)

      const res = await fetch(`/api/agents/public?${params}`)
      if (res.ok) {
        const data = await res.json()
        if (reset || currentPage === 1) {
          setAgents(data.agents || [])
          setPage(1)
        } else {
          setAgents(prev => [...prev, ...(data.agents || [])])
        }
        setTotal(data.total || 0)
        setHasMore(data.has_more || false)
        if (data.categories) {
          setCategories(data.categories)
        }
      }
    } catch (err) {
      console.error('Failed to fetch agents:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchAgents(true)
  }

  const loadMore = () => {
    setPage(prev => prev + 1)
  }

  const getTrustBadgeColor = (tier: string) => {
    switch (tier?.toLowerCase()) {
      case 'legendary': return 'bg-yellow-500 text-black'
      case 'certified': return 'bg-purple-500 text-white'
      case 'verified': return 'bg-blue-500 text-white'
      case 'trusted': return 'bg-green-500 text-white'
      case 'established': return 'bg-teal-500 text-white'
      case 'provisional': return 'bg-orange-500 text-white'
      default: return 'bg-neutral-500 text-white'
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-100 flex items-center gap-3">
          <Store className="w-7 h-7 text-blue-400" />
          Agent Marketplace
        </h1>
        <p className="text-neutral-400 mt-1">
          Discover {total.toLocaleString()} governed AI agents with transparent trust scores
        </p>
      </div>

      {/* Search & Filters */}
      <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
            <input
              type="text"
              placeholder="Search agents by name, description, or specialization..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-neutral-500" />
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value)
                setPage(1)
              }}
              className="px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value)
              setPage(1)
            }}
            className="px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="name">Name A-Z</option>
            <option value="trust_score">Highest Trust</option>
            <option value="newest">Newest</option>
          </select>

          {/* View Mode Toggle */}
          {sortBy === 'name' && (
            <div className="flex items-center border border-neutral-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grouped')}
                className={`p-2.5 ${viewMode === 'grouped' ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:text-white'}`}
                title="Grouped by letter"
              >
                <List className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2.5 ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:text-white'}`}
                title="Grid view"
              >
                <LayoutGrid className="w-5 h-5" />
              </button>
            </div>
          )}

          <button
            type="submit"
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      {/* Results */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-100 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            {searchQuery || selectedCategory !== 'all' ? 'Search Results' : 'All Agents'}
          </h2>
          <span className="text-sm text-neutral-500">
            {total.toLocaleString()} {total === 1 ? 'agent' : 'agents'}
          </span>
        </div>

        {loading && agents.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-neutral-500" />
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-12 bg-neutral-900 rounded-lg border border-neutral-800">
            <Bot className="w-12 h-12 mx-auto mb-3 text-neutral-600" />
            <p className="text-neutral-400">No agents found</p>
            <p className="text-sm text-neutral-500 mt-1">
              Try adjusting your search or filters
            </p>
          </div>
        ) : (
          <>
            {/* Grouped View (A-Z sections) */}
            {groupedAgents && viewMode === 'grouped' ? (
              <div className="space-y-8">
                {/* Alphabet Navigation */}
                <div className="flex flex-wrap gap-1 sticky top-0 bg-neutral-950/90 backdrop-blur-sm py-2 z-10">
                  {Array.from(groupedAgents.keys()).map(letter => (
                    <a
                      key={letter}
                      href={`#section-${letter}`}
                      className="w-8 h-8 flex items-center justify-center rounded bg-neutral-800 hover:bg-blue-600 text-neutral-300 hover:text-white text-sm font-medium transition-colors"
                    >
                      {letter}
                    </a>
                  ))}
                </div>

                {/* Grouped Sections */}
                {Array.from(groupedAgents.entries()).map(([letter, letterAgents]) => (
                  <div key={letter} id={`section-${letter}`} className="scroll-mt-16">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="w-10 h-10 flex items-center justify-center rounded-lg bg-blue-600 text-white text-xl font-bold">
                        {letter}
                      </span>
                      <span className="text-neutral-500 text-sm">
                        {letterAgents.length} {letterAgents.length === 1 ? 'agent' : 'agents'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {letterAgents.map((agent) => (
                        <AgentCard key={agent.id} agent={agent} getTrustBadgeColor={getTrustBadgeColor} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Grid View */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {agents.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} getTrustBadgeColor={getTrustBadgeColor} />
                ))}
              </div>
            )}

            {/* Load More */}
            {hasMore && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="px-6 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
