-- =============================================================================
-- Compliance Module Database Migration
-- SOC 2, HIPAA, ISO 27001 Compliance Tables
-- =============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- Compliance Audit Logs Table
-- Immutable audit trail with hash chain for integrity
-- =============================================================================

CREATE TABLE IF NOT EXISTS compliance_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id TEXT UNIQUE NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type TEXT NOT NULL,

    -- Actor
    user_id UUID REFERENCES profiles(id),
    agent_id TEXT,
    ip_address INET,
    user_agent TEXT,

    -- Target
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,

    -- Action
    action TEXT NOT NULL,
    outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure', 'denied', 'error')),

    -- Context
    details JSONB DEFAULT '{}',
    frameworks TEXT[] DEFAULT '{}',
    control_ids TEXT[] DEFAULT '{}',

    -- Integrity
    previous_hash TEXT,
    hash TEXT NOT NULL,

    -- Classification
    sensitivity TEXT NOT NULL CHECK (sensitivity IN ('low', 'medium', 'high', 'critical')),
    phi_involved BOOLEAN DEFAULT FALSE,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON compliance_audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON compliance_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON compliance_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON compliance_audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_frameworks ON compliance_audit_logs USING GIN(frameworks);
CREATE INDEX IF NOT EXISTS idx_audit_logs_phi ON compliance_audit_logs(phi_involved) WHERE phi_involved = TRUE;

-- =============================================================================
-- PHI Access Logs Table (HIPAA)
-- Tracks all PHI access for minimum necessary compliance
-- =============================================================================

CREATE TABLE IF NOT EXISTS phi_access_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    agent_id TEXT,

    -- PHI Details
    action TEXT NOT NULL CHECK (action IN ('view', 'create', 'modify', 'delete', 'export', 'transmit')),
    phi_type TEXT NOT NULL,
    patient_identifier_hash TEXT NOT NULL,

    -- Authorization
    purpose TEXT NOT NULL CHECK (purpose IN ('treatment', 'payment', 'operations', 'research', 'other')),
    authorized BOOLEAN NOT NULL,
    minimum_necessary BOOLEAN NOT NULL DEFAULT TRUE,

    -- Audit Reference
    audit_log_id UUID REFERENCES compliance_audit_logs(id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phi_access_user ON phi_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_phi_access_patient ON phi_access_logs(patient_identifier_hash);
CREATE INDEX IF NOT EXISTS idx_phi_access_purpose ON phi_access_logs(purpose);
CREATE INDEX IF NOT EXISTS idx_phi_access_timestamp ON phi_access_logs(timestamp DESC);

-- =============================================================================
-- Breach Records Table (HIPAA)
-- Tracks security breaches and notification requirements
-- =============================================================================

CREATE TABLE IF NOT EXISTS breach_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    breach_id TEXT UNIQUE NOT NULL,
    discovered_at TIMESTAMPTZ NOT NULL,
    discovered_by TEXT NOT NULL,

    -- Classification
    severity TEXT NOT NULL CHECK (severity IN ('confirmed_breach', 'potential_breach', 'security_incident', 'near_miss')),
    description TEXT NOT NULL,
    affected_records INTEGER DEFAULT 0,
    phi_involved BOOLEAN DEFAULT FALSE,

    -- HIPAA Breach Determination
    breach_determination JSONB,

    -- Response
    containment_actions TEXT[] DEFAULT '{}',
    eradication_actions TEXT[] DEFAULT '{}',
    recovery_actions TEXT[] DEFAULT '{}',
    lessons_learned TEXT,

    -- Status
    status TEXT NOT NULL DEFAULT 'investigating' CHECK (status IN ('investigating', 'contained', 'resolved', 'closed')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_breach_status ON breach_records(status);
CREATE INDEX IF NOT EXISTS idx_breach_severity ON breach_records(severity);
CREATE INDEX IF NOT EXISTS idx_breach_phi ON breach_records(phi_involved) WHERE phi_involved = TRUE;

-- =============================================================================
-- Breach Notifications Table (HIPAA)
-- Tracks breach notification compliance
-- =============================================================================

CREATE TABLE IF NOT EXISTS breach_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notification_id TEXT UNIQUE NOT NULL,
    breach_id TEXT NOT NULL REFERENCES breach_records(breach_id),

    notification_type TEXT NOT NULL CHECK (notification_type IN ('individual', 'hhs', 'media', 'business_associate')),
    notified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notified_by TEXT NOT NULL,
    recipient TEXT NOT NULL,
    method TEXT NOT NULL CHECK (method IN ('email', 'mail', 'portal', 'press_release')),

    content TEXT,
    acknowledgment TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_breach ON breach_notifications(breach_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON breach_notifications(notification_type);

-- =============================================================================
-- Compliance Controls Table
-- Unified control tracking across frameworks
-- =============================================================================

CREATE TABLE IF NOT EXISTS compliance_controls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    control_id TEXT UNIQUE NOT NULL,

    -- Framework
    framework TEXT NOT NULL CHECK (framework IN ('soc2', 'hipaa', 'iso27001')),
    category TEXT NOT NULL,

    -- Control Details
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    implementation TEXT,

    -- Status
    status TEXT NOT NULL DEFAULT 'not_implemented' CHECK (status IN ('implemented', 'planned', 'not_implemented', 'not_applicable')),
    justification TEXT,

    -- Testing
    last_tested TIMESTAMPTZ,
    next_test_date TIMESTAMPTZ,
    test_frequency TEXT DEFAULT 'annual',
    automated_testing BOOLEAN DEFAULT FALSE,

    -- Ownership
    owner TEXT,
    monitoring_agent_id TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_controls_framework ON compliance_controls(framework);
CREATE INDEX IF NOT EXISTS idx_controls_status ON compliance_controls(status);

-- =============================================================================
-- Risk Register Table (ISO 27001)
-- Information security risk management
-- =============================================================================

CREATE TABLE IF NOT EXISTS risk_register (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    risk_id TEXT UNIQUE NOT NULL,

    -- Classification
    category TEXT NOT NULL CHECK (category IN ('security', 'operational', 'compliance', 'reputational', 'financial')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,

    -- Inherent Risk
    likelihood INTEGER NOT NULL CHECK (likelihood BETWEEN 1 AND 5),
    impact INTEGER NOT NULL CHECK (impact BETWEEN 1 AND 5),
    inherent_risk_score INTEGER GENERATED ALWAYS AS (likelihood * impact) STORED,

    -- Controls
    controls TEXT[] DEFAULT '{}',

    -- Residual Risk
    residual_likelihood INTEGER NOT NULL CHECK (residual_likelihood BETWEEN 1 AND 5),
    residual_impact INTEGER NOT NULL CHECK (residual_impact BETWEEN 1 AND 5),
    residual_risk_score INTEGER GENERATED ALWAYS AS (residual_likelihood * residual_impact) STORED,

    -- Treatment
    treatment TEXT NOT NULL CHECK (treatment IN ('mitigate', 'accept', 'transfer', 'avoid')),

    -- Ownership
    owner TEXT NOT NULL,
    review_date TIMESTAMPTZ NOT NULL,
    frameworks TEXT[] DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risks_category ON risk_register(category);
CREATE INDEX IF NOT EXISTS idx_risks_treatment ON risk_register(treatment);
CREATE INDEX IF NOT EXISTS idx_risks_score ON risk_register(residual_risk_score DESC);

-- =============================================================================
-- Compliance Evidence Table
-- Evidence collection for audits
-- =============================================================================

CREATE TABLE IF NOT EXISTS compliance_evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evidence_id TEXT UNIQUE NOT NULL,

    -- Classification
    type TEXT NOT NULL CHECK (type IN ('policy', 'procedure', 'log', 'screenshot', 'report', 'configuration', 'attestation', 'audit_trail')),
    title TEXT NOT NULL,
    description TEXT,

    -- Collection
    collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    collected_by TEXT NOT NULL,

    -- Storage
    file_path TEXT,
    data_hash TEXT NOT NULL,

    -- Retention
    retention_date TIMESTAMPTZ NOT NULL,

    -- Framework Mapping
    frameworks TEXT[] DEFAULT '{}',
    control_ids TEXT[] DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_type ON compliance_evidence(type);
CREATE INDEX IF NOT EXISTS idx_evidence_frameworks ON compliance_evidence USING GIN(frameworks);
CREATE INDEX IF NOT EXISTS idx_evidence_controls ON compliance_evidence USING GIN(control_ids);

-- =============================================================================
-- Audit Findings Table
-- Track audit findings and remediation
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    finding_id TEXT UNIQUE NOT NULL,
    audit_id TEXT NOT NULL,

    -- Finding Details
    control_id TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'informational')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    recommendation TEXT,

    -- Status
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'remediated', 'accepted', 'false_positive')),
    due_date TIMESTAMPTZ,
    remediated_date TIMESTAMPTZ,

    -- Ownership
    owner TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_findings_audit ON audit_findings(audit_id);
CREATE INDEX IF NOT EXISTS idx_findings_status ON audit_findings(status);
CREATE INDEX IF NOT EXISTS idx_findings_severity ON audit_findings(severity);

-- =============================================================================
-- Business Associate Agreements Table (HIPAA)
-- Track BAAs for HIPAA compliance
-- =============================================================================

CREATE TABLE IF NOT EXISTS business_associate_agreements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    baa_id TEXT UNIQUE NOT NULL,

    -- Vendor Info
    vendor_name TEXT NOT NULL,
    vendor_id TEXT NOT NULL,

    -- Agreement Terms
    effective_date DATE NOT NULL,
    expiration_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'expired', 'terminated')),

    -- Requirements
    permitted_uses TEXT[] DEFAULT '{}',
    permitted_disclosures TEXT[] DEFAULT '{}',
    safeguard_requirements TEXT[] DEFAULT '{}',
    breach_notification_terms TEXT,
    subcontractor_terms TEXT,
    termination_terms TEXT,

    -- Review
    last_review_date DATE,
    next_review_date DATE,
    document_path TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_baa_status ON business_associate_agreements(status);
CREATE INDEX IF NOT EXISTS idx_baa_expiration ON business_associate_agreements(expiration_date);
CREATE INDEX IF NOT EXISTS idx_baa_vendor ON business_associate_agreements(vendor_id);

-- =============================================================================
-- Agent Compliance Context Table
-- Track compliance context for each agent
-- =============================================================================

CREATE TABLE IF NOT EXISTS agent_compliance_context (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id TEXT UNIQUE NOT NULL,

    -- Frameworks
    frameworks TEXT[] DEFAULT '{}',

    -- PHI Authorization (HIPAA)
    phi_authorized BOOLEAN DEFAULT FALSE,
    phi_purposes TEXT[] DEFAULT '{}',
    minimum_necessary_enforced BOOLEAN DEFAULT TRUE,

    -- Data Classification
    data_classification TEXT DEFAULT 'internal' CHECK (data_classification IN ('public', 'internal', 'confidential', 'restricted')),
    encryption_required BOOLEAN DEFAULT TRUE,

    -- Audit
    audit_logging_enabled BOOLEAN DEFAULT TRUE,
    retention_period INTEGER DEFAULT 2555, -- 7 years in days

    -- Access Control
    access_level TEXT DEFAULT 'read' CHECK (access_level IN ('none', 'read', 'write', 'admin')),
    mfa_required BOOLEAN DEFAULT FALSE,

    -- Controls
    active_controls TEXT[] DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_compliance_phi ON agent_compliance_context(phi_authorized) WHERE phi_authorized = TRUE;
CREATE INDEX IF NOT EXISTS idx_agent_compliance_frameworks ON agent_compliance_context USING GIN(frameworks);

-- =============================================================================
-- Row Level Security Policies
-- =============================================================================

-- Enable RLS on all compliance tables
ALTER TABLE compliance_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE phi_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE breach_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE breach_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_register ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_associate_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_compliance_context ENABLE ROW LEVEL SECURITY;

-- Audit logs: Read-only for authenticated users, no modifications allowed
CREATE POLICY "Audit logs are read-only" ON compliance_audit_logs
    FOR SELECT
    TO authenticated
    USING (true);

-- Insert policy for system/service role only
CREATE POLICY "System can insert audit logs" ON compliance_audit_logs
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- PHI access logs: Users can view their own, admins can view all
CREATE POLICY "Users can view own PHI access" ON phi_access_logs
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    ));

-- Compliance controls: Authenticated users can read
CREATE POLICY "Authenticated users can read controls" ON compliance_controls
    FOR SELECT
    TO authenticated
    USING (true);

-- Risk register: Authenticated users can read
CREATE POLICY "Authenticated users can read risks" ON risk_register
    FOR SELECT
    TO authenticated
    USING (true);

-- =============================================================================
-- Triggers for Updated Timestamps
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_breach_records_updated_at
    BEFORE UPDATE ON breach_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_compliance_controls_updated_at
    BEFORE UPDATE ON compliance_controls
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_risk_register_updated_at
    BEFORE UPDATE ON risk_register
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_audit_findings_updated_at
    BEFORE UPDATE ON audit_findings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_baa_updated_at
    BEFORE UPDATE ON business_associate_agreements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_compliance_updated_at
    BEFORE UPDATE ON agent_compliance_context
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Comments for Documentation
-- =============================================================================

COMMENT ON TABLE compliance_audit_logs IS 'Immutable audit trail for SOC 2, HIPAA, ISO 27001 compliance with hash chain integrity';
COMMENT ON TABLE phi_access_logs IS 'HIPAA-specific PHI access logging for minimum necessary compliance';
COMMENT ON TABLE breach_records IS 'Security breach tracking and HIPAA breach notification management';
COMMENT ON TABLE breach_notifications IS 'HIPAA breach notification tracking for individuals, HHS, media, and BAs';
COMMENT ON TABLE compliance_controls IS 'Unified compliance control tracking across SOC 2, HIPAA, ISO 27001';
COMMENT ON TABLE risk_register IS 'ISO 27001 risk register for information security risk management';
COMMENT ON TABLE compliance_evidence IS 'Evidence collection and retention for compliance audits';
COMMENT ON TABLE audit_findings IS 'Audit finding tracking and remediation management';
COMMENT ON TABLE business_associate_agreements IS 'HIPAA BAA management and validation';
COMMENT ON TABLE agent_compliance_context IS 'Compliance context and authorization for AI agents';
