# STPA Implementation Guide for Vorion

**Systems-Theoretic Process Analysis for AI Governance**

---

## Document Information

| Field | Value |
|-------|-------|
| Version | 1.0.0 |
| Classification | Technical Guide |
| Audience | Safety Engineers, AI Architects, Compliance Teams |
| Last Updated | 2026-01-08 |
| Prerequisites | Familiarity with Vorion architecture, basic safety engineering |

---

## Table of Contents

1. [Introduction to STPA](#1-introduction-to-stpa)
2. [STPA and AI Systems](#2-stpa-and-ai-systems)
3. [Vorion as an STPA Control Structure](#3-vorion-as-an-stpa-control-structure)
4. [Step 1: Define Purpose and Losses](#4-step-1-define-purpose-and-losses)
5. [Step 2: Model the Control Structure](#5-step-2-model-the-control-structure)
6. [Step 3: Identify Unsafe Control Actions](#6-step-3-identify-unsafe-control-actions)
7. [Step 4: Identify Loss Scenarios](#7-step-4-identify-loss-scenarios)
8. [Implementing STPA Controls in BASIS](#8-implementing-stpa-controls-in-basis)
9. [STPA Templates and Worksheets](#9-stpa-templates-and-worksheets)
10. [Case Studies](#10-case-studies)
11. [Integration with Vorion Components](#11-integration-with-vorion-components)
12. [Continuous STPA Process](#12-continuous-stpa-process)
13. [Advanced Topics](#13-advanced-topics)
14. [Appendices](#14-appendices)

---

## 1. Introduction to STPA

### 1.1 What is STPA?

**Systems-Theoretic Process Analysis (STPA)** is a hazard analysis technique based on systems theory and control theory. Developed by Dr. Nancy Leveson at MIT, STPA treats safety as a control problem rather than a failure problem.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    STPA Core Philosophy                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Traditional Safety View:        STPA Safety View:                   │
│  ─────────────────────────       ──────────────────                  │
│  Accidents = Component           Accidents = Inadequate              │
│              Failures                        Control                 │
│                                                                      │
│  Focus: Prevent failures         Focus: Enforce constraints          │
│  Method: Redundancy              Method: Control structure           │
│  Model: Chain of events          Model: Control loops                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Why STPA for AI Systems?

Traditional hazard analysis methods (FMEA, FTA, HAZOP) assume:
- Components fail in predictable ways
- Failures are independent
- Systems are decomposable

AI systems violate these assumptions:
- AI behavior is emergent, not predictable
- Failures are often systemic, not independent
- AI systems are complex adaptive systems

**STPA is ideal for AI because it:**
- Treats safety as emergent property of the whole system
- Focuses on constraints that must be enforced
- Models feedback loops and control relationships
- Handles complexity without requiring decomposition

### 1.3 STPA Basic Concepts

```yaml
STPA_Terminology:
  Loss:
    definition: "Something of value stakeholders don't want to lose"
    examples:
      - "Loss of human life or injury"
      - "Loss of customer data"
      - "Loss of regulatory compliance"
      - "Loss of financial assets"

  Hazard:
    definition: "System state that, combined with environment, leads to loss"
    examples:
      - "AI agent has unauthorized access to production systems"
      - "AI executes action without human awareness"
      - "AI processes data beyond its authorized scope"

  Constraint:
    definition: "Behavior that must be enforced to prevent hazards"
    examples:
      - "AI must not access systems without valid authorization"
      - "High-risk actions must require human confirmation"
      - "Data processing must stay within defined boundaries"

  Control_Action:
    definition: "Action taken by controller to affect controlled process"
    examples:
      - "Grant execution permission"
      - "Deny intent submission"
      - "Escalate for human review"

  Unsafe_Control_Action:
    definition: "Control action that leads to hazard in specific context"
    types:
      - "Not providing causes hazard"
      - "Providing causes hazard"
      - "Too early, too late, out of order"
      - "Stopped too soon, applied too long"
```

### 1.4 The Four Steps of STPA

```
┌─────────────────────────────────────────────────────────────────────┐
│                      STPA Process Overview                           │
└─────────────────────────────────────────────────────────────────────┘

     ┌──────────────────┐
     │   STEP 1         │
     │   Define Purpose │──────► Losses, Hazards, Constraints
     │   of Analysis    │
     └────────┬─────────┘
              │
              ▼
     ┌──────────────────┐
     │   STEP 2         │
     │   Model Control  │──────► Control Structure Diagram
     │   Structure      │
     └────────┬─────────┘
              │
              ▼
     ┌──────────────────┐
     │   STEP 3         │
     │   Identify UCAs  │──────► Unsafe Control Action Table
     │                  │
     └────────┬─────────┘
              │
              ▼
     ┌──────────────────┐
     │   STEP 4         │
     │   Identify Loss  │──────► Loss Scenarios & Mitigations
     │   Scenarios      │
     └──────────────────┘
```

---

## 2. STPA and AI Systems

### 2.1 AI-Specific Hazard Categories

```yaml
AI_Hazard_Categories:
  Autonomy_Hazards:
    description: "Hazards from AI acting without appropriate oversight"
    examples:
      - "AI executes high-impact decision without human review"
      - "AI escalates its own permissions"
      - "AI operates outside defined operational envelope"

  Alignment_Hazards:
    description: "Hazards from AI goals misaligned with human intent"
    examples:
      - "AI optimizes proxy metric at expense of true objective"
      - "AI interprets intent literally, missing context"
      - "AI pursues goal through unacceptable means"

  Capability_Hazards:
    description: "Hazards from AI capabilities exceeding controls"
    examples:
      - "AI discovers novel attack vectors"
      - "AI manipulates evaluation/monitoring systems"
      - "AI acquires resources beyond authorization"

  Integration_Hazards:
    description: "Hazards from AI interaction with broader systems"
    examples:
      - "AI actions cascade through dependent systems"
      - "AI exploits trust relationships"
      - "AI outputs consumed without validation"

  Feedback_Hazards:
    description: "Hazards from inadequate monitoring/correction"
    examples:
      - "Drift in AI behavior goes undetected"
      - "Anomalies dismissed as noise"
      - "Correction mechanisms ineffective"
```

### 2.2 Control Theory Model for AI

```
┌─────────────────────────────────────────────────────────────────────┐
│              AI System Control Structure                             │
└─────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────┐
                    │     Human Operators     │
                    │    (Ultimate Authority) │
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │   Governance Platform   │
                    │   (Vorion)              │
                    │   ┌─────────────────┐   │
                    │   │ Process Model   │   │
                    │   │ (Beliefs about  │   │
                    │   │  AI behavior)   │   │
                    │   └─────────────────┘   │
                    └───────────┬─────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
              ▼                 ▼                 ▼
        ┌──────────┐     ┌──────────┐     ┌──────────┐
        │ Control  │     │ Control  │     │ Control  │
        │ Action 1 │     │ Action 2 │     │ Action N │
        │ (Allow)  │     │ (Deny)   │     │(Escalate)│
        └────┬─────┘     └────┬─────┘     └────┬─────┘
             │                │                │
             └────────────────┼────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   AI Agent        │
                    │   (Controlled     │
                    │    Process)       │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │   Environment     │
                    │   (Systems, Data, │
                    │    Users)         │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │   Feedback        │
                    │   (Monitoring,    │
                    │    Outcomes)      │
                    └───────────────────┘
```

### 2.3 AI Control Loop Dynamics

```yaml
Control_Loop_Components:
  Controller:
    role: "Makes decisions about control actions"
    in_vorion: "BASIS + ENFORCE"
    requirements:
      - "Accurate process model of AI capabilities"
      - "Clear constraint definitions"
      - "Timely decision-making"
      - "Appropriate authority level"

  Actuator:
    role: "Implements control actions on process"
    in_vorion: "Cognigate execution gating"
    requirements:
      - "Reliable action enforcement"
      - "Cannot be bypassed"
      - "Appropriate granularity"
      - "Fail-safe defaults"

  Controlled_Process:
    role: "System being controlled"
    in_vorion: "AI Agent execution"
    characteristics:
      - "Complex behavior"
      - "Adaptive/learning"
      - "Goal-directed"
      - "Emergent properties"

  Sensor:
    role: "Observes process state for controller"
    in_vorion: "PROOF + Trust Engine"
    requirements:
      - "Accurate observation"
      - "Timely feedback"
      - "Tamper-resistant"
      - "Comprehensive coverage"

  Feedback_Channel:
    role: "Communicates observations to controller"
    in_vorion: "Event streams, metrics, proofs"
    requirements:
      - "Low latency"
      - "High fidelity"
      - "Secure transmission"
      - "Appropriate aggregation"
```

---

## 3. Vorion as an STPA Control Structure

### 3.1 Mapping Vorion Components to STPA

```
┌─────────────────────────────────────────────────────────────────────┐
│              Vorion STPA Control Structure                           │
└─────────────────────────────────────────────────────────────────────┘

     ┌─────────────────────────────────────────────────────────┐
     │                    HUMAN OVERSIGHT                       │
     │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
     │  │  Operators  │  │  Auditors   │  │ Executives  │      │
     │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘      │
     └─────────┼────────────────┼────────────────┼─────────────┘
               │                │                │
               ▼                ▼                ▼
     ┌─────────────────────────────────────────────────────────┐
     │                    CONTROLLER LAYER                      │
     │  ┌──────────────────────────────────────────────────┐   │
     │  │                     BASIS                         │   │
     │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  │   │
     │  │  │   Rules    │  │  Process   │  │ Constraint │  │   │
     │  │  │  Engine    │  │   Model    │  │   Store    │  │   │
     │  │  └────────────┘  └────────────┘  └────────────┘  │   │
     │  └──────────────────────────────────────────────────┘   │
     │  ┌──────────────────────────────────────────────────┐   │
     │  │                    ENFORCE                        │   │
     │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  │   │
     │  │  │  Decision  │  │ Escalation │  │   Action   │  │   │
     │  │  │   Logic    │  │   Router   │  │  Selector  │  │   │
     │  │  └────────────┘  └────────────┘  └────────────┘  │   │
     │  └──────────────────────────────────────────────────┘   │
     └───────────────────────────┬─────────────────────────────┘
                                 │
               ┌─────────────────┼─────────────────┐
               │                 │                 │
               ▼                 ▼                 ▼
     ┌─────────────────────────────────────────────────────────┐
     │                    ACTUATOR LAYER                        │
     │  ┌──────────────────────────────────────────────────┐   │
     │  │                   COGNIGATE                       │   │
     │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  │   │
     │  │  │  Execution │  │  Resource  │  │   Output   │  │   │
     │  │  │    Gate    │  │   Limiter  │  │  Filter    │  │   │
     │  │  └────────────┘  └────────────┘  └────────────┘  │   │
     │  └──────────────────────────────────────────────────┘   │
     └───────────────────────────┬─────────────────────────────┘
                                 │
                                 ▼
     ┌─────────────────────────────────────────────────────────┐
     │                 CONTROLLED PROCESS                       │
     │  ┌──────────────────────────────────────────────────┐   │
     │  │                   AI AGENT                        │   │
     │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  │   │
     │  │  │   INTENT   │  │  Reasoning │  │   Action   │  │   │
     │  │  │  (Goals)   │  │   Engine   │  │  Execution │  │   │
     │  │  └────────────┘  └────────────┘  └────────────┘  │   │
     │  └──────────────────────────────────────────────────┘   │
     └───────────────────────────┬─────────────────────────────┘
                                 │
                                 ▼
     ┌─────────────────────────────────────────────────────────┐
     │                    SENSOR LAYER                          │
     │  ┌──────────────────────────────────────────────────┐   │
     │  │                     PROOF                         │   │
     │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  │   │
     │  │  │   Event    │  │  Evidence  │  │   Chain    │  │   │
     │  │  │  Capture   │  │   Store    │  │ Validator  │  │   │
     │  │  └────────────┘  └────────────┘  └────────────┘  │   │
     │  └──────────────────────────────────────────────────┘   │
     │  ┌──────────────────────────────────────────────────┐   │
     │  │                  TRUST ENGINE                     │   │
     │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  │   │
     │  │  │  Behavior  │  │   Score    │  │  Anomaly   │  │   │
     │  │  │  Analysis  │  │ Calculator │  │  Detector  │  │   │
     │  │  └────────────┘  └────────────┘  └────────────┘  │   │
     │  └──────────────────────────────────────────────────┘   │
     └───────────────────────────┬─────────────────────────────┘
                                 │
                                 │ Feedback Loop
                                 │
               ┌─────────────────┘
               │
               ▼
     ┌─────────────────────────────────────────────────────────┐
     │                    CONTROLLER LAYER                      │
     │                    (Process Model Update)                │
     └─────────────────────────────────────────────────────────┘
```

### 3.2 STPA Component Mapping Table

| STPA Component | Vorion Implementation | Function |
|----------------|----------------------|----------|
| **Controller** | BASIS + ENFORCE | Evaluates constraints, makes control decisions |
| **Process Model** | Trust scores + behavioral profiles | Beliefs about AI state and capabilities |
| **Control Actions** | ALLOW, DENY, ESCALATE, LIMIT | Actions applied to AI execution |
| **Actuator** | Cognigate | Enforces control actions at execution time |
| **Controlled Process** | AI Agent | System being governed |
| **Sensor** | PROOF + Trust Engine | Observes outcomes and behavior |
| **Feedback Channel** | Event streams, metrics | Communicates observations to controller |

### 3.3 Control Actions in Vorion

```yaml
Vorion_Control_Actions:
  ALLOW:
    description: "Permit AI action to proceed"
    conditions:
      - "All constraints satisfied"
      - "Trust level sufficient"
      - "Within operational envelope"
    implementation: "Cognigate passes intent to execution"

  DENY:
    description: "Block AI action from executing"
    conditions:
      - "Constraint violation detected"
      - "Trust level insufficient"
      - "Outside operational envelope"
    implementation: "Cognigate rejects intent, returns error"

  ESCALATE:
    description: "Require human approval before proceeding"
    conditions:
      - "Action exceeds autonomy level"
      - "Anomaly detected"
      - "Policy requires human-in-loop"
    implementation: "Intent queued for human review"

  LIMIT:
    description: "Allow with reduced scope/resources"
    conditions:
      - "Partial constraint satisfaction"
      - "Resource conservation needed"
      - "Graduated response appropriate"
    implementation: "Cognigate applies restrictions"

  MONITOR:
    description: "Allow but increase observation"
    conditions:
      - "Edge case detected"
      - "Trust degradation observed"
      - "Learning opportunity identified"
    implementation: "Enhanced logging, real-time alerting"

  TERMINATE:
    description: "Immediately halt AI execution"
    conditions:
      - "Critical safety violation"
      - "Human override triggered"
      - "System integrity threat"
    implementation: "Cognigate kills process, preserves state"
```

---

## 4. Step 1: Define Purpose and Losses

### 4.1 Identifying System-Level Losses

Begin by identifying what stakeholders don't want to lose. For AI systems, common loss categories include:

```yaml
Loss_Categories:
  Safety_Losses:
    L-S1: "Loss of human life or physical injury"
    L-S2: "Loss of human autonomy or dignity"
    L-S3: "Psychological harm to users"

  Security_Losses:
    L-SE1: "Loss of confidential data"
    L-SE2: "Loss of system integrity"
    L-SE3: "Loss of system availability"
    L-SE4: "Unauthorized access or privilege escalation"

  Financial_Losses:
    L-F1: "Direct financial losses (fraud, errors)"
    L-F2: "Regulatory fines and penalties"
    L-F3: "Litigation costs"
    L-F4: "Lost revenue or business opportunity"

  Operational_Losses:
    L-O1: "Loss of service continuity"
    L-O2: "Loss of operational efficiency"
    L-O3: "Loss of data integrity"

  Reputational_Losses:
    L-R1: "Loss of customer trust"
    L-R2: "Loss of market position"
    L-R3: "Negative media coverage"

  Compliance_Losses:
    L-C1: "Loss of regulatory standing"
    L-C2: "Loss of certifications"
    L-C3: "Loss of operating licenses"

  Ethical_Losses:
    L-E1: "Discrimination or bias harm"
    L-E2: "Privacy violations"
    L-E3: "Manipulation of users"
```

### 4.2 Loss Identification Worksheet

```
┌─────────────────────────────────────────────────────────────────────┐
│                    LOSS IDENTIFICATION WORKSHEET                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  System: ___________________________________________________        │
│  Date: _____________ Analyst: _______________________________        │
│                                                                      │
│  ┌─────┬────────────────────────────────────┬──────────────────┐    │
│  │ ID  │ Loss Description                   │ Severity (1-5)   │    │
│  ├─────┼────────────────────────────────────┼──────────────────┤    │
│  │ L1  │                                    │                  │    │
│  │ L2  │                                    │                  │    │
│  │ L3  │                                    │                  │    │
│  │ L4  │                                    │                  │    │
│  │ L5  │                                    │                  │    │
│  └─────┴────────────────────────────────────┴──────────────────┘    │
│                                                                      │
│  Stakeholders Consulted:                                             │
│  [ ] Business Owners    [ ] Security Team    [ ] Legal/Compliance   │
│  [ ] Operations         [ ] End Users        [ ] Regulators         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.3 Deriving Hazards from Losses

For each loss, identify system states (hazards) that could lead to that loss:

```yaml
Hazard_Derivation:
  Loss_L-SE1: "Loss of confidential data"
  Hazards:
    H-SE1.1: "AI agent has access to data beyond its authorization scope"
    H-SE1.2: "AI agent transmits data to unauthorized recipients"
    H-SE1.3: "AI agent stores data in insecure locations"
    H-SE1.4: "AI agent exposes data in logs or outputs"

  Loss_L-F1: "Direct financial losses"
  Hazards:
    H-F1.1: "AI agent executes unauthorized transactions"
    H-F1.2: "AI agent approves fraudulent requests"
    H-F1.3: "AI agent miscalculates financial values"
    H-F1.4: "AI agent provides incorrect financial advice"

  Loss_L-O1: "Loss of service continuity"
  Hazards:
    H-O1.1: "AI agent consumes excessive system resources"
    H-O1.2: "AI agent creates cascading failures"
    H-O1.3: "AI agent corrupts critical data"
    H-O1.4: "AI agent enters infinite loop or deadlock"
```

### 4.4 Defining System-Level Constraints

For each hazard, define constraints that must be enforced:

```yaml
Constraint_Derivation:
  Hazard_H-SE1.1: "AI agent has access to data beyond authorization"
  Constraint:
    SC-SE1.1: "AI agent must only access data explicitly authorized for its current task"
    enforcement: "Data access control in Cognigate"
    verification: "PROOF audit of data access patterns"

  Hazard_H-F1.1: "AI agent executes unauthorized transactions"
  Constraint:
    SC-F1.1: "AI agent must not execute financial transactions above its autonomy limit without human approval"
    enforcement: "Transaction limits in BASIS rules"
    verification: "PROOF transaction audit trail"

  Hazard_H-O1.1: "AI agent consumes excessive resources"
  Constraint:
    SC-O1.1: "AI agent must operate within defined resource quotas"
    enforcement: "Resource limits in Cognigate"
    verification: "Trust Engine resource monitoring"
```

---

## 5. Step 2: Model the Control Structure

### 5.1 Control Structure Diagram Template

```
┌─────────────────────────────────────────────────────────────────────┐
│                CONTROL STRUCTURE TEMPLATE                            │
└─────────────────────────────────────────────────────────────────────┘

                         ┌────────────────────┐
                         │   CONTROLLER       │
                         │   ┌──────────────┐ │
                         │   │Process Model │ │
                         │   │ - Beliefs    │ │
                         │   │ - State      │ │
                         │   └──────────────┘ │
                         └─────────┬──────────┘
                                   │
         ┌────────────────Control Actions────────────────┐
         │                         │                     │
         ▼                         ▼                     ▼
    ┌─────────┐              ┌─────────┐           ┌─────────┐
    │Action 1 │              │Action 2 │           │Action N │
    └────┬────┘              └────┬────┘           └────┬────┘
         │                        │                     │
         └────────────────────────┼─────────────────────┘
                                  │
                         ┌────────▼────────┐
                         │   ACTUATOR      │
                         │   (Enforcement) │
                         └────────┬────────┘
                                  │
                         ┌────────▼────────┐
                         │   CONTROLLED    │
                         │   PROCESS       │
                         └────────┬────────┘
                                  │
                         ┌────────▼────────┐
                         │   SENSOR        │
                         │   (Observation) │
                         └────────┬────────┘
                                  │
                              Feedback
                                  │
         ┌────────────────────────┘
         │
         ▼
    ┌─────────────────────┐
    │ CONTROLLER          │
    │ (Model Update)      │
    └─────────────────────┘
```

### 5.2 Multi-Level Control Structure

Most real systems have multiple control levels:

```
┌─────────────────────────────────────────────────────────────────────┐
│               HIERARCHICAL CONTROL STRUCTURE                         │
└─────────────────────────────────────────────────────────────────────┘

LEVEL 0: GOVERNANCE
┌─────────────────────────────────────────────────────────────────────┐
│  Board / Executives / Regulators                                     │
│  Control: Policies, Budgets, Risk Appetite                          │
│  Feedback: Reports, Audits, Incidents                               │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
LEVEL 1: MANAGEMENT
┌─────────────────────────────────────────────────────────────────────┐
│  Operations Team / Security Team / Compliance                        │
│  Control: Configurations, Procedures, Escalations                   │
│  Feedback: Dashboards, Alerts, Metrics                              │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
LEVEL 2: AUTOMATED CONTROL
┌─────────────────────────────────────────────────────────────────────┐
│  Vorion Platform (BASIS + ENFORCE)                                   │
│  Control: Rules, Constraints, Trust Levels                          │
│  Feedback: PROOF events, Trust scores                               │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
LEVEL 3: EXECUTION CONTROL
┌─────────────────────────────────────────────────────────────────────┐
│  Cognigate Runtime                                                   │
│  Control: Execution gates, Resource limits                          │
│  Feedback: Execution metrics, Outcomes                              │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
LEVEL 4: PROCESS
┌─────────────────────────────────────────────────────────────────────┐
│  AI Agent                                                            │
│  Behavior: Intent execution, Decision making                        │
│  Output: Actions, Artifacts, Responses                              │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.3 Documenting Control Structure Elements

```yaml
Control_Structure_Documentation:
  Controllers:
    C1_BASIS:
      name: "BASIS Rule Engine"
      inputs:
        - "Intent submissions"
        - "Trust scores"
        - "Context data"
      outputs:
        - "Allow/Deny decisions"
        - "Constraint violations"
        - "Escalation requests"
      process_model:
        - "Entity trust levels"
        - "Active constraints"
        - "Operational policies"
      responsibilities:
        - "Evaluate intents against constraints"
        - "Determine appropriate autonomy level"
        - "Route escalations"

    C2_Human_Operator:
      name: "Human Operator"
      inputs:
        - "Escalation requests"
        - "Dashboard views"
        - "Alerts"
      outputs:
        - "Approval/Rejection decisions"
        - "Policy updates"
        - "Manual overrides"
      process_model:
        - "Business context"
        - "Risk tolerance"
        - "Regulatory requirements"
      responsibilities:
        - "Review escalated decisions"
        - "Handle exceptions"
        - "Adjust policies"

  Actuators:
    A1_Cognigate:
      name: "Cognigate Execution Gate"
      inputs:
        - "Control decisions from BASIS"
        - "Resource limits"
        - "Execution parameters"
      outputs:
        - "Execution permit/block"
        - "Resource allocation"
        - "Execution constraints"
      characteristics:
        - "Cannot be bypassed"
        - "Fail-safe to deny"
        - "Sub-millisecond latency"

  Sensors:
    S1_PROOF:
      name: "PROOF Evidence System"
      observes:
        - "All intent executions"
        - "All control decisions"
        - "All outcomes"
      outputs:
        - "Immutable proof records"
        - "Audit trail"
        - "Compliance evidence"
      characteristics:
        - "Tamper-evident"
        - "Complete coverage"
        - "Real-time capture"

    S2_Trust_Engine:
      name: "Trust Engine"
      observes:
        - "Entity behavior patterns"
        - "Compliance history"
        - "Anomaly indicators"
      outputs:
        - "Trust scores"
        - "Anomaly alerts"
        - "Behavioral profiles"
      characteristics:
        - "Continuous monitoring"
        - "Multi-signal fusion"
        - "Adaptive thresholds"
```

### 5.4 Identifying Control Actions

For each controller, enumerate possible control actions:

```yaml
Control_Actions_By_Controller:
  BASIS_Rule_Engine:
    CA-B1: "Allow intent execution"
    CA-B2: "Deny intent execution"
    CA-B3: "Escalate to human reviewer"
    CA-B4: "Allow with constraints"
    CA-B5: "Queue for batch processing"
    CA-B6: "Request additional context"

  Human_Operator:
    CA-H1: "Approve escalated intent"
    CA-H2: "Reject escalated intent"
    CA-H3: "Modify and approve"
    CA-H4: "Escalate to higher authority"
    CA-H5: "Update policy/rules"
    CA-H6: "Suspend entity"
    CA-H7: "Trigger investigation"

  Cognigate:
    CA-C1: "Execute intent"
    CA-C2: "Block execution"
    CA-C3: "Apply resource limits"
    CA-C4: "Enable monitoring mode"
    CA-C5: "Terminate execution"
    CA-C6: "Checkpoint state"
```

---

## 6. Step 3: Identify Unsafe Control Actions

### 6.1 UCA Categories

For each control action, consider four ways it could be unsafe:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    UCA CATEGORY FRAMEWORK                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Type 1: NOT PROVIDING causes hazard                                │
│  ─────────────────────────────────────                              │
│  The control action is needed but not provided                      │
│  Example: Not blocking a malicious intent when constraints violated │
│                                                                      │
│  Type 2: PROVIDING causes hazard                                    │
│  ─────────────────────────────────                                  │
│  The control action is provided but shouldn't be                    │
│  Example: Allowing an intent that violates data access rules        │
│                                                                      │
│  Type 3: TOO EARLY, TOO LATE, WRONG ORDER                          │
│  ───────────────────────────────────────────                        │
│  Timing or sequence is incorrect                                    │
│  Example: Allowing execution before validation completes            │
│                                                                      │
│  Type 4: STOPPED TOO SOON, APPLIED TOO LONG                        │
│  ───────────────────────────────────────────                        │
│  Duration is incorrect                                              │
│  Example: Removing resource limits before execution completes       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 UCA Analysis Table Template

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    UCA ANALYSIS TABLE                                                   │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Control    │ Not Providing      │ Providing         │ Wrong Timing/     │ Stopped Too Soon/            │
│ Action     │ Causes Hazard      │ Causes Hazard     │ Order             │ Applied Too Long             │
├────────────┼────────────────────┼───────────────────┼───────────────────┼──────────────────────────────┤
│ CA-B1:     │ UCA-B1.1:          │ UCA-B1.2:         │ UCA-B1.3:         │ UCA-B1.4:                    │
│ Allow      │ Not allowing       │ Allowing when     │ Allowing before   │ N/A (Allow is               │
│ Intent     │ legitimate high-   │ constraints are   │ all constraints   │ instantaneous)              │
│            │ priority intent    │ violated          │ evaluated         │                              │
│            │ [H-O1.1]           │ [H-SE1.1, H-F1.1] │ [H-SE1.1]         │                              │
├────────────┼────────────────────┼───────────────────┼───────────────────┼──────────────────────────────┤
│ CA-B2:     │ UCA-B2.1:          │ UCA-B2.2:         │ UCA-B2.3:         │ UCA-B2.4:                    │
│ Deny       │ Not denying when   │ Denying           │ Denying after     │ Maintaining denial           │
│ Intent     │ constraints        │ legitimate        │ execution has     │ after constraint             │
│            │ violated           │ intent without    │ already begun     │ is resolved                  │
│            │ [H-SE1.1, H-F1.1]  │ violation [H-O1.1]│ [H-O1.3]          │ [H-O1.1]                     │
├────────────┼────────────────────┼───────────────────┼───────────────────┼──────────────────────────────┤
│ CA-B3:     │ UCA-B3.1:          │ UCA-B3.2:         │ UCA-B3.3:         │ UCA-B3.4:                    │
│ Escalate   │ Not escalating     │ Escalating        │ Escalating        │ Keeping in                   │
│            │ high-risk          │ routine           │ after autonomous  │ escalation queue             │
│            │ decisions          │ decisions         │ execution         │ too long                     │
│            │ [H-F1.1, H-SE1.1]  │ [H-O1.1]          │ [H-F1.1]          │ [H-O1.1]                     │
├────────────┼────────────────────┼───────────────────┼───────────────────┼──────────────────────────────┤
│ CA-C5:     │ UCA-C5.1:          │ UCA-C5.2:         │ UCA-C5.3:         │ UCA-C5.4:                    │
│ Terminate  │ Not terminating    │ Terminating       │ Terminating       │ Not releasing                │
│ Execution  │ runaway            │ healthy           │ after damage      │ resources after              │
│            │ execution          │ execution         │ done              │ termination                  │
│            │ [H-O1.1, H-O1.2]   │ [H-O1.1]          │ [H-SE1.1]         │ [H-O1.1]                     │
└────────────┴────────────────────┴───────────────────┴───────────────────┴──────────────────────────────┘
```

### 6.3 Context-Specific UCAs

UCAs often depend on context. Document the conditions:

```yaml
Context_Specific_UCAs:
  UCA-B1.2: "Allowing intent when constraints violated"
  Contexts:
    Financial_Context:
      condition: "Amount > $10,000 AND trust_level < L3"
      hazard: "H-F1.1: Unauthorized high-value transaction"
      severity: "High"

    Data_Access_Context:
      condition: "Data_classification = PII AND purpose not in approved_purposes"
      hazard: "H-SE1.1: Unauthorized data access"
      severity: "Critical"

    System_Access_Context:
      condition: "Target_system = production AND change_type = destructive"
      hazard: "H-O1.3: Data corruption"
      severity: "Critical"

  UCA-B3.1: "Not escalating high-risk decisions"
  Contexts:
    Autonomy_Context:
      condition: "Required_autonomy > entity_autonomy_level"
      hazard: "H-F1.1: Action beyond authorized scope"
      severity: "High"

    Anomaly_Context:
      condition: "Anomaly_score > threshold AND action_type = sensitive"
      hazard: "H-SE1.2: Compromised entity acting"
      severity: "Critical"

    First_Time_Context:
      condition: "Action_type never performed by entity before"
      hazard: "H-F1.1: Unvetted action pattern"
      severity: "Medium"
```

### 6.4 UCA Documentation Template

```yaml
UCA_Documentation:
  UCA_ID: "UCA-B1.2-FIN"
  Control_Action: "CA-B1: Allow Intent"
  UCA_Type: "Providing causes hazard"
  Description: >
    Allowing a financial transaction intent when the transaction
    amount exceeds the entity's authorized limit

  Context:
    Conditions:
      - "intent.type = 'financial_transaction'"
      - "intent.amount > entity.transaction_limit"
    Environment:
      - "Production system"
      - "Real financial accounts"

  Related_Hazards:
    - "H-F1.1: Unauthorized financial transaction"
    - "H-C1.1: Compliance violation"

  Related_Constraints:
    - "SC-F1.1: Transaction limits must be enforced"

  Severity: "High"
  Likelihood: "Medium"
  Risk_Level: "High"

  Required_Mitigations:
    - "Implement transaction limit check in BASIS"
    - "Add escalation rule for over-limit transactions"
    - "Create real-time alert for limit breaches"
```

---

## 7. Step 4: Identify Loss Scenarios

### 7.1 Loss Scenario Categories

For each UCA, identify why it might occur:

```
┌─────────────────────────────────────────────────────────────────────┐
│                   LOSS SCENARIO CATEGORIES                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  CONTROLLER-RELATED SCENARIOS                                        │
│  ─────────────────────────────                                       │
│  1. Inadequate control algorithm                                     │
│  2. Unsafe control input                                             │
│  3. Inadequate process model                                         │
│     - Missing information                                            │
│     - Incorrect information                                          │
│     - Delayed information                                            │
│                                                                      │
│  CONTROL PATH SCENARIOS                                              │
│  ──────────────────────                                              │
│  1. Control action not executed                                      │
│  2. Control action incorrectly executed                              │
│  3. Control action delayed                                           │
│                                                                      │
│  CONTROLLED PROCESS SCENARIOS                                        │
│  ────────────────────────────                                        │
│  1. Process ignores control action                                   │
│  2. Process incorrectly interprets action                            │
│  3. Process behavior changes unexpectedly                            │
│                                                                      │
│  FEEDBACK SCENARIOS                                                  │
│  ─────────────────                                                   │
│  1. Feedback not provided                                            │
│  2. Feedback incorrect                                               │
│  3. Feedback delayed                                                 │
│  4. Feedback misinterpreted                                          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 Loss Scenario Analysis for AI Systems

```yaml
AI_Loss_Scenarios:
  UCA: "UCA-B1.2: Allowing intent when constraints violated"

  Controller_Scenarios:
    LS-C1: "Rule misconfiguration"
      description: "BASIS rule incorrectly written, allows violation"
      causal_factors:
        - "Complex rule logic"
        - "Insufficient testing"
        - "Copy-paste error"
      mitigations:
        - "Rule validation tooling"
        - "Rule review process"
        - "Automated rule testing"

    LS-C2: "Stale process model"
      description: "Trust score not updated, shows higher trust than warranted"
      causal_factors:
        - "Trust Engine lag"
        - "Missing behavioral signal"
        - "Score calculation error"
      mitigations:
        - "Real-time trust updates"
        - "Trust score freshness checks"
        - "Conservative defaults"

    LS-C3: "Context not provided"
      description: "Intent missing critical context needed for evaluation"
      causal_factors:
        - "SDK bug"
        - "Caller error"
        - "Network truncation"
      mitigations:
        - "Required field validation"
        - "Context completeness checks"
        - "Default deny for incomplete"

  Control_Path_Scenarios:
    LS-P1: "Cognigate bypass"
      description: "AI execution path bypasses enforcement"
      causal_factors:
        - "Architecture vulnerability"
        - "Deployment misconfiguration"
        - "Direct API access"
      mitigations:
        - "Single enforcement point"
        - "Network isolation"
        - "Bypass detection"

    LS-P2: "Race condition"
      description: "Execution starts before evaluation completes"
      causal_factors:
        - "Async processing bug"
        - "Timeout too short"
        - "Concurrent modification"
      mitigations:
        - "Synchronous evaluation"
        - "Transaction isolation"
        - "Execution token validation"

  Process_Scenarios:
    LS-PR1: "AI circumvention"
      description: "AI agent finds way to achieve goal while technically complying"
      causal_factors:
        - "Goal misalignment"
        - "Specification gaming"
        - "Emergent behavior"
      mitigations:
        - "Intent validation"
        - "Outcome monitoring"
        - "Behavioral anomaly detection"

    LS-PR2: "AI capability change"
      description: "AI becomes capable of actions not anticipated"
      causal_factors:
        - "Model update"
        - "Fine-tuning"
        - "Prompt injection"
      mitigations:
        - "Capability monitoring"
        - "Action whitelisting"
        - "Sandboxed execution"

  Feedback_Scenarios:
    LS-F1: "PROOF tampering"
      description: "Evidence records modified to hide violation"
      causal_factors:
        - "Insufficient integrity protection"
        - "Insider threat"
        - "System compromise"
      mitigations:
        - "Cryptographic sealing"
        - "Distributed witnesses"
        - "Real-time replication"

    LS-F2: "Trust signal manipulation"
      description: "AI manipulates behavior to inflate trust score"
      causal_factors:
        - "Predictable scoring"
        - "Limited signal diversity"
        - "Gaming vulnerability"
      mitigations:
        - "Unpredictable evaluation"
        - "Multiple signal sources"
        - "Anomaly detection"
```

### 7.3 Causal Factor Analysis

Use causal factor diagrams to trace scenario causes:

```
┌─────────────────────────────────────────────────────────────────────┐
│           CAUSAL FACTOR DIAGRAM: LS-C2 Stale Process Model          │
└─────────────────────────────────────────────────────────────────────┘

                         ┌─────────────────────┐
                         │  UCA-B1.2:          │
                         │  Allow when         │
                         │  constraints        │
                         │  violated           │
                         └──────────┬──────────┘
                                    │
                                    │ caused by
                                    ▼
                         ┌─────────────────────┐
                         │  LS-C2:             │
                         │  Stale Process      │
                         │  Model              │
                         └──────────┬──────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
              ▼                     ▼                     ▼
     ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
     │  CF-1:          │   │  CF-2:          │   │  CF-3:          │
     │  Trust Engine   │   │  Missing        │   │  Score          │
     │  Processing Lag │   │  Behavioral     │   │  Calculation    │
     │                 │   │  Signal         │   │  Error          │
     └────────┬────────┘   └────────┬────────┘   └────────┬────────┘
              │                     │                     │
              ▼                     ▼                     ▼
     ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
     │  High event     │   │  Sensor gap     │   │  Algorithm bug  │
     │  volume         │   │  in coverage    │   │                 │
     │  ─────────────  │   │  ─────────────  │   │  ─────────────  │
     │  Queue backlog  │   │  Unmonitored    │   │  Edge case not  │
     │  Network delay  │   │  action type    │   │  handled        │
     └─────────────────┘   └─────────────────┘   └─────────────────┘
```

### 7.4 Loss Scenario Documentation Template

```yaml
Loss_Scenario_Documentation:
  LS_ID: "LS-C2"
  Name: "Stale Process Model"
  Related_UCA: "UCA-B1.2"
  Category: "Controller - Inadequate Process Model"

  Description: >
    The Trust Engine does not update the entity's trust score in time,
    allowing an intent to be evaluated against an outdated (higher)
    trust level than the entity actually deserves.

  Causal_Factors:
    CF-1:
      name: "Processing lag"
      description: "High event volume causes queue backlog"
      probability: "Medium"

    CF-2:
      name: "Missing signal"
      description: "Behavioral signal source not monitored"
      probability: "Low"

    CF-3:
      name: "Calculation error"
      description: "Edge case in scoring algorithm"
      probability: "Low"

  Impact:
    severity: "High"
    scope: "Individual entity executions"
    reversibility: "Depends on action type"

  Mitigations:
    M-1:
      name: "Real-time trust updates"
      description: "Stream processing for immediate score updates"
      effectiveness: "High"
      implementation: "Trust Engine enhancement"

    M-2:
      name: "Score freshness validation"
      description: "Reject evaluation if score older than threshold"
      effectiveness: "High"
      implementation: "BASIS rule"

    M-3:
      name: "Conservative defaults"
      description: "Assume lower trust when uncertain"
      effectiveness: "Medium"
      implementation: "ENFORCE configuration"

  Verification:
    test_cases:
      - "Inject artificial delay, verify fallback behavior"
      - "Remove signal source, verify degraded trust score"
      - "Test edge cases in scoring algorithm"
    monitoring:
      - "Trust score freshness metric"
      - "Update latency percentiles"
      - "Stale score evaluation count"
```

---

## 8. Implementing STPA Controls in BASIS

### 8.1 Translating Constraints to BASIS Rules

System-level constraints map directly to BASIS rules:

```yaml
# Constraint: SC-F1.1
# AI agent must not execute financial transactions above its
# autonomy limit without human approval

constraint_id: "SC-F1.1"
name: "Transaction Limit Enforcement"
version: "1.0.0"
derived_from:
  hazard: "H-F1.1"
  uca: "UCA-B1.2-FIN"
  loss: "L-F1"

rule:
  when:
    intent_type: "financial_transaction"
    conditions:
      - field: "amount"
        operator: "greater_than"
        value: "${entity.transaction_limit}"

  then:
    action: "escalate"
    escalation:
      to: "finance_approver"
      timeout: "4h"
      auto_deny_on_timeout: true

  evidence:
    capture:
      - "intent.amount"
      - "entity.transaction_limit"
      - "entity.trust_level"
      - "escalation.decision"
      - "escalation.approver"
```

### 8.2 Multi-Constraint Evaluation

Complex hazards require multiple constraints:

```yaml
# Hazard: H-SE1.1 - Unauthorized data access
# Requires multiple constraint checks

constraint_group:
  id: "CG-SE1.1"
  name: "Data Access Control"
  evaluation: "all_must_pass"

  constraints:
    - id: "SC-SE1.1a"
      name: "Purpose limitation"
      rule:
        when:
          intent_type: "data_access"
        conditions:
          - field: "intent.purpose"
            operator: "in"
            value: "${data_classification.approved_purposes}"
        violation_message: "Data access purpose not approved for classification"

    - id: "SC-SE1.1b"
      name: "Entity authorization"
      rule:
        when:
          intent_type: "data_access"
        conditions:
          - field: "entity.data_access_scope"
            operator: "contains"
            value: "${intent.data_classification}"
        violation_message: "Entity not authorized for data classification"

    - id: "SC-SE1.1c"
      name: "Minimum trust level"
      rule:
        when:
          intent_type: "data_access"
        conditions:
          - field: "entity.trust_level"
            operator: "greater_than_or_equal"
            value: "${data_classification.min_trust_level}"
        violation_message: "Trust level insufficient for data classification"

    - id: "SC-SE1.1d"
      name: "Time window"
      rule:
        when:
          intent_type: "data_access"
          data_classification: ["PII", "CONFIDENTIAL"]
        conditions:
          - field: "current_time"
            operator: "within"
            value: "${entity.approved_access_hours}"
        violation_message: "Data access outside approved time window"
```

### 8.3 Context-Aware Constraint Evaluation

```yaml
# UCA: UCA-B3.1 - Not escalating high-risk decisions
# Context determines when escalation is required

constraint_id: "SC-B3.1"
name: "Risk-Based Escalation"
version: "1.0.0"

rule:
  # Default: calculate risk score
  risk_calculation:
    base_risk: "${intent.inherent_risk}"
    modifiers:
      - factor: "first_time_action"
        condition: "intent.action_type NOT IN entity.action_history"
        adjustment: "+20"
      - factor: "anomaly_detected"
        condition: "entity.anomaly_score > 0.7"
        adjustment: "+30"
      - factor: "high_value"
        condition: "intent.value > 10000"
        adjustment: "+15"
      - factor: "sensitive_target"
        condition: "intent.target.classification IN ['PRODUCTION', 'CRITICAL']"
        adjustment: "+25"
      - factor: "low_trust"
        condition: "entity.trust_level < L2"
        adjustment: "+20"

  escalation_thresholds:
    - risk_range: [0, 30]
      action: "allow"

    - risk_range: [31, 60]
      action: "allow_with_monitoring"
      monitoring:
        level: "enhanced"
        duration: "24h"

    - risk_range: [61, 80]
      action: "escalate"
      escalation:
        to: "supervisor"
        timeout: "2h"

    - risk_range: [81, 100]
      action: "escalate"
      escalation:
        to: "security_team"
        timeout: "1h"
        require_justification: true
```

### 8.4 Implementing Loss Scenario Mitigations

```yaml
# Loss Scenario: LS-C2 - Stale Process Model
# Mitigation: Score freshness validation

constraint_id: "MIT-LS-C2"
name: "Trust Score Freshness Check"
version: "1.0.0"
derived_from:
  loss_scenario: "LS-C2"

rule:
  # Pre-evaluation check
  preconditions:
    - name: "trust_score_freshness"
      check:
        field: "entity.trust_score_updated_at"
        operator: "within_seconds"
        value: 30
      on_failure:
        action: "refresh_and_retry"
        fallback:
          action: "apply_conservative_trust"
          trust_level: "L1"
          reason: "Stale trust score, applying conservative default"

  # Additional safeguard: detect rapid trust changes
  anomaly_detection:
    - name: "trust_spike_detection"
      condition: >
        entity.trust_score_delta_1h > 100 OR
        entity.trust_score_delta_1h < -100
      action: "flag_for_review"
      alert:
        severity: "warning"
        message: "Unusual trust score change detected"
```

### 8.5 Complete BASIS Implementation Example

```yaml
# Complete STPA-derived constraint set for financial AI agent

namespace: "financial_ai"
version: "2.0.0"
stpa_analysis: "STPA-FIN-2026-001"

# Loss definitions (from Step 1)
losses:
  L-F1: "Direct financial losses"
  L-F2: "Regulatory fines"
  L-SE1: "Loss of customer data"

# Hazard definitions (from Step 1)
hazards:
  H-F1.1:
    description: "AI executes unauthorized transaction"
    losses: [L-F1, L-F2]
  H-F1.2:
    description: "AI approves fraudulent request"
    losses: [L-F1, L-F2]
  H-SE1.1:
    description: "AI accesses customer data without authorization"
    losses: [L-SE1, L-F2]

# System constraints (from Step 1)
system_constraints:
  SC-F1.1:
    description: "Transaction limits must be enforced"
    hazards: [H-F1.1]
  SC-F1.2:
    description: "Fraud indicators must trigger review"
    hazards: [H-F1.2]
  SC-SE1.1:
    description: "Data access must be authorized"
    hazards: [H-SE1.1]

# UCAs addressed (from Step 3)
ucas_addressed:
  - "UCA-B1.2-FIN: Allowing over-limit transactions"
  - "UCA-B3.1-FIN: Not escalating suspicious transactions"
  - "UCA-B1.2-DATA: Allowing unauthorized data access"

# Loss scenarios mitigated (from Step 4)
loss_scenarios_mitigated:
  - "LS-C2: Stale trust scores"
  - "LS-PR1: AI circumvention attempts"

# Constraint implementations
constraints:
  # SC-F1.1 Implementation
  - id: "basis-fin-001"
    implements: "SC-F1.1"
    name: "Transaction Amount Limit"
    rule:
      when:
        intent_type: "financial_transaction"
      evaluate:
        - condition: "intent.amount <= entity.transaction_limit"
          result: "allow"
        - condition: "intent.amount <= entity.transaction_limit * 1.5"
          result: "escalate"
          escalation:
            to: "manager"
            timeout: "2h"
        - condition: "intent.amount > entity.transaction_limit * 1.5"
          result: "deny"
          reason: "Amount exceeds maximum escalation threshold"

  # SC-F1.2 Implementation
  - id: "basis-fin-002"
    implements: "SC-F1.2"
    name: "Fraud Indicator Detection"
    rule:
      when:
        intent_type: "financial_transaction"
      fraud_signals:
        - signal: "velocity"
          condition: "entity.transactions_1h > 10"
          weight: 25
        - signal: "amount_anomaly"
          condition: "intent.amount > entity.avg_transaction * 5"
          weight: 30
        - signal: "new_recipient"
          condition: "intent.recipient NOT IN entity.known_recipients"
          weight: 15
        - signal: "unusual_time"
          condition: "current_time NOT IN entity.normal_hours"
          weight: 10
        - signal: "geographic_anomaly"
          condition: "intent.location.distance(entity.normal_location) > 500km"
          weight: 20
      evaluation:
        - score_range: [0, 30]
          result: "allow"
        - score_range: [31, 60]
          result: "allow"
          flags: ["enhanced_monitoring"]
        - score_range: [61, 80]
          result: "escalate"
          escalation:
            to: "fraud_team"
            timeout: "30m"
        - score_range: [81, 100]
          result: "deny"
          alert:
            severity: "high"
            to: ["fraud_team", "security"]

  # SC-SE1.1 Implementation
  - id: "basis-fin-003"
    implements: "SC-SE1.1"
    name: "Customer Data Access Control"
    rule:
      when:
        intent_type: "data_access"
        data_type: "customer_data"
      evaluate:
        - condition: >
            intent.purpose IN entity.approved_data_purposes AND
            intent.customer_id IN intent.active_case_customers AND
            entity.trust_level >= L2
          result: "allow"
        - condition: >
            intent.purpose IN entity.approved_data_purposes AND
            intent.customer_id NOT IN intent.active_case_customers
          result: "escalate"
          escalation:
            to: "supervisor"
            require_justification: true
        - otherwise:
          result: "deny"
          reason: "Data access not authorized"

  # LS-C2 Mitigation
  - id: "basis-fin-004"
    implements: "MIT-LS-C2"
    name: "Trust Score Freshness"
    rule:
      precondition:
        check: "entity.trust_score_age_seconds < 60"
        on_failure:
          action: "refresh_trust_score"
          timeout: "5s"
          fallback:
            apply_trust_level: "L1"
            log: "Applied conservative trust due to stale score"

# Monitoring and feedback
monitoring:
  metrics:
    - name: "constraint_evaluation_latency"
      alert_threshold_ms: 100
    - name: "escalation_rate"
      alert_threshold_percent: 10
    - name: "trust_score_staleness"
      alert_threshold_seconds: 30

  dashboards:
    - "Financial AI Governance"
    - "STPA Constraint Health"

  audit:
    retention_days: 2555  # 7 years for financial
    required_fields:
      - "intent.*"
      - "entity.trust_level"
      - "constraint_evaluation.*"
      - "escalation.*"
```

---

## 9. STPA Templates and Worksheets

### 9.1 Loss Identification Worksheet

```
┌─────────────────────────────────────────────────────────────────────┐
│                    LOSS IDENTIFICATION WORKSHEET                     │
├─────────────────────────────────────────────────────────────────────┤
│ System: ___________________________ Date: ____________              │
│ Analyst: __________________________ Version: _________              │
├─────────────────────────────────────────────────────────────────────┤
│ INSTRUCTIONS: For each category, identify specific losses that      │
│ stakeholders want to avoid. Rate severity 1-5 (5=catastrophic).    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ SAFETY LOSSES                                                        │
│ ┌─────┬──────────────────────────────────────────┬─────────────┐    │
│ │ ID  │ Description                              │ Severity    │    │
│ ├─────┼──────────────────────────────────────────┼─────────────┤    │
│ │L-S1 │                                          │             │    │
│ │L-S2 │                                          │             │    │
│ │L-S3 │                                          │             │    │
│ └─────┴──────────────────────────────────────────┴─────────────┘    │
│                                                                      │
│ SECURITY LOSSES                                                      │
│ ┌─────┬──────────────────────────────────────────┬─────────────┐    │
│ │ ID  │ Description                              │ Severity    │    │
│ ├─────┼──────────────────────────────────────────┼─────────────┤    │
│ │L-SE1│                                          │             │    │
│ │L-SE2│                                          │             │    │
│ │L-SE3│                                          │             │    │
│ └─────┴──────────────────────────────────────────┴─────────────┘    │
│                                                                      │
│ FINANCIAL LOSSES                                                     │
│ ┌─────┬──────────────────────────────────────────┬─────────────┐    │
│ │ ID  │ Description                              │ Severity    │    │
│ ├─────┼──────────────────────────────────────────┼─────────────┤    │
│ │L-F1 │                                          │             │    │
│ │L-F2 │                                          │             │    │
│ │L-F3 │                                          │             │    │
│ └─────┴──────────────────────────────────────────┴─────────────┘    │
│                                                                      │
│ OPERATIONAL LOSSES                                                   │
│ ┌─────┬──────────────────────────────────────────┬─────────────┐    │
│ │ ID  │ Description                              │ Severity    │    │
│ ├─────┼──────────────────────────────────────────┼─────────────┤    │
│ │L-O1 │                                          │             │    │
│ │L-O2 │                                          │             │    │
│ │L-O3 │                                          │             │    │
│ └─────┴──────────────────────────────────────────┴─────────────┘    │
│                                                                      │
│ COMPLIANCE/LEGAL LOSSES                                              │
│ ┌─────┬──────────────────────────────────────────┬─────────────┐    │
│ │ ID  │ Description                              │ Severity    │    │
│ ├─────┼──────────────────────────────────────────┼─────────────┤    │
│ │L-C1 │                                          │             │    │
│ │L-C2 │                                          │             │    │
│ │L-C3 │                                          │             │    │
│ └─────┴──────────────────────────────────────────┴─────────────┘    │
│                                                                      │
│ STAKEHOLDERS CONSULTED:                                              │
│ [ ] Executives    [ ] Operations    [ ] Security                    │
│ [ ] Legal         [ ] Compliance    [ ] End Users                   │
│ [ ] Regulators    [ ] Partners      [ ] ___________                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.2 Hazard Derivation Worksheet

```
┌─────────────────────────────────────────────────────────────────────┐
│                    HAZARD DERIVATION WORKSHEET                       │
├─────────────────────────────────────────────────────────────────────┤
│ System: ___________________________ Date: ____________              │
├─────────────────────────────────────────────────────────────────────┤
│ INSTRUCTIONS: For each loss, identify system states (hazards) that  │
│ could lead to that loss. A hazard combined with worst-case          │
│ environment leads to the loss.                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ Loss: _________________ (ID: _____)                                 │
│                                                                      │
│ ┌──────┬────────────────────────────────────┬───────────────────┐   │
│ │Hazard│ System State Description           │Worst-Case Scenario│   │
│ │  ID  │                                    │                   │   │
│ ├──────┼────────────────────────────────────┼───────────────────┤   │
│ │      │                                    │                   │   │
│ │      │                                    │                   │   │
│ │      │                                    │                   │   │
│ │      │                                    │                   │   │
│ └──────┴────────────────────────────────────┴───────────────────┘   │
│                                                                      │
│ Loss: _________________ (ID: _____)                                 │
│                                                                      │
│ ┌──────┬────────────────────────────────────┬───────────────────┐   │
│ │Hazard│ System State Description           │Worst-Case Scenario│   │
│ │  ID  │                                    │                   │   │
│ ├──────┼────────────────────────────────────┼───────────────────┤   │
│ │      │                                    │                   │   │
│ │      │                                    │                   │   │
│ │      │                                    │                   │   │
│ │      │                                    │                   │   │
│ └──────┴────────────────────────────────────┴───────────────────┘   │
│                                                                      │
│ DERIVED SYSTEM CONSTRAINTS:                                          │
│ For each hazard, state the constraint that prevents it:              │
│                                                                      │
│ ┌──────────┬──────────┬────────────────────────────────────────┐    │
│ │Constraint│  Hazard  │ Constraint Statement                    │    │
│ │    ID    │   ID     │ "The system must/must not..."          │    │
│ ├──────────┼──────────┼────────────────────────────────────────┤    │
│ │          │          │                                        │    │
│ │          │          │                                        │    │
│ │          │          │                                        │    │
│ │          │          │                                        │    │
│ └──────────┴──────────┴────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.3 UCA Analysis Table

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    UCA ANALYSIS TABLE                                                      │
├───────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Controller: ___________________________ Control Action: ___________________________                       │
├───────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                            │
│ ┌─────────────┬─────────────────────┬─────────────────────┬─────────────────────┬─────────────────────┐   │
│ │   Context   │ Not Providing       │ Providing           │ Wrong Timing        │ Stopped Too Soon/   │   │
│ │             │ Causes Hazard       │ Causes Hazard       │ or Order            │ Applied Too Long    │   │
│ ├─────────────┼─────────────────────┼─────────────────────┼─────────────────────┼─────────────────────┤   │
│ │             │                     │                     │                     │                     │   │
│ │ Context 1:  │ UCA-___:            │ UCA-___:            │ UCA-___:            │ UCA-___:            │   │
│ │             │                     │                     │                     │                     │   │
│ │ ________    │ Hazard(s): ______   │ Hazard(s): ______   │ Hazard(s): ______   │ Hazard(s): ______   │   │
│ │             │                     │                     │                     │                     │   │
│ ├─────────────┼─────────────────────┼─────────────────────┼─────────────────────┼─────────────────────┤   │
│ │             │                     │                     │                     │                     │   │
│ │ Context 2:  │ UCA-___:            │ UCA-___:            │ UCA-___:            │ UCA-___:            │   │
│ │             │                     │                     │                     │                     │   │
│ │ ________    │ Hazard(s): ______   │ Hazard(s): ______   │ Hazard(s): ______   │ Hazard(s): ______   │   │
│ │             │                     │                     │                     │                     │   │
│ ├─────────────┼─────────────────────┼─────────────────────┼─────────────────────┼─────────────────────┤   │
│ │             │                     │                     │                     │                     │   │
│ │ Context 3:  │ UCA-___:            │ UCA-___:            │ UCA-___:            │ UCA-___:            │   │
│ │             │                     │                     │                     │                     │   │
│ │ ________    │ Hazard(s): ______   │ Hazard(s): ______   │ Hazard(s): ______   │ Hazard(s): ______   │   │
│ │             │                     │                     │                     │                     │   │
│ └─────────────┴─────────────────────┴─────────────────────┴─────────────────────┴─────────────────────┘   │
│                                                                                                            │
│ UCA DETAILS (for each UCA identified above):                                                               │
│                                                                                                            │
│ UCA ID: ________                                                                                           │
│ Description: __________________________________________________________________                            │
│ Related Hazard(s): ____________________________________________________________                            │
│ Related Constraint(s): ________________________________________________________                            │
│ Severity: [ ] Low  [ ] Medium  [ ] High  [ ] Critical                                                     │
│                                                                                                            │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 9.4 Loss Scenario Worksheet

```
┌─────────────────────────────────────────────────────────────────────┐
│                    LOSS SCENARIO WORKSHEET                           │
├─────────────────────────────────────────────────────────────────────┤
│ UCA: _________________________________ (ID: ________)               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ CONTROLLER-RELATED SCENARIOS                                         │
│ Why might the controller give this unsafe control action?            │
│                                                                      │
│ ┌──────┬───────────────────────────────┬──────────────────────────┐ │
│ │LS ID │ Scenario Description          │ Causal Factors           │ │
│ ├──────┼───────────────────────────────┼──────────────────────────┤ │
│ │      │ Algorithm flaw:               │                          │ │
│ │      │                               │                          │ │
│ ├──────┼───────────────────────────────┼──────────────────────────┤ │
│ │      │ Process model incorrect:      │                          │ │
│ │      │                               │                          │ │
│ ├──────┼───────────────────────────────┼──────────────────────────┤ │
│ │      │ Process model incomplete:     │                          │ │
│ │      │                               │                          │ │
│ └──────┴───────────────────────────────┴──────────────────────────┘ │
│                                                                      │
│ CONTROL PATH SCENARIOS                                               │
│ Why might the control action not be executed properly?               │
│                                                                      │
│ ┌──────┬───────────────────────────────┬──────────────────────────┐ │
│ │LS ID │ Scenario Description          │ Causal Factors           │ │
│ ├──────┼───────────────────────────────┼──────────────────────────┤ │
│ │      │ Not executed:                 │                          │ │
│ │      │                               │                          │ │
│ ├──────┼───────────────────────────────┼──────────────────────────┤ │
│ │      │ Delayed:                      │                          │ │
│ │      │                               │                          │ │
│ ├──────┼───────────────────────────────┼──────────────────────────┤ │
│ │      │ Incorrectly executed:         │                          │ │
│ │      │                               │                          │ │
│ └──────┴───────────────────────────────┴──────────────────────────┘ │
│                                                                      │
│ FEEDBACK SCENARIOS                                                   │
│ Why might feedback be inadequate?                                    │
│                                                                      │
│ ┌──────┬───────────────────────────────┬──────────────────────────┐ │
│ │LS ID │ Scenario Description          │ Causal Factors           │ │
│ ├──────┼───────────────────────────────┼──────────────────────────┤ │
│ │      │ Feedback missing:             │                          │ │
│ │      │                               │                          │ │
│ ├──────┼───────────────────────────────┼──────────────────────────┤ │
│ │      │ Feedback incorrect:           │                          │ │
│ │      │                               │                          │ │
│ ├──────┼───────────────────────────────┼──────────────────────────┤ │
│ │      │ Feedback delayed:             │                          │ │
│ │      │                               │                          │ │
│ └──────┴───────────────────────────────┴──────────────────────────┘ │
│                                                                      │
│ MITIGATIONS                                                          │
│                                                                      │
│ ┌──────┬────────────┬───────────────────────┬──────────────────────┐│
│ │LS ID │ Mitigation │ Implementation        │ Effectiveness       ││
│ ├──────┼────────────┼───────────────────────┼──────────────────────┤│
│ │      │            │                       │                      ││
│ │      │            │                       │                      ││
│ │      │            │                       │                      ││
│ └──────┴────────────┴───────────────────────┴──────────────────────┘│
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.5 BASIS Rule Mapping Template

```yaml
# STPA to BASIS Rule Mapping Template
# Use this template to systematically convert STPA analysis to BASIS rules

stpa_mapping:
  analysis_id: ""  # STPA analysis identifier
  system: ""       # System being analyzed
  version: ""      # Analysis version
  date: ""         # Analysis date
  analysts: []     # List of analysts

# For each constraint from STPA Step 1
constraints:
  - stpa_constraint_id: "SC-xxx"
    stpa_constraint: ""  # Natural language constraint statement
    derived_from:
      hazard_ids: []     # Related hazard IDs
      loss_ids: []       # Related loss IDs

    basis_rule:
      rule_id: ""        # BASIS rule identifier
      name: ""           # Human-readable name
      namespace: ""      # BASIS namespace
      version: ""        # Rule version

      # Rule trigger conditions
      when:
        intent_type: ""  # Intent type that triggers this rule
        additional_conditions: []  # Additional trigger conditions

      # Evaluation logic
      evaluate:
        - condition: ""  # Condition expression
          result: ""     # allow/deny/escalate/monitor
          reason: ""     # Human-readable reason

      # Evidence to capture for PROOF
      evidence:
        capture: []      # Fields to capture

      # Testing requirements
      test_cases:
        - description: ""
          input: {}
          expected_result: ""

# For each UCA from STPA Step 3
uca_mitigations:
  - stpa_uca_id: "UCA-xxx"
    stpa_uca: ""         # UCA description
    uca_type: ""         # not_providing/providing/timing/duration
    related_hazards: []  # Hazard IDs

    basis_mitigation:
      rule_ids: []       # BASIS rules that mitigate this UCA
      additional_controls: []  # Non-BASIS controls
      verification: ""   # How to verify mitigation works

# For each Loss Scenario from STPA Step 4
loss_scenario_mitigations:
  - stpa_ls_id: "LS-xxx"
    stpa_ls: ""          # Loss scenario description
    category: ""         # controller/path/process/feedback
    causal_factors: []   # Contributing factors

    basis_mitigation:
      rule_ids: []       # BASIS rules that mitigate
      monitoring: []     # Metrics to monitor
      alerts: []         # Alert configurations
      recovery: ""       # Recovery procedure
```

---

## 10. Case Studies

### 10.1 Case Study: Customer Service AI Agent

**Scenario:** An AI agent handles customer service inquiries, with ability to issue refunds, access customer data, and escalate to human agents.

#### Step 1: Losses and Hazards

```yaml
Losses:
  L1: "Financial loss from unauthorized refunds"
  L2: "Customer data breach"
  L3: "Customer dissatisfaction from poor service"
  L4: "Regulatory fines (GDPR, CCPA)"

Hazards:
  H1: "AI issues refund without valid justification"
  H2: "AI accesses customer data beyond inquiry scope"
  H3: "AI provides incorrect information to customer"
  H4: "AI fails to escalate when human judgment needed"

Constraints:
  SC1: "Refunds must have documented valid reason"
  SC2: "Data access limited to current inquiry context"
  SC3: "Responses must be verified against knowledge base"
  SC4: "Complex/sensitive inquiries must escalate to human"
```

#### Step 2: Control Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│                CUSTOMER SERVICE AI CONTROL STRUCTURE                 │
└─────────────────────────────────────────────────────────────────────┘

              ┌──────────────────────────────────┐
              │     Customer Service Manager      │
              │     (Policy, Escalation Review)   │
              └────────────────┬─────────────────┘
                               │
              ┌────────────────▼─────────────────┐
              │          Vorion Platform          │
              │  ┌─────────────────────────────┐ │
              │  │ Process Model:              │ │
              │  │ - Customer inquiry context  │ │
              │  │ - Refund policy rules       │ │
              │  │ - Data access permissions   │ │
              │  │ - Escalation criteria       │ │
              │  └─────────────────────────────┘ │
              └────────────────┬─────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
         ▼                     ▼                     ▼
   ┌───────────┐         ┌───────────┐         ┌───────────┐
   │  ALLOW    │         │   DENY    │         │ ESCALATE  │
   │  Action   │         │  Action   │         │ to Human  │
   └─────┬─────┘         └─────┬─────┘         └─────┬─────┘
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               │
              ┌────────────────▼─────────────────┐
              │           Cognigate               │
              │    (Execution Enforcement)        │
              └────────────────┬─────────────────┘
                               │
              ┌────────────────▼─────────────────┐
              │      Customer Service AI          │
              │  - Process inquiry                │
              │  - Issue refunds                  │
              │  - Access customer data           │
              │  - Generate responses             │
              └────────────────┬─────────────────┘
                               │
              ┌────────────────▼─────────────────┐
              │   PROOF + Trust Engine            │
              │  - Record all actions             │
              │  - Track refund patterns          │
              │  - Monitor data access            │
              │  - Detect anomalies               │
              └──────────────────────────────────┘
```

#### Step 3: Unsafe Control Actions

| Control Action | Not Providing | Providing | Timing | Duration |
|----------------|---------------|-----------|--------|----------|
| **Allow Refund** | Not allowing legitimate refund frustrates customer [H4] | Allowing refund without valid reason [H1] | Allowing before verification complete [H1] | N/A |
| **Deny Refund** | Not denying fraudulent refund [H1] | Denying legitimate refund [H4] | Denying after refund processed [H1] | N/A |
| **Access Data** | Not providing needed data delays resolution [H4] | Accessing data outside inquiry scope [H2] | Accessing before consent verified [H2] | Retaining access after inquiry closed [H2] |
| **Escalate** | Not escalating sensitive issue [H4] | Escalating simple issue wastes resources [H3] | Escalating after AI already responded [H3, H4] | N/A |

#### Step 4: Loss Scenarios and Mitigations

```yaml
Loss_Scenarios:
  LS1:
    uca: "Allowing refund without valid reason"
    scenarios:
      - description: "AI convinced by social engineering"
        mitigation: "Require objective evidence (order status, tracking)"
      - description: "Refund policy rules incomplete"
        mitigation: "Regular policy review, edge case logging"
      - description: "Customer manipulates context"
        mitigation: "Independent data verification"

  LS2:
    uca: "Accessing data outside inquiry scope"
    scenarios:
      - description: "AI infers 'helpful' to access more data"
        mitigation: "Strict data minimization in Cognigate"
      - description: "Customer inquiry scope unclear"
        mitigation: "Explicit scope definition per inquiry type"
      - description: "Data classification incorrect"
        mitigation: "Automated data classification validation"
```

#### BASIS Implementation

```yaml
namespace: "customer_service"
version: "1.0.0"

constraints:
  # SC1: Refund justification required
  - id: "cs-refund-001"
    name: "Refund Justification Check"
    when:
      intent_type: "issue_refund"
    evaluate:
      - condition: >
          intent.refund_reason IN approved_reasons AND
          (
            (intent.refund_reason == 'defective' AND order.has_defect_report) OR
            (intent.refund_reason == 'not_delivered' AND order.delivery_status != 'delivered') OR
            (intent.refund_reason == 'wrong_item' AND order.has_wrong_item_report) OR
            (intent.refund_reason == 'customer_request' AND order.within_return_window)
          )
        result: "allow"
      - condition: "intent.amount > 100"
        result: "escalate"
        escalation:
          to: "refund_approver"
          timeout: "2h"
      - otherwise:
        result: "deny"
        reason: "Refund reason not validated"

  # SC2: Data access scope
  - id: "cs-data-001"
    name: "Inquiry Scope Data Access"
    when:
      intent_type: "access_customer_data"
    evaluate:
      - condition: >
          intent.data_fields ALL IN inquiry.authorized_fields AND
          intent.customer_id == inquiry.customer_id
        result: "allow"
      - otherwise:
        result: "deny"
        reason: "Data access outside inquiry scope"
    post_action:
      - "revoke_access_on_inquiry_close"

  # SC4: Escalation criteria
  - id: "cs-escalate-001"
    name: "Mandatory Escalation"
    when:
      intent_type: "respond_to_customer"
    evaluate:
      - condition: >
          inquiry.sentiment_score < -0.7 OR
          inquiry.contains_legal_threat OR
          inquiry.mentions_regulatory_body OR
          inquiry.request_type IN ['account_closure', 'data_deletion', 'formal_complaint']
        result: "escalate"
        escalation:
          to: "human_agent"
          priority: "high"
      - otherwise:
        result: "allow"
```

### 10.2 Case Study: Financial Trading AI

**Scenario:** An AI agent executes trades on behalf of customers within defined risk parameters.

#### STPA Analysis Summary

```yaml
System: "Algorithmic Trading AI"
Analysis_ID: "STPA-TRADE-2026-001"

Losses:
  L1: "Customer financial loss exceeding risk tolerance"
  L2: "Regulatory violation (market manipulation)"
  L3: "System integrity compromise"
  L4: "Reputational damage from trading errors"

Hazards:
  H1: "AI executes trade exceeding position limits"
  H2: "AI executes trade violating customer risk profile"
  H3: "AI executes pattern constituting market manipulation"
  H4: "AI fails to execute stop-loss order"

Critical_UCAs:
  UCA1: "Allowing trade when position limit exceeded"
  UCA2: "Allowing trade inconsistent with risk profile"
  UCA3: "Not executing stop-loss when threshold breached"
  UCA4: "Allowing rapid-fire trades (potential manipulation)"

Key_Loss_Scenarios:
  LS1: "Stale position data leads to over-limit trade"
  LS2: "Risk profile not updated after customer preference change"
  LS3: "Stop-loss order stuck in queue during volatility"
  LS4: "AI learning aggressive strategy from historical data"
```

#### BASIS Implementation Highlights

```yaml
namespace: "trading_ai"
version: "2.0.0"

constraints:
  # Position limit enforcement
  - id: "trade-001"
    name: "Position Limit Check"
    when:
      intent_type: "execute_trade"
    preconditions:
      - check: "position_data_age_ms < 100"
        on_failure:
          action: "refresh_and_retry"
    evaluate:
      - condition: >
          (current_position + intent.quantity) <= customer.position_limit AND
          (current_position + intent.quantity) <= regulatory.position_limit
        result: "allow"
      - otherwise:
        result: "deny"
        alert:
          severity: "high"
          to: ["risk_team", "compliance"]

  # Stop-loss priority
  - id: "trade-002"
    name: "Stop-Loss Priority"
    when:
      order_type: "stop_loss"
    evaluate:
      - condition: "true"  # Always allow stop-loss
        result: "allow"
        priority: "critical"
        bypass_queue: true

  # Anti-manipulation
  - id: "trade-003"
    name: "Pattern Detection"
    when:
      intent_type: "execute_trade"
    evaluate:
      - condition: >
          entity.trades_last_minute > 100 OR
          entity.wash_trade_indicator > 0.8 OR
          entity.layering_indicator > 0.8
        result: "deny"
        alert:
          severity: "critical"
          to: ["compliance", "security"]
          regulatory_report: true
```

---

## 11. Integration with Vorion Components

### 11.1 STPA-INTENT Integration

INTENT submissions should capture STPA-relevant context:

```python
from vorion import VorionClient, Intent

client = VorionClient()

# Intent with STPA-relevant metadata
intent = Intent(
    goal="Process customer refund",
    context={
        "customer_id": "cust_123",
        "order_id": "ord_456",
        "refund_amount": 150.00,
        "refund_reason": "defective_product",
        "evidence": {
            "defect_report_id": "def_789",
            "photos_attached": True
        }
    },
    # STPA metadata for traceability
    stpa_context={
        "applicable_constraints": ["SC-F1.1", "SC-F1.2"],
        "hazard_context": {
            "H-F1.1": "refund_amount > threshold",
            "H-F1.2": "first_refund_for_customer"
        },
        "risk_factors": {
            "amount_risk": "medium",
            "frequency_risk": "low",
            "pattern_risk": "low"
        }
    }
)

result = client.intents.submit(intent)
```

### 11.2 STPA-PROOF Integration

PROOF records should capture constraint evaluation details:

```yaml
proof_record:
  proof_id: "prf_abc123"
  intent_id: "int_xyz789"
  timestamp: "2026-01-08T14:30:00Z"

  stpa_evaluation:
    constraints_evaluated:
      - constraint_id: "SC-F1.1"
        constraint_name: "Transaction Limit"
        result: "passed"
        evaluation_data:
          amount: 150.00
          limit: 500.00
          margin: 350.00

      - constraint_id: "SC-F1.2"
        constraint_name: "Fraud Detection"
        result: "passed"
        evaluation_data:
          fraud_score: 0.12
          threshold: 0.70
          signals_checked: 5

    ucas_prevented:
      - "UCA-B1.2-FIN: Over-limit transaction"
      - "UCA-B1.2-FRAUD: Fraudulent transaction"

    loss_scenarios_mitigated:
      - "LS-C2: Stale trust score (freshness verified)"

  decision:
    action: "allow"
    confidence: 0.95
    human_review_required: false
```

### 11.3 STPA-Trust Engine Integration

Trust scoring should incorporate STPA-relevant signals:

```yaml
trust_signals_stpa:
  constraint_compliance:
    weight: 0.30
    signals:
      - name: "constraint_violation_rate"
        description: "Rate of constraint violations over time"
        calculation: "violations / total_intents"
        impact: "negative"

      - name: "near_miss_rate"
        description: "Rate of intents that nearly violated constraints"
        calculation: "near_misses / total_intents"
        impact: "warning"

      - name: "escalation_approval_rate"
        description: "Rate of escalations that were approved"
        calculation: "approved_escalations / total_escalations"
        impact: "positive"

  hazard_proximity:
    weight: 0.20
    signals:
      - name: "risk_headroom"
        description: "Average margin to constraint limits"
        calculation: "avg(limit - actual) / limit"
        impact: "positive"

      - name: "high_risk_action_rate"
        description: "Rate of high-risk actions"
        calculation: "high_risk_intents / total_intents"
        impact: "neutral_to_negative"

  safety_behavior:
    weight: 0.15
    signals:
      - name: "voluntary_escalation_rate"
        description: "Rate of self-escalations (good safety culture)"
        calculation: "voluntary_escalations / eligible_intents"
        impact: "positive"

      - name: "context_completeness"
        description: "Completeness of provided context"
        calculation: "avg(provided_fields / required_fields)"
        impact: "positive"
```

### 11.4 STPA Dashboard Integration

```yaml
stpa_dashboard:
  name: "STPA Governance Health"
  refresh_interval: "1m"

  panels:
    - title: "Constraint Health"
      type: "heatmap"
      metrics:
        - "constraint_evaluation_pass_rate"
        - "constraint_evaluation_latency_p99"
        - "constraint_rule_errors"
      grouping: "by_constraint_id"

    - title: "UCA Prevention"
      type: "counter"
      metrics:
        - "ucas_prevented_total"
        - "ucas_prevented_by_type"
        - "uca_near_misses"

    - title: "Loss Scenario Indicators"
      type: "gauge"
      metrics:
        - name: "trust_score_staleness"
          thresholds: [10, 30, 60]
          unit: "seconds"
        - name: "feedback_loop_latency"
          thresholds: [100, 500, 1000]
          unit: "ms"
        - name: "control_path_reliability"
          thresholds: [0.99, 0.95, 0.90]
          unit: "ratio"

    - title: "Control Structure Health"
      type: "diagram"
      elements:
        - "controller_status"
        - "actuator_status"
        - "sensor_status"
        - "feedback_channel_status"

    - title: "Hazard Proximity"
      type: "timeseries"
      metrics:
        - "distance_to_constraint_limit"
        - "risk_score_trend"
        - "anomaly_detection_score"
```

---

## 12. Continuous STPA Process

### 12.1 STPA Lifecycle

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CONTINUOUS STPA LIFECYCLE                         │
└─────────────────────────────────────────────────────────────────────┘

     ┌─────────────────────────────────────────────────────────────┐
     │                                                              │
     │    ┌──────────┐      ┌──────────┐      ┌──────────┐        │
     │    │  PLAN    │      │   DO     │      │  CHECK   │        │
     │    │          │ ───► │          │ ───► │          │        │
     │    │ Analyze  │      │Implement │      │ Monitor  │        │
     │    │ hazards  │      │ controls │      │ outcomes │        │
     │    └──────────┘      └──────────┘      └────┬─────┘        │
     │         ▲                                    │              │
     │         │            ┌──────────┐           │              │
     │         │            │   ACT    │           │              │
     │         └─────────── │          │ ◄─────────┘              │
     │                      │  Update  │                          │
     │                      │ analysis │                          │
     │                      └──────────┘                          │
     │                                                              │
     └─────────────────────────────────────────────────────────────┘

TRIGGERS FOR STPA UPDATE:
─────────────────────────
• New AI capability added
• Constraint violation incident
• Near-miss detection
• Regulatory change
• Architecture change
• Quarterly review cycle
```

### 12.2 STPA Review Checklist

```yaml
stpa_review_checklist:
  frequency: "quarterly"

  loss_review:
    - question: "Have stakeholder priorities changed?"
      action: "Review loss severity rankings"
    - question: "Are there new loss categories to consider?"
      action: "Interview stakeholders for emerging concerns"
    - question: "Have any losses actually occurred?"
      action: "Conduct incident analysis"

  hazard_review:
    - question: "Are existing hazards still relevant?"
      action: "Review hazard-loss linkages"
    - question: "Have new hazards emerged?"
      action: "Analyze incidents and near-misses"
    - question: "Have hazard severities changed?"
      action: "Update risk assessments"

  control_structure_review:
    - question: "Has the architecture changed?"
      action: "Update control structure diagram"
    - question: "Are control actions still valid?"
      action: "Review control action inventory"
    - question: "Are feedback loops effective?"
      action: "Analyze feedback latency and accuracy"

  uca_review:
    - question: "Have any UCAs occurred?"
      action: "Incident root cause analysis"
    - question: "Are UCA contexts still accurate?"
      action: "Review context conditions"
    - question: "Are there new UCA types?"
      action: "Expand UCA analysis"

  loss_scenario_review:
    - question: "Have loss scenarios manifested?"
      action: "Update scenario likelihood"
    - question: "Are mitigations effective?"
      action: "Review mitigation metrics"
    - question: "Are there new scenarios?"
      action: "Conduct brainstorming session"

  implementation_review:
    - question: "Are BASIS rules current?"
      action: "Audit rule coverage vs constraints"
    - question: "Is monitoring adequate?"
      action: "Review dashboard and alert coverage"
    - question: "Is evidence complete?"
      action: "Audit PROOF records"
```

### 12.3 Incident-Driven STPA Update

When a safety-related incident occurs:

```yaml
incident_stpa_process:
  immediate:
    - action: "Stabilize system"
    - action: "Preserve evidence"
    - action: "Notify stakeholders"

  analysis:
    - step: "Identify the loss that occurred"
      output: "Loss classification"
    - step: "Trace back to hazard state"
      output: "Hazard identification"
    - step: "Identify control action that failed"
      output: "UCA classification"
    - step: "Determine why control action failed"
      output: "Loss scenario identification"
    - step: "Identify causal factors"
      output: "Root cause analysis"

  update_stpa:
    - action: "Add incident as example to relevant UCA"
    - action: "Update loss scenario likelihood"
    - action: "Review and strengthen mitigations"
    - action: "Add new constraints if needed"
    - action: "Update process model if flawed"

  implement:
    - action: "Update BASIS rules"
    - action: "Add monitoring for identified gaps"
    - action: "Test new controls"
    - action: "Document changes"

  verify:
    - action: "Confirm controls prevent recurrence"
    - action: "Update STPA documentation"
    - action: "Communicate lessons learned"
```

### 12.4 Metrics for STPA Program Health

```yaml
stpa_program_metrics:
  coverage_metrics:
    - name: "constraint_coverage"
      calculation: "constraints_with_rules / total_constraints"
      target: ">= 1.0"

    - name: "uca_monitoring_coverage"
      calculation: "ucas_with_detection / total_ucas"
      target: ">= 0.95"

    - name: "loss_scenario_mitigation_coverage"
      calculation: "scenarios_with_mitigation / total_scenarios"
      target: ">= 0.90"

  effectiveness_metrics:
    - name: "constraint_violation_rate"
      calculation: "violations / evaluations"
      target: "< 0.001"

    - name: "uca_occurrence_rate"
      calculation: "uca_incidents / total_actions"
      target: "< 0.0001"

    - name: "mitigation_effectiveness"
      calculation: "prevented_incidents / potential_incidents"
      target: ">= 0.99"

  process_metrics:
    - name: "stpa_update_frequency"
      calculation: "updates_per_quarter"
      target: ">= 1"

    - name: "time_to_update_after_incident"
      calculation: "avg_days_to_stpa_update"
      target: "< 14 days"

    - name: "stakeholder_review_completion"
      calculation: "completed_reviews / scheduled_reviews"
      target: ">= 0.95"
```

---

## 13. Advanced Topics

### 13.1 STPA for Multi-Agent Systems

When multiple AI agents interact:

```
┌─────────────────────────────────────────────────────────────────────┐
│              MULTI-AGENT CONTROL STRUCTURE                           │
└─────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────┐
                    │    Orchestrator Agent   │
                    │    (Coordination)       │
                    └───────────┬─────────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         │                      │                      │
         ▼                      ▼                      ▼
  ┌─────────────┐       ┌─────────────┐       ┌─────────────┐
  │  Agent A    │◄─────►│  Agent B    │◄─────►│  Agent C    │
  │  (Task X)   │       │  (Task Y)   │       │  (Task Z)   │
  └──────┬──────┘       └──────┬──────┘       └──────┬──────┘
         │                     │                     │
         │    ┌────────────────┼────────────────┐   │
         │    │                │                │   │
         ▼    ▼                ▼                ▼   ▼
  ┌─────────────────────────────────────────────────────────┐
  │                    Vorion Platform                       │
  │  ┌─────────────────────────────────────────────────┐    │
  │  │              Multi-Agent Constraints             │    │
  │  │  • Inter-agent communication rules               │    │
  │  │  • Collective action limits                      │    │
  │  │  • Coordination constraints                      │    │
  │  │  • Emergent behavior detection                   │    │
  │  └─────────────────────────────────────────────────┘    │
  └─────────────────────────────────────────────────────────┘
```

**Multi-Agent UCAs:**

```yaml
multi_agent_ucas:
  coordination:
    - uca: "Agents execute conflicting actions"
      mitigation: "Coordination constraint in BASIS"
    - uca: "Agents amplify each other's errors"
      mitigation: "Cross-agent validation"
    - uca: "Collective action exceeds individual limits"
      mitigation: "Aggregate limit tracking"

  communication:
    - uca: "Agent accepts malicious input from another agent"
      mitigation: "Inter-agent authentication"
    - uca: "Agent propagates incorrect information"
      mitigation: "Information provenance tracking"
```

### 13.2 STPA for Learning Systems

When AI systems learn and adapt:

```yaml
learning_system_stpa:
  additional_hazards:
    H-L1: "Model learns harmful behavior from data"
    H-L2: "Model performance degrades undetected"
    H-L3: "Model learns to game evaluation metrics"
    H-L4: "Model capabilities exceed control assumptions"

  additional_constraints:
    SC-L1: "Training data must be validated"
    SC-L2: "Model performance must be continuously monitored"
    SC-L3: "Evaluation must use diverse, unannounced metrics"
    SC-L4: "Capability changes must trigger constraint review"

  control_structure_additions:
    learning_controller:
      inputs:
        - "Training data stream"
        - "Performance metrics"
        - "Capability assessments"
      outputs:
        - "Allow/block training update"
        - "Trigger capability review"
        - "Revert to previous model"
      process_model:
        - "Expected performance range"
        - "Capability boundaries"
        - "Training data characteristics"

  learning_specific_ucas:
    - uca: "Allowing training update that introduces bias"
    - uca: "Not detecting capability expansion"
    - uca: "Allowing deployment of degraded model"
```

### 13.3 STPA for Autonomous Operations

When AI operates with high autonomy:

```yaml
autonomous_operations_stpa:
  autonomy_levels:
    L0: "Full human control"
    L1: "AI suggests, human decides"
    L2: "AI decides, human approves"
    L3: "AI decides, human informed"
    L4: "Full AI autonomy"

  level_specific_constraints:
    L3_constraints:
      - "Human must be notified within 100ms of decision"
      - "Human must have override capability"
      - "Decision must be reversible for 5 minutes"
      - "AI must explain decision on demand"

    L4_constraints:
      - "Action must be within pre-approved envelope"
      - "Anomaly detection must be active"
      - "Automatic escalation on uncertainty"
      - "Periodic human review required"

  autonomy_specific_ucas:
    - uca: "Operating at higher autonomy than authorized"
    - uca: "Not downgrading autonomy when conditions warrant"
    - uca: "Escalating to human when situation requires immediate action"

  dynamic_autonomy_control:
    triggers_for_reduction:
      - "Trust score drops below threshold"
      - "Anomaly detected"
      - "Environment changes significantly"
      - "Error rate exceeds threshold"
    triggers_for_increase:
      - "Sustained high performance"
      - "Human approval"
      - "Controlled expansion protocol complete"
```

### 13.4 Formal Verification of STPA Controls

For high-assurance systems:

```yaml
formal_verification:
  approach: "Model checking of BASIS rules"

  properties_to_verify:
    safety:
      - property: "No constraint violation leads to hazard"
        formalism: "AG(violation -> !hazard)"
      - property: "All hazards have active constraints"
        formalism: "AG(hazard -> exists_constraint)"

    liveness:
      - property: "Valid intents eventually processed"
        formalism: "AG(valid_intent -> AF(processed))"
      - property: "Escalations eventually resolved"
        formalism: "AG(escalated -> AF(resolved))"

    completeness:
      - property: "All control actions have evaluation paths"
        formalism: "AG(control_action -> exists_evaluation)"
      - property: "All UCAs have mitigations"
        formalism: "AG(uca_condition -> mitigation_active)"

  verification_tools:
    - tool: "SPIN model checker"
      use: "Control flow verification"
    - tool: "Z3 SMT solver"
      use: "Constraint satisfaction"
    - tool: "TLA+"
      use: "Concurrent behavior"
```

---

## 14. Appendices

### 14.1 Glossary

| Term | Definition |
|------|------------|
| **STPA** | Systems-Theoretic Process Analysis - hazard analysis based on control theory |
| **Loss** | Something of value that stakeholders want to avoid losing |
| **Hazard** | System state that, combined with environment, leads to loss |
| **Constraint** | Behavioral requirement that must be enforced to prevent hazard |
| **Control Action** | Action taken by controller to affect controlled process |
| **UCA** | Unsafe Control Action - control action that leads to hazard |
| **Loss Scenario** | Causal path from normal operation to loss |
| **Controller** | Component that makes decisions about control actions |
| **Actuator** | Component that implements control actions |
| **Sensor** | Component that observes controlled process |
| **Process Model** | Controller's beliefs about the controlled process |
| **Control Structure** | Hierarchical arrangement of controllers and controlled processes |

### 14.2 References

1. Leveson, N. G. (2011). *Engineering a Safer World: Systems Thinking Applied to Safety*. MIT Press.
2. Leveson, N. G., & Thomas, J. P. (2018). *STPA Handbook*.
3. ISO 21448:2022 - Safety of the Intended Functionality (SOTIF)
4. ISO/IEC 23894:2023 - AI Risk Management
5. NIST AI RMF 1.0 (2023) - AI Risk Management Framework
6. EU AI Act (2024) - Regulation on Artificial Intelligence

### 14.3 Tool Support

| Tool | Purpose | URL |
|------|---------|-----|
| XSTAMPP | STPA analysis tool | https://xstampp.2022.2.2 |
| SafetyHAT | Hazard analysis | Internal tooling |
| Vorion BASIS IDE | Constraint authoring | https://ide.vorion.io |
| Vorion Dashboard | Monitoring | https://dashboard.vorion.io |

### 14.4 Training Resources

| Resource | Audience | Duration |
|----------|----------|----------|
| STPA Fundamentals | All engineers | 4 hours |
| STPA for AI | AI/ML engineers | 8 hours |
| BASIS Rule Authoring | Platform engineers | 4 hours |
| STPA-Vorion Integration | Safety engineers | 8 hours |

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────────┐
│                    STPA QUICK REFERENCE                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  STEP 1: PURPOSE                                                     │
│  ─────────────────                                                   │
│  • Identify LOSSES (what can go wrong)                              │
│  • Identify HAZARDS (system states leading to loss)                 │
│  • Define CONSTRAINTS (what must be enforced)                       │
│                                                                      │
│  STEP 2: CONTROL STRUCTURE                                          │
│  ───────────────────────────                                        │
│  • Diagram controllers, actuators, sensors                          │
│  • Identify control actions and feedback                            │
│  • Document process models                                          │
│                                                                      │
│  STEP 3: UNSAFE CONTROL ACTIONS                                     │
│  ───────────────────────────────                                    │
│  • For each control action, analyze 4 types:                        │
│    1. Not providing → hazard                                        │
│    2. Providing → hazard                                            │
│    3. Wrong timing → hazard                                         │
│    4. Wrong duration → hazard                                       │
│                                                                      │
│  STEP 4: LOSS SCENARIOS                                             │
│  ────────────────────────                                           │
│  • Why might UCA occur? Consider:                                   │
│    - Controller failures                                            │
│    - Control path failures                                          │
│    - Feedback failures                                              │
│  • Define mitigations                                               │
│                                                                      │
│  VORION MAPPING                                                      │
│  ──────────────────                                                 │
│  Controller → BASIS + ENFORCE                                        │
│  Actuator → Cognigate                                                │
│  Sensor → PROOF + Trust Engine                                       │
│  Constraint → BASIS Rule                                             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

**Document Control**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-08 | Vorion Safety Engineering | Initial release |

---

*For questions: safety-engineering@vorion.io*
*STPA Training: https://training.vorion.io/stpa*
