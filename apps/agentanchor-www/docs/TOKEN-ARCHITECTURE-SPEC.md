# AgentAnchor Dual Token Architecture Specification

**Version:** 1.0
**Date:** November 29, 2025
**Status:** Draft - Pending Review
**Blockchain:** Polygon (EVM Compatible)

---

## Executive Summary

AgentAnchor implements a dual-token economy designed for SEC compliance through utility-first, earn-only mechanics:

1. **AGENT Token** - Non-transferable reputation token earned through platform contributions
2. **ANCHOR Token** - Transferable utility token allocated via subscription, used for platform services

This architecture separates reputation (which cannot be bought) from access (which can be traded), creating a sustainable economy that rewards genuine participation while enabling marketplace liquidity.

---

## 1. AGENT Token (Reputation)

### 1.1 Core Properties

| Property | Value |
|----------|-------|
| Token Type | Non-Transferable (Soulbound) |
| Acquisition | Earn Only |
| Tradeable | No |
| Governance Rights | Yes |
| Decay | Yes (see 1.3) |
| Starting Balance | 0 |
| Maximum | No Cap |

### 1.2 Earning Methods

AGENT tokens are earned through verified platform contributions:

| Activity | Reward | Notes |
|----------|--------|-------|
| Create Agent | TBD | First agent creation bonus |
| Train Agent | TBD | Per training module completed |
| Graduate Agent | TBD | Agent passes council examination |
| Agent Performance | TBD | Based on consumer ratings |
| Community Contribution | TBD | Forum help, documentation, etc. |
| Bug Reports | TBD | Valid security/bug reports |
| Referral | TBD | New active users referred |

> **Note:** Specific token amounts to be determined after subscription pricing is finalized.

### 1.3 Decay Mechanics

AGENT tokens decay with inactivity to ensure reputation reflects current engagement:

```
DECAY CURVE PARAMETERS
======================

Grace Period:       90 days (no decay)
Decay Floor:        50% of balance (minimum retained)
Total Decay Period: 12 months (from end of grace period)

Acceleration Points:
- Month 0-6:   Base decay rate
- Month 6-9:   Accelerated decay (1.5x base)
- Month 9-12:  Rapid decay (2x base)

Formula: balance * (1 - decayRate * accelerationMultiplier)
```

**Visual Decay Curve:**

```
100% ─────┐
          │         Grace Period (90 days)
          └────────────────────┐
                               │
90%  ─────────────────────────────────────────────
                                \
80%  ─────────────────────────────\────────────────
                                   \
70%  ───────────────────────────────\──────────────
                                     \
60%  ─────────────────────────────────\────────────
                                       \ 1.5x
55%  ───────────────────────────────────\──────────
                                         \ 2x
50%  ═══════════════════════════════════════╧══════ FLOOR
     |      |      |      |      |      |      |
   Day 0   90    180    270    360    450    540
         (grace)  (6mo)  (9mo)  (12mo)
```

**Decay Reset:**
- Any earning activity resets the grace period
- Partial activity extends grace proportionally

### 1.4 Governance Rights

AGENT token holdings determine governance participation:

| Tier | AGENT Balance | Rights |
|------|---------------|--------|
| Observer | 0-99 | View proposals only |
| Participant | 100-499 | Vote on platform proposals |
| Contributor | 500-999 | Submit minor proposals |
| Advocate | 1,000-4,999 | Submit major proposals |
| Council Candidate | 5,000+ | Eligible for council roles |

### 1.5 Cohort Privileges

Higher AGENT token holdings unlock more cohort (private sharing group) capacity:

| AGENT Balance | Max Cohorts Owned | Max Cohort Members |
|---------------|-------------------|-------------------|
| 0-99 | 1 | 5 |
| 100-499 | 3 | 15 |
| 500-999 | 5 | 30 |
| 1,000-4,999 | 10 | 50 |
| 5,000+ | Unlimited | 100 |

**Public Profile Bonus:**
Users with public profiles receive +50% cohort limits.

---

## 2. ANCHOR Token (Utility/Access)

### 2.1 Core Properties

| Property | Value |
|----------|-------|
| Token Type | Transferable (Polygon Native) |
| Standard | Polygon POS Token |
| Acquisition | Subscription Allocation |
| Tradeable | Yes (P2P) |
| Governance Rights | No |
| Decay | No |
| Starting Balance | Based on subscription |

### 2.2 Subscription Allocation

ANCHOR tokens are allocated monthly based on subscription tier:

| Tier | Monthly Price | ANCHOR Allocation | Rollover |
|------|---------------|-------------------|----------|
| Free | $0 | TBD | No |
| Starter | TBD | TBD | 1 month |
| Professional | TBD | TBD | 3 months |
| Enterprise | TBD | TBD | 6 months |

> **Note:** Pricing and allocations to be finalized before launch.

### 2.3 Spending Uses

ANCHOR tokens are spent on platform services:

| Service | Cost | Notes |
|---------|------|-------|
| Agent Acquisition (Commission) | TBD | One-time purchase |
| Agent Clone | TBD | Copy with modifications |
| Premium Training Modules | TBD | Academy add-ons |
| API Calls (Overage) | TBD | Beyond included quota |
| Priority Support | TBD | Expedited assistance |
| Feature Unlocks | TBD | Premium capabilities |

### 2.4 Trading Rules

ANCHOR tokens can be traded peer-to-peer:

- **Trading**: Allowed between platform users
- **Gifting**: Allowed (zero-cost transfers)
- **External Trading**: Not supported (tokens remain on-platform)
- **Minimum Trade**: TBD
- **Trading Fee**: TBD (goes to platform treasury)

### 2.5 SEC Compliance Design

ANCHOR token is designed as pure utility:

1. **No Investment Expectation**: Allocated with subscription, not purchased separately
2. **Consumptive Use**: Spent on platform services
3. **No Profit Sharing**: No dividends or revenue distribution
4. **Bounded Ecosystem**: Utility only within AgentAnchor platform
5. **Value from Usage**: Token value derives from platform utility, not speculation

---

## 3. Privacy & Transparency

### 3.1 Default Privacy

All reputation data is **private by default**:

```
DEFAULT STATE
=============
- Token balances: Private
- Earning history: Private
- Governance votes: Private
- Cohort membership: Private

USER-CONTROLLED DISCLOSURE
==========================
- Make any data public (one-click)
- Share with specific cohorts (invite-based)
- Reveal specific proofs (Merkle proofs)
```

### 3.2 Public Profile Incentives

Users who choose public profiles receive benefits:

| Incentive | Benefit |
|-----------|---------|
| Cohort Bonus | +50% cohort limits |
| Verification Badge | Public trust indicator |
| Marketplace Visibility | Higher search ranking |
| Community Recognition | Leaderboard eligibility |

### 3.3 Cohort System

Cohorts enable selective sharing:

```
COHORT STRUCTURE
================
- Owner: Creates and manages cohort
- Members: Invited users with view access
- Permissions: Granular data sharing settings

PERMISSION OPTIONS
==================
- View AGENT balance: Yes/No
- View earning history: Yes/No
- View governance participation: Yes/No
- View agent performance: Yes/No
```

### 3.4 On-Chain Privacy

Privacy preserved through cryptographic commitments:

```solidity
// On-chain storage (privacy-preserving)
struct UserReputation {
    bytes32 merkleRoot;        // Commitment to full data
    uint256 publicTokenCount;  // Only if user chooses public
    uint8 trustTier;           // Derived tier (0-5)
    uint256 lastUpdated;       // Timestamp
    bool isPublic;             // Privacy toggle
}

// Off-chain storage (encrypted)
- Full earning history
- Transaction details
- Cohort membership
- Governance votes
```

---

## 4. Truth Chain Integration

### 4.1 Immutable Records

All token events are recorded on the Truth Chain:

```
RECORDED EVENTS
===============
- Token earnings (AGENT)
- Token allocations (ANCHOR)
- Token spending (ANCHOR)
- Token trades (ANCHOR)
- Decay calculations (AGENT)
- Governance votes
- Cohort operations
```

### 4.2 Merkle Tree Structure

```
                    [Root Hash]
                    /          \
           [Earnings]          [Spending]
           /        \          /        \
      [E1,E2]    [E3,E4]   [S1,S2]    [S3,S4]
```

### 4.3 Blockchain Anchoring

Periodic anchoring to Polygon for immutability:

```
ANCHORING SCHEDULE
==================
- Frequency: Every 1000 events OR 1 hour (whichever first)
- Data: Merkle root hash
- Cost: ~$0.01-0.05 per anchor (Polygon)
- Verification: Public, anyone can validate
```

---

## 5. Smart Contract Architecture

### 5.1 Contract Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    AgentAnchor Contracts                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐    ┌──────────────────┐               │
│  │  AgentToken.sol  │    │  AnchorToken.sol │               │
│  │  (Non-Transfer)  │    │    (ERC-20)      │               │
│  └────────┬─────────┘    └────────┬─────────┘               │
│           │                       │                          │
│           └───────────┬───────────┘                          │
│                       │                                      │
│           ┌───────────▼───────────┐                          │
│           │ ReputationRegistry.sol│                          │
│           │  (Merkle Commitments) │                          │
│           └───────────┬───────────┘                          │
│                       │                                      │
│  ┌──────────────────┐ │ ┌──────────────────┐                │
│  │ CohortManager.sol│◄─►│TruthChainAnchor  │                │
│  │ (Privacy Groups) │   │   .sol           │                │
│  └──────────────────┘   └──────────────────┘                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 AgentToken.sol

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

/**
 * @title AgentToken
 * @notice Non-transferable reputation token
 * @dev Implements soulbound token pattern
 */
contract AgentToken {

    // Token metadata
    string public constant name = "AgentAnchor Reputation";
    string public constant symbol = "AGENT";
    uint8 public constant decimals = 18;

    // Decay parameters
    uint256 public constant GRACE_PERIOD = 90 days;
    uint256 public constant DECAY_FLOOR_PERCENT = 50;
    uint256 public constant FULL_DECAY_PERIOD = 365 days;
    uint256 public constant ACCELERATION_1_START = 180 days; // 6 months
    uint256 public constant ACCELERATION_2_START = 270 days; // 9 months

    struct UserBalance {
        uint256 rawBalance;      // Pre-decay balance
        uint256 lastActivity;    // Last earning timestamp
        bytes32 merkleRoot;      // Commitment to earning history
    }

    mapping(address => UserBalance) public balances;

    // Events
    event TokensEarned(address indexed user, uint256 amount, bytes32 reason);
    event DecayApplied(address indexed user, uint256 previousBalance, uint256 newBalance);

    /**
     * @notice Calculate current balance with decay applied
     */
    function balanceOf(address user) public view returns (uint256) {
        UserBalance memory bal = balances[user];
        if (bal.rawBalance == 0) return 0;

        uint256 timeSinceActivity = block.timestamp - bal.lastActivity;

        // Within grace period
        if (timeSinceActivity <= GRACE_PERIOD) {
            return bal.rawBalance;
        }

        // Calculate decay
        uint256 decayTime = timeSinceActivity - GRACE_PERIOD;
        uint256 decayPercent = _calculateDecayPercent(decayTime);

        uint256 floor = (bal.rawBalance * DECAY_FLOOR_PERCENT) / 100;
        uint256 decayable = bal.rawBalance - floor;
        uint256 decayed = (decayable * decayPercent) / 100;

        return bal.rawBalance - decayed;
    }

    /**
     * @notice Award tokens to user (admin only)
     */
    function earn(address user, uint256 amount, bytes32 reason) external onlyMinter {
        balances[user].rawBalance += amount;
        balances[user].lastActivity = block.timestamp;
        emit TokensEarned(user, amount, reason);
    }

    /**
     * @notice Transfers are disabled (soulbound)
     */
    function transfer(address, uint256) external pure returns (bool) {
        revert("AGENT tokens are non-transferable");
    }

    // Internal decay calculation with acceleration
    function _calculateDecayPercent(uint256 decayTime) internal pure returns (uint256) {
        if (decayTime >= FULL_DECAY_PERIOD) return 100;

        uint256 baseRate = (decayTime * 100) / FULL_DECAY_PERIOD;

        // Apply acceleration multipliers
        if (decayTime >= ACCELERATION_2_START) {
            return baseRate * 2; // 2x after 9 months
        } else if (decayTime >= ACCELERATION_1_START) {
            return (baseRate * 150) / 100; // 1.5x after 6 months
        }

        return baseRate;
    }
}
```

### 5.3 AnchorToken.sol

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title AnchorToken
 * @notice Transferable utility token for platform services (Polygon Native)
 * @dev Custom implementation optimized for Polygon POS
 */
contract AnchorToken is AccessControl {

    string public constant name = "AgentAnchor Access";
    string public constant symbol = "ANCHOR";
    uint8 public constant decimals = 18;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    bytes32 public constant ALLOCATOR_ROLE = keccak256("ALLOCATOR_ROLE");

    // Subscription allocations
    mapping(address => uint256) public lastAllocation;
    mapping(address => uint256) public allocationAmount;

    // Trading fee (basis points, 100 = 1%)
    uint256 public tradingFeeBps = 100; // 1% default
    address public treasury;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(address _treasury) {
        treasury = _treasury;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    /**
     * @notice Allocate tokens for subscription
     */
    function allocate(address user, uint256 amount) external onlyRole(ALLOCATOR_ROLE) {
        lastAllocation[user] = block.timestamp;
        allocationAmount[user] = amount;
        _totalSupply += amount;
        _balances[user] += amount;
        emit Transfer(address(0), user, amount);
    }

    /**
     * @notice Burn tokens for service usage
     */
    function spend(address user, uint256 amount, bytes32 service) external onlyRole(ALLOCATOR_ROLE) {
        require(_balances[user] >= amount, "Insufficient balance");
        _balances[user] -= amount;
        _totalSupply -= amount;
        emit Transfer(user, address(0), amount);
        emit TokenSpent(user, amount, service);
    }

    /**
     * @notice Transfer with trading fee (Polygon native)
     */
    function transfer(address to, uint256 amount) public returns (bool) {
        require(_balances[msg.sender] >= amount, "Insufficient balance");

        uint256 fee = (amount * tradingFeeBps) / 10000;
        uint256 netAmount = amount - fee;

        _balances[msg.sender] -= amount;
        _balances[to] += netAmount;

        if (fee > 0) {
            _balances[treasury] += fee;
            emit Transfer(msg.sender, treasury, fee);
        }

        emit Transfer(msg.sender, to, netAmount);
        return true;
    }

    /**
     * @notice Transfer from with allowance
     */
    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        require(_balances[from] >= amount, "Insufficient balance");
        require(_allowances[from][msg.sender] >= amount, "Insufficient allowance");

        _allowances[from][msg.sender] -= amount;

        uint256 fee = (amount * tradingFeeBps) / 10000;
        uint256 netAmount = amount - fee;

        _balances[from] -= amount;
        _balances[to] += netAmount;

        if (fee > 0) {
            _balances[treasury] += fee;
            emit Transfer(from, treasury, fee);
        }

        emit Transfer(from, to, netAmount);
        return true;
    }

    function approve(address spender, uint256 amount) public returns (bool) {
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function allowance(address owner, address spender) public view returns (uint256) {
        return _allowances[owner][spender];
    }

    event TokenSpent(address indexed user, uint256 amount, bytes32 service);
}
```

### 5.4 ReputationRegistry.sol

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

/**
 * @title ReputationRegistry
 * @notice Privacy-preserving reputation commitments
 */
contract ReputationRegistry {

    struct UserReputation {
        bytes32 merkleRoot;
        uint256 publicTokenCount;
        uint8 trustTier;
        uint256 lastUpdated;
        bool isPublic;
    }

    mapping(address => UserReputation) public reputations;

    // Cohort references
    mapping(address => bytes32[]) public userCohorts;

    event ReputationUpdated(address indexed user, bytes32 newRoot, uint8 tier);
    event PrivacyChanged(address indexed user, bool isPublic);

    /**
     * @notice Update user's reputation commitment
     */
    function updateReputation(
        address user,
        bytes32 merkleRoot,
        uint256 publicCount,
        uint8 tier
    ) external onlyOracle {
        reputations[user] = UserReputation({
            merkleRoot: merkleRoot,
            publicTokenCount: publicCount,
            trustTier: tier,
            lastUpdated: block.timestamp,
            isPublic: reputations[user].isPublic
        });

        emit ReputationUpdated(user, merkleRoot, tier);
    }

    /**
     * @notice Toggle public/private profile
     */
    function setPublic(bool _isPublic) external {
        reputations[msg.sender].isPublic = _isPublic;
        emit PrivacyChanged(msg.sender, _isPublic);
    }

    /**
     * @notice Verify a Merkle proof for selective disclosure
     */
    function verifyProof(
        address user,
        bytes32[] calldata proof,
        bytes32 leaf
    ) external view returns (bool) {
        bytes32 root = reputations[user].merkleRoot;
        return _verifyMerkleProof(proof, root, leaf);
    }

    function _verifyMerkleProof(
        bytes32[] memory proof,
        bytes32 root,
        bytes32 leaf
    ) internal pure returns (bool) {
        bytes32 computedHash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];
            if (computedHash <= proofElement) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }
        return computedHash == root;
    }
}
```

### 5.5 CohortManager.sol

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

/**
 * @title CohortManager
 * @notice Manage private sharing groups
 */
contract CohortManager {

    struct Cohort {
        bytes32 cohortId;
        address owner;
        uint256 maxMembers;
        uint256 memberCount;
        bool isActive;
        mapping(address => bool) members;
        mapping(address => bytes32) permissions; // Hash of permission settings
    }

    mapping(bytes32 => Cohort) public cohorts;
    mapping(address => bytes32[]) public ownedCohorts;
    mapping(address => bytes32[]) public memberCohorts;

    // Tier-based limits (set by admin, based on AGENT token balance)
    IAgentToken public agentToken;

    uint256[] public tierThresholds = [0, 100, 500, 1000, 5000];
    uint256[] public maxCohortsPerTier = [1, 3, 5, 10, type(uint256).max];
    uint256[] public maxMembersPerTier = [5, 15, 30, 50, 100];
    uint256 public publicBonusPercent = 50; // +50% for public profiles

    event CohortCreated(bytes32 indexed cohortId, address owner);
    event MemberAdded(bytes32 indexed cohortId, address member);
    event MemberRemoved(bytes32 indexed cohortId, address member);

    /**
     * @notice Create a new cohort
     */
    function createCohort(bytes32 cohortId) external {
        require(cohorts[cohortId].owner == address(0), "Cohort exists");
        require(_canCreateCohort(msg.sender), "Cohort limit reached");

        Cohort storage c = cohorts[cohortId];
        c.cohortId = cohortId;
        c.owner = msg.sender;
        c.maxMembers = _getMaxMembers(msg.sender);
        c.isActive = true;

        ownedCohorts[msg.sender].push(cohortId);
        emit CohortCreated(cohortId, msg.sender);
    }

    /**
     * @notice Invite member to cohort
     */
    function addMember(bytes32 cohortId, address member, bytes32 permissions) external {
        Cohort storage c = cohorts[cohortId];
        require(c.owner == msg.sender, "Not owner");
        require(c.memberCount < c.maxMembers, "Cohort full");
        require(!c.members[member], "Already member");

        c.members[member] = true;
        c.permissions[member] = permissions;
        c.memberCount++;
        memberCohorts[member].push(cohortId);

        emit MemberAdded(cohortId, member);
    }

    function _canCreateCohort(address user) internal view returns (bool) {
        uint256 balance = agentToken.balanceOf(user);
        uint256 tier = _getTier(balance);
        uint256 maxCohorts = maxCohortsPerTier[tier];

        // Public profile bonus
        if (_isPublic(user)) {
            maxCohorts = (maxCohorts * (100 + publicBonusPercent)) / 100;
        }

        return ownedCohorts[user].length < maxCohorts;
    }

    function _getMaxMembers(address user) internal view returns (uint256) {
        uint256 balance = agentToken.balanceOf(user);
        uint256 tier = _getTier(balance);
        uint256 maxMembers = maxMembersPerTier[tier];

        // Public profile bonus
        if (_isPublic(user)) {
            maxMembers = (maxMembers * (100 + publicBonusPercent)) / 100;
        }

        return maxMembers;
    }

    function _getTier(uint256 balance) internal view returns (uint256) {
        for (uint256 i = tierThresholds.length - 1; i > 0; i--) {
            if (balance >= tierThresholds[i]) return i;
        }
        return 0;
    }
}
```

### 5.6 TruthChainAnchor.sol

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

/**
 * @title TruthChainAnchor
 * @notice Batch anchoring of Truth Chain records to Polygon
 */
contract TruthChainAnchor {

    struct Anchor {
        bytes32 merkleRoot;
        uint256 eventCount;
        uint256 timestamp;
        uint256 blockNumber;
    }

    Anchor[] public anchors;
    mapping(bytes32 => uint256) public rootToIndex;

    event Anchored(uint256 indexed index, bytes32 merkleRoot, uint256 eventCount);

    /**
     * @notice Anchor a batch of events
     */
    function anchor(bytes32 merkleRoot, uint256 eventCount) external onlyOracle {
        uint256 index = anchors.length;

        anchors.push(Anchor({
            merkleRoot: merkleRoot,
            eventCount: eventCount,
            timestamp: block.timestamp,
            blockNumber: block.number
        }));

        rootToIndex[merkleRoot] = index;
        emit Anchored(index, merkleRoot, eventCount);
    }

    /**
     * @notice Verify an event exists in an anchor
     */
    function verify(
        bytes32 merkleRoot,
        bytes32[] calldata proof,
        bytes32 eventHash
    ) external view returns (bool, uint256) {
        uint256 index = rootToIndex[merkleRoot];
        if (index == 0 && (anchors.length == 0 || anchors[0].merkleRoot != merkleRoot)) {
            return (false, 0);
        }

        bool valid = _verifyProof(proof, merkleRoot, eventHash);
        return (valid, anchors[index].timestamp);
    }

    function _verifyProof(
        bytes32[] calldata proof,
        bytes32 root,
        bytes32 leaf
    ) internal pure returns (bool) {
        bytes32 computedHash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];
            if (computedHash <= proofElement) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }
        return computedHash == root;
    }

    /**
     * @notice Get total anchors
     */
    function anchorCount() external view returns (uint256) {
        return anchors.length;
    }
}
```

---

## 6. Implementation Phases

### Phase 1: Core Contracts (Week 1-2)
- [ ] AgentToken.sol with decay logic
- [ ] AnchorToken.sol with allocation
- [ ] Basic unit tests
- [ ] Testnet deployment

### Phase 2: Privacy Layer (Week 3-4)
- [ ] ReputationRegistry.sol
- [ ] Merkle proof generation (off-chain)
- [ ] Privacy toggle UI
- [ ] Integration tests

### Phase 3: Cohorts & Governance (Week 5-6)
- [ ] CohortManager.sol
- [ ] Governance vote recording
- [ ] Cohort UI components
- [ ] End-to-end tests

### Phase 4: Truth Chain (Week 7-8)
- [ ] TruthChainAnchor.sol
- [ ] Batch anchoring service
- [ ] Verification portal
- [ ] Security audit prep

---

## 7. Cost Estimates (Polygon)

| Item | Cost |
|------|------|
| Contract Deployment | $50-100 |
| Monthly Anchoring (est. 1000/day) | $15-30 |
| User Transactions | $0.001-0.01 each |
| Audit (optional, external) | $5,000-15,000 |

**6-Month Operational Estimate:** ~$200-500 (excluding audit)

---

## 8. Open Questions (TBD)

1. **Token Amounts**: Specific earning amounts for each activity
2. **Subscription Pricing**: Monthly cost for each tier
3. **ANCHOR Allocations**: How many tokens per subscription tier
4. **Service Costs**: ANCHOR cost for each platform service
5. **Trading Fees**: Final percentage for P2P trades
6. **Decay Fine-Tuning**: Exact decay curve formula

---

## 9. Approval Checklist

- [ ] Parameter decisions finalized (token amounts, pricing)
- [ ] Legal review of SEC compliance approach
- [ ] Technical architecture approved
- [ ] Security considerations reviewed
- [ ] Proceed to smart contract development

---

**Document Status:** Draft - Awaiting Review

**Next Steps:**
1. Review this specification
2. Finalize TBD parameters
3. Approve for development
4. Begin Phase 1 implementation

---

*Copyright 2025 AgentAnchor. All rights reserved.*
