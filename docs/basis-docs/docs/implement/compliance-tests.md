---
sidebar_position: 2
title: Compliance Tests
description: Validate your implementation
---

# Compliance Tests

## Overview

The BASIS compliance test suite validates your implementation against the specification.

## Installation

```bash
npm install -g @basis-protocol/compliance-tests
```

## Running Tests

```bash
basis-test --target http://localhost:8000

# Output:
✓ INTENT layer: 12/12 tests passed
✓ ENFORCE layer: 18/18 tests passed
✓ PROOF layer: 15/15 tests passed
✓ CHAIN layer: 8/8 tests passed

Score: 100/100
```

## Test Categories

### INTENT Tests
- Intent ID generation
- Capability detection
- Risk classification
- Schema compliance

### ENFORCE Tests
- Trust verification
- Capability gating
- Policy evaluation
- Rate limiting
- Escalation handling

### PROOF Tests
- Record creation
- Hash chaining
- Signature verification
- Query functionality

### CHAIN Tests
- Anchor submission
- Merkle proof generation
- On-chain verification

## Certification Levels

| Score | Level |
|-------|-------|
| 95-100 | Platinum |
| 85-94 | Gold |
| 70-84 | Silver |
| 50-69 | Bronze |
| Below 50 | Not compliant |
