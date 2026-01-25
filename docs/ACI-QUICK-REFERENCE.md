# ACI Standards Quick Reference
**One-Page Summary for Developers, Architects, and Decision-Makers**

---

## The Essence: ACI in 60 Seconds

**ACI** (Agent Classification Identifier) is a standardized way to identify and trust AI agents.

**Format**:
```
[Registry].[Org].[AgentClass]:[Domains]-L[Level]-T[Tier]@[Version]
```

**Example**: `a3i.vorion.banquet-advisor:FHC-L3-T2@1.2.0`

**What it means**: "This is Vorion's banquet advisor agent. It can handle Finance, Helpdesk, and Communications. It can Execute (L3) pending approval. It's been Tested (T2)."

---

## Core Components at a Glance

### Domains (What can it do?)
- **F** = Finance
- **H** = Helpdesk  
- **C** = Communications
- **E** = External APIs
- **I** = Infrastructure
- **S** = Security

### Autonomy Levels (How much freedom?)
| Level | Name | Approval | Use Case |
|-------|------|----------|----------|
| L0 | Observe | Every action | Analysis only |
| L1 | Advise | Every action | Recommendations |
| L2 | Draft | Before commit | Staged prep |
| L3 | Execute | Periodic | Daily operations |
| L4 | Autonomous | Exception-based | Critical systems |
| L5 | Sovereign | Audit-only | Mission-critical |

### Trust Tiers (How much do we trust it?)
| Tier | Status | Means | Evidence |
|------|--------|-------|----------|
| T0 | Unverified | No audit | None |
| T1 | Registered | ID only | DID proof |
| T2 | Tested | Tests pass | Automated |
| T3 | Certified | Manual audit | Expert review |
| T4 | Verified | Continuous | Monitoring |
| T5 | Sovereign | Maximum | Formal proof |

---

## Vorion: The First Implementation

**Vorion** is an enterprise AI governance platform that **uses ACI** to classify and control agents.

### Vorion's Addition: Dynamic Trust Scoring

```
Trust Score = (Certification × 0.3) + (Behavior × 0.4) + (Context × 0.3)

Score ≥ 0.7 → Approve execution
Score < 0.7 → Require manual approval
```

### How They Work Together

```
ACI says:     "This agent is T2-Tested"
Vorion says:  "Today it has a trust score of 0.65"
Result:       "Approve at L2-Draft (constrained)"
```

**Key Formula**:
```
Effective Autonomy = MIN(ACI_Certification, Vorion_Runtime_Score)
```

---

## Security: Three Key Protections

### 1. DPoP (Token Can't Be Stolen)
- Sender-constrained tokens
- Proves agent holds private key
- Expires in 5-15 minutes

### 2. TEE Binding (Code Runs in Secure Hardware)
- For T4+ agents
- Cryptographic proof of enclave
- Prevents code swapping

### 3. Semantic Governance (Can't Be Tricked)
- Instruction integrity binding
- Output validation against schema
- Prevents prompt injection

---

## Human-Centric Design: The "Ralph Wiggum" Standard

**Problem**: Complex security interfaces fail when used by non-technical humans.

**Solution**: Mistake-proofing borrowed from industrial safety.

### Four Key Patterns

1. **Petname System**
   - Not: `did:key:z6Mkha...`
   - But: "My Finance Bot"
   - User assigns local name → prevents spoofing

2. **Traffic Light Status**
   - 🟢 GREEN: Safe (read-only)
   - 🟡 AMBER: Draft (needs approval)
   - 🔴 RED: Danger (manual confirmation)

3. **AI Nutrition Label**
   ```
   📍 Purpose: Helps plan events
   ⚙️ Can: Access calendar, search web
   ✗ Cannot: Spend money, delete files
   ⚠️ Limitation: May suggest outdated info
   ```

4. **Just-in-Time Permissions**
   - Not: "Allow INTERNET?" at install
   - But: "Can I search flights online?" when needed
   - User approval in context

---

## The Complete Ecosystem

```
┌─────────────────────────────────────────────────────────────┐
│ DISCOVERY: Find agents by capability                        │
│ Registry API: /agents?domains=F&min_tier=2&min_level=3      │
├─────────────────────────────────────────────────────────────┤
│ VERIFICATION: Check trust status                            │
│ Trust Query: /agents/{aci}/trust-score                      │
├─────────────────────────────────────────────────────────────┤
│ INVOCATION: Run agent with governance                       │
│ Vorion: Execute with Certification + Behavior check        │
├─────────────────────────────────────────────────────────────┤
│ AUDIT: Immutable proof chain                                │
│ Proof: What happened, who approved, why                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Compliance Alignment

| Standard | Coverage |
|----------|----------|
| **EU AI Act** | Risk-based tiers (T0-T2: minimal, T3+: regulated) |
| **ISO 42001** | Agent capability declaration, audit trail, monitoring |
| **OWASP Top 10** | DPoP + semantic governance mitigate 8/10 risks |
| **NIST AI RMF** | Supports all 6 functions (govern, map, measure, manage) |

---

## Quick Decisions Flowchart

```
Want to use an AI agent?
│
├─ Find agent by capability
│  └─ Registry API search
│
├─ Check its certification
│  └─ ACI tier T2+ recommended
│
├─ Check current trust score
│  └─ Vorion scoring (behavior + context)
│
├─ Determine autonomy level needed
│  └─ L0-L2: Read-only safe
│     L3: Execute with oversight
│     L4+: Critical systems only
│
├─ Review permissions
│  └─ Petname system, nutrition label
│
└─ Execute with appropriate oversight
   └─ L3+ require approval checkpoints
```

---

## For Different Roles

### 👨‍💼 Decision-Maker
- ACI = standardized way to evaluate AI trustworthiness
- Vorion = example of ACI in production
- Benefit: Objective criteria for adoption

### 👨‍💻 Developer
- ACI format enables agent interoperability
- @aci/spec npm package for parsing
- Reference code in TypeScript
- Extensions for custom logic

### 🔒 Security Officer
- DPoP + TEE binding + semantic governance
- Audit trail via proof chains
- Compliance mappings (EU AI Act, ISO, NIST)
- Quantum-safe migration plan

### 📊 Architect
- Three-layer design (identity, capability, governance)
- Extension protocol for custom engines
- Semantic versioning for compatibility
- Scalable registry (1000+ agents)

---

## Implementation Roadmap

| Timeline | Milestone |
|----------|-----------|
| **Now** | Core spec published, Vorion using it |
| **Q2 2026** | OpenID Foundation, W3C submission |
| **Q3 2026** | Reference implementations (Python, Go, Rust) |
| **Q4 2026** | Enterprise registries (AWS, Azure, GCP) |
| **2027** | Quantum-safe transition, federation |

---

## Common Questions

**Q: Is ACI mandatory?**  
A: No. It's an open standard. You can use it or build your own. Like JSON vs XML.

**Q: Does every agent need certification?**  
A: No. T0 (unverified) is allowed but less trustworthy. Higher tiers require audit.

**Q: How often do agents get re-certified?**  
A: ACI is static (version-based). Vorion updates trust scores dynamically (daily/hourly).

**Q: What if an agent behaves badly?**  
A: Vorion reduces trust score immediately. Severity→revocation (1 second for T4+).

**Q: Is this only for enterprise?**  
A: No. Works for consumer agents too. Vorion example shows governance at scale.

**Q: When will ACI be "done"?**  
A: Foundation v1.1.0 is production-ready now. Extensions and refinements continue.

---

## Next Steps

### To Use ACI
1. Choose an agent
2. Check its ACI string (e.g., `a3i.vorion.banquet-advisor:FHC-L3-T2@1.2.0`)
3. Verify tier matches your risk tolerance
4. Review permissions (nutrition label)
5. Invoke with appropriate autonomy level

### To Build with ACI
1. Install: `npm install @aci/spec`
2. Parse ACI strings: `parseACI(aci_string)`
3. Query registry: `registry.search(domains=F, min_tier=2)`
4. Implement governance hooks (preCheck, postAction)
5. Generate immutable proof chain

### To Contribute
1. Read full spec: [ACI-STANDARDS-CONSOLIDATED.md](../docs/ACI-STANDARDS-CONSOLIDATED.md)
2. Review security analysis: [ACI-REVIEW-SUMMARY.md](../docs/ACI-REVIEW-SUMMARY.md)
3. Fork repo, submit RFC
4. Join working group

---

## Resources

| Resource | Link |
|----------|------|
| **Full Spec** | docs/ACI-STANDARDS-CONSOLIDATED.md |
| **Review & Analysis** | docs/ACI-REVIEW-SUMMARY.md |
| **Vorion Code** | /Vorion directory |
| **TypeScript Lib** | @aci/spec (npm) |
| **Registry API** | https://registry.aci-spec.org |
| **Working Group** | https://aci-spec.org/community |

---

## The Bottom Line

**ACI = "Passport for AI Agents"**

- **Standardized identity**: Everyone speaks the same language
- **Objective certification**: Trust based on evidence, not reputation
- **Graduated autonomy**: Give agents more freedom as they prove trustworthy
- **Human-safe**: Designed for regular people, not just engineers
- **Industry-ready**: Vorion proves it works at scale

**Start using it today. Help shape it tomorrow.**

---

**Quick Reference v1.0** | January 2026 | [Full Documentation](ACI-STANDARDS-CONSOLIDATED.md)
