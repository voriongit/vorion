'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Loader2, Trash2, GraduationCap, BookOpen, Trophy, Award, Rocket } from 'lucide-react'
import Link from 'next/link'

const MODELS = [
  { id: 'claude-3-sonnet-20240229', name: 'Claude 3.5 Sonnet' },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
  { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
  { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
]

const BOT_AVATARS = [
  { id: '🤖', name: 'Robot', emoji: '🤖' },
  { id: '🧠', name: 'Brain', emoji: '🧠' },
  { id: '💡', name: 'Lightbulb', emoji: '💡' },
  { id: '🎯', name: 'Target', emoji: '🎯' },
  { id: '⚡', name: 'Lightning', emoji: '⚡' },
  { id: '🚀', name: 'Rocket', emoji: '🚀' },
  { id: '🎨', name: 'Art', emoji: '🎨' },
  { id: '📊', name: 'Chart', emoji: '📊' },
  { id: '🔬', name: 'Microscope', emoji: '🔬' },
  { id: '💻', name: 'Computer', emoji: '💻' },
  { id: '🎭', name: 'Theater', emoji: '🎭' },
  { id: '🌟', name: 'Star', emoji: '🌟' },
  { id: '⏰', name: 'Alarm Clock', emoji: '⏰' },
  { id: '🧮', name: 'Calculator', emoji: '🧮' },
  { id: '📋', name: 'Clipboard', emoji: '📋' },
  { id: '🚂', name: 'Train', emoji: '🚂' },
  { id: '🖥️', name: 'Server', emoji: '🖥️' },
  { id: '🐕', name: 'Dog', emoji: '🐕' },
  { id: '🐈', name: 'Cat', emoji: '🐈' },
  { id: '🦁', name: 'Lion', emoji: '🦁' },
  { id: '🦅', name: 'Eagle', emoji: '🦅' },
  { id: '🎬', name: 'Red Carpet', emoji: '🎬' },
  { id: '💼', name: 'Executive', emoji: '💼' },
  { id: '👔', name: 'Business', emoji: '👔' },
  { id: '📈', name: 'Sales', emoji: '📈' },
  { id: '💰', name: 'Finance', emoji: '💰' },
  { id: '🤝', name: 'HR', emoji: '🤝' },
  { id: '📞', name: 'Customer Service', emoji: '📞' },
  { id: '⚖️', name: 'Legal', emoji: '⚖️' },
  { id: '🔒', name: 'Security', emoji: '🔒' },
  { id: '⚙️', name: 'Operations', emoji: '⚙️' },
  { id: '📚', name: 'Training', emoji: '📚' },
  { id: '🎓', name: 'Education', emoji: '🎓' },
  { id: '📢', name: 'Marketing', emoji: '📢' },
  { id: '✍️', name: 'Content Writer', emoji: '✍️' },
  { id: '🏆', name: 'Quality', emoji: '🏆' },
  { id: '📦', name: 'Logistics', emoji: '📦' },
  { id: '🔧', name: 'Maintenance', emoji: '🔧' },
  { id: '💾', name: 'Data', emoji: '💾' },
  { id: '🛡️', name: 'Protection', emoji: '🛡️' },
  { id: '📝', name: 'Documentation', emoji: '📝' },
  { id: '🎧', name: 'Support', emoji: '🎧' },
]

export default function EditBotPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    system_prompt: '',
    model: 'claude-3-sonnet-20240229',
    temperature: 1.0,
    max_tokens: 4096,
    is_public: false,
    avatar_url: '🤖',
  })
  const [agentStatus, setAgentStatus] = useState({
    status: 'draft',
    trust_score: 0,
    trust_tier: 'untrusted',
    certification_level: 0,
  })
  const [graduationStatus, setGraduationStatus] = useState<any>(null)
  const [graduating, setGraduating] = useState(false)

  useEffect(() => {
    loadBot()
  }, [])

  const loadBot = async () => {
    try {
      const { data, error } = await supabase
        .from('bots')
        .select('*')
        .eq('id', params.id)
        .single()

      if (error) throw error

      setFormData({
        name: data.name,
        description: data.description || '',
        system_prompt: data.system_prompt,
        model: data.model,
        temperature: data.temperature,
        max_tokens: data.max_tokens,
        is_public: data.is_public,
        avatar_url: data.avatar_url || '🤖',
      })
      setAgentStatus({
        status: data.status || 'draft',
        trust_score: data.trust_score || 0,
        trust_tier: data.trust_tier || 'untrusted',
        certification_level: data.certification_level || 0,
      })
      setLoading(false)

      // Check graduation status
      loadGraduationStatus()
    } catch (err: any) {
      setError(err.message || 'Failed to load bot')
      setLoading(false)
    }
  }

  const loadGraduationStatus = async () => {
    try {
      const res = await fetch(`/api/agents/${params.id}/graduate`)
      if (res.ok) {
        const data = await res.json()
        setGraduationStatus(data)
      }
    } catch (err) {
      console.error('Error loading graduation status:', err)
    }
  }

  const handleGraduate = async () => {
    try {
      setGraduating(true)
      setError(null)

      const res = await fetch(`/api/agents/${params.id}/graduate`, {
        method: 'POST',
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to graduate agent')
      }

      // Reload bot and graduation status
      await loadBot()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGraduating(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const { error } = await supabase
        .from('bots')
        .update(formData)
        .eq('id', params.id)

      if (error) throw error

      router.push('/bots')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to update bot')
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this bot? This action cannot be undone.')) {
      return
    }

    setDeleting(true)
    setError(null)

    try {
      const { error } = await supabase
        .from('bots')
        .delete()
        .eq('id', params.id)

      if (error) throw error

      router.push('/bots')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to delete bot')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/bots"
          className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Edit Bot
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Modify your AI assistant's settings
          </p>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="btn-secondary text-red-600 dark:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          {deleting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4 mr-2" />
          )}
          Delete
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}

      {/* Agent Status Banner */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-4xl">{formData.avatar_url}</div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {formData.name}
              </h2>
              <div className="flex items-center gap-3 mt-1">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  agentStatus.status === 'active'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    : agentStatus.status === 'training'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {agentStatus.status.charAt(0).toUpperCase() + agentStatus.status.slice(1)}
                </span>
                {agentStatus.trust_score > 0 && (
                  <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                    <Trophy className="h-4 w-4 text-yellow-500" />
                    {agentStatus.trust_score} Trust ({agentStatus.trust_tier})
                  </span>
                )}
                {agentStatus.certification_level > 0 && (
                  <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                    <Award className="h-4 w-4 text-purple-500" />
                    Level {agentStatus.certification_level}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Training Link */}
            <Link
              href={`/agents/${params.id}/training`}
              className="btn-secondary flex items-center gap-2"
            >
              <BookOpen className="h-4 w-4" />
              Training
            </Link>

            {/* Graduation Button */}
            {graduationStatus?.ready_to_graduate && (
              <button
                onClick={handleGraduate}
                disabled={graduating}
                className="btn-primary flex items-center gap-2"
              >
                {graduating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <GraduationCap className="h-4 w-4" />
                )}
                {graduating ? 'Graduating...' : 'Graduate Agent'}
              </button>
            )}

            {/* Graduated - Publish CTA */}
            {graduationStatus?.is_graduated && (
              <button
                className="btn-primary flex items-center gap-2"
                disabled
                title="Coming soon"
              >
                <Rocket className="h-4 w-4" />
                Publish to Marketplace
              </button>
            )}
          </div>
        </div>

        {/* Graduation Success Message */}
        {graduationStatus?.is_graduated && agentStatus.status === 'active' && (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <GraduationCap className="h-5 w-5" />
              <span className="font-medium">Agent Graduated!</span>
            </div>
            <p className="mt-1 text-sm text-green-600 dark:text-green-400">
              Your agent has completed Academy training and is now active with a Trust Score of {agentStatus.trust_score}.
            </p>
          </div>
        )}

        {/* Ready to Graduate Message */}
        {graduationStatus?.ready_to_graduate && !graduationStatus?.is_graduated && (
          <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
            <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
              <GraduationCap className="h-5 w-5" />
              <span className="font-medium">Ready for Graduation!</span>
            </div>
            <p className="mt-1 text-sm text-purple-600 dark:text-purple-400">
              Your agent has passed the Council examination. Click "Graduate Agent" to complete the process and receive your Trust Score.
            </p>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6">
        <div>
          <label htmlFor="name" className="label">
            Bot Name *
          </label>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="input"
            required
          />
        </div>

        <div>
          <label htmlFor="description" className="label">
            Description
          </label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            className="input"
            rows={3}
          />
        </div>

        <div>
          <label className="label">Bot Avatar *</label>
          <div className="grid grid-cols-6 md:grid-cols-12 gap-2 mt-2">
            {BOT_AVATARS.map((avatar) => (
              <button
                key={avatar.id}
                type="button"
                onClick={() =>
                  setFormData({ ...formData, avatar_url: avatar.emoji })
                }
                className={`p-3 text-3xl rounded-lg border-2 transition-all hover:scale-110 ${
                  formData.avatar_url === avatar.emoji
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
                title={avatar.name}
              >
                {avatar.emoji}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Choose an icon to represent your bot
          </p>
        </div>

        <div>
          <label htmlFor="system_prompt" className="label">
            System Prompt *
          </label>
          <textarea
            id="system_prompt"
            value={formData.system_prompt}
            onChange={(e) =>
              setFormData({ ...formData, system_prompt: e.target.value })
            }
            className="input font-mono text-sm"
            rows={8}
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="model" className="label">
              Model *
            </label>
            <select
              id="model"
              value={formData.model}
              onChange={(e) =>
                setFormData({ ...formData, model: e.target.value })
              }
              className="input"
            >
              {MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="temperature" className="label">
              Temperature: {formData.temperature}
            </label>
            <input
              id="temperature"
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={formData.temperature}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  temperature: parseFloat(e.target.value),
                })
              }
              className="w-full"
            />
          </div>

          <div>
            <label htmlFor="max_tokens" className="label">
              Max Tokens
            </label>
            <input
              id="max_tokens"
              type="number"
              value={formData.max_tokens}
              onChange={(e) =>
                setFormData({ ...formData, max_tokens: parseInt(e.target.value) })
              }
              className="input"
              min="1"
              max="200000"
            />
          </div>

          <div className="flex items-center">
            <input
              id="is_public"
              type="checkbox"
              checked={formData.is_public}
              onChange={(e) =>
                setFormData({ ...formData, is_public: e.target.checked })
              }
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label
              htmlFor="is_public"
              className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
            >
              Make this bot public
            </label>
          </div>
        </div>

        <div className="flex gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <Link href="/bots" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
