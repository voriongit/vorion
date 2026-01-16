import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { Providers } from '@/components/Providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Omniscience | The Agentic AI Knowledge Base',
  description: 'Comprehensive documentation covering autonomous AI agents, multi-agent systems, governance protocols, and the Vorion ecosystem.',
  keywords: ['AI agents', 'agentic AI', 'BASIS', 'AgentAnchor', 'Cognigate', 'Vorion', 'AI governance'],
  authors: [{ name: 'Vorion' }],
  openGraph: {
    title: 'Omniscience | The Agentic AI Knowledge Base',
    description: 'Comprehensive documentation for autonomous AI agents and governance protocols.',
    type: 'website',
    url: 'https://learn.vorion.org',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Omniscience',
    description: 'The Agentic AI Knowledge Base',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
        {/* Background Grid */}
        <div
          className="fixed inset-0 z-0 opacity-10 pointer-events-none grid-bg"
          aria-hidden="true"
        />

        {/* Main content */}
        <div className="relative z-10 min-h-screen flex flex-col">
          <Providers>
            {children}
          </Providers>
        </div>
        <Analytics />
      </body>
    </html>
  );
}
