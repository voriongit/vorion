/**
 * Notification Types
 * Epic 7: Dashboard & Notifications
 */

export type NotificationType =
  | 'escalation'
  | 'graduation'
  | 'anomaly'
  | 'ownership_change'
  | 'earnings_milestone'
  | 'council_decision'
  | 'acquisition'
  | 'feedback_received'
  | 'payout_completed'
  | 'trust_change'
  | 'system'

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'

export type NotificationChannel = 'in_app' | 'email' | 'webhook'

export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed'

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  priority: NotificationPriority
  title: string
  message: string
  data: Record<string, any>
  action_url?: string
  read: boolean
  read_at?: string
  dismissed: boolean
  dismissed_at?: string
  expires_at?: string
  created_at: string
}

export interface NotificationDelivery {
  id: string
  notification_id: string
  channel: NotificationChannel
  status: DeliveryStatus
  sent_at?: string
  delivered_at?: string
  error?: string
  retry_count: number
  metadata: Record<string, any>
}

export interface NotificationPreference {
  id: string
  user_id: string
  notification_type: NotificationType
  channel: NotificationChannel
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface UserWebhook {
  id: string
  user_id: string
  name: string
  url: string
  secret?: string
  enabled: boolean
  notification_types: NotificationType[]
  retry_count: number
  last_error?: string
  last_success_at?: string
  created_at: string
  updated_at: string
}

export interface DashboardPreferences {
  id: string
  user_id: string
  active_role: 'trainer' | 'consumer'
  default_tab: string
  widget_layout: string[]
  created_at: string
  updated_at: string
}

export interface CreateNotificationInput {
  user_id: string
  type: NotificationType
  priority?: NotificationPriority
  title: string
  message: string
  data?: Record<string, any>
  action_url?: string
  expires_at?: string
}

// Notification type metadata
export const NOTIFICATION_TYPES: Record<NotificationType, {
  label: string
  description: string
  defaultPriority: NotificationPriority
  icon: string
  canDisable: boolean
}> = {
  escalation: {
    label: 'Escalations',
    description: 'Urgent decisions requiring human intervention',
    defaultPriority: 'urgent',
    icon: 'AlertTriangle',
    canDisable: false, // Cannot disable escalations
  },
  graduation: {
    label: 'Graduations',
    description: 'Agent graduation and certification events',
    defaultPriority: 'normal',
    icon: 'GraduationCap',
    canDisable: true,
  },
  anomaly: {
    label: 'Anomalies',
    description: 'Observer-detected behavioral anomalies',
    defaultPriority: 'high',
    icon: 'AlertCircle',
    canDisable: true,
  },
  ownership_change: {
    label: 'Ownership Changes',
    description: 'Agent ownership or listing status changes',
    defaultPriority: 'normal',
    icon: 'UserCheck',
    canDisable: true,
  },
  earnings_milestone: {
    label: 'Earnings Milestones',
    description: 'Achievement of earnings thresholds',
    defaultPriority: 'low',
    icon: 'Trophy',
    canDisable: true,
  },
  council_decision: {
    label: 'Council Decisions',
    description: 'Council voting outcomes and decisions',
    defaultPriority: 'normal',
    icon: 'Scale',
    canDisable: true,
  },
  acquisition: {
    label: 'Acquisitions',
    description: 'New agent acquisitions or terminations',
    defaultPriority: 'normal',
    icon: 'ShoppingCart',
    canDisable: true,
  },
  feedback_received: {
    label: 'Feedback',
    description: 'Consumer feedback and reviews',
    defaultPriority: 'low',
    icon: 'MessageSquare',
    canDisable: true,
  },
  payout_completed: {
    label: 'Payouts',
    description: 'Payout processing and completion',
    defaultPriority: 'normal',
    icon: 'DollarSign',
    canDisable: true,
  },
  trust_change: {
    label: 'Trust Changes',
    description: 'Significant trust score changes',
    defaultPriority: 'normal',
    icon: 'Shield',
    canDisable: true,
  },
  system: {
    label: 'System',
    description: 'Platform updates and announcements',
    defaultPriority: 'low',
    icon: 'Info',
    canDisable: true,
  },
}

// Earnings milestones
export const EARNINGS_MILESTONES = [
  { amount: 1, label: 'First Dollar' },
  { amount: 100, label: '$100 Earned' },
  { amount: 500, label: '$500 Earned' },
  { amount: 1000, label: '$1,000 Earned' },
  { amount: 5000, label: '$5,000 Earned' },
  { amount: 10000, label: '$10,000 Earned' },
]
