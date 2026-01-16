# BASIS (Baseline Authority for Safe & Interoperable Systems)

[![Status](https://img.shields.io/badge/Status-Draft%20V1-orange)]()
[![License](https://img.shields.io/badge/License-Apache%202.0-blue)]()
[![Steward](https://img.shields.io/badge/Steward-VORION-black)](https://vorion.org)

**BASIS** is an open governance standard that defines the immutable baseline rules autonomous systems must follow before reasoning, execution, or automation is permitted.

It provides a universal schema for defining **Constraints**, **Obligations**, and **Permissions** that decouple *what an agent wants to do* from *what an agent is allowed to do*.

---

## 🏗 The Architecture

BASIS operates as the "Constitution" in the **Vorion Cohesive Stack**. It does not execute code; it defines the boundaries within which code executes.

### The Problem
In traditional agent architectures, safety and logic are often entangled in the same prompt or codebase ("System Prompt Injection"). If the reasoning layer fails, the safety layer fails.

### The Solution
BASIS enforces a hard separation of concerns:
1.  **Reasoning (INTENT)** generates a plan.
2.  **BASIS** provides the rules.
3.  **Enforcement (ENFORCE)** validates the plan against the rules.
4.  **Audit (PROOF)** records the result.

This repository (`basis-core`) contains the definitions, schemas, and reference implementations for **Layer 2 (The Rules)**.

---

## 📂 Repository Structure

```text
basis-core/
├── schemas/           # JSON/YAML schemas for defining BASIS Policy Bundles
├── specs/             # Formal specification documents (RFC-style)
├── examples/          # Reference policy sets (e.g., GDPR-Lite, Finance-Safe)
├── lib/               # Lightweight validation libraries (Python/TS)
└── proposals/         # Community Request for Comments (CRC)
```

---

## ⚡ Core Concepts

### 1. The Policy Bundle
A machine-readable artifact (JSON/YAML) that declares the operational boundaries for an agent.

- **Allow**: Whitelisted domains, tools, or API endpoints.
- **Block**: Prohibited actions, PII patterns, or sensitive data egress.
- **Require**: Mandatory human-in-the-loop triggers or specific audit logging levels.

### 2. The Handshake
Agents adopting BASIS must perform a "handshake" before execution:

> "Here is my Intent. Here is the BASIS Policy. Does this comport?"

### 3. Interoperability
BASIS is jurisdiction-agnostic. A policy bundle created by a healthcare organization in the EU can be read and respected by an agent deployed in a US cloud infrastructure, provided they both speak BASIS.

---

## 🚀 Getting Started

### Installation

> **Note:** This is a standard specification. For the operational engine, see [Cognigate](https://github.com/voriongit/cognigate).

You can use the reference validators to check if your Policy Bundles comply with the BASIS schema:

```bash
npm install @vorion/basis-core
# or
pip install basis-core
```

### Example Policy Snippet (YAML)

```yaml
basis_version: "1.0"
policy_id: "corp-finance-limited"
constraints:
  - type: "egress_whitelist"
    values: ["*.internal-api.com", "stripe.com"]
  - type: "data_protection"
    pattern: "ssn_us"
    action: "redact"
obligations:
  - trigger: "transaction_value > 1000"
    action: "require_human_approval"
```

---

## 🏛 Governance & Stewardship

**VORION** serves as the commercial steward of the BASIS standard, ensuring it remains:

- **Free**: No licensing fees for the standard itself.
- **Adoptable**: Easy to integrate into existing LLM/Agent stacks.
- **Capture-Resistant**: Governance is separated from tooling vendors.

To contribute to the specification, please see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 📜 License

This standard and its schemas are licensed under **Apache 2.0**. Documentation is licensed under **CC-BY 4.0**.
