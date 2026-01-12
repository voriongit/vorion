'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import ProfileHeader from '@/components/profile/ProfileHeader'
import RoleBadge from '@/components/profile/RoleBadge'
import TrainerStorefront from '@/components/profile/TrainerStorefront'
import ConsumerPortfolio from '@/components/profile/ConsumerPortfolio'

type Role = 'trainer' | 'consumer' | 'both'

interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: Role
  subscription_tier: string
  storefront_name: string | null
  storefront_bio: string | null
  notification_preferences: {
    email: boolean
    in_app: boolean
    webhook: boolean
    webhook_url?: string
  }
  created_at: string
  updated_at: string
}

export default function ProfileSettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<Role>('consumer')

  const supabase = createClientComponentClient()

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/profile')
      if (!response.ok) {
        throw new Error('Failed to fetch profile')
      }
      const data = await response.json()
      const profileData = {
        ...data.profile,
        role: data.profile.role || 'consumer',
        subscription_tier: data.profile.subscription_tier || 'free',
        notification_preferences: data.profile.notification_preferences || { email: true, in_app: true, webhook: false }
      }
      setProfile(profileData)
      setFullName(profileData.full_name || '')
      setRole(profileData.role)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile')
    } finally {
      setIsLoading(false)
    }
  }

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
          fullName,
          role,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error?.message || 'Failed to save profile')
      }

      const data = await response.json()
      setProfile(data.profile)
      setSuccess('Profile saved successfully!')

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
        Failed to load profile. Please try refreshing the page.
      </div>
    )
  }

  const showTrainerSection = role === 'trainer' || role === 'both'
  const showConsumerSection = role === 'consumer' || role === 'both'

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <ProfileHeader profile={profile} />

      {/* Alerts */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400">
          {success}
        </div>
      )}

      {/* Basic Info Form */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          Basic Information
        </h2>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Email (readonly) */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Email
            </label>
            <input
              type="email"
              value={profile.email}
              disabled
              className="w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Contact support to change your email address
            </p>
          </div>

          {/* Full Name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Role Selection */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Account Role
            </label>
            <div className="flex items-center gap-2">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="consumer">Consumer - Browse & acquire agents</option>
                <option value="trainer">Trainer - Create & train agents</option>
                <option value="both">Both - Full platform access</option>
              </select>
              <RoleBadge role={role} />
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Your role determines which features are available to you
            </p>
          </div>

          {/* Subscription Tier (readonly) */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Subscription Tier
            </label>
            <div className="flex items-center gap-2">
              <span className="rounded-md border border-gray-300 bg-gray-100 px-3 py-2 capitalize text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300">
                {profile.subscription_tier}
              </span>
              <a
                href="/settings/billing"
                className="text-sm text-blue-600 hover:underline dark:text-blue-400"
              >
                Upgrade
              </a>
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Role-specific sections */}
      {showTrainerSection && (
        <TrainerStorefront
          profile={profile}
          onUpdate={(updatedProfile) => setProfile(updatedProfile)}
        />
      )}

      {showConsumerSection && (
        <ConsumerPortfolio profile={profile} />
      )}
    </div>
  )
}
