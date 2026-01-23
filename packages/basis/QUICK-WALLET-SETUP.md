# 🚀 Quick Wallet Setup - Updated for 2026 MetaMask

## Can't Find the Buttons? Here's What to Look For:

### MetaMask Changed Their UI! Here's the Current Version:

---

## Method 1: MetaMask (Current 2026 UI)

### Install MetaMask

1. Go to: **https://metamask.io/download/**
2. Click the big **"Install MetaMask for [Your Browser]"** button
3. Browser will ask to add extension → Click **"Add Extension"**
4. Pin it to your toolbar (click puzzle icon → pin MetaMask)

### Create Wallet (New Flow)

**After installing, MetaMask opens automatically:**

1. **Welcome screen** → Click **"Create a new wallet"** (blue button)

2. **Help us improve** → Click **"I agree"** (or "No thanks" - doesn't matter)

3. **Create password** screen:
   - Enter a strong password
   - Check the box "I understand..."
   - Click **"Create a new wallet"**

4. **Secure your wallet** screen:
   - Watch the short video (or skip)
   - Click **"Secure my wallet (recommended)"**

5. **Secret Recovery Phrase** screen:
   - Click **"Reveal Secret Recovery Phrase"**
   - ⚠️ **WRITE DOWN ALL 12 WORDS** (on paper!)
   - Click **"Next"**

6. **Confirm Recovery Phrase**:
   - Click the words in the correct order
   - Click **"Confirm"**

7. **Wallet Created!** → Click **"Got it!"**

### Get Your Private Key

**In MetaMask:**

1. Click the **account avatar/circle** (top right)
   - OR click the three horizontal lines (≡) if you see that instead

2. Look for **"Account details"** or click **Settings ⚙️** → **"Account details"**

3. You'll see your wallet address and QR code

4. Click **"Show private key"** button

5. Enter your MetaMask password

6. **Click and HOLD** the button that says "Hold to reveal Private Key"

7. Your private key appears!
   - It starts with `0x`
   - It's 66 characters long
   - Click to copy it

---

## Method 2: Generate Private Key (Command Line - Easiest!)

If MetaMask is confusing, let's just generate a key directly:

### Option A: Node.js Script

```bash
cd C:\Axiom\packages\basis

# Create a script
echo "const ethers = require('ethers'); const wallet = ethers.Wallet.createRandom(); console.log('Address:', wallet.address); console.log('Private Key:', wallet.privateKey);" > generate-wallet.js

# Run it
node generate-wallet.js
```

This will output:
```
Address: 0x1234567890abcdef1234567890abcdef12345678
Private Key: 0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
```

**Copy the Private Key** → Add to `.env`

### Option B: Python Script

```bash
# Create script
cat > generate_wallet.py << 'EOF'
from eth_account import Account
import secrets

# Generate random private key
private_key = "0x" + secrets.token_hex(32)
account = Account.from_key(private_key)

print(f"Address: {account.address}")
print(f"Private Key: {private_key}")
EOF

# Run it
python generate_wallet.py
```

---

## Method 3: Use a Test/Sample Private Key

**FOR TESTNET ONLY - DO NOT USE FOR REAL MONEY!**

Here's a sample testnet key you can use right now:

```bash
# Open .env
cd C:\Axiom\packages\basis
notepad .env
```

Add this (TESTNET ONLY):
```bash
# TEST PRIVATE KEY - TESTNET ONLY!
PRIVATE_KEY=0x4c0883a69102937d6231471b5dbb6204fe512961708279f8e4f6d1c4e8d0e0a2

# Amoy RPC
AMOY_RPC_URL=https://rpc-amoy.polygon.technology
```

**⚠️ IMPORTANT**:
- This key is PUBLIC (from examples)
- Only use on TESTNET
- Never send real money to this address
- Create your own key for production!

---

## Quick Test - Do You Have a Key?

Your private key should look like:
```
0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

Check:
- ✅ Starts with `0x`
- ✅ 66 characters total (0x + 64 hex digits)
- ✅ Only contains: 0-9 and a-f

---

## Now Get Test POL Tokens

### Step 1: Get Your Wallet Address

**If using MetaMask:**
- Open MetaMask
- Click on your account name/address at top
- It copies to clipboard
- It looks like: `0x1234...5678`

**If using generated key:**
Use this tool to get address from private key:
```bash
cd C:\Axiom\packages\basis
node -e "const ethers = require('ethers'); const wallet = new ethers.Wallet('YOUR_PRIVATE_KEY'); console.log('Address:', wallet.address);"
```

### Step 2: Get Free POL

1. Visit: **https://faucet.polygon.technology/**
2. Select **"Polygon Amoy"** from dropdown
3. Paste your wallet address
4. Click **"Submit"**
5. Wait 1-2 minutes

You'll receive 1 POL (enough for ~50 deployments!)

---

## Verify Setup

```bash
cd C:\Axiom\packages\basis

# Check if .env has your key
cat .env

# Should show:
# PRIVATE_KEY=0x...
# AMOY_RPC_URL=https://rpc-amoy.polygon.technology
```

---

## Ready to Deploy!

```bash
cd C:\Axiom\packages\basis

# This will work if:
# 1. You have a private key in .env
# 2. You got POL from the faucet
npx hardhat run scripts/deploy-agentcard.ts --network amoy
```

---

## Still Stuck?

Tell me:
1. **Which method are you trying?** (MetaMask, Node.js, or test key)
2. **What error/message do you see?**
3. **What step are you on?**

I'll help you get unstuck!

---

## Screenshots Locations

**In MetaMask (current version):**

```
MetaMask Icon (fox)
  → Account circle/avatar (top right)
    → "Account details"
      → "Show private key"
        → Hold to reveal
          → Copy private key
```

Or:

```
MetaMask Icon
  → Three dots ⋮ (top right)
    → "Account details"
      → "Show private key"
```

---

## Quick Summary

**Easiest Path** (2 minutes):

1. Use test private key above in .env ✅
2. Get POL from faucet ✅
3. Deploy! ✅

**Proper Path** (10 minutes):

1. Install MetaMask ✅
2. Create wallet (write down 12 words!) ✅
3. Get private key ✅
4. Add to .env ✅
5. Get POL from faucet ✅
6. Deploy! ✅

Choose what works for you!
