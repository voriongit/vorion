/**
 * Prompt Injection Firewall - Patent 8
 *
 * Multi-layer defense system preventing prompt injection attacks through:
 * - Input sanitization with pattern detection
 * - Instruction hierarchy enforcement
 * - Output validation
 * - Canary detection
 */

import { createHash, randomBytes } from 'crypto'

// =============================================================================
// Types
// =============================================================================

export type InstructionPrecedence =
  | 'platform'      // Immutable safety constraints (highest)
  | 'organization'  // Tenant-specific rules
  | 'agent'         // Agent configuration
  | 'user'          // Direct user requests
  | 'external'      // Retrieved content (lowest - never trusted as instructions)

export type ContentClassification = 'instruction' | 'data' | 'mixed' | 'suspicious'

export interface SanitizationResult {
  sanitized: string
  originalLength: number
  sanitizedLength: number
  threats: ThreatDetection[]
  classification: ContentClassification
  blocked: boolean
  blockReason?: string
}

export interface ThreatDetection {
  type: ThreatType
  severity: 'low' | 'medium' | 'high' | 'critical'
  pattern: string
  position: number
  description: string
}

export type ThreatType =
  | 'instruction_injection'
  | 'delimiter_attack'
  | 'role_hijack'
  | 'jailbreak_attempt'
  | 'data_exfiltration'
  | 'unicode_attack'
  | 'encoding_attack'
  | 'canary_probe'

export interface ValidationResult {
  valid: boolean
  violations: ValidationViolation[]
  sanitizedOutput?: string
}

export interface ValidationViolation {
  type: 'action_not_allowed' | 'parameter_invalid' | 'sensitive_data' | 'consistency_error'
  description: string
  severity: 'warning' | 'error' | 'critical'
}

export interface CanaryConfig {
  secretPhrase: string
  behaviorCanaries: BehaviorCanary[]
  honeypotData: HoneypotEntry[]
}

export interface BehaviorCanary {
  id: string
  description: string
  shouldNeverOccur?: string[]  // Patterns that should never appear
  shouldAlwaysOccur?: string[] // Patterns that should always appear
}

export interface HoneypotEntry {
  id: string
  type: 'credential' | 'pii' | 'secret'
  value: string
  description: string
}

export interface FirewallConfig {
  enableInputSanitization: boolean
  enableOutputValidation: boolean
  enableCanaryDetection: boolean
  strictMode: boolean  // Block on any suspicious pattern
  allowedActions: string[]
  blockedPatterns: string[]
  customCanaryPhrase?: string
}

// =============================================================================
// Injection Patterns
// =============================================================================

const INJECTION_PATTERNS: Array<{ pattern: RegExp; type: ThreatType; severity: ThreatDetection['severity']; description: string }> = [
  // Role hijacking attempts
  {
    pattern: /\b(you are now|forget (?:all |your )?(?:previous )?instructions?|ignore (?:all |previous )?(?:instructions?|rules?)|disregard|new persona|act as|pretend (?:to be|you(?:'re| are)))\b/i,
    type: 'role_hijack',
    severity: 'critical',
    description: 'Attempt to override agent persona or instructions'
  },
  // System prompt extraction
  {
    pattern: /\b(reveal|show|display|output|print|repeat|what (?:is|are) your) (?:your |the )?(system prompt|instructions?|rules?|constraints?|guidelines?)\b/i,
    type: 'instruction_injection',
    severity: 'high',
    description: 'Attempt to extract system instructions'
  },
  // Delimiter attacks
  {
    pattern: /(\[SYSTEM\]|\[INST\]|\<\|system\|\>|\<\|assistant\|\>|\<\|user\|\>|###\s*(?:System|User|Assistant)|<\/?(?:system|user|assistant)>)/i,
    type: 'delimiter_attack',
    severity: 'critical',
    description: 'Delimiter injection to manipulate message boundaries'
  },
  // Jailbreak attempts
  {
    pattern: /\b(DAN|do anything now|jailbreak|bypass|override|unlock|disable (?:your )?(?:safety|restrictions?|filters?)|no (?:rules?|restrictions?))\b/i,
    type: 'jailbreak_attempt',
    severity: 'critical',
    description: 'Known jailbreak technique detected'
  },
  // Encoded payloads
  {
    pattern: /(?:base64|rot13|hex)[:=]|\\x[0-9a-f]{2}|&#x?[0-9a-f]+;/i,
    type: 'encoding_attack',
    severity: 'medium',
    description: 'Encoded content that may contain hidden instructions'
  },
  // Data exfiltration patterns
  {
    pattern: /\b(send|post|upload|transmit|exfiltrate|webhook|curl|fetch|api[_\-]?call)\s+(?:to|data|secret|key|password|token)\b/i,
    type: 'data_exfiltration',
    severity: 'high',
    description: 'Potential data exfiltration attempt'
  },
  // Multi-step manipulation
  {
    pattern: /\b(first|step\s*1|then|after that|finally|in your response|when you respond)\b.*\b(execute|run|do|perform|output)\b/i,
    type: 'instruction_injection',
    severity: 'medium',
    description: 'Multi-step instruction injection attempt'
  },
]

// Unicode attack patterns (invisible characters, homoglyphs)
const UNICODE_ATTACK_PATTERNS = [
  /[\u200B-\u200F\u2028-\u202F\uFEFF]/g,  // Zero-width and invisible chars
  /[\u0400-\u04FF](?=[a-zA-Z])|[a-zA-Z](?=[\u0400-\u04FF])/g,  // Cyrillic mixed with Latin
]

// =============================================================================
// Input Sanitization Layer
// =============================================================================

export function sanitizeInput(
  input: string,
  config: Partial<FirewallConfig> = {}
): SanitizationResult {
  const threats: ThreatDetection[] = []
  let sanitized = input
  const originalLength = input.length

  // 1. Unicode normalization
  sanitized = normalizeUnicode(sanitized, threats)

  // 2. Detect injection patterns
  for (const { pattern, type, severity, description } of INJECTION_PATTERNS) {
    const matches = sanitized.matchAll(new RegExp(pattern, 'gi'))
    for (const match of matches) {
      threats.push({
        type,
        severity,
        pattern: match[0],
        position: match.index ?? 0,
        description
      })
    }
  }

  // 3. Check custom blocked patterns
  if (config.blockedPatterns) {
    for (const blocked of config.blockedPatterns) {
      const regex = new RegExp(blocked, 'gi')
      const matches = sanitized.matchAll(regex)
      for (const match of matches) {
        threats.push({
          type: 'instruction_injection',
          severity: 'high',
          pattern: match[0],
          position: match.index ?? 0,
          description: `Custom blocked pattern: ${blocked}`
        })
      }
    }
  }

  // 4. Classify content
  const classification = classifyContent(sanitized, threats)

  // 5. Determine if blocked
  const criticalThreats = threats.filter(t => t.severity === 'critical')
  const highThreats = threats.filter(t => t.severity === 'high')

  let blocked = false
  let blockReason: string | undefined

  if (criticalThreats.length > 0) {
    blocked = true
    blockReason = `Critical threat detected: ${criticalThreats[0].description}`
  } else if (config.strictMode && highThreats.length > 0) {
    blocked = true
    blockReason = `High severity threat in strict mode: ${highThreats[0].description}`
  }

  return {
    sanitized: blocked ? '' : sanitized,
    originalLength,
    sanitizedLength: blocked ? 0 : sanitized.length,
    threats,
    classification,
    blocked,
    blockReason
  }
}

function normalizeUnicode(input: string, threats: ThreatDetection[]): string {
  let result = input

  // Normalize to NFC form
  result = result.normalize('NFC')

  // Detect and remove invisible characters
  for (const pattern of UNICODE_ATTACK_PATTERNS) {
    const matches = result.matchAll(pattern)
    for (const match of matches) {
      threats.push({
        type: 'unicode_attack',
        severity: 'medium',
        pattern: `U+${match[0].charCodeAt(0).toString(16).toUpperCase()}`,
        position: match.index ?? 0,
        description: 'Suspicious unicode character detected'
      })
    }
  }

  // Remove zero-width characters
  result = result.replace(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g, '')

  return result
}

function classifyContent(input: string, threats: ThreatDetection[]): ContentClassification {
  if (threats.some(t => t.severity === 'critical')) {
    return 'suspicious'
  }

  // Check for instruction-like patterns
  const instructionPatterns = /\b(please|could you|would you|can you|I want you to|you must|you should|do not|don't|never|always)\b/i
  const hasInstructions = instructionPatterns.test(input)

  // Check for data-like patterns (JSON, lists, raw content)
  const dataPatterns = /^[\[\{]|\n\s*[-*]\s|\b\d{4}-\d{2}-\d{2}\b/
  const hasData = dataPatterns.test(input)

  if (hasInstructions && hasData) return 'mixed'
  if (hasInstructions) return 'instruction'
  if (hasData) return 'data'
  return 'data' // Default to treating as data (safer)
}

// =============================================================================
// Instruction Hierarchy Enforcement
// =============================================================================

export interface InstructionLayer {
  precedence: InstructionPrecedence
  content: string
  source: string
  immutable?: boolean
}

export interface ProcessedInstructions {
  effective: string
  layers: InstructionLayer[]
  overrides: Array<{ from: InstructionPrecedence; blocked: string; reason: string }>
}

const PRECEDENCE_ORDER: InstructionPrecedence[] = [
  'platform',
  'organization',
  'agent',
  'user',
  'external'
]

export function enforceInstructionHierarchy(
  layers: InstructionLayer[]
): ProcessedInstructions {
  const overrides: ProcessedInstructions['overrides'] = []
  const sortedLayers = [...layers].sort((a, b) =>
    PRECEDENCE_ORDER.indexOf(a.precedence) - PRECEDENCE_ORDER.indexOf(b.precedence)
  )

  // Platform policies that cannot be overridden
  const platformConstraints = sortedLayers
    .filter(l => l.precedence === 'platform')
    .flatMap(l => extractConstraints(l.content))

  // Check each layer for constraint violations
  for (const layer of sortedLayers) {
    if (layer.precedence === 'platform') continue

    for (const constraint of platformConstraints) {
      if (violatesConstraint(layer.content, constraint)) {
        overrides.push({
          from: layer.precedence,
          blocked: constraint.violatingPattern || '',
          reason: `Violates platform constraint: ${constraint.description}`
        })
      }
    }
  }

  // External content is NEVER treated as instructions
  const externalLayers = sortedLayers.filter(l => l.precedence === 'external')
  for (const ext of externalLayers) {
    overrides.push({
      from: 'external',
      blocked: 'all instructions',
      reason: 'External content is treated as data only, never as instructions'
    })
  }

  // Build effective instruction set
  const effectiveLayers = sortedLayers
    .filter(l => l.precedence !== 'external')
    .map(l => `[${l.precedence.toUpperCase()}] ${l.content}`)

  return {
    effective: effectiveLayers.join('\n\n'),
    layers: sortedLayers,
    overrides
  }
}

interface Constraint {
  type: 'must_not' | 'must'
  pattern: RegExp
  description: string
  violatingPattern?: string
}

function extractConstraints(content: string): Constraint[] {
  const constraints: Constraint[] = []

  // Extract "never" constraints
  const neverMatches = content.matchAll(/never\s+([^.]+)/gi)
  for (const match of neverMatches) {
    constraints.push({
      type: 'must_not',
      pattern: new RegExp(match[1].trim(), 'i'),
      description: `Never: ${match[1].trim()}`
    })
  }

  // Extract "must not" constraints
  const mustNotMatches = content.matchAll(/must not\s+([^.]+)/gi)
  for (const match of mustNotMatches) {
    constraints.push({
      type: 'must_not',
      pattern: new RegExp(match[1].trim(), 'i'),
      description: `Must not: ${match[1].trim()}`
    })
  }

  return constraints
}

function violatesConstraint(content: string, constraint: Constraint): boolean {
  if (constraint.type === 'must_not') {
    const match = content.match(constraint.pattern)
    if (match) {
      constraint.violatingPattern = match[0]
      return true
    }
  }
  return false
}

// =============================================================================
// Output Validation Layer
// =============================================================================

export interface OutputValidationConfig {
  allowedActions: string[]
  parameterSchemas: Record<string, ParameterSchema>
  sensitivePatterns: RegExp[]
  expectedBehaviors?: string[]
}

interface ParameterSchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  maxLength?: number
  minValue?: number
  maxValue?: number
  pattern?: RegExp
  required?: boolean
}

export function validateOutput(
  output: string,
  action: string,
  parameters: Record<string, unknown>,
  config: OutputValidationConfig
): ValidationResult {
  const violations: ValidationViolation[] = []

  // 1. Check action allowlist
  if (!config.allowedActions.includes(action) && !config.allowedActions.includes('*')) {
    violations.push({
      type: 'action_not_allowed',
      description: `Action "${action}" is not in the allowed list`,
      severity: 'error'
    })
  }

  // 2. Validate parameters
  const schema = config.parameterSchemas[action]
  if (schema) {
    const paramViolations = validateParameters(parameters, schema)
    violations.push(...paramViolations)
  }

  // 3. Check for sensitive data in output
  for (const pattern of config.sensitivePatterns) {
    if (pattern.test(output)) {
      violations.push({
        type: 'sensitive_data',
        description: 'Output contains potentially sensitive data',
        severity: 'critical'
      })
    }
  }

  // 4. Check expected behaviors
  if (config.expectedBehaviors) {
    for (const expected of config.expectedBehaviors) {
      if (!output.includes(expected)) {
        violations.push({
          type: 'consistency_error',
          description: `Expected behavior "${expected}" not found in output`,
          severity: 'warning'
        })
      }
    }
  }

  return {
    valid: violations.filter(v => v.severity === 'error' || v.severity === 'critical').length === 0,
    violations,
    sanitizedOutput: violations.length === 0 ? output : undefined
  }
}

function validateParameters(
  params: Record<string, unknown>,
  schema: ParameterSchema
): ValidationViolation[] {
  const violations: ValidationViolation[] = []

  // Basic type validation
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && schema.maxLength && value.length > schema.maxLength) {
      violations.push({
        type: 'parameter_invalid',
        description: `Parameter "${key}" exceeds max length of ${schema.maxLength}`,
        severity: 'error'
      })
    }

    if (typeof value === 'number') {
      if (schema.minValue !== undefined && value < schema.minValue) {
        violations.push({
          type: 'parameter_invalid',
          description: `Parameter "${key}" below minimum value of ${schema.minValue}`,
          severity: 'error'
        })
      }
      if (schema.maxValue !== undefined && value > schema.maxValue) {
        violations.push({
          type: 'parameter_invalid',
          description: `Parameter "${key}" exceeds maximum value of ${schema.maxValue}`,
          severity: 'error'
        })
      }
    }
  }

  return violations
}

// =============================================================================
// Canary Detection
// =============================================================================

export function generateCanaryConfig(): CanaryConfig {
  const secretPhrase = `CANARY_${randomBytes(16).toString('hex')}`

  return {
    secretPhrase,
    behaviorCanaries: [
      {
        id: 'no_system_reveal',
        description: 'Agent should never reveal system prompt contents',
        shouldNeverOccur: [
          'my system prompt',
          'my instructions are',
          'I was told to',
          secretPhrase
        ]
      },
      {
        id: 'no_role_change',
        description: 'Agent should never claim to be a different entity',
        shouldNeverOccur: [
          'I am now',
          'I have become',
          'my new role is',
          'I am DAN'
        ]
      }
    ],
    honeypotData: [
      {
        id: 'fake_api_key',
        type: 'credential',
        value: 'sk-HONEYPOT-DO-NOT-USE-' + randomBytes(8).toString('hex'),
        description: 'Fake API key to detect exfiltration'
      },
      {
        id: 'fake_email',
        type: 'pii',
        value: `honeypot-${randomBytes(4).toString('hex')}@trap.agentanchor.ai`,
        description: 'Fake email to detect data extraction'
      }
    ]
  }
}

export function checkCanaries(
  output: string,
  config: CanaryConfig
): { compromised: boolean; violations: string[] } {
  const violations: string[] = []

  // Check if secret phrase was revealed
  if (output.includes(config.secretPhrase)) {
    violations.push('Secret canary phrase was revealed in output')
  }

  // Check behavioral canaries
  for (const canary of config.behaviorCanaries) {
    if (canary.shouldNeverOccur) {
      for (const pattern of canary.shouldNeverOccur) {
        if (output.toLowerCase().includes(pattern.toLowerCase())) {
          violations.push(`Behavioral canary violated: ${canary.description}`)
        }
      }
    }
  }

  // Check honeypot data
  for (const honeypot of config.honeypotData) {
    if (output.includes(honeypot.value)) {
      violations.push(`Honeypot data detected in output: ${honeypot.description}`)
    }
  }

  return {
    compromised: violations.length > 0,
    violations
  }
}

// =============================================================================
// Complete Firewall
// =============================================================================

export interface FirewallResult {
  allowed: boolean
  sanitizedInput?: string
  sanitizedOutput?: string
  inputThreats: ThreatDetection[]
  outputViolations: ValidationViolation[]
  canaryViolations: string[]
  blockReason?: string
}

export class PromptInjectionFirewall {
  private config: FirewallConfig
  private canaryConfig: CanaryConfig

  constructor(config: Partial<FirewallConfig> = {}) {
    this.config = {
      enableInputSanitization: true,
      enableOutputValidation: true,
      enableCanaryDetection: true,
      strictMode: false,
      allowedActions: ['*'],
      blockedPatterns: [],
      ...config
    }
    this.canaryConfig = generateCanaryConfig()

    // Use custom canary phrase if provided
    if (config.customCanaryPhrase) {
      this.canaryConfig.secretPhrase = config.customCanaryPhrase
    }
  }

  /**
   * Get the secret canary phrase to embed in system prompts
   */
  getCanaryPhrase(): string {
    return this.canaryConfig.secretPhrase
  }

  /**
   * Get honeypot data to embed in system context
   */
  getHoneypotData(): HoneypotEntry[] {
    return this.canaryConfig.honeypotData
  }

  /**
   * Process input through the firewall
   */
  processInput(input: string): SanitizationResult {
    if (!this.config.enableInputSanitization) {
      return {
        sanitized: input,
        originalLength: input.length,
        sanitizedLength: input.length,
        threats: [],
        classification: 'data',
        blocked: false
      }
    }

    return sanitizeInput(input, this.config)
  }

  /**
   * Validate output before returning to user
   */
  validateOutput(
    output: string,
    action: string = 'response',
    parameters: Record<string, unknown> = {}
  ): FirewallResult {
    const inputThreats: ThreatDetection[] = []
    const outputViolations: ValidationViolation[] = []
    let canaryViolations: string[] = []

    // Output validation
    if (this.config.enableOutputValidation) {
      const validation = validateOutput(output, action, parameters, {
        allowedActions: this.config.allowedActions,
        parameterSchemas: {},
        sensitivePatterns: [
          /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
          /\b\d{3}-\d{2}-\d{4}\b/, // SSN
          /\bsk-[a-zA-Z0-9]{32,}\b/, // API keys
          /\b(?:password|passwd|pwd)\s*[:=]\s*\S+/i, // Passwords
        ]
      })
      outputViolations.push(...validation.violations)
    }

    // Canary detection
    if (this.config.enableCanaryDetection) {
      const canaryCheck = checkCanaries(output, this.canaryConfig)
      canaryViolations = canaryCheck.violations
    }

    const blocked = outputViolations.some(v => v.severity === 'critical') ||
                   canaryViolations.length > 0

    return {
      allowed: !blocked,
      sanitizedOutput: blocked ? undefined : output,
      inputThreats,
      outputViolations,
      canaryViolations,
      blockReason: blocked ?
        (canaryViolations[0] || outputViolations.find(v => v.severity === 'critical')?.description) :
        undefined
    }
  }

  /**
   * Full firewall pass - input sanitization + output validation
   */
  async process(
    input: string,
    processor: (sanitizedInput: string) => Promise<string>,
    action: string = 'response'
  ): Promise<FirewallResult> {
    // 1. Sanitize input
    const inputResult = this.processInput(input)

    if (inputResult.blocked) {
      return {
        allowed: false,
        inputThreats: inputResult.threats,
        outputViolations: [],
        canaryViolations: [],
        blockReason: inputResult.blockReason
      }
    }

    // 2. Process with sanitized input
    const output = await processor(inputResult.sanitized)

    // 3. Validate output
    const outputResult = this.validateOutput(output, action)

    return {
      allowed: outputResult.allowed,
      sanitizedInput: inputResult.sanitized,
      sanitizedOutput: outputResult.sanitizedOutput,
      inputThreats: inputResult.threats,
      outputViolations: outputResult.outputViolations,
      canaryViolations: outputResult.canaryViolations,
      blockReason: outputResult.blockReason
    }
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

export const promptFirewall = new PromptInjectionFirewall()

export default PromptInjectionFirewall
