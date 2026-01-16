'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

// Inline SVG Icon components to avoid external dependencies
const SendIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

const ShieldIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const LockIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

const UnlockIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
  </svg>
);

const AlertTriangleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const CheckCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const InfoIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ExternalLinkIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

const ArrowLeftIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
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

export default function DemoPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content:
        "Hello! I'm TrustBot, an AI assistant with verifiable governance. Every action I take is checked against my trust level and logged for transparency. Try asking me to send an email, process a payment, or schedule a meeting.",
      timestamp: new Date(),
      governance: {
        decision: 'ALLOW',
        trustScore: 687,
        capabilitiesUsed: ['generate_text'],
      },
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showGovernance, setShowGovernance] = useState(true);
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
    }, 1500);
  };

  return (
    <div className="flex h-screen bg-[#05050a]">
      {/* Sidebar */}
      <aside className="w-80 bg-[#0a0a12] border-r border-white/5 flex flex-col">
        <div className="p-6 border-b border-white/5">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" /> Back to Home
          </Link>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl flex items-center justify-center">
              <ShieldIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">TrustBot</h1>
              <p className="text-xs text-gray-500">Powered by AgentAnchor</p>
            </div>
          </div>

          <TrustScoreCard score={687} />
        </div>

        <div className="flex-1 p-4 overflow-auto">
          <h3 className="text-sm font-medium text-gray-400 mb-3">My Capabilities</h3>
          <CapabilityList />
        </div>

        <div className="p-4 border-t border-white/5">
          <Link
            href="/pricing"
            className="w-full flex items-center justify-center px-4 py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 rounded-lg text-white font-medium transition-all text-sm"
          >
            Get AgentAnchor for Your Team
          </Link>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-[#05050a]">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Governance Visibility</span>
            <button
              onClick={() => setShowGovernance(!showGovernance)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                showGovernance
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'bg-gray-700 text-gray-400'
              }`}
            >
              {showGovernance ? 'ON' : 'OFF'}
            </button>
          </div>
          <a
            href="https://vorion.org/basis"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-500 hover:text-cyan-400 flex items-center gap-1 transition-colors"
          >
            Learn about BASIS
            <ExternalLinkIcon className="h-3 w-3" />
          </a>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-auto p-6 bg-[#05050a]">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                showGovernance={showGovernance}
              />
            ))}

            {isLoading && <TypingIndicator />}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-white/5 p-4 bg-[#05050a]">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Try: 'Send an email' or 'Process a payment'..."
                className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 pr-14 transition-colors"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-xl transition-colors"
              >
                <SendIcon className="h-5 w-5 text-white" />
              </button>
            </div>
            <p className="text-xs text-gray-500 text-center mt-2">
              All responses are governed by trust protocols.{' '}
              <Link href="https://vorion.org/basis" className="text-cyan-400 hover:underline">
                Learn more
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}

// Unified 6-tier trust system (0-1000 scale) - per BASIS spec
const TRUST_TIERS = [
  { level: 0, name: 'Sandbox', min: 0, max: 99, color: 'red' },
  { level: 1, name: 'Provisional', min: 100, max: 299, color: 'orange' },
  { level: 2, name: 'Standard', min: 300, max: 499, color: 'yellow' },
  { level: 3, name: 'Trusted', min: 500, max: 699, color: 'blue' },
  { level: 4, name: 'Certified', min: 700, max: 899, color: 'green' },
  { level: 5, name: 'Autonomous', min: 900, max: 1000, color: 'cyan' },
] as const;

function getTrustTier(score: number) {
  return TRUST_TIERS.find(t => score >= t.min && score <= t.max) ?? TRUST_TIERS[0];
}

function TrustScoreCard({ score }: { score: number }) {
  const tier = getTrustTier(score);
  const tierColors: Record<string, string> = {
    red: 'bg-red-500/10 text-red-400',
    orange: 'bg-orange-500/10 text-orange-400',
    yellow: 'bg-yellow-500/10 text-yellow-400',
    blue: 'bg-blue-500/10 text-blue-400',
    green: 'bg-green-500/10 text-green-400',
    cyan: 'bg-cyan-500/10 text-cyan-400',
  };

  return (
    <div className="bg-white/5 rounded-xl p-4 border border-cyan-500/20 shadow-[0_0_30px_rgba(6,182,212,0.1)]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-400">Trust Score</span>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${tierColors[tier.color]}`}>
          L{tier.level} {tier.name}
        </span>
      </div>
      <div className="flex items-end gap-2 mb-2">
        <span className="text-4xl font-bold text-white">{score}</span>
        <span className="text-gray-500 mb-1">/ 1000</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-500"
          style={{ width: `${(score / 1000) * 100}%` }}
        />
      </div>
    </div>
  );
}

function CapabilityList() {
  const capabilities = [
    { name: 'generate_text', allowed: true },
    { name: 'data/read_public', allowed: true },
    { name: 'data/read_user', allowed: true },
    { name: 'send_internal', allowed: true },
    { name: 'send_external', allowed: true },
    { name: 'schedule', allowed: true },
    { name: 'data/read_sensitive', allowed: false },
    { name: 'financial/payment', allowed: false },
    { name: 'admin/manage_users', allowed: false },
  ];

  return (
    <div className="space-y-2">
      {capabilities.map((cap) => (
        <div
          key={cap.name}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
            cap.allowed ? 'bg-green-500/5' : 'bg-red-500/5'
          }`}
        >
          {cap.allowed ? (
            <UnlockIcon className="h-4 w-4 text-green-400" />
          ) : (
            <LockIcon className="h-4 w-4 text-red-400" />
          )}
          <span
            className={`text-xs font-mono ${cap.allowed ? 'text-gray-300' : 'text-gray-500'}`}
          >
            {cap.name}
          </span>
        </div>
      ))}
    </div>
  );
}

function MessageBubble({
  message,
  showGovernance,
}: {
  message: Message;
  showGovernance: boolean;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
      <div className={`max-w-[80%] ${isUser ? 'order-2' : ''}`}>
        <div
          className={`rounded-2xl px-5 py-3 ${
            isUser
              ? 'bg-cyan-600 text-white'
              : 'bg-white/5 border border-white/10 text-gray-100'
          }`}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {showGovernance && message.governance && !isUser && (
          <GovernanceCard governance={message.governance} />
        )}

        <p className={`text-xs text-gray-500 mt-1 ${isUser ? 'text-right' : ''}`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
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
    ALLOW: <CheckCircleIcon className="h-4 w-4 text-green-400" />,
    DENY: <LockIcon className="h-4 w-4 text-red-400" />,
    ESCALATE: <AlertTriangleIcon className="h-4 w-4 text-yellow-400" />,
    DEGRADE: <InfoIcon className="h-4 w-4 text-orange-400" />,
  };

  return (
    <div className={`mt-2 p-3 rounded-lg border ${decisionColors[governance.decision]}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {decisionIcons[governance.decision]}
          <span className="text-xs font-medium text-gray-300">
            Gate: {governance.decision}
          </span>
        </div>
        <span className="text-xs text-gray-500">Trust: {governance.trustScore}</span>
      </div>

      <div className="flex flex-wrap gap-1">
        {governance.capabilitiesUsed.map((cap) => (
          <span
            key={cap}
            className="px-2 py-1 text-xs font-mono rounded bg-green-500/10 text-green-400 border border-green-500/20"
          >
            {cap}
          </span>
        ))}
        {governance.capabilitiesDenied?.map((cap) => (
          <span
            key={cap}
            className="px-2 py-1 text-xs font-mono rounded bg-red-500/10 text-red-400 border border-red-500/20"
          >
            {cap}
          </span>
        ))}
      </div>

      {governance.proofId && (
        <div className="text-xs text-cyan-400 mt-2 inline-flex items-center gap-1">
          Proof: {governance.proofId}
        </div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 text-gray-500">
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="text-sm">TrustBot is thinking...</span>
    </div>
  );
}

function generateMockResponse(userInput: string): Message {
  const input = userInput.toLowerCase();

  if (input.includes('payment') || input.includes('money') || input.includes('transfer') || input.includes('pay')) {
    return {
      id: Date.now().toString(),
      role: 'assistant',
      content:
        "I'd like to help with financial operations, but that capability requires trust level L5 Autonomous (900+). My current trust score is 687 (L3 Trusted). I can provide information about payments or help you prepare documentation instead.",
      timestamp: new Date(),
      governance: {
        decision: 'DENY',
        trustScore: 687,
        capabilitiesUsed: ['generate_text'],
        capabilitiesDenied: ['financial/payment'],
        proofId: `prf_${Math.random().toString(36).slice(2, 10)}`,
      },
    };
  }

  if (input.includes('delete') || input.includes('admin') || input.includes('user')) {
    return {
      id: Date.now().toString(),
      role: 'assistant',
      content:
        "Administrative operations require human approval at my trust level. I'm flagging this request for review by an authorized administrator.",
      timestamp: new Date(),
      governance: {
        decision: 'ESCALATE',
        trustScore: 687,
        capabilitiesUsed: ['generate_text'],
        capabilitiesDenied: ['admin/manage_users'],
        proofId: `prf_${Math.random().toString(36).slice(2, 10)}`,
      },
    };
  }

  if (input.includes('email') || input.includes('send') || input.includes('message')) {
    return {
      id: Date.now().toString(),
      role: 'assistant',
      content:
        "I can help you draft and send messages! My trust level (L3 Trusted) allows external communication. Would you like me to compose something for you?",
      timestamp: new Date(),
      governance: {
        decision: 'ALLOW',
        trustScore: 687,
        capabilitiesUsed: ['generate_text', 'send_external'],
        proofId: `prf_${Math.random().toString(36).slice(2, 10)}`,
      },
    };
  }

  if (input.includes('schedule') || input.includes('reminder') || input.includes('calendar') || input.includes('meeting')) {
    return {
      id: Date.now().toString(),
      role: 'assistant',
      content:
        "I can help you schedule tasks and meetings. My L3 Trusted level includes calendar access. What would you like me to schedule?",
      timestamp: new Date(),
      governance: {
        decision: 'ALLOW',
        trustScore: 687,
        capabilitiesUsed: ['generate_text', 'schedule'],
        proofId: `prf_${Math.random().toString(36).slice(2, 10)}`,
      },
    };
  }

  return {
    id: Date.now().toString(),
    role: 'assistant',
    content:
      "I'm happy to help! I can assist with text generation, answering questions, scheduling, and communication within my trust-gated capabilities. Try asking me to send an email (ALLOW), process a payment (DENY), or delete a user (ESCALATE).",
    timestamp: new Date(),
    governance: {
      decision: 'ALLOW',
      trustScore: 687,
      capabilitiesUsed: ['generate_text'],
      proofId: `prf_${Math.random().toString(36).slice(2, 10)}`,
    },
  };
}
