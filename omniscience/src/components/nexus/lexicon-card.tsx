'use client';

import { cn } from '@/lib/utils';
import type { LexiconTerm } from '@/types';

interface LexiconCardProps {
  term: LexiconTerm;
  onClick?: () => void;
}

const levelColors = {
  novice: 'cyan',
  intermediate: 'purple',
  expert: 'orange',
  theoretical: 'green',
} as const;

export function LexiconCard({ term, onClick }: LexiconCardProps) {
  const color = levelColors[term.level];

  return (
    <div
      onClick={onClick}
      className={cn(
        'glass p-4 rounded cursor-pointer transition-all',
        'hover:bg-white/5 hover:border-gray-600',
        `border-l-2 border-${color}-500`
      )}
      style={{
        borderLeftColor: `var(--color-neon-${color === 'cyan' ? 'blue' : color})`,
      }}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-bold text-gray-200">{term.term}</h3>
        <span
          className={cn(
            'text-[10px] uppercase px-1.5 py-0.5 rounded border',
            `badge-${term.level}`
          )}
        >
          {term.level}
        </span>
      </div>
      <p className="text-xs text-gray-400 line-clamp-3">{term.definition}</p>
      {term.tags && term.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {term.tags.slice(0, 3).map(tag => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 bg-gray-800 text-gray-500 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
