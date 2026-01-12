'use client'

import { useState, useEffect } from 'react'
import {
  Play,
  Loader2,
  Plus,
  Trash2,
  BarChart3,
  Clock,
  Zap,
  Trophy,
  Bot,
  ChevronDown,
  Check,
  X,
  Star,
  Download,
  RefreshCw,
  Users,
  ArrowRight,
  GraduationCap,
  UserCircle,
  Shield,
  Filter
} from 'lucide-react'

interface Agent {
  id: string
  name: string
  description: string
  model: string
  trust_score: number
  academy_status?: 'enrolled' | 'training' | 'graduated' | null
  status?: string
}

interface Participant {
  agent: Agent
  label: string
}

type AgentFilter = 'all' | 'graduates' | 'trainees'

// Trust tier helper
function getTrustTier(score: number): { name: string; color: string; bgColor: string } {
  if (score >= 900) return { name: 'Legendary', color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/50' }
  if (score >= 750) return { name: 'Champion', color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900/50' }
  if (score >= 500) return { name: 'Trusted', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/50' }
  if (score >= 250) return { name: 'Established', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/50' }
  if (score >= 100) return { name: 'Probation', color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/50' }
  return { name: 'Untrusted', color: 'text-gray-600', bgColor: 'bg-gray-100 dark:bg-gray-800' }
}

interface TestResponse {
  participantId: string
  agentName: string
  response: string
  latencyMs: number
  tokensOutput: number
  score: number | null
}

interface TestRound {
  id: string
  prompt: string
  responses: TestResponse[]
  winnerId: string | null
  timestamp: Date
}

export default function ShadowTrainingPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [prompt, setPrompt] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [rounds, setRounds] = useState<TestRound[]>([])
  const [agentsLoading, setAgentsLoading] = useState(true)
  const [showAgentSelector, setShowAgentSelector] = useState(false)
  const [agentFilter, setAgentFilter] = useState<AgentFilter>('all')

  useEffect(() => {
    loadAgents()
  }, [])

  const loadAgents = async () => {
    try {
      setAgentsLoading(true)
      const res = await fetch('/api/agents?limit=100')
      const data = await res.json()
      if (res.ok && data.agents) {
        setAgents(data.agents)
      }
    } catch (err) {
      console.error('Failed to load agents:', err)
    } finally {
      setAgentsLoading(false)
    }
  }

  const addParticipant = (agent: Agent) => {
    if (participants.length >= 10) return
    if (participants.some(p => p.agent.id === agent.id)) return

    const labels = ['Control', 'Variant A', 'Variant B', 'Variant C', 'Variant D', 'Variant E', 'Variant F', 'Variant G', 'Variant H', 'Variant I']
    const label = labels[participants.length] || `Agent ${participants.length + 1}`

    setParticipants(prev => [...prev, { agent, label }])
    setShowAgentSelector(false)
  }

  const removeParticipant = (agentId: string) => {
    setParticipants(prev => prev.filter(p => p.agent.id !== agentId))
  }

  const runTest = async () => {
    if (participants.length < 2 || !prompt.trim()) return

    setIsRunning(true)

    try {
      // Run all agents in parallel
      const responsePromises = participants.map(async (participant) => {
        const startTime = Date.now()
        try {
          const res = await fetch('/api/sandbox/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              agentId: participant.agent.id,
              prompt: prompt.trim(),
            }),
          })

          const data = await res.json()
          const latencyMs = Date.now() - startTime

          return {
            participantId: participant.agent.id,
            agentName: participant.agent.name,
            response: data.response || 'No response',
            latencyMs,
            tokensOutput: data.tokensOutput || 0,
            score: null,
          }
        } catch (err) {
          return {
            participantId: participant.agent.id,
            agentName: participant.agent.name,
            response: `Error: ${err instanceof Error ? err.message : 'Failed'}`,
            latencyMs: Date.now() - startTime,
            tokensOutput: 0,
            score: null,
          }
        }
      })

      const responses = await Promise.all(responsePromises)

      const round: TestRound = {
        id: crypto.randomUUID(),
        prompt: prompt.trim(),
        responses,
        winnerId: null,
        timestamp: new Date(),
      }

      setRounds(prev => [round, ...prev])
      setPrompt('')

    } finally {
      setIsRunning(false)
    }
  }

  const setWinner = (roundId: string, participantId: string) => {
    setRounds(prev => prev.map(round => {
      if (round.id === roundId) {
        return { ...round, winnerId: participantId }
      }
      return round
    }))
  }

  const scoreResponse = (roundId: string, participantId: string, score: number) => {
    setRounds(prev => prev.map(round => {
      if (round.id === roundId) {
        return {
          ...round,
          responses: round.responses.map(r => {
            if (r.participantId === participantId) {
              return { ...r, score }
            }
            return r
          })
        }
      }
      return round
    }))
  }

  const clearRounds = () => {
    setRounds([])
  }

  const exportResults = () => {
    const data = {
      participants: participants.map(p => ({
        id: p.agent.id,
        name: p.agent.name,
        label: p.label,
      })),
      rounds: rounds.map(r => ({
        prompt: r.prompt,
        responses: r.responses,
        winnerId: r.winnerId,
        timestamp: r.timestamp.toISOString(),
      })),
      summary: getLeaderboard(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `shadow-training-${Date.now()}.json`
    a.click()
  }

  const getLeaderboard = () => {
    const stats: Record<string, { wins: number; avgLatency: number; avgScore: number; rounds: number }> = {}

    participants.forEach(p => {
      stats[p.agent.id] = { wins: 0, avgLatency: 0, avgScore: 0, rounds: 0 }
    })

    rounds.forEach(round => {
      if (round.winnerId && stats[round.winnerId]) {
        stats[round.winnerId].wins++
      }
      round.responses.forEach(r => {
        if (stats[r.participantId]) {
          stats[r.participantId].avgLatency += r.latencyMs
          if (r.score !== null) {
            stats[r.participantId].avgScore += r.score
          }
          stats[r.participantId].rounds++
        }
      })
    })

    // Calculate averages
    Object.keys(stats).forEach(id => {
      if (stats[id].rounds > 0) {
        stats[id].avgLatency = Math.round(stats[id].avgLatency / stats[id].rounds)
        stats[id].avgScore = stats[id].avgScore / stats[id].rounds
      }
    })

    return Object.entries(stats)
      .map(([id, s]) => ({
        participant: participants.find(p => p.agent.id === id),
        ...s,
      }))
      .sort((a, b) => b.wins - a.wins)
  }

  // Filter agents based on graduate/trainee selection
  const filteredAgents = agents.filter(agent => {
    if (agentFilter === 'graduates') {
      return agent.academy_status === 'graduated'
    }
    if (agentFilter === 'trainees') {
      return agent.academy_status !== 'graduated'
    }
    return true
  })

  const availableAgents = filteredAgents.filter(a => !participants.some(p => p.agent.id === a.id))

  // Check if agent is a graduate
  const isGraduate = (agent: Agent) => agent.academy_status === 'graduated'

  // Get counts for filter badges
  const graduateCount = agents.filter(a => a.academy_status === 'graduated').length
  const traineeCount = agents.filter(a => a.academy_status !== 'graduated').length

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Shadow Training
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            A/B test multiple agents with the same prompt and compare responses
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Panel - Participants & Input */}
          <div className="lg:col-span-3 space-y-4">
            {/* Participants */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Participants ({participants.length}/10)
                </h2>
                <button
                  onClick={() => setShowAgentSelector(!showAgentSelector)}
                  disabled={participants.length >= 10 || agentsLoading}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400 dark:hover:bg-purple-900/50 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Add Agent
                </button>
              </div>

              {/* Agent Selector Dropdown */}
              {showAgentSelector && (
                <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  {/* Filter Buttons */}
                  <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
                    <Filter className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-400 mr-2">Filter:</span>
                    <button
                      onClick={() => setAgentFilter('all')}
                      className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                        agentFilter === 'all'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      All ({agents.length})
                    </button>
                    <button
                      onClick={() => setAgentFilter('graduates')}
                      className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                        agentFilter === 'graduates'
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <GraduationCap className="h-3 w-3" />
                      Graduates ({graduateCount})
                    </button>
                    <button
                      onClick={() => setAgentFilter('trainees')}
                      className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                        agentFilter === 'trainees'
                          ? 'bg-orange-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <UserCircle className="h-3 w-3" />
                      Trainees ({traineeCount})
                    </button>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {availableAgents.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-500 italic">
                        No {agentFilter === 'all' ? '' : agentFilter} agents available
                      </p>
                    ) : (
                      availableAgents.map(agent => {
                        const tier = getTrustTier(agent.trust_score)
                        const graduated = isGraduate(agent)
                        return (
                          <button
                            key={agent.id}
                            onClick={() => addParticipant(agent)}
                            className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {/* Graduate/Trainee Icon */}
                              {graduated ? (
                                <GraduationCap className="h-4 w-4 text-green-600 flex-shrink-0" />
                              ) : (
                                <UserCircle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                              )}
                              <span className="font-medium text-gray-900 dark:text-white truncate">{agent.name}</span>
                              {/* Trust Badge */}
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${tier.bgColor} ${tier.color}`}>
                                {tier.name} ({agent.trust_score})
                              </span>
                            </div>
                            <Plus className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Participant Cards */}
              {participants.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Add at least 2 agents to start A/B testing</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {participants.map((p, index) => {
                    const tier = getTrustTier(p.agent.trust_score)
                    const graduated = isGraduate(p.agent)
                    return (
                      <div
                        key={p.agent.id}
                        className={`relative p-3 rounded-lg border-2 ${
                          graduated
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                            : 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700'
                        }`}
                      >
                        <button
                          onClick={() => removeParticipant(p.agent.id)}
                          className="absolute -top-2 -right-2 p-1 bg-red-100 text-red-600 rounded-full hover:bg-red-200 dark:bg-red-900/50 dark:text-red-400"
                        >
                          <X className="h-3 w-3" />
                        </button>

                        {/* Graduate/Trainee Badge */}
                        <div className="absolute -top-2 -left-2">
                          {graduated ? (
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded-full">
                              <GraduationCap className="h-2.5 w-2.5" />
                              GRAD
                            </span>
                          ) : (
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-500 text-white text-[10px] font-bold rounded-full">
                              <UserCircle className="h-2.5 w-2.5" />
                              TRAIN
                            </span>
                          )}
                        </div>

                        <div className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-1 mt-1">
                          {p.label}
                        </div>
                        <div className="font-medium text-gray-900 dark:text-white text-sm truncate">
                          {p.agent.name}
                        </div>

                        {/* Trust Badge */}
                        <div className={`mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded ${tier.bgColor} ${tier.color}`}>
                          <Shield className="h-2.5 w-2.5" />
                          {tier.name} • {p.agent.trust_score}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Prompt Input */}
            <div className="card">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Test Prompt
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter a prompt to test all agents simultaneously..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <div className="flex items-center justify-between mt-3">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {participants.length < 2 ? 'Add at least 2 agents' : `Testing ${participants.length} agents`}
                </span>
                <button
                  onClick={runTest}
                  disabled={isRunning || participants.length < 2 || !prompt.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Running All...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Run A/B Test
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Results */}
            {rounds.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Test Rounds ({rounds.length})
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={exportResults}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      Export
                    </button>
                    <button
                      onClick={clearRounds}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                      Clear
                    </button>
                  </div>
                </div>

                {rounds.map((round) => (
                  <div key={round.id} className="card">
                    {/* Prompt Header */}
                    <div className="mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Prompt
                      </span>
                      <p className="text-gray-900 dark:text-white mt-1">
                        {round.prompt}
                      </p>
                    </div>

                    {/* Responses Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {round.responses.map((response) => {
                        const participant = participants.find(p => p.agent.id === response.participantId)
                        const isWinner = round.winnerId === response.participantId

                        return (
                          <div
                            key={response.participantId}
                            className={`relative p-4 rounded-lg border-2 transition-colors ${
                              isWinner
                                ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                          >
                            {isWinner && (
                              <div className="absolute -top-2 -right-2 p-1.5 bg-yellow-400 rounded-full">
                                <Trophy className="h-4 w-4 text-yellow-900" />
                              </div>
                            )}

                            {/* Agent Header */}
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
                                  {participant?.label || 'Unknown'}
                                </span>
                                <h4 className="font-medium text-gray-900 dark:text-white">
                                  {response.agentName}
                                </h4>
                              </div>
                              <button
                                onClick={() => setWinner(round.id, response.participantId)}
                                className={`p-2 rounded-lg transition-colors ${
                                  isWinner
                                    ? 'bg-yellow-400 text-yellow-900'
                                    : 'bg-gray-100 text-gray-400 hover:bg-yellow-100 hover:text-yellow-600 dark:bg-gray-800 dark:hover:bg-yellow-900/30'
                                }`}
                                title="Mark as winner"
                              >
                                <Trophy className="h-4 w-4" />
                              </button>
                            </div>

                            {/* Response */}
                            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap line-clamp-6">
                              {response.response}
                            </p>

                            {/* Metrics & Scoring */}
                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {response.latencyMs}ms
                                </span>
                                <span className="flex items-center gap-1">
                                  <Zap className="h-3 w-3" />
                                  {response.tokensOutput} tokens
                                </span>
                              </div>

                              {/* Quick Score */}
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map(star => (
                                  <button
                                    key={star}
                                    onClick={() => scoreResponse(round.id, response.participantId, star)}
                                    className={`p-0.5 transition-colors ${
                                      response.score !== null && response.score >= star
                                        ? 'text-yellow-400'
                                        : 'text-gray-300 hover:text-yellow-300 dark:text-gray-600'
                                    }`}
                                  >
                                    <Star className="h-4 w-4" fill={response.score !== null && response.score >= star ? 'currentColor' : 'none'} />
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Panel - Leaderboard */}
          <div className="space-y-4">
            {/* Leaderboard */}
            <div className="card">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                Leaderboard
              </h3>
              {rounds.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Run tests to see rankings
                </p>
              ) : (
                <div className="space-y-3">
                  {getLeaderboard().map((entry, index) => {
                    const agent = entry.participant?.agent
                    const tier = agent ? getTrustTier(agent.trust_score) : null
                    const graduated = agent ? isGraduate(agent) : false
                    return (
                      <div
                        key={entry.participant?.agent.id}
                        className={`flex items-center gap-2 p-2 rounded-lg ${
                          index === 0 ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700' : ''
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          index === 0 ? 'bg-yellow-400 text-yellow-900' :
                          index === 1 ? 'bg-gray-300 text-gray-700 dark:bg-gray-600 dark:text-gray-200' :
                          index === 2 ? 'bg-orange-300 text-orange-800 dark:bg-orange-700 dark:text-orange-200' :
                          'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            {graduated ? (
                              <GraduationCap className="h-3 w-3 text-green-600 flex-shrink-0" />
                            ) : (
                              <UserCircle className="h-3 w-3 text-orange-500 flex-shrink-0" />
                            )}
                            <span className="font-medium text-gray-900 dark:text-white text-sm truncate">
                              {entry.participant?.agent.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {entry.wins}W / {entry.rounds}R
                            </span>
                            {tier && (
                              <span className={`text-[9px] font-medium px-1 py-0.5 rounded ${tier.bgColor} ${tier.color}`}>
                                {tier.name}
                              </span>
                            )}
                          </div>
                        </div>
                        {entry.avgScore > 0 && (
                          <div className="flex items-center gap-0.5 text-yellow-500 flex-shrink-0">
                            <Star className="h-3 w-3" fill="currentColor" />
                            <span className="text-xs font-medium">{entry.avgScore.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Quick Stats */}
            {rounds.length > 0 && (
              <div className="card">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                  Session Stats
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Total Rounds</span>
                    <span className="font-medium text-gray-900 dark:text-white">{rounds.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Agents Tested</span>
                    <span className="font-medium text-gray-900 dark:text-white">{participants.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Rounds Judged</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {rounds.filter(r => r.winnerId).length}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Tips */}
            <div className="card bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
              <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">
                Shadow Training Tips
              </h3>
              <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-1.5">
                <li>• <strong>Filter</strong> by Graduates vs Trainees to compare trained vs untrained</li>
                <li>• <strong>Trust badges</strong> show agent credibility</li>
                <li>• <strong>Green cards</strong> = Graduates, <strong>Orange</strong> = Trainees</li>
                <li>• Click trophy to mark round winners</li>
                <li>• Use star ratings for detailed scoring</li>
                <li>• Export results for analysis</li>
              </ul>
            </div>

            {/* Comparison Mode Card */}
            <div className="card bg-gradient-to-br from-green-50 to-orange-50 dark:from-green-900/20 dark:to-orange-900/20 border-green-200 dark:border-green-800">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Comparison Mode
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                See how graduates outperform trainees on the same prompts.
              </p>
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1 px-2 py-1 bg-green-200 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded">
                  <GraduationCap className="h-3 w-3" />
                  Academy Certified
                </span>
                <span className="text-gray-400">vs</span>
                <span className="flex items-center gap-1 px-2 py-1 bg-orange-200 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 rounded">
                  <UserCircle className="h-3 w-3" />
                  In Training
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
