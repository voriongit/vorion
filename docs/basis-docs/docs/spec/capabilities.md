---
sidebar_position: 2
title: Capabilities
description: Capability taxonomy and requirements
---

# Capability Framework

## Taxonomy

BASIS defines a hierarchical capability taxonomy:

```
capabilities/
├── data/
│   ├── read_public
│   ├── read_user
│   ├── read_sensitive
│   ├── write_user
│   ├── write_system
│   ├── delete
│   └── export
│
├── communication/
│   ├── generate_text
│   ├── send_internal
│   ├── send_external
│   └── publish
│
├── execution/
│   ├── compute
│   ├── schedule
│   ├── invoke_api
│   └── spawn_agent
│
├── financial/
│   ├── view_balance
│   ├── initiate_payment
│   ├── approve_payment
│   └── transfer_funds
│
└── administrative/
    ├── manage_users
    ├── manage_permissions
    └── configure_system
```

## Requirements

**REQ-CAP-001**: Agents MUST declare all capabilities they may exercise.

**REQ-CAP-002**: Agents MUST NOT exercise undeclared capabilities.

**REQ-CAP-003**: Capability declarations MUST be specific, not wildcard.

## Trust Thresholds

| Capability | Minimum Trust |
|------------|---------------|
| `data/read_public` | 100 |
| `data/read_user` | 300 |
| `communication/send_internal` | 300 |
| `communication/send_external` | 500 |
| `data/read_sensitive` | 700 |
| `financial/approve_payment` | 700 |
| `execution/spawn_agent` | 900 |
