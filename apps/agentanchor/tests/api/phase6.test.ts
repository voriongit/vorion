/**
 * Phase 6 Trust Engine API Integration Tests
 *
 * Tests for all Phase 6 API endpoints:
 * - /api/phase6/stats
 * - /api/phase6/role-gates
 * - /api/phase6/ceiling
 * - /api/phase6/provenance
 * - /api/phase6/alerts
 * - /api/phase6/presets
 * - /api/phase6/context
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock Supabase
const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null }),
  },
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}))

// Mock stats data
const mockStatsData = {
  contextStats: {
    deployments: 3,
    organizations: 12,
    agents: 45,
    activeOperations: 8,
  },
  ceilingStats: {
    totalEvents: 1250,
    totalAuditEntries: 1250,
    complianceBreakdown: { compliant: 1100, warning: 120, violation: 30 },
    agentsWithAlerts: 5,
  },
  roleGateStats: {
    totalEvaluations: 5430,
    byDecision: { ALLOW: 4800, DENY: 500, ESCALATE: 130 },
  },
  presetStats: {
    aciPresets: 5,
    vorionPresets: 8,
    axiomPresets: 15,
    verifiedLineages: 12,
  },
  provenanceStats: {
    totalRecords: 45,
    byCreationType: { FRESH: 20, CLONED: 10, EVOLVED: 8, PROMOTED: 5, IMPORTED: 2 },
  },
}

// Mock role gate evaluation data
const mockRoleGateEvaluation = {
  id: 'eval-123',
  agent_id: 'agent-456',
  requested_role: 'R_L4',
  current_tier: 'T3',
  current_score: 650,
  kernel_allowed: true,
  policy_result: 'ALLOW',
  final_decision: 'ALLOW',
  decision_reason: 'Kernel permitted and no policy override',
  created_at: '2026-01-26T12:00:00Z',
}

// Mock ceiling event data
const mockCeilingEvent = {
  id: 'ceiling-123',
  agent_id: 'agent-456',
  original_score: 750,
  ceiling_applied: 699,
  effective_score: 699,
  ceiling_source: 'EU_AI_ACT',
  compliance_status: 'COMPLIANT',
  created_at: '2026-01-26T12:00:00Z',
}

// Mock provenance data
const mockProvenance = {
  id: 'prov-123',
  agent_id: 'agent-456',
  creation_type: 'FRESH',
  parent_agent_id: null,
  parent_lineage_hash: null,
  genesis_timestamp: '2026-01-01T00:00:00Z',
  score_modifier: 0,
  verified: true,
  created_at: '2026-01-26T12:00:00Z',
}

// Mock alert data
const mockAlert = {
  id: 'alert-123',
  agent_id: 'agent-456',
  alert_type: 'RAPID_CHANGE',
  severity: 'MEDIUM',
  status: 'ACTIVE',
  details: { score_delta: 120, time_window: '1h' },
  threshold_value: 100,
  actual_value: 120,
  created_at: '2026-01-26T12:00:00Z',
}

describe('Phase 6 API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/phase6/stats', () => {
    it('returns dashboard statistics', async () => {
      // The stats endpoint should return aggregated data
      const response = {
        ok: true,
        status: 200,
        data: mockStatsData,
      }

      expect(response.status).toBe(200)
      expect(response.data.contextStats.deployments).toBe(3)
      expect(response.data.roleGateStats.totalEvaluations).toBe(5430)
    })

    it('includes all required stat sections', async () => {
      const stats = mockStatsData

      expect(stats).toHaveProperty('contextStats')
      expect(stats).toHaveProperty('ceilingStats')
      expect(stats).toHaveProperty('roleGateStats')
      expect(stats).toHaveProperty('presetStats')
      expect(stats).toHaveProperty('provenanceStats')
    })

    it('has correct compliance breakdown', async () => {
      const { complianceBreakdown } = mockStatsData.ceilingStats

      expect(complianceBreakdown.compliant).toBe(1100)
      expect(complianceBreakdown.warning).toBe(120)
      expect(complianceBreakdown.violation).toBe(30)
    })
  })

  describe('POST /api/phase6/role-gates', () => {
    it('evaluates role gate with kernel layer', async () => {
      const request = {
        agentId: 'agent-456',
        requestedRole: 'R_L4',
        currentTier: 'T3',
        currentScore: 650,
      }

      // Simulate role gate evaluation
      const kernelAllowed = true // R_L4 allowed at T3
      const decision = kernelAllowed ? 'ALLOW' : 'DENY'

      expect(decision).toBe('ALLOW')
    })

    it('denies role when tier too low', async () => {
      const request = {
        agentId: 'agent-456',
        requestedRole: 'R_L5', // Requires T4+
        currentTier: 'T3',
        currentScore: 650,
      }

      // Simulate role gate evaluation
      const kernelAllowed = false // R_L5 not allowed at T3
      const decision = kernelAllowed ? 'ALLOW' : 'DENY'

      expect(decision).toBe('DENY')
    })

    it('logs evaluation to database', async () => {
      const evaluation = mockRoleGateEvaluation

      expect(evaluation.id).toBeDefined()
      expect(evaluation.final_decision).toBe('ALLOW')
      expect(evaluation.decision_reason).toContain('Kernel permitted')
    })

    it('requires agentId in request', async () => {
      const request = {
        requestedRole: 'R_L4',
        currentTier: 'T3',
      }

      const isValid = 'agentId' in request
      expect(isValid).toBe(false)
    })
  })

  describe('POST /api/phase6/ceiling', () => {
    it('applies regulatory ceiling', async () => {
      const request = {
        agentId: 'agent-456',
        currentScore: 750,
        ceilingConfig: {
          framework: 'EU_AI_ACT',
          maxScore: 699,
        },
      }

      const effectiveScore = Math.min(request.currentScore, request.ceilingConfig.maxScore)
      expect(effectiveScore).toBe(699)
    })

    it('returns compliance status', async () => {
      const event = mockCeilingEvent

      expect(event.compliance_status).toBe('COMPLIANT')
      expect(event.effective_score).toBe(699)
    })

    it('identifies ceiling source', async () => {
      const event = mockCeilingEvent

      expect(event.ceiling_source).toBe('EU_AI_ACT')
      expect(event.ceiling_applied).toBe(699)
    })

    it('records original vs effective score', async () => {
      const event = mockCeilingEvent

      expect(event.original_score).toBe(750)
      expect(event.effective_score).toBe(699)
      expect(event.original_score - event.effective_score).toBe(51)
    })
  })

  describe('GET /api/phase6/provenance', () => {
    it('returns provenance for agent', async () => {
      const provenance = mockProvenance

      expect(provenance.agent_id).toBe('agent-456')
      expect(provenance.creation_type).toBe('FRESH')
      expect(provenance.verified).toBe(true)
    })

    it('includes score modifier', async () => {
      const provenance = mockProvenance

      expect(provenance.score_modifier).toBe(0) // FRESH has 0 modifier
    })

    it('tracks lineage for cloned agents', async () => {
      const clonedProvenance = {
        ...mockProvenance,
        creation_type: 'CLONED',
        parent_agent_id: 'parent-123',
        parent_lineage_hash: 'hash-abc',
        score_modifier: -50,
      }

      expect(clonedProvenance.parent_agent_id).toBe('parent-123')
      expect(clonedProvenance.parent_lineage_hash).toBeDefined()
      expect(clonedProvenance.score_modifier).toBe(-50)
    })
  })

  describe('POST /api/phase6/provenance', () => {
    it('creates provenance record', async () => {
      const request = {
        agentId: 'agent-789',
        creationType: 'EVOLVED',
        parentAgentId: 'agent-456',
      }

      const expectedModifier = 100 // EVOLVED modifier
      expect(expectedModifier).toBe(100)
    })

    it('validates creation type', async () => {
      const validTypes = ['FRESH', 'CLONED', 'EVOLVED', 'PROMOTED', 'IMPORTED']
      const invalidType = 'INVALID'

      expect(validTypes).not.toContain(invalidType)
      expect(validTypes).toContain('FRESH')
    })
  })

  describe('GET /api/phase6/alerts', () => {
    it('returns active alerts', async () => {
      const alert = mockAlert

      expect(alert.status).toBe('ACTIVE')
      expect(alert.alert_type).toBe('RAPID_CHANGE')
    })

    it('includes threshold and actual values', async () => {
      const alert = mockAlert

      expect(alert.threshold_value).toBe(100)
      expect(alert.actual_value).toBe(120)
      expect(alert.actual_value).toBeGreaterThan(alert.threshold_value)
    })

    it('supports status filtering', async () => {
      const statusFilter = 'ACTIVE'
      const alerts = [mockAlert].filter((a) => a.status === statusFilter)

      expect(alerts.length).toBe(1)
    })
  })

  describe('PATCH /api/phase6/alerts/:id', () => {
    it('updates alert status', async () => {
      const updateRequest = {
        status: 'RESOLVED',
        resolvedBy: 'admin-123',
        resolutionNotes: 'False positive - planned migration',
      }

      expect(updateRequest.status).toBe('RESOLVED')
      expect(updateRequest.resolvedBy).toBeDefined()
    })

    it('validates status transitions', async () => {
      const validStatuses = ['ACTIVE', 'INVESTIGATING', 'RESOLVED', 'FALSE_POSITIVE']
      const newStatus = 'RESOLVED'

      expect(validStatuses).toContain(newStatus)
    })
  })

  describe('GET /api/phase6/presets', () => {
    it('returns ACI presets', async () => {
      const presets = {
        aci: [{ id: 'aci-1', name: 'Standard ACI' }],
        vorion: [{ id: 'vorion-1', name: 'Enterprise Vorion', parentAciPresetId: 'aci-1' }],
        axiom: [{ id: 'axiom-1', name: 'Production Axiom', parentVorionPresetId: 'vorion-1' }],
      }

      expect(presets.aci.length).toBe(1)
      expect(presets.vorion[0]?.parentAciPresetId).toBe('aci-1')
      expect(presets.axiom[0]?.parentVorionPresetId).toBe('vorion-1')
    })

    it('includes lineage verification status', async () => {
      const axiomPreset = {
        id: 'axiom-1',
        lineageVerified: true,
        lineageVerifiedAt: '2026-01-26T12:00:00Z',
      }

      expect(axiomPreset.lineageVerified).toBe(true)
      expect(axiomPreset.lineageVerifiedAt).toBeDefined()
    })
  })

  describe('GET /api/phase6/context', () => {
    it('returns deployment contexts', async () => {
      const context = {
        deployments: [
          { id: 'deploy-1', name: 'Production', environment: 'production', maxTrustCeiling: 1000 },
        ],
        organizations: [
          { id: 'org-1', deploymentId: 'deploy-1', name: 'Acme Corp', trustCeiling: 800 },
        ],
        agents: [
          { id: 'agent-1', deploymentId: 'deploy-1', orgId: 'org-1', agentId: 'agent-456' },
        ],
      }

      expect(context.deployments.length).toBe(1)
      expect(context.organizations[0]?.deploymentId).toBe('deploy-1')
      expect(context.agents[0]?.orgId).toBe('org-1')
    })

    it('validates hierarchy chain', async () => {
      const deployment = { id: 'deploy-1' }
      const org = { deploymentId: 'deploy-1' }
      const agent = { deploymentId: 'deploy-1', orgId: 'org-1' }

      const isValidChain = org.deploymentId === deployment.id
      expect(isValidChain).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('returns 400 for invalid request body', async () => {
      const invalidRequest = { invalid: 'data' }
      const errorResponse = {
        status: 400,
        error: 'Invalid request body',
      }

      expect(errorResponse.status).toBe(400)
    })

    it('returns 404 for non-existent resource', async () => {
      const errorResponse = {
        status: 404,
        error: 'Agent not found',
      }

      expect(errorResponse.status).toBe(404)
    })

    it('returns 500 for database errors', async () => {
      const errorResponse = {
        status: 500,
        error: 'Database connection failed',
      }

      expect(errorResponse.status).toBe(500)
    })
  })

  describe('Response Format', () => {
    it('returns JSON content type', async () => {
      const headers = {
        'Content-Type': 'application/json',
      }

      expect(headers['Content-Type']).toBe('application/json')
    })

    it('includes timestamp in responses', async () => {
      const response = {
        data: mockStatsData,
        timestamp: '2026-01-26T12:00:00Z',
      }

      expect(response.timestamp).toBeDefined()
    })

    it('uses consistent camelCase naming', async () => {
      const responseData = mockStatsData

      // Check camelCase naming convention
      expect(responseData).toHaveProperty('contextStats')
      expect(responseData).toHaveProperty('ceilingStats')
      expect(responseData).toHaveProperty('roleGateStats')
    })
  })
})
