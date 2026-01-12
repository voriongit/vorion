import { Metadata } from 'next'
import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import AppShell from '@/components/navigation/AppShell'
import { type UserRole } from '@/lib/navigation/menu-items'

// Dashboard routes require auth cookies - force dynamic rendering
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'AgentAnchor - AI Governance Platform',
  description: 'Govern, train, and deploy trusted AI agents',
}

async function getUserRole(): Promise<UserRole> {
  const supabase = createServerComponentClient({ cookies })

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return 'consumer'
  }

  // Query full profile - role column may not exist in all deployments
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Safely extract role, defaulting to 'consumer' if column doesn't exist
  const role = profile?.role as UserRole | undefined
  return role || 'consumer'
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const userRole = await getUserRole()

  return <AppShell userRole={userRole}>{children}</AppShell>
}
