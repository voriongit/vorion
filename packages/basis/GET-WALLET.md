# 🦊 How to Get a Wallet for Deployment

## Option 1: MetaMask (Recommended)

### Install MetaMask

**Browser Extension**:
- Chrome: https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn
- Firefox: https://addons.mozilla.org/firefox/addon/ether-metamask/
- Edge: https://microsoftedge.microsoft.com/addons/detail/metamask/

Or visit: **https://metamask.io/download/**

---

## Create Your Wallet

### Step 1: Install & Open MetaMask

1. Click the MetaMask extension icon
2. Click **"Create a new wallet"**
3. Agree to terms

### Step 2: Create Password

- Choose a strong password
- This password is only for this device

### Step 3: Save Recovery Phrase ⚠️ CRITICAL

MetaMask will show you a **12-word secret recovery phrase**

**⚠️ EXTREMELY IMPORTANT**:
- ✅ Write it down on paper (don't screenshot!)
- ✅ Store it safely (locked drawer, safe, etc.)
- ✅ Never share it with anyone
- ✅ Never enter it on any website
- ❌ If you lose it, you lose access to your wallet FOREVER
- ❌ If someone gets it, they can steal your funds

Example format:
```
1. apple
2. banana
3. cherry
... (12 words total)
```

### Step 4: Confirm Recovery Phrase

- MetaMask will ask you to select words in order
- This confirms you saved it correctly

### Step 5: Wallet Created! 🎉

You now have:
- ✅ A wallet address (looks like: `0x1234...5678`)
- ✅ A private key (we'll export this next)

---

## Get Your Private Key

### For Testnet Deployment (What You Need)

⚠️ **IMPORTANT**: We'll create a SEPARATE testnet-only wallet for safety!

#### Create Testnet-Only Account

1. Click the account icon (circle with colored pattern)
2. Click **"Add account or hardware wallet"**
3. Select **"Add a new Ethereum account"**
4. Name it: `Testnet Only - Amoy`
5. Click **"Create"**

#### Export Private Key

1. Click the three dots (⋮) next to the account name
2. Select **"Account details"**
3. Click **"Show private key"**
4. Enter your MetaMask password
5. Click **"Hold to reveal Private Key"**
6. **Copy the private key** (looks like: `0xabc123...`)

**⚠️ Security Tips**:
- ✅ Only use this account for testnet
- ✅ Never send real money to this address
- ✅ The private key should start with `0x`
- ✅ It should be 66 characters total (0x + 64 hex chars)

---

## Add Private Key to .env

```bash
cd C:\Axiom\packages\basis

# Open .env file
code .env  # or: notepad .env
```

Add your private key:

```bash
# Your testnet-only private key (starts with 0x)
PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE

# Amoy RPC (already configured)
AMOY_RPC_URL=https://rpc-amoy.polygon.technology
```

Save the file.

**⚠️ NEVER commit .env to git!** (It's already in .gitignore)

---

## Add Polygon Amoy Network to MetaMask

### Automatic (Recommended)

Visit: **https://chainlist.org/?search=amoy**
1. Search for "Amoy"
2. Click **"Add to MetaMask"**
3. Approve in MetaMask

### Manual

1. Open MetaMask
2. Click network dropdown (top left)
3. Click **"Add network"**
4. Click **"Add a network manually"**
5. Enter details:

```
Network Name: Polygon Amoy Testnet
RPC URL: https://rpc-amoy.polygon.technology
Chain ID: 80002
Currency Symbol: POL
Block Explorer: https://amoy.polygonscan.com
```

6. Click **"Save"**
7. Switch to Amoy network

---

## Get Testnet POL Tokens

### Polygon Faucet

1. Visit: **https://faucet.polygon.technology/**
2. Select **"Amoy"** network
3. Copy your wallet address from MetaMask
   - Click the address to copy it
4. Paste your address in the faucet
5. Click **"Submit"**
6. Wait 1-2 minutes

You should receive **1-2 POL** tokens for testing.

**Check Balance in MetaMask**:
- Switch to Amoy network
- Your POL balance will show

### Alternative Faucets

If the main faucet doesn't work:
- https://www.alchemy.com/faucets/polygon-amoy
- https://www.allthatnode.com/faucet/polygon.dsrv

---

## Security Best Practices

### ✅ DO

1. **Use separate wallets for testnet and mainnet**
   - Create "Testnet Only" account in MetaMask
   - Never mix test and real funds

2. **Keep recovery phrase offline**
   - Write on paper, store safely
   - Never in cloud, screenshots, or digital notes

3. **Never share private keys or recovery phrase**
   - Not with support, not in Discord/Telegram
   - Real support never asks for these

4. **Double-check network before transactions**
   - Make sure you're on Amoy (testnet)
   - Testnet transactions are free/cheap

### ❌ DON'T

1. ❌ Use your main wallet for testing
2. ❌ Store private keys in code or screenshots
3. ❌ Commit .env file to git (it's already gitignored)
4. ❌ Share your screen showing private keys
5. ❌ Click random links asking to "connect wallet"
6. ❌ Send real money to testnet addresses

---

## Verify Your Setup

### Check 1: Private Key Format

Your private key should:
- Start with `0x`
- Be exactly 66 characters (0x + 64 hex characters)
- Example: `0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef`

### Check 2: Network

In MetaMask:
- Network should show "Polygon Amoy Testnet"
- Currency should be "POL" (not MATIC)

### Check 3: Balance

- You should have 1-2 POL
- Shown in MetaMask on Amoy network

---

## You're Ready! ✅

Checklist:
- ✅ MetaMask installed
- ✅ Testnet-only account created
- ✅ Private key exported
- ✅ Private key added to `.env` file
- ✅ Amoy network added to MetaMask
- ✅ POL tokens received from faucet

**Next step**: Deploy your contract!

```bash
cd C:\Axiom\packages\basis
npx hardhat run scripts/deploy-agentcard.ts --network amoy
```

---

## Need Help?

### MetaMask Support
- https://support.metamask.io/
- https://metamask.io/faqs/

### Polygon Faucet Issues
- Try different faucet from alternatives above
- Make sure you're on Amoy network
- Check your address is correct (starts with 0x)

### Private Key Issues
- Must start with `0x`
- Must be 66 characters total
- Must be from the account you want to deploy with
- Don't include quotes in .env file

---

## Example .env File

```bash
# Your testnet-only private key
PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef

# Amoy RPC URL (default works fine)
AMOY_RPC_URL=https://rpc-amoy.polygon.technology

# Optional: PolygonScan API key for verification
POLYGONSCAN_API_KEY=

# Optional: Gas reporting
REPORT_GAS=false
```

---

**You're all set! Happy deploying! 🚀**

**Time to complete**: 10-15 minutes
**Cost**: Free (testnet POL is free)
