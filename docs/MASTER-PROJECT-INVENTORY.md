# Master Project Inventory

**Generated:** January 17, 2026
**Owner:** Racas
**Scope:** All projects across C:\axiom, C:\S_A, C:\bai

---

## Executive Summary

| Directory | Project Count | Primary Focus | Status |
|-----------|---------------|---------------|--------|
| **C:\axiom** | 15+ | Vorion/BASIS AI Governance | Production |
| **C:\bai** | 11 | BAI Hospitality SaaS Ecosystem | Active Development |
| **C:\S_A** | 6 | Personal/Legacy Projects | Consolidation Needed |

**Total Active Projects:** 25+
**Total Documentation:** 300+ markdown files
**Estimated Codebase:** 500K+ lines

---

## Strategic Tracks

### Track 1: AI Governance (Vorion Ecosystem)
**Location:** C:\axiom
**Mission:** Become the standard for AI agent governance
**Status:** Most mature track with live products

### Track 2: Hospitality SaaS (BAI Ecosystem)
**Location:** C:\bai
**Mission:** Transform hospitality operations with AI
**Status:** Active development with clear revenue model

### Track 3: Personal/Experimental
**Location:** C:\S_A
**Mission:** Exploration and skill building
**Status:** Requires consolidation - many duplicates exist

---

## Detailed Project Inventory

### C:\axiom - Vorion Governance Platform

#### Applications (apps/)

| Project | Path | Status | Description |
|---------|------|--------|-------------|
| **AgentAnchor** | apps/agentanchor | PRODUCTION | B2B AI Governance Platform - app.agentanchorai.com |
| **AgentAnchor WWW** | apps/agentanchor-www | PRODUCTION | Marketing website - agentanchorai.com |

#### Core Packages (packages/)

| Package | Path | Status | Description |
|---------|------|--------|-------------|
| **@vorion/atsf-core** | packages/atsf-core | PRODUCTION | Trust scoring SDK |
| **@vorion/contracts** | packages/contracts | PRODUCTION | Shared schemas & validators |
| **@vorion/a3i** | packages/a3i | ACTIVE | Agent Anchor AI utilities |
| **@vorion/orion** | packages/orion | ACTIVE | Proof plane library |

#### Standalone Projects

| Project | Path | Status | Description |
|---------|------|--------|-------------|
| **BASIS Core** | basis-core/ | PRODUCTION | Open governance standard - basis.vorion.org |
| **TrustBot/Aurais** | trustbot/ | PRODUCTION | Governance demo platform |
| **Cognigate API** | cognigate-api/ | ACTIVE | Trust-enforced execution runtime |
| **Omniscience** | omniscience/ | ACTIVE | Learning platform - learn.vorion.org |
| **Omniscience Docs** | omniscience-docs/ | ACTIVE | Docusaurus documentation |
| **Vorion WWW** | vorion-www/ | PRODUCTION | Corporate website - vorion.org |

#### Infrastructure

| Component | Path | Status | Description |
|-----------|------|--------|-------------|
| **Vorion Kernel** | src/ | ACTIVE | Core governance engine |
| **BMAD Framework** | _bmad/ | v6.0-alpha.22 | Development methodology |
| **BMAD Outputs** | _bmad-output/ | ACTIVE | Generated planning artifacts |

---

### C:\bai - BAI Hospitality Ecosystem

#### Core SaaS Products

| Project | Path | Status | Completion | Description |
|---------|------|--------|------------|-------------|
| **AIQ** | aiq/ | BETA | 60% | Equipment & layout planning |
| **AIP** | aip/ | PLANNED | 95% specs | Voice-first BEO generation |
| **AIS** | ais/ | RESEARCH | 5% | On-call staffing marketplace |
| **AIX** | aix/ | PLANNING | 15% | Behavioral training platform |

#### Meta-Projects

| Project | Path | Status | Description |
|---------|------|--------|-------------|
| **BAI Command Center** | bai-command-center/ | BUILDING | 16-advisor executive platform (March 2026) |
| **Aria Advisors** | aria-advisors/ | ACTIVE | Personal AI advisory council |
| **BMAD** | bmad/ | OPERATIONAL | Development methodology (older version) |

#### Support Projects

| Project | Path | Status | Description |
|---------|------|--------|-------------|
| **AIQ-Admin** | aiq-admin/ | BETA | Administrative dashboard for AIQ |
| **BAIQ2** | baiq2/ | ARCHIVED | Legacy - can be deleted |
| **Archives** | archives/ | ARCHIVED | Old AIQ backup |

---

### C:\S_A - Scattered Aspirations

#### Active Projects

| Project | Path | Status | Overlap | Description |
|---------|------|--------|---------|-------------|
| **AgentAnchorAI** | agentanchorai/ | ACTIVE | DUPLICATE of axiom | AI Governance Platform |
| **A3I-web** | A3I-web/ | ACTIVE | DUPLICATE of axiom | Marketing website |
| **FlightFinder** | flightfinder/ | EARLY DEV | UNIQUE | Personal flight deal finder |
| **Auryn-Anchor** | auryn-anchor-platform/ | DORMANT | PREDECESSOR | Early governance platform |
| **ORION Platform** | orion-platform/ | EMERGING | RELATED to axiom | Enterprise governance |

#### Empty/Archive

| Project | Path | Status | Action |
|---------|------|--------|--------|
| **Web** | web/ | EMPTY | Delete |
| **AiBookConsolidate** | archives/AiBookConsolidate/ | ARCHIVED | Delete |
| **web-git_agent** | archives/web-git_agent/ | ARCHIVED | Evaluate |

---

## Duplicate Resolution Plan

### Confirmed Duplicates

| Project | Primary Location | Duplicate Location | Action |
|---------|-----------------|-------------------|--------|
| AgentAnchor App | C:\axiom\apps\agentanchor | C:\S_A\agentanchorai | Archive S_A version |
| AgentAnchor WWW | C:\axiom\apps\agentanchor-www | C:\S_A\A3I-web | Archive S_A version |
| BMAD Framework | C:\axiom\_bmad (v6.0) | C:\bai\bmad (older) | Update bai to v6.0 |

### Requires Evaluation

| Project | Location 1 | Location 2 | Question |
|---------|-----------|-----------|----------|
| ORION Planning | C:\axiom\_bmad-output | C:\S_A\orion-platform | Same project or different? |
| Auryn-Anchor | C:\S_A\auryn-anchor-platform | (referenced in axiom) | Historical predecessor? |

---

## Technology Stack Summary

### Common Across All Projects

| Layer | Technology | Version |
|-------|------------|---------|
| Language | TypeScript | 5.x |
| Runtime | Node.js | 20-22 |
| Frontend | React | 18-19 |
| Framework | Next.js | 14-16 |
| Styling | Tailwind CSS | 3-4 |
| Testing | Vitest/Jest | Latest |

### Database by Track

| Track | Primary | Secondary |
|-------|---------|-----------|
| Vorion (axiom) | Neon PostgreSQL | Supabase |
| BAI (bai) | Firebase Firestore | Supabase (Command Center) |
| Personal (S_A) | Firebase | - |

### AI Integration

| Provider | Usage | Projects |
|----------|-------|----------|
| Anthropic Claude | Primary AI | All tracks |
| OpenAI GPT-4 | Fallback/Whisper | AIP, AIQ, BAI CC |
| DeepSeek R1 | Cost optimization | BAI Command Center |
| Perplexity | Research | BAI Command Center, Aria |

---

## Documentation Status by Project

### Excellent (90%+)

- C:\axiom\basis-core - Complete specifications
- C:\axiom\trustbot - Architecture, product spec, SDK docs
- C:\bai\aip - Comprehensive planning docs
- C:\bai\bai-command-center - Sprint planning, architecture
- C:\bai\bmad - Methodology documentation

### Good (70-89%)

- C:\axiom\apps\agentanchor - CLAUDE.md, architecture
- C:\bai\aiq - README, development map
- C:\bai\aria-advisors - Architecture, knowledge base
- C:\S_A\flightfinder - Setup guides, architecture

### Needs Improvement (< 70%)

- C:\axiom (root) - Missing project-context.md
- C:\axiom\omniscience - Minimal docs
- C:\bai (root) - No unified context
- C:\S_A (most projects) - Duplicates make docs confusing

---

## Immediate Actions

### Today

- [ ] Commit C:\axiom\docs\VORION-ECOSYSTEM-ALIGNMENT.md
- [ ] Commit C:\axiom\trustbot\ directory
- [ ] Create C:\axiom\docs\index.md
- [ ] Create C:\axiom\project-context.md

### This Week

- [ ] Archive C:\S_A\agentanchorai (duplicate)
- [ ] Archive C:\S_A\A3I-web (duplicate)
- [ ] Update C:\bai\bmad to v6.0-alpha.22
- [ ] Clarify ORION relationship (axiom vs S_A)
- [ ] Create C:\bai\project-context.md

### This Month

- [ ] Consolidate all BMAD instances
- [ ] Complete NIST submission (due Jan 30)
- [ ] Launch AIQ beta
- [ ] Complete BAI Command Center Sprint 1

---

## Project Health Dashboard

### Production (Live)

| Project | URL | Status |
|---------|-----|--------|
| AgentAnchor | app.agentanchorai.com | ✅ Live |
| AgentAnchor WWW | agentanchorai.com | ✅ Live |
| BASIS Docs | basis.vorion.org | ✅ Live |
| Vorion WWW | vorion.org | ✅ Live |

### Development

| Project | Target | Status |
|---------|--------|--------|
| AIQ | Q1 2026 Beta | 🔄 60% |
| BAI Command Center | March 2026 | 🔄 30% |
| AIP | Q1 2026 Start | 📋 Planned |
| Omniscience | TBD | 🔄 Active |

### Planning/Research

| Project | Phase | Status |
|---------|-------|--------|
| AIS | Market Research | 📊 5% |
| AIX | Planning | 📋 15% |
| Cognigate | API Ready | 📋 Pending |

---

## Cross-Reference: Key Documents

### Strategic

| Document | Location | Purpose |
|----------|----------|---------|
| VORION-ECOSYSTEM-ALIGNMENT.md | C:\axiom\docs | Product hierarchy & naming |
| BAI-PLATFORM-VISION.md | C:\bai\docs\strategic | BAI ecosystem strategy |
| MASTER-PROJECT-INVENTORY.md | C:\axiom\docs | This document |

### Technical

| Document | Location | Purpose |
|----------|----------|---------|
| BASIS-SPECIFICATION.md | C:\axiom\basis-core\specs | Core governance spec |
| ARCHITECTURE.md | C:\axiom\trustbot\docs | TrustBot/Aurais architecture |
| project-context.md | C:\axiom\trustbot\_bmad-output | TrustBot dev context |

### Planning

| Document | Location | Purpose |
|----------|----------|---------|
| nist-cyber-ai-profile-comment.md | C:\axiom\docs | NIST submission (due Jan 30) |
| SESSION-PROGRESS-2026-01-17.md | C:\axiom\docs | Today's session notes |

---

*Last Updated: January 17, 2026*
*Next Review: January 24, 2026*
