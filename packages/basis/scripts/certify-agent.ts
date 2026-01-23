import { ethers } from 'hardhat';

/**
 * Certify CC Agent with AgentAnchor (T2: Standard tier, 350 trust score)
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  console.log('Certifying agent with account:', deployer.address);

  // Get deployed AgentCard contract
  const AgentCard = await ethers.getContractFactory('AgentCard');
  const agentCard = await AgentCard.attach(
    process.env.AGENTCARD_ADDRESS || 'REPLACE_WITH_DEPLOYED_ADDRESS'
  );

  console.log('AgentCard contract:', await agentCard.getAddress());

  const tokenId = 0; // First minted card (CC Agent)

  // Check if account has CERTIFIER_ROLE
  const CERTIFIER_ROLE = await agentCard.CERTIFIER_ROLE();
  const hasCertifierRole = await agentCard.hasRole(CERTIFIER_ROLE, deployer.address);

  if (!hasCertifierRole) {
    console.error('❌ Account does not have CERTIFIER_ROLE');
    console.log('Granting CERTIFIER_ROLE to:', deployer.address);

    const grantTx = await agentCard.grantRole(CERTIFIER_ROLE, deployer.address);
    await grantTx.wait();

    console.log('✅ CERTIFIER_ROLE granted');
  }

  // Certify with trust score 350 (T2: Standard)
  const trustScore = 350;
  const expiryTimestamp = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60); // 1 year from now

  console.log('\nCertifying agent:');
  console.log('- Token ID:', tokenId);
  console.log('- Trust Score:', trustScore);
  console.log('- Tier: T2 (Standard)');
  console.log('- Expires:', new Date(expiryTimestamp * 1000).toISOString());

  const tx = await agentCard.certify(tokenId, trustScore, expiryTimestamp);

  console.log('Certification transaction submitted:', tx.hash);
  const receipt = await tx.wait();

  // Get certification event
  const certifyEvent = receipt?.logs?.find(
    (log: any) => log.fragment?.name === 'AgentCertified'
  );

  if (certifyEvent) {
    console.log('\n✅ Agent certified successfully!');
    console.log('Token ID:', certifyEvent.args?.tokenId.toString());
    console.log('DID:', certifyEvent.args?.did);
    console.log('Certifier:', certifyEvent.args?.certifier);
    console.log('Trust Score:', certifyEvent.args?.trustScore.toString());
    console.log('Tier:', certifyEvent.args?.tier); // Should be 2 (T2)
  }

  // Query updated card
  const card = await agentCard.getCard(tokenId);

  console.log('\n📋 Updated AgentCard:');
  console.log('-------------------');
  console.log('DID:', card.did);
  console.log('Name:', card.name);
  console.log('Trust Score:', card.trustScore.toString());
  console.log('Tier:', ['T0', 'T1', 'T2', 'T3', 'T4', 'T5'][card.tier]);
  console.log('Certified:', card.certified);
  console.log('Certifier:', card.certifier);
  console.log('Certification Date:', new Date(Number(card.certificationDate) * 1000).toISOString());
  console.log('Certification Expiry:', new Date(Number(card.certificationExpiry) * 1000).toISOString());

  // Check if certified and valid
  const isCertified = await agentCard.isCertified(tokenId);
  console.log('\nIs Certified (not expired/revoked):', isCertified);

  console.log('\n🔗 View on PolygonScan:');
  console.log(`https://mumbai.polygonscan.com/token/${await agentCard.getAddress()}?a=${tokenId}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
