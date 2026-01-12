-- Fix Bot Models - Update to Current Claude Model
-- Run this in Supabase SQL Editor

-- Update all bots using old model to new model
UPDATE bots
SET model = 'claude-3-5-sonnet-20241022'
WHERE model IN (
  'claude-3-sonnet-20240229',
  'claude-3-5-sonnet-20240620',
  'claude-sonnet-3.5'
);

-- Verify the update
SELECT
  model,
  COUNT(*) as bot_count
FROM bots
GROUP BY model
ORDER BY bot_count DESC;

-- Expected result: All bots should now use 'claude-3-5-sonnet-20241022'
