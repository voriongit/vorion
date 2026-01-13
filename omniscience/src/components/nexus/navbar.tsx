'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X, Brain, BookOpen, Layers, Settings, FileCode, Github, MessageCircle, Route, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NavbarProps {
  onActivateChat?: () => void;
}

const navItems = [
  { href: '/lexicon', label: 'Lexicon', icon: BookOpen },
  { href: '/paths', label: 'Paths', icon: Route },
  { href: '/neural', label: 'Neural Link', icon: Layers },
  { href: '/docs', label: 'Docs', icon: FileCode },
  { href: '/cortex', label: 'Cortex', icon: Settings },
  { href: '/profile', label: 'Profile', icon: User },
];

const externalLinks = [
  { href: 'https://basis.vorion.org', label: 'BASIS Standard' },
  { href: 'https://github.com/voriongit/omniscience', label: 'GitHub', icon: Github },
  { href: 'https://discord.gg/basis-protocol', label: 'Discord', icon: MessageCircle },
];

export function Navbar({ onActivateChat }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 w-full z-50 glass border-b border-gray-800 h-16">
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-3 group">
          <div className="w-8 h-8 rounded border border-cyan-500 flex items-center justify-center bg-cyan-900/20 group-hover:bg-cyan-900/40 transition-colors">
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <span className="text-lg font-bold tracking-wider font-mono">
            NEXUS<span className="text-cyan-400">.TRIAD</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-1">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-300 hover:text-cyan-400 transition-colors rounded-md hover:bg-white/5"
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-3">
          {/* External links - desktop only */}
          <div className="hidden lg:flex items-center space-x-2">
            {externalLinks.map(link => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-500 hover:text-cyan-400 transition-colors"
              >
                {link.icon ? <link.icon className="w-4 h-4" /> : link.label}
              </a>
            ))}
          </div>

          {/* Activate button */}
          <Button
            onClick={onActivateChat}
            variant="neon"
            size="sm"
            className="rounded-full font-mono"
          >
            <Brain className="w-4 h-4 mr-2" />
            ACTIVATE
          </Button>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-gray-400 hover:text-white"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={cn(
          'md:hidden absolute top-16 left-0 right-0 glass border-b border-gray-800 transition-all duration-300',
          mobileMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
        )}
      >
        <div className="p-4 space-y-2">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-cyan-400 transition-colors rounded-md hover:bg-white/5"
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
          <div className="border-t border-gray-800 pt-2 mt-2">
            {externalLinks.map(link => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-cyan-400 transition-colors"
              >
                {link.icon && <link.icon className="w-4 h-4" />}
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
