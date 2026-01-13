'use client';

import { type ReactNode } from 'react';
import { ProgressProvider } from '@/contexts';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ProgressProvider>
      {children}
    </ProgressProvider>
  );
}
