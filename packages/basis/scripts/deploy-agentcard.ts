import { ethers } from 'hardhat';

/**
 * Deploy AgentCard contract to network
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  console.log('Deploying AgentCard with account:', deployer.address);
  console.log('Account balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'MATIC');

  // Deploy AgentCard
  const AgentCard = await ethers.getContractFactory('AgentCard');
  const agentCard = await AgentCard.deploy();

  await agentCard.waitForDeployment();

  const contractAddress = await agentCard.getAddress();

  console.log('\n✅ AgentCard deployed to:', contractAddress);

  // Grant CERTIFIER_ROLE to deployer (for testing)
  console.log('\nGranting CERTIFIER_ROLE to deployer...');
  const CERTIFIER_ROLE = await agentCard.CERTIFIER_ROLE();
  await agentCard.grantRole(CERTIFIER_ROLE, deployer.address);

  console.log('✅ CERTIFIER_ROLE granted');

  console.log('\n📋 Deployment Summary:');
  console.log('=====================');
  console.log('Contract Address:', contractAddress);
  console.log('Deployer:', deployer.address);
  console.log('Network:', (await ethers.provider.getNetwork()).name);
  console.log('Chain ID:', (await ethers.provider.getNetwork()).chainId);

  console.log('\n🔗 View on Block Explorer:');
  const chainId = (await ethers.provider.getNetwork()).chainId;
  if (chainId === 11155111n) {
    console.log(`https://sepolia.etherscan.io/address/${contractAddress}`);
  } else if (chainId === 80002n) {
    console.log(`https://amoy.polygonscan.com/address/${contractAddress}`);
  } else if (chainId === 80001n) {
    console.log(`https://mumbai.polygonscan.com/address/${contractAddress}`);
    console.log('⚠️  WARNING: Mumbai testnet is deprecated. Use Amoy instead!');
  } else if (chainId === 137n) {
    console.log(`https://polygonscan.com/address/${contractAddress}`);
  } else if (chainId === 1n) {
    console.log(`https://etherscan.io/address/${contractAddress}`);
  }

  console.log('\n📝 Next Steps:');
  console.log('1. Save contract address:', contractAddress);
  console.log('2. Verify contract: npx hardhat verify --network mumbai', contractAddress);
  console.log('3. Mint AgentCard: npx hardhat run scripts/mint-agentcard.ts --network mumbai');
  console.log('4. Certify agent: npx hardhat run scripts/certify-agent.ts --network mumbai');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
