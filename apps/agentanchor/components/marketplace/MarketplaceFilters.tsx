'use client'

import { useState, useEffect } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { MarketplaceCategory, ListingSearchParams } from '@/lib/marketplace/types'

interface MarketplaceFiltersProps {
  categories: MarketplaceCategory[]
  onSearch: (params: ListingSearchParams) => void
  initialParams?: ListingSearchParams
}

const trustScoreOptions = [
  { value: undefined, label: 'Any Score' },
  { value: 200, label: '200+ (Novice)' },
  { value: 400, label: '400+ (Proven)' },
  { value: 600, label: '600+ (Trusted)' },
  { value: 800, label: '800+ (Elite)' },
]

type SortOption = 'trust_score' | 'rating' | 'acquisitions' | 'newest' | 'price_low' | 'price_high'

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'trust_score', label: 'Trust Score' },
  { value: 'rating', label: 'Rating' },
  { value: 'acquisitions', label: 'Most Popular' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
]

export default function MarketplaceFilters({
  categories,
  onSearch,
  initialParams = {},
}: MarketplaceFiltersProps) {
  const [query, setQuery] = useState(initialParams.query || '')
  const [category, setCategory] = useState(initialParams.category || 'all')
  const [minTrustScore, setMinTrustScore] = useState<number | undefined>(
    initialParams.min_trust_score
  )
  const [minRating, setMinRating] = useState<number | undefined>(
    initialParams.min_rating
  )
  const [sortBy, setSortBy] = useState<SortOption>(initialParams.sort_by || 'newest')
  const [showFilters, setShowFilters] = useState(false)

  const hasActiveFilters = category !== 'all' || minTrustScore || minRating

  const handleSearch = () => {
    onSearch({
      query: query || undefined,
      category: category === 'all' ? undefined : category,
      min_trust_score: minTrustScore,
      min_rating: minRating,
      sort_by: sortBy as any,
    })
  }

  const clearFilters = () => {
    setCategory('all')
    setMinTrustScore(undefined)
    setMinRating(undefined)
    setSortBy('newest')
    onSearch({ query: query || undefined })
  }

  useEffect(() => {
    const debounce = setTimeout(() => {
      handleSearch()
    }, 300)
    return () => clearTimeout(debounce)
  }, [category, minTrustScore, minRating, sortBy])

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search agents..."
            className="w-full pl-10 pr-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder:text-neutral-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          Search
        </button>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-3 py-2 rounded-lg border transition-colors flex items-center gap-2 ${
            showFilters || hasActiveFilters
              ? 'bg-blue-600/20 border-blue-600 text-blue-400'
              : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-600'
          }`}
        >
          <SlidersHorizontal className="w-5 h-5" />
          {hasActiveFilters && (
            <span className="w-2 h-2 rounded-full bg-blue-500" />
          )}
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-neutral-100">Filters</h3>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-neutral-400 hover:text-neutral-200 flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Clear all
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Category */}
            <div>
              <label className="block text-sm text-neutral-500 mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Trust Score */}
            <div>
              <label className="block text-sm text-neutral-500 mb-1.5">
                Minimum Trust Score
              </label>
              <select
                value={minTrustScore || ''}
                onChange={(e) =>
                  setMinTrustScore(e.target.value ? parseInt(e.target.value) : undefined)
                }
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:ring-2 focus:ring-blue-500"
              >
                {trustScoreOptions.map((opt) => (
                  <option key={opt.label} value={opt.value || ''}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Rating */}
            <div>
              <label className="block text-sm text-neutral-500 mb-1.5">
                Minimum Rating
              </label>
              <select
                value={minRating || ''}
                onChange={(e) =>
                  setMinRating(e.target.value ? parseFloat(e.target.value) : undefined)
                }
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Any Rating</option>
                <option value="4">4+ Stars</option>
                <option value="3">3+ Stars</option>
                <option value="2">2+ Stars</option>
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm text-neutral-500 mb-1.5">
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:ring-2 focus:ring-blue-500"
              >
                {sortOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Category Pills (Quick Filter) */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setCategory('all')}
          className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
            category === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
          }`}
        >
          All
        </button>
        {categories.slice(0, 6).map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
              category === cat.id
                ? 'bg-blue-600 text-white'
                : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>
    </div>
  )
}
