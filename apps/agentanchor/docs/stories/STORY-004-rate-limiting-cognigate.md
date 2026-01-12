# Story 004: Rate Limiting with Cognigate.dev Integration

**Epic**: Platform Security & Cost Management
**Priority**: High
**Story Points**: 5
**Status**: Ready for Development

## User Story

**As a** platform operator
**I want** intelligent rate limiting on all API endpoints
**So that** I can prevent abuse, manage costs, and ensure fair usage across all users

## Background

The platform will integrate with **cognigate.dev** for advanced AI-specific rate limiting capabilities. Cognigate provides:
- Token-aware rate limiting (not just request counting)
- Multi-tier rate limits (free, pro, enterprise)
- Cost prediction and budget enforcement
- Adaptive rate limiting based on system load
- Analytics and usage insights

## Acceptance Criteria

### AC1: Cognigate Integration Setup
- [ ] Sign up for Cognigate.dev account
- [ ] Install Cognigate SDK: `npm install @cognigate/sdk`
- [ ] Configure API keys in environment variables
- [ ] Create rate limit tiers: Free, Pro, Enterprise
- [ ] Define tier quotas and limits

### AC2: Rate Limit Configuration

**Free Tier:**
- 100 messages per day
- 50,000 tokens per day
- 10 bots max
- 3 teams max
- 5 requests per minute burst

**Pro Tier:**
- 1,000 messages per day
- 500,000 tokens per day
- 50 bots max
- 20 teams max
- 20 requests per minute burst

**Enterprise Tier:**
- Unlimited messages
- Custom token quota
- Unlimited bots and teams
- Custom burst limits

### AC3: API Endpoint Protection

**Protected Endpoints:**
```typescript
// High priority (token-based limiting)
POST /api/chat
POST /api/team-chat
POST /api/orchestrator/parse-intent

// Medium priority (request-based limiting)
POST /api/orchestrator/create-bot
POST /api/orchestrator/create-team
POST /api/orchestrator/create-mcp
POST /api/files/upload

// Low priority
GET /api/bots
GET /api/teams
GET /api/mcp
GET /api/conversations
```

### AC4: Rate Limit Middleware
- [ ] Create middleware in `lib/rate-limit.ts`
- [ ] Integrate Cognigate SDK
- [ ] Apply middleware to all API routes
- [ ] Return 429 Too Many Requests with retry-after header
- [ ] Include remaining quota in response headers

**Response Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1234567890
X-RateLimit-Tier: free
```

### AC5: Token-Based Rate Limiting for Chat
- [ ] Calculate token count for chat requests
- [ ] Use Cognigate token counting (Claude-specific)
- [ ] Include both request and response tokens
- [ ] Track cumulative token usage per user
- [ ] Block requests when token quota exceeded

### AC6: User Feedback & Quota Display
- [ ] Display current usage in dashboard
- [ ] Show remaining quota per tier
- [ ] Visual progress bars for quotas
- [ ] Warning when approaching limits (80%, 90%)
- [ ] Upgrade prompts when limits hit
- [ ] Rate limit error messages with helpful guidance

### AC7: Admin Controls
- [ ] Admin endpoint to view user rate limit status
- [ ] Manual quota resets (for support)
- [ ] Temporary quota boosts (promotional)
- [ ] Rate limit bypass for testing
- [ ] Usage analytics dashboard

## Technical Details

### New Dependencies
```json
{
  "@cognigate/sdk": "^1.0.0"
}
```

### Files to Create
1. **`lib/rate-limit.ts`** - Cognigate rate limit middleware
2. **`lib/token-counter.ts`** - Token counting utilities
3. **`app/api/admin/rate-limits/route.ts`** - Admin controls
4. **`components/UsageQuota.tsx`** - Quota display component
5. **`app/dashboard/usage/page.tsx`** - Usage dashboard

### Files to Modify
1. **All API routes** - Add rate limit middleware
2. **`supabase/schema.sql`** - Add user tier column
3. **`app/dashboard/page.tsx`** - Add usage quota display
4. **`middleware.ts`** - Add rate limiting check

### Environment Variables
```bash
COGNIGATE_API_KEY=your_api_key
COGNIGATE_PROJECT_ID=your_project_id
COGNIGATE_ENVIRONMENT=production
```

### Database Schema Updates
```sql
-- Add tier to profiles
ALTER TABLE profiles ADD COLUMN tier VARCHAR(20) DEFAULT 'free';

-- Create rate limit tracking table (optional, Cognigate handles this)
CREATE TABLE usage_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  messages_count INTEGER DEFAULT 0,
  tokens_count BIGINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Index for fast lookups
CREATE INDEX idx_usage_tracking_user_date ON usage_tracking(user_id, date);
```

### Rate Limit Middleware Implementation

**`lib/rate-limit.ts`:**
```typescript
import { Cognigate } from '@cognigate/sdk';
import { NextRequest, NextResponse } from 'next/server';

const cognigate = new Cognigate({
  apiKey: process.env.COGNIGATE_API_KEY!,
  projectId: process.env.COGNIGATE_PROJECT_ID!,
});

export async function rateLimit(
  req: NextRequest,
  userId: string,
  tier: string,
  operation: 'chat' | 'api'
) {
  try {
    const result = await cognigate.checkLimit({
      userId,
      tier,
      operation,
      tokens: operation === 'chat' ? estimateTokens(req) : undefined,
    });

    if (!result.allowed) {
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Rate limit exceeded. Please upgrade your plan or try again later.',
            details: {
              limit: result.limit,
              remaining: 0,
              resetAt: result.resetAt,
              tier,
            },
          },
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': result.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': result.resetAt.toString(),
            'Retry-After': result.retryAfter.toString(),
          },
        }
      );
    }

    // Add rate limit headers to successful responses
    return {
      headers: {
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.resetAt.toString(),
        'X-RateLimit-Tier': tier,
      },
    };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Fail open - allow request if rate limit service is down
    return null;
  }
}

function estimateTokens(req: NextRequest): number {
  // Rough estimation: 4 chars per token
  // More accurate with Cognigate's token counter
  const body = req.body;
  return Math.ceil(JSON.stringify(body).length / 4);
}
```

### Example API Route Integration

**`app/api/chat/route.ts` (modified):**
```typescript
export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user tier
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', session.user.id)
      .single();

    // Check rate limit
    const rateLimitResult = await rateLimit(
      req,
      session.user.id,
      profile?.tier || 'free',
      'chat'
    );

    if (rateLimitResult instanceof NextResponse) {
      return rateLimitResult; // Rate limit exceeded
    }

    // ... existing chat logic ...

    // Add rate limit headers to response
    return new NextResponse(stream, {
      headers: {
        ...rateLimitResult?.headers,
        'Content-Type': 'text/event-stream',
      },
    });
  } catch (error) {
    // ... error handling ...
  }
}
```

## Implementation Phases

**Phase 1: Cognigate Setup**
- Sign up and configure account
- Install SDK
- Set up tier definitions

**Phase 2: Middleware Development**
- Create rate limit middleware
- Implement token counting
- Add header injection

**Phase 3: API Integration**
- Apply middleware to all endpoints
- Add tier column to database
- Update existing routes

**Phase 4: User Interface**
- Build usage quota component
- Add to dashboard
- Implement upgrade prompts

**Phase 5: Admin Tools**
- Create admin endpoints
- Build usage analytics view
- Implement manual controls

## Dependencies
- Cognigate.dev account and subscription
- Story 003 (Error Handling) for consistent error responses

## Testing Notes
- Test each tier's limits
- Verify token counting accuracy
- Test burst limits
- Simulate rate limit exceeded scenarios
- Performance: Ensure minimal latency impact (<50ms)
- Test fail-open behavior when Cognigate is down
- Load testing: Verify rate limiting under high concurrency

## Cost Considerations
- Cognigate pricing: ~$50-200/month depending on usage
- Alternative: Upstash already in dependencies (simpler, request-based only)
- Consider hybrid: Upstash for simple endpoints, Cognigate for AI endpoints

## Fallback Plan
If Cognigate integration is delayed, use existing Upstash:
```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'),
});
```

## Definition of Done
- [ ] Cognigate integration complete
- [ ] All API endpoints protected
- [ ] Token-based limiting for chat
- [ ] User quota display working
- [ ] Admin controls implemented
- [ ] Error messages user-friendly
- [ ] Code reviewed
- [ ] Load tested
- [ ] Documentation updated
- [ ] Usage analytics dashboard live

## Future Enhancements
- Dynamic rate limiting based on system load
- User-specific rate limit customization
- Credit system for occasional overages
- Real-time usage notifications
- Predictive quota alerts (ML-based)
