-- Migration: 001_phase6_initial
-- Description: Initial Phase 6 Trust Engine schema
-- Created: 2024-01-15

-- =============================================================================
-- ENUMS
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE trust_tier AS ENUM ('UNKNOWN', 'BASIC', 'VERIFIED', 'TRUSTED', 'PRIVILEGED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE agent_role AS ENUM (
        'READER',
        'WRITER',
        'DATA_ANALYST',
        'CODE_EXECUTOR',
        'SYSTEM_ADMIN',
        'EXTERNAL_COMMUNICATOR',
        'RESOURCE_MANAGER',
        'AUDITOR'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE gate_decision AS ENUM ('ALLOW', 'DENY', 'ESCALATE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE provenance_type AS ENUM ('ROLE_GATE', 'CEILING', 'ESCALATION', 'ALERT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE alert_severity AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE alert_status AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE resource_type AS ENUM ('API_CALLS', 'DATA_ACCESS', 'COMPUTE', 'STORAGE', 'NETWORK');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- ROLE GATES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS phase6_role_gates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role agent_role NOT NULL,
    minimum_tier trust_tier NOT NULL,
    description TEXT,
    conditions JSONB DEFAULT '[]'::jsonb,
    enabled BOOLEAN DEFAULT true,
    organization_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID,

    CONSTRAINT unique_role_org UNIQUE (role, organization_id)
);

CREATE INDEX idx_role_gates_role ON phase6_role_gates(role);
CREATE INDEX idx_role_gates_tier ON phase6_role_gates(minimum_tier);
CREATE INDEX idx_role_gates_org ON phase6_role_gates(organization_id);

-- =============================================================================
-- ROLE GATE EVALUATIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS phase6_role_gate_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gate_id UUID REFERENCES phase6_role_gates(id) ON DELETE SET NULL,
    agent_id TEXT NOT NULL,
    requested_role agent_role NOT NULL,
    agent_tier trust_tier NOT NULL,
    decision gate_decision NOT NULL,
    reason TEXT,
    context JSONB DEFAULT '{}'::jsonb,
    provenance_id UUID,
    evaluated_at TIMESTAMPTZ DEFAULT now(),
    organization_id UUID
);

CREATE INDEX idx_evaluations_agent ON phase6_role_gate_evaluations(agent_id);
CREATE INDEX idx_evaluations_role ON phase6_role_gate_evaluations(requested_role);
CREATE INDEX idx_evaluations_decision ON phase6_role_gate_evaluations(decision);
CREATE INDEX idx_evaluations_date ON phase6_role_gate_evaluations(evaluated_at);
CREATE INDEX idx_evaluations_org ON phase6_role_gate_evaluations(organization_id);

-- =============================================================================
-- CAPABILITY CEILINGS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS phase6_capability_ceilings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier trust_tier NOT NULL,
    resource_type resource_type NOT NULL,
    ceiling_value INTEGER NOT NULL,
    window_seconds INTEGER DEFAULT 3600,
    organization_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT unique_ceiling UNIQUE (tier, resource_type, organization_id)
);

CREATE INDEX idx_ceilings_tier ON phase6_capability_ceilings(tier);
CREATE INDEX idx_ceilings_resource ON phase6_capability_ceilings(resource_type);

-- =============================================================================
-- CAPABILITY USAGE TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS phase6_capability_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id TEXT NOT NULL,
    resource_type resource_type NOT NULL,
    usage_count INTEGER DEFAULT 0,
    window_start TIMESTAMPTZ NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,
    organization_id UUID,
    updated_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT unique_usage UNIQUE (agent_id, resource_type, window_start)
);

CREATE INDEX idx_usage_agent ON phase6_capability_usage(agent_id);
CREATE INDEX idx_usage_resource ON phase6_capability_usage(resource_type);
CREATE INDEX idx_usage_window ON phase6_capability_usage(window_start, window_end);

-- =============================================================================
-- PROVENANCE RECORDS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS phase6_provenance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type provenance_type NOT NULL,
    agent_id TEXT NOT NULL,
    decision TEXT NOT NULL,
    reason TEXT,
    context JSONB DEFAULT '{}'::jsonb,
    parent_id UUID REFERENCES phase6_provenance(id),
    merkle_root TEXT,
    signature TEXT,
    organization_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_provenance_agent ON phase6_provenance(agent_id);
CREATE INDEX idx_provenance_type ON phase6_provenance(type);
CREATE INDEX idx_provenance_parent ON phase6_provenance(parent_id);
CREATE INDEX idx_provenance_date ON phase6_provenance(created_at);
CREATE INDEX idx_provenance_org ON phase6_provenance(organization_id);

-- =============================================================================
-- GAMING ALERTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS phase6_gaming_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    severity alert_severity NOT NULL,
    status alert_status DEFAULT 'ACTIVE',
    agent_id TEXT NOT NULL,
    description TEXT NOT NULL,
    evidence JSONB DEFAULT '{}'::jsonb,
    detected_at TIMESTAMPTZ DEFAULT now(),
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID,
    resolution TEXT,
    organization_id UUID
);

CREATE INDEX idx_alerts_agent ON phase6_gaming_alerts(agent_id);
CREATE INDEX idx_alerts_severity ON phase6_gaming_alerts(severity);
CREATE INDEX idx_alerts_status ON phase6_gaming_alerts(status);
CREATE INDEX idx_alerts_date ON phase6_gaming_alerts(detected_at);
CREATE INDEX idx_alerts_org ON phase6_gaming_alerts(organization_id);

-- =============================================================================
-- ACI PRESETS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS phase6_aci_presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    config JSONB NOT NULL,
    is_builtin BOOLEAN DEFAULT false,
    organization_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID
);

CREATE INDEX idx_presets_category ON phase6_aci_presets(category);
CREATE INDEX idx_presets_org ON phase6_aci_presets(organization_id);

-- =============================================================================
-- WEBHOOKS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS phase6_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL,
    events TEXT[] NOT NULL,
    secret TEXT,
    enabled BOOLEAN DEFAULT true,
    organization_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_triggered_at TIMESTAMPTZ,
    failure_count INTEGER DEFAULT 0
);

CREATE INDEX idx_webhooks_org ON phase6_webhooks(organization_id);
CREATE INDEX idx_webhooks_enabled ON phase6_webhooks(enabled);

-- =============================================================================
-- WEBHOOK DELIVERIES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS phase6_webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID REFERENCES phase6_webhooks(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    payload JSONB NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    error TEXT,
    delivered_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_deliveries_webhook ON phase6_webhook_deliveries(webhook_id);
CREATE INDEX idx_deliveries_date ON phase6_webhook_deliveries(delivered_at);

-- =============================================================================
-- AUDIT LOG TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS phase6_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    actor_id TEXT,
    actor_type TEXT,
    changes JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    organization_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_action ON phase6_audit_log(action);
CREATE INDEX idx_audit_resource ON phase6_audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_actor ON phase6_audit_log(actor_id);
CREATE INDEX idx_audit_date ON phase6_audit_log(created_at);
CREATE INDEX idx_audit_org ON phase6_audit_log(organization_id);

-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_role_gates_updated_at BEFORE UPDATE ON phase6_role_gates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ceilings_updated_at BEFORE UPDATE ON phase6_capability_ceilings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usage_updated_at BEFORE UPDATE ON phase6_capability_usage
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_presets_updated_at BEFORE UPDATE ON phase6_aci_presets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- DEFAULT ROLE GATES
-- =============================================================================

INSERT INTO phase6_role_gates (role, minimum_tier, description) VALUES
    ('READER', 'BASIC', 'Read-only access to data'),
    ('WRITER', 'VERIFIED', 'Write access to data'),
    ('DATA_ANALYST', 'VERIFIED', 'Data analysis and aggregation'),
    ('CODE_EXECUTOR', 'TRUSTED', 'Execute code in sandbox'),
    ('SYSTEM_ADMIN', 'PRIVILEGED', 'Administrative operations'),
    ('EXTERNAL_COMMUNICATOR', 'TRUSTED', 'External API communication'),
    ('RESOURCE_MANAGER', 'TRUSTED', 'Resource allocation'),
    ('AUDITOR', 'VERIFIED', 'Audit log access')
ON CONFLICT (role, organization_id) DO NOTHING;

-- =============================================================================
-- DEFAULT CAPABILITY CEILINGS
-- =============================================================================

INSERT INTO phase6_capability_ceilings (tier, resource_type, ceiling_value, window_seconds) VALUES
    ('BASIC', 'API_CALLS', 100, 3600),
    ('BASIC', 'DATA_ACCESS', 10, 3600),
    ('VERIFIED', 'API_CALLS', 500, 3600),
    ('VERIFIED', 'DATA_ACCESS', 50, 3600),
    ('TRUSTED', 'API_CALLS', 2000, 3600),
    ('TRUSTED', 'DATA_ACCESS', 200, 3600),
    ('TRUSTED', 'COMPUTE', 60, 3600),
    ('PRIVILEGED', 'API_CALLS', 10000, 3600),
    ('PRIVILEGED', 'DATA_ACCESS', 1000, 3600),
    ('PRIVILEGED', 'COMPUTE', 300, 3600),
    ('PRIVILEGED', 'STORAGE', 1000, 3600)
ON CONFLICT (tier, resource_type, organization_id) DO NOTHING;
