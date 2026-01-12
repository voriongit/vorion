import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Authentication - AgentAnchor',
  description: 'Sign in or create an account for AgentAnchor AI Governance Platform',
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {children}
    </div>
  )
}
