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
    category: 'core',
    articles: [
      { name: 'Agent', slug: 'agent' },
      { name: 'Agentic AI', slug: 'agentic-ai' },
      { name: 'Multi-Agent Systems', slug: 'multi-agent-systems' },
      { name: 'Tool Use', slug: 'tool-use' },
      { name: 'Autonomous Agent', slug: 'autonomous-agent' },
    ],
  },
  {
    title: 'Cognitive Architecture',
    description: 'Internal structures enabling agent reasoning and action',
    icon: Cpu,
    category: 'architecture',
    articles: [
      { name: 'ReAct Pattern', slug: 'react' },
      { name: 'Chain of Thought', slug: 'chain-of-thought' },
      { name: 'Memory Systems', slug: 'memory' },
      { name: 'Inference Scaling', slug: 'inference-scaling' },
      { name: 'Mixture of Experts', slug: 'mixture-of-experts' },
    ],
  },
  {
    title: 'Orchestration',
    description: 'Multi-agent coordination patterns and protocols',
    icon: Network,
    category: 'orchestration',
    articles: [
      { name: 'Agent Orchestration', slug: 'agent-orchestration' },
      { name: 'Multi-Agent Debate', slug: 'multi-agent-debate' },
      { name: 'Swarm Intelligence', slug: 'swarm-intelligence' },
      { name: 'Hierarchical Agents', slug: 'hierarchical-agents' },
    ],
  },
  {
    title: 'Protocols & Standards',
    description: 'Standards for agent communication and identity',
    icon: FileCode,
    category: 'protocols',
    articles: [
      { name: 'Model Context Protocol', slug: 'model-context-protocol' },
      { name: 'Agent-to-Agent (A2A)', slug: 'agent-to-agent-protocol' },
      { name: 'EU AI Act', slug: 'eu-ai-act' },
      { name: 'NIST AI RMF', slug: 'nist-ai-rmf' },
    ],
  },
  {
    title: 'Safety & Governance',
    description: 'Trust, oversight, and accountability mechanisms',
    icon: Shield,
    category: 'safety',
    articles: [
      { name: 'AI Red Teaming', slug: 'ai-red-teaming' },
      { name: 'Deceptive Alignment', slug: 'deceptive-alignment' },
      { name: 'Human-in-the-Loop', slug: 'human-in-the-loop' },
      { name: 'Kill Switch', slug: 'kill-switch' },
      { name: 'Corrigibility', slug: 'corrigibility' },
    ],
  },
  {
    title: 'Modern AI Concepts',
    description: 'Current trends and terminology in AI',
    icon: Zap,
    category: 'techniques',
    articles: [
      { name: 'Ralph Wiggum Theory', slug: 'ralph-wiggum-theory' },
      { name: 'Vibe Coding', slug: 'vibe-coding' },
      { name: 'AI Slop', slug: 'ai-slop' },
      { name: 'Model Collapse', slug: 'model-collapse' },
      { name: 'Deepseek', slug: 'deepseek' },
    ],
  },
  {
    title: 'Compliance & Regulation',
    description: 'Laws, frameworks, and compliance requirements',
    icon: GraduationCap,
    category: 'ethics',
    articles: [
      { name: 'EU AI Act', slug: 'eu-ai-act' },
      { name: 'Executive Order 14110', slug: 'executive-order-14110' },
      { name: 'Algorithmic Impact Assessment', slug: 'algorithmic-impact-assessment' },
      { name: 'Model Cards', slug: 'model-cards' },
    ],
  },
  {
    title: 'Red Team & Testing',
    description: 'Adversarial testing and deception detection',
    icon: BookOpen,
    category: 'safety',
    articles: [
      { name: 'Sandboxing', slug: 'sandboxing' },
      { name: 'Honeypot Testing', slug: 'honeypot-testing' },
      { name: 'Behavioral Consistency', slug: 'behavioral-consistency-testing' },
      { name: 'Jailbreaking', slug: 'jailbreaking' },
    ],
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
                        <Link
                          key={article.slug}
                          href={`/lexicon/${article.slug}`}
                          className="text-xs px-2 py-0.5 bg-gray-800 text-gray-500 rounded hover:text-cyan-400 hover:bg-gray-700 transition-colors"
                        >
                          {article.name}
                        </Link>
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
                href="/lexicon/constitutional-ai"
                className="p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors text-center"
              >
                <div className="text-2xl mb-1">🔗</div>
                <div className="text-sm text-white">Constitutional AI</div>
              </Link>
              <Link
                href="/lexicon/ai-red-teaming"
                className="p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors text-center"
              >
                <div className="text-2xl mb-1">🎯</div>
                <div className="text-sm text-white">Red Teaming</div>
              </Link>
              <Link
                href="/lexicon/eu-ai-act"
                className="p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors text-center"
              >
                <div className="text-2xl mb-1">🛡️</div>
                <div className="text-sm text-white">EU AI Act</div>
              </Link>
              <Link
                href="/lexicon"
                className="p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors text-center"
              >
                <div className="text-2xl mb-1">📖</div>
                <div className="text-sm text-white">Full Glossary</div>
              </Link>
            </div>
          </div>
        </div>
      </main>
      <NexusChat isOpen={chatOpen} onToggle={() => setChatOpen(!chatOpen)} />
    </>
  );
}
