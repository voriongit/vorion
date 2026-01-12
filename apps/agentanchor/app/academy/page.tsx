'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import CurriculumCard from '@/components/academy/CurriculumCard'
import { GraduationCap, Filter, Search, Loader2 } from 'lucide-react'

interface Module {
  id: string
  name: string
  description: string
}

interface Curriculum {
  id: string
  name: string
  description: string
  specialization: string
  difficulty_level: number
  modules: Module[]
  certification_points: number
  trust_points: number
  estimated_duration_hours: number
}

interface Agent {
  id: string
  name: string
  status: string
  trust_tier: string
}

export default function AcademyPage() {
  const router = useRouter()
  const supabase = createClient()

  const [curriculum, setCurriculum] = useState<Curriculum[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<string>('')
  const [agentEnrollments, setAgentEnrollments] = useState<Record<string, string>>({})
  const [specializations, setSpecializations] = useState<string[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (selectedAgent) {
      loadAgentEnrollments(selectedAgent)
    } else {
      setAgentEnrollments({})
    }
  }, [selectedAgent])

  const loadData = async () => {
    try {
      setLoading(true)

      // Load curriculum
      const curriculumRes = await fetch('/api/academy/curriculum')
      const curriculumData = await curriculumRes.json()

      if (curriculumData.curriculum) {
        setCurriculum(curriculumData.curriculum)
        setSpecializations(curriculumData.specializations || [])
      }

      // Load user's agents
      const agentsRes = await fetch('/api/agents?status=all')
      const agentsData = await agentsRes.json()

      if (agentsData.agents) {
        // Filter to agents that can enroll (draft or training)
        const enrollableAgents = agentsData.agents.filter(
          (a: Agent) => ['draft', 'training'].includes(a.status)
        )
        setAgents(enrollableAgents)

        // Auto-select first agent if available
        if (enrollableAgents.length > 0 && !selectedAgent) {
          setSelectedAgent(enrollableAgents[0].id)
        }
      }
    } catch (err) {
      console.error('Error loading data:', err)
      setError('Failed to load academy data')
    } finally {
      setLoading(false)
    }
  }

  const loadAgentEnrollments = async (agentId: string) => {
    try {
      const res = await fetch(`/api/agents/${agentId}/enrollments`)
      const data = await res.json()

      if (data.enrollments) {
        const enrollmentMap: Record<string, string> = {}
        data.enrollments.forEach((e: any) => {
          enrollmentMap[e.curriculum.id] = e.status
        })
        setAgentEnrollments(enrollmentMap)
      }
    } catch (err) {
      console.error('Error loading enrollments:', err)
    }
  }

  const handleEnroll = async (curriculumId: string) => {
    if (!selectedAgent) {
      setError('Please select an agent first')
      return
    }

    try {
      setEnrolling(curriculumId)
      setError(null)

      const res = await fetch(`/api/agents/${selectedAgent}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ curriculumId }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to enroll')
      }

      // Refresh enrollments
      await loadAgentEnrollments(selectedAgent)

      // Refresh agents (status may have changed)
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setEnrolling(null)
    }
  }

  const filteredCurriculum = curriculum.filter(c => {
    const matchesFilter = filter === 'all' || c.specialization === filter
    const matchesSearch = !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description?.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <GraduationCap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Agent Academy
              </h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Train your agents with structured curriculum to earn certification and trust
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}

        {/* Agent Selector */}
        <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Agent to Enroll
          </label>
          {agents.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              No agents available for enrollment.{' '}
              <button
                onClick={() => router.push('/agents/new')}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                Create an agent first
              </button>
            </div>
          ) : (
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="input max-w-md"
            >
              <option value="">Choose an agent...</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} ({agent.status})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search curriculum..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>

          {/* Specialization Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="input"
            >
              <option value="all">All Specializations</option>
              {specializations.map((spec) => (
                <option key={spec} value={spec}>
                  {spec.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Curriculum Grid */}
        {filteredCurriculum.length === 0 ? (
          <div className="text-center py-12">
            <GraduationCap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No curriculum found
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Try adjusting your search or filters
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCurriculum.map((c) => (
              <CurriculumCard
                key={c.id}
                curriculum={c}
                onEnroll={handleEnroll}
                isEnrolling={enrolling === c.id}
                isEnrolled={!!agentEnrollments[c.id]}
                enrolledStatus={agentEnrollments[c.id]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
