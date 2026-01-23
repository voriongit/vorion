# 🚀 AgentCard Deployment Guide - Polygon Amoy Testnet

## ⚠️ Important: Mumbai → Amoy Migration

**Mumbai testnet has been deprecated!** Use **Amoy testnet** instead.

**Key Changes**:
- Testnet: Mumbai (deprecated) → **Amoy** (current)
- Native Token: MATIC → **POL**
- Chain ID: 80001 → **80002**
- RPC URL: New Amoy endpoints
- Faucet: New Amoy faucet

---

## Prerequisites ✅

1. **Node.js** 22+ and npm ✅ (Already installed)
2. **Dependencies** ✅ (Already installed - 474 packages)
3. **Contract Compiled** ✅ (23 Solidity files)
4. **Polygon Amoy testnet** POL tokens (from faucet)
5. **Private key** with funds
6. **PolygonScan API key** (optional, for verification)

---

## Step 1: Get Testnet POL (5 minutes)

### Polygon Amoy Faucet

Visit: **https://faucet.polygon.technology/**

1. Select **"Amoy"** testnet (not Mumbai!)
2. Paste your wallet address
3. Click **"Submit"**
4. Wait 1-2 minutes for POL tokens

**Recommended**: Get 1-2 POL (enough for ~100 mints)

**Alternative Faucets**:
- https://www.alchemy.com/faucets/polygon-amoy
- https://www.allthatnode.com/faucet/polygon.dsrv

---

## Step 2: Configure Environment

Your `.env` file already exists. Update it:

```bash
cd C:\Axiom\packages\basis

# Edit .env file
code .env  # or notepad .env
```

Required configuration:

```bash
# Your deployment wallet private key (must start with 0x)
# ⚠️ TESTNET ONLY - Never use mainnet keys!
PRIVATE_KEY=0x1234567890abcdef...  # 66 characters total

# Amoy RPC (default works, or use custom)
AMOY_RPC_URL=https://rpc-amoy.polygon.technology

# Optional: For contract verification on PolygonScan
POLYGONSCAN_API_KEY=YOUR_API_KEY_HERE
```

**Get PolygonScan API Key** (free):
1. Visit https://polygonscan.com/apis
2. Sign up for free account
3. Create API key
4. Copy to .env

---

## Step 3: Deploy to Amoy Testnet (2 minutes)

```bash
cd C:\Axiom\packages\basis

# Deploy AgentCard contract
npx hardhat run scripts/deploy-agentcard.ts --network amoy
```

**Expected Output**:
```
Deploying AgentCard with account: 0x...
Account balance: 1.5 POL

✅ AgentCard deployed to: 0x1234567890abcdef1234567890abcdef12345678
Granting CERTIFIER_ROLE to deployer...
✅ CERTIFIER_ROLE granted

📋 Deployment Summary:
=====================
Contract Address: 0x1234567890abcdef1234567890abcdef12345678
Deployer: 0x...
Network: amoy
Chain ID: 80002

🔗 View on PolygonScan:
https://amoy.polygonscan.com/address/0x1234567890abcdef1234567890abcdef12345678

📝 Next Steps:
1. Save contract address: 0x1234567890abcdef1234567890abcdef12345678
2. Verify contract: npx hardhat verify --network amoy 0x...
3. Mint AgentCard: npx hardhat run scripts/mint-agentcard.ts --network amoy
4. Certify agent: npx hardhat run scripts/certify-agent.ts --network amoy
```

**📝 SAVE THE CONTRACT ADDRESS** - you'll need it!

---

## Step 4: Verify Contract on PolygonScan (2 minutes)

```bash
npx hardhat verify --network amoy <CONTRACT_ADDRESS>
```

**View on PolygonScan**:
```
https://amoy.polygonscan.com/address/<CONTRACT_ADDRESS>
```

**Note**: Contract works without verification, but verification allows anyone to read the contract code directly on PolygonScan.

---

## Step 5: Mint First AgentCard (CC Agent)

Update the contract address in the mint script:

```bash
# Edit scripts/mint-agentcard.ts
code scripts/mint-agentcard.ts
```

Find line ~15 and replace with your contract address:
```typescript
const agentCard = await AgentCard.attach(
  '0xYOUR_CONTRACT_ADDRESS_FROM_STEP_3'  // <-- Update this
);
```

Then mint:

```bash
npx hardhat run scripts/mint-agentcard.ts --network amoy
```

**Expected Output**:
```
Minting AgentCard with account: 0x...
Account balance: 1.48 POL
AgentCard contract: 0x...

Minting transaction submitted: 0xabc123...

✅ AgentCard minted successfully!
Token ID: 0
DID: did:vorion:google:cc-agent-v1
Owner: 0x...
Name: CC AI Agent (Google Labs)

📋 AgentCard Details:
-------------------
DID: did:vorion:google:cc-agent-v1
Name: CC AI Agent (Google Labs)
Description: Personal productivity agent for Google Workspace integration
Trust Score: 0
Tier: 0 (T0 - Sandbox)
Certified: false
Capabilities: [ 'gmail_read', 'gmail_send', 'calendar_read', 'calendar_write', 'drive_read', 'workspace_summarize' ]

🔗 View on PolygonScan:
https://amoy.polygonscan.com/token/0x.../0
```

---

## Step 6: Certify Agent with AgentAnchor

Update contract address in certify script:

```bash
code scripts/certify-agent.ts
```

Then certify:

```bash
npx hardhat run scripts/certify-agent.ts --network amoy
```

**Expected Output**:
```
Certifying AgentCard #0...
Trust Score: 350 (T2: Standard)
Expiry: 2027-01-22

Transaction submitted: 0xdef456...

✅ Agent certified successfully!
DID: did:vorion:google:cc-agent-v1
Trust Score: 350
Tier: 2 (T2 - Standard)
Certified: true
Certifier: 0x...
Expires: 2027-01-22
```

---

## You've Deployed! 🎉

### What You Now Have:

1. ✅ **AgentCard NFT Contract** deployed on Polygon Amoy
2. ✅ **First AgentCard** minted (Token ID: 0)
3. ✅ **CC Agent Certified** with T2 trust score (350)
4. ✅ **On-Chain Identity** for `did:vorion:google:cc-agent-v1`

### View Your Work:

**PolygonScan** (Amoy):
```
https://amoy.polygonscan.com/address/<YOUR_CONTRACT_ADDRESS>
```

**Your NFT**:
```
https://amoy.polygonscan.com/token/<CONTRACT_ADDRESS>?a=0
```

---

## Network Information

### Polygon Amoy Testnet

| Property | Value |
|----------|-------|
| **Network Name** | Polygon Amoy Testnet |
| **Chain ID** | 80002 |
| **Currency** | POL (not MATIC!) |
| **RPC URL** | https://rpc-amoy.polygon.technology |
| **Block Explorer** | https://amoy.polygonscan.com |
| **Faucet** | https://faucet.polygon.technology |

### Add to MetaMask

1. Open MetaMask
2. Click network dropdown
3. Click "Add Network"
4. Enter details above
5. Save

---

## Common Issues & Solutions

### "Insufficient funds for gas"
- Get more testnet POL from faucet
- Check balance: Account balance shown in deployment output

### "Network error"
- Amoy testnet might be congested
- Try again in a few minutes
- Or use alternative RPC: https://polygon-amoy-bor-rpc.publicnode.com

### "Contract verification failed"
- Make sure PolygonScan API key is correct
- Try again after a few minutes
- Verification is optional - contract works without it

### "Invalid account" error
- Private key must start with `0x`
- Private key must be exactly 66 characters (0x + 64 hex chars)
- Make sure no extra spaces in .env file

---

## Next Steps

### Immediate
1. ✅ View your contract on PolygonScan
2. ✅ Share contract address with team
3. ✅ Test minting more AgentCards

### Integration
4. Update AgentAnchor portal with contract address
5. Integrate KYA SDK for verification
6. Connect CC Agent to use AgentCard
7. Implement multi-persona architecture

### Production
8. Test thoroughly on Amoy
9. Deploy to Polygon mainnet (when ready)
10. Launch bai-cc.com with Vorion integration

---

## Scripts Reference

```bash
# Compile contract
npx hardhat compile

# Deploy to Amoy (recommended)
npx hardhat run scripts/deploy-agentcard.ts --network amoy

# Deploy to Mumbai (deprecated)
npx hardhat run scripts/deploy-agentcard.ts --network mumbai

# Mint AgentCard
npx hardhat run scripts/mint-agentcard.ts --network amoy

# Certify agent
npx hardhat run scripts/certify-agent.ts --network amoy

# Verify contract
npx hardhat verify --network amoy <CONTRACT_ADDRESS>

# Check contract compilation
npx hardhat compile

# Clean build artifacts
npx hardhat clean
```

---

## Cost Estimates

**Polygon Amoy Testnet** (all free testnet POL):
- Deploy AgentCard: ~0.01 POL (~$0.00)
- Mint AgentCard: ~0.002 POL (~$0.00)
- Certify Agent: ~0.001 POL (~$0.00)

**Polygon Mainnet** (real POL):
- Deploy AgentCard: ~0.02 POL (~$0.016 USD)
- Mint AgentCard: ~0.005 POL (~$0.004 USD)
- Certify Agent: ~0.002 POL (~$0.0016 USD)

**Total for 1 agent (mainnet)**: ~$0.022 USD

---

## You're Ready to Deploy! 🎯

**Estimated time**: 10-15 minutes total
**Estimated cost**: Free on Amoy testnet!

**Start here**:
```bash
cd C:\Axiom\packages\basis
npx hardhat run scripts/deploy-agentcard.ts --network amoy
```

---

**Happy deploying on Amoy!** 🚀

*Note: If you need to deploy to Mumbai for compatibility with existing infrastructure, replace `--network amoy` with `--network mumbai` in all commands. However, Mumbai will be discontinued, so migrate to Amoy as soon as possible.*
