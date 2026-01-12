'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bot, Save, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import {
  CreateAgentInput,
  UpdateAgentInput,
  Agent,
  SPECIALIZATIONS,
  PERSONALITY_TRAITS,
  CAPABILITIES,
  AGENT_MODELS,
} from '@/lib/agents/types'

interface AgentFormProps {
  agent?: Agent
  onSubmit?: (data: CreateAgentInput | UpdateAgentInput) => Promise<void>
}

export default function AgentForm({ agent, onSubmit }: AgentFormProps) {
  const router = useRouter()
  const isEditing = !!agent

  // Form state
  const [name, setName] = useState(agent?.name || '')
  const [description, setDescription] = useState(agent?.description || '')
  const [systemPrompt, setSystemPrompt] = useState(agent?.system_prompt || '')
  const [model, setModel] = useState(agent?.model || 'claude-sonnet-4-20250514')
  const [specialization, setSpecialization] = useState(agent?.specialization || 'core')
  const [selectedTraits, setSelectedTraits] = useState<string[]>(agent?.personality_traits || [])
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>(agent?.capabilities || [])

  // Advanced settings
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [temperature, setTemperature] = useState(agent?.temperature || 0.7)
  const [maxTokens, setMaxTokens] = useState(agent?.max_tokens || 4096)

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleTraitToggle = (trait: string) => {
    setSelectedTraits(prev =>
      prev.includes(trait) ? prev.filter(t => t !== trait) : [...prev, trait]
    )
  }

  const handleCapabilityToggle = (capability: string) => {
    setSelectedCapabilities(prev =>
      prev.includes(capability) ? prev.filter(c => c !== capability) : [...prev, capability]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const data: CreateAgentInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        system_prompt: systemPrompt.trim(),
        model,
        specialization,
        personality_traits: selectedTraits,
        capabilities: selectedCapabilities,
        temperature,
        max_tokens: maxTokens,
      }

      if (onSubmit) {
        await onSubmit(data)
      } else {
        // Default API submission
        const endpoint = isEditing ? `/api/agents/${agent.id}` : '/api/agents'
        const method = isEditing ? 'PUT' : 'POST'

        const response = await fetch(endpoint, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        if (!response.ok) {
          const result = await response.json()
          throw new Error(result.error || 'Failed to save agent')
        }

        const result = await response.json()
        router.push(`/agents/${result.id}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 dark:bg-red-900/20 dark:border-red-800">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertCircle className="h-4 w-4" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Basic Info */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Basic Information
        </h2>

        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Agent Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
              placeholder="My Helpful Agent"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="A brief description of what this agent does..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
            />
          </div>

          <div>
            <label htmlFor="specialization" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Specialization
            </label>
            <select
              id="specialization"
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              {SPECIALIZATIONS.map((spec) => (
                <option key={spec.value} value={spec.value}>
                  {spec.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* System Prompt */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          System Prompt <span className="text-red-500">*</span>
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Define your agent's personality, expertise, and behavior guidelines.
        </p>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          required
          rows={8}
          placeholder="You are a helpful assistant that..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
        />
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {systemPrompt.length} / 10,000 characters
        </p>
      </div>

      {/* Personality & Capabilities */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Personality & Capabilities
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Personality Traits
            </label>
            <div className="flex flex-wrap gap-2">
              {PERSONALITY_TRAITS.map((trait) => (
                <button
                  key={trait}
                  type="button"
                  onClick={() => handleTraitToggle(trait)}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                    selectedTraits.includes(trait)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {trait}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Capabilities
            </label>
            <div className="flex flex-wrap gap-2">
              {CAPABILITIES.map((capability) => (
                <button
                  key={capability}
                  type="button"
                  onClick={() => handleCapabilityToggle(capability)}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                    selectedCapabilities.includes(capability)
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {capability}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Settings */}
      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex w-full items-center justify-between p-4"
        >
          <span className="text-lg font-semibold text-gray-900 dark:text-white">
            Advanced Settings
          </span>
          {showAdvanced ? (
            <ChevronUp className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-500" />
          )}
        </button>

        {showAdvanced && (
          <div className="border-t border-gray-200 p-6 dark:border-gray-700 space-y-4">
            <div>
              <label htmlFor="model" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Model
              </label>
              <select
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                {AGENT_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="temperature" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Temperature: {temperature}
              </label>
              <input
                id="temperature"
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Lower = more focused, Higher = more creative
              </p>
            </div>

            <div>
              <label htmlFor="maxTokens" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max Tokens
              </label>
              <input
                id="maxTokens"
                type="number"
                min="256"
                max="8192"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value) || 4096)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !name.trim() || !systemPrompt.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              {isEditing ? 'Save Changes' : 'Create Agent'}
            </>
          )}
        </button>
      </div>
    </form>
  )
}
