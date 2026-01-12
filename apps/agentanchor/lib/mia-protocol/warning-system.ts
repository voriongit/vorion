/**
 * MIA Warning System
 * Story 10-2: Graduated warning system
 *
 * FR118: Graduated warning system: Notice → Warning → Critical → MIA
 */

import type { MiaStatus, TrainerActivityProfile } from './detection';

// ============================================================================
// Types
// ============================================================================

export type WarningLevel = 'notice' | 'warning' | 'critical' | 'mia';

export interface MiaWarning {
  id: string;
  trainerId: string;
  level: WarningLevel;

  // Warning details
  title: string;
  message: string;
  actionRequired: string[];
  deadline?: Date;

  // Status
  acknowledged: boolean;
  acknowledgedAt?: Date;
  sentVia: NotificationChannel[];
  sentAt: Date;

  // Escalation
  previousWarnings: string[]; // IDs
  nextEscalation?: {
    level: WarningLevel;
    scheduledAt: Date;
  };

  // Tracking
  createdAt: Date;
}

export type NotificationChannel =
  | 'email'
  | 'sms'
  | 'push'
  | 'dashboard'
  | 'webhook';

export interface WarningTemplate {
  level: WarningLevel;
  title: string;
  message: string;
  actionRequired: string[];
  channels: NotificationChannel[];
  daysUntilNextLevel: number;
}

// ============================================================================
// Warning Templates
// ============================================================================

export const WARNING_TEMPLATES: Record<WarningLevel, WarningTemplate> = {
  notice: {
    level: 'notice',
    title: 'Activity Notice - 7 Days Inactive',
    message: `We noticed you haven't been active on AgentAnchor for 7 days. Your agents and consumers depend on your attention. Please log in to maintain your standing.`,
    actionRequired: [
      'Log in to your AgentAnchor account',
      'Review any pending consumer messages',
      'Check agent performance metrics',
    ],
    channels: ['email', 'dashboard'],
    daysUntilNextLevel: 7, // 7 more days until warning
  },
  warning: {
    level: 'warning',
    title: 'Activity Warning - 14 Days Inactive',
    message: `You have been inactive for 14 days. Your trainer status is at risk. Continued inactivity may affect your agents' marketplace visibility and consumer trust.`,
    actionRequired: [
      'Log in immediately to your AgentAnchor account',
      'Respond to any consumer inquiries',
      'Update your agents if needed',
      'Consider delegating maintenance if unavailable',
    ],
    channels: ['email', 'sms', 'dashboard'],
    daysUntilNextLevel: 7, // 7 more days until critical
  },
  critical: {
    level: 'critical',
    title: 'CRITICAL: 21 Days Inactive - Action Required',
    message: `Your account has been inactive for 21 days. Your trainer status is CRITICAL. If you don't respond within 9 days, your account will be marked MIA and your agents may be reassigned.`,
    actionRequired: [
      'Log in IMMEDIATELY to prevent MIA status',
      'Contact support if you need extended absence',
      'Set up a maintenance delegate if unavailable',
      'Respond to all pending consumer messages',
    ],
    channels: ['email', 'sms', 'push', 'dashboard'],
    daysUntilNextLevel: 9, // 9 more days until MIA
  },
  mia: {
    level: 'mia',
    title: 'MIA Status Activated - 30+ Days Inactive',
    message: `Your trainer account has been marked as Missing In Action (MIA). Your consumers have been notified. Your agents may be assigned a temporary maintainer. Contact support to reactivate your account.`,
    actionRequired: [
      'Contact AgentAnchor support to reactivate',
      'Explain absence and provide return timeline',
      'Acknowledge consumer notification process',
      'Review any temporary maintainer assignments',
    ],
    channels: ['email', 'sms', 'push', 'dashboard', 'webhook'],
    daysUntilNextLevel: 0, // No further escalation
  },
};

// ============================================================================
// In-Memory Storage (Production: Database)
// ============================================================================

const warnings = new Map<string, MiaWarning>();
const trainerWarnings = new Map<string, string[]>(); // trainerId -> warning IDs

// ============================================================================
// Warning Generation
// ============================================================================

/**
 * Generate warning for a trainer based on their profile
 */
export function generateWarning(
  profile: TrainerActivityProfile
): MiaWarning | null {
  // Only generate warnings for non-active statuses
  if (profile.currentStatus === 'active') {
    return null;
  }

  const level = profile.currentStatus as WarningLevel;
  if (!WARNING_TEMPLATES[level]) {
    return null;
  }

  const template = WARNING_TEMPLATES[level];
  const existingWarnings = trainerWarnings.get(profile.trainerId) || [];

  // Check if we already sent a warning at this level recently
  const recentWarning = findRecentWarning(profile.trainerId, level, 24 * 60 * 60 * 1000); // 24 hours
  if (recentWarning) {
    return null; // Don't spam warnings
  }

  const warning: MiaWarning = {
    id: `warning-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    trainerId: profile.trainerId,
    level,
    title: template.title,
    message: template.message,
    actionRequired: template.actionRequired,
    deadline: template.daysUntilNextLevel > 0
      ? new Date(Date.now() + template.daysUntilNextLevel * 24 * 60 * 60 * 1000)
      : undefined,
    acknowledged: false,
    sentVia: [], // Will be populated when sent
    sentAt: new Date(),
    previousWarnings: [...existingWarnings],
    nextEscalation: getNextEscalation(level),
    createdAt: new Date(),
  };

  // Store warning
  warnings.set(warning.id, warning);
  existingWarnings.push(warning.id);
  trainerWarnings.set(profile.trainerId, existingWarnings);

  return warning;
}

/**
 * Find recent warning at a specific level
 */
function findRecentWarning(
  trainerId: string,
  level: WarningLevel,
  withinMs: number
): MiaWarning | null {
  const warningIds = trainerWarnings.get(trainerId) || [];
  const cutoff = Date.now() - withinMs;

  for (const id of warningIds.reverse()) {
    const warning = warnings.get(id);
    if (
      warning &&
      warning.level === level &&
      warning.sentAt.getTime() > cutoff
    ) {
      return warning;
    }
  }

  return null;
}

/**
 * Get next escalation info
 */
function getNextEscalation(
  currentLevel: WarningLevel
): { level: WarningLevel; scheduledAt: Date } | undefined {
  const escalationOrder: WarningLevel[] = ['notice', 'warning', 'critical', 'mia'];
  const currentIndex = escalationOrder.indexOf(currentLevel);

  if (currentIndex < escalationOrder.length - 1) {
    const nextLevel = escalationOrder[currentIndex + 1];
    const daysUntil = WARNING_TEMPLATES[currentLevel].daysUntilNextLevel;

    return {
      level: nextLevel,
      scheduledAt: new Date(Date.now() + daysUntil * 24 * 60 * 60 * 1000),
    };
  }

  return undefined;
}

// ============================================================================
// Warning Management
// ============================================================================

/**
 * Acknowledge a warning
 */
export function acknowledgeWarning(
  warningId: string
): { success: boolean; error?: string } {
  const warning = warnings.get(warningId);
  if (!warning) {
    return { success: false, error: 'Warning not found' };
  }

  warning.acknowledged = true;
  warning.acknowledgedAt = new Date();
  warnings.set(warningId, warning);

  return { success: true };
}

/**
 * Mark warning as sent via channel
 */
export function markWarningSent(
  warningId: string,
  channel: NotificationChannel
): void {
  const warning = warnings.get(warningId);
  if (warning && !warning.sentVia.includes(channel)) {
    warning.sentVia.push(channel);
    warnings.set(warningId, warning);
  }
}

/**
 * Get warning by ID
 */
export function getWarning(warningId: string): MiaWarning | null {
  return warnings.get(warningId) || null;
}

/**
 * Get all warnings for a trainer
 */
export function getTrainerWarnings(trainerId: string): MiaWarning[] {
  const warningIds = trainerWarnings.get(trainerId) || [];
  const result: MiaWarning[] = [];

  for (const id of warningIds) {
    const warning = warnings.get(id);
    if (warning) {
      result.push(warning);
    }
  }

  return result.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
}

/**
 * Get unacknowledged warnings for a trainer
 */
export function getUnacknowledgedWarnings(trainerId: string): MiaWarning[] {
  return getTrainerWarnings(trainerId).filter(w => !w.acknowledged);
}

/**
 * Get pending escalations (warnings that will escalate soon)
 */
export function getPendingEscalations(
  withinDays: number = 3
): Array<{ warning: MiaWarning; daysUntilEscalation: number }> {
  const result: Array<{ warning: MiaWarning; daysUntilEscalation: number }> = [];
  const cutoff = Date.now() + withinDays * 24 * 60 * 60 * 1000;

  for (const warning of warnings.values()) {
    if (
      warning.nextEscalation &&
      !warning.acknowledged &&
      warning.nextEscalation.scheduledAt.getTime() < cutoff
    ) {
      const daysUntilEscalation = Math.ceil(
        (warning.nextEscalation.scheduledAt.getTime() - Date.now()) /
          (24 * 60 * 60 * 1000)
      );
      result.push({ warning, daysUntilEscalation });
    }
  }

  return result.sort((a, b) => a.daysUntilEscalation - b.daysUntilEscalation);
}

// ============================================================================
// Warning Statistics
// ============================================================================

export function getWarningStats(): {
  total: number;
  byLevel: Record<WarningLevel, number>;
  unacknowledged: number;
  acknowledgedRate: number;
  pendingEscalations: number;
} {
  const stats = {
    total: warnings.size,
    byLevel: {
      notice: 0,
      warning: 0,
      critical: 0,
      mia: 0,
    } as Record<WarningLevel, number>,
    unacknowledged: 0,
    acknowledgedRate: 0,
    pendingEscalations: 0,
  };

  let acknowledged = 0;

  for (const warning of warnings.values()) {
    stats.byLevel[warning.level]++;
    if (warning.acknowledged) {
      acknowledged++;
    } else {
      stats.unacknowledged++;
      if (warning.nextEscalation) {
        stats.pendingEscalations++;
      }
    }
  }

  if (stats.total > 0) {
    stats.acknowledgedRate = (acknowledged / stats.total) * 100;
  }

  return stats;
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Generate warnings for all trainers at a given status
 */
export async function generateBulkWarnings(
  profiles: TrainerActivityProfile[]
): Promise<{
  generated: MiaWarning[];
  skipped: number;
}> {
  const generated: MiaWarning[] = [];
  let skipped = 0;

  for (const profile of profiles) {
    const warning = generateWarning(profile);
    if (warning) {
      generated.push(warning);
    } else {
      skipped++;
    }
  }

  return { generated, skipped };
}

/**
 * Clear trainer's warning history (for testing or when status resets)
 */
export function clearTrainerWarnings(trainerId: string): void {
  const warningIds = trainerWarnings.get(trainerId) || [];
  for (const id of warningIds) {
    warnings.delete(id);
  }
  trainerWarnings.delete(trainerId);
}

/**
 * Clear all warning data (for testing)
 */
export function clearWarningData(): void {
  warnings.clear();
  trainerWarnings.clear();
}
