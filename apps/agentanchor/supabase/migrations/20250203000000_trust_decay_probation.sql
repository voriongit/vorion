-- Trust Decay & Probation Migration
-- Story 4-4: Trust Decay & Autonomy Limits (FR54, FR56, FR57)

-- Add activity tracking and probation columns to bots table
ALTER TABLE bots ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS is_on_probation BOOLEAN DEFAULT FALSE;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS probation_started_at TIMESTAMPTZ;
ALTER TABLE bots ADD COLUMN IF NOT EXISTS probation_ended_at TIMESTAMPTZ;

-- Create index for decay query (finding inactive agents)
CREATE INDEX IF NOT EXISTS idx_bots_last_activity ON bots (last_activity_at)
WHERE status = 'active';

-- Create index for probation queries
CREATE INDEX IF NOT EXISTS idx_bots_probation ON bots (is_on_probation)
WHERE is_on_probation = true;

-- Add comment for documentation
COMMENT ON COLUMN bots.last_activity_at IS 'Last time the agent performed an action, used for decay calculation';
COMMENT ON COLUMN bots.is_on_probation IS 'True if agent is on probation (restricted to supervised operation)';
COMMENT ON COLUMN bots.probation_started_at IS 'When the current probation period started';
COMMENT ON COLUMN bots.probation_ended_at IS 'When the last probation period ended';

-- Initialize last_activity_at for existing active agents
UPDATE bots
SET last_activity_at = COALESCE(updated_at, created_at)
WHERE last_activity_at IS NULL AND status = 'active';
