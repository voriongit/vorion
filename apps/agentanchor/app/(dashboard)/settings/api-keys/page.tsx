'use client'

import { useState, useEffect } from 'react'
import { Key, Copy, Trash2, Plus, Eye, EyeOff, Book, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  scope: 'read' | 'write' | 'admin'
  last_used_at: string | null
  created_at: string
  expires_at: string | null
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyScope, setNewKeyScope] = useState<'read' | 'write' | 'admin'>('read')
  const [newKeySecret, setNewKeySecret] = useState<string | null>(null)
  const [showSecret, setShowSecret] = useState(false)
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchKeys()
  }, [])

  async function fetchKeys() {
    try {
      const response = await fetch('/api/keys')
      if (response.ok) {
        const data = await response.json()
        setKeys(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch API keys:', error)
    } finally {
      setLoading(false)
    }
  }

  async function createKey() {
    if (!newKeyName.trim()) return

    setCreating(true)
    try {
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName, scope: newKeyScope }),
      })

      if (response.ok) {
        const data = await response.json()
        setNewKeySecret(data.key)
        await fetchKeys()
      }
    } catch (error) {
      console.error('Failed to create API key:', error)
    } finally {
      setCreating(false)
    }
  }

  async function deleteKey(id: string) {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/keys/${id}`, { method: 'DELETE' })
      if (response.ok) {
        setKeys(keys.filter((k) => k.id !== id))
      }
    } catch (error) {
      console.error('Failed to delete API key:', error)
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function closeModal() {
    setShowCreateModal(false)
    setNewKeyName('')
    setNewKeyScope('read')
    setNewKeySecret(null)
    setShowSecret(false)
  }

  const scopeColors = {
    read: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    write: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">API Keys</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage API keys for programmatic access to AgentAnchor
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/docs/api"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <Book className="h-4 w-4" />
            API Docs
          </Link>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Create Key
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
        <div className="flex gap-3">
          <Key className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <p className="font-medium">API Key Security</p>
            <p className="mt-1 text-blue-700 dark:text-blue-400">
              API keys provide full access to your account based on their scope. Keep them secure and never share them publicly.
              You can only view the full key once when it&apos;s created.
            </p>
          </div>
        </div>
      </div>

      {/* Keys List */}
      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading API keys...</p>
          </div>
        ) : keys.length === 0 ? (
          <div className="p-8 text-center">
            <Key className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
            <p className="mt-2 text-gray-500 dark:text-gray-400">No API keys yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Create your first API key to get started
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {keys.map((key) => (
              <div key={key.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-gray-100 p-2 dark:bg-gray-700">
                    <Key className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{key.name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <code className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                        {key.key_prefix}...
                      </code>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${scopeColors[key.scope]}`}>
                        {key.scope}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Created {new Date(key.created_at).toLocaleDateString()}
                      {key.last_used_at && (
                        <> &middot; Last used {new Date(key.last_used_at).toLocaleDateString()}</>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => deleteKey(key.id)}
                  className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                  title="Delete key"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-gray-800 mx-4">
            {newKeySecret ? (
              <>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  API Key Created
                </h3>

                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-900/20 mb-4">
                  <div className="flex gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                    <p className="text-sm text-yellow-800 dark:text-yellow-300">
                      Copy your API key now. You won&apos;t be able to see it again!
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    readOnly
                    value={newKeySecret}
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 pr-20 font-mono text-sm dark:border-gray-600 dark:bg-gray-700"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    <button
                      onClick={() => setShowSecret(!showSecret)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => copyToClipboard(newKeySecret)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {copied && (
                  <p className="mt-2 text-sm text-green-600 dark:text-green-400">Copied to clipboard!</p>
                )}

                <button
                  onClick={closeModal}
                  className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Create API Key
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Key Name
                    </label>
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="e.g., Production API"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Scope
                    </label>
                    <select
                      value={newKeyScope}
                      onChange={(e) => setNewKeyScope(e.target.value as 'read' | 'write' | 'admin')}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                    >
                      <option value="read">Read - View agents, trust scores, and records</option>
                      <option value="write">Write - Read + Create/update agents</option>
                      <option value="admin">Admin - Full access including webhooks</option>
                    </select>
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={closeModal}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createKey}
                    disabled={!newKeyName.trim() || creating}
                    className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {creating ? 'Creating...' : 'Create Key'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
