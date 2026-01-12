'use client';

import { useState } from 'react';
import { useParams, notFound } from 'next/navigation';
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
  ArrowLeft,
  Clock,
  BookOpen,
  Target,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Play,
} from 'lucide-react';
import { getPathBySlug, getNextPaths, getPathTermCount } from '@/lib/learning-paths';
import { getLexiconTerm } from '@/lib/lexicon-data';
import type { LearningPath, LearningPathModule, PathDifficulty } from '@/types';

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

function ModuleCard({ module, index, isExpanded, onToggle, pathColor }: {
  module: LearningPathModule;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  pathColor: string;
}) {
  const iconClass = iconColorMap[pathColor] || iconColorMap.cyan;

  return (
    <div className="border border-gray-700/50 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-4 hover:bg-gray-800/30 transition-colors text-left"
      >
        <div className={`w-10 h-10 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center shrink-0 ${iconClass}`}>
          <span className="text-sm font-bold">{index + 1}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium">{module.title}</h3>
          <p className="text-sm text-gray-500 truncate">{module.description}</p>
        </div>
        <div className="flex items-center gap-3 text-gray-500">
          <span className="text-xs">{module.estimatedMinutes} min</span>
          <span className="text-xs">{module.terms.length} terms</span>
          {isExpanded ? (
            <ChevronDown className="w-5 h-5" />
          ) : (
            <ChevronRight className="w-5 h-5" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-700/50 pt-4">
          {/* Objectives */}
          <div>
            <h4 className="text-xs uppercase tracking-wider text-gray-500 mb-2">Learning Objectives</h4>
            <ul className="space-y-1">
              {module.objectives.map((obj, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  {obj}
                </li>
              ))}
            </ul>
          </div>

          {/* Terms */}
          <div>
            <h4 className="text-xs uppercase tracking-wider text-gray-500 mb-2">Terms to Learn</h4>
            <div className="flex flex-wrap gap-2">
              {module.terms.map(termName => {
                const term = getLexiconTerm(termName);
                return (
                  <Link
                    key={termName}
                    href={`/lexicon?term=${encodeURIComponent(termName)}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-cyan-500/50 rounded-lg text-sm text-gray-300 hover:text-cyan-300 transition-colors group"
                  >
                    {termName}
                    {term && (
                      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NextPathCard({ path }: { path: LearningPath }) {
  const Icon = iconMap[path.icon] || Sparkles;
  const iconClass = iconColorMap[path.color] || iconColorMap.cyan;
  const badge = difficultyBadge[path.difficulty];

  return (
    <Link
      href={`/paths/${path.slug}`}
      className="flex items-center gap-4 p-4 bg-gray-800/30 hover:bg-gray-800/50 border border-gray-700/50 hover:border-gray-600 rounded-xl transition-colors group"
    >
      <div className={`p-2 rounded-lg bg-gray-800/50 ${iconClass}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-white font-medium group-hover:text-cyan-300 transition-colors">
          {path.title}
        </h4>
        <p className="text-sm text-gray-500 truncate">{path.description}</p>
      </div>
      <span className={`text-xs px-2 py-1 rounded-full border ${badge.class} shrink-0`}>
        {badge.label}
      </span>
    </Link>
  );
}

export default function LearningPathDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const path = getPathBySlug(slug);

  const [expandedModules, setExpandedModules] = useState<Set<string>>(() => {
    const firstModuleId = path?.modules[0]?.id;
    return firstModuleId ? new Set([firstModuleId]) : new Set();
  });

  if (!path) {
    notFound();
  }

  const Icon = iconMap[path.icon] || Sparkles;
  const iconClass = iconColorMap[path.color] || iconColorMap.cyan;
  const badge = difficultyBadge[path.difficulty];
  const termCount = getPathTermCount(path);
  const nextPaths = getNextPaths(path.slug);

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedModules(new Set(path.modules.map(m => m.id)));
  };

  const collapseAll = () => {
    setExpandedModules(new Set());
  };

  return (
    <>
      <Navbar />

      <main className="flex-grow pt-24 pb-12 px-4 max-w-5xl mx-auto w-full">
        {/* Back Link */}
        <Link
          href="/paths"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Learning Paths
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start gap-4 mb-4">
            <div className={`p-4 rounded-xl bg-gray-800/50 border border-gray-700/50 ${iconClass}`}>
              <Icon className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl md:text-3xl font-bold text-white">
                  {path.title}
                </h1>
                <span className={`text-xs px-2 py-1 rounded-full border ${badge.class}`}>
                  {badge.label}
                </span>
              </div>
              <p className="text-gray-400">
                {path.description}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span>{path.estimatedHours} hours</span>
            </div>
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4" />
              <span>{path.modules.length} modules</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Target className="w-4 h-4" />
              <span>{termCount} terms</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Prerequisites */}
            {path.prerequisites && path.prerequisites.length > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                <h3 className="text-sm font-medium text-yellow-400 mb-2">Prerequisites</h3>
                <p className="text-sm text-gray-400">
                  Complete these paths first: {path.prerequisites.join(', ')}
                </p>
              </div>
            )}

            {/* Modules */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Modules</h2>
                <div className="flex gap-2">
                  <button
                    onClick={expandAll}
                    className="text-xs text-gray-500 hover:text-cyan-400 transition-colors"
                  >
                    Expand All
                  </button>
                  <span className="text-gray-600">|</span>
                  <button
                    onClick={collapseAll}
                    className="text-xs text-gray-500 hover:text-cyan-400 transition-colors"
                  >
                    Collapse All
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {path.modules.map((module, index) => (
                  <ModuleCard
                    key={module.id}
                    module={module}
                    index={index}
                    isExpanded={expandedModules.has(module.id)}
                    onToggle={() => toggleModule(module.id)}
                    pathColor={path.color}
                  />
                ))}
              </div>
            </section>

            {/* Outcomes */}
            <section className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-6">
              <h2 className="text-lg font-bold text-white mb-4">What You&apos;ll Be Able To Do</h2>
              <ul className="space-y-2">
                {path.outcomes.map((outcome, i) => (
                  <li key={i} className="flex items-start gap-3 text-gray-300">
                    <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                    {outcome}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Start Learning CTA */}
            <div className="bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-2">Ready to Start?</h3>
              <p className="text-sm text-gray-400 mb-4">
                Begin with Module 1 and work through each section in order.
              </p>
              {path.modules[0] && (
                <Link
                  href={`/lexicon?term=${encodeURIComponent(path.modules[0].terms[0])}`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-medium rounded-lg transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Start Learning
                </Link>
              )}
            </div>

            {/* Tags */}
            <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Topics Covered</h3>
              <div className="flex flex-wrap gap-2">
                {path.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-1 text-xs bg-gray-800 text-gray-400 rounded-lg"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Next Paths */}
            {nextPaths.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-3">Continue Learning</h3>
                <div className="space-y-2">
                  {nextPaths.slice(0, 3).map(nextPath => (
                    <NextPathCard key={nextPath.slug} path={nextPath} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
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
            <Link href="/paths" className="hover:text-cyan-400 transition-colors">
              Paths
            </Link>
            <Link href="/docs" className="hover:text-cyan-400 transition-colors">
              Docs
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}
