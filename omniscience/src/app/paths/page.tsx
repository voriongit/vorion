'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/nexus';
import {
  Sparkles,
  MessageSquare,
  Bot,
  Wrench,
  Users,
  Shield,
  Rocket,
  ClipboardCheck,
  Brain,
  Lock,
  FileCode,
  ChevronRight,
  Clock,
  BookOpen,
  Target,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { getAllPaths, getStarterPaths, getPathsByDifficulty, getPathTermCount } from '@/lib/learning-paths';
import { useProgressContext } from '@/contexts';
import { ProgressBar, StatsCard } from '@/components/progress';
import type { LearningPath, PathDifficulty } from '@/types';

// Icon mapping
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles,
  MessageSquare,
  Bot,
  Wrench,
  Users,
  Shield,
  Rocket,
  ClipboardCheck,
  Brain,
  Lock,
  FileCode,
};

// Color mapping
const colorMap: Record<string, string> = {
  cyan: 'from-cyan-500/20 to-cyan-600/5 border-cyan-500/30 hover:border-cyan-400/50',
  purple: 'from-purple-500/20 to-purple-600/5 border-purple-500/30 hover:border-purple-400/50',
  green: 'from-green-500/20 to-green-600/5 border-green-500/30 hover:border-green-400/50',
  orange: 'from-orange-500/20 to-orange-600/5 border-orange-500/30 hover:border-orange-400/50',
  blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/30 hover:border-blue-400/50',
  red: 'from-red-500/20 to-red-600/5 border-red-500/30 hover:border-red-400/50',
  emerald: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/30 hover:border-emerald-400/50',
  yellow: 'from-yellow-500/20 to-yellow-600/5 border-yellow-500/30 hover:border-yellow-400/50',
  pink: 'from-pink-500/20 to-pink-600/5 border-pink-500/30 hover:border-pink-400/50',
  indigo: 'from-indigo-500/20 to-indigo-600/5 border-indigo-500/30 hover:border-indigo-400/50',
  teal: 'from-teal-500/20 to-teal-600/5 border-teal-500/30 hover:border-teal-400/50',
};

const iconColorMap: Record<string, string> = {
  cyan: 'text-cyan-400',
  purple: 'text-purple-400',
  green: 'text-green-400',
  orange: 'text-orange-400',
  blue: 'text-blue-400',
  red: 'text-red-400',
  emerald: 'text-emerald-400',
  yellow: 'text-yellow-400',
  pink: 'text-pink-400',
  indigo: 'text-indigo-400',
  teal: 'text-teal-400',
};

const difficultyBadge: Record<PathDifficulty, { label: string; class: string }> = {
  beginner: { label: 'Beginner', class: 'bg-green-500/20 text-green-400 border-green-500/30' },
  intermediate: { label: 'Intermediate', class: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  advanced: { label: 'Advanced', class: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  expert: { label: 'Expert', class: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

function PathCard({ path }: { path: LearningPath }) {
  const Icon = iconMap[path.icon] || Sparkles;
  const colorClass = colorMap[path.color] || colorMap.cyan;
  const iconClass = iconColorMap[path.color] || iconColorMap.cyan;
  const badge = difficultyBadge[path.difficulty];
  const termCount = getPathTermCount(path);
  const { getPathCompletion, checkPathCompleted, isLoaded } = useProgressContext();

  const completion = isLoaded ? getPathCompletion(path.slug, path.modules.length) : 0;
  const isCompleted = isLoaded ? checkPathCompleted(path.slug) : false;

  return (
    <Link
      href={`/paths/${path.slug}`}
      className={`block p-6 rounded-xl border bg-gradient-to-br ${colorClass} transition-all hover:scale-[1.02] group relative`}
    >
      {/* Completion badge */}
      {isCompleted && (
        <div className="absolute top-3 right-3">
          <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-white" />
          </div>
        </div>
      )}

      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-lg bg-gray-800/50 ${iconClass}`}>
          <Icon className="w-6 h-6" />
        </div>
        {!isCompleted && (
          <span className={`text-xs px-2 py-1 rounded-full border ${badge.class}`}>
            {badge.label}
          </span>
        )}
      </div>

      <h3 className="text-lg font-bold text-white mb-2 group-hover:text-cyan-300 transition-colors">
        {path.title}
      </h3>

      <p className="text-sm text-gray-400 mb-4 line-clamp-2">
        {path.description}
      </p>

      {/* Progress bar */}
      {completion > 0 && !isCompleted && (
        <div className="mb-3">
          <ProgressBar value={completion} size="sm" color="cyan" />
          <p className="text-xs text-gray-500 mt-1">{completion}% complete</p>
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          <span>{path.estimatedHours}h</span>
        </div>
        <div className="flex items-center gap-1">
          <BookOpen className="w-3.5 h-3.5" />
          <span>{path.modules.length} modules</span>
        </div>
        <div className="flex items-center gap-1">
          <Target className="w-3.5 h-3.5" />
          <span>{termCount} terms</span>
        </div>
      </div>

      {path.prerequisites && path.prerequisites.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-700/50">
          <p className="text-xs text-gray-500">
            Requires: {path.prerequisites.join(', ')}
          </p>
        </div>
      )}
    </Link>
  );
}

function StartHereCard() {
  const starterPaths = getStarterPaths();

  return (
    <div className="bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10 border border-cyan-500/20 rounded-xl p-6 mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-cyan-500/20">
          <Sparkles className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">New to AI?</h2>
          <p className="text-sm text-gray-400">Start with these foundational paths</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {starterPaths.slice(0, 2).map(path => (
          <Link
            key={path.slug}
            href={`/paths/${path.slug}`}
            className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span className="text-sm text-white group-hover:text-cyan-300 transition-colors">
                {path.title}
              </span>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-cyan-400 transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function LearningPathsPage() {
  const [selectedDifficulty, setSelectedDifficulty] = useState<PathDifficulty | 'all'>('all');
  const allPaths = getAllPaths();

  const filteredPaths = selectedDifficulty === 'all'
    ? allPaths
    : getPathsByDifficulty(selectedDifficulty);

  const difficulties: (PathDifficulty | 'all')[] = ['all', 'beginner', 'intermediate', 'advanced', 'expert'];

  return (
    <>
      <Navbar />

      <main className="flex-grow pt-24 pb-12 px-4 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
            Learning Paths
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Structured curricula that guide you from fundamentals to mastery.
            Each path connects related concepts in a logical progression.
          </p>
        </div>

        {/* User Progress & Start Here Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <StartHereCard />
          </div>
          <div>
            <StatsCard />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {difficulties.map(difficulty => (
            <button
              key={difficulty}
              onClick={() => setSelectedDifficulty(difficulty)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedDifficulty === difficulty
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                  : 'bg-gray-800/50 text-gray-400 border border-gray-700 hover:border-gray-600'
              }`}
            >
              {difficulty === 'all' ? 'All Paths' : difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50">
            <div className="text-2xl font-bold text-white">{allPaths.length}</div>
            <div className="text-sm text-gray-500">Learning Paths</div>
          </div>
          <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50">
            <div className="text-2xl font-bold text-white">
              {allPaths.reduce((acc, p) => acc + p.modules.length, 0)}
            </div>
            <div className="text-sm text-gray-500">Total Modules</div>
          </div>
          <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50">
            <div className="text-2xl font-bold text-white">
              {Math.round(allPaths.reduce((acc, p) => acc + p.estimatedHours, 0))}h
            </div>
            <div className="text-sm text-gray-500">Total Content</div>
          </div>
          <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50">
            <div className="text-2xl font-bold text-white">
              {allPaths.reduce((acc, p) => acc + getPathTermCount(p), 0)}
            </div>
            <div className="text-sm text-gray-500">Terms Covered</div>
          </div>
        </div>

        {/* Paths Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPaths.map(path => (
            <PathCard key={path.slug} path={path} />
          ))}
        </div>

        {filteredPaths.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No paths found for this difficulty level.</p>
          </div>
        )}

        {/* Learning Path Flow */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            Recommended Learning Journey
          </h2>
          <div className="max-w-4xl mx-auto">
            <div className="relative">
              {/* Connector Line */}
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-cyan-500 via-purple-500 to-pink-500 hidden md:block" />

              {/* Journey Steps */}
              <div className="space-y-6">
                {['beginner', 'intermediate', 'advanced', 'expert'].map((level, idx) => {
                  const levelPaths = getPathsByDifficulty(level as PathDifficulty);
                  const badge = difficultyBadge[level as PathDifficulty];

                  return (
                    <div key={level} className="relative flex gap-4">
                      {/* Node */}
                      <div className="hidden md:flex w-16 h-16 rounded-full bg-gray-800 border-2 border-gray-700 items-center justify-center z-10 shrink-0">
                        <span className="text-lg font-bold text-white">{idx + 1}</span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 bg-gray-800/30 rounded-xl border border-gray-700/50 p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <span className={`text-xs px-2 py-1 rounded-full border ${badge.class}`}>
                            {badge.label}
                          </span>
                          <span className="text-sm text-gray-500">
                            {levelPaths.length} path{levelPaths.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {levelPaths.map(path => (
                            <Link
                              key={path.slug}
                              href={`/paths/${path.slug}`}
                              className="text-sm text-gray-300 hover:text-cyan-400 transition-colors flex items-center gap-1"
                            >
                              <ChevronRight className="w-3 h-3" />
                              {path.title}
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} Vorion Risk, LLC. Content licensed under CC BY 4.0.
          </p>
          <div className="flex gap-4 text-sm text-gray-500">
            <Link href="/lexicon" className="hover:text-cyan-400 transition-colors">
              Lexicon
            </Link>
            <Link href="/docs" className="hover:text-cyan-400 transition-colors">
              Docs
            </Link>
            <a href="https://vorion.org" className="hover:text-cyan-400 transition-colors">
              Vorion
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
