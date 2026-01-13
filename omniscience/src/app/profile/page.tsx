'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/nexus';
import { ProgressBar } from '@/components/progress';
import { useProgressContext } from '@/contexts';
import { getAllPaths, getPathBySlug } from '@/lib/learning-paths';
import {
  User,
  Trophy,
  Flame,
  BookOpen,
  Target,
  GraduationCap,
  CheckCircle2,
  Clock,
  Calendar,
  TrendingUp,
  Download,
  Upload,
  RotateCcw,
  ChevronRight,
  AlertTriangle,
  Sparkles,
  Award,
  Zap,
} from 'lucide-react';

// Achievement definitions
const achievements = [
  { id: 'first-term', name: 'First Steps', description: 'View your first term', icon: BookOpen, threshold: 1, stat: 'termsViewed' },
  { id: 'ten-terms', name: 'Knowledge Seeker', description: 'View 10 terms', icon: BookOpen, threshold: 10, stat: 'termsViewed' },
  { id: 'fifty-terms', name: 'Scholar', description: 'View 50 terms', icon: BookOpen, threshold: 50, stat: 'termsViewed' },
  { id: 'hundred-terms', name: 'Expert Reader', description: 'View 100 terms', icon: BookOpen, threshold: 100, stat: 'termsViewed' },
  { id: 'first-mastery', name: 'First Mastery', description: 'Master your first term', icon: CheckCircle2, threshold: 1, stat: 'termsMastered' },
  { id: 'ten-mastery', name: 'Rising Star', description: 'Master 10 terms', icon: CheckCircle2, threshold: 10, stat: 'termsMastered' },
  { id: 'first-quiz', name: 'Quiz Taker', description: 'Complete your first quiz', icon: GraduationCap, threshold: 1, stat: 'quizzesTaken' },
  { id: 'ten-quizzes', name: 'Quiz Champion', description: 'Complete 10 quizzes', icon: GraduationCap, threshold: 10, stat: 'quizzesTaken' },
  { id: 'first-module', name: 'Module Complete', description: 'Complete your first module', icon: Target, threshold: 1, stat: 'modulesCompleted' },
  { id: 'five-modules', name: 'Module Master', description: 'Complete 5 modules', icon: Target, threshold: 5, stat: 'modulesCompleted' },
  { id: 'first-path', name: 'Pathfinder', description: 'Complete your first path', icon: Trophy, threshold: 1, stat: 'pathsCompleted' },
  { id: 'three-paths', name: 'Trailblazer', description: 'Complete 3 paths', icon: Trophy, threshold: 3, stat: 'pathsCompleted' },
  { id: 'week-streak', name: 'Consistent Learner', description: '7-day learning streak', icon: Flame, threshold: 7, stat: 'streakDays' },
  { id: 'month-streak', name: 'Dedicated Scholar', description: '30-day learning streak', icon: Flame, threshold: 30, stat: 'streakDays' },
];

function StatCard({ icon: Icon, label, value, subtext, color = 'cyan' }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subtext?: string;
  color?: 'cyan' | 'green' | 'purple' | 'orange' | 'yellow' | 'blue';
}) {
  const colorClasses = {
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    green: 'text-green-400 bg-green-500/10 border-green-500/30',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    orange: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  };

  return (
    <div className={`p-4 rounded-xl border ${colorClasses[color]}`}>
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5" />
        <div>
          <div className="text-2xl font-bold text-white">{value}</div>
          <div className="text-sm text-gray-400">{label}</div>
          {subtext && <div className="text-xs text-gray-500 mt-1">{subtext}</div>}
        </div>
      </div>
    </div>
  );
}

function AchievementBadge({ achievement, unlocked, progress }: {
  achievement: typeof achievements[0];
  unlocked: boolean;
  progress: number;
}) {
  const Icon = achievement.icon;

  return (
    <div className={`p-4 rounded-xl border transition-all ${
      unlocked
        ? 'bg-yellow-500/10 border-yellow-500/30'
        : 'bg-gray-800/30 border-gray-700/50 opacity-60'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${unlocked ? 'bg-yellow-500/20' : 'bg-gray-800'}`}>
          <Icon className={`w-5 h-5 ${unlocked ? 'text-yellow-400' : 'text-gray-500'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className={`font-medium ${unlocked ? 'text-yellow-400' : 'text-gray-400'}`}>
              {achievement.name}
            </h4>
            {unlocked && <Award className="w-4 h-4 text-yellow-400" />}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{achievement.description}</p>
          {!unlocked && (
            <div className="mt-2">
              <ProgressBar value={(progress / achievement.threshold) * 100} size="sm" color="cyan" />
              <p className="text-xs text-gray-500 mt-1">{progress} / {achievement.threshold}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const {
    progress,
    stats,
    isLoaded,
    exportData,
    importData,
    resetProgress,
    getPathInfo,
    checkPathCompleted,
  } = useProgressContext();

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  const allPaths = getAllPaths();

  // Calculate derived stats
  const derivedStats = useMemo(() => {
    if (!stats || !progress) return null;

    const recentTerms = Object.entries(progress.terms)
      .sort((a, b) => new Date(b[1].lastViewed).getTime() - new Date(a[1].lastViewed).getTime())
      .slice(0, 5)
      .map(([term, data]) => ({ term, ...data }));

    const activePaths = allPaths
      .filter(p => progress.paths[p.slug] && !progress.paths[p.slug].completed)
      .map(p => ({
        ...p,
        progress: progress.paths[p.slug],
        completedModules: Object.values(progress.paths[p.slug].modulesProgress).filter(m => m.completed).length,
      }));

    const completedPaths = allPaths
      .filter(p => progress.paths[p.slug]?.completed)
      .map(p => ({
        ...p,
        progress: progress.paths[p.slug],
        completedAt: progress.paths[p.slug].completed,
      }));

    // Calculate achievements
    const statMap: Record<string, number> = {
      termsViewed: stats.totalTermsViewed,
      termsMastered: stats.totalTermsMastered,
      quizzesTaken: stats.totalQuizzesTaken,
      modulesCompleted: stats.totalModulesCompleted,
      pathsCompleted: stats.totalPathsCompleted,
      streakDays: stats.streakDays,
    };

    const unlockedAchievements = achievements.filter(a => statMap[a.stat] >= a.threshold);
    const lockedAchievements = achievements.filter(a => statMap[a.stat] < a.threshold);

    return {
      recentTerms,
      activePaths,
      completedPaths,
      unlockedAchievements,
      lockedAchievements,
      statMap,
    };
  }, [stats, progress, allPaths]);

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `omniscience-progress-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportSuccess(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const success = importData(content);
      if (success) {
        setImportSuccess(true);
        setTimeout(() => setImportSuccess(false), 3000);
      } else {
        setImportError('Invalid progress file. Please check the format.');
      }
    };
    reader.onerror = () => {
      setImportError('Failed to read file.');
    };
    reader.readAsText(file);

    // Reset input
    event.target.value = '';
  };

  const handleReset = () => {
    resetProgress();
    setShowResetConfirm(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateString);
  };

  if (!isLoaded) {
    return (
      <>
        <Navbar />
        <main className="flex-grow pt-24 pb-12 px-4 max-w-5xl mx-auto w-full">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-800 rounded w-48" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 bg-gray-800/50 rounded-xl" />
              ))}
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <main className="flex-grow pt-24 pb-12 px-4 max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Your Profile</h1>
              <p className="text-gray-400">Track your learning journey</p>
            </div>
          </div>

          {/* Data Management */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-gray-800 rounded-lg transition-colors"
              title="Export Progress"
            >
              <Download className="w-5 h-5" />
            </button>
            <label className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-gray-800 rounded-lg transition-colors cursor-pointer" title="Import Progress">
              <Upload className="w-5 h-5" />
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </label>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
              title="Reset Progress"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Import/Export Feedback */}
        {importError && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-400">
            <AlertTriangle className="w-5 h-5" />
            {importError}
          </div>
        )}
        {importSuccess && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-3 text-green-400">
            <CheckCircle2 className="w-5 h-5" />
            Progress imported successfully!
          </div>
        )}

        {/* Reset Confirmation Modal */}
        {showResetConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md mx-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-red-500/20">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                </div>
                <h2 className="text-xl font-bold text-white">Reset Progress?</h2>
              </div>
              <p className="text-gray-400 mb-6">
                This will permanently delete all your learning progress, including terms viewed,
                quiz scores, and achievements. This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-red-500 hover:bg-red-400 text-white rounded-lg transition-colors"
                >
                  Reset Everything
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={BookOpen}
            label="Terms Viewed"
            value={stats?.totalTermsViewed ?? 0}
            color="cyan"
          />
          <StatCard
            icon={CheckCircle2}
            label="Terms Mastered"
            value={stats?.totalTermsMastered ?? 0}
            color="green"
          />
          <StatCard
            icon={Target}
            label="Modules Done"
            value={stats?.totalModulesCompleted ?? 0}
            color="purple"
          />
          <StatCard
            icon={Trophy}
            label="Paths Completed"
            value={stats?.totalPathsCompleted ?? 0}
            color="yellow"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={GraduationCap}
            label="Quizzes Taken"
            value={stats?.totalQuizzesTaken ?? 0}
            color="blue"
          />
          <StatCard
            icon={TrendingUp}
            label="Avg Quiz Score"
            value={`${stats?.averageQuizScore ?? 0}%`}
            color="green"
          />
          <StatCard
            icon={Flame}
            label="Day Streak"
            value={stats?.streakDays ?? 0}
            subtext={stats?.streakDays === 0 ? 'Start learning!' : 'Keep it up!'}
            color="orange"
          />
          <StatCard
            icon={Calendar}
            label="Last Active"
            value={stats?.lastActiveDate ? formatRelativeTime(stats.lastActiveDate) : 'Never'}
            color="cyan"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Achievements */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-yellow-400" />
                Achievements
              </h2>
              <span className="text-sm text-gray-500">
                {derivedStats?.unlockedAchievements.length ?? 0} / {achievements.length} unlocked
              </span>
            </div>

            <div className="space-y-3">
              {/* Unlocked achievements */}
              {derivedStats?.unlockedAchievements.map(achievement => (
                <AchievementBadge
                  key={achievement.id}
                  achievement={achievement}
                  unlocked={true}
                  progress={derivedStats.statMap[achievement.stat]}
                />
              ))}

              {/* Next achievements to unlock */}
              {derivedStats?.lockedAchievements.slice(0, 3).map(achievement => (
                <AchievementBadge
                  key={achievement.id}
                  achievement={achievement}
                  unlocked={false}
                  progress={derivedStats.statMap[achievement.stat]}
                />
              ))}

              {(derivedStats?.lockedAchievements.length ?? 0) > 3 && (
                <p className="text-sm text-gray-500 text-center py-2">
                  +{(derivedStats?.lockedAchievements.length ?? 0) - 3} more achievements to unlock
                </p>
              )}
            </div>
          </section>

          {/* Learning Activity */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-cyan-400" />
              Recent Activity
            </h2>

            {/* Recently Viewed Terms */}
            {derivedStats && derivedStats.recentTerms.length > 0 && (
              <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4 mb-4">
                <h3 className="text-sm font-medium text-gray-400 mb-3">Recently Viewed Terms</h3>
                <div className="space-y-2">
                  {derivedStats.recentTerms.map(({ term, lastViewed, mastered }) => (
                    <Link
                      key={term}
                      href={`/lexicon?term=${encodeURIComponent(term)}`}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-800/50 transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        {mastered ? (
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                        ) : (
                          <BookOpen className="w-4 h-4 text-gray-500" />
                        )}
                        <span className="text-white capitalize group-hover:text-cyan-300 transition-colors">
                          {term}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">{formatRelativeTime(lastViewed)}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Active Paths */}
            {derivedStats && derivedStats.activePaths.length > 0 && (
              <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4 mb-4">
                <h3 className="text-sm font-medium text-gray-400 mb-3">Paths In Progress</h3>
                <div className="space-y-3">
                  {derivedStats.activePaths.map(path => (
                    <Link
                      key={path.slug}
                      href={`/paths/${path.slug}`}
                      className="block p-3 rounded-lg hover:bg-gray-800/50 transition-colors group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white group-hover:text-cyan-300 transition-colors">
                          {path.title}
                        </span>
                        <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-cyan-400 transition-colors" />
                      </div>
                      <ProgressBar
                        value={(path.completedModules / path.modules.length) * 100}
                        size="sm"
                        color="cyan"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {path.completedModules} / {path.modules.length} modules
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Completed Paths */}
            {derivedStats && derivedStats.completedPaths.length > 0 && (
              <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
                <h3 className="text-sm font-medium text-green-400 mb-3 flex items-center gap-2">
                  <Trophy className="w-4 h-4" />
                  Completed Paths
                </h3>
                <div className="space-y-2">
                  {derivedStats.completedPaths.map(path => (
                    <Link
                      key={path.slug}
                      href={`/paths/${path.slug}`}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-green-500/10 transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                        <span className="text-white group-hover:text-green-300 transition-colors">
                          {path.title}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {path.completedAt ? formatDate(path.completedAt) : ''}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {derivedStats &&
              derivedStats.recentTerms.length === 0 &&
              derivedStats.activePaths.length === 0 &&
              derivedStats.completedPaths.length === 0 && (
              <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-8 text-center">
                <Sparkles className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">Start Your Journey</h3>
                <p className="text-gray-400 mb-4">
                  Begin exploring learning paths to track your progress here.
                </p>
                <Link
                  href="/paths"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-medium rounded-lg transition-colors"
                >
                  Browse Paths
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </section>
        </div>

        {/* Progress Details */}
        {progress && Object.keys(progress.terms).length > 0 && (
          <section className="mt-8">
            <h2 className="text-xl font-bold text-white mb-4">Progress Overview</h2>

            <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Term Mastery */}
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-3">Term Mastery</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Mastered</span>
                      <span className="text-green-400">{stats?.totalTermsMastered ?? 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Viewed Only</span>
                      <span className="text-cyan-400">
                        {(stats?.totalTermsViewed ?? 0) - (stats?.totalTermsMastered ?? 0)}
                      </span>
                    </div>
                    <ProgressBar
                      value={stats?.totalTermsViewed ? (stats.totalTermsMastered / stats.totalTermsViewed) * 100 : 0}
                      size="md"
                      color="green"
                    />
                    <p className="text-xs text-gray-500">
                      {stats?.totalTermsViewed ? Math.round((stats.totalTermsMastered / stats.totalTermsViewed) * 100) : 0}% mastery rate
                    </p>
                  </div>
                </div>

                {/* Path Progress */}
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-3">Learning Paths</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Completed</span>
                      <span className="text-green-400">{stats?.totalPathsCompleted ?? 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">In Progress</span>
                      <span className="text-cyan-400">{derivedStats?.activePaths.length ?? 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Not Started</span>
                      <span className="text-gray-400">
                        {allPaths.length - (stats?.totalPathsCompleted ?? 0) - (derivedStats?.activePaths.length ?? 0)}
                      </span>
                    </div>
                    <ProgressBar
                      value={(stats?.totalPathsCompleted ?? 0) / allPaths.length * 100}
                      size="md"
                      color="purple"
                    />
                  </div>
                </div>

                {/* Quiz Performance */}
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-3">Quiz Performance</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Total Quizzes</span>
                      <span className="text-blue-400">{stats?.totalQuizzesTaken ?? 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Average Score</span>
                      <span className={`${(stats?.averageQuizScore ?? 0) >= 70 ? 'text-green-400' : 'text-yellow-400'}`}>
                        {stats?.averageQuizScore ?? 0}%
                      </span>
                    </div>
                    <ProgressBar
                      value={stats?.averageQuizScore ?? 0}
                      size="md"
                      color={(stats?.averageQuizScore ?? 0) >= 70 ? 'green' : 'orange'}
                    />
                    <p className="text-xs text-gray-500">
                      {(stats?.averageQuizScore ?? 0) >= 70 ? 'Great performance!' : 'Keep practicing!'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Account Info */}
              <div className="mt-6 pt-6 border-t border-gray-700/50 flex flex-wrap gap-6 text-sm text-gray-500">
                <div>
                  <span className="text-gray-400">Started learning: </span>
                  {progress.createdAt ? formatDate(progress.createdAt) : 'Unknown'}
                </div>
                <div>
                  <span className="text-gray-400">Last updated: </span>
                  {progress.updatedAt ? formatRelativeTime(progress.updatedAt) : 'Unknown'}
                </div>
              </div>
            </div>
          </section>
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
