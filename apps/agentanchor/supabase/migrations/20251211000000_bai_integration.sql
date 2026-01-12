-- ============================================================================
-- BAI AI-WORKFORCE INTEGRATION MIGRATION
-- Integrates BAI systems while preserving AgentAnchor autonomy model
-- ============================================================================

-- ============================================================================
-- 1. HIERARCHY LEVELS AS ROLES
-- Trust is ability within role, hierarchy_level is the role itself
-- ============================================================================

-- Hierarchy level enum (L0-L8 from BAI)
CREATE TYPE hierarchy_level AS ENUM (
  'L0_listener',      -- Passive observer, no autonomous action
  'L1_executor',      -- Single task execution specialist
  'L2_planner',       -- Decomposes requests into task specs
  'L3_orchestrator',  -- Coordinates L1/L2 agents
  'L4_project_planner', -- Manages multi-agent projects
  'L5_project_orchestrator', -- Cross-project coordination
  'L6_portfolio',     -- Resource allocation across portfolio
  'L7_strategic',     -- Long-term direction setting
  'L8_executive'      -- Governance with human oversight
);

-- Add hierarchy_level to bots table
ALTER TABLE bots ADD COLUMN IF NOT EXISTS hierarchy_level hierarchy_level DEFAULT 'L1_executor';
ALTER TABLE bots ADD COLUMN IF NOT EXISTS hierarchy_domain TEXT; -- e.g., 'governance', 'security', 'technology'
ALTER TABLE bots ADD COLUMN IF NOT EXISTS can_delegate_to hierarchy_level[]; -- Which levels this agent can assign tasks to
ALTER TABLE bots ADD COLUMN IF NOT EXISTS reports_to hierarchy_level[]; -- Which levels this agent reports to

-- Hierarchy level metadata table
CREATE TABLE IF NOT EXISTS hierarchy_level_config (
  level hierarchy_level PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  authority_scope TEXT NOT NULL, -- 'none', 'task', 'project', 'portfolio', 'strategic', 'governance'
  max_autonomy_level INTEGER DEFAULT 1, -- Max autonomy level achievable at this hierarchy
  can_train_others BOOLEAN DEFAULT false,
  can_approve_others BOOLEAN DEFAULT false,
  requires_human_oversight BOOLEAN DEFAULT false,
  min_trust_score INTEGER DEFAULT 0, -- Min trust to operate at this level
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed hierarchy level config
INSERT INTO hierarchy_level_config (level, name, description, authority_scope, max_autonomy_level, can_train_others, can_approve_others, requires_human_oversight, min_trust_score) VALUES
  ('L0_listener', 'Listener', 'Passive observer - monitors and reports only', 'none', 1, false, false, false, 0),
  ('L1_executor', 'Executor', 'Single task execution specialist', 'task', 3, false, false, false, 200),
  ('L2_planner', 'Planner', 'Decomposes requests into task specifications', 'task', 3, false, false, false, 300),
  ('L3_orchestrator', 'Orchestrator', 'Coordinates L1/L2 agents on complex tasks', 'project', 4, true, false, false, 400),
  ('L4_project_planner', 'Project Planner', 'Plans and tracks multi-agent projects', 'project', 4, true, true, false, 500),
  ('L5_project_orchestrator', 'Project Orchestrator', 'Orchestrates across multiple projects', 'portfolio', 4, true, true, false, 600),
  ('L6_portfolio', 'Portfolio Manager', 'Resource allocation across project portfolio', 'portfolio', 5, true, true, false, 700),
  ('L7_strategic', 'Strategic', 'Long-term direction and capability planning', 'strategic', 5, true, true, true, 800),
  ('L8_executive', 'Executive', 'Governance decisions with human oversight', 'governance', 5, true, true, true, 900)
ON CONFLICT (level) DO NOTHING;

-- ============================================================================
-- 2. AGENT CONSULTATION SYSTEM (Merged with Audit Trail)
-- BAI's agent-to-agent consultation + AgentAnchor's cryptographic audit
-- ============================================================================

-- Consultation request table
CREATE TABLE IF NOT EXISTS agent_consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requesting_agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  action_description TEXT NOT NULL,
  action_context JSONB DEFAULT '{}',
  risk_level TEXT DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  consulted_agents UUID[] NOT NULL DEFAULT '{}',
  deadline TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'expired', 'cancelled')),
  outcome TEXT CHECK (outcome IN ('proceed', 'blocked', 'proceed_with_caution', 'escalate')),
  final_reasoning TEXT,

  -- Link to observer event for immutable audit trail
  observer_event_id UUID REFERENCES observer_events(id),
  merkle_hash TEXT, -- Hash chain anchor

  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Consultation responses from individual agents
CREATE TABLE IF NOT EXISTS agent_consultation_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID NOT NULL REFERENCES agent_consultations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('approve', 'concern', 'veto')),
  reasoning TEXT NOT NULL,
  confidence NUMERIC(3,2) DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  concerns TEXT[],
  conditions TEXT[], -- Conditions for approval
  responded_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(consultation_id, agent_id)
);

-- Extend observer_events to include consultation data
ALTER TABLE observer_events ADD COLUMN IF NOT EXISTS consultation_id UUID REFERENCES agent_consultations(id);
ALTER TABLE observer_events ADD COLUMN IF NOT EXISTS consultation_outcome TEXT;

-- Safety gates tracking (from BAI)
CREATE TABLE IF NOT EXISTS safety_gate_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID REFERENCES agent_consultations(id) ON DELETE CASCADE,
  action_id UUID, -- Generic action reference
  gate_number INTEGER NOT NULL,
  gate_name TEXT NOT NULL,
  passed BOOLEAN NOT NULL,
  blocked_reason TEXT,
  details JSONB DEFAULT '{}',
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. KNOWLEDGE BASE SYSTEM (From BAI)
-- Full knowledge graph with embeddings, relationships, and quality tracking
-- ============================================================================

-- Knowledge type enum
CREATE TYPE knowledge_type AS ENUM (
  'fact', 'concept', 'procedure', 'principle', 'example', 'pattern',
  'anti_pattern', 'relationship', 'context', 'preference', 'decision',
  'experience', 'insight', 'hypothesis', 'question', 'contradiction', 'meta'
);

-- Knowledge source enum
CREATE TYPE knowledge_source AS ENUM (
  'conversation', 'codebase', 'documentation', 'external', 'inference',
  'synthesis', 'human_verified', 'agent_learned', 'imported', 'generated'
);

-- Validity status enum
CREATE TYPE validity_status AS ENUM (
  'verified', 'probable', 'uncertain', 'disputed', 'deprecated', 'superseded', 'conditional'
);

-- Main knowledge items table
CREATE TABLE IF NOT EXISTS knowledge_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INTEGER DEFAULT 1,
  type knowledge_type NOT NULL,
  source knowledge_source NOT NULL,

  -- Core content
  summary TEXT NOT NULL,
  full_content TEXT,
  structured_data JSONB DEFAULT '{}',
  code_content JSONB, -- {language, code, context, filePath, lineRange}

  -- Vector embedding for semantic search (pgvector)
  embedding vector(1536), -- OpenAI ada-002 dimension
  semantic_hash TEXT, -- For deduplication

  -- Confidence & validity
  confidence_score NUMERIC(3,2) DEFAULT 0.5,
  confidence_basis TEXT DEFAULT 'assumed',
  validity_status validity_status DEFAULT 'uncertain',
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ,

  -- Organization
  domains TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  categories TEXT[] DEFAULT '{}',

  -- Quality metrics
  quality_overall NUMERIC(3,2) DEFAULT 0.5,
  quality_accuracy NUMERIC(3,2),
  quality_completeness NUMERIC(3,2),
  quality_consistency NUMERIC(3,2),
  quality_timeliness NUMERIC(3,2),
  quality_relevance NUMERIC(3,2),

  -- Provenance
  original_source TEXT,
  extracted_by TEXT,
  extraction_method TEXT,
  citations JSONB DEFAULT '[]',

  -- Ownership
  created_by UUID REFERENCES auth.users(id),
  agent_id UUID REFERENCES bots(id),

  -- Lifecycle
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Knowledge relationships (graph edges)
CREATE TABLE IF NOT EXISTS knowledge_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL, -- is_a, part_of, implies, contradicts, supports, etc.
  strength NUMERIC(3,2) DEFAULT 0.5,
  bidirectional BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(source_id, target_id, relationship_type)
);

-- Knowledge hierarchy
CREATE TABLE IF NOT EXISTS knowledge_hierarchy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES knowledge_items(id),
  depth INTEGER DEFAULT 0,
  path UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(knowledge_id)
);

-- Knowledge quality issues
CREATE TABLE IF NOT EXISTS knowledge_quality_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  issue_type TEXT NOT NULL CHECK (issue_type IN ('missing', 'outdated', 'inconsistent', 'unclear', 'unverified')),
  description TEXT NOT NULL,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Knowledge operations log
CREATE TABLE IF NOT EXISTS knowledge_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type TEXT NOT NULL,
  target_ids UUID[] NOT NULL,
  actor_id UUID,
  actor_type TEXT DEFAULT 'user' CHECK (actor_type IN ('user', 'agent', 'system')),
  data JSONB DEFAULT '{}',
  result JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Learning opportunities (active learning)
CREATE TABLE IF NOT EXISTS knowledge_learning_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('gap', 'conflict', 'outdated', 'low_confidence', 'underutilized', 'emerging', 'feedback', 'pattern')),
  description TEXT NOT NULL,
  priority INTEGER DEFAULT 50,
  estimated_value NUMERIC(5,2) DEFAULT 0,
  suggested_actions JSONB DEFAULT '[]',
  related_knowledge UUID[] DEFAULT '{}',
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- ============================================================================
-- 4. SHADOW AGENT SYSTEM (From BAI)
-- Background observers that monitor, detect patterns, and inject context
-- ============================================================================

-- Shadow agent type enum
CREATE TYPE shadow_agent_type AS ENUM (
  'memory',      -- Remembers facts, decisions, preferences
  'pattern',     -- Detects recurring patterns and behaviors
  'consistency', -- Monitors for contradictions
  'risk',        -- Assesses risk of proposed actions
  'learning',    -- Tracks mistakes and lessons learned
  'context',     -- Maintains situational awareness
  'intent',      -- Tracks the "why" behind decisions
  'debt',        -- Catalogs technical debt
  'quality',     -- Monitors code quality trends
  'custom'       -- User-defined shadow type
);

-- Shadow mode enum
CREATE TYPE shadow_mode AS ENUM (
  'passive',    -- Only observes, never injects
  'advisory',   -- Observes and provides suggestions when queried
  'proactive',  -- Automatically injects relevant context
  'guardian'    -- Can block/warn on critical issues
);

-- Shadow agent configurations
CREATE TABLE IF NOT EXISTS shadow_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type shadow_agent_type NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  mode shadow_mode DEFAULT 'advisory',
  enabled BOOLEAN DEFAULT true,

  -- Ownership
  user_id UUID REFERENCES auth.users(id),
  agent_id UUID REFERENCES bots(id), -- Shadow can be attached to specific agent

  -- Subscription filters
  subscriptions JSONB DEFAULT '[]', -- [{messageTypes, agentIds, taskPatterns, contentFilters}]

  -- Persistence settings
  persistence_enabled BOOLEAN DEFAULT true,
  retention_days INTEGER DEFAULT 30,
  max_observations INTEGER DEFAULT 10000,

  -- Injection settings
  injection_enabled BOOLEAN DEFAULT true,
  min_relevance NUMERIC(3,2) DEFAULT 0.5,
  max_items_per_injection INTEGER DEFAULT 5,
  cooldown_ms INTEGER DEFAULT 5000,

  -- Type-specific config
  type_config JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shadow observations
CREATE TABLE IF NOT EXISTS shadow_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shadow_id UUID NOT NULL REFERENCES shadow_agents(id) ON DELETE CASCADE,
  shadow_type shadow_agent_type NOT NULL,

  -- Source
  source_type TEXT NOT NULL CHECK (source_type IN ('message', 'action', 'reasoning', 'external')),
  source_message_id UUID,
  source_agent_id UUID REFERENCES bots(id),
  source_task_id UUID,
  source_conversation_id UUID,
  source_user_id UUID REFERENCES auth.users(id),

  -- Content
  summary TEXT NOT NULL,
  raw_content TEXT,
  structured_data JSONB DEFAULT '{}', -- MemoryData, PatternData, ConsistencyData, RiskData, LearningData

  -- Metadata
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  confidence NUMERIC(3,2) DEFAULT 0.5,
  tags TEXT[] DEFAULT '{}',

  -- Relationships
  related_observations UUID[] DEFAULT '{}',
  supersedes UUID REFERENCES shadow_observations(id),

  -- Lifecycle
  expires_at TIMESTAMPTZ,
  archived BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shadow context injections (when shadow provides context to an agent)
CREATE TABLE IF NOT EXISTS shadow_context_injections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shadow_id UUID NOT NULL REFERENCES shadow_agents(id) ON DELETE CASCADE,
  target_agent_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  target_task_id UUID,
  target_conversation_id UUID,

  -- Query that triggered injection
  relevance_query TEXT,
  relevance_threshold NUMERIC(3,2),

  -- Injected items
  items JSONB NOT NULL, -- [{observationId, shadowType, relevanceScore, content, priority, format}]
  summary TEXT,
  source_observations UUID[] DEFAULT '{}',

  -- Stats
  total_observations_considered INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shadow alerts (from guardian mode shadows)
CREATE TABLE IF NOT EXISTS shadow_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shadow_id UUID NOT NULL REFERENCES shadow_agents(id) ON DELETE CASCADE,
  priority TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  message TEXT NOT NULL,
  observation_id UUID REFERENCES shadow_observations(id),

  -- Target
  target_agent_id UUID REFERENCES bots(id),
  target_user_id UUID REFERENCES auth.users(id),

  -- Status
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,

  -- Resolution
  action_taken TEXT,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 5. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Hierarchy indexes
CREATE INDEX IF NOT EXISTS idx_bots_hierarchy_level ON bots(hierarchy_level);
CREATE INDEX IF NOT EXISTS idx_bots_hierarchy_domain ON bots(hierarchy_domain);

-- Consultation indexes
CREATE INDEX IF NOT EXISTS idx_agent_consultations_requesting ON agent_consultations(requesting_agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_consultations_status ON agent_consultations(status);
CREATE INDEX IF NOT EXISTS idx_agent_consultation_responses_consultation ON agent_consultation_responses(consultation_id);

-- Knowledge indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_items_type ON knowledge_items(type);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_source ON knowledge_items(source);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_domains ON knowledge_items USING gin(domains);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_tags ON knowledge_items USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_validity ON knowledge_items(validity_status);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_agent ON knowledge_items(agent_id);
-- Vector similarity index (requires pgvector extension)
-- CREATE INDEX IF NOT EXISTS idx_knowledge_items_embedding ON knowledge_items USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Shadow indexes
CREATE INDEX IF NOT EXISTS idx_shadow_agents_type ON shadow_agents(type);
CREATE INDEX IF NOT EXISTS idx_shadow_agents_agent ON shadow_agents(agent_id);
CREATE INDEX IF NOT EXISTS idx_shadow_observations_shadow ON shadow_observations(shadow_id);
CREATE INDEX IF NOT EXISTS idx_shadow_observations_agent ON shadow_observations(source_agent_id);
CREATE INDEX IF NOT EXISTS idx_shadow_observations_priority ON shadow_observations(priority);
CREATE INDEX IF NOT EXISTS idx_shadow_observations_created ON shadow_observations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shadow_alerts_shadow ON shadow_alerts(shadow_id);
CREATE INDEX IF NOT EXISTS idx_shadow_alerts_unresolved ON shadow_alerts(resolved) WHERE resolved = false;

-- ============================================================================
-- 6. VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Agent with full context (hierarchy + trust + shadow status)
CREATE OR REPLACE VIEW agent_full_context AS
SELECT
  b.*,
  hlc.name as hierarchy_name,
  hlc.authority_scope,
  hlc.max_autonomy_level as hierarchy_max_autonomy,
  hlc.can_train_others,
  hlc.can_approve_others,
  hlc.requires_human_oversight,
  (SELECT COUNT(*) FROM shadow_agents sa WHERE sa.agent_id = b.id AND sa.enabled = true) as active_shadows,
  (SELECT COUNT(*) FROM shadow_observations so
   JOIN shadow_agents sa ON so.shadow_id = sa.id
   WHERE sa.agent_id = b.id AND so.created_at > NOW() - INTERVAL '24 hours') as observations_24h,
  (SELECT COUNT(*) FROM knowledge_items ki WHERE ki.agent_id = b.id) as knowledge_items
FROM bots b
LEFT JOIN hierarchy_level_config hlc ON b.hierarchy_level = hlc.level;

-- Consultation summary
CREATE OR REPLACE VIEW consultation_summary AS
SELECT
  c.*,
  b.name as requesting_agent_name,
  b.hierarchy_level as requesting_agent_level,
  (SELECT COUNT(*) FROM agent_consultation_responses WHERE consultation_id = c.id) as response_count,
  (SELECT COUNT(*) FROM agent_consultation_responses WHERE consultation_id = c.id AND decision = 'approve') as approvals,
  (SELECT COUNT(*) FROM agent_consultation_responses WHERE consultation_id = c.id AND decision = 'concern') as concerns,
  (SELECT COUNT(*) FROM agent_consultation_responses WHERE consultation_id = c.id AND decision = 'veto') as vetoes
FROM agent_consultations c
JOIN bots b ON c.requesting_agent_id = b.id;

-- Knowledge graph stats
CREATE OR REPLACE VIEW knowledge_graph_stats AS
SELECT
  (SELECT COUNT(*) FROM knowledge_items) as total_items,
  (SELECT COUNT(*) FROM knowledge_relationships) as total_relationships,
  (SELECT COUNT(DISTINCT type) FROM knowledge_items) as unique_types,
  (SELECT COUNT(*) FROM knowledge_items WHERE validity_status = 'verified') as verified_items,
  (SELECT COUNT(*) FROM knowledge_items WHERE validity_status = 'disputed') as disputed_items,
  (SELECT AVG(quality_overall) FROM knowledge_items WHERE quality_overall IS NOT NULL) as avg_quality,
  (SELECT COUNT(*) FROM knowledge_quality_issues WHERE resolved_at IS NULL) as open_issues,
  (SELECT COUNT(*) FROM knowledge_learning_opportunities WHERE status = 'open') as learning_opportunities;

-- Shadow system stats
CREATE OR REPLACE VIEW shadow_system_stats AS
SELECT
  (SELECT COUNT(*) FROM shadow_agents WHERE enabled = true) as active_shadows,
  (SELECT COUNT(*) FROM shadow_observations WHERE created_at > NOW() - INTERVAL '24 hours') as observations_24h,
  (SELECT COUNT(*) FROM shadow_observations WHERE priority = 'critical' AND created_at > NOW() - INTERVAL '24 hours') as critical_observations_24h,
  (SELECT COUNT(*) FROM shadow_context_injections WHERE created_at > NOW() - INTERVAL '24 hours') as injections_24h,
  (SELECT COUNT(*) FROM shadow_alerts WHERE resolved = false) as open_alerts,
  (SELECT COUNT(*) FROM shadow_alerts WHERE priority = 'critical' AND resolved = false) as critical_alerts;

-- ============================================================================
-- 7. RLS POLICIES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE hierarchy_level_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_consultation_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_gate_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_hierarchy ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_quality_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_learning_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE shadow_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE shadow_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE shadow_context_injections ENABLE ROW LEVEL SECURITY;
ALTER TABLE shadow_alerts ENABLE ROW LEVEL SECURITY;

-- Hierarchy config is readable by all authenticated users
CREATE POLICY "hierarchy_config_read" ON hierarchy_level_config
  FOR SELECT TO authenticated USING (true);

-- Consultations: users can see consultations involving their agents
CREATE POLICY "consultations_read" ON agent_consultations
  FOR SELECT TO authenticated USING (
    requesting_agent_id IN (SELECT id FROM bots WHERE user_id = auth.uid())
    OR requesting_agent_id = ANY(consulted_agents)
  );

-- Knowledge items: readable by all, writable by owner
CREATE POLICY "knowledge_read" ON knowledge_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "knowledge_write" ON knowledge_items
  FOR ALL TO authenticated USING (created_by = auth.uid());

-- Shadow agents: users manage their own
CREATE POLICY "shadow_agents_all" ON shadow_agents
  FOR ALL TO authenticated USING (user_id = auth.uid());

-- Shadow observations: readable if you own the shadow
CREATE POLICY "shadow_observations_read" ON shadow_observations
  FOR SELECT TO authenticated USING (
    shadow_id IN (SELECT id FROM shadow_agents WHERE user_id = auth.uid())
  );

-- Shadow alerts: users see alerts for their shadows/agents
CREATE POLICY "shadow_alerts_read" ON shadow_alerts
  FOR SELECT TO authenticated USING (
    target_user_id = auth.uid() OR
    shadow_id IN (SELECT id FROM shadow_agents WHERE user_id = auth.uid())
  );

-- ============================================================================
-- 8. FUNCTIONS
-- ============================================================================

-- Function to get consultation consensus
CREATE OR REPLACE FUNCTION get_consultation_consensus(consultation_uuid UUID)
RETURNS TABLE(outcome TEXT, total_responses INTEGER, approvals INTEGER, concerns INTEGER, vetoes INTEGER) AS $$
DECLARE
  v_approvals INTEGER;
  v_concerns INTEGER;
  v_vetoes INTEGER;
  v_total INTEGER;
  v_outcome TEXT;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE decision = 'approve'),
    COUNT(*) FILTER (WHERE decision = 'concern'),
    COUNT(*) FILTER (WHERE decision = 'veto'),
    COUNT(*)
  INTO v_approvals, v_concerns, v_vetoes, v_total
  FROM agent_consultation_responses
  WHERE consultation_id = consultation_uuid;

  -- Determine outcome
  IF v_vetoes > 0 THEN
    v_outcome := 'blocked';
  ELSIF v_concerns > v_approvals THEN
    v_outcome := 'proceed_with_caution';
  ELSIF v_approvals >= v_total * 0.5 THEN
    v_outcome := 'proceed';
  ELSE
    v_outcome := 'escalate';
  END IF;

  RETURN QUERY SELECT v_outcome, v_total, v_approvals, v_concerns, v_vetoes;
END;
$$ LANGUAGE plpgsql;

-- Function to find related knowledge
CREATE OR REPLACE FUNCTION find_related_knowledge(knowledge_uuid UUID, max_depth INTEGER DEFAULT 2)
RETURNS TABLE(id UUID, type knowledge_type, summary TEXT, relationship_type TEXT, depth INTEGER) AS $$
WITH RECURSIVE related AS (
  -- Direct relationships
  SELECT
    ki.id,
    ki.type,
    ki.summary,
    kr.relationship_type,
    1 as depth
  FROM knowledge_items ki
  JOIN knowledge_relationships kr ON ki.id = kr.target_id
  WHERE kr.source_id = knowledge_uuid

  UNION

  -- Recursive relationships
  SELECT
    ki.id,
    ki.type,
    ki.summary,
    kr.relationship_type,
    r.depth + 1
  FROM knowledge_items ki
  JOIN knowledge_relationships kr ON ki.id = kr.target_id
  JOIN related r ON kr.source_id = r.id
  WHERE r.depth < max_depth
)
SELECT DISTINCT * FROM related;
$$ LANGUAGE sql;

-- Function to get agent shadow context
CREATE OR REPLACE FUNCTION get_agent_shadow_context(agent_uuid UUID, min_relevance NUMERIC DEFAULT 0.5)
RETURNS TABLE(
  shadow_type shadow_agent_type,
  observation_count INTEGER,
  latest_summary TEXT,
  highest_priority TEXT
) AS $$
SELECT
  so.shadow_type,
  COUNT(*)::INTEGER as observation_count,
  (SELECT summary FROM shadow_observations
   WHERE shadow_id = sa.id
   ORDER BY created_at DESC LIMIT 1) as latest_summary,
  MAX(so.priority) as highest_priority
FROM shadow_agents sa
JOIN shadow_observations so ON so.shadow_id = sa.id
WHERE sa.agent_id = agent_uuid
  AND sa.enabled = true
  AND so.archived = false
  AND so.created_at > NOW() - INTERVAL '7 days'
GROUP BY so.shadow_type, sa.id;
$$ LANGUAGE sql;

-- ============================================================================
-- 9. TRIGGERS
-- ============================================================================

-- Update consultation status when all responses received
CREATE OR REPLACE FUNCTION update_consultation_status()
RETURNS TRIGGER AS $$
DECLARE
  v_consulted_count INTEGER;
  v_response_count INTEGER;
BEGIN
  SELECT array_length(consulted_agents, 1) INTO v_consulted_count
  FROM agent_consultations WHERE id = NEW.consultation_id;

  SELECT COUNT(*) INTO v_response_count
  FROM agent_consultation_responses WHERE consultation_id = NEW.consultation_id;

  IF v_response_count >= v_consulted_count THEN
    UPDATE agent_consultations
    SET status = 'completed',
        completed_at = NOW(),
        outcome = (SELECT outcome FROM get_consultation_consensus(NEW.consultation_id))
    WHERE id = NEW.consultation_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_consultation_response
  AFTER INSERT ON agent_consultation_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_consultation_status();

-- Auto-archive old shadow observations
CREATE OR REPLACE FUNCTION archive_old_shadow_observations()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE shadow_observations
  SET archived = true
  WHERE shadow_id = NEW.shadow_id
    AND archived = false
    AND created_at < NOW() - (
      SELECT (retention_days || ' days')::INTERVAL
      FROM shadow_agents
      WHERE id = NEW.shadow_id
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_archive_observations
  AFTER INSERT ON shadow_observations
  FOR EACH ROW
  EXECUTE FUNCTION archive_old_shadow_observations();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
