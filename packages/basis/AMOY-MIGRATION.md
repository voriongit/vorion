# ⚠️ Polygon Mumbai → Amoy Migration Guide

## What Changed?

Polygon deprecated Mumbai testnet in favor of Amoy testnet on **October 13, 2024**.

### Key Changes

| Property | Mumbai (Old) | Amoy (New) |
|----------|--------------|------------|
| **Status** | ❌ Deprecated | ✅ Active |
| **Chain ID** | 80001 | **80002** |
| **Native Token** | MATIC | **POL** |
| **RPC URL** | https://rpc-mumbai.maticvigil.com | **https://rpc-amoy.polygon.technology** |
| **Faucet** | (deprecated) | **https://faucet.polygon.technology** |
| **Block Explorer** | https://mumbai.polygonscan.com | **https://amoy.polygonscan.com** |

---

## Quick Migration Steps

### 1. Update Hardhat Config ✅ (Already Done)

Your `hardhat.config.ts` now includes Amoy network:

```typescript
amoy: {
  url: 'https://rpc-amoy.polygon.technology',
  chainId: 80002,
  // ... other config
}
```

### 2. Update Environment Variables ✅ (Already Done)

Your `.env.example` now includes:

```bash
# Amoy Testnet (Current)
AMOY_RPC_URL=https://rpc-amoy.polygon.technology

# Mumbai Testnet (DEPRECATED)
MUMBAI_RPC_URL=https://rpc-mumbai.maticvigil.com
```

Copy `.env.example` to `.env` and add your private key.

### 3. Update Package Scripts ✅ (Already Done)

New scripts available:

```bash
npm run deploy:amoy     # Deploy to Amoy (recommended)
npm run verify:amoy     # Verify on Amoy
npm run deploy:mumbai   # Deploy to Mumbai (deprecated)
```

### 4. Get POL Tokens from Faucet

**New Faucet URL**: https://faucet.polygon.technology/

1. Select **"Amoy"** network
2. Paste your wallet address
3. Get POL tokens (not MATIC!)

### 5. Update MetaMask Network

Add Amoy to MetaMask:

- **Network Name**: Polygon Amoy Testnet
- **RPC URL**: https://rpc-amoy.polygon.technology
- **Chain ID**: 80002
- **Currency Symbol**: POL
- **Block Explorer**: https://amoy.polygonscan.com

---

## Updated Commands

### Deploy to Amoy (Recommended)

```bash
# Deploy contract
npx hardhat run scripts/deploy-agentcard.ts --network amoy

# Mint AgentCard
npx hardhat run scripts/mint-agentcard.ts --network amoy

# Certify agent
npx hardhat run scripts/certify-agent.ts --network amoy

# Verify contract
npx hardhat verify --network amoy <CONTRACT_ADDRESS>
```

### Deploy to Mumbai (Deprecated, but still works for now)

```bash
# If you MUST use Mumbai
npx hardhat run scripts/deploy-agentcard.ts --network mumbai
```

**Warning**: Mumbai will be discontinued. Migrate to Amoy ASAP.

---

## Why the Change?

1. **POL Migration**: Polygon transitioned from MATIC to POL token
2. **Infrastructure Upgrade**: New infrastructure for better performance
3. **Future-Proofing**: Align testnet with mainnet upgrades
4. **Mumbai Sunset**: Mumbai will be fully deprecated soon

---

## Contract Compatibility

✅ **Good News**: Your smart contracts work on both networks!

- Same Solidity version (0.8.20)
- Same opcodes and features
- Same OpenZeppelin libraries
- No code changes needed

The only differences are:
- Network configuration (RPC, chain ID)
- Native token name (MATIC → POL)
- Block explorer URLs

---

## Recommended Action

**For New Deployments**: Use Amoy

```bash
cd C:\Axiom\packages\basis
npx hardhat run scripts/deploy-agentcard.ts --network amoy
```

**For Existing Mumbai Deployments**:

1. Test on Amoy
2. Plan migration timeline
3. Update documentation
4. Migrate when ready

---

## Updated Documentation

All documentation has been updated:

- ✅ `hardhat.config.ts` - Amoy network added
- ✅ `.env.example` - Amoy RPC URLs
- ✅ `package.json` - Amoy deploy scripts
- ✅ `DEPLOY-AMOY.md` - Complete Amoy guide
- ✅ `deploy-agentcard.ts` - Amoy URLs
- ✅ `mint-agentcard.ts` - Amoy explorer links

---

## Resources

- **Polygon Amoy Docs**: https://docs.polygon.technology/tools/faucets/
- **Faucet**: https://faucet.polygon.technology/
- **Block Explorer**: https://amoy.polygonscan.com
- **RPC Status**: https://chainlist.org/chain/80002

---

## Need Help?

**Configuration files are ready** - just follow `DEPLOY-AMOY.md`!

Quick start:
```bash
cd C:\Axiom\packages\basis
# 1. Get POL from faucet
# 2. Add private key to .env
# 3. Deploy!
npx hardhat run scripts/deploy-agentcard.ts --network amoy
```

---

**Last Updated**: 2026-01-22
**Status**: ✅ Migration Complete - Ready for Amoy Deployment
