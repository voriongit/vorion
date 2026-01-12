import { Metadata } from 'next'
import { Briefcase } from 'lucide-react'
import ComingSoonPage from '@/components/navigation/ComingSoonPage'

export const metadata: Metadata = {
  title: 'Portfolio - AgentAnchor',
  description: 'Your agent portfolio',
}

export default function PortfolioPage() {
  return (
    <ComingSoonPage
      title="Portfolio"
      description="View and manage all the agents you've acquired from the marketplace."
      icon={Briefcase}
      features={[
        'All your acquired agents in one place',
        'Trust score monitoring for each agent',
        'Usage statistics and history',
        'Agent configuration and customization',
      ]}
    />
  )
}
