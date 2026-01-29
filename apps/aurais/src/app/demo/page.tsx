'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Bot,
  Play,
  Pause,
  RotateCcw,
  Shield,
  Zap,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Terminal,
  Activity,
} from 'lucide-react'

const demoSteps = [
  { id: 1, action: 'Agent initialized', tier: 'T0', status: 'success', detail: 'Starting in sandbox mode' },
  { id: 2, action: 'Reading input data', tier: 'T0', status: 'success', detail: 'Accessing public dataset' },
  { id: 3, action: 'Processing records', tier: 'T0', status: 'success', detail: '1,247 records analyzed' },
  { id: 4, action: 'Trust evaluation', tier: 'T0', status: 'info', detail: 'Score: 312 → T1 Observed' },
  { id: 5, action: 'Capability upgrade', tier: 'T1', status: 'success', detail: 'Internal data access granted' },
  { id: 6, action: 'Querying database', tier: 'T1', status: 'success', detail: 'Read-only query executed' },
  { id: 7, action: 'External API request', tier: 'T1', status: 'warning', detail: 'Blocked - requires T2+' },
  { id: 8, action: 'Trust evaluation', tier: 'T1', status: 'info', detail: 'Score: 387 → T2 Provisional' },
  { id: 9, action: 'External API request', tier: 'T2', status: 'success', detail: 'GET request approved' },
  { id: 10, action: 'Writing results', tier: 'T2', status: 'success', detail: 'Output saved to approved path' },
]

export default function DemoPage() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])

  const runDemo = () => {
    if (isPlaying) return
    setIsPlaying(true)

    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= demoSteps.length - 1) {
          clearInterval(interval)
          setIsPlaying(false)
          return prev
        }
        setCompletedSteps((completed) => [...completed, prev])
        return prev + 1
      })
    }, 1500)
  }

  const resetDemo = () => {
    setIsPlaying(false)
    setCurrentStep(0)
    setCompletedSteps([])
  }

  const getCurrentTier = () => {
    if (currentStep === 0) return { name: 'T0 Sandbox', score: 0 }
    const step = demoSteps[currentStep]
    if (step.tier === 'T2') return { name: 'T2 Provisional', score: 387 }
    if (step.tier === 'T1') return { name: 'T1 Observed', score: 312 }
    return { name: 'T0 Sandbox', score: 156 }
  }

  const tier = getCurrentTier()

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-aurais-primary to-aurais-accent flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gradient">Aurais</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/features" className="text-gray-400 hover:text-white transition">Features</Link>
            <Link href="/pricing" className="text-gray-400 hover:text-white transition">Pricing</Link>
            <Link href="/docs" className="text-gray-400 hover:text-white transition">Docs</Link>
            <Link href="/signup" className="px-4 py-2 rounded-lg bg-aurais-primary hover:bg-aurais-secondary transition">
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 pb-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Interactive Demo</h1>
            <p className="text-xl text-gray-400">
              Watch how an agent earns trust and capabilities through the BASIS framework
            </p>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Agent Status Panel */}
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-aurais-primary/20 to-aurais-accent/20 flex items-center justify-center">
                  <Bot className="w-6 h-6 text-aurais-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">DataProcessor</h3>
                  <span className="text-sm text-gray-400">Demo Agent</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Trust Score</span>
                    <span className="font-bold text-aurais-primary">{tier.score}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-aurais-primary to-aurais-accent transition-all duration-500"
                      style={{ width: `${(tier.score / 1000) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Current Tier</span>
                    <span className="font-medium text-green-400">{tier.name}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white/5">
                  <div className="text-sm text-gray-400 mb-2">Capabilities</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span>Read public data</span>
                    </div>
                    {tier.score >= 200 && (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span>Read internal data</span>
                      </div>
                    )}
                    {tier.score >= 350 && (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span>External API access</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Execution Log */}
            <div className="col-span-2 glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-aurais-primary" />
                  <h3 className="font-semibold">Execution Log</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={runDemo}
                    disabled={isPlaying || currentStep >= demoSteps.length - 1}
                    className="p-2 rounded-lg bg-aurais-primary hover:bg-aurais-secondary transition disabled:opacity-50"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                  <button
                    onClick={resetDemo}
                    className="p-2 rounded-lg glass glass-hover transition"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {demoSteps.slice(0, currentStep + 1).map((step, i) => (
                  <div
                    key={step.id}
                    className={`flex items-center gap-3 p-3 rounded-lg transition ${
                      i === currentStep ? 'bg-aurais-primary/20 border border-aurais-primary/50' : 'bg-white/5'
                    }`}
                  >
                    {step.status === 'success' && <CheckCircle className="w-4 h-4 text-green-400" />}
                    {step.status === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-400" />}
                    {step.status === 'info' && <Activity className="w-4 h-4 text-aurais-primary" />}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{step.action}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-400">
                          {step.tier}
                        </span>
                      </div>
                      <span className="text-sm text-gray-400">{step.detail}</span>
                    </div>
                  </div>
                ))}

                {currentStep === 0 && !isPlaying && (
                  <div className="text-center py-8 text-gray-400">
                    <Play className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Click play to start the demo</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Info Section */}
          <div className="mt-12 glass rounded-2xl p-8">
            <h2 className="text-xl font-semibold mb-4">What you're seeing</h2>
            <p className="text-gray-400 mb-6">
              This demo shows how an Aurais agent progresses through trust tiers as it demonstrates reliable behavior.
              The agent starts in T0 (Sandbox) with minimal capabilities, and earns access to more powerful features
              as its trust score increases through successful operations.
            </p>
            <div className="flex items-center gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-aurais-primary hover:bg-aurais-secondary transition font-medium"
              >
                Try It Yourself <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/docs"
                className="px-6 py-3 rounded-xl glass glass-hover transition font-medium"
              >
                Read the Docs
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
