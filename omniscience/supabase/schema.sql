-- Omniscience Lexicon Schema for Supabase
-- Run this in Supabase SQL Editor

-- Enable full-text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Lexicon terms table
CREATE TABLE IF NOT EXISTS lexicon (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  term TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  definition TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('novice', 'intermediate', 'expert', 'theoretical')),
  category TEXT DEFAULT 'general',
  tags TEXT[] DEFAULT '{}',
  overview TEXT,
  key_concepts JSONB DEFAULT '[]',
  examples JSONB DEFAULT '[]',
  use_cases TEXT[] DEFAULT '{}',
  common_mistakes TEXT[] DEFAULT '{}',
  related_terms TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT DEFAULT 'system'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_lexicon_term ON lexicon(term);
CREATE INDEX IF NOT EXISTS idx_lexicon_slug ON lexicon(slug);
CREATE INDEX IF NOT EXISTS idx_lexicon_category ON lexicon(category);
CREATE INDEX IF NOT EXISTS idx_lexicon_level ON lexicon(level);
CREATE INDEX IF NOT EXISTS idx_lexicon_tags ON lexicon USING GIN(tags);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_lexicon_search ON lexicon
  USING GIN(to_tsvector('english', term || ' ' || definition || ' ' || COALESCE(overview, '')));

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lexicon_updated_at
  BEFORE UPDATE ON lexicon
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Row Level Security (optional - enable if you want public read, authenticated write)
ALTER TABLE lexicon ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Public read access" ON lexicon
  FOR SELECT USING (true);

-- Allow authenticated users to insert/update/delete
CREATE POLICY "Authenticated write access" ON lexicon
  FOR ALL USING (auth.role() = 'authenticated');

-- Or for simpler setup, allow anon key full access (less secure but simpler)
-- DROP POLICY IF EXISTS "Public read access" ON lexicon;
-- DROP POLICY IF EXISTS "Authenticated write access" ON lexicon;
-- CREATE POLICY "Allow all" ON lexicon FOR ALL USING (true);

-- ============================================
-- Submissions table (term submission queue)
-- ============================================

CREATE TABLE IF NOT EXISTS submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  term TEXT NOT NULL,
  definition TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('novice', 'intermediate', 'expert', 'theoretical')),
  category TEXT DEFAULT 'general',
  tags TEXT[] DEFAULT '{}',
  submitted_by TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  rejection_reason TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON submissions(submitted_at);

-- RLS for submissions
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Allow public to submit
CREATE POLICY "Public can submit" ON submissions
  FOR INSERT WITH CHECK (true);

-- Allow public to read their own submissions (simplified: allow all reads)
CREATE POLICY "Public read submissions" ON submissions
  FOR SELECT USING (true);
