-- =============================================================================
-- Trust from Conception Migration
-- =============================================================================
-- Implements BAI-OS philosophy: trust from birth, not earned from zero.
-- Every agent is conceived with trust calibrated to their context.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. AGENT CONCEPTION EVENTS TABLE
-- -----------------------------------------------------------------------------
-- Immutable record of every agent's birth with full context

CREATE TABLE IF NOT EXISTS agent_conceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,

  -- Conception context
  creation_type TEXT NOT NULL CHECK (creation_type IN ('fresh', 'cloned', 'evolved', 'promoted', 'imported')),
  hierarchy_level TEXT NOT NULL CHECK (hierarchy_level IN ('L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8')),
  domain TEXT NOT NULL,
  specialization TEXT,

  -- Creator context
  creator_id UUID REFERENCES auth.users(id),
  creator_trust_score INTEGER,

  -- Lineage
  parent_agent_id UUID REFERENCES bots(id),
  parent_trust_score INTEGER,
  generation_number INTEGER DEFAULT 1,

  -- Training context
  trainer_id UUID REFERENCES bots(id),
  trainer_trust_score INTEGER,

  -- Vetting context
  vetting_gate TEXT CHECK (vetting_gate IN ('none', 'basic', 'standard', 'rigorous', 'council')),
  academy_completed TEXT[], -- curriculum IDs
  certifications TEXT[],

  -- Calculated trust
  initial_trust_score INTEGER NOT NULL,
  initial_trust_tier TEXT NOT NULL,
  autonomy_level TEXT NOT NULL,
  supervision_level TEXT NOT NULL,
  trust_ceiling INTEGER NOT NULL,
  trust_floor INTEGER NOT NULL,
  rationale JSONB NOT NULL, -- Array of reasoning strings

  -- Timestamps
  conceived_at TIMESTAMPTZ DEFAULT now(),

  -- Ensure one conception per agent
  UNIQUE (agent_id)
);

-- Index for lineage queries
CREATE INDEX IF NOT EXISTS idx_conceptions_parent ON agent_conceptions(parent_agent_id) WHERE parent_agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conceptions_trainer ON agent_conceptions(trainer_id) WHERE trainer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conceptions_creator ON agent_conceptions(creator_id);
CREATE INDEX IF NOT EXISTS idx_conceptions_level ON agent_conceptions(hierarchy_level);
CREATE INDEX IF NOT EXISTS idx_conceptions_domain ON agent_conceptions(domain);

-- -----------------------------------------------------------------------------
-- 2. TRUST BOUNDS TABLE
-- -----------------------------------------------------------------------------
-- Dynamic trust bounds based on level and performance

CREATE TABLE IF NOT EXISTS agent_trust_bounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE UNIQUE,

  -- Current bounds
  trust_ceiling INTEGER NOT NULL,
  trust_floor INTEGER NOT NULL,

  -- Earned adjustments
  ceiling_bonus INTEGER DEFAULT 0, -- Can earn higher ceiling
  floor_reduction INTEGER DEFAULT 0, -- Can earn lower floor

  -- Constraints
  max_possible_ceiling INTEGER DEFAULT 1000,
  min_possible_floor INTEGER DEFAULT 0,

  -- Last update
  updated_at TIMESTAMPTZ DEFAULT now(),
  update_reason TEXT
);

-- -----------------------------------------------------------------------------
-- 3. LINEAGE TRACKING VIEW
-- -----------------------------------------------------------------------------
-- View for agent family trees

CREATE OR REPLACE VIEW agent_lineage AS
SELECT
  c.agent_id,
  b.name AS agent_name,
  c.hierarchy_level,
  c.domain,
  c.creation_type,
  c.generation_number,

  c.parent_agent_id,
  pb.name AS parent_name,
  c.parent_trust_score,

  c.trainer_id,
  tb.name AS trainer_name,
  c.trainer_trust_score,

  c.initial_trust_score,
  b.trust_score AS current_trust_score,
  c.trust_ceiling,
  c.trust_floor,

  c.conceived_at,
  c.rationale

FROM agent_conceptions c
JOIN bots b ON c.agent_id = b.id
LEFT JOIN bots pb ON c.parent_agent_id = pb.id
LEFT JOIN bots tb ON c.trainer_id = tb.id;

-- -----------------------------------------------------------------------------
-- 4. TRUST PROGRESSION FUNCTION
-- -----------------------------------------------------------------------------
-- Calculate if an agent can progress to next level based on trust

CREATE OR REPLACE FUNCTION can_agent_progress(p_agent_id UUID)
RETURNS TABLE (
  can_progress BOOLEAN,
  current_level TEXT,
  next_level TEXT,
  current_trust INTEGER,
  required_trust INTEGER,
  trust_gap INTEGER,
  blockers TEXT[]
) AS $$
DECLARE
  v_current_level TEXT;
  v_next_level TEXT;
  v_current_trust INTEGER;
  v_ceiling INTEGER;
  v_floor INTEGER;
  v_required_trust INTEGER;
  v_blockers TEXT[] := ARRAY[]::TEXT[];

  -- Level progression requirements
  v_level_requirements JSONB := '{
    "L0": {"next": "L1", "required": 150, "min_tasks": 50},
    "L1": {"next": "L2", "required": 250, "min_tasks": 100},
    "L2": {"next": "L3", "required": 400, "min_tasks": 200},
    "L3": {"next": "L4", "required": 500, "min_tasks": 300},
    "L4": {"next": "L5", "required": 650, "min_tasks": 500},
    "L5": {"next": "L6", "required": 750, "min_tasks": 750},
    "L6": {"next": "L7", "required": 850, "min_tasks": 1000},
    "L7": {"next": "L8", "required": 950, "min_tasks": 2000},
    "L8": {"next": null, "required": null, "min_tasks": null}
  }'::JSONB;

  v_level_req JSONB;
BEGIN
  -- Get current agent state
  SELECT
    COALESCE((metadata->>'hierarchyLevel')::TEXT, 'L1'),
    trust_score
  INTO v_current_level, v_current_trust
  FROM bots
  WHERE id = p_agent_id;

  -- Get bounds
  SELECT trust_ceiling, trust_floor
  INTO v_ceiling, v_floor
  FROM agent_trust_bounds
  WHERE agent_id = p_agent_id;

  IF v_ceiling IS NULL THEN
    -- Use default bounds from conception
    SELECT c.trust_ceiling, c.trust_floor
    INTO v_ceiling, v_floor
    FROM agent_conceptions c
    WHERE c.agent_id = p_agent_id;
  END IF;

  -- Get level requirements
  v_level_req := v_level_requirements->v_current_level;

  IF v_level_req->>'next' IS NULL THEN
    -- L8 cannot progress further
    RETURN QUERY SELECT
      FALSE,
      v_current_level,
      NULL::TEXT,
      v_current_trust,
      NULL::INTEGER,
      NULL::INTEGER,
      ARRAY['Already at maximum level (L8)']::TEXT[];
    RETURN;
  END IF;

  v_next_level := v_level_req->>'next';
  v_required_trust := (v_level_req->>'required')::INTEGER;

  -- Check trust requirement
  IF v_current_trust < v_required_trust THEN
    v_blockers := array_append(v_blockers,
      format('Trust score %s below required %s', v_current_trust, v_required_trust));
  END IF;

  -- Check ceiling constraint
  IF v_ceiling IS NOT NULL AND v_current_trust >= v_ceiling THEN
    v_blockers := array_append(v_blockers,
      format('At trust ceiling (%s) - council approval needed', v_ceiling));
  END IF;

  RETURN QUERY SELECT
    array_length(v_blockers, 1) IS NULL OR array_length(v_blockers, 1) = 0,
    v_current_level,
    v_next_level,
    v_current_trust,
    v_required_trust,
    v_required_trust - v_current_trust,
    v_blockers;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 5. TRUST INHERITANCE FUNCTION
-- -----------------------------------------------------------------------------
-- Calculate trust inheritance for cloned/evolved agents

CREATE OR REPLACE FUNCTION calculate_inherited_trust(
  p_parent_trust INTEGER,
  p_generation INTEGER,
  p_creation_type TEXT
) RETURNS INTEGER AS $$
DECLARE
  v_inheritance_factor NUMERIC;
  v_generation_decay NUMERIC;
BEGIN
  -- Base inheritance by creation type
  CASE p_creation_type
    WHEN 'cloned' THEN v_inheritance_factor := 0.2;
    WHEN 'evolved' THEN v_inheritance_factor := 0.3;
    WHEN 'promoted' THEN v_inheritance_factor := 0.5;
    ELSE v_inheritance_factor := 0;
  END CASE;

  -- Generation decay (10% less per generation)
  v_generation_decay := POWER(0.9, COALESCE(p_generation, 1));

  RETURN ROUND(p_parent_trust * v_inheritance_factor * v_generation_decay);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- -----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------

ALTER TABLE agent_conceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_trust_bounds ENABLE ROW LEVEL SECURITY;

-- Anyone can read conception data (transparency)
DROP POLICY IF EXISTS conception_read_all ON agent_conceptions;
CREATE POLICY conception_read_all ON agent_conceptions
  FOR SELECT USING (true);

-- Only creator can insert conception (enforced at API level)
DROP POLICY IF EXISTS conception_insert_creator ON agent_conceptions;
CREATE POLICY conception_insert_creator ON agent_conceptions
  FOR INSERT WITH CHECK (creator_id = auth.uid());

-- Trust bounds are public read, but only system can modify
DROP POLICY IF EXISTS bounds_read_all ON agent_trust_bounds;
CREATE POLICY bounds_read_all ON agent_trust_bounds
  FOR SELECT USING (true);

-- Service role can modify bounds
DROP POLICY IF EXISTS bounds_modify_service ON agent_trust_bounds;
CREATE POLICY bounds_modify_service ON agent_trust_bounds
  FOR ALL USING (auth.role() = 'service_role');

-- -----------------------------------------------------------------------------
-- 7. TRIGGERS FOR AUTOMATIC UPDATES
-- -----------------------------------------------------------------------------

-- Update trust bounds when conception happens
CREATE OR REPLACE FUNCTION auto_create_trust_bounds()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO agent_trust_bounds (
    agent_id,
    trust_ceiling,
    trust_floor,
    updated_at,
    update_reason
  ) VALUES (
    NEW.agent_id,
    NEW.trust_ceiling,
    NEW.trust_floor,
    now(),
    'Initial bounds from conception'
  )
  ON CONFLICT (agent_id) DO UPDATE SET
    trust_ceiling = NEW.trust_ceiling,
    trust_floor = NEW.trust_floor,
    updated_at = now(),
    update_reason = 'Updated from re-conception';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_create_trust_bounds ON agent_conceptions;
CREATE TRIGGER trg_auto_create_trust_bounds
  AFTER INSERT ON agent_conceptions
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_trust_bounds();

-- -----------------------------------------------------------------------------
-- 8. GRANT PERMISSIONS
-- -----------------------------------------------------------------------------

GRANT SELECT ON agent_conceptions TO authenticated;
GRANT SELECT ON agent_trust_bounds TO authenticated;
GRANT SELECT ON agent_lineage TO authenticated;
GRANT EXECUTE ON FUNCTION can_agent_progress(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_inherited_trust(INTEGER, INTEGER, TEXT) TO authenticated;

-- Service role full access
GRANT ALL ON agent_conceptions TO service_role;
GRANT ALL ON agent_trust_bounds TO service_role;

-- -----------------------------------------------------------------------------
-- 9. COMMENTS FOR DOCUMENTATION
-- -----------------------------------------------------------------------------

COMMENT ON TABLE agent_conceptions IS 'Immutable record of agent birth with full trust calibration context. Every agent is conceived with trust appropriate to their creation circumstances.';

COMMENT ON TABLE agent_trust_bounds IS 'Dynamic trust bounds that can be adjusted through performance but are initialized from conception context.';

COMMENT ON VIEW agent_lineage IS 'Agent family tree view showing parent/trainer relationships and trust inheritance.';

COMMENT ON FUNCTION can_agent_progress IS 'Check if an agent meets requirements for promotion to the next hierarchy level.';

COMMENT ON FUNCTION calculate_inherited_trust IS 'Calculate trust inheritance for cloned/evolved agents based on parent trust and generation.';
