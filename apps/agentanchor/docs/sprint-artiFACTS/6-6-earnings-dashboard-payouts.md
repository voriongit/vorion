# Story 6-6: Earnings Dashboard & Payouts

**Epic:** 6 - Marketplace & Acquisition
**Status:** Drafted
**Created:** 2025-12-03

---

## User Story

**As a** trainer
**I want** to view my earnings and payout history
**So that** I can track my revenue from agent acquisitions

---

## Acceptance Criteria

- [ ] `earnings` and `payouts` tables for financial tracking
- [ ] Earnings dashboard at `/dashboard/trainer/earnings`
- [ ] Total earnings (lifetime, this month, pending)
- [ ] Earnings by agent breakdown
- [ ] Transaction history with filters
- [ ] Payout request functionality
- [ ] Payout status tracking
- [ ] Commission rate display per agent

---

## Technical Notes

### Database Schema

```sql
CREATE TABLE earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID REFERENCES users(id),
  agent_id UUID REFERENCES bots(id),
  acquisition_id UUID REFERENCES acquisitions(id),
  gross_amount DECIMAL(12,2) NOT NULL,
  commission_rate DECIMAL(5,2) NOT NULL,
  platform_fee DECIMAL(12,2) NOT NULL,
  net_amount DECIMAL(12,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, cleared, paid
  cleared_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID REFERENCES users(id),
  amount DECIMAL(12,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
  payout_method VARCHAR(50), -- 'bank_transfer', 'paypal', etc.
  payout_reference VARCHAR(255),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_earnings_trainer ON earnings(trainer_id);
CREATE INDEX idx_payouts_trainer ON payouts(trainer_id);
```

### Dashboard Sections

```
/dashboard/trainer/earnings/page.tsx
├── Summary Cards
│   ├── Lifetime earnings
│   ├── This month
│   ├── Pending (uncleared)
│   └── Available for payout
├── Earnings by Agent Chart
├── Transaction History Table
│   ├── Date filter
│   ├── Agent filter
│   └── Status filter
├── Payout Section
│   ├── Request payout button
│   └── Payout history
└── Commission Rates Info
```

### Earnings Calculation

```typescript
function calculateEarnings(acquisition: Acquisition): Earnings {
  const grossAmount = acquisition.usageFee;
  const commissionRate = getCommissionRate(acquisition.listing.trustTier);
  const platformFee = grossAmount * (commissionRate / 100);
  const netAmount = grossAmount - platformFee;

  return {
    grossAmount,
    commissionRate,
    platformFee,
    netAmount
  };
}
```

### Files to Create/Modify

- `lib/db/schema/earnings.ts` - Schema definitions
- `lib/marketplace/earnings-service.ts` - Earnings logic
- `app/(dashboard)/trainer/earnings/page.tsx` - Dashboard
- `components/trainer/EarningsSummary.tsx` - Summary cards
- `components/trainer/EarningsChart.tsx` - Agent breakdown
- `components/trainer/TransactionHistory.tsx` - Transaction table
- `components/trainer/PayoutRequest.tsx` - Payout form
- `app/api/trainer/earnings/route.ts` - Earnings API
- `app/api/trainer/payouts/route.ts` - Payouts API

---

## Dependencies

- Story 6-4: Agent Acquisition (source of earnings)
- Story 6-1: Agent Publishing (commission rates)

---

## Out of Scope

- Actual payment processing (MVP tracks, doesn't process)
- Tax reporting
- Currency conversion
- Payout scheduling
