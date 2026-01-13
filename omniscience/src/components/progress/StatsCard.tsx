'use client';

import {
  BookOpen,
  CheckCircle2,
  Trophy,
  Flame,
  Target,
  GraduationCap,
} from 'lucide-react';
import { useProgressContext } from '@/contexts';

export function StatsCard() {
  const { stats, isLoaded } = useProgressContext();

  if (!isLoaded || !stats) {
    return (
      <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-gray-700 rounded w-24 mb-4" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-12 bg-gray-700/50 rounded" />
          ))}
        </div>
      </div>
    );
  }

  const statItems = [
    {
      icon: BookOpen,
      label: 'Terms Viewed',
      value: stats.totalTermsViewed,
      color: 'text-cyan-400',
    },
    {
      icon: CheckCircle2,
      label: 'Terms Mastered',
      value: stats.totalTermsMastered,
      color: 'text-green-400',
    },
    {
      icon: Target,
      label: 'Modules Done',
      value: stats.totalModulesCompleted,
      color: 'text-purple-400',
    },
    {
      icon: Trophy,
      label: 'Paths Done',
      value: stats.totalPathsCompleted,
      color: 'text-yellow-400',
    },
    {
      icon: GraduationCap,
      label: 'Quizzes Taken',
      value: stats.totalQuizzesTaken,
      color: 'text-blue-400',
    },
    {
      icon: Flame,
      label: 'Day Streak',
      value: stats.streakDays,
      color: 'text-orange-400',
    },
  ];

  return (
    <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4">
      <h3 className="text-sm font-medium text-gray-400 mb-3">Your Progress</h3>
      <div className="grid grid-cols-2 gap-3">
        {statItems.map(item => (
          <div
            key={item.label}
            className="flex items-center gap-2 p-2 bg-gray-800/50 rounded-lg"
          >
            <item.icon className={`w-4 h-4 ${item.color}`} />
            <div>
              <div className="text-lg font-bold text-white">{item.value}</div>
              <div className="text-xs text-gray-500">{item.label}</div>
            </div>
          </div>
        ))}
      </div>
      {stats.averageQuizScore > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-700/50 text-center">
          <span className="text-xs text-gray-500">Avg Quiz Score: </span>
          <span className="text-sm font-medium text-white">{stats.averageQuizScore}%</span>
        </div>
      )}
    </div>
  );
}
