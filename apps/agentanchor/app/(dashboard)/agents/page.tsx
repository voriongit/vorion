import { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import {
  Bot,
  Plus,
  GraduationCap,
  Shield,
  Activity,
  TrendingUp,
  ArrowRight,
} from 'lucide-react'
import AgentCard from '@/components/agents/AgentCard'
import { Agent } from '@/lib/agents/types'

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

  const trainingCount = agents.filter(a => a.status === 'training').length
  const activeCount = agents.filter(a => a.status === 'active').length
  const certifiedCount = agents.filter(a => a.certification_level > 0).length

  return (
    <div className="space-y-6 sm:space-y-8 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
            <Bot className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              Agents
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {total} agent{total !== 1 ? 's' : ''} registered
            </p>
          </div>
        </div>
        <Link
          href="/agents/new"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25 active:scale-95 touch-manipulation"
        >
          <Plus className="h-4 w-4" />
          <span>Create Agent</span>
        </Link>
      </div>

      {/* Stats - Horizontal scroll on mobile */}
      <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 pb-2">
        <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 min-w-max sm:min-w-0">
          <StatCard
            label="Total Agents"
            value={total}
            icon={Bot}
            gradient="from-blue-500 to-indigo-600"
          />
          <StatCard
            label="In Training"
            value={trainingCount}
            icon={GraduationCap}
            gradient="from-amber-500 to-orange-600"
          />
          <StatCard
            label="Active"
            value={activeCount}
            icon={Activity}
            gradient="from-green-500 to-emerald-600"
          />
          <StatCard
            label="Certified"
            value={certifiedCount}
            icon={Shield}
            gradient="from-purple-500 to-indigo-600"
          />
        </div>
      </div>

      {/* Agent Grid */}
      {agents.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}

      {/* Quick Actions - Mobile friendly */}
      {agents.length > 0 && (
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <QuickAction
              title="New Agent"
              icon={Plus}
              href="/agents/new"
              gradient="from-blue-500 to-indigo-500"
            />
            <QuickAction
              title="Academy"
              icon={GraduationCap}
              href="/academy"
              gradient="from-amber-500 to-orange-500"
            />
            <QuickAction
              title="Trust Scores"
              icon={TrendingUp}
              href="/governance"
              gradient="from-green-500 to-emerald-500"
            />
            <QuickAction
              title="Sandbox"
              icon={Shield}
              href="/sandbox"
              gradient="from-purple-500 to-indigo-500"
            />
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  gradient,
}: {
  label: string
  value: number
  icon: React.ElementType
  gradient: string
}) {
  return (
    <div className="flex-shrink-0 w-[140px] sm:w-auto rounded-xl border border-gray-200 bg-white p-3 sm:p-4 dark:border-gray-700 dark:bg-gray-800 shadow-sm">
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate pr-2">{label}</span>
        <div className={`p-1.5 sm:p-2 rounded-lg bg-gradient-to-br ${gradient} flex-shrink-0`}>
          <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
        </div>
      </div>
      <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
        {value}
      </p>
    </div>
  )
}

function QuickAction({
  title,
  icon: Icon,
  href,
  gradient,
}: {
  title: string
  icon: React.ElementType
  href: string
  gradient: string
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 active:scale-95 touch-manipulation group"
    >
      <div className={`p-2.5 rounded-xl bg-gradient-to-br ${gradient} group-hover:shadow-lg transition-shadow`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 text-center">{title}</span>
    </Link>
  )
}

function EmptyState() {
  return (
    <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-8 sm:p-12 text-center dark:border-gray-700 dark:bg-gray-800">
      <div className="mx-auto h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
        <Bot className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
      </div>
      <h3 className="mt-4 sm:mt-6 text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
        No agents yet
      </h3>
      <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
        Create your first AI agent to get started with AgentAnchor governance.
      </p>
      <Link
        href="/agents/new"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-5 py-3 text-sm font-medium text-white hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25 active:scale-95 touch-manipulation"
      >
        <Plus className="h-4 w-4" />
        Create Your First Agent
      </Link>

      {/* Helper cards */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
        <HelperCard
          step={1}
          title="Register"
          description="Create an agent profile"
          gradient="from-blue-500 to-cyan-500"
        />
        <HelperCard
          step={2}
          title="Train"
          description="Complete Academy courses"
          gradient="from-amber-500 to-orange-500"
        />
        <HelperCard
          step={3}
          title="Deploy"
          description="Monitor with governance"
          gradient="from-green-500 to-emerald-500"
        />
      </div>
    </div>
  )
}

function HelperCard({
  step,
  title,
  description,
  gradient,
}: {
  step: number
  title: string
  description: string
  gradient: string
}) {
  return (
    <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-left">
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-gradient-to-r ${gradient} text-white`}>
          {step}
        </span>
        <span className="text-sm font-medium text-gray-900 dark:text-white">{title}</span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 pl-7">{description}</p>
    </div>
  )
}
