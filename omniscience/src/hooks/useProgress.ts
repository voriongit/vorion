'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { QuizAttempt } from '@/types';
import {
  loadProgress,
  saveProgress,
  markTermViewed,
  markTermMastered,
  isTermViewed,
  isTermMastered,
  getTermProgress,
  startPath,
  startModule,
  markModuleTermViewed,
  recordModuleQuizAttempt,
  recordPathQuizAttempt,
  isModuleCompleted,
  isPathCompleted,
  getModuleProgress,
  getPathProgress,
  getPathCompletionPercent,
  getModuleCompletionPercent,
  getProgressSummary,
  clearProgress,
  exportProgress,
  importProgress,
  type UserProgress,
  type TermProgress,
  type ModuleProgress,
  type PathProgress,
} from '@/lib/progress';

/**
 * Hook for managing user learning progress
 * Provides reactive state and persistence to localStorage
 */
export function useProgress() {
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load progress on mount
  useEffect(() => {
    const loaded = loadProgress();
    setProgress(loaded);
    setIsLoaded(true);
  }, []);

  // Save progress whenever it changes
  useEffect(() => {
    if (progress && isLoaded) {
      saveProgress(progress);
    }
  }, [progress, isLoaded]);

  // Helper to update progress with a function
  const updateProgress = useCallback((updater: (p: UserProgress) => UserProgress) => {
    setProgress(prev => {
      if (!prev) return prev;
      return updater({ ...prev });
    });
  }, []);

  // ============================================
  // TERM ACTIONS
  // ============================================

  const viewTerm = useCallback((termName: string) => {
    updateProgress(p => markTermViewed(p, termName));
  }, [updateProgress]);

  const masterTerm = useCallback((termName: string) => {
    updateProgress(p => markTermMastered(p, termName));
  }, [updateProgress]);

  const checkTermViewed = useCallback((termName: string): boolean => {
    return progress ? isTermViewed(progress, termName) : false;
  }, [progress]);

  const checkTermMastered = useCallback((termName: string): boolean => {
    return progress ? isTermMastered(progress, termName) : false;
  }, [progress]);

  const getTermInfo = useCallback((termName: string): TermProgress | null => {
    return progress ? getTermProgress(progress, termName) : null;
  }, [progress]);

  // ============================================
  // PATH/MODULE ACTIONS
  // ============================================

  const beginPath = useCallback((pathSlug: string) => {
    updateProgress(p => startPath(p, pathSlug));
  }, [updateProgress]);

  const beginModule = useCallback((pathSlug: string, moduleId: string) => {
    updateProgress(p => startModule(p, pathSlug, moduleId));
  }, [updateProgress]);

  const viewModuleTerm = useCallback((
    pathSlug: string,
    moduleId: string,
    termName: string
  ) => {
    updateProgress(p => markModuleTermViewed(p, pathSlug, moduleId, termName));
  }, [updateProgress]);

  const submitModuleQuiz = useCallback((
    pathSlug: string,
    moduleId: string,
    attempt: QuizAttempt,
    moduleTerms?: string[]
  ) => {
    updateProgress(p => {
      const updated = recordModuleQuizAttempt(p, pathSlug, moduleId, attempt);

      // Mark terms as mastered if quiz passed
      if (attempt.passed && moduleTerms) {
        for (const term of moduleTerms) {
          markTermMastered(updated, term);
        }
      }

      return updated;
    });
  }, [updateProgress]);

  const submitPathQuiz = useCallback((
    pathSlug: string,
    attempt: QuizAttempt,
    pathTerms?: string[]
  ) => {
    updateProgress(p => {
      const updated = recordPathQuizAttempt(p, pathSlug, attempt);

      // Mark terms as mastered if quiz passed
      if (attempt.passed && pathTerms) {
        for (const term of pathTerms) {
          markTermMastered(updated, term);
        }
      }

      return updated;
    });
  }, [updateProgress]);

  const checkModuleCompleted = useCallback((
    pathSlug: string,
    moduleId: string
  ): boolean => {
    return progress ? isModuleCompleted(progress, pathSlug, moduleId) : false;
  }, [progress]);

  const checkPathCompleted = useCallback((pathSlug: string): boolean => {
    return progress ? isPathCompleted(progress, pathSlug) : false;
  }, [progress]);

  const getModuleInfo = useCallback((
    pathSlug: string,
    moduleId: string
  ): ModuleProgress | null => {
    return progress ? getModuleProgress(progress, pathSlug, moduleId) : null;
  }, [progress]);

  const getPathInfo = useCallback((pathSlug: string): PathProgress | null => {
    return progress ? getPathProgress(progress, pathSlug) : null;
  }, [progress]);

  const getPathCompletion = useCallback((
    pathSlug: string,
    totalModules: number
  ): number => {
    return progress ? getPathCompletionPercent(progress, pathSlug, totalModules) : 0;
  }, [progress]);

  const getModuleCompletion = useCallback((
    pathSlug: string,
    moduleId: string,
    totalTerms: number
  ): number => {
    return progress ? getModuleCompletionPercent(progress, pathSlug, moduleId, totalTerms) : 0;
  }, [progress]);

  // ============================================
  // UTILITY ACTIONS
  // ============================================

  const getSummary = useCallback(() => {
    return progress ? getProgressSummary(progress) : null;
  }, [progress]);

  const resetProgress = useCallback(() => {
    clearProgress();
    setProgress(loadProgress());
  }, []);

  const exportData = useCallback((): string => {
    return progress ? exportProgress(progress) : '';
  }, [progress]);

  const importData = useCallback((jsonString: string): boolean => {
    const imported = importProgress(jsonString);
    if (imported) {
      setProgress(imported);
      return true;
    }
    return false;
  }, []);

  // Memoized stats
  const stats = useMemo(() => progress?.stats ?? null, [progress]);

  return {
    // State
    progress,
    isLoaded,
    stats,

    // Term actions
    viewTerm,
    masterTerm,
    checkTermViewed,
    checkTermMastered,
    getTermInfo,

    // Path/Module actions
    beginPath,
    beginModule,
    viewModuleTerm,
    submitModuleQuiz,
    submitPathQuiz,
    checkModuleCompleted,
    checkPathCompleted,
    getModuleInfo,
    getPathInfo,
    getPathCompletion,
    getModuleCompletion,

    // Utility actions
    getSummary,
    resetProgress,
    exportData,
    importData,
  };
}

export type UseProgressReturn = ReturnType<typeof useProgress>;
