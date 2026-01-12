'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Loader2, Trash2, Link as LinkIcon } from 'lucide-react'
import Link from 'next/link'

export default function EditMCPServerPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [server, setServer] = useState<any>(null)
  const [bots, setBots] = useState<any[]>([])
  const [attachedBots, setAttachedBots] = useState<string[]>([])

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    config: {},
  })

  useEffect(() => {
    loadServer()
    loadBots()
  }, [])

  const loadServer = async () => {
    try {
      const { data, error } = await supabase
        .from('mcp_servers')
        .select('*')
        .eq('id', params.id)
        .single()

      if (error) throw error

      setServer(data)
      setFormData({
        name: data.name,
        description: data.description || '',
        config: data.config || {},
      })

      // Load attached bots
      const { data: botServers } = await supabase
        .from('bot_mcp_servers')
        .select('bot_id')
        .eq('mcp_server_id', params.id)

      if (botServers) {
        setAttachedBots(botServers.map((bs) => bs.bot_id))
      }

      setLoading(false)
    } catch (err: any) {
      setError(err.message || 'Failed to load MCP server')
      setLoading(false)
    }
  }

  const loadBots = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) return

    const { data } = await supabase
      .from('bots')
      .select('*')
      .eq('user_id', session.user.id)
      .order('name')

    setBots(data || [])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const { error } = await supabase
        .from('mcp_servers')
        .update({
          name: formData.name,
          description: formData.description,
          config: formData.config,
        })
        .eq('id', params.id)

      if (error) throw error

      // Update bot attachments
      // First, remove all current attachments
      await supabase.from('bot_mcp_servers').delete().eq('mcp_server_id', params.id)

      // Then add new attachments
      if (attachedBots.length > 0) {
        const attachments = attachedBots.map((botId) => ({
          bot_id: botId,
          mcp_server_id: params.id,
          permissions: {},
        }))

        await supabase.from('bot_mcp_servers').insert(attachments)
      }

      router.push('/mcp')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to update MCP server')
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (
      !confirm(
        'Are you sure you want to delete this MCP server? This will remove it from all bots.'
      )
    ) {
      return
    }

    setDeleting(true)
    setError(null)

    try {
      const { error } = await supabase.from('mcp_servers').delete().eq('id', params.id)

      if (error) throw error

      router.push('/mcp')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to delete MCP server')
      setDeleting(false)
    }
  }

  const toggleBotAttachment = (botId: string) => {
    setAttachedBots((prev) =>
      prev.includes(botId) ? prev.filter((id) => id !== botId) : [...prev, botId]
    )
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
          href="/mcp"
          className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Edit MCP Server
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Modify server configuration and bot attachments
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

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Server Information
          </h3>

          <div>
            <label className="label">Server Type</label>
            <input
              type="text"
              value={server?.type}
              disabled
              className="input bg-gray-100 dark:bg-gray-700"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Server type cannot be changed
            </p>
          </div>

          <div>
            <label htmlFor="name" className="label">
              Server Name *
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
        </div>

        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Attached Bots
            </h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Select which bots can use this MCP server
          </p>

          {bots.length > 0 ? (
            <div className="space-y-2">
              {bots.map((bot) => (
                <label
                  key={bot.id}
                  className="flex items-center p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={attachedBots.includes(bot.id)}
                    onChange={() => toggleBotAttachment(bot.id)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div className="ml-3">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {bot.name}
                    </p>
                    {bot.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {bot.description}
                      </p>
                    )}
                  </div>
                </label>
              ))}
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
                {attachedBots.length} bot{attachedBots.length !== 1 ? 's' : ''}{' '}
                attached
              </p>
            </div>
          ) : (
            <div className="text-center py-8">
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
            disabled={saving}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <Link href="/mcp" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
