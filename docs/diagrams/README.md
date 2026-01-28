# Vorion Project Diagrams

Comprehensive diagram collection explaining the Vorion ecosystem for all audiences.

## Quick Navigation

| Audience | Start Here |
|----------|------------|
| **Executives / C-Suite** | [Ecosystem Overview](./executive/01-vorion-ecosystem-overview.md) |
| **Investors** | [Value Creation Flow](./executive/02-value-creation-flow.md) |
| **Risk Officers** | [Risk Mitigation](./executive/03-risk-mitigation.md) |
| **Engineers / Architects** | [System Architecture](./technical/01-system-architecture.md) |
| **API Integrators** | [API Contracts](./technical/03-api-contracts.md) |
| **Sales Teams** | [Value Proposition](./sales-marketing/01-value-proposition.md) |
| **New Users** | [What is Vorion?](./educational/01-what-is-vorion.md) |
| **Compliance Officers** | [Audit Trails](./compliance/01-audit-trails.md) |
| **Product Teams** | [Aurais Tiers](./product/01-aurais-tiers.md) |
| **Agent Developers** | [Certification Flow](./product/02-certification-flow.md) |

---

## Vorion Ecosystem at a Glance

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              VORION                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  OPEN STANDARD           BACKEND                 FRONTEND               │
│                                                                         │
│  ┌─────────────┐        ┌─────────────┐        ┌─────────────┐         │
│  │   BASIS     │        │ AgentAnchor │        │ Aurais Core │         │
│  │ basis.      │◄───────│ Trust +     │◄───────│ Individual  │         │
│  │ vorion.org  │        │ Certify     │        │             │         │
│  └─────────────┘        ├─────────────┤        ├─────────────┤         │
│        │                │   Kaizen    │        │ Aurais Pro  │         │
│        │                │ Execution   │◄───────│ Teams       │         │
│        └───────────────►│ Integrity   │        │             │         │
│                         ├─────────────┤        ├─────────────┤         │
│                         │  Cognigate  │        │ Aurais Exec │         │
│                         │  Runtime    │◄───────│ Enterprise  │         │
│                         └─────────────┘        └─────────────┘         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
docs/diagrams/
├── README.md                          # This file
├── executive/                         # C-Suite, Board, Investors
│   ├── 01-vorion-ecosystem-overview.md
│   ├── 02-value-creation-flow.md
│   └── 03-risk-mitigation.md
├── technical/                         # Engineers, Architects
│   ├── 01-system-architecture.md
│   ├── 02-data-flows.md
│   └── 03-api-contracts.md
├── sales-marketing/                   # Sales, Marketing, Partners
│   └── 01-value-proposition.md
├── educational/                       # New Users, Non-Technical
│   ├── 01-what-is-vorion.md
│   └── 02-how-trust-works.md
├── compliance/                        # Auditors, Legal, Compliance
│   └── 01-audit-trails.md
└── product/                           # Product Teams, Customers
    ├── 01-aurais-tiers.md
    └── 02-certification-flow.md
```

---

## Diagram Types Used

| Type | Purpose | Example |
|------|---------|---------|
| **Flowchart** | Process flows, decision trees | Agent request flow |
| **Sequence** | API interactions, temporal flows | Trust score lookup |
| **State** | Status transitions | Certification states |
| **Mindmap** | Concept relationships | Compliance coverage |
| **Timeline** | Chronological events | Trust journey |
| **ERD** | Data relationships | Database schema |
| **Quadrant** | Positioning analysis | Market positioning |
| **Sankey** | Value/flow volumes | Revenue streams |
| **XY Chart** | Metrics visualization | Trust decay curve |
| **Block** | Dashboard layouts | KPI displays |

---

## How to Use These Diagrams

### For Presentations
- Export Mermaid diagrams using tools like [Mermaid Live Editor](https://mermaid.live)
- Copy SVG/PNG for slide decks
- Customize colors for brand alignment

### For Documentation
- Embed directly in Markdown (GitHub renders Mermaid)
- Include in Notion, Confluence, or similar tools
- Reference in technical specs

### For Development
- Use as implementation guides
- Reference data flows for debugging
- Validate against API contracts

---

## Key Concepts Across Diagrams

### The Four-Layer Kaizen Stack
1. **BASIS (Layer 1)**: Validate agent manifests against open standard
2. **INTENT (Layer 2)**: Declare actions before execution
3. **ENFORCE (Layer 3)**: Runtime boundary checking
4. **PROOF (Layer 4)**: Cryptographic attestation

### Trust Tiers (0-1000 Score)
| Tier | Score | Name | Access Level |
|------|-------|------|--------------|
| T0 | 0-99 | Sandbox | Testing only |
| T1 | 100-299 | Provisional | Read public |
| T2 | 300-499 | Standard | Normal ops |
| T3 | 500-699 | Trusted | External APIs |
| T4 | 700-899 | Certified | Financial |
| T5 | 900-1000 | Autonomous | Full access |

### Certification Levels
| Level | Badge | Requirements |
|-------|-------|--------------|
| Registered | ○ | Valid manifest, identity |
| Verified | ◐ | 1000+ events, no violations |
| Certified | ● | Full audit passed |
| Certified+ | ★ | Enterprise audit, SOC2 |

### Product Tiers
| Product | Target | Key Features |
|---------|--------|--------------|
| Aurais Core | Individual/SMB | 5 agents, basic workflows |
| Aurais Pro | Teams | 50 agents, custom workflows |
| Aurais Exec | Enterprise | Unlimited, compliance, policies |

---

## Updating These Diagrams

1. **Edit the Markdown files** directly
2. **Mermaid syntax** - see [Mermaid Documentation](https://mermaid.js.org/intro/)
3. **Test rendering** in GitHub preview or Mermaid Live Editor
4. **Commit changes** with descriptive message

---

## Related Resources

- [BASIS Specification](https://basis.vorion.org)
- [AgentAnchor API](https://agentanchor.com/developers)
- [Cognigate Runtime](https://cognigate.dev/docs)
- [Aurais Products](https://aurais.ai)
- [Developer Documentation](https://docs.vorion.org)
