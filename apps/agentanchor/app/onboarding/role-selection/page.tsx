'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

type Role = 'trainer' | 'consumer' | 'both'

const roleOptions: Array<{
  id: Role
  title: string
  description: string
  icon: JSX.Element
  benefits: string[]
}> = [
  {
    id: 'trainer',
    title: 'Agent Trainer',
    description: 'Create, train, and monetize AI agents through the Academy',
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    benefits: [
      'Create and train AI agents',
      'Earn through agent commissions',
      'Build your storefront profile',
      'Access Academy training tools',
    ],
  },
  {
    id: 'consumer',
    title: 'Agent Consumer',
    description: 'Discover, acquire, and deploy governed AI agents for your needs',
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    ),
    benefits: [
      'Browse the agent marketplace',
      'Commission custom agents',
      'Track agent usage & trust',
      'Full audit trail access',
    ],
  },
  {
    id: 'both',
    title: 'Trainer & Consumer',
    description: 'Full platform access - create agents and use others',
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
      </svg>
    ),
    benefits: [
      'All Trainer benefits',
      'All Consumer benefits',
      'Cross-role collaboration',
      'Maximum flexibility',
    ],
  },
]

export default function RoleSelectionPage() {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClientComponentClient()

  const handleContinue = async () => {
    if (!selectedRole) return

    setIsLoading(true)
    setError(null)

    try {
      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        setError('Please sign in to continue')
        router.push('/auth/login')
        return
      }

      // Update profile via API
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: selectedRole,
          onboardingCompleted: true,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error?.message || 'Failed to save role')
      }

      // Redirect to dashboard
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          How will you use AgentAnchor?
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Choose your primary role. You can change this later in settings.
        </p>
      </div>

      {error && (
        <div className="mb-6 w-full max-w-3xl rounded-lg bg-red-50 p-4 text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid w-full max-w-4xl gap-6 md:grid-cols-3">
        {roleOptions.map((role) => (
          <button
            key={role.id}
            onClick={() => setSelectedRole(role.id)}
            className={`group relative flex flex-col rounded-xl border-2 p-6 text-left transition-all ${
              selectedRole === role.id
                ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600 dark:bg-blue-900/20'
                : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600'
            }`}
          >
            {/* Selection indicator */}
            <div
              className={`absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${
                selectedRole === role.id
                  ? 'border-blue-600 bg-blue-600'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              {selectedRole === role.id && (
                <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>

            {/* Icon */}
            <div
              className={`mb-4 flex h-14 w-14 items-center justify-center rounded-lg ${
                selectedRole === role.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              {role.icon}
            </div>

            {/* Title & Description */}
            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
              {role.title}
            </h3>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              {role.description}
            </p>

            {/* Benefits list */}
            <ul className="mt-auto space-y-2">
              {role.benefits.map((benefit, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400"
                >
                  <svg
                    className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                      selectedRole === role.id ? 'text-blue-600' : 'text-green-500'
                    }`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {benefit}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>

      {/* Continue button */}
      <div className="mt-8 w-full max-w-4xl">
        <button
          onClick={handleContinue}
          disabled={!selectedRole || isLoading}
          className={`w-full rounded-lg px-6 py-3 font-semibold text-white transition-colors ${
            selectedRole && !isLoading
              ? 'bg-blue-600 hover:bg-blue-700'
              : 'cursor-not-allowed bg-gray-400'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
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
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Saving...
            </span>
          ) : (
            'Continue to Dashboard'
          )}
        </button>

        <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
          You can change your role anytime from your profile settings
        </p>
      </div>
    </div>
  )
}
