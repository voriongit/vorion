# Epic Technical Specification: Marketplace & Acquisition

Date: 2025-12-03
Author: frank the tank
Epic ID: 6
Status: Draft

---

## Overview

Epic 6 implements the two-sided marketplace where Trainers publish agents and Consumers acquire them. This is the commercial engine of AgentAnchor, enabling the commission-based revenue model.

## Stories

| Story | Title | Focus |
|-------|-------|-------|
| 6-1 | Agent Publishing | Trainers list agents for sale |
| 6-2 | Marketplace Browse & Search | Consumers discover agents |
| 6-3 | Agent Profile & Observer Reports | Detailed agent pages |
| 6-4 | Agent Acquisition (Commission) | Purchase/rental flow |
| 6-5 | Consumer Feedback | Ratings and reviews |
| 6-6 | Earnings Dashboard & Payouts | Trainer revenue tracking |

## Key Data Models

```sql
CREATE TABLE marketplace_listings (
  id UUID PRIMARY KEY,
  agent_id UUID REFERENCES bots(id),
  trainer_id UUID REFERENCES users(id),
  title VARCHAR(255),
  description TEXT,
  category VARCHAR(100),
  tags TEXT[],
  commission_rate DECIMAL(5,2),
  base_rate DECIMAL(10,4),
  status VARCHAR(20) DEFAULT 'active',
  total_acquisitions INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE acquisitions (
  id UUID PRIMARY KEY,
  listing_id UUID REFERENCES marketplace_listings(id),
  consumer_id UUID REFERENCES users(id),
  agent_id UUID REFERENCES bots(id),
  acquisition_type VARCHAR(20), -- 'commission', 'clone', 'enterprise'
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reviews (
  id UUID PRIMARY KEY,
  listing_id UUID REFERENCES marketplace_listings(id),
  consumer_id UUID REFERENCES users(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Architecture Notes

- Marketplace is public browse, auth required for acquisition
- Commission model: Platform takes 15%/10%/7% based on tier
- Trust Score prominently displayed on all listings
- Observer reports linked from agent profile
