/**
 * User Progress Tracking with localStorage
 *
 * Tracks learning progress including:
 * - Terms viewed/learned
 * - Modules completed
 * - Path progress
 * - Quiz attempts and scores
 */

import type { QuizAttempt } from '@/types';

// Storage keys
const STORAGE_KEYS = {
  PROGRESS: 'omniscience_progress',
  VERSION: 'omniscience_progress_version',
} as const;

const CURRENT_VERSION = 1;

// Progress data structure
export interface TermProgress {
  firstViewed: string; // ISO date
  lastViewed: string;
  viewCount: number;
  mastered: boolean;
}

export interface ModuleProgress {
  started: string; // ISO date
  completed?: string;
  termsViewed: string[];
  quizAttempts: QuizAttempt[];
  bestScore?: number;
}

export interface PathProgress {
  started: string;
  completed?: string;
  lastAccessed: string;
  modulesProgress: Record<string, ModuleProgress>;
  finalQuizAttempts: QuizAttempt[];
  bestFinalScore?: number;
}

export interface UserProgress {
  version: number;
  createdAt: string;
  updatedAt: string;
  terms: Record<string, TermProgress>;
  paths: Record<string, PathProgress>;
  stats: {
    totalTermsViewed: number;
    totalTermsMastered: number;
    totalModulesCompleted: number;
    totalPathsCompleted: number;
    totalQuizzesTaken: number;
    averageQuizScore: number;
    streakDays: number;
    lastActiveDate: string;
  };
}

// Default progress structure
function createDefaultProgress(): UserProgress {
  const now = new Date().toISOString();
  return {
    version: CURRENT_VERSION,
    createdAt: now,
    updatedAt: now,
    terms: {},
    paths: {},
    stats: {
      totalTermsViewed: 0,
      totalTermsMastered: 0,
      totalModulesCompleted: 0,
      totalPathsCompleted: 0,
      totalQuizzesTaken: 0,
      averageQuizScore: 0,
      streakDays: 0,
      lastActiveDate: now,
    },
  };
}

// Check if we're in browser
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

/**
 * Load progress from localStorage
 */
export function loadProgress(): UserProgress {
  if (!isBrowser()) {
    return createDefaultProgress();
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEYS.PROGRESS);
    if (!stored) {
      return createDefaultProgress();
    }

    const progress = JSON.parse(stored) as UserProgress;

    // Handle version migration if needed
    if (progress.version !== CURRENT_VERSION) {
      return migrateProgress(progress);
    }

    return progress;
  } catch (error) {
    console.error('Failed to load progress:', error);
    return createDefaultProgress();
  }
}

/**
 * Save progress to localStorage
 */
export function saveProgress(progress: UserProgress): void {
  if (!isBrowser()) return;

  try {
    progress.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(progress));
  } catch (error) {
    console.error('Failed to save progress:', error);
  }
}

/**
 * Migrate progress from older versions
 */
function migrateProgress(oldProgress: UserProgress): UserProgress {
  // For now, just create fresh progress if version mismatch
  // In the future, add migration logic here
  const newProgress = createDefaultProgress();

  // Preserve what we can
  if (oldProgress.terms) {
    newProgress.terms = oldProgress.terms;
  }
  if (oldProgress.paths) {
    newProgress.paths = oldProgress.paths;
  }

  // Recalculate stats
  recalculateStats(newProgress);

  return newProgress;
}

/**
 * Recalculate aggregate stats from progress data
 */
export function recalculateStats(progress: UserProgress): void {
  const terms = Object.values(progress.terms);
  const paths = Object.values(progress.paths);

  let totalModulesCompleted = 0;
  let totalQuizzesTaken = 0;
  let totalQuizScore = 0;

  for (const path of paths) {
    const modules = Object.values(path.modulesProgress);
    totalModulesCompleted += modules.filter(m => m.completed).length;

    for (const module of modules) {
      totalQuizzesTaken += module.quizAttempts.length;
      for (const attempt of module.quizAttempts) {
        totalQuizScore += attempt.score;
      }
    }

    totalQuizzesTaken += path.finalQuizAttempts.length;
    for (const attempt of path.finalQuizAttempts) {
      totalQuizScore += attempt.score;
    }
  }

  progress.stats = {
    totalTermsViewed: terms.length,
    totalTermsMastered: terms.filter(t => t.mastered).length,
    totalModulesCompleted,
    totalPathsCompleted: paths.filter(p => p.completed).length,
    totalQuizzesTaken,
    averageQuizScore: totalQuizzesTaken > 0 ? Math.round(totalQuizScore / totalQuizzesTaken) : 0,
    streakDays: calculateStreak(progress),
    lastActiveDate: progress.updatedAt,
  };
}

/**
 * Calculate learning streak in days
 */
function calculateStreak(progress: UserProgress): number {
  const lastActive = new Date(progress.stats.lastActiveDate);
  const today = new Date();

  // Reset time parts for date comparison
  lastActive.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));

  // If last active was today or yesterday, maintain streak
  if (diffDays <= 1) {
    return Math.max(progress.stats.streakDays, 1);
  }

  // Streak broken
  return 0;
}

// ============================================
// TERM PROGRESS FUNCTIONS
// ============================================

/**
 * Mark a term as viewed
 */
export function markTermViewed(progress: UserProgress, termName: string): UserProgress {
  const now = new Date().toISOString();
  const normalizedTerm = termName.toLowerCase();

  if (progress.terms[normalizedTerm]) {
    progress.terms[normalizedTerm].lastViewed = now;
    progress.terms[normalizedTerm].viewCount += 1;
  } else {
    progress.terms[normalizedTerm] = {
      firstViewed: now,
      lastViewed: now,
      viewCount: 1,
      mastered: false,
    };
    progress.stats.totalTermsViewed += 1;
  }

  updateStreak(progress);
  return progress;
}

/**
 * Mark a term as mastered
 */
export function markTermMastered(progress: UserProgress, termName: string): UserProgress {
  const normalizedTerm = termName.toLowerCase();

  if (!progress.terms[normalizedTerm]) {
    markTermViewed(progress, termName);
  }

  if (!progress.terms[normalizedTerm].mastered) {
    progress.terms[normalizedTerm].mastered = true;
    progress.stats.totalTermsMastered += 1;
  }

  return progress;
}

/**
 * Check if a term has been viewed
 */
export function isTermViewed(progress: UserProgress, termName: string): boolean {
  return !!progress.terms[termName.toLowerCase()];
}

/**
 * Check if a term is mastered
 */
export function isTermMastered(progress: UserProgress, termName: string): boolean {
  return progress.terms[termName.toLowerCase()]?.mastered ?? false;
}

/**
 * Get term progress
 */
export function getTermProgress(progress: UserProgress, termName: string): TermProgress | null {
  return progress.terms[termName.toLowerCase()] ?? null;
}

// ============================================
// PATH/MODULE PROGRESS FUNCTIONS
// ============================================

/**
 * Start or continue a learning path
 */
export function startPath(progress: UserProgress, pathSlug: string): UserProgress {
  const now = new Date().toISOString();

  if (!progress.paths[pathSlug]) {
    progress.paths[pathSlug] = {
      started: now,
      lastAccessed: now,
      modulesProgress: {},
      finalQuizAttempts: [],
    };
  } else {
    progress.paths[pathSlug].lastAccessed = now;
  }

  updateStreak(progress);
  return progress;
}

/**
 * Start or continue a module
 */
export function startModule(
  progress: UserProgress,
  pathSlug: string,
  moduleId: string
): UserProgress {
  const now = new Date().toISOString();

  // Ensure path exists
  if (!progress.paths[pathSlug]) {
    startPath(progress, pathSlug);
  }

  const pathProgress = progress.paths[pathSlug];

  if (!pathProgress.modulesProgress[moduleId]) {
    pathProgress.modulesProgress[moduleId] = {
      started: now,
      termsViewed: [],
      quizAttempts: [],
    };
  }

  pathProgress.lastAccessed = now;
  updateStreak(progress);
  return progress;
}

/**
 * Mark a term as viewed within a module context
 */
export function markModuleTermViewed(
  progress: UserProgress,
  pathSlug: string,
  moduleId: string,
  termName: string
): UserProgress {
  // Mark the term globally
  markTermViewed(progress, termName);

  // Ensure module progress exists
  startModule(progress, pathSlug, moduleId);

  const moduleProgress = progress.paths[pathSlug].modulesProgress[moduleId];
  const normalizedTerm = termName.toLowerCase();

  if (!moduleProgress.termsViewed.includes(normalizedTerm)) {
    moduleProgress.termsViewed.push(normalizedTerm);
  }

  return progress;
}

/**
 * Record a module quiz attempt
 */
export function recordModuleQuizAttempt(
  progress: UserProgress,
  pathSlug: string,
  moduleId: string,
  attempt: QuizAttempt
): UserProgress {
  startModule(progress, pathSlug, moduleId);

  const moduleProgress = progress.paths[pathSlug].modulesProgress[moduleId];
  moduleProgress.quizAttempts.push(attempt);

  // Update best score
  if (!moduleProgress.bestScore || attempt.score > moduleProgress.bestScore) {
    moduleProgress.bestScore = attempt.score;
  }

  // Mark module as completed if passed
  if (attempt.passed && !moduleProgress.completed) {
    moduleProgress.completed = new Date().toISOString();
    progress.stats.totalModulesCompleted += 1;
  }

  // Update quiz stats
  progress.stats.totalQuizzesTaken += 1;
  recalculateStats(progress);

  // Mark terms as mastered if quiz passed
  if (attempt.passed) {
    // We'd need term names here - handled by the component
  }

  updateStreak(progress);
  return progress;
}

/**
 * Record a path final quiz attempt
 */
export function recordPathQuizAttempt(
  progress: UserProgress,
  pathSlug: string,
  attempt: QuizAttempt
): UserProgress {
  startPath(progress, pathSlug);

  const pathProgress = progress.paths[pathSlug];
  pathProgress.finalQuizAttempts.push(attempt);

  // Update best score
  if (!pathProgress.bestFinalScore || attempt.score > pathProgress.bestFinalScore) {
    pathProgress.bestFinalScore = attempt.score;
  }

  // Mark path as completed if passed
  if (attempt.passed && !pathProgress.completed) {
    pathProgress.completed = new Date().toISOString();
    progress.stats.totalPathsCompleted += 1;
  }

  progress.stats.totalQuizzesTaken += 1;
  recalculateStats(progress);
  updateStreak(progress);

  return progress;
}

/**
 * Check if a module is completed
 */
export function isModuleCompleted(
  progress: UserProgress,
  pathSlug: string,
  moduleId: string
): boolean {
  return !!progress.paths[pathSlug]?.modulesProgress[moduleId]?.completed;
}

/**
 * Check if a path is completed
 */
export function isPathCompleted(progress: UserProgress, pathSlug: string): boolean {
  return !!progress.paths[pathSlug]?.completed;
}

/**
 * Get module progress
 */
export function getModuleProgress(
  progress: UserProgress,
  pathSlug: string,
  moduleId: string
): ModuleProgress | null {
  return progress.paths[pathSlug]?.modulesProgress[moduleId] ?? null;
}

/**
 * Get path progress
 */
export function getPathProgress(
  progress: UserProgress,
  pathSlug: string
): PathProgress | null {
  return progress.paths[pathSlug] ?? null;
}

/**
 * Calculate path completion percentage
 */
export function getPathCompletionPercent(
  progress: UserProgress,
  pathSlug: string,
  totalModules: number
): number {
  const pathProgress = progress.paths[pathSlug];
  if (!pathProgress || totalModules === 0) return 0;

  const completedModules = Object.values(pathProgress.modulesProgress)
    .filter(m => m.completed).length;

  return Math.round((completedModules / totalModules) * 100);
}

/**
 * Calculate module completion percentage based on terms viewed
 */
export function getModuleCompletionPercent(
  progress: UserProgress,
  pathSlug: string,
  moduleId: string,
  totalTerms: number
): number {
  const moduleProgress = progress.paths[pathSlug]?.modulesProgress[moduleId];
  if (!moduleProgress || totalTerms === 0) return 0;

  return Math.round((moduleProgress.termsViewed.length / totalTerms) * 100);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Update streak tracking
 */
function updateStreak(progress: UserProgress): void {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastActive = new Date(progress.stats.lastActiveDate);
  lastActive.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Same day, no change
  } else if (diffDays === 1) {
    // Consecutive day, increment streak
    progress.stats.streakDays += 1;
  } else {
    // Streak broken, start fresh
    progress.stats.streakDays = 1;
  }

  progress.stats.lastActiveDate = new Date().toISOString();
}

/**
 * Clear all progress (for testing/reset)
 */
export function clearProgress(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(STORAGE_KEYS.PROGRESS);
}

/**
 * Export progress as JSON string
 */
export function exportProgress(progress: UserProgress): string {
  return JSON.stringify(progress, null, 2);
}

/**
 * Import progress from JSON string
 */
export function importProgress(jsonString: string): UserProgress | null {
  try {
    const progress = JSON.parse(jsonString) as UserProgress;
    if (progress.version && progress.terms && progress.paths) {
      recalculateStats(progress);
      return progress;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get recently viewed terms
 */
export function getRecentTerms(progress: UserProgress, limit: number = 10): string[] {
  return Object.entries(progress.terms)
    .sort((a, b) => new Date(b[1].lastViewed).getTime() - new Date(a[1].lastViewed).getTime())
    .slice(0, limit)
    .map(([term]) => term);
}

/**
 * Get learning statistics summary
 */
export function getProgressSummary(progress: UserProgress) {
  return {
    ...progress.stats,
    recentTerms: getRecentTerms(progress, 5),
    activePaths: Object.entries(progress.paths)
      .filter(([, p]) => !p.completed)
      .map(([slug]) => slug),
    completedPaths: Object.entries(progress.paths)
      .filter(([, p]) => p.completed)
      .map(([slug]) => slug),
  };
}
