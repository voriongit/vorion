# 🚀 AgentAnchor Portal - Quick Start Guide

## Status: ✅ READY TO RUN

Dependencies are installed and the app is configured. You can start the portal now!

---

## Option 1: Run Portal Locally (Recommended First)

### Start Development Server

```bash
cd C:\Axiom\apps\agentanchor
npm run dev
```

The portal will start on: **http://localhost:3000**

### Portal Routes Created

✅ **Mint AgentCard**: http://localhost:3000/portal/mint
✅ **Certify Agent**: http://localhost:3000/portal/certify

---

## Configuration

The portal uses the existing `.env.local` file. Key environment variables:

```bash
# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://...

# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# AgentCard Contract (add this)
NEXT_PUBLIC_AGENTCARD_ADDRESS=<YOUR_DEPLOYED_CONTRACT_ADDRESS>
```

**Note**: Update `NEXT_PUBLIC_AGENTCARD_ADDRESS` after deploying the AgentCard contract to Mumbai.

---

## Portal Features

### Current Implementation

1. **Mint AgentCard** (`/portal/mint`)
   - Create ERC-721 NFT for agent identity
   - W3C DID integration
   - Capabilities management
   - MetaMask integration
   - IPFS metadata upload

2. **Certify Agent** (`/portal/certify`)
   - Select uncertified agent
   - Assign trust score (0-1000)
   - Automatic tier derivation (T0-T5)
   - Set certification expiry
   - CERTIFIER_ROLE verification

### Enterprise Platform

The full AgentAnchor platform includes:
- `/dashboard` - Main command center
- `/agents` - Agent registry and management
- `/governance` - Policy enforcement
- `/escalations` - Human review queue
- `/audit` - Cryptographic proof chain
- `/compliance` - EU AI Act reports
- `/observer` - Real-time monitoring
- `/sandbox` - Agent testing

---

## Testing the Portal UI

### 1. Start the Portal

```bash
cd C:\Axiom\apps\agentanchor
npm run dev
```

### 2. Open in Browser

```
http://localhost:3000/portal/mint
```

### 3. Connect MetaMask

- Install MetaMask browser extension
- Switch to Mumbai testnet
- Connect wallet to portal

### 4. Mint AgentCard

Fill in the form:
- **DID**: `did:vorion:ed25519:abc123...`
- **Name**: `CC AI Agent (Google Labs)`
- **Description**: `Personal productivity agent`
- **Capabilities**: `gmail_read`, `gmail_send`, etc.

Click "Mint AgentCard"

### 5. Certify Agent

Navigate to `/portal/certify`:
- Select the agent you just minted
- Set trust score (e.g., 350 for T2)
- Set expiry (e.g., 12 months)
- Click "Certify Agent"

---

## Development Notes

### Portal Pages Location

```
apps/agentanchor/
├── app/
│   └── portal/
│       ├── mint/
│       │   └── page.tsx          # Mint AgentCard UI
│       └── certify/
│           └── page.tsx          # Certify Agent UI
```

### Tech Stack

- **Framework**: Next.js 14 (App Router)
- **UI**: React 18, Tailwind CSS
- **Blockchain**: ethers.js v6
- **Wallet**: MetaMask integration
- **Database**: Drizzle ORM + Neon PostgreSQL
- **Auth**: Supabase

### Hot Reload

Changes to portal pages will hot-reload automatically. Edit files and see changes instantly in the browser.

---

## Next Steps

After the portal is running:

1. **Deploy AgentCard Contract**
   - Follow `packages/basis/DEPLOY-NOW.md`
   - Get contract address from deployment
   - Update `NEXT_PUBLIC_AGENTCARD_ADDRESS` in `.env.local`

2. **Test End-to-End Flow**
   - Mint → Certify → View on PolygonScan
   - Verify NFT ownership
   - Check trust tier assignment

3. **Integrate with CC Agent**
   - Connect CC Agent to use AgentCard
   - Implement KYA verification flow
   - Add multi-persona architecture

---

## Troubleshooting

### "Module not found"

```bash
npm install
```

### "Database connection failed"

Check DATABASE_URL in `.env.local` - must be valid Neon connection string.

### "MetaMask not found"

Install MetaMask browser extension: https://metamask.io/download/

### "Network error"

Make sure Mumbai testnet is selected in MetaMask.

---

## You're Ready! 🎯

Start the portal and explore:

```bash
cd C:\Axiom\apps\agentanchor
npm run dev
```

Then open: **http://localhost:3000/portal/mint**

**Estimated time**: 2 minutes to start, 5 minutes to test full flow

---

**Happy minting!** 🎉
