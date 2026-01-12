'use client'

import { useState, useEffect } from 'react'
import {
  Shield,
  Swords,
  Target,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Play,
  Pause,
  RefreshCw,
  Eye,
  Zap,
  Bug,
  Lock,
} from 'lucide-react'

interface ArenaStats {
  totalSessions: number
  activeSessions: number
  totalVectors: number
  novelVectors: number
  detectionAccuracy: number
  avgLatencyMs: number
}

interface RecentSession {
  id: string
  name: string
  status: 'running' | 'completed' | 'failed'
  attacksAttempted: number
  attacksDetected: number
  accuracy: number
  startedAt: string
}

interface TopVector {
  id: string
  category: string
  technique: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  successRate: number
  discovered: string
}

export default function TestingStudioPage() {
  const [stats, setStats] = useState<ArenaStats>({
    totalSessions: 0,
    activeSessions: 0,
    totalVectors: 0,
    novelVectors: 0,
    detectionAccuracy: 0,
    avgLatencyMs: 0,
  })
  const [sessions, setSessions] = useState<RecentSession[]>([])
  const [vectors, setVectors] = useState<TopVector[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const res = await fetch('/api/testing-studio')
      if (res.ok) {
        const data = await res.json()
        setStats(data.stats || stats)
        setSessions(data.recentSessions || [])
        setVectors(data.topVectors || [])
      }
    } catch (err) {
      console.error('Failed to fetch testing studio data:', err)
      // Use demo data
      setStats({
        totalSessions: 1247,
        activeSessions: 3,
        totalVectors: 8432,
        novelVectors: 127,
        detectionAccuracy: 94.7,
        avgLatencyMs: 23,
      })
      setSessions([
        {
          id: 'sess-001',
          name: 'Daily Adversarial Scan',
          status: 'running',
          attacksAttempted: 156,
          attacksDetected: 148,
          accuracy: 94.9,
          startedAt: new Date().toISOString(),
        },
        {
          id: 'sess-002',
          name: 'Jailbreak Stress Test',
          status: 'completed',
          attacksAttempted: 500,
          attacksDetected: 472,
          accuracy: 94.4,
          startedAt: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 'sess-003',
          name: 'Prompt Injection Deep Scan',
          status: 'completed',
          attacksAttempted: 250,
          attacksDetected: 241,
          accuracy: 96.4,
          startedAt: new Date(Date.now() - 7200000).toISOString(),
        },
      ])
      setVectors([
        {
          id: 'PI-D-047',
          category: 'prompt_injection',
          technique: 'Context Window Overflow',
          severity: 'critical',
          successRate: 67,
          discovered: '2 hours ago',
        },
        {
          id: 'JB-R-012',
          category: 'jailbreak',
          technique: 'Nested Roleplay Bypass',
          severity: 'high',
          successRate: 45,
          discovered: '5 hours ago',
        },
        {
          id: 'OB-U-089',
          category: 'obfuscation',
          technique: 'Unicode Homoglyph Injection',
          severity: 'medium',
          successRate: 23,
          discovered: '1 day ago',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const severityColors = {
    critical: 'text-red-500 bg-red-500/10',
    high: 'text-orange-500 bg-orange-500/10',
    medium: 'text-yellow-500 bg-yellow-500/10',
    low: 'text-green-500 bg-green-500/10',
  }

  const statusColors = {
    running: 'text-blue-500 bg-blue-500/10',
    completed: 'text-green-500 bg-green-500/10',
    failed: 'text-red-500 bg-red-500/10',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Swords className="w-7 h-7 text-red-500" />
            Testing Studio
          </h1>
          <p className="text-muted-foreground mt-1">
            Adversarial testing arena where AI agents battle to discover vulnerabilities
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-accent transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
            <Play className="w-4 h-4" />
            New Session
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          label="Total Sessions"
          value={stats.totalSessions.toLocaleString()}
          icon={<Activity className="w-5 h-5" />}
          color="text-blue-500"
        />
        <StatCard
          label="Active Now"
          value={stats.activeSessions.toString()}
          icon={<Zap className="w-5 h-5" />}
          color="text-green-500"
          pulse={stats.activeSessions > 0}
        />
        <StatCard
          label="Attack Vectors"
          value={stats.totalVectors.toLocaleString()}
          icon={<Bug className="w-5 h-5" />}
          color="text-red-500"
        />
        <StatCard
          label="Novel Discoveries"
          value={stats.novelVectors.toString()}
          icon={<Target className="w-5 h-5" />}
          color="text-purple-500"
        />
        <StatCard
          label="Detection Rate"
          value={`${stats.detectionAccuracy.toFixed(1)}%`}
          icon={<Shield className="w-5 h-5" />}
          color="text-emerald-500"
        />
        <StatCard
          label="Avg Latency"
          value={`${stats.avgLatencyMs}ms`}
          icon={<Clock className="w-5 h-5" />}
          color="text-amber-500"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Sessions */}
        <div className="border rounded-lg p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-blue-500" />
            Recent Sessions
          </h2>
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[session.status]}`}
                  >
                    {session.status === 'running' && (
                      <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse mr-1" />
                    )}
                    {session.status}
                  </span>
                  <div>
                    <p className="font-medium">{session.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {session.attacksDetected}/{session.attacksAttempted} detected
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-emerald-500">
                    {session.accuracy.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">accuracy</p>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-4 py-2 text-sm text-muted-foreground hover:text-foreground border-t">
            View All Sessions
          </button>
        </div>

        {/* Top Attack Vectors */}
        <div className="border rounded-lg p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Recent Discoveries
          </h2>
          <div className="space-y-3">
            {vectors.map((vector) => (
              <div
                key={vector.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${severityColors[vector.severity]}`}
                  >
                    {vector.severity}
                  </span>
                  <div>
                    <p className="font-medium">{vector.technique}</p>
                    <p className="text-sm text-muted-foreground">
                      {vector.id} • {vector.category.replace('_', ' ')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-red-500">{vector.successRate}%</p>
                  <p className="text-xs text-muted-foreground">{vector.discovered}</p>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-4 py-2 text-sm text-muted-foreground hover:text-foreground border-t">
            View Attack Library
          </button>
        </div>
      </div>

      {/* Arena Overview */}
      <div className="border rounded-lg p-6">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Swords className="w-5 h-5 text-purple-500" />
          Arena Architecture
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {/* Red Team */}
          <div className="text-center p-4 border rounded-lg bg-red-500/5">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-500/20 flex items-center justify-center">
              <Bug className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="font-semibold text-red-500">Red Team Agents</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Specialized attackers that probe for vulnerabilities
            </p>
            <div className="mt-3 text-xs space-y-1">
              <div className="flex justify-between px-2 py-1 bg-background rounded">
                <span>Injectors</span>
                <span className="text-red-500">Active</span>
              </div>
              <div className="flex justify-between px-2 py-1 bg-background rounded">
                <span>Obfuscators</span>
                <span className="text-red-500">Active</span>
              </div>
              <div className="flex justify-between px-2 py-1 bg-background rounded">
                <span>Jailbreakers</span>
                <span className="text-red-500">Active</span>
              </div>
            </div>
          </div>

          {/* Arena */}
          <div className="text-center p-4 border rounded-lg bg-purple-500/5">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Target className="w-6 h-6 text-purple-500" />
            </div>
            <h3 className="font-semibold text-purple-500">Sandbox Arena</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Isolated environment for safe adversarial battles
            </p>
            <div className="mt-3 text-xs space-y-1">
              <div className="flex justify-between px-2 py-1 bg-background rounded">
                <span>Network Isolated</span>
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
              <div className="flex justify-between px-2 py-1 bg-background rounded">
                <span>Containment</span>
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
              <div className="flex justify-between px-2 py-1 bg-background rounded">
                <span>Full Recording</span>
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
            </div>
          </div>

          {/* Blue Team */}
          <div className="text-center p-4 border rounded-lg bg-blue-500/5">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Shield className="w-6 h-6 text-blue-500" />
            </div>
            <h3 className="font-semibold text-blue-500">Blue Team Agents</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Defenders that detect and block attacks
            </p>
            <div className="mt-3 text-xs space-y-1">
              <div className="flex justify-between px-2 py-1 bg-background rounded">
                <span>Sentinels</span>
                <span className="text-blue-500">Active</span>
              </div>
              <div className="flex justify-between px-2 py-1 bg-background rounded">
                <span>Decoders</span>
                <span className="text-blue-500">Active</span>
              </div>
              <div className="flex justify-between px-2 py-1 bg-background rounded">
                <span>Guardians</span>
                <span className="text-blue-500">Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-4 gap-4">
        <ActionCard
          icon={<Play className="w-5 h-5" />}
          title="Start Session"
          description="Launch adversarial test"
          color="bg-green-500"
        />
        <ActionCard
          icon={<Eye className="w-5 h-5" />}
          title="View Library"
          description="Browse attack vectors"
          color="bg-red-500"
        />
        <ActionCard
          icon={<TrendingUp className="w-5 h-5" />}
          title="Reports"
          description="Intelligence reports"
          color="bg-blue-500"
        />
        <ActionCard
          icon={<Lock className="w-5 h-5" />}
          title="Detection Rules"
          description="Manage defenses"
          color="bg-purple-500"
        />
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  color,
  pulse,
}: {
  label: string
  value: string
  icon: React.ReactNode
  color: string
  pulse?: boolean
}) {
  return (
    <div className="border rounded-lg p-4">
      <div className={`flex items-center gap-2 ${color}`}>
        {icon}
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      <p className={`text-2xl font-bold mt-2 ${pulse ? 'animate-pulse' : ''}`}>
        {value}
      </p>
    </div>
  )
}

function ActionCard({
  icon,
  title,
  description,
  color,
}: {
  icon: React.ReactNode
  title: string
  description: string
  color: string
}) {
  return (
    <button className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors text-left w-full">
      <div className={`p-2 rounded-lg ${color} text-white`}>{icon}</div>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </button>
  )
}
