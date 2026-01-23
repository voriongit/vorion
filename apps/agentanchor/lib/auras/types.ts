/**
 * Aura Types - 16 Archetypal Advisory Personas
 *
 * Types for integrating the Auras system with AgentAnchor governance.
 */

// ============================================================================
// Aura Persona
// ============================================================================

export interface AuraPersona {
    id: string;
    name: string;
    icon: string;
    tagline: string;
    background: string;
    expertise: string[];
    speakingStyle: string;
    catchPhrases: string[];
    approach: AuraApproach;
    domainWeights: Record<string, number>;
    defaultTrustScore: number;
    trustDecayRate: number;
}

export interface AuraApproach {
    problemSolving: string;
    decisionMaking: string;
    conflictStyle: string;
}

// ============================================================================
// Aura Selection
// ============================================================================

export interface AuraSelectionCriteria {
    domains?: string[];
    includeAuras?: string[];
    excludeAuras?: string[];
    minTrustScore?: number;
    maxAuras?: number;
}

// ============================================================================
// Consultation Types
// ============================================================================

export interface AuraConsultRequest {
    query: string;
    context?: string;
    auras?: string[];
    maxAuras?: number;
    synthesize?: boolean;
    agentId?: string;
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
}

export interface AuraResponse {
    auraId: string;
    auraName: string;
    content: string;
    confidence: number;
    insights: string[];
    recommendations: string[];
    responseTimeMs: number;
}

export interface AuraConsultResult {
    requestId: string;
    query: string;
    responses: AuraResponse[];
    synthesis?: string;
    aurasConsulted: string[];
    totalTimeMs: number;
    consensusScore: number;
    themes: string[];
}

// ============================================================================
// Council Types
// ============================================================================

export interface AuraCouncil {
    id: string;
    name: string;
    description: string;
    auraIds: string[];
    useCases: string[];
}

export interface CouncilVote {
    auraId: string;
    position: 'support' | 'oppose' | 'neutral' | 'abstain';
    rationale: string;
    confidence: number;
}

export interface CouncilDeliberation extends AuraConsultResult {
    councilId: string;
    councilName: string;
    votes: CouncilVote[];
    recommendation: string;
    unanimity: boolean;
}

// ============================================================================
// Provider Types
// ============================================================================

export type AIProvider = 'claude' | 'gemini' | 'grok';

export interface ProviderConfig {
    provider: AIProvider;
    apiKey: string;
    model?: string;
}

export interface MultiProviderConfig {
    providers: ProviderConfig[];
    defaultProvider?: AIProvider;
    strategy?: 'round-robin' | 'failover' | 'consensus';
}
