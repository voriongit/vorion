'use client'

import { useState, useEffect } from 'react'
import {
  Bell,
  Mail,
  Globe,
  AlertTriangle,
  GraduationCap,
  AlertCircle,
  UserCheck,
  Trophy,
  Scale,
  ShoppingCart,
  MessageSquare,
  DollarSign,
  Shield,
  Info,
  RefreshCw,
  Send,
  Check,
} from 'lucide-react'

type NotificationType =
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

type NotificationChannel = 'in_app' | 'email' | 'webhook'

interface NotificationPreference {
  id: string
  notification_type: NotificationType
  channel: NotificationChannel
  enabled: boolean
}

const NOTIFICATION_TYPES: Record<NotificationType, {
  label: string
  description: string
  icon: React.ElementType
  canDisableInApp: boolean
}> = {
  escalation: {
    label: 'Escalations',
    description: 'Urgent decisions requiring human intervention',
    icon: AlertTriangle,
    canDisableInApp: false,
  },
  graduation: {
    label: 'Graduations',
    description: 'Agent graduation and certification events',
    icon: GraduationCap,
    canDisableInApp: true,
  },
  anomaly: {
    label: 'Anomalies',
    description: 'Observer-detected behavioral anomalies',
    icon: AlertCircle,
    canDisableInApp: true,
  },
  ownership_change: {
    label: 'Ownership Changes',
    description: 'Agent ownership or listing status changes',
    icon: UserCheck,
    canDisableInApp: true,
  },
  earnings_milestone: {
    label: 'Earnings Milestones',
    description: 'Achievement of earnings thresholds',
    icon: Trophy,
    canDisableInApp: true,
  },
  council_decision: {
    label: 'Council Decisions',
    description: 'Council voting outcomes and decisions',
    icon: Scale,
    canDisableInApp: true,
  },
  acquisition: {
    label: 'Acquisitions',
    description: 'New agent acquisitions or terminations',
    icon: ShoppingCart,
    canDisableInApp: true,
  },
  feedback_received: {
    label: 'Feedback',
    description: 'Consumer feedback and reviews',
    icon: MessageSquare,
    canDisableInApp: true,
  },
  payout_completed: {
    label: 'Payouts',
    description: 'Payout processing and completion',
    icon: DollarSign,
    canDisableInApp: true,
  },
  trust_change: {
    label: 'Trust Changes',
    description: 'Significant trust score changes',
    icon: Shield,
    canDisableInApp: true,
  },
  system: {
    label: 'System',
    description: 'Platform updates and announcements',
    icon: Info,
    canDisableInApp: true,
  },
}

export default function NotificationSettingsPage() {
  const [preferences, setPreferences] = useState<NotificationPreference[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [testSent, setTestSent] = useState<string | null>(null)

  useEffect(() => {
    fetchPreferences()
  }, [])

  async function fetchPreferences() {
    try {
      const res = await fetch('/api/notifications/preferences')
      if (res.ok) {
        const data = await res.json()
        setPreferences(data.preferences || [])
      }
    } catch (err) {
      setError('Failed to load preferences')
    } finally {
      setLoading(false)
    }
  }

  async function togglePreference(
    type: NotificationType,
    channel: NotificationChannel,
    currentEnabled: boolean
  ) {
    // Prevent disabling in-app for escalations
    if (type === 'escalation' && channel === 'in_app' && currentEnabled) {
      setError('Escalation in-app notifications cannot be disabled')
      setTimeout(() => setError(null), 3000)
      return
    }

    const key = `${type}-${channel}`
    setSaving(key)

    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          channel,
          enabled: !currentEnabled,
        }),
      })

      if (res.ok) {
        // Update local state
        setPreferences(prev => {
          const existing = prev.find(
            p => p.notification_type === type && p.channel === channel
          )
          if (existing) {
            return prev.map(p =>
              p.notification_type === type && p.channel === channel
                ? { ...p, enabled: !currentEnabled }
                : p
            )
          }
          return [
            ...prev,
            {
              id: `new-${key}`,
              notification_type: type,
              channel,
              enabled: !currentEnabled,
            },
          ]
        })
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to update preference')
        setTimeout(() => setError(null), 3000)
      }
    } catch (err) {
      setError('Failed to update preference')
      setTimeout(() => setError(null), 3000)
    } finally {
      setSaving(null)
    }
  }

  function getPreferenceEnabled(type: NotificationType, channel: NotificationChannel): boolean {
    const pref = preferences.find(
      p => p.notification_type === type && p.channel === channel
    )
    // Default to true for in_app, false for others
    return pref ? pref.enabled : channel === 'in_app'
  }

  async function sendTestNotification(channel: NotificationChannel) {
    setTestSent(channel)

    // Simulate sending test notification
    await new Promise(resolve => setTimeout(resolve, 1000))

    setTimeout(() => setTestSent(null), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="w-8 h-8 animate-spin text-neutral-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-100 flex items-center gap-3">
          <Bell className="w-7 h-7 text-blue-400" />
          Notification Preferences
        </h1>
        <p className="text-neutral-400 mt-1">
          Choose how you want to be notified about different events
        </p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Channel Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ChannelCard
          title="In-App"
          description="Notifications in your dashboard"
          icon={Bell}
          color="green"
          onTest={() => sendTestNotification('in_app')}
          testing={testSent === 'in_app'}
        />
        <ChannelCard
          title="Email"
          description="Sent to your registered email"
          icon={Mail}
          color="blue"
          onTest={() => sendTestNotification('email')}
          testing={testSent === 'email'}
        />
        <ChannelCard
          title="Webhook"
          description="POST to your endpoint"
          icon={Globe}
          color="purple"
          onTest={() => sendTestNotification('webhook')}
          testing={testSent === 'webhook'}
        />
      </div>

      {/* Notification Types */}
      <div className="bg-neutral-900 rounded-lg border border-neutral-800">
        <div className="p-4 border-b border-neutral-800">
          <h2 className="font-semibold text-neutral-100">Notification Types</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Configure which notifications you receive on each channel
          </p>
        </div>

        <div className="divide-y divide-neutral-800">
          {(Object.keys(NOTIFICATION_TYPES) as NotificationType[]).map((type) => {
            const config = NOTIFICATION_TYPES[type]
            const Icon = config.icon

            return (
              <div key={type} className="p-4">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-neutral-800">
                    <Icon className="w-5 h-5 text-neutral-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-neutral-100">{config.label}</h3>
                      {!config.canDisableInApp && (
                        <span className="px-2 py-0.5 text-xs bg-yellow-900/30 text-yellow-400 rounded">
                          Required
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-neutral-500 mt-1">{config.description}</p>

                    {/* Channel toggles */}
                    <div className="flex gap-4 mt-3">
                      {(['in_app', 'email', 'webhook'] as NotificationChannel[]).map((channel) => {
                        const enabled = getPreferenceEnabled(type, channel)
                        const isDisabled = !config.canDisableInApp && channel === 'in_app'
                        const isSaving = saving === `${type}-${channel}`

                        return (
                          <button
                            key={channel}
                            onClick={() => togglePreference(type, channel, enabled)}
                            disabled={isSaving}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                              enabled
                                ? 'bg-blue-600/20 text-blue-400 border border-blue-600'
                                : 'bg-neutral-800 text-neutral-500 border border-neutral-700 hover:border-neutral-600'
                            } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {isSaving ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : enabled ? (
                              <Check className="w-3 h-3" />
                            ) : null}
                            {channel === 'in_app' ? 'In-App' : channel === 'email' ? 'Email' : 'Webhook'}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Important Notes */}
      <div className="bg-neutral-800/50 rounded-lg p-4 text-sm text-neutral-400">
        <h3 className="font-medium text-neutral-300 mb-2">Important Notes</h3>
        <ul className="space-y-1 list-disc list-inside">
          <li>Escalation notifications cannot be fully disabled - you will always receive them in-app</li>
          <li>Email notifications are sent to your registered email address</li>
          <li>Configure webhook endpoints in the Integrations settings</li>
        </ul>
      </div>
    </div>
  )
}

function ChannelCard({
  title,
  description,
  icon: Icon,
  color,
  onTest,
  testing,
}: {
  title: string
  description: string
  icon: React.ElementType
  color: 'green' | 'blue' | 'purple'
  onTest: () => void
  testing: boolean
}) {
  const colorClasses = {
    green: 'text-green-400 bg-green-900/30',
    blue: 'text-blue-400 bg-blue-900/30',
    purple: 'text-purple-400 bg-purple-900/30',
  }

  return (
    <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-medium text-neutral-100">{title}</h3>
            <p className="text-sm text-neutral-500">{description}</p>
          </div>
        </div>
      </div>
      <button
        onClick={onTest}
        disabled={testing}
        className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-1.5 text-sm bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors disabled:opacity-50"
      >
        {testing ? (
          <>
            <Check className="w-4 h-4 text-green-400" />
            Sent!
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Send Test
          </>
        )}
      </button>
    </div>
  )
}
