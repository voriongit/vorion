-- Update All Bot Models to Current Versions
-- Run this in Supabase SQL Editor

-- Step 1: Show current model distribution
SELECT
  model,
  COUNT(*) as bot_count,
  CASE
    WHEN model IN ('claude-3-5-sonnet-20241022', 'claude-sonnet-4-5-20250514', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229')
      THEN '✅ Current'
    ELSE '❌ Needs Update'
  END as status
FROM bots
GROUP BY model
ORDER BY bot_count DESC;

-- Step 2: Update all bots to use current models
UPDATE bots
SET model = CASE
  -- Update old Sonnets to Claude 3.7 Sonnet
  WHEN model IN ('claude-3-sonnet-20240229', 'claude-3-5-sonnet-20240620', 'claude-sonnet-3.5')
    THEN 'claude-3-5-sonnet-20241022'

  -- Update old Haiku to Claude 3.5 Haiku
  WHEN model IN ('claude-3-haiku-20240307', 'claude-3-haiku')
    THEN 'claude-3-5-haiku-20241022'

  -- Keep Opus as is (still valid)
  WHEN model = 'claude-3-opus-20240229'
    THEN 'claude-3-opus-20240229'

  -- Default fallback: use Claude 3.7 Sonnet
  ELSE 'claude-3-5-sonnet-20241022'
END
WHERE model NOT IN (
  'claude-3-5-sonnet-20241022',
  'claude-sonnet-4-5-20250514',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229'
);

-- Step 3: Verify the update
SELECT
  model,
  COUNT(*) as bot_count,
  '✅ All Updated!' as status
FROM bots
GROUP BY model
ORDER BY bot_count DESC;

-- Step 4: Show which bots were updated
SELECT
  id,
  name,
  model,
  '✅ Updated' as status
FROM bots
WHERE model IN (
  'claude-3-5-sonnet-20241022',
  'claude-sonnet-4-5-20250514',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229'
)
ORDER BY name;

-- Expected Results:
-- All bots should now use one of these current models:
-- - claude-3-5-sonnet-20241022 (Claude 3.7 Sonnet)
-- - claude-sonnet-4-5-20250514 (Claude 4.5 Sonnet)
-- - claude-3-5-haiku-20241022 (Claude 3.5 Haiku)
-- - claude-3-opus-20240229 (Claude 3 Opus)
