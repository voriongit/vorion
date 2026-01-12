/**
 * @agentanchor/sdk/react
 * React hooks and components for AgentAnchor
 */

'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';

import { AgentAnchor, AgentAnchorConfig } from './index';
import type {
  Agent,
  TrustScore,
  TrustTier,
  GovernanceRequest,
  GovernanceResult,
  Capability,
} from '@basis-protocol/core';

import {
  getTierFromScore,
  getTierEmoji,
  getTierDisplayName,
  getTierColor,
  getAvailableCapabilities,
} from '@basis-protocol/core';

// =============================================================================
// CONTEXT
// =============================================================================

interface AgentAnchorContextValue {
  client: AgentAnchor | null;
  isInitialized: boolean;
}

const AgentAnchorContext = createContext<AgentAnchorContextValue>({
  client: null,
  isInitialized: false,
});

// =============================================================================
// PROVIDER
// =============================================================================

export interface AgentAnchorProviderProps {
  /** API key for authentication */
  apiKey: string;
  /** Additional configuration */
  config?: Partial<Omit<AgentAnchorConfig, 'apiKey'>>;
  /** Children */
  children: ReactNode;
}

/**
 * AgentAnchor Provider
 * 
 * @example
 * ```tsx
 * import { AgentAnchorProvider } from '@agentanchor/sdk/react';
 * 
 * function App() {
 *   return (
 *     <AgentAnchorProvider apiKey={process.env.NEXT_PUBLIC_AGENTANCHOR_KEY!}>
 *       <MyApp />
 *     </AgentAnchorProvider>
 *   );
 * }
 * ```
 */
export function AgentAnchorProvider({
  apiKey,
  config,
  children,
}: AgentAnchorProviderProps) {
  const [client, setClient] = useState<AgentAnchor | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const anchor = new AgentAnchor({ apiKey, ...config });
    setClient(anchor);
    setIsInitialized(true);
  }, [apiKey, config]);

  return (
    <AgentAnchorContext.Provider value={{ client, isInitialized }}>
      {children}
    </AgentAnchorContext.Provider>
  );
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Get the AgentAnchor client
 */
export function useAgentAnchor(): AgentAnchor {
  const { client, isInitialized } = useContext(AgentAnchorContext);
  
  if (!isInitialized || !client) {
    throw new Error('useAgentAnchor must be used within AgentAnchorProvider');
  }
  
  return client;
}

/**
 * Hook to fetch and manage agent data
 */
export function useAgent(agentId: string) {
  const client = useAgentAnchor();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await client.agents.get(agentId);
      setAgent(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [client, agentId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const pause = useCallback(async (reason: string) => {
    const updated = await client.agents.pause(agentId, reason);
    setAgent(updated);
    return updated;
  }, [client, agentId]);

  const resume = useCallback(async () => {
    const updated = await client.agents.resume(agentId);
    setAgent(updated);
    return updated;
  }, [client, agentId]);

  return {
    agent,
    loading,
    error,
    refetch: fetch,
    pause,
    resume,
  };
}

/**
 * Hook to fetch trust score
 */
export function useTrustScore(agentId: string) {
  const client = useAgentAnchor();
  const [score, setScore] = useState<TrustScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await client.trust.getScore(agentId);
      setScore(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [client, agentId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Derived values
  const tier = score ? score.tier : 'unverified';
  const composite = score?.composite ?? 0;
  const percentage = composite / 10;
  const emoji = getTierEmoji(tier);
  const displayName = getTierDisplayName(tier);
  const color = getTierColor(tier);
  const availableCapabilities = score 
    ? getAvailableCapabilities(score.composite) 
    : [];

  return {
    score,
    tier,
    composite,
    percentage,
    emoji,
    displayName,
    color,
    availableCapabilities,
    loading,
    error,
    refetch: fetch,
  };
}

/**
 * Hook for governance processing
 */
export function useGovernance() {
  const client = useAgentAnchor();
  const [processing, setProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<GovernanceResult | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const process = useCallback(async (request: GovernanceRequest) => {
    try {
      setProcessing(true);
      setError(null);
      const result = await client.governance.process(request);
      setLastResult(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setProcessing(false);
    }
  }, [client]);

  const check = useCallback(async (request: GovernanceRequest) => {
    return client.governance.check(request);
  }, [client]);

  return {
    process,
    check,
    processing,
    lastResult,
    error,
    clearError: () => setError(null),
    clearResult: () => setLastResult(null),
  };
}

/**
 * Hook for certification management
 */
export function useCertification(agentId: string) {
  const client = useAgentAnchor();
  const [certification, setCertification] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await client.certification.getForAgent(agentId);
      setCertification(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [client, agentId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const runTests = useCallback(async () => {
    return client.certification.runTests(agentId);
  }, [client, agentId]);

  return {
    certification,
    loading,
    error,
    refetch: fetch,
    runTests,
  };
}

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * Trust score badge component
 */
export interface TrustBadgeProps {
  score: number;
  tier?: TrustTier;
  showScore?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function TrustBadge({
  score,
  tier: tierProp,
  showScore = true,
  size = 'md',
  className = '',
}: TrustBadgeProps) {
  const tier = tierProp ?? getTierFromScore(score);
  const emoji = getTierEmoji(tier);
  const displayName = getTierDisplayName(tier);
  const color = getTierColor(tier);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-opacity-10 ${color} ${sizeClasses[size]} ${className}`}
      style={{ backgroundColor: 'currentColor', opacity: 0.1 }}
    >
      <span>{emoji}</span>
      <span className={color}>{displayName}</span>
      {showScore && (
        <span className="text-gray-400 ml-1">({score})</span>
      )}
    </span>
  );
}

/**
 * Trust score progress bar
 */
export interface TrustProgressProps {
  score: number;
  showLabels?: boolean;
  height?: number;
  className?: string;
}

export function TrustProgress({
  score,
  showLabels = true,
  height = 8,
  className = '',
}: TrustProgressProps) {
  const tier = getTierFromScore(score);
  const percentage = score / 10;

  const tierColors: Record<TrustTier, string> = {
    unverified: '#ef4444',
    provisional: '#f97316',
    certified: '#eab308',
    trusted: '#22c55e',
    verified: '#3b82f6',
    sovereign: '#a855f7',
  };

  return (
    <div className={className}>
      {showLabels && (
        <div className="flex justify-between mb-1">
          <span className="text-sm text-gray-400">Trust Score</span>
          <span className="text-sm font-medium text-white">{score} / 1000</span>
        </div>
      )}
      <div 
        className="w-full bg-gray-700 rounded-full overflow-hidden"
        style={{ height }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${percentage}%`,
            backgroundColor: tierColors[tier],
          }}
        />
      </div>
    </div>
  );
}

/**
 * Capability badge
 */
export interface CapabilityBadgeProps {
  capability: Capability;
  status?: 'allowed' | 'denied' | 'pending';
  className?: string;
}

export function CapabilityBadge({
  capability,
  status = 'allowed',
  className = '',
}: CapabilityBadgeProps) {
  const statusStyles = {
    allowed: 'bg-green-500/10 text-green-400 border-green-500/20',
    denied: 'bg-red-500/10 text-red-400 border-red-500/20',
    pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-1 text-xs font-mono rounded border ${statusStyles[status]} ${className}`}
    >
      {capability}
    </span>
  );
}

/**
 * Governance decision display
 */
export interface GovernancePanelProps {
  result: GovernanceResult;
  showDetails?: boolean;
  className?: string;
}

export function GovernancePanel({
  result,
  showDetails = true,
  className = '',
}: GovernancePanelProps) {
  const decisionStyles = {
    ALLOW: 'border-green-500/30 bg-green-500/5',
    DENY: 'border-red-500/30 bg-red-500/5',
    ESCALATE: 'border-yellow-500/30 bg-yellow-500/5',
    DEGRADE: 'border-orange-500/30 bg-orange-500/5',
  };

  const decisionIcons = {
    ALLOW: '✅',
    DENY: '❌',
    ESCALATE: '⚠️',
    DEGRADE: '⬇️',
  };

  return (
    <div
      className={`p-4 rounded-lg border ${decisionStyles[result.decision]} ${className}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span>{decisionIcons[result.decision]}</span>
          <span className="font-medium text-white">
            {result.decision}
          </span>
        </div>
        <span className="text-sm text-gray-400">
          Trust: {result.trustScore}
        </span>
      </div>

      <p className="text-sm text-gray-300 mb-3">{result.reason}</p>

      {showDetails && (
        <>
          <div className="flex flex-wrap gap-1 mb-2">
            {result.capabilitiesGranted.map((cap) => (
              <CapabilityBadge key={cap} capability={cap} status="allowed" />
            ))}
            {result.capabilitiesDenied.map((cap) => (
              <CapabilityBadge key={cap} capability={cap} status="denied" />
            ))}
          </div>

          {result.proofId && (
            <p className="text-xs text-gray-500">
              Proof: {result.proofId}
            </p>
          )}

          {result.chainAnchor && (
            <p className="text-xs text-gray-500">
              Chain: {result.chainAnchor}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Agent status indicator
 */
export interface AgentStatusProps {
  status: 'active' | 'paused' | 'suspended' | 'terminated';
  showLabel?: boolean;
  className?: string;
}

export function AgentStatus({
  status,
  showLabel = true,
  className = '',
}: AgentStatusProps) {
  const statusConfig = {
    active: { color: 'bg-green-500', label: 'Active' },
    paused: { color: 'bg-yellow-500', label: 'Paused' },
    suspended: { color: 'bg-orange-500', label: 'Suspended' },
    terminated: { color: 'bg-red-500', label: 'Terminated' },
  };

  const { color, label } = statusConfig[status];

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className={`w-2 h-2 rounded-full ${color}`} />
      {showLabel && <span className="text-sm text-gray-300">{label}</span>}
    </span>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  AgentAnchorContext,
  type AgentAnchorContextValue,
};
