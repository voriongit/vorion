'use client';

import { cn } from '@/lib/utils';
import type { ChatMessage as ChatMessageType } from '@/types';
import { Database, Cpu } from 'lucide-react';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  return (
    <div
      className={cn(
        'flex animate-in fade-in slide-in-from-bottom-2',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'p-3 max-w-[90%] text-sm shadow-md',
          isUser && 'user-bubble',
          !isUser && 'agent-bubble'
        )}
      >
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1">
            {message.source === 'local' ? (
              <>
                <Database className="w-3 h-3 text-green-400" />
                <span className="text-xs font-bold text-green-400">LOCAL HIT</span>
              </>
            ) : message.source === 'synthesis' ? (
              <>
                <Cpu className="w-3 h-3 text-cyan-400" />
                <span className="text-xs font-bold text-cyan-400">SYNTHESIS</span>
              </>
            ) : isSystem ? (
              <span className="text-xs font-bold text-cyan-400">SYSTEM</span>
            ) : null}
          </div>
        )}

        <div
          className="prose-sm"
          dangerouslySetInnerHTML={{ __html: message.content }}
        />

        {message.perspectives && message.perspectives.length > 0 && (
          <div className="mt-3 pt-2 border-t border-gray-700">
            <div className="text-xs text-gray-500 mb-1">Contributors:</div>
            <div className="flex gap-2">
              {message.perspectives.map(p => (
                <span
                  key={p.model}
                  className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded',
                    p.model === 'gemini' && 'bg-cyan-900/30 text-cyan-400',
                    p.model === 'claude' && 'bg-purple-900/30 text-purple-400',
                    p.model === 'grok' && 'bg-orange-900/30 text-orange-400'
                  )}
                >
                  {p.model.toUpperCase()}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
