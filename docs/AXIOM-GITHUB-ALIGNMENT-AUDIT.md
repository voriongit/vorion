# Axiom ↔ GitHub Alignment Audit
**Date**: January 25, 2026  
**Status**: ⚠️ CRITICAL DIVERGENCE DETECTED  
**Risk Level**: HIGH - Axiom is significantly ahead

---

## Executive Summary

**Axiom (local c:\Axiom)** is **NOT synced with GitHub**:
- **Current Axiom HEAD**: a7c4638 (Jan 23, "chore: fixes across packages")
- **voriongit/vorion master HEAD**: a7c4638 (✅ SAME)
- **Uncommitted changes**: **68 files modified** + **139 files untracked**
- **Total divergence**: 207 files ahead of git
- **ACI spec bundle**: Local only (no git repo)

**Critical Issues**:
1. ❌ **docs/** folder contains 8 NEW ACI documents NOT in git
2. ❌ **cognigate-api/** has Python improvements NOT in git
3. ❌ **apps/agentanchor/** has 16 modified files NOT committed
4. ❌ **packages/** has 20+ new/modified modules NOT in git
5. ❌ **docs/VORIONGIT-CONSOLIDATION-ACTION-PLAN.md** (just created, not tracked)
6. ❌ **ACI bundle** at c:\Users\racas\Downloads\agentAIID (disconnected from main repo)

---

## Detailed File-by-File Analysis

### TIER 1: CRITICAL CHANGES (Should be in Git)

#### 1. docs/ - ACI Documentation (8 NEW FILES)
```
NEW in Axiom, NOT in GitHub:
✗ docs/ACI-ANALYSIS-TO-EXECUTION.md              (13 KB)
✗ docs/ACI-COMPLETE-COVERAGE-AUDIT.md            (11 KB)
✗ docs/ACI-DOCUMENTATION-INDEX.md                (13 KB)
✗ docs/ACI-EXECUTIVE-SUMMARY.md                  (12 KB)
✗ docs/ACI-IMPLEMENTATION-CHECKLIST.md           (15 KB)
✗ docs/ACI-QUICK-REFERENCE.md                    (10 KB)
✗ docs/ACI-REVIEW-SUMMARY.md                     (13 KB)
✗ docs/ACI-STANDARDS-CONSOLIDATED.md             (27 KB)
```
**Total**: 114 KB of consolidated ACI specifications  
**Status**: Created today (Jan 24-25), never committed  
**Action Required**: `git add docs/ACI-*.md && git commit`

#### 2. docs/VORIONGIT-CONSOLIDATION-ACTION-PLAN.md (NEW)
```
Status: Created today (Jan 25), not in git
Size: ~15 KB
Content: Comprehensive 4-phase consolidation plan
Action Required: `git add` + `git commit`
```

#### 3. apps/agentanchor/ - B2B Platform (16 MODIFIED FILES)
```
Modified (NOT staged):
✗ apps/agentanchor/app/api/council/upchain/route.ts
✗ apps/agentanchor/app/portal/certify/page.tsx
✗ apps/agentanchor/app/portal/mint/page.tsx
✗ apps/agentanchor/lib/agents/operating-principles.ts
✗ apps/agentanchor/lib/agents/types.ts
✗ apps/agentanchor/lib/collaboration/types.ts
✗ apps/agentanchor/lib/council/council-service.ts
✗ apps/agentanchor/lib/council/escalation-service.ts
✗ apps/agentanchor/lib/council/index.ts
✗ apps/agentanchor/lib/council/precedent-service.ts
✗ apps/agentanchor/lib/council/risk-assessment.ts
✗ apps/agentanchor/lib/governance/agent-wrapper.ts
✗ apps/agentanchor/lib/governance/capabilities.ts
✗ apps/agentanchor/lib/governance/trust-engine-bridge.ts
✗ apps/agentanchor/lib/governance/trust.ts
✗ apps/agentanchor/lib/hierarchy/types.ts
```

**Status**: All marked as M (modified) but NOT staged  
**Implications**: 
- Changes exist only in working directory
- Not in any commit
- Would be lost if you reset --hard
- Not deployed to GitHub

**Action Required**: Review each file, then `git add` or `git checkout`

#### 4. cognigate-api/ - Python Runtime (7 MODIFIED FILES)
```
Modified (NOT staged):
✗ cognigate-api/app/config.py
✗ cognigate-api/app/core/velocity.py
✗ cognigate-api/app/main.py
✗ cognigate-api/app/models/enforce.py
✗ cognigate-api/app/routers/enforce.py
✗ cognigate-api/app/routers/health.py
✗ cognigate-api/requirements.txt

New (NOT tracked):
✗ cognigate-api/.dockerignore
✗ cognigate-api/Dockerfile
✗ cognigate-api/PERFORMANCE-OPTIMIZATIONS.md
✗ cognigate-api/app/core/async_logger.py
✗ cognigate-api/app/core/cache.py
✗ cognigate-api/src/
```

**Status**: Production runtime improvements, not in git  
**Risk**: If you clone voriongit/cognigate, you get different code

---

### TIER 2: MAJOR CHANGES (Should Review)

#### 5. packages/ - Core Libraries (30+ CHANGES)

**Modified in working directory**:
```
✗ packages/atsf-core/package.json
✗ packages/atsf-core/src/index.ts
✗ packages/atsf-core/src/trust-engine/index.ts
✗ packages/contracts/src/index.ts
✗ packages/contracts/tsconfig.tsbuildinfo
✗ packages/council/package.json
✗ package-lock.json (HUGE CHANGE)
✗ package.json
```

**Deleted files** (NOT committed):
```
✗ packages/council/src/agents/compliance.ts (DELETED)
✗ packages/council/src/agents/human-gateway.ts (DELETED)
✗ packages/council/src/agents/index.ts (DELETED)
✗ packages/council/src/agents/master-planner.ts (DELETED)
✗ packages/council/src/agents/meta-orchestrator.ts (DELETED)
✗ packages/council/src/agents/qa.ts (DELETED)
✗ packages/council/src/agents/routing.ts (DELETED)
✗ packages/council/src/graphs/council-workflow.ts (DELETED)
✗ packages/council/src/index.ts (DELETED)
✗ packages/council/src/types/index.ts (DELETED)
```

**Untracked (NEW PACKAGES)**:
```
✗ packages/a3i/          (NEW PACKAGE)
✗ packages/agent-sdk/    (NEW PACKAGE)
✗ packages/ai-gateway/   (NEW PACKAGE)
✗ packages/basis/        (NEW PACKAGE)
✗ packages/cognigate-edge/   (NEW PACKAGE)
✗ packages/cognigate-wasm/   (NEW PACKAGE)
✗ packages/curator/      (NEW PACKAGE)
✗ packages/envoy/        (NEW PACKAGE)
✗ packages/herald/       (NEW PACKAGE)
✗ packages/kaizen/       (NEW PACKAGE)
✗ packages/librarian/    (NEW PACKAGE)
✗ packages/nexus/        (NEW PACKAGE)
✗ packages/orion/        (NEW PACKAGE)
✗ packages/scribe/       (NEW PACKAGE)
✗ packages/sentinel/     (NEW PACKAGE)
✗ packages/steward/      (NEW PACKAGE)
✗ packages/ts-fixer/     (NEW PACKAGE)
✗ packages/vorion-cli/   (NEW PACKAGE)
✗ packages/vorion-nav/   (NEW PACKAGE)
✗ packages/vorion-plugin-sdk/   (NEW PACKAGE)
✗ packages/vorion-search/       (NEW PACKAGE)
✗ packages/watchman/     (NEW PACKAGE)
```

**Total**: 22 NEW packages, 10 DELETED council agents

**Risk**: Major structural change, package.json inconsistencies

---

#### 6. apps/ - Applications (Multiple Changes)

**Modified**:
```
✗ apps/agentanchor/next.config.js
✗ apps/bai-cc-www/src/components/Nav.astro
✗ vorion-www/package-lock.json
✗ vorion-www/src/app/basis/page.tsx
✗ vorion-www/src/app/basis/trust/page.tsx
✗ vorion-www/src/app/layout.tsx
✗ vorion-www/src/app/page.tsx
```

**Untracked (NEW)**:
```
✗ apps/agentanchor-www/
✗ apps/dashboard/
✗ apps/cc-agent/
✗ apps/bai-cc-www/docs/
✗ apps/bai-cc-www/src/pages/status.astro
✗ apps/bai-cc-www/vercel.json
```

---

#### 7. src/ - Vorion Runtime (6 MODIFIED FILES)

```
Modified (NOT staged):
✗ src/api/server.ts
✗ src/audit/types.ts
✗ src/common/canonical-bridge.ts
✗ src/intent/queues.ts
✗ src/intent/response-middleware.ts
✗ src/intent/routes.ts
✗ src/trust-engine/index.ts
✗ src/policy/loader.ts
```

**Status**: Production code changes, not committed

---

### TIER 3: SUPPORTING ARTIFACTS (Should organize)

#### 8. Root-Level Config (NEW/MODIFIED)

```
NEW (NOT tracked):
✗ .env.docker.example
✗ .github/workflows/security-audit.yml
✗ .github/workflows/test.yml
✗ .npmrc
✗ .vorion/
✗ execute-sprint.ps1
✗ execute-sprint.sh
✗ helm/
✗ k8s/
✗ knowledge-index.json
✗ nul
✗ roadmap.md
✗ status.json
✗ project-context.md (MODIFIED)

MODIFIED (NOT staged):
✗ docker-compose.yml
✗ package-lock.json
✗ package.json
✗ basis-core/specs/BASIS-SPECIFICATION.md
✗ docs/MASTER-PROJECT-INVENTORY.md
✗ docs/UNIFIED-REPOS-AND-WEBSITES.md
✗ docs/index.md
✗ docs/spec/BASIS-SPECIFICATION.md
✗ omniscience/content/sdk/basis-core/src/constants.ts
✗ omniscience/src/app/pitch/page.tsx
```

---

#### 9. Deleted Files (NOT committed)
```
DELETED (NOT staged):
✗ docs/ATSF_v3.4_Complete/atsf_v3_package/ATSF_v3.4_White_Paper_v2.docx
✗ docs/ATSF_v3.4_Complete/atsf_v3_package/BOUNTY_SPECS.md
✗ docs/ATSF_v3.4_Complete/atsf_v3_package/README.md
✗ docs/ATSF_v3.4_Complete/atsf_v3_package/README.md.bak
✗ docs/ATSF_v3.4_Complete/atsf_v3_package/ROADMAP_2026.md
✗ docs/ATSF_v3.4_Complete/atsf_v3_package/agentanchor_logo.svg
✗ docs/ATSF_v3.4_Complete/atsf_v3_package/atsf_icon.svg
✗ docs/ATSF_v3.4_Complete/atsf_v3_package/atsf_logo.svg
✗ docs/ATSF_v3.4_Complete/atsf_v3_package/pyproject.toml
```

---

## Axiom vs GitHub: Side-by-Side Comparison

| Category | Axiom (Local) | GitHub | Status |
|----------|---|---|---|
| **Commit HEAD** | a7c4638 | a7c4638 | ✅ SAME |
| **Branch** | master | master | ✅ SAME |
| **ACI Docs** | 8 files (114 KB) | 0 files | ❌ LOCAL ONLY |
| **Consolidation Plan** | 1 file (15 KB) | 0 files | ❌ LOCAL ONLY |
| **packages/** | 22 new + 10 deleted | Not visible | ❌ NOT STAGED |
| **apps/** | 16 modified + 4 new | Not updated | ❌ NOT STAGED |
| **cognigate-api/** | 7 modified + 5 new | Not updated | ❌ NOT STAGED |
| **src/** (vorion) | 8 modified | Not updated | ❌ NOT STAGED |
| **docs/** | 20+ modified/new | Partial | ⚠️ MIXED |
| **Total changes** | 207 files | 0 files | ❌ DIVERGED |

---

## Critical Issues & Risks

### 🔴 ISSUE 1: Axiom is "Dirty" (Uncommitted Work)

**Current state**:
```
On branch master
Your branch is up to date with 'origin/master'.

Changes not staged for commit:
  (use "git add <file>..." to update the index)
  (use "git restore <file>..." to discard changes)
        modified:   68 files

Untracked files:
  (use "git add <file>..." to include in what will be tracked)
        139 files
```

**Why this matters**:
- All 207 changes only exist in working directory
- `git clone voriongit/vorion` → clean repo without any improvements
- Team members can't see your changes
- CI/CD doesn't test this code
- Production deployments miss improvements

**Example**: 
- You improved cognigate-api (7 files)
- But cognigate repo (voriongit/cognigate) is unchanged
- Deploy cognigate → old code ships

---

### 🔴 ISSUE 2: ACI Documentation Exists ONLY in Axiom

**Problem**:
```
c:\Axiom\docs\:
✓ ACI-STANDARDS-CONSOLIDATED.md (27 KB)
✓ ACI-SECURITY-HARDENING-PLAN.md (16 KB)
✓ ACI-IMPLEMENTATION-CHECKLIST.md (15 KB)
... 5 more files (73 KB total)

voriongit/vorion (GitHub):
✗ NONE of these files
```

**Impact**:
- If you delete Axiom, documentation disappears
- GitHub wiki/docs don't have the consolidation
- Can't reference in pull requests
- Not part of official project

**Action**: Need to commit to voriongit/vorion in new docs/aci/ folder

---

### 🔴 ISSUE 3: Package Structure Mismatch

**In Axiom (working directory)**:
```
22 NEW packages discovered:
- packages/a3i/
- packages/agent-sdk/
- packages/ai-gateway/
- ... + 19 others
```

**In GitHub (voriongit/vorion)**:
```
These packages NOT visible in master branch
```

**What happened**: Looks like you've been adding packages but haven't committed them.

---

### 🔴 ISSUE 4: Council Package Deleted (10 Files)

**In Axiom**:
```
DELETED (not staged):
- packages/council/src/agents/*
- packages/council/src/graphs/*
- 10 files total
```

**Implication**: 
- These files may have been intentionally removed
- OR accidentally deleted and not yet cleaned up
- Either way: **not committed**, so state is ambiguous

---

### 🔴 ISSUE 5: ACI Bundle is Orphaned

**Location**:
```
c:\Users\racas\Downloads\agentAIID\
├─ aci-spec-v1.0.0\
├─ aci-spec-v1.1.0\    ← Latest
└─ Other bundles
```

**Status**:
- Not in Axiom repo
- Not in voriongit/aci-spec (because repo doesn't exist yet)
- No git tracking
- Disconnected from source control

**Risk**: 
- If your Downloads folder clears, bundle is lost
- No version history
- No deployment path

---

## Alignment Matrix: What Should Be Done

### Priority 1: URGENT (Do First)

| Item | Current | Required | Action |
|------|---------|----------|--------|
| ACI Docs (8 files) | Axiom only | In GitHub | `git add docs/ACI-*.md` |
| Consolidation Plan | Axiom only | In GitHub | `git add docs/VORIONGIT-CONSOLIDATION-ACTION-PLAN.md` |
| cognigate improvements | Axiom only | In cognigate repo | `git add cognigate-api/` |
| vorion runtime fixes | Axiom only | In master | `git add src/` |
| agentanchor changes | Modified | Staged & committed | `git add apps/agentanchor/` |

### Priority 2: IMPORTANT (Do Next)

| Item | Current | Required | Action |
|------|---------|----------|--------|
| 22 new packages | Untracked | Decide fate | Commit or delete |
| 10 deleted council files | Deleted | Decide fate | Commit delete or restore |
| package.json sync | Modified | Staged | `git add package*.json` |
| docs updates | Mixed | Staged | `git add docs/` |

### Priority 3: ORGANIZE (Do After Merge)

| Item | Current | Required | Action |
|------|---------|----------|--------|
| ACI spec bundle | c:\Downloads | voriongit/aci-spec | `git push` to new repo |
| Docker configs | New | Versioned | `git add .dockerignore Dockerfile` |
| K8s/Helm | New | Versioned | `git add helm/ k8s/` |
| GitHub workflows | New | Checked | `git add .github/workflows/` |

---

## Recommended Resolution Steps

### STEP 1: Audit Changes (5 min)
```powershell
cd c:\Axiom
git diff --stat                    # See what changed
git status                         # See what's not staged
git diff packages/atsf-core/src/   # Review specific changes
```

### STEP 2: Decide on Each Changed File
For each category:
- **ACI docs** → COMMIT (definitely want in GitHub)
- **cognigate-api** → COMMIT (production code)
- **apps/agentanchor** → COMMIT (improvements)
- **src/** (vorion) → COMMIT (runtime fixes)
- **22 new packages** → REVIEW each:
  - If mature: COMMIT
  - If experimental: STASH or BRANCH
- **10 deleted files** → REVIEW:
  - If intentional cleanup: COMMIT DELETE
  - If accidental: RESTORE

### STEP 3: Stage & Commit

```powershell
cd c:\Axiom

# Add high-priority items
git add docs/ACI-*.md
git add docs/VORIONGIT-CONSOLIDATION-ACTION-PLAN.md
git add cognigate-api/
git add apps/agentanchor/
git add src/

# Commit with clear message
git commit -m "feat: ACI consolidation + improvements to agentanchor, cognigate, vorion runtime

docs: Add 8 comprehensive ACI specification documents
  - ACI-STANDARDS-CONSOLIDATED.md (primary spec)
  - ACI-SECURITY-HARDENING-PLAN.md (implementation roadmap)
  - ACI-IMPLEMENTATION-CHECKLIST.md (project timeline)
  - Plus 5 additional guides and summaries

docs: Add VORIONGIT-CONSOLIDATION-ACTION-PLAN.md
  - 4-phase delivery plan
  - Branch cleanup strategy
  - Cross-repo alignment

feat(agentanchor): Update B2B platform for ACI integration
feat(cognigate-api): Improve Python runtime
feat(vorion): Runtime fixes and improvements

This commit ensures Axiom working directory is synced with GitHub
before merging feature/aci-integration and publishing ACI spec."

git push origin master
```

### STEP 4: Handle Untracked Files

```powershell
# For new packages - review first
git status | Select-String "packages/"

# Decide: COMMIT or REMOVE
# If committing:
git add packages/a3i/
git add packages/agent-sdk/
# ... etc

# If removing (example):
git clean -fd packages/unused-package/
```

### STEP 5: Verify Alignment

```powershell
# Check that all important changes are committed
git diff --stat origin/master

# Should show: 0 files changed (all staged and committed)

# Verify HEAD matches origin
git log --oneline -1  # Should match GitHub when you refresh
```

---

## Pre-Merge Checklist

Before merging `feature/aci-integration` to master:

- [ ] **Step 1**: All ACI documentation in git
- [ ] **Step 2**: All agentanchor improvements committed
- [ ] **Step 3**: All cognigate-api changes committed
- [ ] **Step 4**: All vorion/src fixes committed
- [ ] **Step 5**: All package changes decided (commit or delete)
- [ ] **Step 6**: `git status` shows clean working directory
- [ ] **Step 7**: `git diff origin/master` is empty
- [ ] **Step 8**: New voriongit/aci-spec repo created
- [ ] **Step 9**: ACI bundle pushed to aci-spec repo

---

## Summary Table

| Aspect | Status | Action |
|--------|--------|--------|
| **Git Alignment** | ❌ Diverged | Stage & commit 207 changes |
| **ACI Docs** | ❌ Local only | Add to git, push |
| **Production Code** | ❌ Uncommitted | Commit to master |
| **New Packages** | ⚠️ Untracked | Review & decide |
| **Council Delete** | ⚠️ Pending | Confirm & commit |
| **Ready to Merge** | 🔴 NO | Fix alignment first |
| **Ready to Publish** | 🔴 NO | Commit + merge first |

---

**Recommendation**: Execute STEP 1-7 above before proceeding with feature/aci-integration merge. This ensures you ship what's actually in your working directory, not what's already in GitHub.

Once aligned, **then**:
1. Merge feature/aci-integration
2. Create voriongit/aci-spec
3. Push ACI bundle
4. Clean up branches
