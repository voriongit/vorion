# Story 5-5: Public Verification

**Epic:** 5 - Observer & Truth Chain
**Status:** Drafted
**Created:** 2025-12-03

---

## User Story

**As a** third-party verifier
**I want** to verify agent certifications and decisions via a public API
**So that** I can independently confirm the integrity of governance records

---

## Acceptance Criteria

- [ ] Public API endpoint `/api/truth-chain/verify/:id` (no auth required)
- [ ] Verification response includes: record, chain integrity status, proof data
- [ ] Public verification page at `/verify/:id`
- [ ] QR code generation for verification links
- [ ] Embeddable verification widget/badge
- [ ] Certificate PDF generation for certifications
- [ ] Chain integrity validation in response

---

## Technical Notes

### API Endpoint

```typescript
// GET /api/truth-chain/verify/:id (public, no auth)
interface VerificationResponse {
  verified: boolean;
  record: {
    id: string;
    recordType: string;
    subjectType: string;
    subjectId: string;
    action: string;
    createdAt: string;
  };
  chainIntegrity: boolean;
  proof: {
    sequence: number;
    previousHash: string;
    hash: string;
    calculatedHash: string;
    hashMatch: boolean;
  };
  subject?: {
    name: string;
    trustScore?: number;
    trustTier?: string;
  };
}
```

### Verification Page

```
/verify/[recordId]/page.tsx
├── Record details card
├── Chain proof visualization
├── Subject info (agent/decision)
├── QR code for sharing
├── Download certificate button
└── Embed code snippet
```

### Embeddable Widget

```html
<!-- Widget embed code -->
<div
  data-agentanchor-verify="record-id"
  data-theme="light"
  data-size="compact"
></div>
<script src="https://agentanchorai.com/verify-widget.js"></script>
```

### Certificate Generation

- Use `@react-pdf/renderer` for PDF generation
- Certificate includes: agent name, certification date, trust score, QR code, verification URL
- Styled with AgentAnchor branding

### Files to Create/Modify

- `app/api/truth-chain/verify/[id]/route.ts` - Public verification API
- `app/verify/[id]/page.tsx` - Public verification page
- `components/verify/VerificationCard.tsx` - Verification display
- `components/verify/ChainProof.tsx` - Hash chain visualization
- `components/verify/QRCode.tsx` - QR code generator
- `components/verify/CertificatePDF.tsx` - PDF certificate
- `public/verify-widget.js` - Embeddable widget script

---

## Dependencies

- Story 5-4: Truth Chain Records (records must exist)

---

## Out of Scope

- Bulk verification API
- Historical chain exploration UI
- Cross-platform verification
- Blockchain proof anchoring
