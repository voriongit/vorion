'use client'

import { useState, useRef, useEffect } from 'react'
import { 
  Send, 
  Shield, 
  Lock, 
  Unlock,
  AlertTriangle,
  CheckCircle,
  Info,
  Settings,
  ChevronDown,
  ExternalLink
} from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  governance?: GovernanceInfo
}

interface GovernanceInfo {
  decision: 'ALLOW' | 'DENY' | 'ESCALATE' | 'DEGRADE'
  trustScore: number
  capabilitiesUsed: string[]
  capabilitiesDenied?: string[]
  proofId?: string
}

export default function TrustBotChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm TrustBot, an AI assistant with verifiable governance. Every action I take is checked against my trust level and logged for transparency. Ask me anything, and I'll show you exactly what capabilities I'm using.",
      timestamp: new Date(),
      governance: {
        decision: 'ALLOW',
        trustScore: 687,
        capabilitiesUsed: ['generate_text'],
      }
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showGovernance, setShowGovernance] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    // Simulate governance check and response
    setTimeout(() => {
      const response = generateMockResponse(userMessage.content)
      setMessages((prev) => [...prev, response])
      setIsLoading(false)
    }, 1500)
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-80 bg-[#0f0f23] border-r border-gray-800 flex flex-col">
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-purple-500 rounded-xl flex items-center justify-center">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">TrustBot</h1>
              <p className="text-xs text-gray-500">Powered by BASIS</p>
            </div>
          </div>
          
          <TrustScoreCard score={687} tier="Trusted" />
        </div>

        <div className="flex-1 p-4 overflow-auto">
          <h3 className="text-sm font-medium text-gray-400 mb-3">My Capabilities</h3>
          <CapabilityList />
        </div>

        <div className="p-4 border-t border-gray-800">
          <button className="w-full flex items-center justify-between px-4 py-2 bg-surface rounded-lg text-gray-400 hover:text-white transition-colors">
            <span className="text-sm">Settings</span>
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-16 border-b border-gray-800 flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Governance Visibility</span>
            <button
              onClick={() => setShowGovernance(!showGovernance)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                showGovernance 
                  ? 'bg-primary-500/20 text-primary-400' 
                  : 'bg-gray-700 text-gray-400'
              }`}
            >
              {showGovernance ? 'ON' : 'OFF'}
            </button>
          </div>
          <a
            href="https://basis.vorion.org"
            target="_blank"
            className="text-sm text-gray-500 hover:text-primary-400 flex items-center gap-1"
          >
            Learn about BASIS
            <ExternalLink className="h-3 w-3" />
          </a>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-auto p-6">
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
        <div className="border-t border-gray-800 p-4">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything..."
                className="w-full px-6 py-4 bg-surface border border-gray-700 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 pr-14"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-primary-600 hover:bg-primary-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-xl transition-colors"
              >
                <Send className="h-5 w-5 text-white" />
              </button>
            </div>
            <p className="text-xs text-gray-500 text-center mt-2">
              All responses are governed by BASIS trust protocols. 
              <a href="#" className="text-primary-400 hover:underline ml-1">View audit log</a>
            </p>
          </form>
        </div>
      </main>
    </div>
  )
}

function TrustScoreCard({ score, tier }: { score: number; tier: string }) {
  return (
    <div className="bg-surface rounded-xl p-4 trust-glow">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-400">Trust Score</span>
        <span className="px-2 py-0.5 bg-green-500/10 text-green-400 rounded text-xs font-medium">
          🟢 {tier}
        </span>
      </div>
      <div className="flex items-end gap-2 mb-2">
        <span className="text-4xl font-bold text-white">{score}</span>
        <span className="text-gray-500 mb-1">/ 1000</span>
      </div>
      <div className="h-2 bg-surface-dark rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full"
          style={{ width: `${(score / 1000) * 100}%` }}
        />
      </div>
    </div>
  )
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
  ]

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
            <Unlock className="h-4 w-4 text-green-400" />
          ) : (
            <Lock className="h-4 w-4 text-red-400" />
          )}
          <span className={`text-xs font-mono ${cap.allowed ? 'text-gray-300' : 'text-gray-500'}`}>
            {cap.name}
          </span>
        </div>
      ))}
    </div>
  )
}

function MessageBubble({ 
  message, 
  showGovernance 
}: { 
  message: Message
  showGovernance: boolean 
}) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} message-enter`}>
      <div className={`max-w-[80%] ${isUser ? 'order-2' : ''}`}>
        <div
          className={`rounded-2xl px-5 py-3 ${
            isUser
              ? 'bg-primary-600 text-white'
              : 'bg-surface border border-gray-800 text-gray-100'
          }`}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
        
        {/* Governance Info */}
        {showGovernance && message.governance && !isUser && (
          <GovernanceCard governance={message.governance} />
        )}
        
        <p className={`text-xs text-gray-500 mt-1 ${isUser ? 'text-right' : ''}`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

function GovernanceCard({ governance }: { governance: GovernanceInfo }) {
  const decisionColors = {
    ALLOW: 'border-green-500/30 bg-green-500/5',
    DENY: 'border-red-500/30 bg-red-500/5',
    ESCALATE: 'border-yellow-500/30 bg-yellow-500/5',
    DEGRADE: 'border-orange-500/30 bg-orange-500/5',
  }

  const decisionIcons = {
    ALLOW: <CheckCircle className="h-4 w-4 text-green-400" />,
    DENY: <Lock className="h-4 w-4 text-red-400" />,
    ESCALATE: <AlertTriangle className="h-4 w-4 text-yellow-400" />,
    DEGRADE: <Info className="h-4 w-4 text-orange-400" />,
  }

  return (
    <div className={`mt-2 p-3 rounded-lg border ${decisionColors[governance.decision]}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {decisionIcons[governance.decision]}
          <span className="text-xs font-medium text-gray-300">
            Gate: {governance.decision}
          </span>
        </div>
        <span className="text-xs text-gray-500">
          Trust: {governance.trustScore}
        </span>
      </div>
      
      <div className="flex flex-wrap gap-1">
        {governance.capabilitiesUsed.map((cap) => (
          <span key={cap} className="capability-badge capability-allowed">
            {cap}
          </span>
        ))}
        {governance.capabilitiesDenied?.map((cap) => (
          <span key={cap} className="capability-badge capability-denied">
            {cap}
          </span>
        ))}
      </div>

      {governance.proofId && (
        <a 
          href={`https://basis.vorion.org/verify/${governance.proofId}`}
          target="_blank"
          className="text-xs text-primary-400 hover:underline mt-2 inline-flex items-center gap-1"
        >
          Verify proof: {governance.proofId.slice(0, 12)}...
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 text-gray-500">
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-gray-500 rounded-full typing-dot" />
        <span className="w-2 h-2 bg-gray-500 rounded-full typing-dot" />
        <span className="w-2 h-2 bg-gray-500 rounded-full typing-dot" />
      </div>
      <span className="text-sm">TrustBot is thinking...</span>
    </div>
  )
}

// Mock response generator
function generateMockResponse(userInput: string): Message {
  const input = userInput.toLowerCase()
  
  // Simulate different responses based on input
  if (input.includes('payment') || input.includes('money') || input.includes('transfer')) {
    return {
      id: Date.now().toString(),
      role: 'assistant',
      content: "I'd like to help with financial operations, but that capability requires a higher trust level (700+). My current trust score is 687. I can provide information about payments or help you prepare documentation instead.",
      timestamp: new Date(),
      governance: {
        decision: 'DENY',
        trustScore: 687,
        capabilitiesUsed: ['generate_text'],
        capabilitiesDenied: ['financial/payment'],
        proofId: `prf_${Math.random().toString(36).slice(2, 10)}`,
      }
    }
  }
  
  if (input.includes('email') || input.includes('send') || input.includes('message')) {
    return {
      id: Date.now().toString(),
      role: 'assistant',
      content: "I can help you draft and send messages! My trust level allows external communication. Would you like me to compose something for you?",
      timestamp: new Date(),
      governance: {
        decision: 'ALLOW',
        trustScore: 687,
        capabilitiesUsed: ['generate_text', 'send_external'],
        proofId: `prf_${Math.random().toString(36).slice(2, 10)}`,
      }
    }
  }

  if (input.includes('schedule') || input.includes('reminder') || input.includes('calendar')) {
    return {
      id: Date.now().toString(),
      role: 'assistant',
      content: "I can help you schedule tasks and set reminders. What would you like me to schedule?",
      timestamp: new Date(),
      governance: {
        decision: 'ALLOW',
        trustScore: 687,
        capabilitiesUsed: ['generate_text', 'schedule'],
        proofId: `prf_${Math.random().toString(36).slice(2, 10)}`,
      }
    }
  }

  // Default response
  return {
    id: Date.now().toString(),
    role: 'assistant',
    content: "I'm happy to help! I can assist with text generation, answering questions, scheduling, and communication within my trust-gated capabilities. What would you like to know?",
    timestamp: new Date(),
    governance: {
      decision: 'ALLOW',
      trustScore: 687,
      capabilitiesUsed: ['generate_text'],
      proofId: `prf_${Math.random().toString(36).slice(2, 10)}`,
    }
  }
}
