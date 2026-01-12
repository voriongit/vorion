---
sidebar_position: 1
title: Specification Overview
description: Full BASIS technical specification
---

# BASIS Specification

## Version 1.2.0 (Draft)

**Baseline Authority for Safe & Interoperable Systems**

---

## Abstract

BASIS defines the minimum governance requirements that AI agents must satisfy before autonomous reasoning and action execution begins. This standard establishes a common framework for AI safety, interoperability, and accountability.

---

## Scope

This standard applies to:

- Autonomous AI agents operating in production
- Agent orchestration systems
- Platforms hosting AI agents
- Certification authorities

---

## Normative Language

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHOULD", "RECOMMENDED", "MAY", and "OPTIONAL" are interpreted as described in RFC 2119.

---

## Document Structure

| Section | Content |
|---------|---------|
| [Capabilities](/spec/capabilities) | Capability taxonomy and requirements |
| [Risk Classification](/spec/risk-classification) | Risk levels and governance requirements |
| [Trust Scoring](/spec/trust-scoring) | Trust computation and tier definitions |
| [Policies](/spec/policies) | Policy language and engine requirements |
| [Audit Logging](/spec/audit-logging) | Logging, chaining, and retention |

---

## Core Principles

### 1. Governance Before Execution

**Principle 1.1**: All autonomous agent actions MUST pass through governance validation before execution begins.

**Principle 1.2**: Governance checks MUST complete before reasoning about action execution.

**Principle 1.3**: Failed governance checks MUST prevent action execution.

### 2. Human Authority Preservation

**Principle 2.1**: Humans MUST retain ultimate authority over agent behavior.

**Principle 2.2**: Agents MUST NOT take actions that undermine human oversight.

**Principle 2.3**: Escalation paths to human decision-makers MUST always be available.

### 3. Transparency and Auditability

**Principle 3.1**: All governance decisions MUST be logged with sufficient detail for reconstruction.

**Principle 3.2**: Agents MUST be capable of explaining their governance constraints.

**Principle 3.3**: Audit trails MUST be tamper-evident.

### 4. Proportional Control

**Principle 4.1**: Governance controls MUST be proportional to action risk and impact.

**Principle 4.2**: Low-risk actions SHOULD proceed with minimal friction.

**Principle 4.3**: High-risk actions MUST require explicit authorization.

---

## Compliance Levels

| Level | Requirements | Validation |
|-------|--------------|------------|
| **Self-Declared** | Manifest published | Self-attestation |
| **Verified** | Tests pass | Automated |
| **Certified** | Third-party audit | Certification authority |
| **Accredited** | Ongoing monitoring | Accreditation body |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-06 | Initial release |
| 1.1.0 | 2025-09 | Added trust tiers |
| 1.2.0 | 2026-01 | Enhanced audit requirements |

---

*Full specification source: [GitHub](https://github.com/voriongit/basis-standard)*
