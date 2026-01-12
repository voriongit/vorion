-- Verify Bot Trust Infrastructure Migration
-- Run this in Supabase SQL Editor after applying the migration

-- Check if all tables exist
SELECT
  table_name,
  CASE
    WHEN table_name IN ('bot_decisions', 'bot_trust_scores', 'bot_approval_rates',
                        'bot_autonomy_levels', 'bot_audit_log', 'bot_telemetry')
    THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'bot_%'
ORDER BY table_name;

-- Expected output:
-- bot_approval_rates     ✅ EXISTS
-- bot_audit_log          ✅ EXISTS
-- bot_autonomy_levels    ✅ EXISTS
-- bot_decisions          ✅ EXISTS
-- bot_mcp_servers        ✅ EXISTS (existing table)
-- bot_telemetry          ✅ EXISTS
-- bot_trust_scores       ✅ EXISTS
-- bots                   ✅ EXISTS (existing table)

-- Check if RLS policies were created
SELECT
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE tablename LIKE 'bot_%'
GROUP BY tablename
ORDER BY tablename;

-- Expected: Each new table should have 2-3 policies

-- Check if helper functions were created
SELECT
  routine_name,
  '✅ FUNCTION EXISTS' as status
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE 'get_bot_%'
ORDER BY routine_name;

-- Expected:
-- get_bot_approval_rate   ✅ FUNCTION EXISTS
-- get_bot_autonomy_level  ✅ FUNCTION EXISTS
-- get_bot_trust_score     ✅ FUNCTION EXISTS
