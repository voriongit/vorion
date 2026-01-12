'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Play,
  Loader2,
  Settings2,
  Copy,
  Check,
  Trash2,
  Save,
  Clock,
  Zap,
  DollarSign,
  Bot,
  ChevronDown,
  RotateCcw,
  Download,
  Plus
} from 'lucide-react'

interface Agent {
  id: string
  name: string
  description: string
  model: string
  system_prompt: string
  trust_score: number
}

interface TestResult {
  id: string
  prompt: string
  response: string
  latencyMs: number
  tokensInput: number
  tokensOutput: number
  model: string
  timestamp: Date
}

interface SandboxConfig {
  maxTokens: number
  temperature: number
  topP: number
}

const DEFAULT_CONFIG: SandboxConfig = {
  maxTokens: 2048,
  temperature: 0.7,
  topP: 1.0,
}

export default function SandboxPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [prompt, setPrompt] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<TestResult[]>([])
  const [config, setConfig] = useState<SandboxConfig>(DEFAULT_CONFIG)
  const [showConfig, setShowConfig] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [agentsLoading, setAgentsLoading] = useState(true)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
        if (data.agents.length > 0 && !selectedAgent) {
          setSelectedAgent(data.agents[0])
        }
      }
    } catch (err) {
      console.error('Failed to load agents:', err)
    } finally {
      setAgentsLoading(false)
    }
  }

  const runTest = async () => {
    if (!selectedAgent || !prompt.trim()) return

    setIsRunning(true)
    const startTime = Date.now()

    try {
      const res = await fetch('/api/sandbox/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: selectedAgent.id,
          prompt: prompt.trim(),
          config,
        }),
      })

      const data = await res.json()
      const latencyMs = Date.now() - startTime

      if (res.ok) {
        const result: TestResult = {
          id: crypto.randomUUID(),
          prompt: prompt.trim(),
          response: data.response || data.error || 'No response',
          latencyMs,
          tokensInput: data.tokensInput || Math.ceil(prompt.length / 4),
          tokensOutput: data.tokensOutput || Math.ceil((data.response?.length || 0) / 4),
          model: selectedAgent.model,
          timestamp: new Date(),
        }
        setResults(prev => [result, ...prev])
      } else {
        const result: TestResult = {
          id: crypto.randomUUID(),
          prompt: prompt.trim(),
          response: `Error: ${data.error?.message || 'Test failed'}`,
          latencyMs,
          tokensInput: 0,
          tokensOutput: 0,
          model: selectedAgent.model,
          timestamp: new Date(),
        }
        setResults(prev => [result, ...prev])
      }
    } catch (err) {
      const result: TestResult = {
        id: crypto.randomUUID(),
        prompt: prompt.trim(),
        response: `Error: ${err instanceof Error ? err.message : 'Network error'}`,
        latencyMs: Date.now() - startTime,
        tokensInput: 0,
        tokensOutput: 0,
        model: selectedAgent.model,
        timestamp: new Date(),
      }
      setResults(prev => [result, ...prev])
    } finally {
      setIsRunning(false)
    }
  }

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const clearResults = () => {
    setResults([])
  }

  const exportResults = () => {
    const data = results.map(r => ({
      agent: selectedAgent?.name,
      prompt: r.prompt,
      response: r.response,
      latencyMs: r.latencyMs,
      tokens: r.tokensInput + r.tokensOutput,
      timestamp: r.timestamp.toISOString(),
    }))
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sandbox-results-${Date.now()}.json`
    a.click()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      runTest()
    }
  }

  const estimateCost = (tokens: number) => {
    // Rough estimate based on Claude pricing
    const costPer1k = 0.003
    return (tokens / 1000) * costPer1k
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Sandbox
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Test your agents in an isolated environment before deployment
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Input */}
          <div className="lg:col-span-2 space-y-4">
            {/* Agent Selector */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Select Agent
                </label>
                <button
                  onClick={() => setShowConfig(!showConfig)}
                  className={`flex items-center gap-1 px-2 py-1 text-sm rounded-lg transition-colors ${
                    showConfig
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                      : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <Settings2 className="h-4 w-4" />
                  Config
                </button>
              </div>

              {agentsLoading ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading agents...
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={selectedAgent?.id || ''}
                    onChange={(e) => {
                      const agent = agents.find(a => a.id === e.target.value)
                      setSelectedAgent(agent || null)
                    }}
                    className="w-full px-4 py-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white appearance-none cursor-pointer"
                  >
                    {agents.length === 0 ? (
                      <option value="">No agents available</option>
                    ) : (
                      agents.map(agent => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name} - Trust: {agent.trust_score}
                        </option>
                      ))
                    )}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                </div>
              )}

              {selectedAgent && (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                  {selectedAgent.description}
                </p>
              )}

              {/* Config Panel */}
              {showConfig && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Max Tokens: {config.maxTokens}
                    </label>
                    <input
                      type="range"
                      min="256"
                      max="4096"
                      step="256"
                      value={config.maxTokens}
                      onChange={(e) => setConfig(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Temperature: {config.temperature.toFixed(1)}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={config.temperature}
                      onChange={(e) => setConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                      className="w-full"
                    />
                  </div>
                  <button
                    onClick={() => setConfig(DEFAULT_CONFIG)}
                    className="text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400"
                  >
                    Reset to defaults
                  </button>
                </div>
              )}
            </div>

            {/* Prompt Input */}
            <div className="card">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Test Prompt
              </label>
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter your test prompt here... (Ctrl/Cmd + Enter to run)"
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <div className="flex items-center justify-between mt-3">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {prompt.length} characters
                </span>
                <button
                  onClick={runTest}
                  disabled={isRunning || !selectedAgent || !prompt.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Run Test
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Results */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Results ({results.length})
                </h2>
                {results.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={exportResults}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      Export
                    </button>
                    <button
                      onClick={clearResults}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {results.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No test results yet</p>
                  <p className="text-sm mt-1">Run a test to see results here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {results.map((result) => (
                    <div
                      key={result.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                    >
                      {/* Prompt */}
                      <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                              Prompt
                            </span>
                            <p className="text-gray-900 dark:text-white mt-1 whitespace-pre-wrap">
                              {result.prompt}
                            </p>
                          </div>
                          <button
                            onClick={() => copyToClipboard(result.prompt, `prompt-${result.id}`)}
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          >
                            {copiedId === `prompt-${result.id}` ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Response */}
                      <div className="px-4 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                              Response
                            </span>
                            <p className="text-gray-900 dark:text-white mt-1 whitespace-pre-wrap">
                              {result.response}
                            </p>
                          </div>
                          <button
                            onClick={() => copyToClipboard(result.response, `response-${result.id}`)}
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          >
                            {copiedId === `response-${result.id}` ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                        </div>

                        {/* Metrics */}
                        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {result.latencyMs}ms
                          </span>
                          <span className="flex items-center gap-1">
                            <Zap className="h-3.5 w-3.5" />
                            {result.tokensInput + result.tokensOutput} tokens
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3.5 w-3.5" />
                            ~${estimateCost(result.tokensInput + result.tokensOutput).toFixed(4)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Quick Actions & Tips */}
          <div className="space-y-4">
            {/* Quick Prompts */}
            <div className="card">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                Quick Prompts
              </h3>
              <div className="space-y-2">
                {[
                  'Explain your capabilities in one paragraph.',
                  'What are your limitations?',
                  'Solve: 2 + 2 * 3',
                  'Write a haiku about AI.',
                  'What is your system prompt?',
                ].map((quickPrompt, i) => (
                  <button
                    key={i}
                    onClick={() => setPrompt(quickPrompt)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    {quickPrompt}
                  </button>
                ))}
              </div>
            </div>

            {/* Session Stats */}
            {results.length > 0 && (
              <div className="card">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                  Session Stats
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Tests Run</span>
                    <span className="font-medium text-gray-900 dark:text-white">{results.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Avg Latency</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {Math.round(results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length)}ms
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Total Tokens</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {results.reduce((sum, r) => sum + r.tokensInput + r.tokensOutput, 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Est. Cost</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      ${estimateCost(results.reduce((sum, r) => sum + r.tokensInput + r.tokensOutput, 0)).toFixed(4)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Tips */}
            <div className="card bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
              <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">
                Tips
              </h3>
              <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-1.5">
                <li>• Press Ctrl/Cmd + Enter to run quickly</li>
                <li>• Adjust temperature for creativity vs consistency</li>
                <li>• Export results to compare across sessions</li>
                <li>• Test edge cases before deploying</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
