-- =====================================================
-- Epic 7: Dashboard & Notifications
-- Stories 7-1 through 7-5: Notifications System
-- =====================================================

-- Notification types enum
CREATE TYPE notification_type AS ENUM (
  'escalation',
  'graduation',
  'anomaly',
  'ownership_change',
  'earnings_milestone',
  'council_decision',
  'acquisition',
  'feedback_received',
  'payout_completed',
  'trust_change',
  'system'
);

-- Notification priority enum
CREATE TYPE notification_priority AS ENUM (
  'low',
  'normal',
  'high',
  'urgent'
);

-- Notification channel enum
CREATE TYPE notification_channel AS ENUM (
  'in_app',
  'email',
  'webhook'
);

-- User notification preferences
CREATE TABLE user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type notification_type NOT NULL,
  channel notification_channel NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, notification_type, channel)
);

-- Webhook configurations
CREATE TABLE user_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  url TEXT NOT NULL,
  secret VARCHAR(255),
  enabled BOOLEAN DEFAULT true,
  notification_types notification_type[] DEFAULT ARRAY[]::notification_type[],
  retry_count INTEGER DEFAULT 0,
  last_error TEXT,
  last_success_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  priority notification_priority DEFAULT 'normal',
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  action_url TEXT,
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  dismissed BOOLEAN DEFAULT false,
  dismissed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Notification delivery log
CREATE TABLE notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel notification_channel NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, sent, delivered, failed
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  error TEXT,
  retry_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'
);

-- User dashboard preferences
CREATE TABLE user_dashboard_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  active_role VARCHAR(20) DEFAULT 'trainer', -- trainer or consumer
  default_tab VARCHAR(50) DEFAULT 'overview',
  widget_layout JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- Indexes
-- =====================================================

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_unread ON notifications(user_id, read) WHERE read = false;
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notification_deliveries_notification ON notification_deliveries(notification_id);
CREATE INDEX idx_user_prefs_user ON user_notification_preferences(user_id);
CREATE INDEX idx_user_webhooks_user ON user_webhooks(user_id);

-- =====================================================
-- RLS Policies
-- =====================================================

ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_dashboard_preferences ENABLE ROW LEVEL SECURITY;

-- Notification preferences: users can manage their own
CREATE POLICY "Users can view own notification preferences"
  ON user_notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences"
  ON user_notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
  ON user_notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notification preferences"
  ON user_notification_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- Webhooks: users can manage their own
CREATE POLICY "Users can view own webhooks"
  ON user_webhooks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own webhooks"
  ON user_webhooks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own webhooks"
  ON user_webhooks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own webhooks"
  ON user_webhooks FOR DELETE
  USING (auth.uid() = user_id);

-- Notifications: users can view and manage their own
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Deliveries: linked to notification ownership
CREATE POLICY "Users can view own notification deliveries"
  ON notification_deliveries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.id = notification_id AND n.user_id = auth.uid()
    )
  );

-- Dashboard preferences
CREATE POLICY "Users can view own dashboard preferences"
  ON user_dashboard_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dashboard preferences"
  ON user_dashboard_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own dashboard preferences"
  ON user_dashboard_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- =====================================================
-- Default notification preferences trigger
-- =====================================================

CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  -- Create default in-app preferences for all notification types
  INSERT INTO user_notification_preferences (user_id, notification_type, channel, enabled)
  SELECT
    NEW.id,
    nt.type,
    'in_app',
    true
  FROM (
    SELECT unnest(enum_range(NULL::notification_type)) as type
  ) nt;

  -- Create default email preferences for important types
  INSERT INTO user_notification_preferences (user_id, notification_type, channel, enabled)
  VALUES
    (NEW.id, 'escalation', 'email', true),
    (NEW.id, 'graduation', 'email', true),
    (NEW.id, 'anomaly', 'email', true),
    (NEW.id, 'payout_completed', 'email', true);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created_notifications
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_notification_preferences();

-- =====================================================
-- Helper functions
-- =====================================================

-- Get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM notifications
  WHERE user_id = p_user_id
    AND read = false
    AND dismissed = false
    AND (expires_at IS NULL OR expires_at > now());
$$ LANGUAGE sql STABLE;

-- Mark notifications as read
CREATE OR REPLACE FUNCTION mark_notifications_read(p_user_id UUID, p_notification_ids UUID[])
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE notifications
  SET read = true, read_at = now()
  WHERE user_id = p_user_id
    AND id = ANY(p_notification_ids)
    AND read = false;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Mark all notifications as read
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE notifications
  SET read = true, read_at = now()
  WHERE user_id = p_user_id
    AND read = false;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;
