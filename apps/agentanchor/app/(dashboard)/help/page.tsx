import { Metadata } from 'next'
import { HelpCircle } from 'lucide-react'
import ComingSoonPage from '@/components/navigation/ComingSoonPage'

export const metadata: Metadata = {
  title: 'Help - AgentAnchor',
  description: 'Get help with AgentAnchor',
}

export default function HelpPage() {
  return (
    <ComingSoonPage
      title="Help Center"
      description="Find answers to your questions and learn how to get the most out of AgentAnchor."
      icon={HelpCircle}
      features={[
        'Comprehensive documentation',
        'Getting started guides',
        'Video tutorials',
        'Community support forums',
      ]}
    />
  )
}
