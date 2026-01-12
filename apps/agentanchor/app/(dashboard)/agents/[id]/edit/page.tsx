'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Bot,
  Save,
  Loader2,
  Shield,
  Zap,
  FileText,
  Eye,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Trash2
} from 'lucide-react'

interface AgentConfig {
  name: string
  description: string
  systemPrompt: string
  model: string
  temperature: number
  maxTokens: number
  status: string
  capabilities: {
    codeExecution: boolean
    webSearch: boolean
    fileAccess: boolean
    apiCalls: boolean
  }
  guardrails: {
    contentFilters: string[]
    responseLength: 'concise' | 'balanced' | 'detailed'
    tone: 'professional' | 'friendly' | 'casual' | 'formal'
  }
  governance: {
    requireHumanApproval: boolean
    approvalThreshold: number
    auditLevel: 'none' | 'summary' | 'full'
  }
}

const CONTENT_FILTERS = [
  { id: 'profanity', label: 'Profanity Filter' },
  { id: 'violence', label: 'Violence Filter' },
  { id: 'pii', label: 'PII Protection' },
  { id: 'political', label: 'Political Content' },
]

export default function EditAgentPage() {
  const params = useParams()
  const router = useRouter()
  const [config, setConfig] = useState<AgentConfig | null>(null)
  const [originalConfig, setOriginalConfig] = useState<AgentConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    prompt: true,
    capabilities: true,
    guardrails: false,
    governance: false,
  })

  useEffect(() => {
    fetchAgent()
  }, [params.id])

  const fetchAgent = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/agents/${params.id}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch agent')
      }

      const agent = data.agent || data
      const agentConfig = agent.config || {}

      const parsedConfig: AgentConfig = {
        name: agent.name || '',
        description: agent.description || '',
        systemPrompt: agent.system_prompt || '',
        model: agent.model || 'claude-sonnet-4-20250514',
        temperature: agent.temperature || 0.7,
        maxTokens: agent.max_tokens || 2048,
        status: agent.status || 'draft',
        capabilities: agentConfig.capabilities || {
          codeExecution: false,
          webSearch: false,
          fileAccess: false,
          apiCalls: false,
        },
        guardrails: agentConfig.guardrails || {
          contentFilters: [],
          responseLength: 'balanced',
          tone: 'professional',
        },
        governance: agentConfig.governance || {
          requireHumanApproval: false,
          approvalThreshold: 300,
          auditLevel: 'summary',
        },
      }

      setConfig(parsedConfig)
      setOriginalConfig(parsedConfig)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent')
    } finally {
      setLoading(false)
    }
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const handleSave = async () => {
    if (!config) return

    if (!config.name.trim()) {
      setError('Agent name is required')
      return
    }

    setIsSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch(`/api/agents/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: config.name.trim(),
          description: config.description.trim() || null,
          system_prompt: config.systemPrompt.trim(),
          model: config.model,
          temperature: config.temperature,
          max_tokens: config.maxTokens,
          status: config.status,
          config: {
            capabilities: config.capabilities,
            guardrails: config.guardrails,
            governance: config.governance,
          },
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error?.message || data.error || 'Failed to update agent')
      }

      setSuccess(true)
      setOriginalConfig(config)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update agent')
    } finally {
      setIsSaving(false)
    }
  }

  const hasChanges = config && originalConfig && JSON.stringify(config) !== JSON.stringify(originalConfig)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    )
  }

  if (!config) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <AlertTriangle className="h-12 w-12 mx-auto text-red-500 mb-4" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          {error || 'Agent not found'}
        </h1>
        <Link
          href="/agents"
          className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Agents
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/agents/${params.id}`}
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Agent
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Edit Agent
          </h1>
        </div>
        {hasChanges && (
          <span className="text-sm text-yellow-600 dark:text-yellow-400">
            Unsaved changes
          </span>
        )}
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-3">
          <Bot className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          <p className="text-green-700 dark:text-green-300">Agent updated successfully!</p>
        </div>
      )}

      {/* Configuration Sections */}
      <div className="space-y-4">
        {/* Basic Info */}
        <div className="card">
          <button
            onClick={() => toggleSection('basic')}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Bot className="h-5 w-5 text-purple-600" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Basic Information
              </h2>
            </div>
            {expandedSections.basic ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
          </button>

          {expandedSections.basic && (
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Agent Name *
                </label>
                <input
                  type="text"
                  value={config.name}
                  onChange={(e) => setConfig(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={config.description}
                  onChange={(e) => setConfig(prev => prev ? { ...prev, description: e.target.value } : null)}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Model
                  </label>
                  <select
                    value={config.model}
                    onChange={(e) => setConfig(prev => prev ? { ...prev, model: e.target.value } : null)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                    <option value="claude-opus-4-20250514">Claude Opus 4</option>
                    <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Status
                  </label>
                  <select
                    value={config.status}
                    onChange={(e) => setConfig(prev => prev ? { ...prev, status: e.target.value } : null)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="training">Training</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* System Prompt */}
        <div className="card">
          <button
            onClick={() => toggleSection('prompt')}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                System Prompt
              </h2>
            </div>
            {expandedSections.prompt ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
          </button>

          {expandedSections.prompt && (
            <div className="mt-4">
              <textarea
                value={config.systemPrompt}
                onChange={(e) => setConfig(prev => prev ? { ...prev, systemPrompt: e.target.value } : null)}
                rows={10}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm resize-none"
              />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {config.systemPrompt.length} characters
              </p>
            </div>
          )}
        </div>

        {/* Capabilities */}
        <div className="card">
          <button
            onClick={() => toggleSection('capabilities')}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-yellow-600" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Capabilities
              </h2>
            </div>
            {expandedSections.capabilities ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
          </button>

          {expandedSections.capabilities && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(config.capabilities).map(([key, value]) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(e) => setConfig(prev => prev ? {
                        ...prev,
                        capabilities: { ...prev.capabilities, [key]: e.target.checked }
                      } : null)}
                      className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-gray-700 dark:text-gray-300">
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </span>
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Temperature: {config.temperature.toFixed(1)}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={config.temperature}
                    onChange={(e) => setConfig(prev => prev ? { ...prev, temperature: parseFloat(e.target.value) } : null)}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Max Tokens: {config.maxTokens}
                  </label>
                  <input
                    type="range"
                    min="256"
                    max="8192"
                    step="256"
                    value={config.maxTokens}
                    onChange={(e) => setConfig(prev => prev ? { ...prev, maxTokens: parseInt(e.target.value) } : null)}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Guardrails */}
        <div className="card">
          <button
            onClick={() => toggleSection('guardrails')}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-green-600" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Guardrails
              </h2>
            </div>
            {expandedSections.guardrails ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
          </button>

          {expandedSections.guardrails && (
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Content Filters
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {CONTENT_FILTERS.map(filter => (
                    <label key={filter.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.guardrails.contentFilters.includes(filter.id)}
                        onChange={(e) => {
                          const filters = e.target.checked
                            ? [...config.guardrails.contentFilters, filter.id]
                            : config.guardrails.contentFilters.filter(f => f !== filter.id)
                          setConfig(prev => prev ? {
                            ...prev,
                            guardrails: { ...prev.guardrails, contentFilters: filters }
                          } : null)
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-purple-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{filter.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Response Length
                  </label>
                  <select
                    value={config.guardrails.responseLength}
                    onChange={(e) => setConfig(prev => prev ? {
                      ...prev,
                      guardrails: { ...prev.guardrails, responseLength: e.target.value as any }
                    } : null)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="concise">Concise</option>
                    <option value="balanced">Balanced</option>
                    <option value="detailed">Detailed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tone
                  </label>
                  <select
                    value={config.guardrails.tone}
                    onChange={(e) => setConfig(prev => prev ? {
                      ...prev,
                      guardrails: { ...prev.guardrails, tone: e.target.value as any }
                    } : null)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="professional">Professional</option>
                    <option value="friendly">Friendly</option>
                    <option value="casual">Casual</option>
                    <option value="formal">Formal</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Governance */}
        <div className="card">
          <button
            onClick={() => toggleSection('governance')}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5 text-red-600" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Governance
              </h2>
            </div>
            {expandedSections.governance ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
          </button>

          {expandedSections.governance && (
            <div className="mt-4 space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.governance.requireHumanApproval}
                  onChange={(e) => setConfig(prev => prev ? {
                    ...prev,
                    governance: { ...prev.governance, requireHumanApproval: e.target.checked }
                  } : null)}
                  className="w-5 h-5 rounded border-gray-300 text-purple-600"
                />
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Require Human Approval (HITL)
                  </span>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Critical actions require human review
                  </p>
                </div>
              </label>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Audit Level
                </label>
                <select
                  value={config.governance.auditLevel}
                  onChange={(e) => setConfig(prev => prev ? {
                    ...prev,
                    governance: { ...prev.governance, auditLevel: e.target.value as any }
                  } : null)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="none">None - No logging</option>
                  <option value="summary">Summary - Key actions only</option>
                  <option value="full">Full - All interactions</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <Link
          href={`/agents/${params.id}`}
          className="px-6 py-2.5 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          Cancel
        </Link>
        <button
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  )
}
