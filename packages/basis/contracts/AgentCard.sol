// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title AgentCard
 * @dev ERC-721 NFT representing AI agent identity, capabilities, and certification
 *
 * Part of BASIS (Blockchain Agent Standard for Identity and Security)
 * Integrates with KYA (Know Your Agent) framework
 *
 * Features:
 * - W3C DID integration for decentralized identity
 * - Capability advertisement (what the agent can do)
 * - AgentAnchor certification with trust scores
 * - Revocable certifications for safety
 * - On-chain trust tier tracking (T0-T5)
 */
contract AgentCard is ERC721, ERC721URIStorage, ERC721Enumerable, AccessControl {
    // ==========================================================================
    // Roles
    // ==========================================================================

    bytes32 public constant CERTIFIER_ROLE = keccak256("CERTIFIER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // ==========================================================================
    // State Variables
    // ==========================================================================

    uint256 private _nextTokenId;

    // Mapping from DID to token ID (one DID = one card)
    mapping(string => uint256) public didToTokenId;

    // Mapping from token ID to AgentCard data
    mapping(uint256 => AgentCardData) public cards;

    // Mapping from token ID to capability list
    mapping(uint256 => string[]) private _capabilities;

    // Mapping from token ID to restriction list
    mapping(uint256 => string[]) private _restrictions;

    // Trust tier definitions
    enum TrustTier { T0, T1, T2, T3, T4, T5 }

    // ==========================================================================
    // Structs
    // ==========================================================================

    struct AgentCardData {
        string did;                     // W3C DID (e.g., "did:vorion:ed25519:...")
        string name;                    // Agent name
        string description;             // Description
        uint256 trustScore;             // TSG trust score (0-1000)
        TrustTier tier;                 // Trust tier (T0-T5)
        bool certified;                 // Certified by AgentAnchor?
        address certifier;              // Certifying organization address
        uint256 certificationDate;      // Unix timestamp of certification
        uint256 certificationExpiry;    // Unix timestamp when certification expires
        string metadataURI;             // IPFS URI to full metadata JSON
        bool revoked;                   // Certification revoked?
    }

    // ==========================================================================
    // Events
    // ==========================================================================

    event AgentCardMinted(
        uint256 indexed tokenId,
        string did,
        address indexed owner,
        string name
    );

    event AgentCertified(
        uint256 indexed tokenId,
        string did,
        address indexed certifier,
        uint256 trustScore,
        TrustTier tier
    );

    event CertificationRevoked(
        uint256 indexed tokenId,
        string did,
        address indexed certifier,
        string reason
    );

    event TrustScoreUpdated(
        uint256 indexed tokenId,
        string did,
        uint256 oldScore,
        uint256 newScore,
        TrustTier newTier
    );

    event CapabilitiesUpdated(
        uint256 indexed tokenId,
        string did,
        uint256 capabilityCount
    );

    // ==========================================================================
    // Constructor
    // ==========================================================================

    constructor() ERC721("AgentCard", "AGENT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(CERTIFIER_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    // ==========================================================================
    // Internal Helpers (OpenZeppelin v5 compatibility)
    // ==========================================================================

    /**
     * @dev Check if token exists
     */
    function _exists(uint256 tokenId) internal view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    /**
     * @dev Check if spender is approved or owner
     */
    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address owner = ownerOf(tokenId);
        return (spender == owner || isApprovedForAll(owner, spender) || getApproved(tokenId) == spender);
    }

    // ==========================================================================
    // Minting
    // ==========================================================================

    /**
     * @dev Mint new AgentCard NFT
     * @param to Address to mint to (agent owner/controller)
     * @param did W3C DID for the agent
     * @param name Agent name
     * @param description Agent description
     * @param capabilities Array of capability strings
     * @param metadataURI IPFS URI to full metadata
     */
    function mint(
        address to,
        string memory did,
        string memory name,
        string memory description,
        string[] memory capabilities,
        string memory metadataURI
    ) public onlyRole(MINTER_ROLE) returns (uint256) {
        // Ensure DID is unique (one card per DID)
        require(didToTokenId[did] == 0, "AgentCard: DID already exists");

        uint256 tokenId = _nextTokenId++;

        // Mint NFT
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, metadataURI);

        // Store AgentCard data
        cards[tokenId] = AgentCardData({
            did: did,
            name: name,
            description: description,
            trustScore: 0,
            tier: TrustTier.T0,           // All agents start at T0 (Sandbox)
            certified: false,
            certifier: address(0),
            certificationDate: 0,
            certificationExpiry: 0,
            metadataURI: metadataURI,
            revoked: false
        });

        // Store DID mapping
        didToTokenId[did] = tokenId;

        // Store capabilities
        for (uint i = 0; i < capabilities.length; i++) {
            _capabilities[tokenId].push(capabilities[i]);
        }

        emit AgentCardMinted(tokenId, did, to, name);

        return tokenId;
    }

    // ==========================================================================
    // Certification (AgentAnchor)
    // ==========================================================================

    /**
     * @dev Certify an agent (assign trust score and tier)
     * @param tokenId Token ID to certify
     * @param trustScore Trust score (0-1000)
     * @param expiryTimestamp When certification expires (Unix timestamp)
     */
    function certify(
        uint256 tokenId,
        uint256 trustScore,
        uint256 expiryTimestamp
    ) public onlyRole(CERTIFIER_ROLE) {
        require(_exists(tokenId), "AgentCard: Token does not exist");
        require(trustScore <= 1000, "AgentCard: Trust score must be <= 1000");
        require(expiryTimestamp > block.timestamp, "AgentCard: Expiry must be in future");

        AgentCardData storage card = cards[tokenId];

        // Derive trust tier from score
        TrustTier tier = _deriveTier(trustScore);

        // Update certification
        card.certified = true;
        card.certifier = msg.sender;
        card.certificationDate = block.timestamp;
        card.certificationExpiry = expiryTimestamp;
        card.trustScore = trustScore;
        card.tier = tier;
        card.revoked = false;

        emit AgentCertified(tokenId, card.did, msg.sender, trustScore, tier);
    }

    /**
     * @dev Revoke certification
     * @param tokenId Token ID to revoke
     * @param reason Reason for revocation
     */
    function revokeCertification(
        uint256 tokenId,
        string memory reason
    ) public onlyRole(CERTIFIER_ROLE) {
        require(_exists(tokenId), "AgentCard: Token does not exist");

        AgentCardData storage card = cards[tokenId];
        require(card.certified, "AgentCard: Not certified");
        require(card.certifier == msg.sender, "AgentCard: Only certifier can revoke");

        // Revoke certification, reset to T0
        card.certified = false;
        card.revoked = true;
        card.tier = TrustTier.T0;
        card.trustScore = 0;

        emit CertificationRevoked(tokenId, card.did, msg.sender, reason);
    }

    /**
     * @dev Update trust score (e.g., from TSG real-time monitoring)
     * @param tokenId Token ID to update
     * @param newTrustScore New trust score (0-1000)
     */
    function updateTrustScore(
        uint256 tokenId,
        uint256 newTrustScore
    ) public onlyRole(CERTIFIER_ROLE) {
        require(_exists(tokenId), "AgentCard: Token does not exist");
        require(newTrustScore <= 1000, "AgentCard: Trust score must be <= 1000");

        AgentCardData storage card = cards[tokenId];
        require(card.certified, "AgentCard: Not certified");

        uint256 oldScore = card.trustScore;
        TrustTier newTier = _deriveTier(newTrustScore);

        card.trustScore = newTrustScore;
        card.tier = newTier;

        emit TrustScoreUpdated(tokenId, card.did, oldScore, newTrustScore, newTier);
    }

    // ==========================================================================
    // Capabilities Management
    // ==========================================================================

    /**
     * @dev Add capabilities to agent
     * @param tokenId Token ID
     * @param capabilities Array of capability strings to add
     */
    function addCapabilities(
        uint256 tokenId,
        string[] memory capabilities
    ) public {
        require(_exists(tokenId), "AgentCard: Token does not exist");
        require(_isApprovedOrOwner(msg.sender, tokenId), "AgentCard: Not authorized");

        for (uint i = 0; i < capabilities.length; i++) {
            _capabilities[tokenId].push(capabilities[i]);
        }

        emit CapabilitiesUpdated(tokenId, cards[tokenId].did, _capabilities[tokenId].length);
    }

    /**
     * @dev Add restrictions to agent
     * @param tokenId Token ID
     * @param restrictions Array of restriction strings to add
     */
    function addRestrictions(
        uint256 tokenId,
        string[] memory restrictions
    ) public {
        require(_exists(tokenId), "AgentCard: Token does not exist");
        require(_isApprovedOrOwner(msg.sender, tokenId), "AgentCard: Not authorized");

        for (uint i = 0; i < restrictions.length; i++) {
            _restrictions[tokenId].push(restrictions[i]);
        }
    }

    // ==========================================================================
    // View Functions
    // ==========================================================================

    /**
     * @dev Get AgentCard data by token ID
     */
    function getCard(uint256 tokenId) public view returns (AgentCardData memory) {
        require(_exists(tokenId), "AgentCard: Token does not exist");
        return cards[tokenId];
    }

    /**
     * @dev Get AgentCard data by DID
     */
    function getCardByDID(string memory did) public view returns (AgentCardData memory) {
        uint256 tokenId = didToTokenId[did];
        require(tokenId != 0, "AgentCard: DID not found");
        return cards[tokenId];
    }

    /**
     * @dev Get capabilities for token
     */
    function getCapabilities(uint256 tokenId) public view returns (string[] memory) {
        require(_exists(tokenId), "AgentCard: Token does not exist");
        return _capabilities[tokenId];
    }

    /**
     * @dev Get restrictions for token
     */
    function getRestrictions(uint256 tokenId) public view returns (string[] memory) {
        require(_exists(tokenId), "AgentCard: Token does not exist");
        return _restrictions[tokenId];
    }

    /**
     * @dev Check if agent is certified and not expired/revoked
     */
    function isCertified(uint256 tokenId) public view returns (bool) {
        require(_exists(tokenId), "AgentCard: Token does not exist");
        AgentCardData memory card = cards[tokenId];

        return card.certified &&
               !card.revoked &&
               block.timestamp < card.certificationExpiry;
    }

    /**
     * @dev Get all AgentCards owned by an address
     */
    function getCardsByOwner(address owner) public view returns (uint256[] memory) {
        uint256 balance = balanceOf(owner);
        uint256[] memory tokenIds = new uint256[](balance);

        for (uint256 i = 0; i < balance; i++) {
            tokenIds[i] = tokenOfOwnerByIndex(owner, i);
        }

        return tokenIds;
    }

    /**
     * @dev Get all certified agents (paginated)
     */
    function getCertifiedAgents(uint256 offset, uint256 limit)
        public
        view
        returns (uint256[] memory)
    {
        uint256 total = totalSupply();
        uint256 count = 0;

        // First pass: count certified agents
        for (uint256 i = 0; i < total; i++) {
            uint256 tokenId = tokenByIndex(i);
            if (isCertified(tokenId)) {
                count++;
            }
        }

        // Calculate result size
        uint256 resultSize = count > offset ? count - offset : 0;
        if (resultSize > limit) {
            resultSize = limit;
        }

        uint256[] memory result = new uint256[](resultSize);
        uint256 resultIndex = 0;
        uint256 certifiedCount = 0;

        // Second pass: collect certified agents
        for (uint256 i = 0; i < total && resultIndex < resultSize; i++) {
            uint256 tokenId = tokenByIndex(i);
            if (isCertified(tokenId)) {
                if (certifiedCount >= offset) {
                    result[resultIndex] = tokenId;
                    resultIndex++;
                }
                certifiedCount++;
            }
        }

        return result;
    }

    // ==========================================================================
    // Internal Functions
    // ==========================================================================

    /**
     * @dev Derive trust tier from score
     * Based on Vorion's 6-tier trust model
     */
    function _deriveTier(uint256 score) internal pure returns (TrustTier) {
        if (score >= 850) return TrustTier.T5;      // Certified
        if (score >= 700) return TrustTier.T4;      // Advanced
        if (score >= 500) return TrustTier.T3;      // Elevated
        if (score >= 300) return TrustTier.T2;      // Standard
        if (score >= 100) return TrustTier.T1;      // Basic
        return TrustTier.T0;                        // Sandbox
    }

    // ==========================================================================
    // Required Overrides (ERC721 + Extensions) - OpenZeppelin v5
    // ==========================================================================

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721, ERC721Enumerable) returns (address) {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
