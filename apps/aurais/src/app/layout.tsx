import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Aurais - Trust-Verified AI Agents',
  description: 'Deploy AI agents with confidence. Aurais provides trust-verified agents backed by AgentAnchor certification.',
  keywords: ['AI agents', 'trust', 'governance', 'automation', 'certified agents'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-aurais-dark text-white antialiased">
        {children}
      </body>
    </html>
  )
}
