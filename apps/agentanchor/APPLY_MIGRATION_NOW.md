# 🚀 Apply Migration - Visual Guide

## Step 1: Open Supabase Dashboard

Go to: **https://app.supabase.com**

![Supabase Dashboard](https://supabase.com)

---

## Step 2: Select Your Project

Click on your AI Bot Builder project from the dashboard

---

## Step 3: Open SQL Editor

Look for **"SQL Editor"** in the left sidebar (icon looks like `</>`)

Click it, then click **"New query"**

---

## Step 4: Copy Migration File

**In VS Code or your editor:**

1. Open file: `supabase/migrations/20250124000000_bot_trust_infrastructure.sql`
2. Press `Ctrl+A` (Select All)
3. Press `Ctrl+C` (Copy)

**File path:**
```
C:\BAI\scattered_asprirations\aiBotBuild\supabase\migrations\20250124000000_bot_trust_infrastructure.sql
```

---

## Step 5: Paste and Run

**In Supabase SQL Editor:**

1. Press `Ctrl+V` (Paste the entire SQL file)
2. Click **"Run"** button in top-right corner
   - Or press `Ctrl+Enter`
3. Wait 5-10 seconds

**Expected result:**
```
✅ Success. No rows returned
```

---

## Step 6: Verify Tables Created

**In Supabase Dashboard:**

1. Click **"Table Editor"** in left sidebar (icon looks like a table/grid)
2. Scroll through the table list
3. You should see these 6 NEW tables:
   - ✅ `bot_decisions`
   - ✅ `bot_trust_scores`
   - ✅ `bot_approval_rates`
   - ✅ `bot_autonomy_levels`
   - ✅ `bot_audit_log`
   - ✅ `bot_telemetry`

---

## Step 7: Run Verification (Optional)

**To double-check everything worked:**

1. Go back to SQL Editor
2. Click "New query"
3. Copy contents of: `scripts/verify-migration.sql`
4. Paste and Run
5. Check that all tables show "✅ EXISTS"

---

## ✅ Success Checklist

After completing the steps above, verify:

- [ ] SQL ran without errors
- [ ] 6 new tables visible in Table Editor
- [ ] Can see rows/columns when clicking each table
- [ ] Verification script shows all ✅

---

## 🎉 Next Steps

**1. Test the System**
```bash
cd C:\BAI\scattered_asprirations\aiBotBuild
npx tsx scripts/test-bot-trust.ts
```

**2. Start Dev Server**
```bash
npm run dev
```

**3. View Dashboard**
```
http://localhost:3000/bots/[bot-id]/trust
```

---

## ❌ Troubleshooting

### Error: "relation 'bots' does not exist"

**Problem:** The `bots` table doesn't exist in your database.

**Solution:** The bot trust tables reference the `bots` table. Make sure your main schema is applied first:
```bash
# In Supabase SQL Editor, run:
# Open and run: supabase/schema.sql
```

### Error: "permission denied"

**Problem:** Not using correct credentials.

**Solution:** Make sure you're logged into Supabase with the project owner account.

### No errors but tables not showing

**Problem:** Cache issue or wrong project.

**Solution:**
1. Refresh the Supabase dashboard page
2. Verify you're in the correct project
3. Check "Table Editor" again

### Error: "extension 'uuid-ossp' already exists"

**This is OK!** The extension was already installed. The migration continues successfully.

---

## 🆘 Still Having Issues?

1. **Check the SQL output** - Look for specific error messages
2. **Screenshot the error** - Helps identify the issue
3. **Verify project** - Make sure you're in the right Supabase project
4. **Check credentials** - Ensure you have owner/admin access

---

## 📁 Quick File Reference

**Migration file location:**
```
C:\BAI\scattered_asprirations\aiBotBuild\supabase\migrations\20250124000000_bot_trust_infrastructure.sql
```

**Verification file location:**
```
C:\BAI\scattered_asprirations\aiBotBuild\scripts\verify-migration.sql
```

**Test script location:**
```
C:\BAI\scattered_asprirations\aiBotBuild\scripts\test-bot-trust.ts
```

---

## 📊 What Gets Created

### 6 New Tables:

1. **bot_decisions** - All bot decisions with reasoning
2. **bot_trust_scores** - Historical trust scores (300-1000)
3. **bot_approval_rates** - Approval rate tracking
4. **bot_autonomy_levels** - Autonomy progression history
5. **bot_audit_log** - Immutable audit trail (cryptographic)
6. **bot_telemetry** - Performance metrics

### 18 New Indexes:
- Optimized for fast queries on bot_id, timestamps, and metrics

### 12 RLS Policies:
- Row-level security to protect user data

### 3 Helper Functions:
- get_bot_trust_score()
- get_bot_autonomy_level()
- get_bot_approval_rate()

### 2 Triggers:
- Prevent audit log modification (immutability)

---

## ⏱️ Total Time: ~2 minutes

1. Open Supabase (30 sec)
2. Copy/paste SQL (30 sec)
3. Run migration (10 sec)
4. Verify tables (30 sec)
5. Test system (30 sec)

---

## 🎊 You're Done!

Once the migration completes successfully, your Bot Trust Infrastructure is live!

**Next:** Read BOT_TRUST_QUICKSTART.md to start using it.
