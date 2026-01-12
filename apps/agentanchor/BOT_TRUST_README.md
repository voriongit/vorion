# 🤖 Bot Trust & Validation Infrastructure

> **Training, Transparency, and Telemetry** - A comprehensive system for building trustworthy AI bots with graduated autonomy.

---

## 🎯 Overview

The Bot Trust System enables AI bots to progressively earn more autonomy as they demonstrate reliability. Every decision is tracked, explained, and validated through user feedback, creating a transparent and accountable AI assistant ecosystem.

### The Three Pillars

1. **🎓 Training** - Bots learn from user feedback and improve over time
2. **🔍 Transparency** - Every decision is logged with full reasoning and context
3. **📊 Telemetry** - Real-time performance metrics track operational health

---

## ✨ Key Features

### Graduated Autonomy (5 Levels)

Bots start cautious and earn trust through proven performance:

| Level | Name | Behavior | Requirements |
|-------|------|----------|--------------|
| 1 | Ask & Learn | Asks before every action | New bot (0 decisions) |
| 2 | Suggest | Proposes actions with confidence | 50 decisions, 75% approval |
| 3 | Execute & Review | Does low-risk autonomously | 100 decisions, 80% approval |
| 4 | Autonomous w/ Exceptions | Handles most decisions | 200 decisions, 85% approval |
| 5 | Fully Autonomous | Trusted for everything | 500 decisions, 90% approval |

### Trust Score (300-1000)

FICO-style scoring based on 5 weighted components:

- **Decision Accuracy (35%)** - Approval rates + risk-weighted performance
- **Ethics Compliance (25%)** - Policy violations, escalations
- **Training Success (20%)** - Learning trajectory over time
- **Operational Stability (15%)** - Error rates, response times
- **Peer Reviews (5%)** - External validation

### Complete Decision Tracking

Every bot decision includes:
- ✅ Action taken and reasoning
- ✅ Alternatives considered
- ✅ Confidence score (0-1)
- ✅ Risk level (low/medium/high/critical)
- ✅ User response (approved/rejected/modified)
- ✅ Full context data

### Immutable Audit Trail

Cryptographically secure audit log:
- 🔐 SHA-256 hash chain (blockchain-style)
- 🔒 Tamper-evident
- ✅ Chain verification
- 📦 Export for compliance

### Real-Time Telemetry

Performance metrics automatically collected:
- ⚡ Response times
- 🚨 Error rates
- 🎯 Token usage
- 💾 Cache hit rates
- 📈 Time-series data for charting

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Apply Database Migration

**Via Supabase Dashboard:**
1. Open SQL Editor at https://app.supabase.com
2. Copy contents of `supabase/migrations/20250124000000_bot_trust_infrastructure.sql`
3. Run the migration

### 3. Initialize a Bot

```typescript
import { autonomyManager } from '@/lib/bot-trust';

await autonomyManager.initializeBot(botId);
```

### 4. Log a Decision

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

### 5. View Dashboard

Navigate to: `http://localhost:3000/bots/[bot-id]/trust`

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| **BOT_TRUST_QUICKSTART.md** | 5-minute setup guide with code examples |
| **IMPLEMENTATION_SUMMARY.md** | Complete feature documentation |
| **ARCHITECTURE_SETUP.md** | Technical architecture details |
| **DEPLOY_BOT_TRUST.md** | Step-by-step deployment guide |
| **MIGRATION_INSTRUCTIONS.md** | Database migration help |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Dashboard UI                       │
│  (Trust Score, Autonomy, Decisions, Telemetry)      │
└────────────────┬────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────┐
│                  API Endpoints                       │
│  /decisions  /trust-score  /autonomy  /telemetry   │
└────────────────┬────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────┐
│               Core Modules                           │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │  Decision   │  │   Approval   │  │   Trust   │ │
│  │  Tracker    │  │     Rate     │  │   Score   │ │
│  └─────────────┘  └──────────────┘  └───────────┘ │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │  Autonomy   │  │    Audit     │  │ Telemetry │ │
│  │   Manager   │  │    Logger    │  │ Collector │ │
│  └─────────────┘  └──────────────┘  └───────────┘ │
└────────────────┬────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────┐
│            Supabase PostgreSQL                       │
│  6 tables: decisions, trust_scores, approval_rates  │
│  autonomy_levels, audit_log, telemetry              │
└──────────────────────────────────────────────────────┘
```

---

## 💡 Usage Examples

### Example 1: New Bot Starting Out

```typescript
// Initialize at Level 1 (Ask & Learn)
await autonomyManager.initializeBot(botId);

// Bot asks before every action
const decision = await decisionTracker.logDecision({
  bot_id: botId,
  decision_type: DecisionType.ASK,
  action_taken: 'Create blog post',
  confidence_score: 0.70,
  risk_level: RiskLevel.LOW
});

// User approves
await decisionTracker.updateDecisionResponse(
  decision.id,
  UserResponse.APPROVED
);
```

### Example 2: Experienced Bot (Level 3)

```typescript
// Bot executes low-risk actions autonomously
const decisionType = await autonomyManager.determineDecisionType(
  botId,
  RiskLevel.LOW,
  0.90
);
// Returns: DecisionType.EXECUTE

// But asks for high-risk
const decisionType = await autonomyManager.determineDecisionType(
  botId,
  RiskLevel.HIGH,
  0.85
);
// Returns: DecisionType.SUGGEST
```

### Example 3: Check Progress

```typescript
// Evaluate if bot can progress
const eval = await autonomyManager.evaluateProgression(botId);

console.log(`Current Level: ${eval.current_level}`);
console.log(`Can Progress: ${eval.can_progress}`);
console.log(`Requirements: ${eval.recommendation}`);

// Progress if ready
if (eval.can_progress) {
  await autonomyManager.progressToNextLevel(botId);
}
```

### Example 4: Calculate Trust Score

```typescript
const trustScore = await trustScoreEngine.calculateTrustScore(botId);

console.log(`Score: ${trustScore.score}/1000`);
console.log(`Components:`, trustScore.components);
```

### Example 5: Record Telemetry

```typescript
// Automatic tracking in chat API
const startTime = Date.now();

try {
  // ... process chat request ...

  const responseTime = Date.now() - startTime;
  await telemetryCollector.recordRequest(botId, responseTime, true);
  await telemetryCollector.recordTokenUsage(
    botId,
    inputTokens,
    outputTokens,
    'claude-sonnet-4'
  );
} catch (error) {
  const responseTime = Date.now() - startTime;
  await telemetryCollector.recordRequest(botId, responseTime, false);
}
```

---

## 🎨 Dashboard Screenshots

### Overview Tab
- Trust Score Card (300-1000 with component breakdown)
- Autonomy Level Card (current level + progress bars)
- Approval Rate Summary
- Recent decisions list

### Decisions Tab
- Full decision history with filters
- Click to view detailed reasoning
- Alternatives considered
- User responses

### Telemetry Tab
- Real-time performance metrics
- Response time charts
- Error rate tracking
- Token usage graphs

### Audit Tab
- Immutable audit trail
- Chain verification button
- Export to JSON
- Event filtering

---

## 🔧 API Reference

### Decision Tracking

```typescript
// Log decision
POST /api/bot-trust/decisions
{
  bot_id: string,
  decision_type: 'ask' | 'suggest' | 'execute' | 'escalate',
  action_taken: string,
  confidence_score: number, // 0-1
  risk_level: 'low' | 'medium' | 'high' | 'critical'
}

// Update user response
PATCH /api/bot-trust/decisions/:id
{
  user_response: 'approved' | 'rejected' | 'modified'
}

// Get history
GET /api/bot-trust/decisions?bot_id={id}&limit=50
```

### Trust Score

```typescript
// Calculate and store
POST /api/bot-trust/trust-score
{ bot_id: string }

// Get latest
GET /api/bot-trust/trust-score?bot_id={id}

// Get history
GET /api/bot-trust/trust-score?bot_id={id}&history=true
```

### Autonomy

```typescript
// Get current level
GET /api/bot-trust/autonomy?bot_id={id}

// Evaluate progression
GET /api/bot-trust/autonomy?bot_id={id}&evaluate=true

// Progress to next level
POST /api/bot-trust/autonomy
{ bot_id: string, action: 'progress' }

// Initialize new bot
POST /api/bot-trust/autonomy
{ bot_id: string, action: 'initialize' }
```

### Telemetry

```typescript
// Record metric
POST /api/bot-trust/telemetry
{
  bot_id: string,
  metric_name: string,
  metric_value: number,
  metric_unit: string
}

// Get performance snapshot
GET /api/bot-trust/telemetry?bot_id={id}&snapshot=true

// Get time-series data
GET /api/bot-trust/telemetry?bot_id={id}&metric=response_time_ms&timeseries=true
```

### Audit Log

```typescript
// Log event
POST /api/bot-trust/audit
{
  bot_id: string,
  event_type: string,
  event_data: object
}

// Verify chain
GET /api/bot-trust/audit?bot_id={id}&verify=true

// Export
GET /api/bot-trust/audit?bot_id={id}&export=true
```

---

## 🧪 Testing

```bash
# Run test suite
npx tsx scripts/test-bot-trust.ts

# Expected output:
# 🧪 Testing Bot Trust System...
# ✅ All tests passed!
```

---

## 🔒 Security

- **Row-Level Security (RLS)** - Users can only access their bots' data
- **Immutable Audit Log** - Triggers prevent modification/deletion
- **Cryptographic Hashing** - SHA-256 hash chain for tamper-evidence
- **Service Role Only** - Sensitive operations require service key

---

## 📈 Monitoring

Track these KPIs:

1. **Trust Score Trends** - Are scores improving?
2. **Autonomy Distribution** - How many bots at each level?
3. **Approval Rates** - User satisfaction levels
4. **Error Rates** - System reliability
5. **Response Times** - Performance metrics
6. **Escalation Rates** - How often bots need human help

---

## 🛠️ Maintenance

### Daily
- Check dashboard for anomalies
- Review critical decision escalations

### Weekly
- Clean old telemetry (>90 days)
- Verify audit chain integrity

### Monthly
- Export audit logs for compliance
- Review trust score trends
- Analyze bot progression patterns

---

## 🚧 Roadmap

**Phase 1:** Core Infrastructure ✅ COMPLETE
- Decision tracking
- Trust scoring
- Autonomy management
- Audit logging
- Telemetry collection
- Dashboard UI

**Phase 2:** Integration 🔄 IN PROGRESS
- Chat API integration
- User feedback buttons
- Real-time updates
- Testing suite

**Phase 3:** Advanced Features 📅 PLANNED
- Three-bot review system
- Bot training marketplace
- The Aegis Board (ethics governance)
- ML-based anomaly detection
- Pattern learning
- Real-time WebSocket updates

---

## 🤝 Contributing

1. Read IMPLEMENTATION_SUMMARY.md for architecture
2. Follow existing code patterns
3. Add tests for new features
4. Update documentation
5. Submit PR with clear description

---

## 📞 Support

**Documentation:**
- BOT_TRUST_QUICKSTART.md - Setup guide
- IMPLEMENTATION_SUMMARY.md - Full docs
- DEPLOY_BOT_TRUST.md - Deployment guide

**Troubleshooting:**
- Check browser console for errors
- Review Supabase logs
- Test API endpoints with curl
- Verify environment variables

---

## 📄 License

Part of the AI Bot Builder Platform

---

## 🎉 Credits

Built with:
- TypeScript
- Next.js 14
- Supabase
- Recharts
- crypto-js

**Status:** Core infrastructure complete ✅

**Ready for production!** 🚀

Navigate to `/bots/[bot-id]/trust` to view your bot trust dashboard.
