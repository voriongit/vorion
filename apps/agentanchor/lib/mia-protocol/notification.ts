/**
 * MIA Notification Service
 * Story 10-3: Escalating notifications to trainers
 * Story 10-4: Consumer notification of trainer MIA status
 *
 * FR119: MIA trainers receive escalating notifications across all channels
 * FR120: After MIA threshold, consumers notified of trainer status
 */

import type { MiaWarning, NotificationChannel, WarningLevel } from './warning-system';
import type { MiaStatus, TrainerActivityProfile } from './detection';

// ============================================================================
// Types
// ============================================================================

export type NotificationType =
  | 'trainer_warning'     // Warning to trainer
  | 'consumer_alert'      // Alert to consumer about trainer
  | 'consumer_update'     // Status update to consumer
  | 'delegate_notice'     // Notice to maintenance delegate
  | 'platform_action';    // Platform taking action

export type NotificationStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'bounced';

export interface MiaNotification {
  id: string;
  type: NotificationType;
  channel: NotificationChannel;
  recipientId: string;
  recipientType: 'trainer' | 'consumer' | 'delegate' | 'admin';

  // Content
  subject: string;
  body: string;
  actionUrl?: string;

  // Related entities
  trainerId?: string;
  agentId?: string;
  warningId?: string;

  // Status
  status: NotificationStatus;
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  error?: string;

  // Tracking
  createdAt: Date;
  retryCount: number;
}

export interface ConsumerImpact {
  consumerId: string;
  trainerId: string;
  agentIds: string[];
  activeContracts: number;
  totalSpent: number;
  lastInteraction: Date;
}

export interface NotificationPreferences {
  userId: string;
  channels: {
    email: boolean;
    sms: boolean;
    push: boolean;
    webhook: boolean;
  };
  quietHours?: {
    start: string; // "22:00"
    end: string;   // "08:00"
    timezone: string;
  };
  escalationOverride: boolean; // Allow critical notifications during quiet hours
}

// ============================================================================
// In-Memory Storage (Production: Database + Message Queue)
// ============================================================================

const notifications = new Map<string, MiaNotification>();
const consumerImpacts = new Map<string, ConsumerImpact[]>(); // trainerId -> impacts
const preferences = new Map<string, NotificationPreferences>();

// ============================================================================
// Trainer Notification
// ============================================================================

/**
 * Send warning notification to trainer
 */
export async function sendTrainerWarning(
  warning: MiaWarning,
  profile: TrainerActivityProfile
): Promise<{
  sent: MiaNotification[];
  failed: MiaNotification[];
}> {
  const sent: MiaNotification[] = [];
  const failed: MiaNotification[] = [];

  const prefs = preferences.get(profile.trainerId);
  const channels = getChannelsForLevel(warning.level, prefs);

  for (const channel of channels) {
    const notification = createNotification({
      type: 'trainer_warning',
      channel,
      recipientId: profile.trainerId,
      recipientType: 'trainer',
      subject: warning.title,
      body: formatTrainerWarningBody(warning, profile),
      actionUrl: `/dashboard?action=acknowledge&warning=${warning.id}`,
      trainerId: profile.trainerId,
      warningId: warning.id,
    });

    const result = await sendNotification(notification);
    if (result.success) {
      sent.push(notification);
    } else {
      failed.push(notification);
    }
  }

  return { sent, failed };
}

/**
 * Format trainer warning body
 */
function formatTrainerWarningBody(
  warning: MiaWarning,
  profile: TrainerActivityProfile
): string {
  let body = warning.message + '\n\n';

  body += `Status: ${profile.currentStatus.toUpperCase()}\n`;
  body += `Days Inactive: ${profile.daysSinceLastActivity}\n`;
  body += `Activity Score: ${profile.activityScore}/100\n\n`;

  body += 'Required Actions:\n';
  for (const action of warning.actionRequired) {
    body += `• ${action}\n`;
  }

  if (warning.deadline) {
    body += `\nDeadline: ${warning.deadline.toLocaleDateString()}\n`;
  }

  if (warning.nextEscalation) {
    body += `\nNext Escalation: ${warning.nextEscalation.level.toUpperCase()} on ${warning.nextEscalation.scheduledAt.toLocaleDateString()}\n`;
  }

  return body;
}

/**
 * Get notification channels for warning level
 */
function getChannelsForLevel(
  level: WarningLevel,
  prefs?: NotificationPreferences
): NotificationChannel[] {
  const baseChannels: Record<WarningLevel, NotificationChannel[]> = {
    notice: ['email', 'dashboard'],
    warning: ['email', 'sms', 'dashboard'],
    critical: ['email', 'sms', 'push', 'dashboard'],
    mia: ['email', 'sms', 'push', 'dashboard', 'webhook'],
  };

  const channels = baseChannels[level];

  // Filter by user preferences
  if (prefs) {
    return channels.filter(ch => {
      if (ch === 'dashboard') return true; // Always show in dashboard
      return prefs.channels[ch as keyof typeof prefs.channels] !== false;
    });
  }

  return channels;
}

// ============================================================================
// Consumer Notification
// ============================================================================

/**
 * Notify consumers when trainer enters MIA status
 */
export async function notifyConsumersOfMia(
  trainerId: string,
  profile: TrainerActivityProfile
): Promise<{
  notified: string[];
  failed: string[];
}> {
  const impacts = consumerImpacts.get(trainerId) || [];
  const notified: string[] = [];
  const failed: string[] = [];

  for (const impact of impacts) {
    const notification = createNotification({
      type: 'consumer_alert',
      channel: 'email',
      recipientId: impact.consumerId,
      recipientType: 'consumer',
      subject: `Important: Trainer Status Update for Your Agents`,
      body: formatConsumerAlertBody(impact, profile),
      actionUrl: `/agents?trainer=${trainerId}`,
      trainerId,
    });

    const result = await sendNotification(notification);
    if (result.success) {
      notified.push(impact.consumerId);
    } else {
      failed.push(impact.consumerId);
    }
  }

  return { notified, failed };
}

/**
 * Format consumer alert body
 */
function formatConsumerAlertBody(
  impact: ConsumerImpact,
  profile: TrainerActivityProfile
): string {
  let body = `We're writing to inform you about an important update regarding your AI agents.\n\n`;

  body += `The trainer responsible for ${impact.agentIds.length} of your agents has been marked as Missing In Action (MIA) due to extended inactivity.\n\n`;

  body += `Affected Agents: ${impact.agentIds.length}\n`;
  body += `Active Contracts: ${impact.activeContracts}\n\n`;

  body += `What This Means:\n`;
  body += `• Your agents will continue to function normally\n`;
  body += `• Support response times may be delayed\n`;
  body += `• A temporary maintainer may be assigned if needed\n\n`;

  body += `Your Options:\n`;
  body += `• Continue using your agents as normal\n`;
  body += `• Request a temporary maintainer for critical agents\n`;
  body += `• Transfer to a different trainer (no penalty)\n`;
  body += `• Exercise your right to exit (full refund protection)\n\n`;

  body += `We're here to help. Contact support if you have any concerns.\n`;

  return body;
}

/**
 * Send status update to consumers (e.g., trainer returned)
 */
export async function notifyConsumersOfUpdate(
  trainerId: string,
  status: MiaStatus,
  message: string
): Promise<{ notified: number }> {
  const impacts = consumerImpacts.get(trainerId) || [];
  let notified = 0;

  for (const impact of impacts) {
    const notification = createNotification({
      type: 'consumer_update',
      channel: 'email',
      recipientId: impact.consumerId,
      recipientType: 'consumer',
      subject: `Update: Trainer Status Changed`,
      body: `Good news! The trainer for your agents has returned to active status.\n\n${message}`,
      trainerId,
    });

    const result = await sendNotification(notification);
    if (result.success) {
      notified++;
    }
  }

  return { notified };
}

// ============================================================================
// Notification Core
// ============================================================================

/**
 * Create a notification record
 */
function createNotification(params: {
  type: NotificationType;
  channel: NotificationChannel;
  recipientId: string;
  recipientType: 'trainer' | 'consumer' | 'delegate' | 'admin';
  subject: string;
  body: string;
  actionUrl?: string;
  trainerId?: string;
  agentId?: string;
  warningId?: string;
}): MiaNotification {
  const notification: MiaNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    ...params,
    status: 'pending',
    createdAt: new Date(),
    retryCount: 0,
  };

  notifications.set(notification.id, notification);
  return notification;
}

/**
 * Send notification via channel
 */
async function sendNotification(
  notification: MiaNotification
): Promise<{ success: boolean; error?: string }> {
  try {
    // In production: integrate with actual notification services
    // - Email: SendGrid, SES
    // - SMS: Twilio
    // - Push: Firebase, APNS
    // - Webhook: HTTP POST

    // Simulate send
    await simulateSend(notification.channel);

    notification.status = 'sent';
    notification.sentAt = new Date();
    notifications.set(notification.id, notification);

    return { success: true };
  } catch (error) {
    notification.status = 'failed';
    notification.failedAt = new Date();
    notification.error = error instanceof Error ? error.message : 'Unknown error';
    notification.retryCount++;
    notifications.set(notification.id, notification);

    return { success: false, error: notification.error };
  }
}

/**
 * Simulate notification send (for development)
 */
async function simulateSend(channel: NotificationChannel): Promise<void> {
  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 100));

  // Simulate occasional failures (5%)
  if (Math.random() < 0.05) {
    throw new Error(`Failed to send via ${channel}`);
  }
}

/**
 * Retry failed notifications
 */
export async function retryFailedNotifications(): Promise<{
  retried: number;
  succeeded: number;
  failed: number;
}> {
  let retried = 0;
  let succeeded = 0;
  let failed = 0;

  for (const notification of notifications.values()) {
    if (notification.status === 'failed' && notification.retryCount < 3) {
      retried++;
      const result = await sendNotification(notification);
      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }
    }
  }

  return { retried, succeeded, failed };
}

// ============================================================================
// Consumer Impact Management
// ============================================================================

/**
 * Register consumer impact for a trainer
 */
export function registerConsumerImpact(impact: ConsumerImpact): void {
  const impacts = consumerImpacts.get(impact.trainerId) || [];
  const existing = impacts.findIndex(i => i.consumerId === impact.consumerId);

  if (existing >= 0) {
    impacts[existing] = impact;
  } else {
    impacts.push(impact);
  }

  consumerImpacts.set(impact.trainerId, impacts);
}

/**
 * Get consumers impacted by trainer MIA
 */
export function getImpactedConsumers(trainerId: string): ConsumerImpact[] {
  return consumerImpacts.get(trainerId) || [];
}

/**
 * Get impact summary for a trainer
 */
export function getImpactSummary(trainerId: string): {
  totalConsumers: number;
  totalAgents: number;
  totalContracts: number;
  totalRevenue: number;
} {
  const impacts = consumerImpacts.get(trainerId) || [];

  return {
    totalConsumers: impacts.length,
    totalAgents: impacts.reduce((sum, i) => sum + i.agentIds.length, 0),
    totalContracts: impacts.reduce((sum, i) => sum + i.activeContracts, 0),
    totalRevenue: impacts.reduce((sum, i) => sum + i.totalSpent, 0),
  };
}

// ============================================================================
// Preference Management
// ============================================================================

/**
 * Set user notification preferences
 */
export function setNotificationPreferences(
  prefs: NotificationPreferences
): void {
  preferences.set(prefs.userId, prefs);
}

/**
 * Get user notification preferences
 */
export function getNotificationPreferences(
  userId: string
): NotificationPreferences | null {
  return preferences.get(userId) || null;
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get notification by ID
 */
export function getNotification(id: string): MiaNotification | null {
  return notifications.get(id) || null;
}

/**
 * Get notifications for a recipient
 */
export function getRecipientNotifications(
  recipientId: string
): MiaNotification[] {
  const result: MiaNotification[] = [];
  for (const notification of notifications.values()) {
    if (notification.recipientId === recipientId) {
      result.push(notification);
    }
  }
  return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Get notification statistics
 */
export function getNotificationStats(): {
  total: number;
  byStatus: Record<NotificationStatus, number>;
  byType: Record<NotificationType, number>;
  byChannel: Record<NotificationChannel, number>;
  deliveryRate: number;
} {
  const stats = {
    total: notifications.size,
    byStatus: {
      pending: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      bounced: 0,
    } as Record<NotificationStatus, number>,
    byType: {
      trainer_warning: 0,
      consumer_alert: 0,
      consumer_update: 0,
      delegate_notice: 0,
      platform_action: 0,
    } as Record<NotificationType, number>,
    byChannel: {
      email: 0,
      sms: 0,
      push: 0,
      dashboard: 0,
      webhook: 0,
    } as Record<NotificationChannel, number>,
    deliveryRate: 0,
  };

  let delivered = 0;
  let attempted = 0;

  for (const notification of notifications.values()) {
    stats.byStatus[notification.status]++;
    stats.byType[notification.type]++;
    stats.byChannel[notification.channel]++;

    if (notification.status !== 'pending') {
      attempted++;
      if (notification.status === 'sent' || notification.status === 'delivered') {
        delivered++;
      }
    }
  }

  if (attempted > 0) {
    stats.deliveryRate = (delivered / attempted) * 100;
  }

  return stats;
}

// ============================================================================
// Clear Data (Testing)
// ============================================================================

export function clearNotificationData(): void {
  notifications.clear();
  consumerImpacts.clear();
  preferences.clear();
}
