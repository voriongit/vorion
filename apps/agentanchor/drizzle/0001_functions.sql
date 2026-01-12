-- AgentAnchor Database Functions
-- Applied after initial schema migration

-- ============================================
-- Trust Tier Calculation Function
-- ============================================
-- Returns the trust tier name for a given trust score (0-1000)
-- Tiers:
--   0-199:    Untrusted
--   200-399:  Provisional
--   400-599:  Established
--   600-799:  Trusted
--   800-899:  Highly Trusted
--   900-1000: Elite

CREATE OR REPLACE FUNCTION get_trust_tier(score INTEGER)
RETURNS TEXT AS $$
BEGIN
  CASE
    WHEN score >= 900 THEN RETURN 'Elite';
    WHEN score >= 800 THEN RETURN 'Highly Trusted';
    WHEN score >= 600 THEN RETURN 'Trusted';
    WHEN score >= 400 THEN RETURN 'Established';
    WHEN score >= 200 THEN RETURN 'Provisional';
    ELSE RETURN 'Untrusted';
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- Trust Tier Numeric Function
-- ============================================
-- Returns the numeric tier level (0-5) for sorting/comparison

CREATE OR REPLACE FUNCTION get_trust_tier_level(score INTEGER)
RETURNS INTEGER AS $$
BEGIN
  CASE
    WHEN score >= 900 THEN RETURN 5;
    WHEN score >= 800 THEN RETURN 4;
    WHEN score >= 600 THEN RETURN 3;
    WHEN score >= 400 THEN RETURN 2;
    WHEN score >= 200 THEN RETURN 1;
    ELSE RETURN 0;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- Truth Chain Hash Calculation
-- ============================================
-- Calculates SHA-256 hash for truth chain records
-- Combines payload with previous hash for chain integrity

CREATE OR REPLACE FUNCTION calculate_truth_chain_hash(
  payload JSONB,
  previous_hash TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  hash_input TEXT;
BEGIN
  -- Combine payload with previous hash
  IF previous_hash IS NULL THEN
    hash_input := payload::TEXT;
  ELSE
    hash_input := previous_hash || payload::TEXT;
  END IF;

  -- Return SHA-256 hash
  RETURN encode(sha256(hash_input::bytea), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- Auto-update Timestamp Trigger
-- ============================================
-- Automatically updates updated_at column on row update

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY['profiles', 'agents', 'council_decisions', 'marketplace_listings', 'acquisitions', 'academy_progress'];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS update_%s_updated_at ON %s;
       CREATE TRIGGER update_%s_updated_at
       BEFORE UPDATE ON %s
       FOR EACH ROW
       EXECUTE FUNCTION update_updated_at_column()',
      tbl, tbl, tbl, tbl
    );
  END LOOP;
END $$;

-- ============================================
-- Trust Score Bounds Check
-- ============================================
-- Ensures trust scores stay within 0-1000 range

CREATE OR REPLACE FUNCTION enforce_trust_score_bounds()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.trust_score < 0 THEN
    NEW.trust_score := 0;
  ELSIF NEW.trust_score > 1000 THEN
    NEW.trust_score := 1000;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to agents table
DROP TRIGGER IF EXISTS enforce_agents_trust_score ON agents;
CREATE TRIGGER enforce_agents_trust_score
BEFORE INSERT OR UPDATE ON agents
FOR EACH ROW
EXECUTE FUNCTION enforce_trust_score_bounds();

-- ============================================
-- Get Next Truth Chain Sequence Number
-- ============================================
-- Thread-safe function to get the next sequence number

CREATE OR REPLACE FUNCTION get_next_truth_chain_sequence()
RETURNS BIGINT AS $$
DECLARE
  next_seq BIGINT;
BEGIN
  SELECT COALESCE(MAX(sequence_number), 0) + 1
  INTO next_seq
  FROM truth_chain
  FOR UPDATE;

  RETURN next_seq;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Verify Truth Chain Integrity
-- ============================================
-- Verifies the hash chain integrity up to a given record

CREATE OR REPLACE FUNCTION verify_truth_chain_integrity(up_to_sequence BIGINT DEFAULT NULL)
RETURNS TABLE(
  sequence_number BIGINT,
  is_valid BOOLEAN,
  expected_hash TEXT,
  actual_hash TEXT
) AS $$
DECLARE
  prev_hash TEXT := NULL;
  rec RECORD;
  max_seq BIGINT;
BEGIN
  -- Determine max sequence to check
  IF up_to_sequence IS NULL THEN
    SELECT MAX(tc.sequence_number) INTO max_seq FROM truth_chain tc;
  ELSE
    max_seq := up_to_sequence;
  END IF;

  -- Iterate through chain
  FOR rec IN
    SELECT tc.sequence_number, tc.payload, tc.hash, tc.previous_hash
    FROM truth_chain tc
    WHERE tc.sequence_number <= max_seq
    ORDER BY tc.sequence_number
  LOOP
    sequence_number := rec.sequence_number;
    expected_hash := calculate_truth_chain_hash(rec.payload, prev_hash);
    actual_hash := rec.hash;
    is_valid := (expected_hash = actual_hash) AND (prev_hash IS NOT DISTINCT FROM rec.previous_hash);

    RETURN NEXT;

    prev_hash := rec.hash;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql;
