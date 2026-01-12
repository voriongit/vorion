import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Welcome to AgentAnchor',
  description: 'Complete your profile setup to get started with AI governance',
}

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Progress indicator */}
        <div className="mb-8 flex justify-center">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs text-white">
              1
            </span>
            <span className="font-medium text-blue-600 dark:text-blue-400">Choose your role</span>
            <span className="mx-2">→</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-300 text-xs dark:bg-gray-600">
              2
            </span>
            <span>Complete profile</span>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
