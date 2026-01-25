# ACI Documentation Bundle - Master Index

**Agent Classification Identifier (ACI) Specification**  
**Bundle Version:** 1.0.0  
**Created:** January 24, 2026  
**Author:** AgentAnchor (A3I)

---

## Overview

This bundle contains the complete Agent Classification Identifier (ACI) specification, including core definitions, integration specifications, reference implementations, and security guidance.

---

## Document Inventory

### Core Specifications

| Document | Path | Description |
|----------|------|-------------|
| **README** | `README.md` | Overview, quick start, architecture |
| **Core Specification** | `specs/aci-core.md` | Format, encoding, validation rules |
| **Extension Protocol** | `specs/aci-extensions.md` | Layer 4 extension system |
| **Security Hardening** | `specs/aci-security-hardening.md` | DPoP, TEE, pairwise DIDs |
| **Semantic Governance** | `specs/aci-semantic-governance.md` | Layer 5: Intent validation |
| **DID Method** | `specs/did-aci-method.md` | `did:aci:` method specification |
| **OpenID Claims** | `specs/openid-aci-claims.md` | JWT/OIDC integration |
| **Registry API** | `specs/registry-api.md` | Agent discovery and query API |

### Security & Guidance

| Document | Path | Description |
|----------|------|-------------|
| **OWASP Cheatsheet** | `docs/owasp-aci-cheatsheet.md` | Risk mitigation guidance |
| **Framework Analysis** | `docs/FRAMEWORK_ANALYSIS.md` | Competitive positioning |
| **Security Audit Response** | `docs/SECURITY_AUDIT_RESPONSE.md` | Gap analysis and remediation |

### Reference Implementation

| Document | Path | Description |
|----------|------|-------------|
| **Main Exports** | `src/index.ts` | Package entry point |
| **TypeScript Types** | `src/types.ts` | Core + semantic governance types |
| **Security Module** | `src/security/index.ts` | Extension protocol types |
| **JSON-LD Vocabulary** | `vocab/aci-vocab.jsonld` | Linked data vocabulary |

---

## ACI Format Quick Reference

```
[Registry].[Org].[AgentClass]:[Domains]-L[Level]-T[Tier]@[Version]
```

**Example:** `a3i.vorion.banquet-advisor:FHC-L3-T2@1.2.0`

### Domain Codes

| Code | Domain | Bitmask |
|------|--------|---------|
| A | Administration | 0x001 |
| B | Business | 0x002 |
| C | Communications | 0x004 |
| D | Data | 0x008 |
| E | External | 0x010 |
| F | Finance | 0x020 |
| G | Governance | 0x040 |
| H | Hospitality | 0x080 |
| I | Infrastructure | 0x100 |
| S | Security | 0x200 |

### Capability Levels

| Level | Name | Description |
|-------|------|-------------|
| L0 | Observe | Read-only |
| L1 | Advise | Suggest/recommend |
| L2 | Draft | Prepare changes |
| L3 | Execute | Act with approval |
| L4 | Autonomous | Self-directed |
| L5 | Sovereign | Full autonomy |

### Trust Tiers

| Tier | Name | Score Range |
|------|------|-------------|
| T0 | Unverified | 0-99 |
| T1 | Registered | 100-299 |
| T2 | Tested | 300-499 |
| T3 | Certified | 500-699 |
| T4 | Verified | 700-899 |
| T5 | Sovereign | 900-1000 |

---

## Directory Structure

```
aci-bundle/
├── MASTER_INDEX.md              # This file
├── README.md                    # Main documentation
├── package.json                 # npm package config
├── tsconfig.json                # TypeScript config
├── LICENSE                      # Apache 2.0
├── .gitignore                   # Git ignore rules
├── specs/
│   ├── aci-core.md              # Core specification
│   ├── aci-extensions.md        # Extension protocol (Layer 4)
│   ├── did-aci-method.md        # DID method spec
│   ├── openid-aci-claims.md     # OpenID claims extension
│   └── registry-api.md          # Registry API spec
├── docs/
│   ├── owasp-aci-cheatsheet.md  # Security guidance
│   └── FRAMEWORK_ANALYSIS.md    # Competitive analysis
├── src/
│   ├── index.ts                 # Main exports
│   ├── types.ts                 # Core type definitions
│   └── security/
│       └── index.ts             # Extension protocol types
├── vocab/
│   └── aci-vocab.jsonld         # JSON-LD vocabulary
└── examples/
    └── (usage examples)
```

---

## Integration Points

### 1. DID Resolution

```
did:aci:a3i:vorion:banquet-advisor
    └── Resolves to DID Document with aciCapabilities
```

### 2. OpenID Connect

```json
{
  "aci": "a3i.vorion.banquet-advisor:FHC-L3-T2@1.2.0",
  "aci_domains": 164,
  "aci_level": 3,
  "aci_trust": 2
}
```

### 3. Registry Query

```http
POST /agents/query
{
  "domains": ["F", "H"],
  "minLevel": 3,
  "minTrust": 2
}
```

---

## Related Projects

| Project | Repository | Description |
|---------|------------|-------------|
| **ACDR Security Layer** | `voriongit/aci-spec` | Security hardening (47 attack vectors) |
| **Cognigate** | `voriongit/cognigate` | Governance runtime |
| **TrustBot** | `voriongit/trustbot` | BASIS reference implementation |

---

## Standards Alignment

| Standard | Alignment |
|----------|-----------|
| W3C DID Core | `did:aci:` method |
| OpenID Connect | Custom claims extension |
| OAuth 2.0 | Scope-based authorization |
| JSON-LD | Linked data vocabulary |
| OWASP LLM Top 10 | Risk mitigation mapping |

---

## Governance Roadmap

1. ✅ Core specification complete
2. ✅ TypeScript reference implementation
3. ✅ Security layer (ACDR)
4. 🔄 OpenID Foundation submission
5. 🔄 OWASP Cheat Sheet proposal
6. 📋 W3C CCG engagement
7. 📋 Regional registry federation

---

## Usage

### Installation (npm)

```bash
npm install @agentanchor/aci-spec
```

### Basic Usage

```typescript
import { parseACI, validateACI, satisfiesRequirements } from '@agentanchor/aci-spec';

const parsed = parseACI('a3i.vorion.banquet-advisor:FHC-L3-T2@1.2.0');
console.log(parsed.domains);  // ['F', 'H', 'C']
console.log(parsed.level);    // 3
console.log(parsed.trustTier); // 2
```

### Push to GitHub

```bash
unzip aci-docs-bundle.zip
cd aci-bundle
git init
git add .
git commit -m "feat: ACI specification v1.0.0"
git remote add origin git@github.com:voriongit/aci-spec.git
git push -u origin main
```

---

## License

Apache License 2.0

---

## Contact

- **Specification:** https://aci.agentanchor.io
- **Registry:** https://registry.agentanchor.io
- **Email:** spec@agentanchor.io
- **GitHub:** https://github.com/voriongit/aci-spec

---

*AgentAnchor (A3I) — Building trust infrastructure for AI agents*
