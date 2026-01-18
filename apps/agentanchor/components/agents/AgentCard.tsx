'use client'

import Link from 'next/link'
import { Bot, MoreVertical, GraduationCap, MessageSquare, Settings, Archive, ArrowRight } from 'lucide-react'
import { Agent, STATUS_LABELS, SPECIALIZATIONS } from '@/lib/agents/types'
import TrustBadge, { CertificationBadge, TrustScoreIndicator } from './TrustBadge'
import { useState, useRef, useEffect } from 'react'

interface AgentCardProps {
  agent: Agent
  onArchive?: (id: string) => void
}

export default function AgentCard({ agent, onArchive }: AgentCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const statusInfo = STATUS_LABELS[agent.status]
  const specializationLabel = SPECIALIZATIONS.find(s => s.value === agent.specialization)?.label || 'General'

  const statusGradients: Record<string, string> = {
    green: 'from-green-500 to-emerald-600',
    yellow: 'from-amber-500 to-orange-600',
    red: 'from-red-500 to-rose-600',
    gray: 'from-gray-400 to-gray-500',
  }

  return (
    <div className="relative rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 group">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          {agent.avatar_url ? (
            <img
              src={agent.avatar_url}
              alt={agent.name}
              className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl object-cover flex-shrink-0"
            />
          ) : (
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/25">
              <Bot className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
              {agent.name}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {specializationLabel}
            </p>
          </div>
        </div>

        {/* Menu */}
        <div className="relative flex-shrink-0" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors active:scale-95 touch-manipulation"
          >
            <MoreVertical className="h-4 w-4 text-gray-400" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-10 z-20 w-48 rounded-xl border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-700 dark:bg-gray-800">
              <Link
                href={`/agents/${agent.id}`}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
              >
                <MessageSquare className="h-4 w-4" />
                View Agent
              </Link>
              <Link
                href={`/agents/${agent.id}/edit`}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
              >
                <Settings className="h-4 w-4" />
                Edit Settings
              </Link>
              {agent.status !== 'training' && (
                <Link
                  href={`/agents/${agent.id}/training`}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                >
                  <GraduationCap className="h-4 w-4" />
                  Academy Training
                </Link>
              )}
              {agent.status !== 'archived' && onArchive && (
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    onArchive(agent.id)
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                >
                  <Archive className="h-4 w-4" />
                  Archive Agent
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {agent.description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
          {agent.description}
        </p>
      )}

      {/* Status & Badges */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-gradient-to-r ${statusGradients[statusInfo.color] || statusGradients.gray} text-white`}
        >
          {statusInfo.label}
        </span>
        <TrustBadge score={agent.trust_score} tier={agent.trust_tier} size="sm" />
        {agent.certification_level > 0 && (
          <CertificationBadge level={agent.certification_level} size="sm" />
        )}
      </div>

      {/* Trust Score Bar */}
      <TrustScoreIndicator score={agent.trust_score} tier={agent.trust_tier} />

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        <Link
          href={`/agents/${agent.id}`}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-3 py-2.5 text-sm font-medium text-white hover:from-blue-600 hover:to-indigo-700 transition-all active:scale-95 touch-manipulation"
        >
          Open
          <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
        </Link>
        {agent.status === 'draft' && (
          <Link
            href={`/agents/${agent.id}/training`}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-3 py-2.5 text-sm font-medium text-white hover:from-amber-600 hover:to-orange-700 transition-all active:scale-95 touch-manipulation"
          >
            <GraduationCap className="h-4 w-4" />
            Train
          </Link>
        )}
      </div>
    </div>
  )
}

// Compact version for lists
export function AgentListItem({ agent }: { agent: Agent }) {
  const statusInfo = STATUS_LABELS[agent.status]

  const statusGradients: Record<string, string> = {
    green: 'from-green-500 to-emerald-600',
    yellow: 'from-amber-500 to-orange-600',
    red: 'from-red-500 to-rose-600',
    gray: 'from-gray-400 to-gray-500',
  }

  return (
    <Link
      href={`/agents/${agent.id}`}
      className="flex items-center gap-3 sm:gap-4 rounded-xl border border-gray-200 bg-white p-3 sm:p-4 hover:bg-gray-50 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700/50 dark:hover:border-gray-600 transition-all duration-200 active:scale-[0.98] touch-manipulation group"
    >
      {agent.avatar_url ? (
        <img
          src={agent.avatar_url}
          alt={agent.name}
          className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl object-cover flex-shrink-0"
        />
      ) : (
        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/25">
          <Bot className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-medium text-gray-900 dark:text-white truncate">
            {agent.name}
          </h3>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gradient-to-r ${statusGradients[statusInfo.color] || statusGradients.gray} text-white`}
          >
            {statusInfo.label}
          </span>
        </div>
        {agent.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
            {agent.description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <TrustBadge score={agent.trust_score} tier={agent.trust_tier} size="sm" />
        <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all hidden sm:block" />
      </div>
    </Link>
  )
}
