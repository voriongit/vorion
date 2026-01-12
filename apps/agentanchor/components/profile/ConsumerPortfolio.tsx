'use client'

interface Profile {
  id: string
  role: 'trainer' | 'consumer' | 'both'
  subscription_tier: string
}

interface ConsumerPortfolioProps {
  profile: Profile
}

export default function ConsumerPortfolio({ profile }: ConsumerPortfolioProps) {
  // TODO: Fetch actual agent data from API
  const agents: Array<{
    id: string
    name: string
    trustScore: number
    status: string
    lastUsed: string
  }> = []

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex items-center gap-2">
        <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Agent Portfolio
        </h2>
      </div>

      <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        Manage and monitor your acquired AI agents. Track their trust scores and usage.
      </p>

      {/* Stats Overview */}
      <div className="mb-6 rounded-lg bg-gray-50 p-4 dark:bg-gray-700/50">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {agents.length}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Agents</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">0</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Active</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">0</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">API Calls Today</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">--</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Avg Trust Score</p>
          </div>
        </div>
      </div>

      {/* Agent List */}
      {agents.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center dark:border-gray-600">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
            No agents yet
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Browse the marketplace to find and acquire AI agents for your needs.
          </p>
          <a
            href="/marketplace"
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            Browse Marketplace
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-700"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">{agent.name}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Last used: {agent.lastUsed}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Trust: {agent.trustScore}/1000
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{agent.status}</p>
                </div>
                <a
                  href={`/agents/${agent.id}`}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  View
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Usage Limits */}
      <div className="mt-6 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          Usage Limits ({profile.subscription_tier} tier)
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Monthly API Calls</span>
            <span className="font-medium text-gray-900 dark:text-white">
              0 / {profile.subscription_tier === 'free' ? '1,000' : profile.subscription_tier === 'pro' ? '50,000' : 'Unlimited'}
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
            <div className="h-2 w-0 rounded-full bg-blue-600" />
          </div>
        </div>
      </div>
    </div>
  )
}
