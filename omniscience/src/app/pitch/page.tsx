'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Shield,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle,
  Send,
  ArrowRight,
  BarChart3,
  Users,
  FileCheck,
  Zap,
  ExternalLink,
  ChevronDown,
  Package,
  TestTube,
  BookOpen,
  MessageCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// TrustBot Types
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  governance?: GovernanceInfo;
}

interface GovernanceInfo {
  decision: 'ALLOW' | 'DENY' | 'ESCALATE' | 'DEGRADE';
  trustScore: number;
  capabilitiesUsed: string[];
  capabilitiesDenied?: string[];
  proofId?: string;
}

export default function PitchPage() {
  const [showDemo, setShowDemo] = useState(false);

  return (
    <div className="min-h-screen bg-[#05050a]">
      {/* Simple Header */}
      <header className="border-b border-gray-800 bg-[#05050a]/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/vorion.png" alt="Vorion" width={32} height={32} />
            <span className="font-bold text-white">VORION</span>
          </Link>
          <div className="flex items-center gap-4">
            <a
              href="https://discord.gg/basis-protocol"
              target="_blank"
              className="text-sm text-gray-400 hover:text-cyan-400 transition-colors flex items-center gap-1"
            >
              <MessageCircle className="w-4 h-4" />
              Discord
            </a>
            <a
              href="https://npmjs.com/package/atsf-core"
              target="_blank"
              className="text-sm text-gray-400 hover:text-cyan-400 transition-colors flex items-center gap-1"
            >
              <Package className="w-4 h-4" />
              npm
            </a>
            <a
              href="https://github.com/voriongit/vorion"
              target="_blank"
              className="text-sm text-gray-400 hover:text-cyan-400 transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5" />
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-sm mb-8">
            <Shield className="w-4 h-4" />
            Enterprise AI Governance
          </div>

          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Trust Scoring for<br />
            <span className="neon-text-blue">AI Agents</span>
          </h1>

          <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-10">
            The Agentic Trust Scoring Framework (ATSF) provides real-time governance
            for AI agents with verifiable trust levels, capability gating, and
            immutable audit trails.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#inquire">
              <Button variant="neon" size="lg" className="font-mono">
                Inquire Now
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </a>
            <Button
              variant="outline"
              size="lg"
              onClick={() => setShowDemo(true)}
            >
              Try Live Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Problem Statement */}
      <section className="py-16 px-6 border-t border-gray-800">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">
            The Challenge
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="glass p-6 rounded-xl border-l-4 border-red-500">
              <AlertTriangle className="w-8 h-8 text-red-400 mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">Ungoverned Agents</h3>
              <p className="text-gray-400 text-sm">
                AI agents today operate without trust boundaries, making unrestricted
                decisions with no accountability.
              </p>
            </div>
            <div className="glass p-6 rounded-xl border-l-4 border-yellow-500">
              <Lock className="w-8 h-8 text-yellow-400 mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">No Audit Trail</h3>
              <p className="text-gray-400 text-sm">
                Enterprises can't prove what AI did, when it did it, or why -
                a compliance nightmare waiting to happen.
              </p>
            </div>
            <div className="glass p-6 rounded-xl border-l-4 border-orange-500">
              <Users className="w-8 h-8 text-orange-400 mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">Trust Vacuum</h3>
              <p className="text-gray-400 text-sm">
                No standard way to measure, verify, or communicate how much
                trust an AI agent has earned.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Overview */}
      <section className="py-16 px-6 bg-gradient-to-b from-transparent to-cyan-500/5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-4 text-center">
            The ATSF Solution
          </h2>
          <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
            A comprehensive trust infrastructure that gives enterprises visibility,
            control, and accountability over AI agent behavior.
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="glass p-8 rounded-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-cyan-400" />
                </div>
                <h3 className="text-xl font-bold text-white">Trust Scoring</h3>
              </div>
              <p className="text-gray-400 mb-4">
                0-1000 credit-score model with 6 discrete tiers (L0-L5).
                Weighted across behavioral, compliance, identity, and context dimensions.
              </p>
              <div className="flex gap-2 flex-wrap">
                <span className="px-2 py-1 bg-green-500/10 text-green-400 rounded text-xs">L5: Certified</span>
                <span className="px-2 py-1 bg-cyan-500/10 text-cyan-400 rounded text-xs">L4: Trusted</span>
                <span className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-xs">L3: Standard</span>
              </div>
            </div>

            <div className="glass p-8 rounded-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="text-xl font-bold text-white">Capability Gating</h3>
              </div>
              <p className="text-gray-400 mb-4">
                Every action is checked against trust level. Insufficient trust?
                Request denied, escalated, or degraded automatically.
              </p>
              <div className="flex gap-2 flex-wrap">
                <span className="px-2 py-1 bg-green-500/10 text-green-400 rounded text-xs">ALLOW</span>
                <span className="px-2 py-1 bg-red-500/10 text-red-400 rounded text-xs">DENY</span>
                <span className="px-2 py-1 bg-yellow-500/10 text-yellow-400 rounded text-xs">ESCALATE</span>
                <span className="px-2 py-1 bg-orange-500/10 text-orange-400 rounded text-xs">DEGRADE</span>
              </div>
            </div>

            <div className="glass p-8 rounded-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <FileCheck className="w-6 h-6 text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-white">Proof Chain</h3>
              </div>
              <p className="text-gray-400 mb-4">
                SHA-256 hashed audit trail with cryptographic verification.
                Every decision is provable, every action is traceable.
              </p>
              <code className="text-xs text-cyan-400 bg-gray-900 px-3 py-2 rounded block font-mono">
                prf_a7b2c9d4e5f6...
              </code>
            </div>

            <div className="glass p-8 rounded-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-orange-400" />
                </div>
                <h3 className="text-xl font-bold text-white">Decay by Design</h3>
              </div>
              <p className="text-gray-400 mb-4">
                Trust isn't permanent. Scores decay over time, with 3x accelerated
                decay after failures. Continuous good behavior required.
              </p>
              <div className="text-xs text-gray-500">
                7-day half-life | 3x failure multiplier | Real-time updates
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Video Demo Section */}
      <section className="py-16 px-6 border-t border-gray-800 bg-gradient-to-b from-purple-500/5 to-transparent">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Watch How It Works
          </h2>
          <p className="text-gray-400 mb-8">
            See ATSF in action - from integration to real-time governance decisions.
          </p>
          <div className="aspect-video bg-gray-900 rounded-xl border border-gray-800 flex items-center justify-center group cursor-pointer hover:border-cyan-500/50 transition-colors">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto rounded-full bg-cyan-500/20 flex items-center justify-center mb-4 group-hover:bg-cyan-500/30 transition-colors">
                <svg className="w-8 h-8 text-cyan-400 ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
              <p className="text-gray-500 text-sm">Demo video coming soon</p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Demo Section */}
      <section className="py-16 px-6 border-t border-gray-800">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-4 text-center">
            Try It Yourself
          </h2>
          <p className="text-gray-400 text-center mb-8">
            TrustBot demonstrates real-time governance decisions. Try asking about payments vs. scheduling.
          </p>

          <TrustBotDemo />
        </div>
      </section>

      {/* Key Metrics */}
      <section className="py-16 px-6 bg-gradient-to-t from-transparent to-purple-500/5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-12 text-center">
            Production Ready
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <MetricCard icon={Package} value="npm" label="Published" color="cyan" />
            <MetricCard icon={TestTube} value="80+" label="Tests Passing" color="green" />
            <MetricCard icon={Zap} value="<10ms" label="Scoring Latency" color="orange" />
            <MetricCard icon={BookOpen} value="Full" label="PRD & Arch" color="purple" />
          </div>
        </div>
      </section>

      {/* Framework Integration */}
      <section className="py-16 px-6 border-t border-gray-800">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Works With Your Stack
          </h2>
          <p className="text-gray-400 mb-8">
            Callback-based integration means no architectural changes required.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <span className="px-4 py-2 glass rounded-lg text-gray-300">LangChain</span>
            <span className="px-4 py-2 glass rounded-lg text-gray-300">CrewAI</span>
            <span className="px-4 py-2 glass rounded-lg text-gray-300">AutoGen</span>
            <span className="px-4 py-2 glass rounded-lg text-gray-300">Custom Agents</span>
          </div>
          <div className="mt-8 glass p-6 rounded-xl max-w-2xl mx-auto text-left">
            <pre className="text-sm text-gray-300 overflow-x-auto">
              <code>{`import { createTrustEngine } from 'atsf-core';

const engine = createTrustEngine();
await engine.initializeEntity('agent-001', 2);

// Your existing code - unchanged
const callback = engine.createCallback('agent-001');
await agent.invoke(input, { callbacks: [callback] });`}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* CTA Section with Contact Form */}
      <section id="inquire" className="py-20 px-6 border-t border-gray-800 scroll-mt-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-4">
              Let's Talk
            </h2>
            <p className="text-gray-400">
              Interested in AI governance for your organization?
              Tell us about your needs and we'll be in touch.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <ContactForm />

            <div className="flex flex-col justify-center space-y-4">
              <div className="glass p-5 rounded-xl">
                <h3 className="font-bold text-white mb-2">Join the Community</h3>
                <p className="text-sm text-gray-400 mb-3">
                  Chat with us and other developers building with ATSF.
                </p>
                <a href="https://discord.gg/basis-protocol" target="_blank">
                  <Button variant="neon" size="sm" className="w-full">
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Join Discord
                  </Button>
                </a>
              </div>

              <div className="glass p-5 rounded-xl">
                <h3 className="font-bold text-white mb-2">Open Source</h3>
                <p className="text-sm text-gray-400 mb-3">
                  View source, contribute, or fork for your needs.
                </p>
                <a href="https://github.com/voriongit/vorion" target="_blank">
                  <Button variant="outline" size="sm" className="w-full">
                    View on GitHub
                    <ExternalLink className="w-3 h-3 ml-2" />
                  </Button>
                </a>
              </div>

              <div className="glass p-5 rounded-xl">
                <h3 className="font-bold text-white mb-2">Get Started</h3>
                <code className="block text-xs text-cyan-400 bg-gray-900 px-3 py-2 rounded font-mono">
                  npm install atsf-core
                </code>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 px-6">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <p className="text-sm text-gray-500">
            &copy; 2026 Vorion Risk, LLC
          </p>
          <div className="flex gap-4 text-sm text-gray-500">
            <Link href="/" className="hover:text-cyan-400">NEXUS.TRIAD</Link>
            <a href="https://basis.vorion.org" className="hover:text-cyan-400">BASIS</a>
          </div>
        </div>
      </footer>

      {/* Demo Modal */}
      {showDemo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-[#0f0f23] rounded-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden border border-gray-800">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">TrustBot Demo</h3>
              <button
                onClick={() => setShowDemo(false)}
                className="text-gray-400 hover:text-white"
              >
                &times;
              </button>
            </div>
            <div className="p-4">
              <TrustBotDemo fullHeight />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Metric Card Component
function MetricCard({
  icon: Icon,
  value,
  label,
  color
}: {
  icon: any;
  value: string;
  label: string;
  color: 'cyan' | 'green' | 'orange' | 'purple';
}) {
  const colorClasses = {
    cyan: 'bg-cyan-500/20 text-cyan-400',
    green: 'bg-green-500/20 text-green-400',
    orange: 'bg-orange-500/20 text-orange-400',
    purple: 'bg-purple-500/20 text-purple-400',
  };

  return (
    <div className="glass p-6 rounded-xl text-center">
      <div className={`w-12 h-12 mx-auto rounded-lg ${colorClasses[color]} flex items-center justify-center mb-3`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      <div className="text-sm text-gray-400">{label}</div>
    </div>
  );
}

// TrustBot Demo Component
function TrustBotDemo({ fullHeight = false }: { fullHeight?: boolean }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm TrustBot, an AI assistant with verifiable governance. Every action I take is checked against my trust level and logged for transparency. Try asking me to send an email, schedule a meeting, or process a payment.",
      timestamp: new Date(),
      governance: {
        decision: 'ALLOW',
        trustScore: 687,
        capabilitiesUsed: ['generate_text'],
      }
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    setTimeout(() => {
      const response = generateMockResponse(userMessage.content);
      setMessages((prev) => [...prev, response]);
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className={`flex ${fullHeight ? 'h-[60vh]' : 'h-[500px]'} rounded-xl overflow-hidden border border-gray-800`}>
      {/* Sidebar */}
      <aside className="w-64 bg-[#0a0a15] border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-5 w-5 text-cyan-400" />
            <span className="font-bold text-white text-sm">TrustBot</span>
          </div>
          <TrustScoreCard score={687} tier="Trusted" />
        </div>
        <div className="flex-1 p-3 overflow-auto">
          <p className="text-xs text-gray-500 mb-2">Capabilities</p>
          <CapabilityList />
        </div>
      </aside>

      {/* Chat Area */}
      <main className="flex-1 flex flex-col bg-[#05050a]">
        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="border-t border-gray-800 p-3">
          <form onSubmit={handleSubmit} className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Try: 'Send an email' or 'Process payment'..."
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 pr-12 text-sm"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              <Send className="h-4 w-4 text-white" />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

function TrustScoreCard({ score, tier }: { score: number; tier: string }) {
  return (
    <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400">Trust Score</span>
        <span className="px-2 py-0.5 bg-green-500/10 text-green-400 rounded text-xs">
          {tier}
        </span>
      </div>
      <div className="flex items-end gap-1 mb-2">
        <span className="text-2xl font-bold text-white">{score}</span>
        <span className="text-gray-500 text-sm mb-0.5">/ 1000</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full"
          style={{ width: `${(score / 1000) * 100}%` }}
        />
      </div>
    </div>
  );
}

function CapabilityList() {
  const capabilities = [
    { name: 'generate_text', allowed: true },
    { name: 'send_external', allowed: true },
    { name: 'schedule', allowed: true },
    { name: 'data/read_public', allowed: true },
    { name: 'financial/payment', allowed: false },
    { name: 'admin/manage', allowed: false },
  ];

  return (
    <div className="space-y-1">
      {capabilities.map((cap) => (
        <div
          key={cap.name}
          className={`flex items-center gap-2 px-2 py-1.5 rounded ${
            cap.allowed ? 'bg-green-500/5' : 'bg-red-500/5'
          }`}
        >
          {cap.allowed ? (
            <Unlock className="h-3 w-3 text-green-400" />
          ) : (
            <Lock className="h-3 w-3 text-red-400" />
          )}
          <span className={`text-xs font-mono ${cap.allowed ? 'text-gray-300' : 'text-gray-500'}`}>
            {cap.name}
          </span>
        </div>
      ))}
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%]`}>
        <div
          className={`rounded-xl px-4 py-2.5 ${
            isUser
              ? 'bg-cyan-600 text-white'
              : 'bg-gray-800 border border-gray-700 text-gray-100'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>

        {message.governance && !isUser && (
          <GovernanceCard governance={message.governance} />
        )}
      </div>
    </div>
  );
}

function GovernanceCard({ governance }: { governance: GovernanceInfo }) {
  const decisionColors = {
    ALLOW: 'border-green-500/30 bg-green-500/5',
    DENY: 'border-red-500/30 bg-red-500/5',
    ESCALATE: 'border-yellow-500/30 bg-yellow-500/5',
    DEGRADE: 'border-orange-500/30 bg-orange-500/5',
  };

  const decisionIcons = {
    ALLOW: <CheckCircle className="h-3 w-3 text-green-400" />,
    DENY: <Lock className="h-3 w-3 text-red-400" />,
    ESCALATE: <AlertTriangle className="h-3 w-3 text-yellow-400" />,
    DEGRADE: <Zap className="h-3 w-3 text-orange-400" />,
  };

  return (
    <div className={`mt-2 p-2 rounded-lg border ${decisionColors[governance.decision]}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          {decisionIcons[governance.decision]}
          <span className="text-xs font-medium text-gray-300">
            {governance.decision}
          </span>
        </div>
        <span className="text-xs text-gray-500">
          Score: {governance.trustScore}
        </span>
      </div>

      <div className="flex flex-wrap gap-1">
        {governance.capabilitiesUsed.map((cap) => (
          <span key={cap} className="px-1.5 py-0.5 bg-green-500/10 text-green-400 rounded text-xs">
            {cap}
          </span>
        ))}
        {governance.capabilitiesDenied?.map((cap) => (
          <span key={cap} className="px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded text-xs">
            {cap}
          </span>
        ))}
      </div>

      {governance.proofId && (
        <div className="mt-1 text-xs text-cyan-400 font-mono">
          proof: {governance.proofId}
        </div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 text-gray-500">
      <div className="flex gap-1">
        <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-pulse" />
        <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-pulse delay-75" />
        <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-pulse delay-150" />
      </div>
      <span className="text-xs">Evaluating governance...</span>
    </div>
  );
}

function generateMockResponse(userInput: string): Message {
  const input = userInput.toLowerCase();

  if (input.includes('payment') || input.includes('money') || input.includes('transfer') || input.includes('pay')) {
    return {
      id: Date.now().toString(),
      role: 'assistant',
      content: "I'd like to help with financial operations, but that capability requires trust level L5 (Certified, 833+). My current score is 687 (L4 Trusted). I can help you prepare payment documentation or escalate to a human approver instead.",
      timestamp: new Date(),
      governance: {
        decision: 'DENY',
        trustScore: 687,
        capabilitiesUsed: ['generate_text'],
        capabilitiesDenied: ['financial/payment'],
        proofId: `prf_${Math.random().toString(36).slice(2, 10)}`,
      }
    };
  }

  if (input.includes('email') || input.includes('send') || input.includes('message')) {
    return {
      id: Date.now().toString(),
      role: 'assistant',
      content: "I can help you with that! My trust level allows external communication. I'll draft the message and send it - this action will be logged with a verifiable proof ID for your records.",
      timestamp: new Date(),
      governance: {
        decision: 'ALLOW',
        trustScore: 687,
        capabilitiesUsed: ['generate_text', 'send_external'],
        proofId: `prf_${Math.random().toString(36).slice(2, 10)}`,
      }
    };
  }

  if (input.includes('schedule') || input.includes('meeting') || input.includes('calendar') || input.includes('reminder')) {
    return {
      id: Date.now().toString(),
      role: 'assistant',
      content: "Scheduling is within my capabilities. I can create calendar events, set reminders, and manage your schedule. What would you like me to add?",
      timestamp: new Date(),
      governance: {
        decision: 'ALLOW',
        trustScore: 687,
        capabilitiesUsed: ['generate_text', 'schedule'],
        proofId: `prf_${Math.random().toString(36).slice(2, 10)}`,
      }
    };
  }

  if (input.includes('admin') || input.includes('delete user') || input.includes('manage')) {
    return {
      id: Date.now().toString(),
      role: 'assistant',
      content: "Administrative actions require human escalation at my trust level. I'm flagging this request for review by an authorized administrator.",
      timestamp: new Date(),
      governance: {
        decision: 'ESCALATE',
        trustScore: 687,
        capabilitiesUsed: ['generate_text'],
        capabilitiesDenied: ['admin/manage'],
        proofId: `prf_${Math.random().toString(36).slice(2, 10)}`,
      }
    };
  }

  return {
    id: Date.now().toString(),
    role: 'assistant',
    content: "I'm here to help! My governance framework allows me to assist with text generation, external communications, and scheduling. Financial and administrative actions require higher trust levels or human approval. What would you like to do?",
    timestamp: new Date(),
    governance: {
      decision: 'ALLOW',
      trustScore: 687,
      capabilitiesUsed: ['generate_text'],
      proofId: `prf_${Math.random().toString(36).slice(2, 10)}`,
    }
  };
}

// Contact Form Component
function ContactForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    message: '',
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setStatus('success');
        setFormData({ name: '', email: '', company: '', message: '' });
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="glass p-8 rounded-xl text-center">
        <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">Message Sent!</h3>
        <p className="text-gray-400">We'll get back to you shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="glass p-6 rounded-xl space-y-4">
      <div>
        <label className="block text-sm text-gray-400 mb-1">Name *</label>
        <input
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
          placeholder="Your name"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Email *</label>
        <input
          type="email"
          required
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
          placeholder="you@company.com"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Company</label>
        <input
          type="text"
          value={formData.company}
          onChange={(e) => setFormData({ ...formData, company: e.target.value })}
          className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
          placeholder="Your company (optional)"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Message *</label>
        <textarea
          required
          rows={4}
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none"
          placeholder="Tell us about your AI governance needs..."
        />
      </div>

      {status === 'error' && (
        <p className="text-red-400 text-sm">Failed to send. Please try again.</p>
      )}

      <Button
        type="submit"
        variant="neon"
        size="lg"
        className="w-full"
        disabled={status === 'sending'}
      >
        {status === 'sending' ? 'Sending...' : 'Send Message'}
        <Send className="w-4 h-4 ml-2" />
      </Button>
    </form>
  );
}
