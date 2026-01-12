'use client'

import Link from 'next/link'
import { Bot, MoreVertical, GraduationCap, MessageSquare, Settings, Archive } from 'lucide-react'
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

  // Close menu when clicking outside
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

  return (
    <div className="relative rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {agent.avatar_url ? (
            <img
              src={agent.avatar_url}
              alt={agent.name}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Bot className="h-5 w-5 text-white" />
            </div>
          )}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {agent.name}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {specializationLabel}
            </p>
          </div>
        </div>

        {/* Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <MoreVertical className="h-4 w-4 text-gray-400" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-10 w-48 rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
              <Link
                href={`/agents/${agent.id}`}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <MessageSquare className="h-4 w-4" />
                View Agent
              </Link>
              <Link
                href={`/agents/${agent.id}/edit`}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <Settings className="h-4 w-4" />
                Edit Settings
              </Link>
              {agent.status !== 'training' && (
                <Link
                  href={`/agents/${agent.id}/training`}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
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
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
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
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            statusInfo.color === 'green'
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : statusInfo.color === 'yellow'
              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
              : statusInfo.color === 'red'
              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
          }`}
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
          className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Open
        </Link>
        {agent.status === 'draft' && (
          <Link
            href={`/agents/${agent.id}/training`}
            className="flex-1 rounded-lg border border-purple-300 bg-purple-50 px-3 py-2 text-center text-sm font-medium text-purple-700 hover:bg-purple-100 dark:border-purple-700 dark:bg-purple-900/20 dark:text-purple-300 transition-colors"
          >
            Start Training
          </Link>
        )}
      </div>
    </div>
  )
}

// Compact version for lists
export function AgentListItem({ agent }: { agent: Agent }) {
  const statusInfo = STATUS_LABELS[agent.status]

  return (
    <Link
      href={`/agents/${agent.id}`}
      className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-3 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700/50 transition-colors"
    >
      {agent.avatar_url ? (
        <img
          src={agent.avatar_url}
          alt={agent.name}
          className="h-10 w-10 rounded-full object-cover"
        />
      ) : (
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
          <Bot className="h-5 w-5 text-white" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-gray-900 dark:text-white truncate">
            {agent.name}
          </h3>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              statusInfo.color === 'green'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : statusInfo.color === 'yellow'
                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
            }`}
          >
            {statusInfo.label}
          </span>
        </div>
        {agent.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {agent.description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <TrustBadge score={agent.trust_score} tier={agent.trust_tier} size="sm" />
      </div>
    </Link>
  )
}
