# Database Migration Instructions

## Option 1: Supabase Dashboard (Recommended)

1. **Go to your Supabase project dashboard**
   - Navigate to: https://app.supabase.com/project/YOUR_PROJECT/editor

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

3. **Copy the migration SQL**
   - Open: `supabase/migrations/20250124000000_bot_trust_infrastructure.sql`
   - Copy the entire contents

4. **Run the migration**
   - Paste the SQL into the editor
   - Click "Run" (or press Ctrl+Enter)
   - Wait for success message

5. **Verify tables created**
   - Go to "Table Editor" in left sidebar
   - You should see 6 new tables:
     - bot_decisions
     - bot_trust_scores
     - bot_approval_rates
     - bot_autonomy_levels
     - bot_audit_log
     - bot_telemetry

---

## Option 2: Supabase CLI

If you have Supabase CLI installed and linked:

```bash
# Link your project (one time)
npx supabase link --project-ref YOUR_PROJECT_REF

# Push migration
npx supabase db push

# Or apply migration directly
npx supabase db execute -f supabase/migrations/20250124000000_bot_trust_infrastructure.sql
```

---

## Option 3: Direct Connection (Advanced)

If you have direct PostgreSQL access:

```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@db.your-project.supabase.co:5432/postgres" \
  -f supabase/migrations/20250124000000_bot_trust_infrastructure.sql
```

---

## Verification

After running the migration, verify it worked:

### Check Tables Exist
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'bot_%';
```

Should return:
- bot_decisions
- bot_trust_scores
- bot_approval_rates
- bot_autonomy_levels
- bot_audit_log
- bot_telemetry

### Check Row-Level Security
```sql
SELECT tablename, policyname
FROM pg_policies
WHERE tablename LIKE 'bot_%';
```

Should show policies for all 6 tables.

### Check Functions
```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE 'get_bot_%';
```

Should return:
- get_bot_trust_score
- get_bot_autonomy_level
- get_bot_approval_rate

---

## Rollback (if needed)

To remove all bot trust tables:

```sql
-- Drop tables (cascade will remove dependent objects)
DROP TABLE IF EXISTS bot_telemetry CASCADE;
DROP TABLE IF EXISTS bot_audit_log CASCADE;
DROP TABLE IF EXISTS bot_autonomy_levels CASCADE;
DROP TABLE IF EXISTS bot_approval_rates CASCADE;
DROP TABLE IF EXISTS bot_trust_scores CASCADE;
DROP TABLE IF EXISTS bot_decisions CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS get_bot_trust_score(UUID);
DROP FUNCTION IF EXISTS get_bot_autonomy_level(UUID);
DROP FUNCTION IF EXISTS get_bot_approval_rate(UUID);
DROP FUNCTION IF EXISTS prevent_audit_log_modification();
```

---

## Troubleshooting

### Error: "relation 'bots' does not exist"
The migration references a `bots` table. Make sure it exists first. If not, modify the migration to remove the foreign key constraints temporarily.

### Error: "extension 'uuid-ossp' already exists"
This is fine - the extension was already installed. The migration will continue.

### Error: "permission denied"
Make sure you're using the service role key or database password, not the anon key.

### Tables created but RLS not working
Run this to enable RLS on all tables:
```sql
ALTER TABLE bot_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_trust_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_approval_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_autonomy_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_telemetry ENABLE ROW LEVEL SECURITY;
```

---

## Next Steps After Migration

1. **Test the system**
   ```bash
   npx tsx scripts/test-bot-trust.ts
   ```

2. **View dashboard**
   - Start dev server: `npm run dev`
   - Navigate to: `http://localhost:3000/bots/[bot-id]/trust`

3. **Integrate with chat API**
   - Follow BOT_TRUST_QUICKSTART.md

---

## Need Help?

- Check IMPLEMENTATION_SUMMARY.md for full documentation
- Review BOT_TRUST_QUICKSTART.md for usage examples
- Verify environment variables in .env.local
