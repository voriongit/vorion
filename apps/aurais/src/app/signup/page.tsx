'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Bot,
  Mail,
  Lock,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  Github,
  Chrome,
  Check,
  Shield,
} from 'lucide-react'

const plans = {
  core: { name: 'Core', price: 'Free' },
  pro: { name: 'Pro', price: '$49/mo' },
}

export default function SignupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedPlan = (searchParams.get('plan') as 'core' | 'pro') || 'core'

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const passwordStrength = getPasswordStrength(password)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!acceptTerms) {
      setError('Please accept the terms and conditions')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // TODO: Implement actual registration
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, plan: selectedPlan }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Registration failed')
      }

      router.push('/verify-email')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuth = (provider: 'google' | 'github') => {
    // TODO: Implement OAuth
    const params = new URLSearchParams({ plan: selectedPlan })
    window.location.href = `/api/auth/${provider}?${params}`
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-aurais-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-aurais-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-aurais-primary to-aurais-accent flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-gradient">Aurais</span>
          </Link>
        </div>

        {/* Signup Card */}
        <div className="glass rounded-2xl p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold mb-2">Create your account</h1>
            <p className="text-gray-400">Start deploying trusted AI agents</p>
          </div>

          {/* Plan Badge */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-aurais-primary/10 border border-aurais-primary/20">
              <Shield className="w-4 h-4 text-aurais-primary" />
              <span className="text-sm">
                <span className="text-aurais-primary font-medium">
                  {plans[selectedPlan].name}
                </span>
                <span className="text-gray-400 ml-2">{plans[selectedPlan].price}</span>
              </span>
              {selectedPlan !== 'core' && (
                <Link
                  href="/signup"
                  className="text-xs text-gray-400 hover:text-white transition ml-2"
                >
                  Change
                </Link>
              )}
            </div>
          </div>

          {/* OAuth Buttons */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              onClick={() => handleOAuth('google')}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl glass glass-hover transition"
            >
              <Chrome className="w-5 h-5" />
              <span className="text-sm font-medium">Google</span>
            </button>
            <button
              onClick={() => handleOAuth('github')}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl glass glass-hover transition"
            >
              <Github className="w-5 h-5" />
              <span className="text-sm font-medium">GitHub</span>
            </button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-aurais-dark text-gray-400">or sign up with email</span>
            </div>
          </div>

          {/* Signup Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                Full name
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-aurais-primary focus:outline-none focus:ring-1 focus:ring-aurais-primary transition"
                  placeholder="John Doe"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-aurais-primary focus:outline-none focus:ring-1 focus:ring-aurais-primary transition"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-aurais-primary focus:outline-none focus:ring-1 focus:ring-aurais-primary transition"
                  placeholder="Create a strong password"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {/* Password Strength */}
              {password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition ${
                          level <= passwordStrength.level
                            ? passwordStrength.color
                            : 'bg-white/10'
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs ${passwordStrength.textColor}`}>
                    {passwordStrength.label}
                  </p>
                </div>
              )}
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-white/10 bg-white/5 text-aurais-primary focus:ring-aurais-primary focus:ring-offset-0"
              />
              <span className="text-sm text-gray-400">
                I agree to the{' '}
                <Link href="/terms" className="text-aurais-primary hover:text-aurais-secondary">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="text-aurais-primary hover:text-aurais-secondary">
                  Privacy Policy
                </Link>
              </span>
            </label>

            <button
              type="submit"
              disabled={isLoading || !acceptTerms}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-aurais-primary hover:bg-aurais-secondary transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Create Account <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-6">
            Already have an account?{' '}
            <Link
              href="/login"
              className="text-aurais-primary hover:text-aurais-secondary transition font-medium"
            >
              Sign in
            </Link>
          </p>
        </div>

        {/* Trust Badge */}
        <div className="flex items-center justify-center gap-4 mt-8 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Check className="w-3 h-3 text-green-400" />
            <span>AgentAnchor verified</span>
          </div>
          <div className="flex items-center gap-1">
            <Check className="w-3 h-3 text-green-400" />
            <span>Kaizen governed</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function getPasswordStrength(password: string): {
  level: number
  label: string
  color: string
  textColor: string
} {
  if (!password) return { level: 0, label: '', color: '', textColor: '' }

  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++

  if (score <= 1) return { level: 1, label: 'Weak', color: 'bg-red-500', textColor: 'text-red-400' }
  if (score <= 2) return { level: 2, label: 'Fair', color: 'bg-yellow-500', textColor: 'text-yellow-400' }
  if (score <= 3) return { level: 3, label: 'Good', color: 'bg-blue-500', textColor: 'text-blue-400' }
  return { level: 4, label: 'Strong', color: 'bg-green-500', textColor: 'text-green-400' }
}
