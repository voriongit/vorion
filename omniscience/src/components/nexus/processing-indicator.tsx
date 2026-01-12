'use client';

import { cn } from '@/lib/utils';
import type { AIModel } from '@/types';

interface ProcessingIndicatorProps {
  visible: boolean;
  message: string;
  activeNodes?: AIModel[];
}

export function ProcessingIndicator({
  visible,
  message,
  activeNodes = [],
}: ProcessingIndicatorProps) {
  if (!visible) return null;

  return (
    <div className="glass p-3 rounded-lg flex items-center space-x-4 border border-cyan-500/30 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex space-x-1">
        <div
          className={cn(
            'w-3 h-3 rounded-full bg-cyan-500 transition-all',
            activeNodes.includes('gemini')
              ? 'opacity-100 pulse-node'
              : 'opacity-30'
          )}
        />
        <div
          className={cn(
            'w-3 h-3 rounded-full bg-purple-500 transition-all',
            activeNodes.includes('claude')
              ? 'opacity-100 pulse-node'
              : 'opacity-30'
          )}
        />
        <div
          className={cn(
            'w-3 h-3 rounded-full bg-orange-500 transition-all',
            activeNodes.includes('grok')
              ? 'opacity-100 pulse-node'
              : 'opacity-30'
          )}
        />
      </div>
      <span className="text-xs font-mono text-cyan-400">{message}</span>
    </div>
  );
}
