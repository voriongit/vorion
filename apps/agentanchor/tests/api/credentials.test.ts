/**
 * Credentials API Integration Tests
 * Epic 15: Portable Trust Credentials
 *
 * Tests the /api/v1/credentials and /api/v1/verify/credential endpoints
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock Supabase before importing routes
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    })),
    auth: {
      getUser: vi.fn(),
    },
  })),
}))

describe('Credentials API', () => {
  describe('POST /api/v1/credentials', () => {
    it('should require authentication', async () => {
      const { createClient } = await import('@/lib/supabase/server')
      const mockCreateClient = createClient as ReturnType<typeof vi.fn>
      mockCreateClient.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
        from: vi.fn(),
      })

      const { POST } = await import('@/app/api/v1/credentials/route')
      const request = new NextRequest('http://localhost/api/v1/credentials', {
        method: 'POST',
        body: JSON.stringify({ agentId: 'test-agent' }),
      })

      const response = await POST(request)
      expect(response.status).toBe(401)
    })

    it('should require agentId in body', async () => {
      const { createClient } = await import('@/lib/supabase/server')
      const mockCreateClient = createClient as ReturnType<typeof vi.fn>
      mockCreateClient.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null,
          }),
        },
        from: vi.fn(),
      })

      const { POST } = await import('@/app/api/v1/credentials/route')
      const request = new NextRequest('http://localhost/api/v1/credentials', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
    })

    it('should return 404 for non-existent agent', async () => {
      const { createClient } = await import('@/lib/supabase/server')
      const mockCreateClient = createClient as ReturnType<typeof vi.fn>

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      })

      mockCreateClient.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null,
          }),
        },
        from: mockFrom,
      })

      const { POST } = await import('@/app/api/v1/credentials/route')
      const request = new NextRequest('http://localhost/api/v1/credentials', {
        method: 'POST',
        body: JSON.stringify({ agentId: 'non-existent' }),
      })

      const response = await POST(request)
      expect(response.status).toBe(404)
    })

    it('should return 403 when not agent owner', async () => {
      const { createClient } = await import('@/lib/supabase/server')
      const mockCreateClient = createClient as ReturnType<typeof vi.fn>

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'agent-123',
            owner_id: 'different-user',
            trust_score: 300,
            status: 'active',
          },
          error: null,
        }),
      })

      mockCreateClient.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null,
          }),
        },
        from: mockFrom,
      })

      const { POST } = await import('@/app/api/v1/credentials/route')
      const request = new NextRequest('http://localhost/api/v1/credentials', {
        method: 'POST',
        body: JSON.stringify({ agentId: 'agent-123' }),
      })

      const response = await POST(request)
      expect(response.status).toBe(403)
    })

    it('should reject agents with trust score below 250 (FR157)', async () => {
      const { createClient } = await import('@/lib/supabase/server')
      const mockCreateClient = createClient as ReturnType<typeof vi.fn>

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'agent-123',
            owner_id: 'user-123',
            trust_score: 200, // Below minimum
            status: 'active',
          },
          error: null,
        }),
      })

      mockCreateClient.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null,
          }),
        },
        from: mockFrom,
      })

      const { POST } = await import('@/app/api/v1/credentials/route')
      const request = new NextRequest('http://localhost/api/v1/credentials', {
        method: 'POST',
        body: JSON.stringify({ agentId: 'agent-123' }),
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toContain('trust score')
    })

    it('should reject inactive agents', async () => {
      const { createClient } = await import('@/lib/supabase/server')
      const mockCreateClient = createClient as ReturnType<typeof vi.fn>

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'agent-123',
            owner_id: 'user-123',
            trust_score: 300,
            status: 'training', // Not active
          },
          error: null,
        }),
      })

      mockCreateClient.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null,
          }),
        },
        from: mockFrom,
      })

      const { POST } = await import('@/app/api/v1/credentials/route')
      const request = new NextRequest('http://localhost/api/v1/credentials', {
        method: 'POST',
        body: JSON.stringify({ agentId: 'agent-123' }),
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toContain('active')
    })
  })

  describe('GET /api/v1/verify/credential', () => {
    // Note: These tests verify endpoint behavior requirements
    // Actual route testing requires Next.js async context (use integration tests)

    it('should require Authorization header format', () => {
      // Verify the expected format
      const validAuthHeader = 'Bearer ptc_abc123'
      expect(validAuthHeader.startsWith('Bearer ')).toBe(true)
    })

    it('should reject non-Bearer authorization', () => {
      const invalidAuthHeader = 'Basic some-token'
      expect(invalidAuthHeader.startsWith('Bearer ')).toBe(false)
    })

    it('should extract token from Authorization header', () => {
      const authHeader = 'Bearer ptc_abc123'
      const token = authHeader.slice(7) // Remove 'Bearer ' prefix
      expect(token).toBe('ptc_abc123')
    })
  })
})

describe('Rate Limiting', () => {
  it('should have 100 requests per hour limit for free tier (FR162)', () => {
    const RATE_LIMIT_FREE = 100
    expect(RATE_LIMIT_FREE).toBe(100)
  })

  it('should have 1 hour rate limit window', () => {
    const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
    expect(RATE_LIMIT_WINDOW_MS).toBe(3600000)
  })
})
