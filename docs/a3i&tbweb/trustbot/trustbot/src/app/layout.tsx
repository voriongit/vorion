import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'TrustBot - AI Assistant with Verifiable Governance',
  description: 'An AI assistant that shows you exactly what it can and cannot do, with trust-gated capabilities powered by BASIS.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-[#0a0a1a] min-h-screen`}>
        {children}
      </body>
    </html>
  )
}
