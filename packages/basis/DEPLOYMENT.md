# AgentCard Smart Contract Deployment Guide

## Prerequisites

1. **Node.js** 20+ and npm
2. **Polygon Mumbai testnet** MATIC tokens (get from faucet)
3. **Private key** with funds
4. **PolygonScan API key** (optional, for verification)

---

## Setup

### 1. Install Dependencies

```bash
cd packages/basis
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your values
```

**Required**:
- `PRIVATE_KEY`: Your deployer wallet private key (DO NOT COMMIT)
- `MUMBAI_RPC_URL`: Polygon Mumbai RPC (default works)
- `POLYGONSCAN_API_KEY`: For contract verification (optional)

### 3. Get Testnet MATIC

Visit: https://faucet.polygon.technology/
- Network: Mumbai
- Paste your wallet address
- Request tokens

**Check balance**:
```bash
npx hardhat run scripts/check-balance.ts --network mumbai
```

---

## Deployment

### Mumbai Testnet (Recommended First)

```bash
npm run deploy:mumbai
```

**Expected output**:
```
Deploying AgentCard to mumbai...
AgentCard deployed to: 0x1234567890abcdef1234567890abcdef12345678
Granting CERTIFIER_ROLE to 0x...
CERTIFIER_ROLE granted
```

**Save the contract address!**

### Verify on PolygonScan

```bash
npx hardhat verify --network mumbai <CONTRACT_ADDRESS>
```

**View on PolygonScan**: https://mumbai.polygonscan.com/address/<CONTRACT_ADDRESS>

---

## Testing Deployment

### 1. Mint First AgentCard

```bash
npx hardhat run scripts/mint-agentcard.ts --network mumbai
```

### 2. Certify Agent

```bash
npx hardhat run scripts/certify-agent.ts --network mumbai
```

### 3. Query AgentCard

```bash
npx hardhat run scripts/query-agentcard.ts --network mumbai
```

---

## Production Deployment (Polygon Mainnet)

**ONLY AFTER TESTING ON MUMBAI!**

### 1. Get Real MATIC

Purchase MATIC on exchange, withdraw to your wallet.

### 2. Update .env

```bash
POLYGON_RPC_URL=https://polygon-rpc.com
# Use production private key (with real funds)
```

### 3. Deploy

```bash
npm run deploy:polygon
```

### 4. Verify

```bash
npx hardhat verify --network polygon <CONTRACT_ADDRESS>
```

---

## Smart Contract Details

### Contract: `AgentCard.sol`

**Address** (Mumbai): `0x...` (after deployment)
**Address** (Polygon): `0x...` (after deployment)

**Roles**:
- `DEFAULT_ADMIN_ROLE`: Full admin (deployer)
- `MINTER_ROLE`: Can mint new AgentCards
- `CERTIFIER_ROLE`: Can certify agents (AgentAnchor)

### Key Functions

#### Mint AgentCard
```solidity
function mint(
  address to,
  string memory did,
  string memory name,
  string memory description,
  string[] memory capabilities,
  string memory metadataURI
) public onlyRole(MINTER_ROLE) returns (uint256)
```

#### Certify Agent
```solidity
function certify(
  uint256 tokenId,
  uint256 trustScore,
  uint256 expiryTimestamp
) public onlyRole(CERTIFIER_ROLE)
```

#### Update Trust Score
```solidity
function updateTrustScore(
  uint256 tokenId,
  uint256 newTrustScore
) public onlyRole(CERTIFIER_ROLE)
```

#### Revoke Certification
```solidity
function revokeCertification(
  uint256 tokenId,
  string memory reason
) public onlyRole(CERTIFIER_ROLE)
```

---

## Gas Costs (Estimated)

| Operation | Gas | Cost (20 gwei) | Cost (USD @ $0.80/MATIC) |
|-----------|-----|----------------|---------------------------|
| Deploy contract | ~3,500,000 | 0.07 MATIC | ~$0.056 |
| Mint AgentCard | ~250,000 | 0.005 MATIC | ~$0.004 |
| Certify agent | ~80,000 | 0.0016 MATIC | ~$0.0013 |
| Update trust score | ~50,000 | 0.001 MATIC | ~$0.0008 |
| Revoke certification | ~60,000 | 0.0012 MATIC | ~$0.001 |

**Total to deploy + mint + certify**: ~$0.06 on Mumbai, ~$0.10 on Polygon mainnet

---

## Troubleshooting

### Error: "Insufficient funds"

**Solution**: Get more MATIC from faucet (testnet) or purchase (mainnet)

### Error: "Nonce too high"

**Solution**: Reset Hardhat:
```bash
npx hardhat clean
rm -rf cache artifacts
```

### Error: "Contract already deployed"

**Solution**: Check `deployments/mumbai/` folder, contract may already exist

### Error: "Verification failed"

**Solution**: Wait 1-2 minutes after deployment, then retry verify command

---

## Next Steps

After successful deployment:

1. **Update documentation** with contract addresses
2. **Grant roles** to AgentAnchor backend
3. **Integrate SDK** into applications
4. **Test minting** via API
5. **Monitor** contract on PolygonScan

---

## Support

- **Polygon Docs**: https://docs.polygon.technology/
- **Hardhat Docs**: https://hardhat.org/docs
- **OpenZeppelin**: https://docs.openzeppelin.com/contracts/

---

**Document Version**: 1.0.0
**Last Updated**: 2026-01-22
**Network**: Polygon Mumbai (testnet) → Polygon Mainnet (production)
