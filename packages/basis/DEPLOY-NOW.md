# 🚀 AgentCard Deployment - Ready to Deploy!

## Status: ✅ CONTRACT COMPILED SUCCESSFULLY

All dependencies installed and contract compiled. You're ready to deploy!

---

## Prerequisites Complete ✅

- ✅ Node.js 22+ installed
- ✅ Dependencies installed (474 packages)
- ✅ Contract compiled (23 Solidity files)
- ✅ TypeScript types generated (64 typings)
- ✅ `.env` file created (needs your private key)

---

## Step 1: Get Testnet MATIC (5 minutes)

### Mumbai Faucet
Visit: **https://faucet.polygon.technology/**

1. Select **"Mumbai"** network
2. Paste your wallet address
3. Click **"Submit"**
4. Wait 1-2 minutes for tokens

**Recommended**: Get 1-2 MATIC (enough for ~100 mints)

---

## Step 2: Configure .env File

Edit `C:\Axiom\packages\basis\.env`:

```bash
# Required: Your deployment wallet private key
# ⚠️ TESTNET ONLY - Never use mainnet keys!
PRIVATE_KEY=0x1234567890abcdef...  # 66 characters starting with 0x

# Optional: Custom RPC (default works fine)
MUMBAI_RPC_URL=https://rpc-mumbai.maticvigil.com

# Optional: For contract verification on PolygonScan
POLYGONSCAN_API_KEY=YOUR_API_KEY_HERE
```

**Get PolygonScan API Key** (free):
1. Visit https://polygonscan.com/apis
2. Sign up for free account
3. Create API key
4. Copy to .env

---

## Step 3: Deploy to Mumbai Testnet (2 minutes)

```bash
cd C:\Axiom\packages\basis

# Deploy AgentCard contract
npx hardhat run scripts/deploy-agentcard.ts --network mumbai
```

**Expected Output**:
```
Deploying AgentCard to mumbai...
AgentCard deployed to: 0x1234567890abcdef1234567890abcdef12345678
Granting CERTIFIER_ROLE to deployer...
✅ Deployment complete!
```

**📝 SAVE THE CONTRACT ADDRESS** - you'll need it for the next steps!

---

## Step 4: Verify Contract on PolygonScan (optional, 2 minutes)

```bash
npx hardhat verify --network mumbai <CONTRACT_ADDRESS>
```

**View on PolygonScan**:
```
https://mumbai.polygonscan.com/address/<CONTRACT_ADDRESS>
```

---

## Step 5: Mint First AgentCard (CC Agent)

Edit `scripts/mint-agentcard.ts` and set the contract address:

```typescript
const agentCard = await AgentCard.attach(
  '<YOUR_CONTRACT_ADDRESS_FROM_STEP_3>'
);
```

Then mint:

```bash
npx hardhat run scripts/mint-agentcard.ts --network mumbai
```

**Expected Output**:
```
Minting AgentCard with account: 0x...
✅ AgentCard minted successfully!
Token ID: 0
DID: did:vorion:google:cc-agent-v1
Owner: 0x...
Name: CC AI Agent (Google Labs)

📋 AgentCard Details:
-------------------
DID: did:vorion:google:cc-agent-v1
Name: CC AI Agent (Google Labs)
Trust Score: 0
Tier: T0 (Sandbox)
Certified: false

🔗 View on PolygonScan:
https://mumbai.polygonscan.com/token/0x.../0
```

---

## Step 6: Certify Agent with AgentAnchor

Edit `scripts/certify-agent.ts` and set contract address, then:

```bash
npx hardhat run scripts/certify-agent.ts --network mumbai
```

**Expected Output**:
```
Certifying AgentCard #0...
Trust Score: 350 (T2: Standard)
Expiry: <12 months from now>

✅ Agent certified successfully!
DID: did:vorion:google:cc-agent-v1
Trust Score: 350
Tier: T2 (Standard)
Certified: true
```

---

## You've Deployed!

### What You Now Have:

1. ✅ **AgentCard NFT Contract** deployed on Polygon Mumbai
2. ✅ **First AgentCard** minted (Token ID: 0)
3. ✅ **CC Agent Certified** with T2 trust score (350)
4. ✅ **On-Chain Identity** for `did:vorion:google:cc-agent-v1`

### Next Steps:

1. **View on PolygonScan**: Explore your contract and AgentCard
2. **Integrate with KYA SDK**: Use the AgentCard in your applications
3. **Mint More AgentCards**: Create cards for other agents
4. **Deploy Portal UI**: Set up AgentAnchor certification portal

---

## Need Help?

### Common Issues:

**"Insufficient funds for gas"**
- Get more testnet MATIC from faucet
- Check balance: `npx hardhat run scripts/check-balance.ts --network mumbai`

**"Network error"**
- Mumbai testnet might be congested
- Try again in a few minutes
- Or use different RPC: https://polygon-rpc.com/

**"Contract verification failed"**
- Make sure PolygonScan API key is correct
- Try again after a few minutes
- Verification is optional - contract works without it

### Scripts Reference:

```bash
# Compile contract
npx hardhat compile

# Deploy to Mumbai
npx hardhat run scripts/deploy-agentcard.ts --network mumbai

# Mint AgentCard
npx hardhat run scripts/mint-agentcard.ts --network mumbai

# Certify agent
npx hardhat run scripts/certify-agent.ts --network mumbai

# Query AgentCard
npx hardhat run scripts/query-agentcard.ts --network mumbai

# Verify contract
npx hardhat verify --network mumbai <CONTRACT_ADDRESS>
```

---

**You're ready to deploy! 🎯**

**Estimated time**: 10-15 minutes total
**Estimated cost**: ~0.01 MATIC (~$0.008 USD)
