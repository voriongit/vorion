'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  Code,
  Lightbulb,
  AlertTriangle,
  ExternalLink,
  Target,
  ChevronDown,
  ChevronUp,
  Copy,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LexiconTerm, CodeExample } from '@/types';

interface TermDetailProps {
  term: LexiconTerm;
}

const levelColors = {
  novice: { border: 'border-cyan-500', bg: 'bg-cyan-500/10', text: 'text-cyan-400' },
  intermediate: { border: 'border-purple-500', bg: 'bg-purple-500/10', text: 'text-purple-400' },
  expert: { border: 'border-orange-500', bg: 'bg-orange-500/10', text: 'text-orange-400' },
  theoretical: { border: 'border-green-500', bg: 'bg-green-500/10', text: 'text-green-400' },
};

function CodeBlock({ example }: { example: CodeExample }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(example.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-gray-700 overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-2 bg-gray-800/50 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Code className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-300">{example.title}</span>
          <span className="text-xs text-gray-600 font-mono">{example.language}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); handleCopy(); }}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4 text-gray-500" />
            )}
          </button>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </div>
      {expanded && (
        <>
          <pre className="p-4 bg-gray-900/50 overflow-x-auto">
            <code className="text-sm text-gray-300 font-mono whitespace-pre">{example.code}</code>
          </pre>
          {example.explanation && (
            <div className="px-4 py-3 bg-gray-800/30 border-t border-gray-700">
              <p className="text-sm text-gray-400">{example.explanation}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function TermDetail({ term }: TermDetailProps) {
  const colors = levelColors[term.level];
  const hasExtendedContent = term.overview || term.keyConcepts?.length ||
    term.examples?.length || term.useCases?.length ||
    term.commonMistakes?.length || term.practicalTips?.length;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back Link */}
      <Link
        href="/lexicon"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Lexicon
      </Link>

      {/* Header */}
      <div className={cn('p-6 rounded-xl border mb-8', colors.border, colors.bg)}>
        <div className="flex items-start justify-between mb-4">
          <h1 className="text-2xl md:text-3xl font-bold text-white">{term.term}</h1>
          <span className={cn('text-xs uppercase px-2 py-1 rounded border', `badge-${term.level}`)}>
            {term.level}
          </span>
        </div>
        <p className="text-gray-300 text-lg leading-relaxed">{term.definition}</p>

        {term.category && (
          <div className="mt-4 pt-4 border-t border-gray-700/50">
            <span className="text-sm text-gray-500">Category: </span>
            <span className="text-sm text-gray-300">{term.category}</span>
          </div>
        )}

        {term.tags && term.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {term.tags.map(tag => (
              <span key={tag} className="text-xs px-2 py-1 bg-gray-800 text-gray-400 rounded">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Extended Content */}
      {hasExtendedContent ? (
        <div className="space-y-8">
          {/* Overview */}
          {term.overview && (
            <section>
              <h2 className="flex items-center gap-2 text-xl font-bold text-white mb-4">
                <BookOpen className="w-5 h-5 text-cyan-400" />
                Overview
              </h2>
              <div className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-6">
                <p className="text-gray-300 leading-relaxed whitespace-pre-line">{term.overview}</p>
              </div>
            </section>
          )}

          {/* Key Concepts */}
          {term.keyConcepts && term.keyConcepts.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-xl font-bold text-white mb-4">
                <Target className="w-5 h-5 text-purple-400" />
                Key Concepts
              </h2>
              <div className="grid gap-4">
                {term.keyConcepts.map((concept, idx) => (
                  <div key={idx} className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-4">
                    <h3 className="font-semibold text-white mb-2">{concept.title}</h3>
                    <p className="text-gray-400 text-sm">{concept.description}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Code Examples */}
          {term.examples && term.examples.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-xl font-bold text-white mb-4">
                <Code className="w-5 h-5 text-green-400" />
                Code Examples
              </h2>
              <div className="space-y-4">
                {term.examples.map((example, idx) => (
                  <CodeBlock key={idx} example={example} />
                ))}
              </div>
            </section>
          )}

          {/* Use Cases */}
          {term.useCases && term.useCases.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-xl font-bold text-white mb-4">
                <Lightbulb className="w-5 h-5 text-yellow-400" />
                Real-World Use Cases
              </h2>
              <ul className="space-y-3">
                {term.useCases.map((useCase, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-gray-300">
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-bold shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    {useCase}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Practical Tips */}
          {term.practicalTips && term.practicalTips.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-xl font-bold text-white mb-4">
                <Lightbulb className="w-5 h-5 text-cyan-400" />
                Practical Tips
              </h2>
              <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-4">
                <ul className="space-y-2">
                  {term.practicalTips.map((tip, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-gray-300 text-sm">
                      <span className="text-cyan-400">•</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {/* Common Mistakes */}
          {term.commonMistakes && term.commonMistakes.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-xl font-bold text-white mb-4">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
                Common Mistakes to Avoid
              </h2>
              <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-4">
                <ul className="space-y-2">
                  {term.commonMistakes.map((mistake, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-gray-300 text-sm">
                      <span className="text-orange-400">✗</span>
                      {mistake}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {/* Further Reading */}
          {term.furtherReading && term.furtherReading.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-xl font-bold text-white mb-4">
                <ExternalLink className="w-5 h-5 text-blue-400" />
                Further Reading
              </h2>
              <div className="grid gap-2">
                {term.furtherReading.map((resource, idx) => (
                  <a
                    key={idx}
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 bg-gray-800/30 border border-gray-700/50 rounded-lg hover:border-blue-500/50 transition-colors group"
                  >
                    <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-blue-400" />
                    <span className="text-gray-300 group-hover:text-blue-400">{resource.title}</span>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Related Terms */}
          {term.relatedTerms && term.relatedTerms.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-white mb-4">Related Concepts</h2>
              <div className="flex flex-wrap gap-2">
                {term.relatedTerms.map(related => (
                  <Link
                    key={related}
                    href={`/lexicon/${related.toLowerCase().replace(/\s+/g, '-')}`}
                    className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 hover:border-cyan-500/50 hover:text-cyan-400 transition-colors"
                  >
                    {related}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-800/30 border border-gray-700/50 rounded-xl">
          <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500">Extended tutorial content coming soon.</p>
          <p className="text-sm text-gray-600 mt-2">Check back for examples, tips, and in-depth explanations.</p>
        </div>
      )}
    </div>
  );
}
