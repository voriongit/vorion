'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Bot,
  Save,
  Loader2,
  Sparkles,
  Shield,
  Zap,
  FileText,
  Code,
  MessageSquare,
  Eye,
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

interface AgentConfig {
  name: string
  description: string
  systemPrompt: string
  model: string
  temperature: number
  maxTokens: number
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

const DEFAULT_CONFIG: AgentConfig = {
  name: '',
  description: '',
  systemPrompt: '',
  model: 'claude-sonnet-4-20250514',
  temperature: 0.7,
  maxTokens: 2048,
  capabilities: {
    codeExecution: false,
    webSearch: false,
    fileAccess: false,
    apiCalls: false,
  },
  guardrails: {
    contentFilters: [],
    responseLength: 'balanced',
    tone: 'professional',
  },
  governance: {
    requireHumanApproval: false,
    approvalThreshold: 300,
    auditLevel: 'summary',
  },
}

const TEMPLATES = [
  {
    id: 'customer-support',
    name: 'Customer Support',
    icon: MessageSquare,
    description: 'Helpful agent for customer inquiries',
    config: {
      systemPrompt: `You are a helpful customer support agent. Your role is to:
- Answer customer questions clearly and professionally
- Resolve issues efficiently while maintaining a friendly tone
- Escalate complex issues when needed
- Never share sensitive information without verification`,
      capabilities: { codeExecution: false, webSearch: true, fileAccess: false, apiCalls: false },
      guardrails: { contentFilters: ['profanity'], responseLength: 'balanced' as const, tone: 'friendly' as const },
    },
  },
  {
    id: 'code-assistant',
    name: 'Code Assistant',
    icon: Code,
    description: 'Technical helper for developers',
    config: {
      systemPrompt: `You are an expert programming assistant. Your role is to:
- Help write, review, and debug code
- Explain technical concepts clearly
- Follow best practices and suggest improvements
- Support multiple programming languages`,
      capabilities: { codeExecution: true, webSearch: false, fileAccess: true, apiCalls: false },
      guardrails: { contentFilters: [], responseLength: 'detailed' as const, tone: 'professional' as const },
    },
  },
  {
    id: 'research-analyst',
    name: 'Research Analyst',
    icon: FileText,
    description: 'In-depth analysis and research',
    config: {
      systemPrompt: `You are a thorough research analyst. Your role is to:
- Gather and synthesize information from multiple sources
- Provide balanced, well-sourced analysis
- Present findings in clear, organized formats
- Identify gaps in available information`,
      capabilities: { codeExecution: false, webSearch: true, fileAccess: true, apiCalls: true },
      guardrails: { contentFilters: [], responseLength: 'detailed' as const, tone: 'formal' as const },
    },
  },
  {
    id: 'blank',
    name: 'Start from Scratch',
    icon: Sparkles,
    description: 'Build your own custom agent',
    config: {},
  },
]

const CONTENT_FILTERS = [
  { id: 'profanity', label: 'Profanity Filter' },
  { id: 'violence', label: 'Violence Filter' },
  { id: 'pii', label: 'PII Protection' },
  { id: 'political', label: 'Political Content' },
]

export default function NewAgentPage() {
  const router = useRouter()
  const [config, setConfig] = useState<AgentConfig>(DEFAULT_CONFIG)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    prompt: true,
    capabilities: false,
    guardrails: false,
    governance: false,
  })

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const applyTemplate = (templateId: string) => {
    const template = TEMPLATES.find(t => t.id === templateId)
    if (template && template.config) {
      setConfig(prev => ({
        ...prev,
        ...template.config,
        capabilities: { ...prev.capabilities, ...template.config.capabilities },
        guardrails: { ...prev.guardrails, ...template.config.guardrails },
      }))
    }
    setSelectedTemplate(templateId)
  }

  const handleSave = async () => {
    if (!config.name.trim()) {
      setError('Agent name is required')
      return
    }
    if (!config.systemPrompt.trim()) {
      setError('System prompt is required')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: config.name.trim(),
          description: config.description.trim() || undefined,
          system_prompt: config.systemPrompt.trim(),
          model: config.model,
          temperature: config.temperature,
          max_tokens: config.maxTokens,
          capabilities: Object.entries(config.capabilities)
            .filter(([_, v]) => v)
            .map(([k]) => k),
          config: {
            guardrails: config.guardrails,
            governance: config.governance,
          },
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error?.message || data.error || 'Failed to create agent')
      }

      router.push('/agents')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/agents"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Agents
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Create New Agent
        </h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          Configure your AI agent with custom capabilities and guardrails
        </p>
      </div>

      {/* Template Selector */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Choose a Template
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {TEMPLATES.map(template => {
            const Icon = template.icon
            const isSelected = selectedTemplate === template.id
            return (
              <button
                key={template.id}
                onClick={() => applyTemplate(template.id)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  isSelected
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <Icon className={`h-6 w-6 mb-2 ${isSelected ? 'text-purple-600' : 'text-gray-400'}`} />
                <div className="font-medium text-gray-900 dark:text-white text-sm">
                  {template.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {template.description}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800 dark:text-red-200">Error</p>
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
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
                  onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Customer Support Bot"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={config.description}
                  onChange={(e) => setConfig(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of what this agent does..."
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Model
                </label>
                <select
                  value={config.model}
                  onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="claude-sonnet-4-20250514">Claude Sonnet 4 (Recommended)</option>
                  <option value="claude-opus-4-20250514">Claude Opus 4 (Most Capable)</option>
                  <option value="claude-3-haiku-20240307">Claude 3 Haiku (Fast)</option>
                </select>
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
                System Prompt *
              </h2>
            </div>
            {expandedSections.prompt ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
          </button>

          {expandedSections.prompt && (
            <div className="mt-4">
              <textarea
                value={config.systemPrompt}
                onChange={(e) => setConfig(prev => ({ ...prev, systemPrompt: e.target.value }))}
                placeholder="Define your agent's role, capabilities, and behavior..."
                rows={8}
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
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        capabilities: { ...prev.capabilities, [key]: e.target.checked }
                      }))}
                      className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-gray-700 dark:text-gray-300">
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </span>
                  </label>
                ))}
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Temperature: {config.temperature.toFixed(1)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.temperature}
                  onChange={(e) => setConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <span>Consistent</span>
                  <span>Creative</span>
                </div>
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
                  onChange={(e) => setConfig(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
                  className="w-full"
                />
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
                          setConfig(prev => ({
                            ...prev,
                            guardrails: { ...prev.guardrails, contentFilters: filters }
                          }))
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
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
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      guardrails: { ...prev.guardrails, responseLength: e.target.value as any }
                    }))}
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
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      guardrails: { ...prev.guardrails, tone: e.target.value as any }
                    }))}
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
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    governance: { ...prev.governance, requireHumanApproval: e.target.checked }
                  }))}
                  className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Require Human Approval (HITL)
                  </span>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Critical actions will require human review
                  </p>
                </div>
              </label>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Audit Level
                </label>
                <select
                  value={config.governance.auditLevel}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    governance: { ...prev.governance, auditLevel: e.target.value as any }
                  }))}
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
      <div className="flex items-center justify-end gap-4 pt-4">
        <Link
          href="/agents"
          className="px-6 py-2.5 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          Cancel
        </Link>
        <button
          onClick={handleSave}
          disabled={isSaving || !config.name.trim()}
          className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Create Agent
            </>
          )}
        </button>
      </div>
    </div>
  )
}
