-- Rollback: 20241224_002_aria_conversations
-- Reverses the Aria conversations table creation
--
-- WARNING: This will DELETE all conversation data!
-- Only run if absolutely necessary.

-- Drop indexes first
DROP INDEX IF EXISTS idx_conversations_user_id;
DROP INDEX IF EXISTS idx_conversations_agent_id;
DROP INDEX IF EXISTS idx_conversations_created_at;

-- Drop the table
DROP TABLE IF EXISTS aria_conversations CASCADE;

-- Remove from migration history
-- (Handled automatically by migrate-safe.sh)
