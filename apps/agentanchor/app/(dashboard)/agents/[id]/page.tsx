import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import {
  ArrowLeft,
  Bot,
  Settings,
  GraduationCap,
  MessageSquare,
  History,
  ShieldCheck,
} from 'lucide-react'
import TrustBadge, { CertificationBadge, TrustScoreIndicator, AutonomyIndicator, TrustTierCard } from '@/components/agents/TrustBadge'
import ProbationIndicator, { ProbationCard } from '@/components/agents/ProbationIndicator'
import { Agent, STATUS_LABELS, SPECIALIZATIONS } from '@/lib/agents/types'
import { checkProbationStatus } from '@/lib/agents/decay-service'

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = params
  const supabase = createServerComponentClient({ cookies })

  const { data: agent } = await supabase
    .from('agents')
    .select('name')
    .eq('id', id)
    .single()

  return {
    title: agent ? `${agent.name} - AgentAnchor` : 'Agent - AgentAnchor',
    description: 'View agent details and manage settings',
  }
}

async function getAgent(id: string) {
  const supabase = createServerComponentClient({ cookies })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: agent } = await supabase
    .from('agents')
    .select('*')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  return agent as Agent | null
}

async function getEnrollments(agentId: string) {
  const supabase = createServerComponentClient({ cookies })

  const { data } = await supabase
    .from('academy_enrollments')
    .select('*, curriculum:academy_curriculum(*)')
    .eq('agent_id', agentId)
    .order('enrolled_at', { ascending: false })

  return data || []
}

async function getTrustHistory(agentId: string) {
  const supabase = createServerComponentClient({ cookies })

  const { data } = await supabase
    .from('trust_history')
    .select('*')
    .eq('agent_id', agentId)
    .order('recorded_at', { ascending: false })
    .limit(10)

  return data || []
}

export default async function AgentDetailPage({ params }: PageProps) {
  const { id } = params
  const agent = await getAgent(id)

  if (!agent) {
    notFound()
  }

  const [enrollments, trustHistory, probationStatus] = await Promise.all([
    getEnrollments(id),
    getTrustHistory(id),
    checkProbationStatus(id),
  ])

  const statusInfo = STATUS_LABELS[agent.status]
  const specializationLabel =
    SPECIALIZATIONS.find((s) => s.value === agent.specialization)?.label || 'General Purpose'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/agents"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Agents
        </Link>
      </div>

      {/* Agent Header Card */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            {agent.avatar_url ? (
              <img
                src={agent.avatar_url}
                alt={agent.name}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <Bot className="h-8 w-8 text-white" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {agent.name}
                </h1>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    statusInfo.color === 'green'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : statusInfo.color === 'yellow'
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                  }`}
                >
                  {statusInfo.label}
                </span>
              </div>
              <p className="mt-1 text-gray-500 dark:text-gray-400">
                {specializationLabel}
              </p>
              {agent.description && (
                <p className="mt-2 text-gray-700 dark:text-gray-300">
                  {agent.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Link
              href={`/agents/${agent.id}/edit`}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <Settings className="h-4 w-4" />
              Edit
            </Link>
            {agent.status === 'active' && (
              <Link
                href={`/chat?agent=${agent.id}`}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <MessageSquare className="h-4 w-4" />
                Chat
              </Link>
            )}
          </div>
        </div>

        {/* Badges Row */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <TrustBadge score={agent.trust_score} tier={agent.trust_tier} showScore />
          <CertificationBadge level={agent.certification_level} />
          {probationStatus.onProbation && (
            <ProbationIndicator daysRemaining={probationStatus.daysRemaining} showDetails />
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Trust & Training */}
        <div className="space-y-6 lg:col-span-2">
          {/* Probation Warning Card */}
          {probationStatus.onProbation && (
            <ProbationCard daysRemaining={probationStatus.daysRemaining} />
          )}

          {/* Trust Score Card - Enhanced with tier details */}
          <TrustTierCard score={agent.trust_score} tier={agent.trust_tier} />

          {/* Autonomy Level Card (FR54) */}
          <AutonomyIndicator tier={agent.trust_tier} score={agent.trust_score} />

          {/* Recent Trust History */}
          {trustHistory.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Recent Trust Changes
                </h2>
                <Link
                  href={`/agents/${agent.id}/trust`}
                  className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  View All
                </Link>
              </div>
              <div className="space-y-2">
                {trustHistory.slice(0, 5).map((entry: any) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between text-sm py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
                  >
                    <div>
                      <span className="text-gray-700 dark:text-gray-300">
                        {entry.reason}
                      </span>
                      <p className="text-xs text-gray-400">
                        {new Date(entry.recorded_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`font-medium ${
                        entry.change_amount > 0
                          ? 'text-green-600 dark:text-green-400'
                          : entry.change_amount < 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-gray-500'
                      }`}
                    >
                      {entry.change_amount > 0 ? '+' : ''}
                      {entry.change_amount || 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Academy Enrollments */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Academy Training
              </h2>
              <Link
                href={`/agents/${agent.id}/training`}
                className="text-sm text-blue-600 hover:underline dark:text-blue-400"
              >
                View All
              </Link>
            </div>

            {enrollments.length === 0 ? (
              <div className="text-center py-8">
                <GraduationCap className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
                <p className="mt-2 text-gray-500 dark:text-gray-400">
                  Not enrolled in any training
                </p>
                <Link
                  href="/academy"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
                >
                  <GraduationCap className="h-4 w-4" />
                  Browse Academy
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {enrollments.slice(0, 3).map((enrollment: any) => (
                  <div
                    key={enrollment.id}
                    className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-700/50"
                  >
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {enrollment.curriculum?.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {enrollment.status === 'completed'
                          ? 'Completed'
                          : enrollment.status === 'in_progress'
                          ? 'In Progress'
                          : 'Enrolled'}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        enrollment.status === 'completed'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : enrollment.status === 'in_progress'
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                      }`}
                    >
                      {enrollment.progress?.modules_completed?.length || 0} /{' '}
                      {enrollment.curriculum?.modules?.length || 0} modules
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Quick Info */}
        <div className="space-y-6">
          {/* Model & Settings */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Configuration
            </h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Model</dt>
                <dd className="text-gray-900 dark:text-white font-medium">
                  {agent.model.includes('sonnet-4')
                    ? 'Claude Sonnet 4'
                    : agent.model.includes('3-5-sonnet')
                    ? 'Claude 3.5 Sonnet'
                    : 'Claude 3 Haiku'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Temperature</dt>
                <dd className="text-gray-900 dark:text-white font-medium">
                  {agent.temperature}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Max Tokens</dt>
                <dd className="text-gray-900 dark:text-white font-medium">
                  {agent.max_tokens}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Created</dt>
                <dd className="text-gray-900 dark:text-white font-medium">
                  {new Date(agent.created_at).toLocaleDateString()}
                </dd>
              </div>
            </dl>
          </div>

          {/* Capabilities */}
          {agent.capabilities && agent.capabilities.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Capabilities
              </h2>
              <div className="flex flex-wrap gap-2">
                {agent.capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                  >
                    {cap}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Quick Actions
            </h2>
            <div className="space-y-2">
              {agent.status === 'draft' && (
                <Link
                  href={`/agents/${agent.id}/training`}
                  className="flex w-full items-center gap-2 rounded-lg border border-purple-300 bg-purple-50 px-3 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100 dark:border-purple-700 dark:bg-purple-900/20 dark:text-purple-300"
                >
                  <GraduationCap className="h-4 w-4" />
                  Start Training
                </Link>
              )}
              <Link
                href={`/agents/${agent.id}/trust`}
                className="flex w-full items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <History className="h-4 w-4" />
                Trust History
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
