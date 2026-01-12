'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Bot } from 'lucide-react'
import Link from 'next/link'

export default function NewTeamPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [loadingBots, setLoadingBots] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bots, setBots] = useState<any[]>([])
  const [selectedBots, setSelectedBots] = useState<string[]>([])

  const [formData, setFormData] = useState({
    name: '',
    description: '',
  })

  useEffect(() => {
    loadBots()
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        throw new Error('Not authenticated')
      }

      // Create team
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert([
          {
            ...formData,
            user_id: session.user.id,
          },
        ])
        .select()
        .single()

      if (teamError) throw teamError

      // Add bots to team
      if (selectedBots.length > 0) {
        const teamBots = selectedBots.map((botId) => ({
          team_id: team.id,
          bot_id: botId,
        }))

        const { error: teamBotsError } = await supabase
          .from('team_bots')
          .insert(teamBots)

        if (teamBotsError) throw teamBotsError
      }

      router.push(`/teams/${team.id}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to create team')
      setLoading(false)
    }
  }

  const toggleBot = (botId: string) => {
    setSelectedBots((prev) =>
      prev.includes(botId)
        ? prev.filter((id) => id !== botId)
        : [...prev, botId]
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/teams"
          className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Create New Team
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Organize your bots into a collaborative team
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card space-y-6">
          <div>
            <label htmlFor="name" className="label">
              Team Name *
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              placeholder="My AI Team"
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
              placeholder="A team of AI assistants for..."
            />
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Add Bots to Team
          </h3>

          {loadingBots ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : bots.length > 0 ? (
            <div className="space-y-2">
              {bots.map((bot) => (
                <label
                  key={bot.id}
                  className="flex items-center p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedBots.includes(bot.id)}
                    onChange={() => toggleBot(bot.id)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div className="ml-3 flex items-center flex-1">
                    <Bot className="h-5 w-5 text-gray-400 mr-2" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {bot.name}
                      </p>
                      {bot.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {bot.description}
                        </p>
                      )}
                    </div>
                  </div>
                </label>
              ))}
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
                {selectedBots.length} bot{selectedBots.length !== 1 ? 's' : ''} selected
              </p>
            </div>
          ) : (
            <div className="text-center py-8">
              <Bot className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                No bots available. Create some bots first!
              </p>
              <Link href="/bots/new" className="btn-primary">
                Create Bot
              </Link>
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {loading ? 'Creating...' : 'Create Team'}
          </button>
          <Link href="/teams" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
