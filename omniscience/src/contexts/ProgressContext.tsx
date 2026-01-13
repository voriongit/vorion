'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useProgress, type UseProgressReturn } from '@/hooks/useProgress';

const ProgressContext = createContext<UseProgressReturn | null>(null);

interface ProgressProviderProps {
  children: ReactNode;
}

export function ProgressProvider({ children }: ProgressProviderProps) {
  const progress = useProgress();

  return (
    <ProgressContext.Provider value={progress}>
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgressContext(): UseProgressReturn {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error('useProgressContext must be used within a ProgressProvider');
  }
  return context;
}
