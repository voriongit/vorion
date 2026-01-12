# Deploy Bot Trust System - Step-by-Step

Follow these steps to deploy the Bot Trust & Validation Infrastructure to your running application.

---

## ✅ Prerequisites

- [ ] Supabase project is running
- [ ] Environment variables configured in `.env.local`
- [ ] Application builds successfully (`npm run build`)
- [ ] Dependencies installed (`npm install`)

---

## 🚀 Deployment Steps

### Step 1: Apply Database Migration

**Option A: Supabase Dashboard (Easiest)**

1. Go to https://app.supabase.com
2. Select your project
3. Click "SQL Editor" in left sidebar
4. Click "New query"
5. Open file: `supabase/migrations/20250124000000_bot_trust_infrastructure.sql`
6. Copy entire contents and paste into SQL Editor
7. Click "Run" (or Ctrl+Enter)
8. Wait for success confirmation

**Option B: Command Line** (if Supabase CLI is configured)
```bash
npx supabase db push
```

### Step 2: Verify Migration

Run this SQL query in Supabase SQL Editor:

```sql
-- Check if tables were created
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'bot_%'
ORDER BY table_name;
```

You should see 9 tables total:
- ✅ bot_decisions
- ✅ bot_trust_scores
- ✅ bot_approval_rates
- ✅ bot_autonomy_levels
- ✅ bot_audit_log
- ✅ bot_telemetry
- ✅ bot_mcp_servers (existing)
- ✅ bots (existing)
- ✅ ... (other bot-related tables)

### Step 3: Test the System

Create a test script to verify everything works:

```bash
# Install tsx for running TypeScript
npm install -D tsx

# Run the test script
npx tsx scripts/test-bot-trust.ts
```

Expected output:
```
🧪 Testing Bot Trust System...

1️⃣ Initializing bot autonomy...
   ✓ Bot initialized at Level 1

2️⃣ Logging decisions...
   ✓ Logged 10 decisions

3️⃣ Calculating approval rate...
   ✓ Overall approval rate: 80.0%
   ...

✅ All tests passed!
```

### Step 4: Start Development Server

```bash
npm run dev
```

### Step 5: Access the Dashboard

Navigate to:
```
http://localhost:3000/bots/[any-bot-id]/trust
```

You should see:
- Trust Score Card
- Autonomy Level Card
- Approval Rate Chart
- Tabs for Decisions, Telemetry, Audit

---

## 🔗 Integration with Existing Code

### Update Chat API

Edit `app/api/chat/route.ts`:

```typescript
import {
  decisionTracker,
  autonomyManager,
  telemetryCollector,
  DecisionType,
  RiskLevel
} from '@/lib/bot-trust';

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const { message, botId } = await request.json();

    // Get bot's current autonomy level
    const autonomyLevel = await autonomyManager.getCurrentLevel(botId);

    // Determine how bot should handle this request
    const decisionType = await autonomyManager.determineDecisionType(
      botId,
      RiskLevel.MEDIUM,
      0.85 // confidence score
    );

    // Log the decision
    const decision = await decisionTracker.logDecision({
      bot_id: botId,
      decision_type: decisionType,
      action_taken: 'Generate chat response',
      context_data: { user_message: message },
      reasoning: 'Based on conversation context and system prompt',
      confidence_score: 0.85,
      risk_level: RiskLevel.MEDIUM
    });

    // ... existing chat logic ...

    // Record telemetry
    const responseTime = Date.now() - startTime;
    await telemetryCollector.recordRequest(botId, responseTime, true);

    return Response.json({
      response: botResponse,
      decision_id: decision.id
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    await telemetryCollector.recordRequest(botId, responseTime, false);
    throw error;
  }
}
```

### Add Dashboard Link to Bot Pages

Edit `app/bots/[id]/page.tsx`:

```typescript
import Link from 'next/link';

export default function BotDetailPage({ params }) {
  return (
    <div>
      {/* ... existing bot UI ... */}

      <div className="flex gap-3 mt-6">
        <Link
          href={`/bots/${params.id}/trust`}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          📊 View Trust Dashboard
        </Link>
      </div>
    </div>
  );
}
```

### Initialize New Bots

Edit `app/api/orchestrator/create-bot/route.ts`:

```typescript
import { autonomyManager } from '@/lib/bot-trust';

export async function POST(request: Request) {
  // ... existing bot creation logic ...

  const newBot = await supabase.from('bots').insert({...}).select().single();

  // Initialize bot trust system
  await autonomyManager.initializeBot(newBot.data.id);

  return Response.json({ bot: newBot.data });
}
```

---

## 📊 Monitor & Maintain

### Daily Monitoring

Check these metrics in the dashboard:

1. **Trust Scores** - Are bots improving over time?
2. **Approval Rates** - Are users satisfied with bot decisions?
3. **Error Rates** - Any performance issues?
4. **Autonomy Levels** - Bots progressing appropriately?

### Weekly Maintenance

```sql
-- Clean up old telemetry (keep 90 days)
DELETE FROM bot_telemetry
WHERE timestamp < NOW() - INTERVAL '90 days';

-- Calculate trust scores for all active bots
-- (You can create a cron job for this)
```

### Monthly Review

1. Review audit logs for anomalies
2. Verify audit chain integrity
3. Export audit logs for compliance
4. Analyze trust score trends

---

## 🔧 Troubleshooting

### Issue: Dashboard shows no data

**Solution:**
1. Check bot_id is correct
2. Verify migration ran successfully
3. Check browser console for errors
4. Test API endpoints directly:
   ```bash
   curl http://localhost:3000/api/bot-trust/autonomy?bot_id=YOUR_BOT_ID
   ```

### Issue: Trust score always 300

**Solution:**
This is normal for new bots. They need:
- At least 50 decisions for progression
- At least 75% approval rate

Simulate some decisions:
```bash
npx tsx scripts/test-bot-trust.ts
```

### Issue: Telemetry not showing

**Solution:**
1. Ensure telemetry is being recorded in chat API
2. Check telemetry buffer is flushing (auto-flushes every 5s)
3. Manually flush: `telemetryCollector.shutdown()`

### Issue: Autonomy level won't progress

**Solution:**
Check requirements:
```typescript
const eval = await autonomyManager.evaluateProgression(botId);
console.log(eval.recommendation);
```

### Issue: RLS blocking data access

**Solution:**
Make sure you're using the correct authentication context. In server components/API routes, use the service role key.

---

## 🎉 Success Checklist

After deployment, verify:

- [ ] All 6 bot trust tables exist in Supabase
- [ ] Test script passes all tests
- [ ] Dashboard loads without errors
- [ ] Can log decisions via API
- [ ] Can calculate trust scores
- [ ] Audit chain verifies successfully
- [ ] Telemetry is collecting data
- [ ] Chat API is integrated
- [ ] Navigation links work

---

## 📚 Next Steps

1. **Read the docs**
   - IMPLEMENTATION_SUMMARY.md - Full feature list
   - BOT_TRUST_QUICKSTART.md - Usage examples
   - ARCHITECTURE_SETUP.md - Technical details

2. **Customize for your use case**
   - Adjust autonomy requirements
   - Modify trust score weights
   - Add custom telemetry metrics

3. **Build advanced features**
   - Three-bot review system
   - Bot training marketplace
   - Real-time WebSocket updates
   - ML-based anomaly detection

---

## 🆘 Need Help?

1. Check error logs in browser console
2. Review Supabase logs
3. Test API endpoints with curl
4. Verify environment variables
5. Check IMPLEMENTATION_SUMMARY.md for detailed docs

---

**Deployment complete!** 🎊

Your Bot Trust & Validation Infrastructure is now live.

Access your dashboard at: `http://localhost:3000/bots/[bot-id]/trust`
