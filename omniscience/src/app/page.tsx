'use client';

import { useState } from 'react';
import { Navbar, HeroSection, NexusChat } from '@/components/nexus';
import { Button } from '@/components/ui/button';
import { BookOpen, Layers, FileCode, Cpu, Shield, Zap } from 'lucide-react';
import Link from 'next/link';

const features = [
  {
    icon: BookOpen,
    title: 'Knowledge Graph',
    description: 'Searchable lexicon of agentic AI concepts with difficulty levels and categories.',
    href: '/lexicon',
    color: 'cyan',
  },
  {
    icon: Layers,
    title: 'Neural Link',
    description: 'Contribute new terms and definitions to expand the knowledge base.',
    href: '/neural',
    color: 'purple',
  },
  {
    icon: FileCode,
    title: 'Documentation',
    description: 'Comprehensive guides on agent architecture, orchestration, and protocols.',
    href: '/docs',
    color: 'orange',
  },
  {
    icon: Cpu,
    title: 'Triad Synthesis',
    description: 'AI-powered answers synthesized from Gemini, Claude, and Grok perspectives.',
    href: '#',
    color: 'green',
  },
];

const ecosystemLinks = [
  {
    icon: Shield,
    title: 'BASIS Standard',
    description: 'Blockchain Agent Standard for Identity and Security',
    href: 'https://basis.vorion.org',
  },
  {
    icon: Zap,
    title: 'AgentAnchor',
    description: 'AI governance platform for certification and trust scoring',
    href: 'https://agentanchor.ai',
  },
  {
    icon: Cpu,
    title: 'Cognigate',
    description: 'Reference implementation of BASIS governance runtime',
    href: 'https://cognigate.dev',
  },
];

export default function HomePage() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <>
      <Navbar onActivateChat={() => setChatOpen(true)} />

      <main className="flex-grow pt-24 pb-12 px-4 max-w-7xl mx-auto w-full">
        <HeroSection />

        {/* Features Grid */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            Explore the Knowledge Base
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map(feature => (
              <Link
                key={feature.title}
                href={feature.href}
                className="glass p-6 rounded-lg hover:bg-white/5 transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-5 h-5 text-cyan-400" />
                </div>
                <h3 className="font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-400">{feature.description}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Ecosystem Links */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            Vorion Ecosystem
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {ecosystemLinks.map(link => (
              <a
                key={link.title}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="glass p-6 rounded-lg hover:bg-white/5 transition-all group border-l-2 border-cyan-500"
              >
                <div className="flex items-center gap-3 mb-3">
                  <link.icon className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-bold text-white">{link.title}</h3>
                </div>
                <p className="text-sm text-gray-400">{link.description}</p>
              </a>
            ))}
          </div>
        </section>

        {/* Quick Start */}
        <section className="mt-16 glass p-8 rounded-xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Ready to explore?
              </h2>
              <p className="text-gray-400">
                Start with the Triad AI assistant or browse the knowledge base directly.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => setChatOpen(true)}
                variant="neon"
                size="lg"
                className="font-mono"
              >
                Activate Triad
              </Button>
              <Link href="/lexicon">
                <Button variant="outline" size="lg">
                  Browse Lexicon
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} Vorion Risk, LLC. Content licensed under CC BY 4.0.
          </p>
          <div className="flex gap-4 text-sm text-gray-500">
            <a href="https://vorion.org" className="hover:text-cyan-400 transition-colors">
              Vorion
            </a>
            <a href="https://basis.vorion.org" className="hover:text-cyan-400 transition-colors">
              BASIS
            </a>
            <a href="https://discord.gg/basis-protocol" className="hover:text-cyan-400 transition-colors">
              Discord
            </a>
            <a href="https://github.com/voriongit" className="hover:text-cyan-400 transition-colors">
              GitHub
            </a>
          </div>
        </div>
      </footer>

      {/* NEXUS Chat */}
      <NexusChat isOpen={chatOpen} onToggle={() => setChatOpen(!chatOpen)} />
    </>
  );
}
