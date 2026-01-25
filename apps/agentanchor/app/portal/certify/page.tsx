/**
 * AgentAnchor Certification Portal - Certify Agent
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ethers } from 'ethers';

interface AgentCard {
  tokenId: string;
  did: string;
  name: string;
  description: string;
  trustScore: number;
  tier: number;
  certified: boolean;
  owner: string;
}

export default function CertifyAgentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uncertifiedAgents, setUncertifiedAgents] = useState<AgentCard[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [trustScore, setTrustScore] = useState<number>(350);
  const [expiryMonths, setExpiryMonths] = useState<number>(12);

  useEffect(() => {
    loadUncertifiedAgents();
  }, []);

  const loadUncertifiedAgents = async () => {
    try {
      // Would fetch from contract
      const mockAgents: AgentCard[] = [
        {
          tokenId: '0',
          did: 'did:vorion:google:cc-agent-v1',
          name: 'CC AI Agent (Google Labs)',
          description: 'Personal productivity agent',
          trustScore: 0,
          tier: 0,
          certified: false,
          owner: '0x...',
        },
      ];

      setUncertifiedAgents(mockAgents);
    } catch (error) {
      console.error('Failed to load agents:', error);
    }
  };

  const deriveTier = (score: number): string => {
    if (score >= 850) return 'T5 (Certified)';
    if (score >= 700) return 'T4 (Advanced)';
    if (score >= 500) return 'T3 (Elevated)';
    if (score >= 300) return 'T2 (Standard)';
    if (score >= 100) return 'T1 (Basic)';
    return 'T0 (Sandbox)';
  };

  const handleCertify = async () => {
    if (!selectedAgent) {
      alert('Please select an agent to certify');
      return;
    }

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
        'function certify(uint256 tokenId, uint256 trustScore, uint256 expiryTimestamp) public',
        'function CERTIFIER_ROLE() public view returns (bytes32)',
        'function hasRole(bytes32 role, address account) public view returns (bool)',
        'function grantRole(bytes32 role, address account) public',
      ];

      const contract = new ethers.Contract(contractAddress, abi, signer);

      // 3. Check CERTIFIER_ROLE
      const CERTIFIER_ROLE = await contract.CERTIFIER_ROLE();
      const hasCertifierRole = await contract.hasRole(CERTIFIER_ROLE, await signer.getAddress());

      if (!hasCertifierRole) {
        alert('Your account does not have CERTIFIER_ROLE. Please contact admin.');
        setLoading(false);
        return;
      }

      // 4. Calculate expiry timestamp
      const now = Math.floor(Date.now() / 1000);
      const expiryTimestamp = now + (expiryMonths * 30 * 24 * 60 * 60);

      // 5. Certify agent
      const tx = await contract.certify(selectedAgent, trustScore, expiryTimestamp);

      console.log('Certification transaction submitted:', tx.hash);
      await tx.wait();

      alert('Agent certified successfully!');
      router.push(`/portal/agents/${selectedAgent}`);
    } catch (error) {
      console.error('Certification failed:', error);
      alert(`Certification failed: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            Certify Agent
          </h1>

          <p className="text-gray-600 mb-8">
            Certify an AI agent with AgentAnchor. Certification assigns a trust
            score (0-1000) and tier (T0-T5), and expires after the specified
            duration.
          </p>

          {uncertifiedAgents.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">
                No uncertified agents found. Agents must be minted first.
              </p>
              <button
                onClick={() => router.push('/portal/mint')}
                className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
              >
                Mint AgentCard →
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Agent Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Agent to Certify *
                </label>
                <select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- Select Agent --</option>
                  {uncertifiedAgents.map((agent) => (
                    <option key={agent.tokenId} value={agent.tokenId}>
                      {agent.name} ({agent.did})
                    </option>
                  ))}
                </select>
              </div>

              {/* Agent Details (if selected) */}
              {selectedAgent && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  {uncertifiedAgents
                    .filter((a) => a.tokenId === selectedAgent)
                    .map((agent) => (
                      <div key={agent.tokenId}>
                        <h3 className="font-medium text-gray-900 mb-2">
                          {agent.name}
                        </h3>
                        <p className="text-sm text-gray-600 mb-3">
                          {agent.description}
                        </p>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">DID:</span>
                            <p className="text-gray-900 font-mono">
                              {agent.did}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">Owner:</span>
                            <p className="text-gray-900 font-mono">
                              {agent.owner.substring(0, 10)}...
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Trust Score */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Trust Score (0-1000) *
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="1000"
                    step="50"
                    value={trustScore}
                    onChange={(e) => setTrustScore(Number(e.target.value))}
                    className="flex-1"
                  />
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    value={trustScore}
                    onChange={(e) => setTrustScore(Number(e.target.value))}
                    className="w-24 px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  <strong>Tier:</strong> {deriveTier(trustScore)}
                </div>
              </div>

              {/* Expiry */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Certification Validity (months) *
                </label>
                <select
                  value={expiryMonths}
                  onChange={(e) => setExpiryMonths(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={3}>3 months</option>
                  <option value={6}>6 months</option>
                  <option value={12}>12 months (recommended)</option>
                  <option value={24}>24 months</option>
                </select>
                <p className="text-sm text-gray-500 mt-1">
                  Expires:{' '}
                  {new Date(Date.now() + expiryMonths * 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </p>
              </div>

              {/* Trust Tier Guide */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-3">
                  Trust Tier Guidelines
                </h3>
                <div className="space-y-2 text-sm text-blue-800">
                  <div>
                    <strong>T0 (0-99):</strong> Sandbox - Read-only, no external access
                  </div>
                  <div>
                    <strong>T1 (100-299):</strong> Basic - Limited file ops
                  </div>
                  <div>
                    <strong>T2 (300-499):</strong> Standard - Full file system
                  </div>
                  <div>
                    <strong>T3 (500-699):</strong> Elevated - Database writes, payment APIs
                  </div>
                  <div>
                    <strong>T4 (700-849):</strong> Advanced - Multi-system orchestration
                  </div>
                  <div>
                    <strong>T5 (850-1000):</strong> Certified - Unrestricted
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="flex gap-4">
                <button
                  onClick={handleCertify}
                  disabled={loading || !selectedAgent}
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Certifying...' : 'Certify Agent'}
                </button>
                <button
                  onClick={() => router.back()}
                  className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
