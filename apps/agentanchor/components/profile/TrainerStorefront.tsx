'use client'

import { useState } from 'react'

interface TrainerStorefrontProps {
  profile: {
    id: string
    storefront_name: string | null
    storefront_bio: string | null
    role: 'trainer' | 'consumer' | 'both'
  }
  onUpdate: (profile: any) => void
}

export default function TrainerStorefront({ profile, onUpdate }: TrainerStorefrontProps) {
  const [storefrontName, setStorefrontName] = useState(profile.storefront_name || '')
  const [storefrontBio, setStorefrontBio] = useState(profile.storefront_bio || '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storefrontName: storefrontName || null,
          storefrontBio: storefrontBio || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error?.message || 'Failed to save storefront')
      }

      const data = await response.json()
      onUpdate(data.profile)
      setSuccess('Storefront settings saved!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex items-center gap-2">
        <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Trainer Storefront
        </h2>
      </div>

      <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        Configure your public storefront where consumers can discover and commission your agents.
      </p>

      {/* Alerts */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400">
          {success}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        {/* Storefront Name */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Storefront Name
          </label>
          <input
            type="text"
            value={storefrontName}
            onChange={(e) => setStorefrontName(e.target.value)}
            placeholder="e.g., AI Solutions by John"
            maxLength={100}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            This name will be displayed on your public storefront
          </p>
        </div>

        {/* Storefront Bio */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Storefront Bio
          </label>
          <textarea
            value={storefrontBio}
            onChange={(e) => setStorefrontBio(e.target.value)}
            placeholder="Tell potential customers about your expertise and the types of agents you create..."
            maxLength={500}
            rows={4}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {storefrontBio.length}/500 characters
          </p>
        </div>

        {/* Stats Preview */}
        <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700/50">
          <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
            Storefront Stats (Coming Soon)
          </h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">0</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Agents Created</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">0</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Sales</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">--</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Avg. Rating</p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-md bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save Storefront Settings'}
        </button>
      </form>
    </div>
  )
}
