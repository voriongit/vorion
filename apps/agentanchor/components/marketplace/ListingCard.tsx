'use client'

import { Star, Users, TrendingUp, Bot } from 'lucide-react'
import Link from 'next/link'
import { ListingWithAgent } from '@/lib/marketplace/types'
import { TrustTier } from '@/lib/agents/types'
import TrustBadge from '@/components/agents/TrustBadge'

interface ListingCardProps {
  listing: ListingWithAgent
}

export default function ListingCard({ listing }: ListingCardProps) {
  const { agent } = listing

  return (
    <Link href={`/marketplace/${listing.id}`}>
      <div className="bg-neutral-900 rounded-lg border border-neutral-800 hover:border-neutral-700 transition-colors overflow-hidden group">
        {/* Header with Trust Badge */}
        <div className="p-4 border-b border-neutral-800">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-neutral-400" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-neutral-100 truncate group-hover:text-blue-400 transition-colors">
                  {listing.title}
                </h3>
                <p className="text-sm text-neutral-500 truncate">
                  {agent?.name || 'Agent'}
                </p>
              </div>
            </div>
            {agent && (
              <TrustBadge
                score={agent.trust_score}
                tier={agent.trust_tier as TrustTier}
                size="sm"
              />
            )}
          </div>
        </div>

        {/* Description */}
        <div className="p-4">
          <p className="text-sm text-neutral-400 line-clamp-2">
            {listing.short_description || listing.description}
          </p>
        </div>

        {/* Stats */}
        <div className="px-4 pb-4">
          <div className="flex items-center gap-4 text-sm">
            {/* Rating */}
            {listing.average_rating ? (
              <div className="flex items-center gap-1 text-yellow-400">
                <Star className="w-4 h-4 fill-current" />
                <span>{listing.average_rating.toFixed(1)}</span>
                <span className="text-neutral-500">
                  ({listing.rating_count})
                </span>
              </div>
            ) : (
              <div className="text-neutral-500 flex items-center gap-1">
                <Star className="w-4 h-4" />
                <span>No reviews</span>
              </div>
            )}

            {/* Acquisitions */}
            <div className="flex items-center gap-1 text-neutral-500">
              <Users className="w-4 h-4" />
              <span>{listing.total_acquisitions}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-neutral-800/50 flex items-center justify-between">
          <span className="text-xs px-2 py-1 rounded bg-neutral-800 text-neutral-400">
            {listing.category}
          </span>
          <div className="text-sm">
            <span className="text-neutral-500">From </span>
            <span className="text-green-400 font-medium">
              ${listing.commission_rate.toFixed(4)}
            </span>
            <span className="text-neutral-500">/task</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
