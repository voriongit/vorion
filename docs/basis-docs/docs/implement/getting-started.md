---
sidebar_position: 1
title: Getting Started
description: Build your first BASIS-compliant agent
---

# Getting Started

## Overview

This guide walks you through implementing BASIS governance for your AI agent.

## Option 1: Use Cognigate (Recommended)

The fastest path is using the reference implementation:

```bash
git clone https://github.com/voriongit/cognigate.git
cd cognigate
docker-compose up -d
```

Your agent calls Cognigate's API before any action:

```typescript
// Before any agent action
const gate = await fetch('http://localhost:8000/v1/enforce/gate', {
  method: 'POST',
  body: JSON.stringify({
    agentId: 'ag_your_agent',
    intentId: intent.id,
    requestedCapabilities: ['data/read_user']
  })
});

const decision = await gate.json();

if (decision.decision === 'ALLOW') {
  // Proceed with action
} else {
  // Handle denial
}
```

## Option 2: Build Your Own

Implement the four layers:

### 1. INTENT Layer

Parse agent requests into structured intents:

```typescript
interface Intent {
  intentId: string;
  action: string;
  capabilities: string[];
  risk: 'minimal' | 'limited' | 'significant' | 'high';
}
```

### 2. ENFORCE Layer

Check trust and policies:

```typescript
async function gate(intent: Intent): Promise<Decision> {
  const trust = await getTrustScore(intent.agentId);
  
  for (const cap of intent.capabilities) {
    if (trust.composite < THRESHOLDS[cap]) {
      return { decision: 'DENY', reason: 'Insufficient trust' };
    }
  }
  
  return { decision: 'ALLOW' };
}
```

### 3. PROOF Layer

Log all decisions:

```typescript
async function logProof(decision: Decision): Promise<ProofRecord> {
  const record = {
    proofId: generateId(),
    hash: sha256(decision),
    previousHash: getLastHash(),
    data: decision
  };
  
  await store(record);
  return record;
}
```

### 4. CHAIN Layer

Anchor high-risk decisions:

```typescript
async function anchor(proof: ProofRecord): Promise<void> {
  if (proof.data.risk === 'high') {
    await contract.anchorProof(proof.hash);
  }
}
```

## Validate Compliance

Run the test suite:

```bash
npx @basis-protocol/compliance-tests --target http://localhost:8000
```

## Next Steps

- [Compliance Tests](/implement/compliance-tests)
- [Get Certified](/implement/certification)
