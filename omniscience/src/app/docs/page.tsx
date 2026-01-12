'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Navbar, NexusChat } from '@/components/nexus';
import { BookOpen, Cpu, Network, Shield, Layers, Zap, GraduationCap, FileCode } from 'lucide-react';

const docCategories = [
  {
    title: 'Agent Taxonomy',
    description: 'Classification of agent types from simple reflex to BDI agents',
    icon: Layers,
    href: '/docs/taxonomy',
    articles: ['Simple Reflex', 'Model-Based', 'Goal-Based', 'Utility-Based', 'Learning Agents', 'BDI Agents'],
  },
  {
    title: 'Cognitive Architecture',
    description: 'Internal structures enabling agent reasoning and action',
    icon: Cpu,
    href: '/docs/architecture',
    articles: ['ReAct Pattern', 'Memory Systems', 'Planning Engines', 'Tool Use', 'Neuro-Symbolic'],
  },
  {
    title: 'Orchestration',
    description: 'Multi-agent coordination patterns and protocols',
    icon: Network,
    href: '/docs/orchestration',
    articles: ['Hierarchical', 'Swarm Intelligence', 'Event-Driven', 'Multi-Agent Debate', 'Consensus'],
  },
  {
    title: 'Protocols',
    description: 'Standards for agent communication and identity',
    icon: FileCode,
    href: '/docs/protocols',
    articles: ['MCP', 'A2A', 'Agent Identity (DID)', 'BASIS Standard'],
  },
  {
    title: 'Safety & Governance',
    description: 'Trust, oversight, and accountability mechanisms',
    icon: Shield,
    href: '/docs/safety',
    articles: ['Trust Scoring (ATSF)', 'Capability Gating', 'Audit Trails', 'Human Oversight'],
  },
  {
    title: 'Domain Applications',
    description: 'Real-world use cases for agentic AI',
    icon: Zap,
    href: '/docs/domains',
    articles: ['Software Engineering', 'Scientific Research', 'Finance & Trading', 'Enterprise Automation'],
  },
  {
    title: 'Evolution & Learning',
    description: 'How agents improve over time',
    icon: GraduationCap,
    href: '/docs/evolution',
    articles: ['Seeding & Initialization', 'Evolutionary Optimization', 'Memetic Learning', 'Self-Improvement'],
  },
  {
    title: 'SDK Reference',
    description: 'AgentAnchor and BASIS SDK documentation',
    icon: BookOpen,
    href: '/docs/sdk',
    articles: ['@basis-protocol/core', '@agentanchor/sdk', '@agentanchor/react', 'Cognigate API'],
  },
];

export default function DocsPage() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <>
      <Navbar onActivateChat={() => setChatOpen(true)} />
      <main className="flex-grow pt-24 pb-12 px-4 max-w-7xl mx-auto w-full">
        <div className="fade-in">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Documentation</h1>
            <p className="text-gray-400">
              Comprehensive guides on autonomous AI agents, multi-agent systems, and the Vorion ecosystem.
            </p>
          </div>

          {/* Categories Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {docCategories.map(category => (
              <div
                key={category.title}
                className="glass p-6 rounded-xl hover:bg-white/5 transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-cyan-900/30 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                    <category.icon className="w-6 h-6 text-cyan-400" />
                  </div>
                  <div className="flex-grow">
                    <h2 className="text-lg font-bold text-white mb-1 group-hover:text-cyan-400 transition-colors">
                      {category.title}
                    </h2>
                    <p className="text-sm text-gray-400 mb-3">{category.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {category.articles.map(article => (
                        <span
                          key={article}
                          className="text-xs px-2 py-0.5 bg-gray-800 text-gray-500 rounded hover:text-cyan-400 cursor-pointer transition-colors"
                        >
                          {article}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Links */}
          <div className="mt-12 glass p-6 rounded-xl">
            <h3 className="text-lg font-bold text-white mb-4">Quick Links</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link
                href="/docs/protocols/basis"
                className="p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors text-center"
              >
                <div className="text-2xl mb-1">🔗</div>
                <div className="text-sm text-white">BASIS Standard</div>
              </Link>
              <Link
                href="/docs/sdk/agentanchor"
                className="p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors text-center"
              >
                <div className="text-2xl mb-1">📦</div>
                <div className="text-sm text-white">SDK Quickstart</div>
              </Link>
              <Link
                href="/docs/safety/trust-scoring"
                className="p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors text-center"
              >
                <div className="text-2xl mb-1">🛡️</div>
                <div className="text-sm text-white">Trust Scoring</div>
              </Link>
              <Link
                href="/lexicon"
                className="p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors text-center"
              >
                <div className="text-2xl mb-1">📖</div>
                <div className="text-sm text-white">Glossary</div>
              </Link>
            </div>
          </div>
        </div>
      </main>
      <NexusChat isOpen={chatOpen} onToggle={() => setChatOpen(!chatOpen)} />
    </>
  );
}
