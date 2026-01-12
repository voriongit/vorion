# Bot Trust System - Quick Start Guide

Get up and running with the Bot Trust & Validation Infrastructure in 5 minutes.

---

## 🚀 Quick Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Database Migration
```bash
# Apply the bot trust infrastructure migration
npm run db:migrate

# Or manually via Supabase CLI
supabase db push
```

### 3. Verify Environment Variables
Ensure your `.env.local` has:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Start Development Server
```bash
npm run dev
```

### 5. Access Dashboard
Navigate to: `http://localhost:3000/bots/[bot-id]/trust`

---

## 📝 Basic Usage

### Initialize a New Bot
```typescript
import { autonomyManager } from '@/lib/bot-trust';

// When creating a new bot
await autonomyManager.initializeBot(botId);
```

### Log a Decision
```typescript
import { decisionTracker, DecisionType, RiskLevel } from '@/lib/bot-trust';

const decision = await decisionTracker.logDecision({
  bot_id: botId,
  decision_type: DecisionType.SUGGEST,
  action_taken: 'Send marketing email',
  reasoning: 'User engagement is low this week',
  confidence_score: 0.85,
  risk_level: RiskLevel.LOW
});
```

### Record User Feedback
```typescript
import { UserResponse } from '@/lib/bot-trust';

// When user approves/rejects the decision
await decisionTracker.updateDecisionResponse(
  decision.id,
  UserResponse.APPROVED
);
```

### Check Trust Score
```typescript
import { trustScoreEngine } from '@/lib/bot-trust';

const score = await trustScoreEngine.calculateTrustScore(botId);
console.log(`Trust Score: ${score.score}/1000`);
```

### Check Autonomy Level
```typescript
import { autonomyManager } from '@/lib/bot-trust';

const level = await autonomyManager.getCurrentLevel(botId);
console.log(`Autonomy Level: ${level}/5`);

// Check if bot can progress
const evaluation = await autonomyManager.evaluateProgression(botId);
if (evaluation.can_progress) {
  await autonomyManager.progressToNextLevel(botId);
}
```

---

## 🎯 Integration with Chat API

Add decision tracking to your chat route:

```typescript
// app/api/chat/route.ts

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
    // ... existing chat logic ...

    // Determine autonomy level and decision type
    const currentLevel = await autonomyManager.getCurrentLevel(botId);
    const decisionType = await autonomyManager.determineDecisionType(
      botId,
      RiskLevel.MEDIUM,
      0.85 // confidence score
    );

    // Log the decision
    const decision = await decisionTracker.logDecision({
      bot_id: botId,
      decision_type: decisionType,
      action_taken: 'Generate response',
      context_data: { prompt: userMessage },
      reasoning: 'Based on conversation context',
      confidence_score: 0.85,
      risk_level: RiskLevel.MEDIUM
    });

    // Record telemetry
    const responseTime = Date.now() - startTime;
    await telemetryCollector.recordRequest(botId, responseTime, true);
    await telemetryCollector.recordTokenUsage(
      botId,
      inputTokens,
      outputTokens,
      'claude-sonnet-4'
    );

    // Return response with decision ID for user feedback
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

---

## 🎨 Add Dashboard Link

Add trust dashboard link to your bot detail page:

```typescript
// app/bots/[id]/page.tsx

import Link from 'next/link';

export default function BotDetailPage({ params }: { params: { id: string } }) {
  return (
    <div>
      {/* ... existing bot details ... */}

      <Link
        href={`/bots/${params.id}/trust`}
        className="px-4 py-2 bg-blue-600 text-white rounded-md"
      >
        View Trust Dashboard
      </Link>
    </div>
  );
}
```

---

## 📊 View Real-Time Metrics

The dashboard automatically refreshes telemetry every 30 seconds. Access it at:
```
/bots/[bot-id]/trust
```

Tabs available:
- **Overview** - Trust score, autonomy level, approval rate
- **Decisions** - All bot decisions with reasoning
- **Telemetry** - Performance metrics and charts
- **Audit** - Immutable audit trail with verification

---

## 🔍 Common Scenarios

### Scenario 1: New Bot (Level 1 - Ask & Learn)
```typescript
// Bot asks before every action
const decisionType = await autonomyManager.determineDecisionType(
  botId,
  RiskLevel.LOW,
  0.95
);
// Returns: DecisionType.ASK
```

### Scenario 2: Experienced Bot (Level 3 - Execute & Review)
```typescript
// Bot executes low-risk actions autonomously
const decisionType = await autonomyManager.determineDecisionType(
  botId,
  RiskLevel.LOW,
  0.90
);
// Returns: DecisionType.EXECUTE

// But asks for high-risk actions
const decisionType = await autonomyManager.determineDecisionType(
  botId,
  RiskLevel.HIGH,
  0.85
);
// Returns: DecisionType.SUGGEST
```

### Scenario 3: Trusted Bot (Level 5 - Fully Autonomous)
```typescript
// Bot handles everything except critical decisions
const decisionType = await autonomyManager.determineDecisionType(
  botId,
  RiskLevel.HIGH,
  0.95
);
// Returns: DecisionType.EXECUTE

const decisionType = await autonomyManager.determineDecisionType(
  botId,
  RiskLevel.CRITICAL,
  0.92
);
// Returns: DecisionType.ESCALATE (confidence < 0.95)
```

---

## 🧪 Testing

### Test Decision Tracking
```bash
curl -X POST http://localhost:3000/api/bot-trust/decisions \
  -H "Content-Type: application/json" \
  -d '{
    "bot_id": "your-bot-uuid",
    "decision_type": "suggest",
    "action_taken": "Test action",
    "confidence_score": 0.85,
    "risk_level": "low"
  }'
```

### Test Trust Score
```bash
curl -X POST http://localhost:3000/api/bot-trust/trust-score \
  -H "Content-Type: application/json" \
  -d '{"bot_id": "your-bot-uuid"}'
```

### Verify Audit Chain
```bash
curl "http://localhost:3000/api/bot-trust/audit?bot_id=your-bot-uuid&verify=true"
```

---

## 🐛 Troubleshooting

### Migration Fails
```bash
# Check Supabase connection
npx supabase status

# Reset and reapply
npm run db:reset
npm run db:migrate
```

### Trust Score Shows 300 (Minimum)
This is normal for new bots. They need:
- At least 50 decisions for Level 2
- At least 75% approval rate

### Dashboard Shows No Data
1. Verify bot_id is correct
2. Check if bot has any decisions logged
3. Try calculating trust score manually via API

### TypeScript Errors
```bash
# Regenerate types from Supabase
npm run generate:types
```

---

## 📚 Learn More

- **IMPLEMENTATION_SUMMARY.md** - Complete feature list
- **ARCHITECTURE_SETUP.md** - Technical architecture
- **STORY-006** - User story and acceptance criteria

---

## 🎓 Key Concepts Recap

### Trust Score (300-1000)
Like a credit score for bots. Higher = more trustworthy.

### Autonomy Levels (1-5)
- Level 1: Bot is learning, asks everything
- Level 5: Bot is fully trusted, handles everything

### Decision Types
- **Ask**: Bot requests permission
- **Suggest**: Bot proposes action with reasoning
- **Execute**: Bot performs action autonomously
- **Escalate**: Bot needs human judgment

### Risk Levels
- **Low**: Safe, reversible actions
- **Medium**: Important but manageable
- **High**: Significant impact
- **Critical**: Major consequences, requires highest confidence

---

## ✅ Checklist

- [ ] Dependencies installed
- [ ] Database migration applied
- [ ] Environment variables configured
- [ ] Bot initialized with autonomy level
- [ ] First decision logged
- [ ] Trust score calculated
- [ ] Dashboard accessible
- [ ] Chat API integrated with decision tracking

---

**Ready to build trust!** 🚀

Questions? Check IMPLEMENTATION_SUMMARY.md for detailed documentation.
