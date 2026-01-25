/**
 * AgentAnchor Certification Portal - Mint AgentCard
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ethers } from 'ethers';

export default function MintAgentCardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    did: '',
    name: '',
    description: '',
    capabilities: [''],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Connect to wallet
      if (!window.ethereum) {
        throw new Error('Please install MetaMask');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();

      // 2. Get AgentCard contract
      const contractAddress = process.env.NEXT_PUBLIC_AGENTCARD_ADDRESS!;
      const abi = [
        'function mint(address to, string memory did, string memory name, string memory description, string[] memory capabilities, string memory metadataURI) public returns (uint256)',
      ];

      const contract = new ethers.Contract(contractAddress, abi, signer);

      // 3. Upload metadata to IPFS (simplified - would use actual IPFS client)
      const metadataURI = await uploadToIPFS({
        name: formData.name,
        description: formData.description,
        capabilities: formData.capabilities.filter(c => c.trim() !== ''),
      });

      // 4. Mint AgentCard
      const tx = await contract.mint(
        await signer.getAddress(),
        formData.did,
        formData.name,
        formData.description,
        formData.capabilities.filter(c => c.trim() !== ''),
        metadataURI
      );

      console.log('Transaction submitted:', tx.hash);
      const receipt = await tx.wait();

      // 5. Get token ID from event
      const mintEvent = receipt.logs?.find(
        (log: any) => log.fragment?.name === 'AgentCardMinted'
      );

      const tokenId = mintEvent?.args?.tokenId.toString();

      // 6. Redirect to agent view
      router.push(`/portal/agents/${tokenId}`);
    } catch (error) {
      console.error('Minting failed:', error);
      alert(`Minting failed: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const addCapability = () => {
    setFormData({
      ...formData,
      capabilities: [...formData.capabilities, ''],
    });
  };

  const removeCapability = (index: number) => {
    const newCapabilities = formData.capabilities.filter((_, i) => i !== index);
    setFormData({ ...formData, capabilities: newCapabilities });
  };

  const updateCapability = (index: number, value: string) => {
    const newCapabilities = [...formData.capabilities];
    newCapabilities[index] = value;
    setFormData({ ...formData, capabilities: newCapabilities });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            Mint AgentCard
          </h1>

          <p className="text-gray-600 mb-8">
            Create an on-chain identity for your AI agent. AgentCards are
            ERC-721 NFTs on Polygon that represent agent capabilities and
            certification status.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* DID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                W3C DID (Decentralized Identifier) *
              </label>
              <input
                type="text"
                required
                placeholder="did:vorion:ed25519:..."
                value={formData.did}
                onChange={(e) => setFormData({ ...formData, did: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-sm text-gray-500 mt-1">
                Format: did:vorion:{'<method>'}:{'<identifier>'}
              </p>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Agent Name *
              </label>
              <input
                type="text"
                required
                placeholder="CC AI Agent (Google Labs)"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                required
                rows={4}
                placeholder="Personal productivity agent for Google Workspace integration"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Capabilities */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Capabilities *
              </label>
              {formData.capabilities.map((cap, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="gmail_read"
                    value={cap}
                    onChange={(e) => updateCapability(index, e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {formData.capabilities.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCapability(index)}
                      className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addCapability}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                + Add Capability
              </button>
            </div>

            {/* Gas Estimate */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">
                Estimated Gas Cost
              </h3>
              <p className="text-sm text-blue-700">
                ~0.005 MATIC (~$0.004 USD) on Polygon Mumbai testnet
              </p>
              <p className="text-sm text-blue-700 mt-1">
                Make sure you have enough MATIC in your wallet.
              </p>
            </div>

            {/* Submit */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Minting...' : 'Mint AgentCard'}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Utility: Upload metadata to IPFS
async function uploadToIPFS(metadata: any): Promise<string> {
  // Simplified - would use actual IPFS client (e.g., Pinata, NFT.Storage)
  console.log('Uploading to IPFS:', metadata);
  return 'ipfs://QmPLEASE_IMPLEMENT_REAL_IPFS_UPLOAD';
}
