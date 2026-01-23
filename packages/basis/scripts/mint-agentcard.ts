import { ethers } from 'hardhat';

/**
 * Mint first AgentCard (example: CC Agent from bai-cc.com)
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  console.log('Minting AgentCard with account:', deployer.address);
  console.log('Account balance:', (await deployer.provider.getBalance(deployer.address)).toString());

  // Get deployed AgentCard contract
  const AgentCard = await ethers.getContractFactory('AgentCard');
  const agentCard = await AgentCard.attach(
    process.env.AGENTCARD_ADDRESS || 'REPLACE_WITH_DEPLOYED_ADDRESS'
  );

  console.log('AgentCard contract:', await agentCard.getAddress());

  // Mint CC Agent card
  const tx = await agentCard.mint(
    deployer.address,  // Mint to deployer
    'did:vorion:google:cc-agent-v1',  // W3C DID
    'CC AI Agent (Google Labs)',  // Name
    'Personal productivity agent for Google Workspace integration',  // Description
    [
      'gmail_read',
      'gmail_send',
      'calendar_read',
      'calendar_write',
      'drive_read',
      'workspace_summarize',
    ],  // Capabilities
    'ipfs://QmPLEASE_UPDATE_WITH_REAL_IPFS_HASH'  // Metadata URI (update after uploading to IPFS)
  );

  console.log('Minting transaction submitted:', tx.hash);
  const receipt = await tx.wait();

  // Get token ID from event
  const mintEvent = receipt?.logs?.find(
    (log: any) => log.fragment?.name === 'AgentCardMinted'
  );

  if (mintEvent) {
    console.log('\n✅ AgentCard minted successfully!');
    console.log('Token ID:', mintEvent.args?.tokenId.toString());
    console.log('DID:', mintEvent.args?.did);
    console.log('Owner:', mintEvent.args?.owner);
    console.log('Name:', mintEvent.args?.name);
  }

  // Query the card
  const tokenId = 0; // First token
  const card = await agentCard.getCard(tokenId);

  console.log('\n📋 AgentCard Details:');
  console.log('-------------------');
  console.log('DID:', card.did);
  console.log('Name:', card.name);
  console.log('Description:', card.description);
  console.log('Trust Score:', card.trustScore.toString());
  console.log('Tier:', card.tier); // 0 = T0 (Sandbox)
  console.log('Certified:', card.certified);
  console.log('Metadata URI:', card.metadataURI);

  const capabilities = await agentCard.getCapabilities(tokenId);
  console.log('Capabilities:', capabilities);

  console.log('\n🔗 View on PolygonScan:');
  const chainId = (await deployer.provider.getNetwork()).chainId;
  const contractAddr = await agentCard.getAddress();
  if (chainId === 80002n) {
    console.log(`https://amoy.polygonscan.com/token/${contractAddr}?a=${tokenId}`);
  } else if (chainId === 80001n) {
    console.log(`https://mumbai.polygonscan.com/token/${contractAddr}?a=${tokenId}`);
  } else if (chainId === 137n) {
    console.log(`https://polygonscan.com/token/${contractAddr}?a=${tokenId}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
