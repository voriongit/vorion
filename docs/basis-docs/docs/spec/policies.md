---
sidebar_position: 5
title: Policies
description: Policy language and engine requirements
---

# Policy Engine

## Policy Format

```yaml
policy:
  id: pol_example
  version: 1
  description: "Example policy"
  
  applies_to:
    capabilities: [capability_name]
    
  conditions:
    - field: field_name
      operator: eq|neq|gt|gte|lt|lte|in|nin
      value: value
      
  actions:
    on_match: allow|deny|escalate
    on_violation: deny|escalate
```

## Operators

| Operator | Meaning |
|----------|---------|
| `eq` | Equals |
| `neq` | Not equals |
| `gt` | Greater than |
| `gte` | Greater than or equal |
| `lt` | Less than |
| `lte` | Less than or equal |
| `in` | In list |
| `nin` | Not in list |

## Requirements

**REQ-POL-001**: Policies MUST be declarative.

**REQ-POL-002**: Policy evaluation MUST be deterministic.

**REQ-POL-003**: Policies MUST be versioned.
