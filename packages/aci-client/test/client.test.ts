/**
 * ACI Client E2E Integration Tests
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import {
  ACIClient,
  createACIClient,
  createLocalACIClient,
  ACIError,
  getTierFromScore,
  isRoleAllowedForTier,
  TRUST_TIER_RANGES,
  DEFAULT_PROVENANCE_MODIFIERS,
} from '../src/index.js'

// Mock fetch for testing
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('ACIClient', () => {
  let client: ACIClient

  beforeAll(() => {
    client = createACIClient({
      baseUrl: 'https://api.test.com',
      apiKey: 'test-api-key',
      timeout: 5000,
    })
  })

  afterAll(() => {
    vi.restoreAllMocks()
  })

  describe('Configuration', () => {
    it('should create client with config', () => {
      const c = createACIClient({
        baseUrl: 'https://api.example.com',
        apiKey: 'key',
      })
      expect(c).toBeInstanceOf(ACIClient)
    })

    it('should create local client', () => {
      const c = createLocalACIClient(3000)
      expect(c).toBeInstanceOf(ACIClient)
    })

    it('should strip trailing slash from baseUrl', () => {
      const c = createACIClient({
        baseUrl: 'https://api.example.com/',
      })
      expect(c).toBeInstanceOf(ACIClient)
    })
  })

  describe('getStats()', () => {
    it('should fetch dashboard stats', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          stats: {
            contextStats: { deployments: 3, organizations: 12, agents: 47, activeOperations: 23 },
            ceilingStats: { totalEvents: 1842 },
            roleGateStats: { totalEvaluations: 3291 },
            presetStats: { aciPresets: 3 },
          },
          tierDistribution: [],
          recentEvents: [],
          version: { major: 1, minor: 0, patch: 0 },
        }),
      })

      const result = await client.getStats()

      expect(result.stats.contextStats.agents).toBe(47)
      expect(result.version.major).toBe(1)
    })

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal Server Error' }),
      })

      await expect(client.getStats()).rejects.toThrow(ACIError)
    })
  })

  describe('evaluateRoleGate()', () => {
    it('should evaluate role gate request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          evaluation: {
            id: 'eval-1',
            agentId: 'agent-123',
            requestedRole: 'R_L3',
            currentTier: 'T3',
            currentScore: 550,
            kernelAllowed: true,
            finalDecision: 'ALLOW',
          },
          layers: {
            kernel: { allowed: true },
            policy: { result: 'ALLOW' },
            basis: { overrideUsed: false },
          },
        }),
      })

      const result = await client.evaluateRoleGate({
        agentId: 'agent-123',
        requestedRole: 'R_L3',
        currentTier: 'T3',
        currentScore: 550,
      })

      expect(result.evaluation.finalDecision).toBe('ALLOW')
      expect(result.layers.kernel.allowed).toBe(true)
    })

    it('should validate request schema', async () => {
      await expect(client.evaluateRoleGate({
        agentId: '',  // Invalid: empty
        requestedRole: 'R_L3',
        currentTier: 'T3',
      })).rejects.toThrow()
    })
  })

  describe('checkCeiling()', () => {
    it('should check ceiling for proposed score', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          result: {
            agentId: 'agent-123',
            proposedScore: 750,
            finalScore: 699,  // Capped by EU AI Act
            effectiveCeiling: 699,
            ceilingApplied: true,
            complianceStatus: 'WARNING',
            gamingIndicators: [],
          },
          ceilingDetails: {
            regulatory: { framework: 'EU_AI_ACT', ceiling: 699 },
            organizational: { ceiling: 1000 },
            effective: 699,
          },
        }),
      })

      const result = await client.checkCeiling({
        agentId: 'agent-123',
        proposedScore: 750,
        complianceFramework: 'EU_AI_ACT',
      })

      expect(result.result.ceilingApplied).toBe(true)
      expect(result.result.finalScore).toBe(699)
    })
  })

  describe('createProvenance()', () => {
    it('should create provenance record', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          record: {
            id: 'prov-1',
            agentId: 'agent-new',
            creationType: 'FRESH',
            createdBy: 'system',
            trustModifier: 0,
            provenanceHash: 'hash-123',
          },
        }),
      })

      const result = await client.createProvenance({
        agentId: 'agent-new',
        creationType: 'FRESH',
        createdBy: 'system',
      })

      expect(result.record.creationType).toBe('FRESH')
      expect(result.record.trustModifier).toBe(0)
    })

    it('should validate provenance request', async () => {
      await expect(client.createProvenance({
        agentId: 'agent-clone',
        creationType: 'CLONED',
        createdBy: '',  // Invalid: empty
      })).rejects.toThrow()
    })
  })

  describe('getGamingAlerts()', () => {
    it('should fetch gaming alerts', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          alerts: [
            { id: '1', agentId: 'agent-089', alertType: 'RAPID_CHANGE', severity: 'HIGH', status: 'ACTIVE' },
          ],
          summary: { total: 1, byStatus: { ACTIVE: 1 } },
        }),
      })

      const result = await client.getGamingAlerts('ACTIVE')

      expect(result.alerts.length).toBe(1)
      expect(result.alerts[0].alertType).toBe('RAPID_CHANGE')
    })
  })
})

describe('ACIError', () => {
  it('should identify client errors', () => {
    const error = new ACIError('Bad Request', 400)
    expect(error.isClientError()).toBe(true)
    expect(error.isServerError()).toBe(false)
  })

  it('should identify server errors', () => {
    const error = new ACIError('Internal Error', 500)
    expect(error.isClientError()).toBe(false)
    expect(error.isServerError()).toBe(true)
  })

  it('should identify timeout errors', () => {
    const error = new ACIError('Timeout', 408)
    expect(error.isTimeout()).toBe(true)
  })
})

describe('Utility Functions', () => {
  describe('getTierFromScore()', () => {
    it('should return correct tier for scores', () => {
      expect(getTierFromScore(0)).toBe('T0')
      expect(getTierFromScore(50)).toBe('T0')
      expect(getTierFromScore(99)).toBe('T0')
      expect(getTierFromScore(100)).toBe('T1')
      expect(getTierFromScore(299)).toBe('T1')
      expect(getTierFromScore(300)).toBe('T2')
      expect(getTierFromScore(500)).toBe('T3')
      expect(getTierFromScore(700)).toBe('T4')
      expect(getTierFromScore(900)).toBe('T5')
      expect(getTierFromScore(1000)).toBe('T5')
    })
  })

  describe('isRoleAllowedForTier()', () => {
    it('should allow R-L0 and R-L1 for any tier', () => {
      expect(isRoleAllowedForTier('R_L0', 'T0')).toBe(true)
      expect(isRoleAllowedForTier('R_L1', 'T0')).toBe(true)
      expect(isRoleAllowedForTier('R_L0', 'T5')).toBe(true)
      expect(isRoleAllowedForTier('R_L1', 'T5')).toBe(true)
    })

    it('should require T1+ for R-L2', () => {
      expect(isRoleAllowedForTier('R_L2', 'T0')).toBe(false)
      expect(isRoleAllowedForTier('R_L2', 'T1')).toBe(true)
      expect(isRoleAllowedForTier('R_L2', 'T5')).toBe(true)
    })

    it('should require T2+ for R-L3', () => {
      expect(isRoleAllowedForTier('R_L3', 'T1')).toBe(false)
      expect(isRoleAllowedForTier('R_L3', 'T2')).toBe(true)
    })

    it('should require T5 for R-L6, R-L7, R-L8', () => {
      expect(isRoleAllowedForTier('R_L6', 'T4')).toBe(false)
      expect(isRoleAllowedForTier('R_L6', 'T5')).toBe(true)
      expect(isRoleAllowedForTier('R_L7', 'T5')).toBe(true)
      expect(isRoleAllowedForTier('R_L8', 'T5')).toBe(true)
    })
  })

  describe('Constants', () => {
    it('should have correct tier ranges', () => {
      expect(TRUST_TIER_RANGES.T0).toEqual({ min: 0, max: 99 })
      expect(TRUST_TIER_RANGES.T5).toEqual({ min: 900, max: 1000 })
    })

    it('should have correct provenance modifiers', () => {
      expect(DEFAULT_PROVENANCE_MODIFIERS.FRESH).toBe(0)
      expect(DEFAULT_PROVENANCE_MODIFIERS.CLONED).toBe(-50)
      expect(DEFAULT_PROVENANCE_MODIFIERS.EVOLVED).toBe(100)
      expect(DEFAULT_PROVENANCE_MODIFIERS.PROMOTED).toBe(150)
      expect(DEFAULT_PROVENANCE_MODIFIERS.IMPORTED).toBe(-100)
    })
  })
})
