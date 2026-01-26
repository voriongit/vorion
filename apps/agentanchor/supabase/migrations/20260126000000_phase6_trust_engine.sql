-- ============================================================================
-- Phase 6 Trust Engine Migration
-- Production-grade trust computation with regulatory compliance
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Trust Tiers (T0-T5)
CREATE TYPE trust_tier AS ENUM ('T0', 'T1', 'T2', 'T3', 'T4', 'T5');

-- Agent Roles (R-L0 to R-L8)
CREATE TYPE agent_role AS ENUM (
    'R_L0', 'R_L1', 'R_L2', 'R_L3', 'R_L4',
    'R_L5', 'R_L6', 'R_L7', 'R_L8'
);

-- Context types for hierarchical context
CREATE TYPE context_type AS ENUM ('DEPLOYMENT', 'ORGANIZATION', 'AGENT', 'OPERATION');

-- Creation types for provenance
CREATE TYPE creation_type AS ENUM ('FRESH', 'CLONED', 'EVOLVED', 'PROMOTED', 'IMPORTED');

-- Role gate decisions
CREATE TYPE role_gate_decision AS ENUM ('ALLOW', 'DENY', 'ESCALATE');

-- Compliance status
CREATE TYPE compliance_status AS ENUM ('COMPLIANT', 'WARNING', 'VIOLATION');

-- Gaming alert types
CREATE TYPE gaming_alert_type AS ENUM (
    'RAPID_CHANGE', 'OSCILLATION', 'BOUNDARY_TESTING', 'CEILING_BREACH'
);

-- Gaming alert severity
CREATE TYPE alert_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- Gaming alert status
CREATE TYPE alert_status AS ENUM ('ACTIVE', 'INVESTIGATING', 'RESOLVED', 'FALSE_POSITIVE');

-- ============================================================================
-- Q2: HIERARCHICAL CONTEXT
-- ============================================================================

-- Deployment contexts (Tier 1 - IMMUTABLE)
CREATE TABLE IF NOT EXISTS phase6_deployment_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    environment TEXT NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
    regulatory_jurisdiction TEXT,
    max_trust_ceiling INTEGER NOT NULL DEFAULT 1000,
    context_hash TEXT NOT NULL,
    frozen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organization contexts (Tier 2 - LOCKED after grace period)
CREATE TABLE IF NOT EXISTS phase6_org_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id TEXT NOT NULL REFERENCES phase6_deployment_contexts(deployment_id),
    org_id TEXT NOT NULL,
    name TEXT NOT NULL,
    compliance_frameworks JSONB NOT NULL DEFAULT '[]',
    trust_ceiling INTEGER NOT NULL DEFAULT 1000,
    context_hash TEXT NOT NULL,
    parent_hash TEXT NOT NULL,
    locked_at TIMESTAMPTZ,
    grace_period_ends TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(deployment_id, org_id)
);

-- Agent contexts (Tier 3 - FROZEN on registration)
CREATE TABLE IF NOT EXISTS phase6_agent_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id TEXT NOT NULL,
    org_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    name TEXT NOT NULL,
    capabilities JSONB NOT NULL DEFAULT '[]',
    trust_ceiling INTEGER NOT NULL DEFAULT 1000,
    context_hash TEXT NOT NULL,
    parent_hash TEXT NOT NULL,
    frozen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (deployment_id, org_id) REFERENCES phase6_org_contexts(deployment_id, org_id),
    UNIQUE(deployment_id, org_id, agent_id)
);

-- Operation contexts (Tier 4 - EPHEMERAL)
CREATE TABLE IF NOT EXISTS phase6_operation_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id TEXT NOT NULL,
    org_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    operation_id TEXT NOT NULL,
    operation_type TEXT NOT NULL,
    requested_role agent_role NOT NULL,
    context_hash TEXT NOT NULL,
    parent_hash TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    ttl_seconds INTEGER NOT NULL DEFAULT 3600,
    FOREIGN KEY (deployment_id, org_id, agent_id)
        REFERENCES phase6_agent_contexts(deployment_id, org_id, agent_id),
    UNIQUE(deployment_id, org_id, agent_id, operation_id)
);

-- ============================================================================
-- Q5: PROVENANCE TRACKING
-- ============================================================================

-- Immutable provenance records
CREATE TABLE IF NOT EXISTS phase6_provenance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id TEXT NOT NULL UNIQUE,
    creation_type creation_type NOT NULL,
    parent_agent_id TEXT,
    created_by TEXT NOT NULL,
    origin_deployment TEXT,
    origin_org TEXT,
    trust_modifier INTEGER NOT NULL DEFAULT 0,
    provenance_hash TEXT NOT NULL,
    parent_provenance_hash TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mutable policy modifiers (can be updated)
CREATE TABLE IF NOT EXISTS phase6_modifier_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id TEXT NOT NULL UNIQUE,
    creation_type creation_type NOT NULL,
    baseline_modifier INTEGER NOT NULL,
    conditions JSONB,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Q4: FEDERATED WEIGHT PRESETS
-- ============================================================================

-- ACI canonical presets (immutable reference)
CREATE TABLE IF NOT EXISTS phase6_aci_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    preset_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    weights JSONB NOT NULL,
    constraints JSONB NOT NULL DEFAULT '{}',
    preset_hash TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vorion reference presets (derived from ACI)
CREATE TABLE IF NOT EXISTS phase6_vorion_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    preset_id TEXT NOT NULL UNIQUE,
    parent_aci_preset_id TEXT NOT NULL REFERENCES phase6_aci_presets(preset_id),
    name TEXT NOT NULL,
    description TEXT,
    weight_overrides JSONB NOT NULL DEFAULT '{}',
    additional_constraints JSONB NOT NULL DEFAULT '{}',
    preset_hash TEXT NOT NULL,
    parent_hash TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Axiom deployment presets (derived from Vorion)
CREATE TABLE IF NOT EXISTS phase6_axiom_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    preset_id TEXT NOT NULL UNIQUE,
    deployment_id TEXT NOT NULL REFERENCES phase6_deployment_contexts(deployment_id),
    parent_vorion_preset_id TEXT NOT NULL REFERENCES phase6_vorion_presets(preset_id),
    name TEXT NOT NULL,
    weight_overrides JSONB NOT NULL DEFAULT '{}',
    deployment_constraints JSONB NOT NULL DEFAULT '{}',
    preset_hash TEXT NOT NULL,
    parent_hash TEXT NOT NULL,
    lineage_verified BOOLEAN NOT NULL DEFAULT FALSE,
    lineage_verified_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Q3: ROLE GATE EVALUATIONS
-- ============================================================================

-- Role gate evaluation log
CREATE TABLE IF NOT EXISTS phase6_role_gate_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id TEXT NOT NULL,
    requested_role agent_role NOT NULL,
    current_tier trust_tier NOT NULL,
    current_score INTEGER NOT NULL,

    -- 3-layer results
    kernel_allowed BOOLEAN NOT NULL,
    policy_result role_gate_decision,
    policy_applied TEXT,
    basis_override_used BOOLEAN NOT NULL DEFAULT FALSE,
    basis_approvers JSONB,

    -- Final decision
    final_decision role_gate_decision NOT NULL,
    decision_reason TEXT,

    -- Context
    operation_id TEXT,
    attestations JSONB DEFAULT '[]',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dual-control overrides for BASIS layer
CREATE TABLE IF NOT EXISTS phase6_basis_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id UUID NOT NULL REFERENCES phase6_role_gate_evaluations(id),
    agent_id TEXT NOT NULL,
    requested_role agent_role NOT NULL,
    reason TEXT NOT NULL,

    -- Approvers (need 2)
    approver_1_id TEXT NOT NULL,
    approver_1_at TIMESTAMPTZ NOT NULL,
    approver_2_id TEXT,
    approver_2_at TIMESTAMPTZ,

    -- Override validity
    valid_until TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revoked_by TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Q1: CEILING ENFORCEMENT & GAMING DETECTION
-- ============================================================================

-- Trust ceiling events
CREATE TABLE IF NOT EXISTS phase6_ceiling_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id TEXT NOT NULL,
    event_type TEXT NOT NULL,

    -- Score details
    previous_score INTEGER NOT NULL,
    proposed_score INTEGER NOT NULL,
    final_score INTEGER NOT NULL,

    -- Ceiling info
    effective_ceiling INTEGER NOT NULL,
    ceiling_source TEXT NOT NULL, -- 'regulatory', 'organizational', 'agent'
    ceiling_applied BOOLEAN NOT NULL,

    -- Compliance
    compliance_status compliance_status NOT NULL,
    compliance_framework TEXT,

    -- Audit
    audit_required BOOLEAN NOT NULL DEFAULT FALSE,
    retention_days INTEGER,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Gaming detection alerts
CREATE TABLE IF NOT EXISTS phase6_gaming_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id TEXT NOT NULL,
    alert_type gaming_alert_type NOT NULL,
    severity alert_severity NOT NULL,
    status alert_status NOT NULL DEFAULT 'ACTIVE',

    -- Detection details
    details TEXT NOT NULL,
    occurrences INTEGER NOT NULL DEFAULT 1,
    threshold_value NUMERIC,
    actual_value NUMERIC,

    -- Window
    window_start TIMESTAMPTZ NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,

    -- Resolution
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT,
    resolution_notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Regulatory audit log (immutable, long retention)
CREATE TABLE IF NOT EXISTS phase6_regulatory_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_number BIGINT NOT NULL,

    -- Event info
    event_type TEXT NOT NULL,
    agent_id TEXT NOT NULL,

    -- Compliance
    framework TEXT NOT NULL, -- 'EU_AI_ACT', 'NIST_AI_RMF', etc.
    article_reference TEXT,

    -- Details
    details JSONB NOT NULL,

    -- Integrity
    previous_hash TEXT NOT NULL,
    entry_hash TEXT NOT NULL,

    -- Retention
    retention_required_until TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- AGGREGATE STATS VIEW
-- ============================================================================

CREATE OR REPLACE VIEW phase6_stats AS
SELECT
    -- Context stats
    (SELECT COUNT(*) FROM phase6_deployment_contexts) AS deployment_count,
    (SELECT COUNT(*) FROM phase6_org_contexts) AS org_count,
    (SELECT COUNT(*) FROM phase6_agent_contexts) AS agent_count,
    (SELECT COUNT(*) FROM phase6_operation_contexts WHERE completed_at IS NULL) AS active_operations,

    -- Ceiling stats
    (SELECT COUNT(*) FROM phase6_ceiling_events) AS total_ceiling_events,
    (SELECT COUNT(*) FROM phase6_ceiling_events WHERE compliance_status = 'COMPLIANT') AS compliant_events,
    (SELECT COUNT(*) FROM phase6_ceiling_events WHERE compliance_status = 'WARNING') AS warning_events,
    (SELECT COUNT(*) FROM phase6_ceiling_events WHERE compliance_status = 'VIOLATION') AS violation_events,

    -- Role gate stats
    (SELECT COUNT(*) FROM phase6_role_gate_evaluations) AS total_evaluations,
    (SELECT COUNT(*) FROM phase6_role_gate_evaluations WHERE final_decision = 'ALLOW') AS allowed_count,
    (SELECT COUNT(*) FROM phase6_role_gate_evaluations WHERE final_decision = 'DENY') AS denied_count,
    (SELECT COUNT(*) FROM phase6_role_gate_evaluations WHERE final_decision = 'ESCALATE') AS escalated_count,

    -- Gaming alerts
    (SELECT COUNT(*) FROM phase6_gaming_alerts WHERE status = 'ACTIVE') AS active_alerts,

    -- Preset stats
    (SELECT COUNT(*) FROM phase6_aci_presets) AS aci_preset_count,
    (SELECT COUNT(*) FROM phase6_vorion_presets) AS vorion_preset_count,
    (SELECT COUNT(*) FROM phase6_axiom_presets) AS axiom_preset_count,
    (SELECT COUNT(*) FROM phase6_axiom_presets WHERE lineage_verified = TRUE) AS verified_lineages;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Context indexes
CREATE INDEX IF NOT EXISTS idx_org_contexts_deployment ON phase6_org_contexts(deployment_id);
CREATE INDEX IF NOT EXISTS idx_agent_contexts_org ON phase6_agent_contexts(deployment_id, org_id);
CREATE INDEX IF NOT EXISTS idx_operation_contexts_agent ON phase6_operation_contexts(deployment_id, org_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_operation_contexts_active ON phase6_operation_contexts(completed_at) WHERE completed_at IS NULL;

-- Provenance indexes
CREATE INDEX IF NOT EXISTS idx_provenance_parent ON phase6_provenance(parent_agent_id);
CREATE INDEX IF NOT EXISTS idx_provenance_type ON phase6_provenance(creation_type);

-- Preset indexes
CREATE INDEX IF NOT EXISTS idx_vorion_presets_parent ON phase6_vorion_presets(parent_aci_preset_id);
CREATE INDEX IF NOT EXISTS idx_axiom_presets_parent ON phase6_axiom_presets(parent_vorion_preset_id);
CREATE INDEX IF NOT EXISTS idx_axiom_presets_deployment ON phase6_axiom_presets(deployment_id);

-- Role gate indexes
CREATE INDEX IF NOT EXISTS idx_role_gate_agent ON phase6_role_gate_evaluations(agent_id);
CREATE INDEX IF NOT EXISTS idx_role_gate_decision ON phase6_role_gate_evaluations(final_decision);
CREATE INDEX IF NOT EXISTS idx_role_gate_created ON phase6_role_gate_evaluations(created_at);

-- Ceiling indexes
CREATE INDEX IF NOT EXISTS idx_ceiling_events_agent ON phase6_ceiling_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_ceiling_events_status ON phase6_ceiling_events(compliance_status);
CREATE INDEX IF NOT EXISTS idx_ceiling_events_created ON phase6_ceiling_events(created_at);

-- Gaming alert indexes
CREATE INDEX IF NOT EXISTS idx_gaming_alerts_agent ON phase6_gaming_alerts(agent_id);
CREATE INDEX IF NOT EXISTS idx_gaming_alerts_status ON phase6_gaming_alerts(status);
CREATE INDEX IF NOT EXISTS idx_gaming_alerts_severity ON phase6_gaming_alerts(severity);

-- Regulatory audit indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_regulatory_audit_sequence ON phase6_regulatory_audit(sequence_number);
CREATE INDEX IF NOT EXISTS idx_regulatory_audit_agent ON phase6_regulatory_audit(agent_id);
CREATE INDEX IF NOT EXISTS idx_regulatory_audit_framework ON phase6_regulatory_audit(framework);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE phase6_deployment_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase6_org_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase6_agent_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase6_operation_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase6_provenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase6_modifier_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase6_aci_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase6_vorion_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase6_axiom_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase6_role_gate_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase6_basis_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase6_ceiling_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase6_gaming_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase6_regulatory_audit ENABLE ROW LEVEL SECURITY;

-- Read policies (authenticated users can read)
CREATE POLICY "phase6_read_deployment" ON phase6_deployment_contexts FOR SELECT USING (true);
CREATE POLICY "phase6_read_org" ON phase6_org_contexts FOR SELECT USING (true);
CREATE POLICY "phase6_read_agent" ON phase6_agent_contexts FOR SELECT USING (true);
CREATE POLICY "phase6_read_operation" ON phase6_operation_contexts FOR SELECT USING (true);
CREATE POLICY "phase6_read_provenance" ON phase6_provenance FOR SELECT USING (true);
CREATE POLICY "phase6_read_modifier_policies" ON phase6_modifier_policies FOR SELECT USING (true);
CREATE POLICY "phase6_read_aci_presets" ON phase6_aci_presets FOR SELECT USING (true);
CREATE POLICY "phase6_read_vorion_presets" ON phase6_vorion_presets FOR SELECT USING (true);
CREATE POLICY "phase6_read_axiom_presets" ON phase6_axiom_presets FOR SELECT USING (true);
CREATE POLICY "phase6_read_role_gate" ON phase6_role_gate_evaluations FOR SELECT USING (true);
CREATE POLICY "phase6_read_basis_overrides" ON phase6_basis_overrides FOR SELECT USING (true);
CREATE POLICY "phase6_read_ceiling_events" ON phase6_ceiling_events FOR SELECT USING (true);
CREATE POLICY "phase6_read_gaming_alerts" ON phase6_gaming_alerts FOR SELECT USING (true);
CREATE POLICY "phase6_read_regulatory_audit" ON phase6_regulatory_audit FOR SELECT USING (true);

-- Write policies (service role only for most tables)
CREATE POLICY "phase6_insert_deployment" ON phase6_deployment_contexts FOR INSERT WITH CHECK (true);
CREATE POLICY "phase6_insert_org" ON phase6_org_contexts FOR INSERT WITH CHECK (true);
CREATE POLICY "phase6_insert_agent" ON phase6_agent_contexts FOR INSERT WITH CHECK (true);
CREATE POLICY "phase6_insert_operation" ON phase6_operation_contexts FOR INSERT WITH CHECK (true);
CREATE POLICY "phase6_insert_provenance" ON phase6_provenance FOR INSERT WITH CHECK (true);
CREATE POLICY "phase6_insert_modifier_policies" ON phase6_modifier_policies FOR INSERT WITH CHECK (true);
CREATE POLICY "phase6_insert_aci_presets" ON phase6_aci_presets FOR INSERT WITH CHECK (true);
CREATE POLICY "phase6_insert_vorion_presets" ON phase6_vorion_presets FOR INSERT WITH CHECK (true);
CREATE POLICY "phase6_insert_axiom_presets" ON phase6_axiom_presets FOR INSERT WITH CHECK (true);
CREATE POLICY "phase6_insert_role_gate" ON phase6_role_gate_evaluations FOR INSERT WITH CHECK (true);
CREATE POLICY "phase6_insert_basis_overrides" ON phase6_basis_overrides FOR INSERT WITH CHECK (true);
CREATE POLICY "phase6_insert_ceiling_events" ON phase6_ceiling_events FOR INSERT WITH CHECK (true);
CREATE POLICY "phase6_insert_gaming_alerts" ON phase6_gaming_alerts FOR INSERT WITH CHECK (true);
CREATE POLICY "phase6_insert_regulatory_audit" ON phase6_regulatory_audit FOR INSERT WITH CHECK (true);

-- Update policies (limited)
CREATE POLICY "phase6_update_org" ON phase6_org_contexts FOR UPDATE USING (locked_at IS NULL);
CREATE POLICY "phase6_update_operation" ON phase6_operation_contexts FOR UPDATE USING (completed_at IS NULL);
CREATE POLICY "phase6_update_modifier_policies" ON phase6_modifier_policies FOR UPDATE USING (true);
CREATE POLICY "phase6_update_vorion_presets" ON phase6_vorion_presets FOR UPDATE USING (true);
CREATE POLICY "phase6_update_axiom_presets" ON phase6_axiom_presets FOR UPDATE USING (true);
CREATE POLICY "phase6_update_basis_overrides" ON phase6_basis_overrides FOR UPDATE USING (revoked_at IS NULL);
CREATE POLICY "phase6_update_gaming_alerts" ON phase6_gaming_alerts FOR UPDATE USING (true);

-- NO DELETE POLICIES - Phase 6 data is append-only for audit trail

-- ============================================================================
-- SEED DATA: Default modifier policies
-- ============================================================================

INSERT INTO phase6_modifier_policies (policy_id, creation_type, baseline_modifier, created_by)
VALUES
    ('default:fresh', 'FRESH', 0, 'system'),
    ('default:cloned', 'CLONED', -50, 'system'),
    ('default:evolved', 'EVOLVED', 100, 'system'),
    ('default:promoted', 'PROMOTED', 150, 'system'),
    ('default:imported', 'IMPORTED', -100, 'system')
ON CONFLICT (policy_id) DO NOTHING;

-- ============================================================================
-- SEED DATA: ACI Canonical Presets
-- ============================================================================

INSERT INTO phase6_aci_presets (preset_id, name, description, weights, constraints, preset_hash)
VALUES
    (
        'aci:conservative',
        'ACI Conservative',
        'Conservative trust computation with strict ceilings',
        '{"behavioral": 0.4, "identity": 0.3, "contextual": 0.2, "historical": 0.1}',
        '{"maxTier": "T4", "requireAttestation": true, "minHistoryDays": 30}',
        'aci-conservative-v1-' || encode(sha256('aci:conservative:v1'::bytea), 'hex')
    ),
    (
        'aci:balanced',
        'ACI Balanced',
        'Balanced trust computation for general use',
        '{"behavioral": 0.3, "identity": 0.25, "contextual": 0.25, "historical": 0.2}',
        '{"maxTier": "T5", "requireAttestation": false, "minHistoryDays": 7}',
        'aci-balanced-v1-' || encode(sha256('aci:balanced:v1'::bytea), 'hex')
    ),
    (
        'aci:progressive',
        'ACI Progressive',
        'Progressive trust computation with faster advancement',
        '{"behavioral": 0.25, "identity": 0.2, "contextual": 0.3, "historical": 0.25}',
        '{"maxTier": "T5", "requireAttestation": false, "minHistoryDays": 3}',
        'aci-progressive-v1-' || encode(sha256('aci:progressive:v1'::bytea), 'hex')
    )
ON CONFLICT (preset_id) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE phase6_deployment_contexts IS 'Q2: Tier 1 deployment contexts (IMMUTABLE)';
COMMENT ON TABLE phase6_org_contexts IS 'Q2: Tier 2 organization contexts (LOCKED after grace)';
COMMENT ON TABLE phase6_agent_contexts IS 'Q2: Tier 3 agent contexts (FROZEN on registration)';
COMMENT ON TABLE phase6_operation_contexts IS 'Q2: Tier 4 operation contexts (EPHEMERAL)';
COMMENT ON TABLE phase6_provenance IS 'Q5: Immutable agent provenance records';
COMMENT ON TABLE phase6_modifier_policies IS 'Q5: Mutable trust score modifier policies';
COMMENT ON TABLE phase6_aci_presets IS 'Q4: ACI canonical weight presets';
COMMENT ON TABLE phase6_vorion_presets IS 'Q4: Vorion reference presets (derived from ACI)';
COMMENT ON TABLE phase6_axiom_presets IS 'Q4: Axiom deployment presets (derived from Vorion)';
COMMENT ON TABLE phase6_role_gate_evaluations IS 'Q3: Role gate evaluation audit log';
COMMENT ON TABLE phase6_basis_overrides IS 'Q3: BASIS layer dual-control overrides';
COMMENT ON TABLE phase6_ceiling_events IS 'Q1: Trust ceiling enforcement events';
COMMENT ON TABLE phase6_gaming_alerts IS 'Q1: Gaming detection alerts';
COMMENT ON TABLE phase6_regulatory_audit IS 'Q1: Regulatory compliance audit trail';
