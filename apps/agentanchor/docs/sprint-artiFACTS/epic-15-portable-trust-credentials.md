# Epic 15: Portable Trust Credentials

**Goal:** Enable AgentAnchor-certified agents to carry their trust reputation anywhere, making AgentAnchor the universal trust authority for AI agents.

**User Value:**
- Agents can prove trustworthiness outside platform
- Third-party systems can verify agent credentials
- Trust follows the agent, not the platform

**Strategic Value:**
- Creates network effect beyond platform boundaries
- Verification API generates recurring revenue
- Positions AgentAnchor as industry standard
- Patent-protected credential system

**FRs Covered:** FR157-162

**Moat Type:** NETWORK MOAT

---

## Functional Requirements

### Credential Issuance (FR157-159)

- **FR157:** Agents with Trust Score 250+ can request Portable Trust Credential (PTC)
- **FR158:** PTC contains trust score, tier, governance summary, and Truth Chain anchor
- **FR159:** PTC is cryptographically signed by AgentAnchor and expires after 24 hours

### Verification API (FR160-162)

- **FR160:** Third-party systems can verify PTC via public API
- **FR161:** Verification confirms signature validity, expiration, and current trust state
- **FR162:** Verification API is rate-limited and monetized by tier

---

## Stories

### Story 15-1: Credential Issuance Service

As a **Trainer**,
I want my agent to receive a Portable Trust Credential,
So that it can prove its trustworthiness to external systems.

**Acceptance Criteria:**

**Given** an agent with Trust Score 250+
**When** I request a Portable Trust Credential
**Then** system generates a JWT-based credential

**And** given credential is generated
**When** I view its contents
**Then** it includes: agent_id, trust_score, trust_tier, governance_summary, truth_chain_anchor

**And** given credential is issued
**When** I check signature
**Then** it is cryptographically signed with AgentAnchor's private key (ES256)

**And** given credential is issued
**When** I check expiration
**Then** it expires 24 hours from issuance

**Technical Notes:**
- JWT format with ES256 signing
- Key rotation support (kid in header)
- Credential stored in credentials table
- Issuance recorded on Truth Chain

---

### Story 15-2: Credential Signing Infrastructure

As the **platform**,
I want secure credential signing infrastructure,
So that credentials are tamper-proof and verifiable.

**Acceptance Criteria:**

**Given** signing infrastructure
**When** platform initializes
**Then** ES256 key pair is available (private key in secure storage)

**And** given signing request
**When** credential is created
**Then** signature is ECDSA using P-256 curve

**And** given key rotation is needed
**When** admin initiates rotation
**Then** new key is generated, old keys retained for verification

**And** given multiple keys exist
**When** verifying credential
**Then** system uses kid (key ID) to select correct public key

**Technical Notes:**
- Private key in environment variable or secrets manager
- Public keys available at /.well-known/jwks.json
- Key IDs format: aa_key_YYYY_NNN

---

### Story 15-3: Verification API

As a **third-party developer**,
I want to verify agent credentials via API,
So that my system can trust AgentAnchor-certified agents.

**Acceptance Criteria:**

**Given** I have a PTC token
**When** I call GET /api/v1/verify/credential with Authorization: Bearer <token>
**Then** I receive verification result

**And** given valid credential
**When** verification completes
**Then** response includes: valid=true, agent_id, trust_score, trust_tier, expires_in

**And** given expired credential
**When** verification completes
**Then** response includes: valid=false, error="credential_expired"

**And** given revoked agent
**When** verification completes
**Then** response includes: valid=false, error="agent_revoked"

**And** given trust score changed significantly (>50 points)
**When** verification completes
**Then** response includes: valid=true, warnings=["trust_score_stale"]

**Technical Notes:**
- Public endpoint, no auth required
- Rate limited by IP (100/hour free tier)
- Checks signature, expiration, revocation list, current trust state

---

### Story 15-4: Credential Refresh Flow

As a **Trainer**,
I want to refresh my agent's credential before it expires,
So that external integrations continue working.

**Acceptance Criteria:**

**Given** an agent with active credential
**When** credential is within 6 hours of expiry
**Then** I can request a refresh

**And** given refresh is requested
**When** agent still qualifies (score 250+)
**Then** new credential is issued with fresh 24-hour expiry

**And** given refresh is requested
**When** agent no longer qualifies
**Then** refresh is denied with reason

**And** given agent has significant trust change
**When** viewing credential status
**Then** system recommends refresh to update trust data

**Technical Notes:**
- Refresh creates new credential, doesn't extend old
- Old credential remains valid until its expiry
- Notification when credential about to expire

---

### Story 15-5: Revocation System

As the **platform**,
I want to revoke credentials when agents are suspended,
So that compromised credentials cannot be misused.

**Acceptance Criteria:**

**Given** an agent is suspended or archived
**When** suspension is processed
**Then** all active credentials are added to revocation list

**And** given verification request for revoked credential
**When** verification runs
**Then** result is invalid with error="agent_revoked"

**And** given I view agent status
**When** credentials are revoked
**Then** I see "Credentials Revoked" status

**And** given agent is reinstated
**When** I request new credential
**Then** new credential can be issued (old revocations remain)

**Technical Notes:**
- Revocation list in database
- CRL (Certificate Revocation List) endpoint available
- Revocation is immediate, cached responses expire naturally

---

## Dependencies

- **Epic 4 (Trust Score System):** Must exist to calculate scores
- **Epic 5 (Truth Chain):** For anchoring credentials
- **Epic 8 (API):** For verification endpoint

## Technical Design Reference

See: `docs/designs/portable-trust-credential.md`

---

## Patent Claims Reference

This epic implements Patent Family #5: Portable Trust Credentials

**Key Claims:**
1. Trust scoring engine with portable attestations
2. Cryptographically signed credentials with expiration
3. Verification service for third-party requestors
4. Revocation mechanism for suspended agents

---

**Epic Status:** backlog
**Estimated Stories:** 5
**Priority:** HIGH (Moat Builder)
