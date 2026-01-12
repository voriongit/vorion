'use client';

import { useState, useMemo } from 'react';
import { Search, Filter, Cloud, CloudOff, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LexiconCard } from './lexicon-card';
import { useLexicon } from '@/lib/firebase-hooks';
import type { LexiconTerm, KnowledgeLevel } from '@/types';

interface LexiconBrowserProps {
  onSelectTerm?: (term: LexiconTerm) => void;
}

export function LexiconBrowser({ onSelectTerm }: LexiconBrowserProps) {
  const { terms, loading, error, isCloudSynced } = useLexicon();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<KnowledgeLevel | null>(null);

  const categories = useMemo(() => {
    const cats = [...new Set(terms.map(t => t.category).filter(Boolean))] as string[];
    return cats.sort();
  }, [terms]);

  const filteredTerms = useMemo(() => {
    let filtered = terms;

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        t =>
          t.term.toLowerCase().includes(q) ||
          t.definition.toLowerCase().includes(q) ||
          t.tags?.some(tag => tag.toLowerCase().includes(q))
      );
    }

    // Category filter
    if (selectedCategory) {
      filtered = filtered.filter(t => t.category === selectedCategory);
    }

    // Level filter
    if (selectedLevel) {
      filtered = filtered.filter(t => t.level === selectedLevel);
    }

    return filtered.sort((a, b) => a.term.localeCompare(b.term));
  }, [terms, search, selectedCategory, selectedLevel]);

  const levels: KnowledgeLevel[] = ['novice', 'intermediate', 'expert', 'theoretical'];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        <span className="ml-3 text-gray-400">Loading knowledge base...</span>
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-6 border-b border-gray-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Knowledge Graph</h2>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-xs text-gray-500 font-mono">
              {filteredTerms.length} NODES
            </p>
            <span className="text-gray-700">|</span>
            {isCloudSynced ? (
              <span className="flex items-center gap-1 text-xs text-emerald-500 font-mono">
                <Cloud className="w-3 h-3" />
                CLOUD SYNCED
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-amber-500 font-mono">
                <CloudOff className="w-3 h-3" />
                LOCAL ONLY
              </span>
            )}
          </div>
          {error && (
            <p className="text-xs text-red-400 mt-1">{error}</p>
          )}
        </div>

        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter nodes..."
              className="pl-9 w-48"
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <div className="flex gap-1 items-center">
          <Filter className="w-4 h-4 text-gray-500 mr-1" />
          <Button
            variant={selectedCategory === null ? 'neon' : 'ghost'}
            size="sm"
            onClick={() => setSelectedCategory(null)}
          >
            All
          </Button>
          {categories.map(cat => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'neon' : 'ghost'}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>

        <div className="w-px h-6 bg-gray-700 mx-2" />

        <div className="flex gap-1">
          {levels.map(level => (
            <Button
              key={level}
              variant={selectedLevel === level ? 'neon' : 'ghost'}
              size="sm"
              onClick={() => setSelectedLevel(selectedLevel === level ? null : level)}
              className={`badge-${level} border`}
            >
              {level}
            </Button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTerms.map(term => (
          <LexiconCard
            key={term.id || term.term}
            term={term}
            onClick={() => onSelectTerm?.(term)}
          />
        ))}
      </div>

      {filteredTerms.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>No matching terms found.</p>
          <p className="text-xs mt-2">Try a different search or filter.</p>
        </div>
      )}
    </div>
  );
}
