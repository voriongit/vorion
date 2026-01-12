import { Metadata } from 'next'
import { Briefcase } from 'lucide-react'
import ComingSoonPage from '@/components/navigation/ComingSoonPage'

export const metadata: Metadata = {
  title: 'Storefront - AgentAnchor',
  description: 'Manage your trainer storefront',
}

export default function StorefrontPage() {
  return (
    <ComingSoonPage
      title="Storefront"
      description="Manage your public trainer profile and showcase your agents to potential customers."
      icon={Briefcase}
      features={[
        'Customize your public storefront',
        'Showcase your best agents',
        'Manage customer inquiries',
        'Track storefront analytics',
      ]}
    />
  )
}
