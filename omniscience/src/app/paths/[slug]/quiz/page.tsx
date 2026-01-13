'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, notFound } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/nexus';
import { Quiz } from '@/components/quiz';
import {
  ArrowLeft,
  BookOpen,
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
} from 'lucide-react';
import { getPathBySlug } from '@/lib/learning-paths';
import { generateModuleQuiz, generatePathQuiz, getQuizStats } from '@/lib/quiz-data';
import type { Quiz as QuizType, PathDifficulty } from '@/types';

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

export default function PathQuizPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const moduleId = searchParams.get('module');

  const [quiz, setQuiz] = useState<QuizType | null>(null);
  const [quizKey, setQuizKey] = useState(0);

  const path = getPathBySlug(slug);

  useEffect(() => {
    if (!path) return;

    // Generate the appropriate quiz
    let generatedQuiz: QuizType | null = null;

    if (moduleId) {
      generatedQuiz = generateModuleQuiz(slug, moduleId);
    } else {
      generatedQuiz = generatePathQuiz(slug, 15);
    }

    setQuiz(generatedQuiz);
  }, [slug, moduleId, path]);

  if (!path) {
    notFound();
  }

  const Icon = iconMap[path.icon] || Sparkles;
  const iconClass = iconColorMap[path.color] || iconColorMap.cyan;
  const badge = difficultyBadge[path.difficulty];

  const moduleName = moduleId
    ? path.modules.find(m => m.id === moduleId)?.title
    : null;

  const handleRetry = () => {
    // Regenerate quiz on retry
    let generatedQuiz: QuizType | null = null;
    if (moduleId) {
      generatedQuiz = generateModuleQuiz(slug, moduleId);
    } else {
      generatedQuiz = generatePathQuiz(slug, 15);
    }
    setQuiz(generatedQuiz);
    setQuizKey(prev => prev + 1);
  };

  return (
    <>
      <Navbar />

      <main className="flex-grow pt-24 pb-12 px-4 max-w-5xl mx-auto w-full">
        {/* Back Link */}
        <Link
          href={`/paths/${path.slug}`}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {path.title}
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2 rounded-lg bg-gray-800/50 ${iconClass}`}>
              <Icon className="w-5 h-5" />
            </div>
            <span className={`text-xs px-2 py-1 rounded-full border ${badge.class}`}>
              {badge.label}
            </span>
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            {moduleName ? `${moduleName} Quiz` : `${path.title} Quiz`}
          </h1>
          <p className="text-gray-400">
            {moduleName
              ? `Test your knowledge of concepts from the "${moduleName}" module.`
              : `Comprehensive quiz covering all topics in "${path.title}".`
            }
          </p>
        </div>

        {/* Quiz or No Questions Message */}
        {quiz && quiz.questions.length > 0 ? (
          <Quiz key={quizKey} quiz={quiz} onRetry={handleRetry} />
        ) : (
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-8">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <BookOpen className="w-8 h-8 text-yellow-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">No Quiz Available Yet</h2>
              <p className="text-gray-400 mb-6">
                {moduleName
                  ? `Quiz questions for the "${moduleName}" module are being developed.`
                  : `Quiz questions for this learning path are being developed.`
                }
              </p>
              <Link
                href={`/paths/${path.slug}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Return to Path
              </Link>
            </div>
          </div>
        )}

        {/* Module Navigation (if full path quiz) */}
        {!moduleId && path.modules.length > 1 && (
          <div className="mt-12 border-t border-gray-800 pt-8">
            <h3 className="text-lg font-medium text-white mb-4">Quiz by Module</h3>
            <p className="text-sm text-gray-400 mb-4">
              Want to focus on specific topics? Take a quiz for individual modules:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {path.modules.map((module, index) => (
                <Link
                  key={module.id}
                  href={`/paths/${path.slug}/quiz?module=${module.id}`}
                  className="flex items-center gap-3 p-3 bg-gray-800/30 hover:bg-gray-800/50 border border-gray-700/50 hover:border-gray-600 rounded-lg transition-colors group"
                >
                  <span className={`w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-sm font-medium ${iconClass}`}>
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white group-hover:text-cyan-300 transition-colors truncate">
                      {module.title}
                    </p>
                    <p className="text-xs text-gray-500">{module.terms.length} terms</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
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
