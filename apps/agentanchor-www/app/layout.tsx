import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AgentAnchor - AI Governance Platform',
  description: 'Enterprise AI governance infrastructure. Deploy AI agents you can trust with real-time trust scoring, capability gating, and immutable audit trails.',
  keywords: ['AI governance', 'AI agents', 'trust scoring', 'AI accountability', 'AI compliance', 'agent governance', 'AI safety', 'enterprise AI'],
  authors: [{ name: 'AgentAnchor Team' }],
  openGraph: {
    title: 'AgentAnchor - AI Governance Platform',
    description: 'Enterprise AI governance infrastructure. Real-time trust scoring, capability gating, and immutable audit trails.',
    url: 'https://agentanchorai.com',
    siteName: 'AgentAnchor',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AgentAnchor - AI Governance Platform',
    description: 'Governance infrastructure for autonomous AI agents.',
    creator: '@agentanchor',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#05050a] text-gray-200 antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
