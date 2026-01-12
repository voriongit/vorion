'use client'

import { useState } from 'react'
import RoleBadge from './RoleBadge'

interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: 'trainer' | 'consumer' | 'both'
  subscription_tier: string
  created_at: string
}

interface ProfileHeaderProps {
  profile: Profile
}

export default function ProfileHeader({ profile }: ProfileHeaderProps) {
  const [isUploading, setIsUploading] = useState(false)

  // Generate initials for avatar fallback
  const initials = profile.full_name
    ? profile.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : profile.email[0].toUpperCase()

  const memberSince = new Date(profile.created_at).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // TODO: Implement avatar upload to Supabase Storage
    setIsUploading(true)
    try {
      // Placeholder for future implementation
      console.log('Avatar upload:', file.name)
      await new Promise((resolve) => setTimeout(resolve, 1000))
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start gap-6">
        {/* Avatar */}
        <div className="relative">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-2xl font-bold text-white">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name || 'User'}
                className="h-full w-full object-cover"
              />
            ) : (
              initials
            )}
          </div>
          <label className="absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-colors hover:bg-blue-700">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
              disabled={isUploading}
            />
            {isUploading ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            )}
          </label>
        </div>

        {/* Info */}
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {profile.full_name || 'Anonymous User'}
            </h2>
            <RoleBadge role={profile.role} />
          </div>
          <p className="mt-1 text-gray-600 dark:text-gray-400">{profile.email}</p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
            Member since {memberSince}
          </p>
        </div>
      </div>
    </div>
  )
}
