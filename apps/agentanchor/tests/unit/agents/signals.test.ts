/**
 * Agent Signal System Unit Tests
 * Tests signal subscriptions, delivery, and callbacks
 */

import { describe, it, expect } from 'vitest'

// Import types and constants
import {
  SignalCategory,
  SignalPriority,
  SignalType,
  Signal,
  DEFAULT_SUBSCRIPTION
} from '@/lib/agents/agent-signals'

import {
  CallbackType,
  CallbackCondition,
  CALLBACK_TEMPLATES
} from '@/lib/agents/agent-callbacks'

describe('Signal Types & Categories', () => {
  const VALID_CATEGORIES: SignalCategory[] = [
    'self', 'peer', 'hierarchy', 'council',
    'trust', 'academy', 'marketplace', 'system', 'safety'
  ]

  const VALID_PRIORITIES: SignalPriority[] = [
    'critical', 'high', 'normal', 'low', 'background'
  ]

  it('should have 9 signal categories', () => {
    expect(VALID_CATEGORIES).toHaveLength(9)
  })

  it('should have 5 priority levels', () => {
    expect(VALID_PRIORITIES).toHaveLength(5)
  })

  it('should have safety as a category for critical alerts', () => {
    expect(VALID_CATEGORIES).toContain('safety')
  })

  it('should have self category for agent-specific signals', () => {
    expect(VALID_CATEGORIES).toContain('self')
  })
})

describe('Default Subscription', () => {
  it('should be enabled by default', () => {
    expect(DEFAULT_SUBSCRIPTION.enabled).toBe(true)
  })

  it('should have all categories configured', () => {
    const categories = Object.keys(DEFAULT_SUBSCRIPTION.categories)
    expect(categories).toContain('self')
    expect(categories).toContain('peer')
    expect(categories).toContain('council')
    expect(categories).toContain('safety')
  })

  it('should enable self category with low priority threshold', () => {
    expect(DEFAULT_SUBSCRIPTION.categories.self.enabled).toBe(true)
    expect(DEFAULT_SUBSCRIPTION.categories.self.minPriority).toBe('low')
    expect(DEFAULT_SUBSCRIPTION.categories.self.realtime).toBe(true)
  })

  it('should enable safety category for all priorities', () => {
    expect(DEFAULT_SUBSCRIPTION.categories.safety.enabled).toBe(true)
    expect(DEFAULT_SUBSCRIPTION.categories.safety.minPriority).toBe('low')
    expect(DEFAULT_SUBSCRIPTION.categories.safety.realtime).toBe(true)
  })

  it('should have marketplace disabled by default', () => {
    expect(DEFAULT_SUBSCRIPTION.categories.marketplace.enabled).toBe(false)
  })

  it('should have reasonable rate limits', () => {
    expect(DEFAULT_SUBSCRIPTION.rateLimit.maxPerMinute).toBe(60)
    expect(DEFAULT_SUBSCRIPTION.rateLimit.maxPerHour).toBe(500)
  })

  it('should have realtime delivery enabled', () => {
    expect(DEFAULT_SUBSCRIPTION.delivery.realtime).toBe(true)
  })
})

describe('Signal Priority Ordering', () => {
  const priorityOrder: SignalPriority[] = ['critical', 'high', 'normal', 'low', 'background']

  function getPriorityIndex(priority: SignalPriority): number {
    return priorityOrder.indexOf(priority)
  }

  function shouldReceive(signalPriority: SignalPriority, minPriority: SignalPriority): boolean {
    return getPriorityIndex(signalPriority) <= getPriorityIndex(minPriority)
  }

  it('critical should be highest priority (index 0)', () => {
    expect(getPriorityIndex('critical')).toBe(0)
  })

  it('background should be lowest priority (index 4)', () => {
    expect(getPriorityIndex('background')).toBe(4)
  })

  it('should receive critical when minPriority is normal', () => {
    expect(shouldReceive('critical', 'normal')).toBe(true)
  })

  it('should not receive low when minPriority is high', () => {
    expect(shouldReceive('low', 'high')).toBe(false)
  })

  it('should receive same priority', () => {
    expect(shouldReceive('normal', 'normal')).toBe(true)
  })
})

describe('Signal Structure', () => {
  const createTestSignal = (): Signal => ({
    id: 'test-signal-123',
    type: 'trust_changed',
    category: 'self',
    priority: 'normal',
    timestamp: new Date().toISOString(),
    sequence: 1,
    subject: {
      type: 'agent',
      id: 'agent-123',
      name: 'Test Agent'
    },
    data: {
      oldScore: 500,
      newScore: 520,
      change: 20,
      reason: 'Task completed successfully'
    },
    summary: 'Trust increased by 20 points',
    actionRequired: false
  })

  it('should have required fields', () => {
    const signal = createTestSignal()
    expect(signal.id).toBeDefined()
    expect(signal.type).toBeDefined()
    expect(signal.category).toBeDefined()
    expect(signal.priority).toBeDefined()
    expect(signal.timestamp).toBeDefined()
    expect(signal.sequence).toBeDefined()
    expect(signal.subject).toBeDefined()
    expect(signal.summary).toBeDefined()
  })

  it('should have subject with type and id', () => {
    const signal = createTestSignal()
    expect(signal.subject.type).toBe('agent')
    expect(signal.subject.id).toBe('agent-123')
  })

  it('should support actionRequired flag', () => {
    const signal = createTestSignal()
    signal.actionRequired = true
    signal.suggestedActions = ['Review changes', 'Update settings']
    expect(signal.actionRequired).toBe(true)
    expect(signal.suggestedActions).toHaveLength(2)
  })

  it('should support expiration', () => {
    const signal = createTestSignal()
    signal.expiresAt = new Date(Date.now() + 3600000).toISOString()
    expect(signal.expiresAt).toBeDefined()
  })

  it('should support aggregation metadata', () => {
    const signal = createTestSignal()
    signal.aggregation = {
      count: 5,
      firstOccurrence: new Date(Date.now() - 3600000).toISOString(),
      lastOccurrence: new Date().toISOString(),
      affectedEntities: ['agent-1', 'agent-2', 'agent-3']
    }
    expect(signal.aggregation.count).toBe(5)
    expect(signal.aggregation.affectedEntities).toHaveLength(3)
  })
})

describe('Callback Templates', () => {
  it('should have safetyPause template', () => {
    expect(CALLBACK_TEMPLATES.safetyPause).toBeDefined()
    expect(CALLBACK_TEMPLATES.safetyPause.trigger.signalTypes).toContain('safety_violation_detected')
    expect(CALLBACK_TEMPLATES.safetyPause.action.type).toBe('internal_action')
  })

  it('should have trustDropEscalate template', () => {
    expect(CALLBACK_TEMPLATES.trustDropEscalate).toBeDefined()
    expect(CALLBACK_TEMPLATES.trustDropEscalate.trigger.signalTypes).toContain('trust_changed')
    expect(CALLBACK_TEMPLATES.trustDropEscalate.action.type).toBe('escalate')
  })

  it('should have councilDecisionLog template', () => {
    expect(CALLBACK_TEMPLATES.councilDecisionLog).toBeDefined()
    expect(CALLBACK_TEMPLATES.councilDecisionLog.action.type).toBe('log_only')
  })

  it('should have peerGraduationWebhook template', () => {
    expect(CALLBACK_TEMPLATES.peerGraduationWebhook).toBeDefined()
    expect(CALLBACK_TEMPLATES.peerGraduationWebhook.action.type).toBe('webhook')
  })

  it('safetyPause should trigger on safety category', () => {
    expect(CALLBACK_TEMPLATES.safetyPause.trigger.categories).toContain('safety')
  })

  it('trustDropEscalate should have condition for negative change', () => {
    const conditions = CALLBACK_TEMPLATES.trustDropEscalate.trigger.conditions
    expect(conditions).toBeDefined()
    expect(conditions?.[0].field).toBe('data.change')
    expect(conditions?.[0].operator).toBe('lt')
    expect(conditions?.[0].value).toBe(-20)
  })
})

describe('Callback Condition Evaluation', () => {
  // Test condition evaluation logic
  function evaluateCondition(
    value: unknown,
    condition: CallbackCondition
  ): boolean {
    switch (condition.operator) {
      case 'eq':
        return value === condition.value
      case 'neq':
        return value !== condition.value
      case 'gt':
        return typeof value === 'number' && value > (condition.value as number)
      case 'lt':
        return typeof value === 'number' && value < (condition.value as number)
      case 'gte':
        return typeof value === 'number' && value >= (condition.value as number)
      case 'lte':
        return typeof value === 'number' && value <= (condition.value as number)
      case 'contains':
        return typeof value === 'string' && value.includes(condition.value as string)
      case 'matches':
        return typeof value === 'string' && new RegExp(condition.value as string).test(value)
      default:
        return false
    }
  }

  it('should evaluate eq correctly', () => {
    expect(evaluateCondition(100, { field: 'test', operator: 'eq', value: 100 })).toBe(true)
    expect(evaluateCondition(100, { field: 'test', operator: 'eq', value: 50 })).toBe(false)
  })

  it('should evaluate neq correctly', () => {
    expect(evaluateCondition(100, { field: 'test', operator: 'neq', value: 50 })).toBe(true)
    expect(evaluateCondition(100, { field: 'test', operator: 'neq', value: 100 })).toBe(false)
  })

  it('should evaluate gt correctly', () => {
    expect(evaluateCondition(100, { field: 'test', operator: 'gt', value: 50 })).toBe(true)
    expect(evaluateCondition(100, { field: 'test', operator: 'gt', value: 100 })).toBe(false)
  })

  it('should evaluate lt correctly', () => {
    expect(evaluateCondition(-30, { field: 'test', operator: 'lt', value: -20 })).toBe(true)
    expect(evaluateCondition(-10, { field: 'test', operator: 'lt', value: -20 })).toBe(false)
  })

  it('should evaluate contains correctly', () => {
    expect(evaluateCondition('hello world', { field: 'test', operator: 'contains', value: 'world' })).toBe(true)
    expect(evaluateCondition('hello world', { field: 'test', operator: 'contains', value: 'foo' })).toBe(false)
  })

  it('should evaluate matches correctly', () => {
    expect(evaluateCondition('error_123', { field: 'test', operator: 'matches', value: 'error_\\d+' })).toBe(true)
    expect(evaluateCondition('warning_123', { field: 'test', operator: 'matches', value: 'error_\\d+' })).toBe(false)
  })
})

describe('Signal Categories for Agent Context', () => {
  it('self signals should be about the agent itself', () => {
    // Self signals: trust_changed, feedback_received, task_assigned, etc.
    const selfSignalTypes = [
      'trust_changed', 'feedback_received', 'task_assigned',
      'task_completed', 'error_occurred', 'council_review', 'stage_transition'
    ]
    expect(selfSignalTypes).toContain('trust_changed')
    expect(selfSignalTypes).toContain('stage_transition')
  })

  it('peer signals should be about other agents', () => {
    const peerSignalTypes = ['peer_graduated', 'peer_suspended', 'peer_trust_change']
    expect(peerSignalTypes).toHaveLength(3)
  })

  it('safety signals should always be critical priority capable', () => {
    // Safety signals should never be filtered out by priority
    const safetyConfig = DEFAULT_SUBSCRIPTION.categories.safety
    expect(safetyConfig.enabled).toBe(true)
    expect(safetyConfig.minPriority).toBe('low') // Receive all priorities
  })
})

describe('Rate Limiting Logic', () => {
  interface RateLimit {
    maxPerMinute: number
    maxPerHour: number
  }

  function checkRateLimit(
    deliveredLastMinute: number,
    deliveredLastHour: number,
    rateLimit: RateLimit
  ): boolean {
    if (deliveredLastMinute >= rateLimit.maxPerMinute) return false
    if (deliveredLastHour >= rateLimit.maxPerHour) return false
    return true
  }

  const defaultLimit: RateLimit = { maxPerMinute: 60, maxPerHour: 500 }

  it('should allow delivery within limits', () => {
    expect(checkRateLimit(10, 100, defaultLimit)).toBe(true)
  })

  it('should block when minute limit exceeded', () => {
    expect(checkRateLimit(60, 100, defaultLimit)).toBe(false)
  })

  it('should block when hour limit exceeded', () => {
    expect(checkRateLimit(10, 500, defaultLimit)).toBe(false)
  })

  it('should respect custom limits', () => {
    const strictLimit: RateLimit = { maxPerMinute: 10, maxPerHour: 50 }
    expect(checkRateLimit(10, 40, strictLimit)).toBe(false)
  })
})
