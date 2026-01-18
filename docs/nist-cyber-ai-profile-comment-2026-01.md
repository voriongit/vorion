# NIST Cybersecurity Framework Profile for Artificial Intelligence
## Public Comment Submission

**Document:** NIST IR 8596 (Preliminary Draft)
**Submission Date:** January 18, 2026
**Comment Deadline:** January 30, 2026
**Submit To:** cyberaiprofile@nist.gov

---

## Submitter Information

**Organization:** Vorion Risk, LLC
**Contact:** Ryan Cason and Alex Blanc
**Phone:** [ADD DIRECT CONTACT NUMBER]
**Email:** contact@vorion.org
**Website:** https://vorion.org

---

## Executive Summary

Vorion Risk, LLC respectfully submits comments on NIST IR 8596, the Cybersecurity Framework Profile for Artificial Intelligence. We commend NIST's proactive approach to integrating AI-specific risks into the established CSF 2.0 framework.

Our comments focus on operational challenges that organizations face when deploying autonomous AI agents—challenges that intersect with but extend beyond traditional cybersecurity concerns. Specifically, we identify opportunities for the Cyber AI Profile to address:

1. **Resource exhaustion as a security vector** — inefficient AI agents can be exploited for denial-of-service
2. **Graduated trust mechanisms** — binary allow/deny decisions are insufficient for autonomous agents
3. **Cryptographic auditability** — forensic analysis requires tamper-evident decision logs
4. **Sustainability alignment** — emerging regulations (EU AI Act Article 40) will require efficiency reporting

These requirements could be implemented through existing tooling, custom development, or emerging standards. As one example implementation approach, we reference the open-source BASIS (Behavioral Agent Safety and Interoperability Standard) specification, which provides technical patterns that organizations can adapt to their specific needs.

---

## Detailed Comments

### Comment 1: Incorporating Operational Efficiency into "Secure AI Systems"

**Reference:** Cyber AI Profile, AI Focus Area: "Secure AI Systems"; CSF Subcategories: ID.AM-05, PR.PS-05

**Current State:**
The profile appropriately emphasizes securing AI systems against adversarial threats, data poisoning, and model manipulation. However, it does not address the operational efficiency of AI systems as a security-adjacent concern.

**Gap Identified:**
Inefficient AI agents represent a security risk through:

- **Resource exhaustion attacks** — Agents consuming excessive compute can create denial-of-service conditions for critical enterprise functions
- **Cost amplification vulnerabilities** — Adversaries can trigger expensive reasoning modes for low-value tasks, rapidly depleting cloud budgets ("Economic Denial of Service")
- **Sustainability exposure** — Organizations face regulatory and reputational risk from uncontrolled AI energy consumption

**Proposed Addition:**
We recommend the profile include guidance on operational efficiency controls as part of securing AI systems:

> "Organizations should implement resource governance for AI systems, including:
> - Declared resource manifests specifying compute requirements and limits
> - Cost-to-value monitoring that tracks operational efficiency
> - Automatic throttling or degradation when resource consumption exceeds justified thresholds
> - Sustainability metrics aligned with ISO/IEC 21031:2024 (Software Carbon Intensity)"

**Example Implementation Approach:**
Organizations could implement cost-to-value (CTV) monitoring with defined response thresholds. One possible approach uses half-open intervals to ensure unambiguous boundary behavior:

| CTV Ratio | Status | Automated Response |
|-----------|--------|-------------------|
| [0, 1.0) | Excellent | Continue (value exceeds cost) |
| [1.0, 2.0) | Acceptable | Monitor |
| [2.0, 5.0) | Marginal | Alert, suggest optimization |
| [5.0, 10.0) | Poor | Throttle (reduce capacity) |
| [10.0, 20.0) | Unacceptable | Degrade (minimal operations) |
| [20.0, +inf) | Critical | Stop, require human review |

**Implementation Note:** Defining "value" in CTV calculations requires organizational context. Value metrics might include revenue impact, user satisfaction scores, task completion rates, or custom KPIs. Organizations should establish value definitions appropriate to their domain before implementing CTV monitoring.

---

### Comment 2: Quantified Trust Scoring for AI Agent Governance

**Reference:** Cyber AI Profile, mapping to CSF Govern and Manage functions; CSF Subcategories: GV.*, PR.AA-05

**Current State:**
The AI RMF and Cyber AI Profile establish governance structures and risk management processes but do not prescribe specific mechanisms for quantifying AI system trustworthiness at runtime.

**Gap Identified:**
Without quantified trust metrics, organizations cannot implement graduated capability controls. Binary allow/deny decisions are insufficient for agentic AI systems that require nuanced permission management based on demonstrated behavior.

**Proposed Addition:**
We recommend the profile reference quantified trust scoring as a best practice for AI agent governance:

> "For autonomous AI agents, organizations should consider implementing graduated trust mechanisms that:
> - Assign numeric trust scores based on historical behavior and compliance
> - Map trust levels to capability tiers with progressive permission unlocks
> - Apply trust decay for inactive agents to prevent stale high-trust entities
> - Amplify negative impacts from failures to incentivize reliable behavior"

**Example Implementation Approach:**
Organizations could implement a trust scoring system (e.g., 0-1000 scale) with defined capability tiers:

| Tier | Score Range | Example Capabilities |
|------|-------------|---------------------|
| Sandbox | [0, 100) | Isolated testing only |
| Provisional | [100, 300) | Read public data, internal messaging |
| Standard | [300, 500) | Limited external communication |
| Trusted | [500, 700) | External API calls |
| Certified | [700, 900) | Financial transactions |
| Autonomous | [900, 1000] | Full autonomy within policy bounds |

**Trust Score Calculation Example:**
Organizations should define explicit signal impacts. One possible approach:

| Signal Type | Base Impact | Rationale |
|-------------|-------------|-----------|
| task_completed | +5 points | Positive behavioral signal |
| task_failed | -15 points | 3x amplification incentivizes reliability |
| policy_violation | -50 points | Serious compliance breach |
| compliance_check_passed | +2 points | Periodic verification bonus |
| human_endorsement | +25 points | Explicit trust delegation |

**Initial Trust Score:** Entities should initialize at score 0 (Sandbox tier) unless explicitly promoted by an administrator with appropriate authority. This ensures new agents demonstrate trustworthiness before gaining capabilities.

**Trust Decay Considerations:** A 14-day half-life for inactive agents balances security (preventing stale high-trust entities) with operational practicality (allowing for maintenance windows). Organizations may wish to implement a "Maintenance" status that pauses decay during planned downtime, preventing penalization for scheduled maintenance.[3]

[3] Note: The BASIS specification default is 7-day half-life; the 14-day recommendation accommodates enterprise maintenance cycles. Organizations may adjust based on their agent velocity and risk tolerance.

---

### Comment 3: Addressing Agentic AI in "Conduct AI-Enabled Cyber Defense"

**Reference:** Cyber AI Profile, AI Focus Area: "Conduct AI-Enabled Cyber Defense (Defend)"

**Current State:**
The profile addresses using AI for cyber defense but does not specifically address governance of autonomous AI agents that may take defensive actions without human approval.

**Gap Identified:**
AI agents deployed for cyber defense introduce unique risks:

- **Autonomous action scope** — Defensive agents may block legitimate traffic or isolate systems
- **Escalation requirements** — Some defensive actions require human oversight
- **Audit requirements** — Defensive actions must be logged with cryptographic integrity for forensic analysis

**Proposed Addition:**
We recommend explicit guidance for agentic AI in cyber defense contexts:

> "When deploying AI agents for autonomous cyber defense operations, organizations should:
> - Implement capability gating that requires human escalation for high-impact defensive actions
> - Maintain immutable audit trails with cryptographic hash chains for all agent decisions
> - Define clear boundaries between autonomous and human-supervised defensive capabilities
> - Establish governance checkpoints before agents execute defensive actions"

**Example Implementation Approach:**
A layered governance architecture could address these requirements:

```
+---------------------------------------------------------------+
|                    Agent Action Request                        |
+---------------------------------------------------------------+
                              |
                              v
+---------------------------------------------------------------+
|  LAYER 1: INTENT                                               |
|  Parse and classify the requested action                       |
|  Output: Structured intent with risk classification            |
+---------------------------------------------------------------+
                              |
                              v
+---------------------------------------------------------------+
|  LAYER 2: ENFORCE                                              |
|  Evaluate intent against trust score and policies              |
|  Output: ALLOW, DENY, ESCALATE, or DEGRADE                     |
+---------------------------------------------------------------+
                              |
                              v
+---------------------------------------------------------------+
|  LAYER 3: PROOF                                                |
|  Log the decision with cryptographic integrity                 |
|  Output: SHA-256 chained audit record                          |
+---------------------------------------------------------------+
                              |
                              v
+---------------------------------------------------------------+
|                 Action Execution (if ALLOW)                    |
+---------------------------------------------------------------+
```

Governance decisions include: ALLOW, DENY, ESCALATE (require human approval), or DEGRADE (reduced scope).

---

### Comment 4: Efficiency Metrics for AI Sustainability Reporting

**Reference:** Alignment with EU AI Act environmental provisions and CSRD requirements

**Current State:**
The Cyber AI Profile does not address AI system sustainability or energy efficiency, despite increasing regulatory pressure and enterprise sustainability commitments.

**Gap Identified:**
Organizations deploying AI systems face growing requirements to report on:

- Energy consumption of AI workloads
- Carbon emissions associated with AI operations
- Computational efficiency relative to value delivered

Microsoft's 2024 Environmental Sustainability Report documented a 29% increase in total emissions from 2020 to fiscal year 2023, with the company attributing this rise to "the construction of more datacenters and the associated embodied carbon in building materials, as well as hardware components such as semiconductors, servers, and racks."[1] This demonstrates the materiality of AI infrastructure's environmental impact.

The EU AI Act (Article 40) establishes a framework for developing harmonized standards to improve AI system resource performance, with a mandate for the European Commission to report on energy-efficient GPAI standards by August 2, 2028.

**Proposed Addition:**
We recommend the profile include sustainability considerations:

> "Organizations should establish metrics for AI system sustainability, including:
> - Energy consumption per functional unit (e.g., Wh per 1,000 queries)
> - Carbon intensity aligned with ISO/IEC 21031:2024 (SCI specification)
> - Embodied carbon attribution for AI hardware
> - Carbon-aware scheduling that shifts workloads to low-carbon periods"

**Example Implementation Approach:**
Organizations could adopt the SCI formula from ISO/IEC 21031:2024:

```
SCI = ((E x I) + M) / R

Where:
  E = Energy consumption (kWh)
  I = Marginal carbon intensity (gCO2eq/kWh)
  M = Embodied carbon (gCO2eq)
  R = Functional unit (per API call, per session, etc.)
```

For robust efficiency measurement, we recommend explicitly excluding market-based measures (carbon offsets, RECs) from efficiency scoring, focusing instead on actual emissions reduction.

[1] [Microsoft 2024 Environmental Sustainability Report](https://www.microsoft.com/en-us/corporate-responsibility/sustainability/report), May 2024.

---

### Comment 5: Reasoning Mode Governance for Cost Control

**Reference:** Risk management for generative AI systems

**Current State:**
The Generative AI Profile (NIST AI 600-1) addresses unique GenAI risks but does not specifically address the operational cost implications of reasoning-enabled models.

**Gap Identified:**
Research from the AI Energy Score project (co-led by Hugging Face and Salesforce) found that reasoning-enabled models consume on average **30x more energy** than standard inference, with extreme cases exceeding 500x (e.g., Phi-4-reasoning-plus at 514x in January 2026 benchmarks). Individual models range from approximately 150x to 700x depending on task complexity and model architecture.[2] Without governance:

- Agents may use expensive reasoning for trivial tasks
- Organizations lack visibility into reasoning mode cost
- No automatic controls exist to optimize reasoning usage

**Proposed Addition:**
We recommend explicit guidance for reasoning mode governance:

> "For AI systems with reasoning capabilities (chain-of-thought, extended thinking, etc.), organizations should:
> - Track reasoning mode usage separately from standard inference
> - Implement task classification to determine when reasoning is justified
> - Establish reasoning token budgets that constrain expensive operations
> - Enable automatic reasoning mode disabling for simple, routine tasks"

**Example Implementation Approach:**
Organizations could implement reasoning mode governance including:

- Task classification (e.g., REASONING_JUSTIFIED vs REASONING_UNNECESSARY)
- Reasoning budget tracking per agent or application
- Automatic model selection based on task complexity
- Separate cost-to-value calculations for reasoning operations

[2] Luccioni, S. and Gamazaychikov, B. "[AI Energy Score v2: Refreshed Leaderboard, now with Reasoning](https://huggingface.co/blog/ai-energy-score-v2-reasoning)." Hugging Face Blog, January 2026.

---

## Implementation Considerations

We recognize that implementing efficiency and trust controls introduces complexity, particularly for organizations with heterogeneous AI deployments. Key considerations include:

**Operational Overhead:** Trust scoring systems and resource monitoring add computational and administrative overhead. Organizations should weigh governance benefits against implementation costs, particularly for low-risk AI applications.

**Measurement Challenges:** Accurate energy and carbon measurement for AI workloads remains technically challenging, especially in shared infrastructure environments. The ISO/IEC 21031:2024 standard provides methodology guidance, but practical implementation requires tooling investment.

**Interoperability:** Different AI platforms and cloud providers offer varying levels of telemetry and control. Standards-based approaches facilitate multi-vendor governance but may require adaptation for specific environments.

**Cross-Organizational Trust:** Organizations may need mechanisms for sharing trust assessments across boundaries. Standardized scoring methodologies and cryptographic attestations could enable portable trust, though this remains an evolving area.

**Phased Adoption:** We recommend organizations prioritize governance controls for high-risk autonomous agents before extending to lower-risk AI applications. This allows validation of governance approaches while managing implementation complexity.

**Alignment with Existing Tools:** Organizations can leverage cloud-native monitoring capabilities (e.g., Kubernetes resource quotas, AWS/GCP cost allocation tags, Azure Monitor) to minimize custom development when implementing efficiency governance.

---

## Proposed Integration Path

We propose the following integration between efficiency/trust controls and the NIST Cyber AI Profile:

| NIST CSF Function | Cyber AI Profile Focus | Efficiency/Trust Contribution |
|-------------------|----------------------|-------------------------------|
| **GOVERN** | Establish AI governance | Trust tiers, capability taxonomy, policy constraints |
| **IDENTIFY** | Understand AI context | Resource manifests, hardware tier classification |
| **PROTECT** | Implement safeguards | Capability gating, escalation requirements |
| **DETECT** | Monitor AI systems | CTV monitoring, efficiency alerts, anomaly detection |
| **RESPOND** | Address AI incidents | Automatic throttling, degradation cascade |
| **RECOVER** | Restore AI operations | Recovery from auto-stop, trust score rebuilding |

---

## Technical Resources

The following open resources are available for NIST review as example implementations:

| Resource | URL | License |
|----------|-----|---------|
| BASIS Specification | https://basis.vorion.org | CC BY 4.0 |
| Core Specification | https://basis.vorion.org/spec/overview | CC BY 4.0 |
| Efficiency Specification | https://github.com/voriongit/vorion/tree/master/docs/basis-docs/docs/spec | Apache 2.0 |
| Reference Implementation | https://github.com/voriongit/vorion | Apache 2.0 |

These represent one possible implementation approach; alternative approaches achieving similar outcomes would also satisfy the proposed guidance.

---

## Conclusion

The NIST Cybersecurity Framework Profile for Artificial Intelligence advances AI governance significantly. The profile may benefit from incorporating:

1. **Operational efficiency requirements** that address resource consumption as a security-adjacent concern
2. **Quantified trust scoring** that enables graduated capability controls for autonomous agents
3. **Sustainability metrics** aligned with ISO/IEC 21031:2024 and emerging regulatory requirements
4. **Reasoning mode governance** that addresses the significant energy cost differential of reasoning models

These requirements can be satisfied through various implementation approaches. These proposals draw from emerging practices and open standards; alternative approaches (e.g., MLPerf benchmarks for efficiency measurement, existing trustworthiness frameworks) may also apply. We welcome the opportunity to discuss integration strategies with NIST staff and contribute to the ongoing development of AI governance standards.

We are committed to supporting NIST's mission of promoting U.S. innovation and industrial competitiveness through responsible AI governance that balances security, efficiency, and sustainability.

---

**Respectfully submitted,**

Vorion Risk, LLC
https://vorion.org

---

## Appendix A: Cost-to-Value Governance Thresholds

| CTV Ratio | Status | Automated Response |
|-----------|--------|-------------------|
| [0, 1.0) | Excellent | Continue (value exceeds cost) |
| [1.0, 2.0) | Acceptable | Monitor |
| [2.0, 5.0) | Marginal | Alert agent, suggest optimization |
| [5.0, 10.0) | Poor | Throttle (reduce to 50% capacity) |
| [10.0, 20.0) | Unacceptable | Degrade (minimal operations only) |
| [20.0, +inf) | Critical | Stop, require human review |

**Auto-Stop Conditions:**

- CTV ratio >= 20.0 sustained over rolling window
- 5+ consecutive operation failures
- Rolling average value score < 0 (negative value production)
- Resource consumption > 150% of declared manifest limits
- Carbon budget exhausted

---

## Appendix B: Trust Scoring Reference

**Initial State:** All entities initialize at score 0 (Sandbox tier) unless explicitly promoted by authorized administrator.

**Signal Impacts (Example):**

| Signal Type | Impact | Notes |
|-------------|--------|-------|
| task_completed | +5 | Standard positive signal |
| task_failed | -15 | 3x amplification for failures |
| policy_violation | -50 | Serious compliance breach |
| compliance_check_passed | +2 | Periodic verification |
| human_endorsement | +25 | Explicit trust delegation |

**Decay:** 14-day half-life for inactive entities. Maintenance status pauses decay during planned downtime.

**Tier Boundaries:** Use half-open intervals [min, max) to ensure unambiguous classification at boundaries.

---

## Appendix C: Regulatory Timeline Reference

| Date | Milestone |
|------|-----------|
| August 1, 2024 | EU AI Act entered into force |
| February 2, 2025 | Prohibited AI practices provisions apply |
| August 2, 2025 | GPAI model obligations apply |
| August 2, 2026 | High-risk AI system requirements fully applicable |
| **August 2, 2028** | First EU Commission report on energy-efficient GPAI standards due |

Source: EU AI Act (Regulation (EU) 2024/1689), Articles 40 and 113

---

## Appendix D: Alignment with Existing Standards

| Standard | Alignment |
|----------|-----------|
| **NIST AI RMF** | Provides quantifiable metrics for Measure function; efficiency controls for Manage function |
| **ISO/IEC 42001** | Complements AIMS with operational performance measurement |
| **EU AI Act** | Addresses Article 40 standardization for energy efficiency |
| **ISO/IEC 21031:2024 (SCI)** | Adopts SCI formula as sustainability metric |
| **MLPerf Inference** | Efficiency measurement methodology alignment |
| **Kubernetes** | Resource manifest patterns (requests/limits) |

---

*Document Version: 3.0*
*Prepared: January 18, 2026*
*For submission to: cyberaiprofile@nist.gov by January 30, 2026*
