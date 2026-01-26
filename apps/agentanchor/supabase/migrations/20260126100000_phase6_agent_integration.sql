-- ============================================================================
-- Phase 6 Agent Integration Migration
-- Links Phase 6 trust engine with existing bots/agents table
-- ============================================================================

-- Add Phase 6 columns to bots table
ALTER TABLE bots ADD COLUMN IF NOT EXISTS phase6_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS phase6_tier trust_tier DEFAULT 'T0';
ALTER TABLE bots ADD COLUMN IF NOT EXISTS phase6_score INTEGER DEFAULT 0;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS phase6_role agent_role DEFAULT 'R_L0';
ALTER TABLE bots ADD COLUMN IF NOT EXISTS phase6_context_id UUID;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS phase6_provenance_id UUID;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS phase6_last_evaluation_at TIMESTAMPTZ;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS phase6_compliance_status compliance_status DEFAULT 'COMPLIANT';

-- Create index for Phase 6 enabled bots
CREATE INDEX IF NOT EXISTS idx_bots_phase6_enabled ON bots (phase6_enabled)
WHERE phase6_enabled = TRUE;

-- Create index for Phase 6 tier queries
CREATE INDEX IF NOT EXISTS idx_bots_phase6_tier ON bots (phase6_tier)
WHERE phase6_enabled = TRUE;

-- Create index for compliance status
CREATE INDEX IF NOT EXISTS idx_bots_phase6_compliance ON bots (phase6_compliance_status)
WHERE phase6_enabled = TRUE;

-- Foreign key to agent context
ALTER TABLE bots ADD CONSTRAINT fk_bots_phase6_context
    FOREIGN KEY (phase6_context_id) REFERENCES phase6_agent_contexts(id)
    ON DELETE SET NULL;

-- Foreign key to provenance
ALTER TABLE bots ADD CONSTRAINT fk_bots_phase6_provenance
    FOREIGN KEY (phase6_provenance_id) REFERENCES phase6_provenance(id)
    ON DELETE SET NULL;

-- ============================================================================
-- VIEW: Phase 6 Agent Summary
-- ============================================================================

CREATE OR REPLACE VIEW phase6_agent_summary AS
SELECT
    b.id AS bot_id,
    b.name AS bot_name,
    b.status,
    b.trust_score AS legacy_trust_score,
    b.phase6_enabled,
    b.phase6_tier,
    b.phase6_score,
    b.phase6_role,
    b.phase6_compliance_status,
    b.phase6_last_evaluation_at,
    ac.deployment_id,
    ac.org_id,
    ac.context_hash,
    p.creation_type,
    p.trust_modifier AS provenance_modifier,
    p.parent_agent_id
FROM bots b
LEFT JOIN phase6_agent_contexts ac ON b.phase6_context_id = ac.id
LEFT JOIN phase6_provenance p ON b.phase6_provenance_id = p.id
WHERE b.phase6_enabled = TRUE;

-- ============================================================================
-- FUNCTION: Enable Phase 6 for an agent
-- ============================================================================

CREATE OR REPLACE FUNCTION enable_phase6_for_agent(
    p_bot_id UUID,
    p_deployment_id TEXT,
    p_org_id TEXT,
    p_creation_type creation_type DEFAULT 'FRESH',
    p_parent_agent_id TEXT DEFAULT NULL,
    p_created_by TEXT DEFAULT 'system'
)
RETURNS TABLE (
    context_id UUID,
    provenance_id UUID,
    initial_tier trust_tier,
    initial_score INTEGER
) AS $$
DECLARE
    v_bot RECORD;
    v_context_id UUID;
    v_provenance_id UUID;
    v_context_hash TEXT;
    v_provenance_hash TEXT;
    v_parent_hash TEXT;
    v_initial_score INTEGER;
    v_modifier INTEGER;
BEGIN
    -- Get bot details
    SELECT * INTO v_bot FROM bots WHERE id = p_bot_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bot not found: %', p_bot_id;
    END IF;

    -- Get parent context hash
    SELECT context_hash INTO v_parent_hash
    FROM phase6_org_contexts
    WHERE deployment_id = p_deployment_id AND org_id = p_org_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Organization context not found: %/%', p_deployment_id, p_org_id;
    END IF;

    -- Compute context hash
    v_context_hash := encode(sha256((p_deployment_id || ':' || p_org_id || ':' || v_bot.id::text || ':' || now()::text)::bytea), 'hex');

    -- Create agent context
    INSERT INTO phase6_agent_contexts (
        deployment_id, org_id, agent_id, name, capabilities, trust_ceiling,
        context_hash, parent_hash
    ) VALUES (
        p_deployment_id, p_org_id, v_bot.id::text, v_bot.name, '[]'::jsonb, 1000,
        v_context_hash, v_parent_hash
    )
    RETURNING id INTO v_context_id;

    -- Get modifier for creation type
    SELECT baseline_modifier INTO v_modifier
    FROM phase6_modifier_policies
    WHERE creation_type = p_creation_type AND policy_id LIKE 'default:%';

    IF NOT FOUND THEN
        v_modifier := 0;
    END IF;

    -- Compute provenance hash
    v_provenance_hash := encode(sha256((v_bot.id::text || ':' || p_creation_type || ':' || now()::text)::bytea), 'hex');

    -- Get parent provenance hash if applicable
    IF p_parent_agent_id IS NOT NULL THEN
        SELECT provenance_hash INTO v_parent_hash
        FROM phase6_provenance
        WHERE agent_id = p_parent_agent_id;
    ELSE
        v_parent_hash := NULL;
    END IF;

    -- Create provenance record
    INSERT INTO phase6_provenance (
        agent_id, creation_type, parent_agent_id, created_by,
        origin_deployment, origin_org, trust_modifier, provenance_hash, parent_provenance_hash
    ) VALUES (
        v_bot.id::text, p_creation_type, p_parent_agent_id, p_created_by,
        p_deployment_id, p_org_id, v_modifier, v_provenance_hash, v_parent_hash
    )
    RETURNING id INTO v_provenance_id;

    -- Calculate initial score (base 100 + modifier, clamped to 0-1000)
    v_initial_score := GREATEST(0, LEAST(1000, 100 + v_modifier));

    -- Update bot with Phase 6 data
    UPDATE bots SET
        phase6_enabled = TRUE,
        phase6_tier = CASE
            WHEN v_initial_score >= 900 THEN 'T5'::trust_tier
            WHEN v_initial_score >= 700 THEN 'T4'::trust_tier
            WHEN v_initial_score >= 500 THEN 'T3'::trust_tier
            WHEN v_initial_score >= 300 THEN 'T2'::trust_tier
            WHEN v_initial_score >= 100 THEN 'T1'::trust_tier
            ELSE 'T0'::trust_tier
        END,
        phase6_score = v_initial_score,
        phase6_role = 'R_L0'::agent_role,
        phase6_context_id = v_context_id,
        phase6_provenance_id = v_provenance_id,
        phase6_last_evaluation_at = NOW(),
        phase6_compliance_status = 'COMPLIANT'::compliance_status,
        updated_at = NOW()
    WHERE id = p_bot_id;

    RETURN QUERY SELECT
        v_context_id,
        v_provenance_id,
        CASE
            WHEN v_initial_score >= 900 THEN 'T5'::trust_tier
            WHEN v_initial_score >= 700 THEN 'T4'::trust_tier
            WHEN v_initial_score >= 500 THEN 'T3'::trust_tier
            WHEN v_initial_score >= 300 THEN 'T2'::trust_tier
            WHEN v_initial_score >= 100 THEN 'T1'::trust_tier
            ELSE 'T0'::trust_tier
        END,
        v_initial_score;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Update Phase 6 score for an agent
-- ============================================================================

CREATE OR REPLACE FUNCTION update_phase6_score(
    p_bot_id UUID,
    p_new_score INTEGER,
    p_event_type TEXT DEFAULT 'manual_update',
    p_compliance_framework TEXT DEFAULT NULL
)
RETURNS TABLE (
    previous_score INTEGER,
    final_score INTEGER,
    previous_tier trust_tier,
    final_tier trust_tier,
    ceiling_applied BOOLEAN,
    compliance_status compliance_status
) AS $$
DECLARE
    v_bot RECORD;
    v_ceiling INTEGER;
    v_final_score INTEGER;
    v_previous_tier trust_tier;
    v_final_tier trust_tier;
    v_ceiling_applied BOOLEAN;
    v_compliance compliance_status;
BEGIN
    -- Get bot details
    SELECT * INTO v_bot FROM bots WHERE id = p_bot_id AND phase6_enabled = TRUE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Phase 6 not enabled for bot: %', p_bot_id;
    END IF;

    -- Get ceiling (regulatory or organizational)
    v_ceiling := 1000;
    IF p_compliance_framework = 'EU_AI_ACT' THEN
        v_ceiling := 699;
    ELSIF p_compliance_framework = 'NIST_AI_RMF' THEN
        v_ceiling := 899;
    ELSIF p_compliance_framework = 'ISO_42001' THEN
        v_ceiling := 799;
    END IF;

    -- Apply ceiling
    v_final_score := LEAST(p_new_score, v_ceiling);
    v_ceiling_applied := v_final_score < p_new_score;

    -- Determine compliance status
    IF v_ceiling_applied THEN
        v_compliance := 'WARNING'::compliance_status;
    ELSIF p_new_score > v_ceiling THEN
        v_compliance := 'VIOLATION'::compliance_status;
    ELSE
        v_compliance := 'COMPLIANT'::compliance_status;
    END IF;

    -- Calculate tiers
    v_previous_tier := v_bot.phase6_tier;
    v_final_tier := CASE
        WHEN v_final_score >= 900 THEN 'T5'::trust_tier
        WHEN v_final_score >= 700 THEN 'T4'::trust_tier
        WHEN v_final_score >= 500 THEN 'T3'::trust_tier
        WHEN v_final_score >= 300 THEN 'T2'::trust_tier
        WHEN v_final_score >= 100 THEN 'T1'::trust_tier
        ELSE 'T0'::trust_tier
    END;

    -- Update bot
    UPDATE bots SET
        phase6_score = v_final_score,
        phase6_tier = v_final_tier,
        phase6_compliance_status = v_compliance,
        phase6_last_evaluation_at = NOW(),
        updated_at = NOW()
    WHERE id = p_bot_id;

    -- Log ceiling event
    INSERT INTO phase6_ceiling_events (
        agent_id, event_type, previous_score, proposed_score, final_score,
        effective_ceiling, ceiling_source, ceiling_applied, compliance_status,
        compliance_framework, audit_required
    ) VALUES (
        p_bot_id::text, p_event_type, v_bot.phase6_score, p_new_score, v_final_score,
        v_ceiling,
        CASE WHEN p_compliance_framework IS NOT NULL THEN 'regulatory' ELSE 'organizational' END,
        v_ceiling_applied, v_compliance, p_compliance_framework,
        v_compliance = 'VIOLATION'
    );

    RETURN QUERY SELECT
        v_bot.phase6_score,
        v_final_score,
        v_previous_tier,
        v_final_tier,
        v_ceiling_applied,
        v_compliance;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN bots.phase6_enabled IS 'Whether Phase 6 trust engine is enabled for this bot';
COMMENT ON COLUMN bots.phase6_tier IS 'Current trust tier (T0-T5)';
COMMENT ON COLUMN bots.phase6_score IS 'Current trust score (0-1000)';
COMMENT ON COLUMN bots.phase6_role IS 'Maximum allowed role (R-L0 to R-L8)';
COMMENT ON COLUMN bots.phase6_context_id IS 'Reference to agent context in hierarchical context';
COMMENT ON COLUMN bots.phase6_provenance_id IS 'Reference to provenance record';
COMMENT ON FUNCTION enable_phase6_for_agent IS 'Enable Phase 6 trust engine for an existing bot';
COMMENT ON FUNCTION update_phase6_score IS 'Update trust score with ceiling enforcement';
