'use client';

/**
 * Paused Badge Component
 *
 * Story 16-1: Agent Pause/Resume
 *
 * Displays a badge when an agent is paused, showing the reason
 * and optionally expiration time.
 */

import { useState } from 'react';
import { PauseReason, PAUSE_REASON_LABELS } from '@/lib/circuit-breaker/types';

// Simple classname utility
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

interface PausedBadgeProps {
  isPaused: boolean;
  reason?: PauseReason;
  pausedAt?: Date | string;
  expiresAt?: Date | string;
  compact?: boolean;
  showDetails?: boolean;
  className?: string;
}

export function PausedBadge({
  isPaused,
  reason,
  pausedAt,
  expiresAt,
  compact = false,
  showDetails = false,
  className,
}: PausedBadgeProps) {
  const [isHovered, setIsHovered] = useState(false);

  if (!isPaused) {
    return null;
  }

  const reasonLabel = reason ? PAUSE_REASON_LABELS[reason] : 'Paused';

  // Calculate time remaining if expires
  let expiresIn: string | null = null;
  if (expiresAt) {
    const expiresDate = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
    const now = new Date();
    const diffMs = expiresDate.getTime() - now.getTime();

    if (diffMs > 0) {
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffDays > 0) {
        expiresIn = `${diffDays}d`;
      } else if (diffHours > 0) {
        expiresIn = `${diffHours}h`;
      } else {
        expiresIn = `${diffMins}m`;
      }
    }
  }

  // Format paused time
  let pausedTimeAgo: string | null = null;
  if (pausedAt) {
    const pausedDate = typeof pausedAt === 'string' ? new Date(pausedAt) : pausedAt;
    const now = new Date();
    const diffMs = now.getTime() - pausedDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      pausedTimeAgo = `${diffDays}d ago`;
    } else if (diffHours > 0) {
      pausedTimeAgo = `${diffHours}h ago`;
    } else if (diffMins > 0) {
      pausedTimeAgo = `${diffMins}m ago`;
    } else {
      pausedTimeAgo = 'just now';
    }
  }

  // Determine badge color based on reason
  const getBadgeColor = () => {
    switch (reason) {
      case 'investigation':
        return 'bg-red-500/90 text-white';
      case 'emergency_stop':
        return 'bg-red-600 text-white animate-pulse';
      case 'cascade_halt':
        return 'bg-orange-500 text-white';
      case 'circuit_breaker':
        return 'bg-amber-500 text-black';
      case 'maintenance':
        return 'bg-blue-500 text-white';
      case 'consumer_request':
        return 'bg-yellow-500 text-black';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  // Get icon for reason
  const getIcon = () => {
    switch (reason) {
      case 'investigation':
        return '🔍';
      case 'emergency_stop':
        return '🚨';
      case 'cascade_halt':
        return '⛓️';
      case 'circuit_breaker':
        return '⚡';
      case 'maintenance':
        return '🔧';
      case 'consumer_request':
        return '👤';
      default:
        return '⏸️';
    }
  };

  if (compact) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
          getBadgeColor(),
          className
        )}
        title={`${reasonLabel}${expiresIn ? ` - Expires in ${expiresIn}` : ''}`}
      >
        <span>{getIcon()}</span>
        <span>PAUSED</span>
      </span>
    );
  }

  return (
    <div
      className={cn(
        'relative inline-block',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Main badge */}
      <div
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-md font-medium',
          getBadgeColor()
        )}
      >
        <span className="text-base">{getIcon()}</span>
        <span className="text-sm">{reasonLabel}</span>
        {expiresIn && (
          <span className="text-xs opacity-80">({expiresIn})</span>
        )}
      </div>

      {/* Hover details */}
      {showDetails && isHovered && (
        <div
          className="absolute z-50 top-full left-0 mt-2 p-3 bg-popover border border-border rounded-lg shadow-lg min-w-[200px]"
        >
          <div className="text-sm space-y-2">
            <div>
              <span className="text-muted-foreground">Reason:</span>
              <span className="ml-2 font-medium">{reasonLabel}</span>
            </div>
            {pausedTimeAgo && (
              <div>
                <span className="text-muted-foreground">Paused:</span>
                <span className="ml-2">{pausedTimeAgo}</span>
              </div>
            )}
            {expiresIn && (
              <div>
                <span className="text-muted-foreground">Expires in:</span>
                <span className="ml-2">{expiresIn}</span>
              </div>
            )}
            <div className="pt-2 border-t border-border text-xs text-muted-foreground">
              Agent operations are suspended
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PausedBadge;
