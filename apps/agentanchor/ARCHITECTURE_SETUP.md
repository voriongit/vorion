# Bot Trust & Validation Infrastructure - Architecture Setup

## Overview

This document outlines the complete architecture setup for the Bot Training, Transparency & Telemetry system.

## Project Structure

```
aiBotBuild/
├── app/                                    # Next.js App Router
│   ├── api/
│   │   ├── bot-trust/                     # NEW: Bot trust endpoints
│   │   │   ├── decisions/route.ts         # Log and query decisions
│   │   │   ├── approval-rates/route.ts    # Calculate approval rates
│   │   │   ├── trust-score/route.ts       # Get/update trust scores
│   │   │   ├── validation/route.ts        # Bot validation
│   │   │   └── telemetry/route.ts         # Telemetry data
│   │   ├── bot-training/                  # NEW: Training system
│   │   │   ├── modules/route.ts           # Training modules
│   │   │   ├── progress/route.ts          # Training progress
│   │   │   └── certifications/route.ts    # Certifications
│   │   ├── bot-committees/                # NEW: Review committees
│   │   │   ├── reviews/route.ts           # Submit reviews
│   │   │   ├── voting/route.ts            # Committee voting
│   │   │   └── appeals/route.ts           # Appeals process
│   │   └── transparency/                  # NEW: Public transparency
│   │       ├── public-profile/route.ts    # Public bot profiles
│   │       └── audit-log/route.ts         # Audit trail
│   ├── dashboard/                         # User dashboard
│   │   ├── bot-trust/                     # NEW: Trust dashboard
│   │   │   ├── page.tsx                   # Overview
│   │   │   ├── decisions/page.tsx         # Decision feed
│   │   │   ├── telemetry/page.tsx         # Metrics
│   │   │   └── training/page.tsx          # Training progress
│   │   └── ...
│   └── public-profile/                    # NEW: Public bot profiles
│       └── [botId]/page.tsx
├── lib/
│   ├── bot-trust/                         # NEW: Trust system core
│   │   ├── decision-tracker.ts            # Track decisions
│   │   ├── approval-rate-calculator.ts    # Calculate rates
│   │   ├── trust-score-engine.ts          # Trust score logic
│   │   ├── autonomy-manager.ts            # Level management
│   │   ├── pattern-learner.ts             # Learn from feedback
│   │   └── types.ts                       # TypeScript types
│   ├── bot-training/                      # NEW: Training system
│   │   ├── curriculum-manager.ts          # Manage training modules
│   │   ├── scenario-tester.ts             # Test scenarios
│   │   ├── certification-issuer.ts        # Issue certificates
│   │   └── types.ts
│   ├── bot-committees/                    # NEW: Committee system
│   │   ├── three-bot-review.ts            # 3-bot review logic
│   │   ├── voting-engine.ts               # Voting mechanisms
│   │   ├── escalation-router.ts           # Escalation logic
│   │   └── types.ts
│   ├── transparency/                      # NEW: Transparency system
│   │   ├── reasoning-generator.ts         # Generate explanations
│   │   ├── audit-logger.ts                # Immutable audit log
│   │   ├── hash-chain.ts                  # Cryptographic chain
│   │   └── types.ts
│   ├── telemetry/                         # NEW: Telemetry system
│   │   ├── metrics-collector.ts           # Collect metrics
│   │   ├── anomaly-detector.ts            # Detect anomalies
│   │   ├── dashboard-aggregator.ts        # Aggregate for dashboard
│   │   └── types.ts
│   └── ...existing lib files...
├── components/
│   ├── bot-trust/                         # NEW: Trust UI components
│   │   ├── DecisionFeed.tsx               # Real-time decision feed
│   │   ├── DecisionDetail.tsx             # Decision details modal
│   │   ├── ApprovalRateChart.tsx          # Approval rate visualization
│   │   ├── TrustScoreGauge.tsx            # Trust score display
│   │   ├── AutonomyLevelBadge.tsx         # Level indicator
│   │   └── ReasoningDisplay.tsx           # Show bot reasoning
│   ├── bot-training/                      # NEW: Training UI
│   │   ├── TrainingModuleCard.tsx         # Module display
│   │   ├── ProgressBar.tsx                # Progress indicator
│   │   ├── CertificationBadge.tsx         # Certificate display
│   │   └── ScenarioTest.tsx               # Test interface
│   ├── telemetry/                         # NEW: Telemetry UI
│   │   ├── MetricWidget.tsx               # Dashboard widgets
│   │   ├── TelemetryChart.tsx             # Charts
│   │   ├── AnomalyAlert.tsx               # Anomaly notifications
│   │   └── ComparisonView.tsx             # Compare bots
│   └── transparency/                      # NEW: Transparency UI
│       ├── AuditLogViewer.tsx             # Audit log display
│       ├── PublicTrustProfile.tsx         # Public profile
│       └── DecisionTimeline.tsx           # Decision history
├── supabase/
│   ├── migrations/                        # Database migrations
│   │   ├── 20251123_bot_trust_schema.sql  # NEW: Core trust tables
│   │   ├── 20251123_bot_training.sql      # NEW: Training tables
│   │   ├── 20251123_bot_committees.sql    # NEW: Committee tables
│   │   ├── 20251123_transparency.sql      # NEW: Audit/transparency
│   │   └── 20251123_telemetry.sql         # NEW: Telemetry tables
│   ├── functions/                         # Database functions
│   │   ├── calculate_trust_score.sql      # Trust score calculation
│   │   ├── check_autonomy_level.sql       # Check level advancement
│   │   └── generate_audit_hash.sql        # Hash generation
│   └── schema.sql                         # Main schema (existing)
├── tests/
│   ├── unit/
│   │   ├── bot-trust/                     # NEW: Trust system tests
│   │   ├── bot-training/                  # NEW: Training tests
│   │   └── telemetry/                     # NEW: Telemetry tests
│   └── integration/
│       ├── decision-tracking.test.ts      # NEW: E2E decision tracking
│       ├── autonomy-progression.test.ts   # NEW: Level advancement
│       └── trust-score.test.ts            # NEW: Trust score calculation
└── docs/
    ├── api/                               # API documentation
    │   ├── bot-trust-api.md               # Trust API docs
    │   ├── training-api.md                # Training API docs
    │   └── telemetry-api.md               # Telemetry API docs
    ├── architecture/                      # Architecture docs (existing)
    └── runbooks/                          # Operational runbooks
        ├── bot-trust-setup.md             # Setup guide
        ├── monitoring.md                  # Monitoring guide
        └── troubleshooting.md             # Common issues
```

## Technology Stack

### Core Technologies (Existing)
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **AI**: Anthropic Claude
- **Styling**: Tailwind CSS
- **State**: Zustand

### New Dependencies for Bot Trust System

```json
{
  "dependencies": {
    // Time-series data handling
    "timescale": "^1.0.0",  // TimescaleDB client for telemetry

    // Real-time updates
    "ws": "^8.14.0",  // WebSocket for live dashboards

    // Data visualization
    "recharts": "^2.10.0",  // Charts for dashboards
    "d3": "^7.8.0",  // Advanced visualizations

    // Validation & schemas
    "zod": "^3.22.4",  // Already installed

    // Crypto for audit trail
    "crypto-js": "^4.2.0"  // Hashing for audit log
  },
  "devDependencies": {
    // Testing
    "vitest": "^1.0.4",  // Already installed
    "@testing-library/react": "^14.1.2",  // Already installed

    // API mocking
    "msw": "^2.0.0"  // Mock Service Worker for tests
  }
}
```

## Database Architecture

### New Tables

#### 1. bot_decisions
Primary table for tracking all bot decisions
```sql
CREATE TABLE bot_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
  decision_type VARCHAR(50) NOT NULL,
  action_taken TEXT NOT NULL,
  context_data JSONB,
  reasoning TEXT,
  alternatives_considered JSONB,
  confidence_score DECIMAL(5,2),
  risk_level VARCHAR(20),
  user_response VARCHAR(20),
  modification_details TEXT,
  outcome TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bot_decisions_bot ON bot_decisions(bot_id);
CREATE INDEX idx_bot_decisions_created ON bot_decisions(created_at DESC);
CREATE INDEX idx_bot_decisions_type ON bot_decisions(decision_type);
```

#### 2. bot_trust_scores
Store calculated trust scores
```sql
CREATE TABLE bot_trust_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 300 AND score <= 1000),
  decision_accuracy DECIMAL(5,2),
  ethics_compliance DECIMAL(5,2),
  training_success DECIMAL(5,2),
  operational_stability DECIMAL(5,2),
  peer_reviews DECIMAL(5,2),
  calculated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(bot_id)
);
```

#### 3. bot_approval_rates
Track approval rates over time
```sql
CREATE TABLE bot_approval_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  total_decisions INTEGER NOT NULL,
  approved_count INTEGER NOT NULL,
  rejected_count INTEGER NOT NULL,
  modified_count INTEGER NOT NULL,
  approval_rate DECIMAL(5,2) NOT NULL,
  by_task_type JSONB,
  by_risk_level JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_approval_rates_bot ON bot_approval_rates(bot_id, period_start DESC);
```

#### 4. bot_autonomy_levels
Track autonomy level changes
```sql
CREATE TABLE bot_autonomy_levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
  previous_level INTEGER,
  new_level INTEGER NOT NULL CHECK (new_level BETWEEN 1 AND 5),
  reason TEXT,
  decision_count INTEGER,
  approval_rate DECIMAL(5,2),
  changed_at TIMESTAMP DEFAULT NOW()
);
```

#### 5. bot_audit_log
Immutable audit trail
```sql
CREATE TABLE bot_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB NOT NULL,
  previous_hash VARCHAR(64),
  current_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_log_bot ON bot_audit_log(bot_id, created_at DESC);
```

#### 6. bot_telemetry
Time-series telemetry data (use TimescaleDB hypertable)
```sql
CREATE TABLE bot_telemetry (
  id UUID DEFAULT uuid_generate_v4(),
  bot_id UUID REFERENCES bots(id) ON DELETE CASCADE,
  metric_name VARCHAR(100) NOT NULL,
  metric_value DECIMAL(10,4) NOT NULL,
  metric_unit VARCHAR(50),
  tags JSONB,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, timestamp)
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('bot_telemetry', 'timestamp');

CREATE INDEX idx_telemetry_bot_metric ON bot_telemetry(bot_id, metric_name, timestamp DESC);
```

## Environment Variables

Add to `.env.local`:

```bash
# Bot Trust System
FEATURE_BOT_TRUST=true
FEATURE_BOT_TRAINING=true
FEATURE_BOT_COMMITTEES=true
FEATURE_PUBLIC_TRANSPARENCY=true

# Trust Score Configuration
TRUST_SCORE_MIN=300
TRUST_SCORE_MAX=1000
TRUST_SCORE_DECISION_ACCURACY_WEIGHT=0.35
TRUST_SCORE_ETHICS_WEIGHT=0.30
TRUST_SCORE_TRAINING_WEIGHT=0.15
TRUST_SCORE_STABILITY_WEIGHT=0.10
TRUST_SCORE_PEER_REVIEW_WEIGHT=0.10

# Autonomy Level Thresholds
AUTONOMY_L2_DECISIONS=50
AUTONOMY_L2_APPROVAL=0.75
AUTONOMY_L3_DECISIONS=100
AUTONOMY_L3_APPROVAL=0.80
AUTONOMY_L4_DECISIONS=200
AUTONOMY_L4_APPROVAL=0.85
AUTONOMY_L5_DECISIONS=500
AUTONOMY_L5_APPROVAL=0.90

# Telemetry
TELEMETRY_ENABLED=true
TELEMETRY_BATCH_SIZE=100
TELEMETRY_FLUSH_INTERVAL=60000  # 60 seconds
ANOMALY_DETECTION_ENABLED=true

# WebSocket for real-time updates
WS_PORT=3001
WS_HEARTBEAT_INTERVAL=30000  # 30 seconds

# Audit Log
AUDIT_LOG_RETENTION_DAYS=365
AUDIT_LOG_HASH_ALGORITHM=sha256
```

## Development Workflow

### 1. Initial Setup

```bash
# Install new dependencies
npm install timescale recharts d3 ws crypto-js msw

# Run database migrations
npm run db:migrate

# Seed test data
npm run db:seed

# Start development server
npm run dev

# Start WebSocket server (separate terminal)
npm run ws:dev
```

### 2. Development Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "ws:dev": "node scripts/ws-server.js",
    "db:migrate": "node scripts/migrate.js",
    "db:seed": "node scripts/seed.js",
    "db:reset": "node scripts/reset-db.js",
    "test:trust": "vitest run tests/unit/bot-trust",
    "test:integration": "vitest run tests/integration",
    "generate:types": "supabase gen types typescript --local > lib/database.types.ts"
  }
}
```

### 3. Git Hooks

Create `.husky/pre-commit`:

```bash
#!/bin/sh
npm run lint
npm run test:trust
npm run generate:types
```

## Monitoring & Observability

### Sentry Configuration

Update `sentry.server.config.ts`:

```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  integrations: [
    // Add custom integration for bot trust events
    new Sentry.Integrations.Http({ tracing: true }),
  ],
  beforeSend(event) {
    // Add bot context to all errors
    if (event.contexts?.bot) {
      event.tags = {
        ...event.tags,
        bot_id: event.contexts.bot.id,
        trust_score: event.contexts.bot.trust_score,
      };
    }
    return event;
  },
});
```

### Logging Strategy

```typescript
// lib/logger.ts - Already exists, enhance it:
import logger from '@/lib/logger';

// Add structured logging for bot events
logger.info('bot_decision_tracked', {
  bot_id: 'bot-123',
  decision_type: 'suggest',
  confidence: 0.85,
  user_response: 'approved',
});

logger.warn('bot_autonomy_demotion', {
  bot_id: 'bot-456',
  previous_level: 4,
  new_level: 3,
  reason: 'approval_rate_drop',
});
```

## Security Considerations

### 1. RLS Policies

All new tables need RLS policies:

```sql
-- Example for bot_decisions
ALTER TABLE bot_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view decisions for their bots"
ON bot_decisions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM bots
    WHERE bots.id = bot_decisions.bot_id
    AND bots.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert decisions for their bots"
ON bot_decisions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM bots
    WHERE bots.id = bot_decisions.bot_id
    AND bots.user_id = auth.uid()
  )
);
```

### 2. API Authentication

All bot trust endpoints require authentication:

```typescript
// middleware example
export async function requireAuth(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return session;
}
```

## Performance Optimization

### 1. Caching Strategy

```typescript
// Use Redis for frequently accessed data
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Cache trust scores
async function getTrustScore(botId: string) {
  const cached = await redis.get(`trust_score:${botId}`);
  if (cached) return cached;

  const score = await calculateTrustScore(botId);
  await redis.setex(`trust_score:${botId}`, 3600, score); // 1 hour TTL
  return score;
}
```

### 2. Database Indexing

All foreign keys and frequently queried columns have indexes (see table definitions above).

### 3. Query Optimization

Use database functions for complex calculations:

```sql
-- Calculate approval rate in database
CREATE FUNCTION calculate_approval_rate(
  p_bot_id UUID,
  p_start_date TIMESTAMP,
  p_end_date TIMESTAMP
) RETURNS DECIMAL(5,2) AS $$
  SELECT
    ROUND(
      (COUNT(*) FILTER (WHERE user_response = 'approved')::DECIMAL /
       COUNT(*)::DECIMAL) * 100,
      2
    )
  FROM bot_decisions
  WHERE bot_id = p_bot_id
    AND created_at BETWEEN p_start_date AND p_end_date;
$$ LANGUAGE SQL STABLE;
```

## Testing Strategy

### Unit Tests

```typescript
// tests/unit/bot-trust/approval-rate-calculator.test.ts
import { describe, it, expect } from 'vitest';
import { calculateApprovalRate } from '@/lib/bot-trust/approval-rate-calculator';

describe('ApprovalRateCalculator', () => {
  it('should calculate overall approval rate correctly', () => {
    const decisions = [
      { user_response: 'approved' },
      { user_response: 'approved' },
      { user_response: 'rejected' },
    ];

    const rate = calculateApprovalRate(decisions);
    expect(rate).toBe(66.67);
  });
});
```

### Integration Tests

```typescript
// tests/integration/decision-tracking.test.ts
import { describe, it, expect } from 'vitest';

describe('Decision Tracking E2E', () => {
  it('should track decision and update approval rate', async () => {
    // Create bot
    const bot = await createTestBot();

    // Log decision
    await logDecision(bot.id, {
      decision_type: 'suggest',
      action_taken: 'Create blog post',
      user_response: 'approved',
    });

    // Check approval rate updated
    const rate = await getApprovalRate(bot.id);
    expect(rate).toBeDefined();
  });
});
```

## Deployment Checklist

- [ ] Run all migrations
- [ ] Set all environment variables
- [ ] Enable RLS policies
- [ ] Deploy database functions
- [ ] Start WebSocket server
- [ ] Configure monitoring
- [ ] Set up alerts
- [ ] Test in staging
- [ ] Deploy to production
- [ ] Monitor for 24 hours
- [ ] Document any issues

## Next Steps

1. **Implement Core Modules** (Phase 1)
   - DecisionTracker
   - ApprovalRateCalculator
   - TrustScoreEngine
   - AutonomyManager

2. **Build API Endpoints** (Phase 1)
   - POST /api/bot-trust/decisions
   - GET /api/bot-trust/approval-rates
   - GET /api/bot-trust/trust-score

3. **Create UI Components** (Phase 2)
   - DecisionFeed
   - TrustScoreGauge
   - ApprovalRateChart

4. **Testing & Validation** (Phase 2)
   - Unit tests
   - Integration tests
   - Load testing

5. **Documentation** (Phase 3)
   - API documentation
   - User guides
   - Runbooks

---

**Ready to start building? Let's tackle the core modules first!**
