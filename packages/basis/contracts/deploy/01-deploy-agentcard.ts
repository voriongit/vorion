import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

/**
 * Deploy AgentCard NFT contract
 *
 * Network deployment targets:
 * - Polygon Mainnet (production)
 * - Polygon Mumbai (testnet)
 * - Hardhat Network (local development)
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, log } = deployments;
  const { deployer, certifier } = await getNamedAccounts();

  log(`Deploying AgentCard to ${network.name}...`);

  const agentCard = await deploy('AgentCard', {
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: network.name === 'polygon' ? 5 : 1,
  });

  log(`AgentCard deployed to: ${agentCard.address}`);

  // Grant CERTIFIER_ROLE to designated certifier address
  if (certifier && certifier !== deployer) {
    log(`Granting CERTIFIER_ROLE to ${certifier}...`);

    const agentCardContract = await hre.ethers.getContractAt(
      'AgentCard',
      agentCard.address
    );

    const CERTIFIER_ROLE = await agentCardContract.CERTIFIER_ROLE();
    const tx = await agentCardContract.grantRole(CERTIFIER_ROLE, certifier);
    await tx.wait();

    log(`CERTIFIER_ROLE granted to ${certifier}`);
  }

  // Verify contract on Etherscan/Polygonscan
  if (
    network.name !== 'hardhat' &&
    network.name !== 'localhost' &&
    process.env.ETHERSCAN_API_KEY
  ) {
    log('Verifying contract on block explorer...');
    try {
      await hre.run('verify:verify', {
        address: agentCard.address,
        constructorArguments: [],
      });
      log('Contract verified successfully');
    } catch (error) {
      log('Contract verification failed:', error);
    }
  }

  return true;
};

export default func;
func.tags = ['AgentCard', 'BASIS'];
