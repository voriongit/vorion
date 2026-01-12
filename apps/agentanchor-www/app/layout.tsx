import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AgentAnchor - The A3I Operating System',
  description: 'The world\'s first AI Governance Operating System. Deploy AI agents you can trust with enterprise-grade governance, real-time safety controls, and immutable accountability.',
  keywords: ['AI governance', 'AI agents', 'trust score', 'AI accountability', 'AI transparency', 'agent training', 'A3I-OS', 'AI safety'],
  authors: [{ name: 'AgentAnchor Team' }],
  openGraph: {
    title: 'AgentAnchor - The A3I Operating System',
    description: 'Deploy AI agents you can trust. Enterprise-grade governance, real-time safety controls, and immutable accountability.',
    url: 'https://agentanchorai.com',
    siteName: 'AgentAnchor',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AgentAnchor - The A3I Operating System',
    description: 'Agents you can anchor to.',
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
      <body className={`${inter.className} bg-white text-gray-900 antialiased`}>
        {children}
      </body>
    </html>
  )
}
