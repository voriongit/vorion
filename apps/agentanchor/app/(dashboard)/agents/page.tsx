import { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { Bot, Plus, Filter, LayoutGrid, List } from 'lucide-react'
import AgentCard, { AgentListItem } from '@/components/agents/AgentCard'
import TrustBadge from '@/components/agents/TrustBadge'
import { Agent, TrustTier } from '@/lib/agents/types'

export const metadata: Metadata = {
  title: 'Agents - AgentAnchor',
  description: 'Manage your AI agents',
}

async function getAgents() {
  const supabase = createServerComponentClient({ cookies })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { agents: [], total: 0 }

  // Query agents by owner_id (user.id is the profile ID in Supabase)
  const { data: agents, count } = await supabase
    .from('agents')
    .select('*', { count: 'exact' })
    .eq('owner_id', user.id)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })

  return {
    agents: (agents || []) as Agent[],
    total: count || 0,
  }
}

export default async function AgentsPage() {
  const { agents, total } = await getAgents()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Agents
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            {total} agent{total !== 1 ? 's' : ''} created
          </p>
        </div>
        <Link
          href="/agents/new"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Agent
        </Link>
      </div>

      {/* Stats Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Agents"
          value={total}
          icon={Bot}
          color="blue"
        />
        <StatCard
          label="In Training"
          value={agents.filter(a => a.status === 'training').length}
          icon={Bot}
          color="yellow"
        />
        <StatCard
          label="Active"
          value={agents.filter(a => a.status === 'active').length}
          icon={Bot}
          color="green"
        />
        <StatCard
          label="Certified"
          value={agents.filter(a => a.certification_level > 0).length}
          icon={Bot}
          color="purple"
        />
      </div>

      {/* Agent Grid */}
      {agents.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  icon: React.ElementType
  color: 'blue' | 'yellow' | 'green' | 'purple'
}) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    yellow: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
        <div className={`rounded-lg p-2 ${colorClasses[color]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
        {value}
      </p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
      <div className="mx-auto h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center dark:bg-blue-900/30">
        <Bot className="h-8 w-8 text-blue-600 dark:text-blue-400" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
        No agents yet
      </h3>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        Create your first AI agent to get started with AgentAnchor governance.
      </p>
      <Link
        href="/agents/new"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Create Your First Agent
      </Link>
    </div>
  )
}
