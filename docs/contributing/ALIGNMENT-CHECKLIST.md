# Vorion Ecosystem Alignment Checklist

**Purpose:** Use this checklist before and after major development sessions to maintain alignment across projects.

---

## Pre-Session Checklist

### Project Context
- [ ] Identify which projects/packages will be modified
- [ ] Check recent changes in affected areas (`git log --oneline -10`)
- [ ] Review CLAUDE.md in project root for context
- [ ] Verify no conflicting work in progress

### Architecture Alignment
- [ ] Changes align with B2B platform model (not marketplace)
- [ ] Using canonical API implementation (atsf-core/Hono preferred)
- [ ] Following established patterns in codebase
- [ ] Not introducing duplicate functionality

### Dependencies
- [ ] Check package versions are compatible
- [ ] Verify peer dependencies are satisfied
- [ ] No circular dependencies introduced

---

## Development Checklist

### Code Standards
- [ ] TypeScript strict mode compliance
- [ ] Zod schemas for all external input
- [ ] Error handling follows established patterns
- [ ] No hardcoded configuration values

### Security
- [ ] Input validation on all API endpoints
- [ ] Rate limiting configured appropriately
- [ ] Sensitive data redacted from logs
- [ ] No secrets in code or commits

### Testing
- [ ] Unit tests for new functions
- [ ] Integration tests for new flows
- [ ] Existing tests still pass

---

## Post-Session Checklist

### Documentation
- [ ] Update CLAUDE.md if patterns changed
- [ ] Document new API endpoints
- [ ] Update architecture diagrams if structure changed
- [ ] Add inline comments for complex logic

### Cleanup
- [ ] Remove unused imports
- [ ] Delete deprecated code (don't comment out)
- [ ] Remove console.log statements
- [ ] Clean up TODO comments

### Commit Quality
- [ ] Descriptive commit messages (conventional commits)
- [ ] Logical commit grouping (one feature per commit)
- [ ] No unrelated changes in commits

### Cross-Project Impact
- [ ] Check if changes affect other packages
- [ ] Update dependent packages if APIs changed
- [ ] Verify monorepo build succeeds

---

## Known Alignment Issues (January 2026)

### API Implementation Duality
**Status:** UNRESOLVED
- Two API implementations exist (Fastify in src/api, Hono in atsf-core)
- **Rule:** New API work should go in atsf-core
- **Do Not:** Add new endpoints to src/api

### Marketplace Code
**Status:** DEPRECATED - REMOVAL PENDING
- Marketplace features removed but code artifacts remain
- **Do Not:** Reference marketplace components
- **Do Not:** Import from marketplace directories

### Trust Tiers
**Status:** ACTIVE
- Using 6-tier system (0-1000 scale)
- Tiers: Sandbox, Provisional, Standard, Trusted, Verified, Certified
- **Important:** Different from old 5-tier documentation

### Persistence Providers
**Status:** ACTIVE
- Memory (testing), File (dev), PostgreSQL (prod), Supabase (realtime)
- **Default:** PostgreSQL via Drizzle ORM
- **Do Not:** Mix providers in single flow

---

## Quick Reference

### Key Directories
```
C:\axiom\apps\agentanchor\          # Main B2B platform
C:\axiom\packages\atsf-core\        # Core SDK (canonical)
C:\axiom\src\                       # Shared kernel
C:\axiom\docs\                      # Documentation
C:\_bmad\                           # BMAD framework
C:\_bmad-output\                    # Generated outputs
```

### Important Files
```
apps/agentanchor/CLAUDE.md          # AgentAnchor context
packages/atsf-core/package.json     # SDK version/exports
src/trust-engine/index.ts           # Trust scoring logic
apps/agentanchor/docs/B2B-CONVERSION-PLAN.md  # Strategic direction
```

### Build Commands
```bash
# From monorepo root
npm run build              # Build all packages
npm run dev                # Start development
npm run test               # Run tests
turbo run build --filter=@vorion/atsf-core  # Build specific package
```

---

*Last Updated: January 19, 2026*
*Maintainer: BMad Master*
