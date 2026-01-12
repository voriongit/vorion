'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Bot, Users, Sparkles, BookmarkPlus, Star, Lightbulb, Trash2 } from 'lucide-react'
import Link from 'next/link'

export default function CollaboratePage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [loadingBots, setLoadingBots] = useState(true)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bots, setBots] = useState<any[]>([])
  const [selectedBots, setSelectedBots] = useState<string[]>([])
  const [issueDescription, setIssueDescription] = useState('')
  const [presets, setPresets] = useState<any[]>([])
  const [showSavePreset, setShowSavePreset] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [presetDescription, setPresetDescription] = useState('')

  useEffect(() => {
    loadBots()
    loadPresets()
  }, [])

  const loadBots = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) return

      const { data, error } = await supabase
        .from('bots')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      setBots(data || [])
      setLoadingBots(false)
    } catch (err: any) {
      setError(err.message)
      setLoadingBots(false)
    }
  }

  const loadPresets = async () => {
    try {
      const response = await fetch('/api/presets')
      const data = await response.json()
      if (response.ok) {
        setPresets(data.presets || [])
      }
    } catch (err) {
      console.error('Failed to load presets:', err)
    }
  }

  const loadPreset = (preset: any) => {
    setSelectedBots(preset.bot_ids)
    if (preset.description) {
      setIssueDescription(preset.description)
    }
  }

  const savePreset = async () => {
    if (!presetName || selectedBots.length < 2) return

    try {
      const response = await fetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: presetName,
          description: presetDescription,
          bot_ids: selectedBots,
          is_favorite: false,
        }),
      })

      if (response.ok) {
        await loadPresets()
        setShowSavePreset(false)
        setPresetName('')
        setPresetDescription('')
      }
    } catch (err) {
      console.error('Failed to save preset:', err)
    }
  }

  const deletePreset = async (presetId: string) => {
    try {
      const response = await fetch(`/api/presets?id=${presetId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await loadPresets()
      }
    } catch (err) {
      console.error('Failed to delete preset:', err)
    }
  }

  const getSuggestions = async () => {
    if (!issueDescription || bots.length === 0) return

    setLoadingSuggestions(true)
    try {
      const response = await fetch('/api/suggest-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: issueDescription,
          availableBots: bots,
        }),
      })

      const data = await response.json()
      if (response.ok && data.suggestedBotIds) {
        setSelectedBots(data.suggestedBotIds)
      }
    } catch (err) {
      console.error('Failed to get suggestions:', err)
    } finally {
      setLoadingSuggestions(false)
    }
  }

  const toggleBot = (botId: string) => {
    setSelectedBots((prev) =>
      prev.includes(botId)
        ? prev.filter((id) => id !== botId)
        : prev.length < 10 // Max 10 bots
        ? [...prev, botId]
        : prev
    )
  }

  const startCollaboration = async () => {
    if (selectedBots.length < 2) {
      setError('Please select at least 2 agents to collaborate')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        throw new Error('Not authenticated')
      }

      // Create a conversation for this collaboration
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert([
          {
            user_id: session.user.id,
            title: issueDescription || `Collaboration with ${selectedBots.length} agents`,
            metadata: {
              type: 'collaboration',
              bot_ids: selectedBots,
            },
          },
        ])
        .select()
        .single()

      if (convError) throw convError

      // Navigate to collaboration chat
      router.push(`/collaborate/${conversation.id}`)
    } catch (err: any) {
      setError(err.message || 'Failed to start collaboration')
      setLoading(false)
    }
  }

  if (loadingBots) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard"
          className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Start Collaboration
            </h1>
          </div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Select 2-10 agents to collaborate on a specific issue. All selected agents will provide their expertise.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}

      {/* Issue Description with AI Suggestions */}
      <div className="card">
        <label htmlFor="issue" className="label mb-2">
          What issue or question do you want the agents to collaborate on?
        </label>
        <textarea
          id="issue"
          value={issueDescription}
          onChange={(e) => setIssueDescription(e.target.value)}
          className="input"
          rows={3}
          placeholder="e.g., Design a microservices architecture for an e-commerce platform"
        />
        {issueDescription && (
          <button
            onClick={getSuggestions}
            disabled={loadingSuggestions}
            className="btn-secondary mt-3 text-sm flex items-center gap-2"
          >
            {loadingSuggestions ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Getting AI suggestions...
              </>
            ) : (
              <>
                <Lightbulb className="h-4 w-4" />
                Get AI Agent Suggestions
              </>
            )}
          </button>
        )}
      </div>

      {/* Presets Section */}
      {presets.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Saved Presets
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {presets.map((preset) => (
              <div
                key={preset.id}
                className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-300 dark:hover:border-purple-600 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <button
                    onClick={() => loadPreset(preset)}
                    className="flex-1 text-left"
                  >
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {preset.name}
                    </h3>
                    {preset.description && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {preset.description}
                      </p>
                    )}
                    <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                      {preset.bot_ids.length} agents
                    </p>
                  </button>
                  <button
                    onClick={() => deletePreset(preset.id)}
                    className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bot Selection */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="h-5 w-5" />
              Select Agents ({selectedBots.length}/10)
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Choose between 2-10 agents. All selected agents will participate in the conversation.
            </p>
          </div>
        </div>

        {bots.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bots.map((bot) => {
              const isSelected = selectedBots.includes(bot.id)
              const isMaxReached = selectedBots.length >= 10 && !isSelected

              return (
                <button
                  key={bot.id}
                  onClick={() => !isMaxReached && toggleBot(bot.id)}
                  disabled={isMaxReached}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    isSelected
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                      : isMaxReached
                      ? 'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      {bot.avatar_url ? (
                        <span className="text-3xl">{bot.avatar_url}</span>
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                          <Bot className="h-5 w-5 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                        {bot.name}
                      </h3>
                      {bot.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                          {bot.description}
                        </p>
                      )}
                      {isSelected && (
                        <span className="inline-block mt-2 text-xs font-medium text-purple-600 dark:text-purple-400">
                          ✓ Selected
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <Bot className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No agents available. Create some agents first!
            </p>
            <Link href="/bots/new" className="btn-primary">
              Create Agent
            </Link>
          </div>
        )}
      </div>

      {/* Info Card */}
      {selectedBots.length > 0 && (
        <div className="card bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
          <h3 className="font-semibold text-purple-900 dark:text-purple-300 mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Collaboration Mode
          </h3>
          <p className="text-sm text-purple-800 dark:text-purple-400">
            All {selectedBots.length} selected agent{selectedBots.length !== 1 ? 's' : ''} will respond to your questions in sequence,
            providing diverse perspectives and expertise. Each agent can see and build upon responses from previous agents.
          </p>
        </div>
      )}

      {/* Save Preset Modal */}
      {showSavePreset && (
        <div className="card bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
          <h3 className="font-semibold text-purple-900 dark:text-purple-300 mb-3">
            Save Current Selection as Preset
          </h3>
          <div className="space-y-3">
            <div>
              <label className="label text-sm">Preset Name *</label>
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                className="input"
                placeholder="e.g., Dev Team, Content Squad"
              />
            </div>
            <div>
              <label className="label text-sm">Description (Optional)</label>
              <input
                type="text"
                value={presetDescription}
                onChange={(e) => setPresetDescription(e.target.value)}
                className="input"
                placeholder="e.g., My go-to team for code reviews"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={savePreset}
                disabled={!presetName || selectedBots.length < 2}
                className="btn-primary text-sm disabled:opacity-50"
              >
                Save Preset
              </button>
              <button
                onClick={() => {
                  setShowSavePreset(false)
                  setPresetName('')
                  setPresetDescription('')
                }}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4 flex-wrap">
        <button
          onClick={startCollaboration}
          disabled={loading || selectedBots.length < 2}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Start Collaboration ({selectedBots.length} agents)
            </>
          )}
        </button>
        {selectedBots.length >= 2 && !showSavePreset && (
          <button
            onClick={() => setShowSavePreset(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <BookmarkPlus className="h-4 w-4" />
            Save as Preset
          </button>
        )}
        <Link href="/dashboard" className="btn-secondary">
          Cancel
        </Link>
      </div>
    </div>
  )
}
