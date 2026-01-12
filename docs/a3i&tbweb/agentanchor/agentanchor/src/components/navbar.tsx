'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X, Shield, ChevronDown } from 'lucide-react'

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-surface-dark/80 backdrop-blur-lg border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-purple-500 rounded-lg flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">AgentAnchor</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/registry" className="text-gray-300 hover:text-white transition-colors">
              Registry
            </Link>
            <Link href="/pricing" className="text-gray-300 hover:text-white transition-colors">
              Pricing
            </Link>
            <Link href="/docs" className="text-gray-300 hover:text-white transition-colors">
              Docs
            </Link>
            <Link
              href="https://basis.vorion.org"
              className="text-gray-300 hover:text-white transition-colors"
              target="_blank"
            >
              BASIS Standard
            </Link>
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/login"
              className="text-gray-300 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white font-medium rounded-lg transition-colors"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 text-gray-400 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-surface border-t border-gray-800">
          <div className="px-4 py-4 space-y-4">
            <Link href="/registry" className="block text-gray-300 hover:text-white">
              Registry
            </Link>
            <Link href="/pricing" className="block text-gray-300 hover:text-white">
              Pricing
            </Link>
            <Link href="/docs" className="block text-gray-300 hover:text-white">
              Docs
            </Link>
            <Link href="/login" className="block text-gray-300 hover:text-white">
              Sign In
            </Link>
            <Link
              href="/register"
              className="block px-4 py-2 bg-primary-600 text-white font-medium rounded-lg text-center"
            >
              Get Started
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}
