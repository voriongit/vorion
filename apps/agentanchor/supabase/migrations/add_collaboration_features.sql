-- Add collaboration presets table
CREATE TABLE IF NOT EXISTS collaboration_presets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  bot_ids UUID[] NOT NULL,
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add metadata column to conversations if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'conversations' AND column_name = 'metadata') THEN
    ALTER TABLE conversations ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Update conversation constraint to allow collaboration type
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversation_type;
ALTER TABLE conversations ADD CONSTRAINT conversation_type CHECK (
  (bot_id IS NOT NULL AND team_id IS NULL AND (metadata->>'type' IS NULL OR metadata->>'type' != 'collaboration')) OR
  (bot_id IS NULL AND team_id IS NOT NULL AND (metadata->>'type' IS NULL OR metadata->>'type' != 'collaboration')) OR
  (bot_id IS NULL AND team_id IS NULL AND metadata->>'type' = 'collaboration')
);

-- Create index for collaboration presets
CREATE INDEX IF NOT EXISTS idx_collaboration_presets_user_id ON collaboration_presets(user_id);

-- Enable RLS on collaboration_presets
ALTER TABLE collaboration_presets ENABLE ROW LEVEL SECURITY;

-- RLS policies for collaboration_presets
CREATE POLICY "Users can view their own collaboration presets" ON collaboration_presets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own collaboration presets" ON collaboration_presets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own collaboration presets" ON collaboration_presets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own collaboration presets" ON collaboration_presets
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at on collaboration_presets
CREATE TRIGGER update_collaboration_presets_updated_at BEFORE UPDATE ON collaboration_presets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
