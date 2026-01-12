# 🚀 You're Live! Get Started Now

## ✅ Current Status

- ✅ Database migration applied
- ✅ Dev server running on **http://localhost:3002**
- ✅ Bot Trust Infrastructure ready

---

## 🎯 Quick Start - 3 Steps

### Step 1: Get a Bot ID

**Option A: From Supabase**
1. Go to https://app.supabase.com
2. Open Table Editor → `bots` table
3. Copy any `id` value (it's a UUID)

**Option B: Query in SQL Editor**
```sql
SELECT id, name FROM bots LIMIT 5;
```

---

### Step 2: Visit the Trust Dashboard

Replace `BOT_ID` with the ID you copied:

```
http://localhost:3002/bots/BOT_ID/trust
```

Example:
```
http://localhost:3002/bots/123e4567-e89b-12d3-a456-426614174000/trust
```

You should see:
- 📊 Trust Score Card (will show 300 for new bots)
- 🎯 Autonomy Level Card (Level 1 for new bots)
- 📈 Approval Rate section
- 4 Tabs: Overview, Decisions, Telemetry, Audit

---

### Step 3: Initialize a Bot (Optional)

If the bot hasn't been initialized yet, you can do it via API:

```bash
curl -X POST http://localhost:3002/api/bot-trust/autonomy \
  -H "Content-Type: application/json" \
  -d '{"bot_id": "YOUR_BOT_ID", "action": "initialize"}'
```

Or test with a sample decision:

```bash
curl -X POST http://localhost:3002/api/bot-trust/decisions \
  -H "Content-Type: application/json" \
  -d '{
    "bot_id": "YOUR_BOT_ID",
    "decision_type": "suggest",
    "action_taken": "Test decision",
    "confidence_score": 0.85,
    "risk_level": "low",
    "reasoning": "Testing the bot trust system"
  }'
```

---

## 🧪 Quick Test - Create Sample Data

Run this SQL in Supabase SQL Editor to create test data:

```sql
-- Use an actual bot_id from your bots table
DO $$
DECLARE
  test_bot_id UUID;
  decision_id UUID;
BEGIN
  -- Get first bot
  SELECT id INTO test_bot_id FROM bots LIMIT 1;

  -- Initialize autonomy
  INSERT INTO bot_autonomy_levels (bot_id, current_level, decision_count, approval_rate)
  VALUES (test_bot_id, 1, 0, 0)
  ON CONFLICT DO NOTHING;

  -- Create 10 test decisions
  FOR i IN 1..10 LOOP
    INSERT INTO bot_decisions (
      bot_id,
      decision_type,
      action_taken,
      confidence_score,
      risk_level,
      reasoning,
      user_response
    )
    VALUES (
      test_bot_id,
      'suggest',
      'Test decision ' || i,
      0.80 + (random() * 0.15),
      CASE WHEN i % 2 = 0 THEN 'low' ELSE 'medium' END,
      'Testing the decision tracking system',
      CASE
        WHEN i <= 8 THEN 'approved'
        WHEN i = 9 THEN 'modified'
        ELSE NULL
      END
    );
  END LOOP;

  -- Calculate and store approval rate
  INSERT INTO bot_approval_rates (bot_id, overall_rate)
  VALUES (test_bot_id, 0.80);

  -- Calculate and store trust score
  INSERT INTO bot_trust_scores (
    bot_id,
    score,
    decision_accuracy,
    ethics_compliance,
    training_success,
    operational_stability,
    peer_reviews
  )
  VALUES (test_bot_id, 650, 80.0, 85.0, 75.0, 90.0, 70.0);

  -- Log audit events
  INSERT INTO bot_audit_log (bot_id, event_type, event_data, hash)
  VALUES
    (test_bot_id, 'bot_created', '{"test": true}'::jsonb, md5(random()::text)),
    (test_bot_id, 'trust_score_calculated', '{"score": 650}'::jsonb, md5(random()::text));

  -- Record telemetry
  INSERT INTO bot_telemetry (bot_id, metric_name, metric_value, metric_unit)
  VALUES
    (test_bot_id, 'request_count', 100, 'count'),
    (test_bot_id, 'response_time_ms', 1250, 'milliseconds'),
    (test_bot_id, 'error_count', 2, 'count'),
    (test_bot_id, 'total_tokens', 50000, 'tokens');

  RAISE NOTICE 'Test data created for bot: %', test_bot_id;
END $$;
```

After running this, refresh the dashboard to see populated data!

---

## 📱 What You'll See

### Overview Tab
- **Trust Score**: 650/1000 (Good)
- **Autonomy Level**: Level 1 (Ask & Learn)
- **Approval Rate**: 80%
- **Recent Decisions**: Last 5 decisions with reasoning

### Decisions Tab
- Full list of all decisions
- Click any decision to see:
  - Reasoning
  - Alternatives considered
  - Confidence score
  - Risk level
  - User response

### Telemetry Tab
- Response time metrics
- Error rates
- Token usage
- Real-time performance snapshot

### Audit Tab
- Chronological audit trail
- Verify chain integrity button
- Export to JSON

---

## 🔗 Next: Integrate with Chat

Add bot trust tracking to your chat API:

**Edit: `app/api/chat/route.ts`**

```typescript
import {
  decisionTracker,
  telemetryCollector,
  DecisionType,
  RiskLevel
} from '@/lib/bot-trust';

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const { message, botId } = await request.json();

    // Log the decision
    await decisionTracker.logDecision({
      bot_id: botId,
      decision_type: DecisionType.SUGGEST,
      action_taken: 'Generate chat response',
      confidence_score: 0.85,
      risk_level: RiskLevel.MEDIUM,
      reasoning: 'Based on conversation context'
    });

    // ... your existing chat logic ...

    // Record telemetry
    const responseTime = Date.now() - startTime;
    await telemetryCollector.recordRequest(botId, responseTime, true);

    return Response.json({ response: botResponse });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    await telemetryCollector.recordRequest(botId, responseTime, false);
    throw error;
  }
}
```

---

## 📚 Learn More

- **BOT_TRUST_README.md** - Complete overview
- **BOT_TRUST_QUICKSTART.md** - Code examples
- **IMPLEMENTATION_SUMMARY.md** - Full documentation

---

## 🎊 You Did It!

Your Bot Trust & Validation Infrastructure is live!

**Current URL:** http://localhost:3002/bots/[BOT_ID]/trust

Replace `[BOT_ID]` with an actual bot ID and see it in action! 🚀
