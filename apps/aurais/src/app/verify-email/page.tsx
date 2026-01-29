'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bot, Mail, ArrowRight, RefreshCw } from 'lucide-react'

export default function VerifyEmailPage() {
  const [isResending, setIsResending] = useState(false)
  const [resent, setResent] = useState(false)

  const handleResend = async () => {
    setIsResending(true)
    try {
      // TODO: Implement resend verification email
      await new Promise(resolve => setTimeout(resolve, 1000))
      setResent(true)
      setTimeout(() => setResent(false), 3000)
    } finally {
      setIsResending(false)
    }
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

        <div className="glass rounded-2xl p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-aurais-primary/20 flex items-center justify-center mx-auto mb-6">
            <Mail className="w-10 h-10 text-aurais-primary" />
          </div>

          <h1 className="text-2xl font-bold mb-2">Check your email</h1>
          <p className="text-gray-400 mb-6">
            We've sent you a verification link. Click the link in your email to verify your account.
          </p>

          <div className="p-4 rounded-xl bg-white/5 mb-6">
            <p className="text-sm text-gray-400">
              The verification link will expire in <strong className="text-white">24 hours</strong>
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleResend}
              disabled={isResending}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl glass glass-hover transition font-medium disabled:opacity-50"
            >
              {isResending ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : resent ? (
                'Email sent!'
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  Resend verification email
                </>
              )}
            </button>

            <Link
              href="/login"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-aurais-primary hover:bg-aurais-secondary transition font-medium"
            >
              Continue to sign in
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>

          <p className="text-sm text-gray-500 mt-6">
            Wrong email?{' '}
            <Link href="/signup" className="text-aurais-primary hover:text-aurais-secondary">
              Sign up again
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
