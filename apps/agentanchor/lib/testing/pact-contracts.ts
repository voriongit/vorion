/**
 * Phase 6 Pact Contract Testing
 *
 * Consumer-driven contract tests for the Trust Engine API
 */

// =============================================================================
// Types
// =============================================================================

export interface PactInteraction {
  description: string;
  providerState?: string;
  request: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    query?: Record<string, string>;
    body?: unknown;
  };
  response: {
    status: number;
    headers?: Record<string, string>;
    body?: unknown;
  };
}

export interface PactContract {
  consumer: { name: string };
  provider: { name: string };
  interactions: PactInteraction[];
  metadata: {
    pactSpecification: { version: string };
  };
}

// =============================================================================
// Matchers (Pact-compatible)
// =============================================================================

export const Matchers = {
  like: <T>(example: T) => ({
    json_class: 'Pact::SomethingLike',
    contents: example,
  }),

  eachLike: <T>(example: T, options?: { min?: number }) => ({
    json_class: 'Pact::ArrayLike',
    contents: example,
    min: options?.min || 1,
  }),

  term: (pattern: string, generate: string) => ({
    json_class: 'Pact::Term',
    data: { generate, matcher: { json_class: 'Regexp', o: 0, s: pattern } },
  }),

  uuid: () => Matchers.term(
    '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
    '12345678-1234-1234-1234-123456789012'
  ),

  iso8601DateTime: () => Matchers.term(
    '\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}',
    '2024-01-01T00:00:00Z'
  ),

  integer: (example?: number) => ({
    json_class: 'Pact::SomethingLike',
    contents: example || 1,
  }),

  decimal: (example?: number) => ({
    json_class: 'Pact::SomethingLike',
    contents: example || 1.0,
  }),

  boolean: (example?: boolean) => ({
    json_class: 'Pact::SomethingLike',
    contents: example ?? true,
  }),

  string: (example?: string) => ({
    json_class: 'Pact::SomethingLike',
    contents: example || 'string',
  }),
};

// =============================================================================
// Phase 6 Trust Engine Contracts
// =============================================================================

export const PHASE6_CONTRACTS: PactContract = {
  consumer: { name: 'phase6-client' },
  provider: { name: 'phase6-trust-engine' },
  metadata: {
    pactSpecification: { version: '3.0.0' },
  },
  interactions: [
    // Role Gates API
    {
      description: 'a request for all role gates',
      providerState: 'role gates exist',
      request: {
        method: 'GET',
        path: '/api/phase6/role-gates',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Accept': 'application/json',
        },
      },
      response: {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: true,
          data: Matchers.eachLike({
            id: Matchers.uuid(),
            name: Matchers.string('example-gate'),
            fromRole: Matchers.string('assistant'),
            toRole: Matchers.string('operator'),
            conditions: Matchers.like([]),
            status: Matchers.term('active|inactive|testing', 'active'),
            createdAt: Matchers.iso8601DateTime(),
          }),
        },
      },
    },
    {
      description: 'a request to create a role gate',
      providerState: 'authorized to create role gates',
      request: {
        method: 'POST',
        path: '/api/phase6/role-gates',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: {
          name: 'test-gate',
          fromRole: 'assistant',
          toRole: 'operator',
          conditions: [
            { type: 'trust_score', operator: 'gte', value: 80 },
          ],
        },
      },
      response: {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: true,
          data: {
            id: Matchers.uuid(),
            name: 'test-gate',
            fromRole: 'assistant',
            toRole: 'operator',
            conditions: Matchers.like([]),
            status: 'active',
            createdAt: Matchers.iso8601DateTime(),
          },
        },
      },
    },
    {
      description: 'a request to evaluate a role gate',
      providerState: 'role gate exists for evaluation',
      request: {
        method: 'POST',
        path: '/api/phase6/role-gates/evaluate',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: {
          gateId: '12345678-1234-1234-1234-123456789012',
          context: {
            trustScore: 85,
            userId: 'user-123',
          },
        },
      },
      response: {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: true,
          data: {
            allowed: Matchers.boolean(true),
            gateId: Matchers.uuid(),
            evaluatedAt: Matchers.iso8601DateTime(),
            conditions: Matchers.eachLike({
              type: Matchers.string(),
              passed: Matchers.boolean(),
            }),
          },
        },
      },
    },

    // Capability Ceilings API
    {
      description: 'a request for capability ceilings',
      providerState: 'capability ceilings exist',
      request: {
        method: 'GET',
        path: '/api/phase6/capability-ceilings',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Accept': 'application/json',
        },
      },
      response: {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: true,
          data: Matchers.eachLike({
            id: Matchers.uuid(),
            capability: Matchers.string('code_execution'),
            role: Matchers.string('assistant'),
            maxValue: Matchers.integer(100),
            currentUsage: Matchers.integer(50),
            resetPeriod: Matchers.string('daily'),
          }),
        },
      },
    },
    {
      description: 'a request to check capability usage',
      providerState: 'capability ceiling exists',
      request: {
        method: 'POST',
        path: '/api/phase6/capability-ceilings/check',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: {
          capability: 'code_execution',
          role: 'assistant',
          requestedAmount: 10,
        },
      },
      response: {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: true,
          data: {
            allowed: Matchers.boolean(true),
            remaining: Matchers.integer(50),
            resetsAt: Matchers.iso8601DateTime(),
          },
        },
      },
    },

    // Provenance API
    {
      description: 'a request for provenance records',
      providerState: 'provenance records exist',
      request: {
        method: 'GET',
        path: '/api/phase6/provenance',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Accept': 'application/json',
        },
        query: {
          limit: '10',
        },
      },
      response: {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: true,
          data: Matchers.eachLike({
            id: Matchers.uuid(),
            actionType: Matchers.string('role_transition'),
            actorId: Matchers.string('agent-123'),
            targetId: Matchers.string('resource-456'),
            signature: Matchers.string(),
            timestamp: Matchers.iso8601DateTime(),
          }),
          pagination: {
            total: Matchers.integer(),
            page: Matchers.integer(1),
            limit: Matchers.integer(10),
          },
        },
      },
    },
    {
      description: 'a request to create provenance record',
      providerState: 'authorized to create provenance',
      request: {
        method: 'POST',
        path: '/api/phase6/provenance',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: {
          actionType: 'role_transition',
          actorId: 'agent-123',
          targetId: 'resource-456',
          metadata: {
            fromRole: 'assistant',
            toRole: 'operator',
          },
        },
      },
      response: {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: true,
          data: {
            id: Matchers.uuid(),
            actionType: 'role_transition',
            actorId: 'agent-123',
            targetId: 'resource-456',
            signature: Matchers.string(),
            verified: Matchers.boolean(true),
            timestamp: Matchers.iso8601DateTime(),
          },
        },
      },
    },
    {
      description: 'a request to verify provenance',
      providerState: 'provenance record exists',
      request: {
        method: 'POST',
        path: '/api/phase6/provenance/verify',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: {
          id: '12345678-1234-1234-1234-123456789012',
        },
      },
      response: {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: true,
          data: {
            valid: Matchers.boolean(true),
            id: Matchers.uuid(),
            verifiedAt: Matchers.iso8601DateTime(),
          },
        },
      },
    },

    // Trust Score API
    {
      description: 'a request for trust score',
      providerState: 'agent has trust score',
      request: {
        method: 'GET',
        path: '/api/phase6/trust-score/agent-123',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Accept': 'application/json',
        },
      },
      response: {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: true,
          data: {
            agentId: 'agent-123',
            score: Matchers.decimal(85.5),
            factors: Matchers.eachLike({
              name: Matchers.string('compliance'),
              weight: Matchers.decimal(0.3),
              value: Matchers.decimal(90),
            }),
            calculatedAt: Matchers.iso8601DateTime(),
          },
        },
      },
    },

    // Health API
    {
      description: 'a request for health status',
      request: {
        method: 'GET',
        path: '/api/phase6/health',
      },
      response: {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          status: Matchers.term('healthy|degraded|unhealthy', 'healthy'),
          version: Matchers.string('1.0.0'),
          timestamp: Matchers.iso8601DateTime(),
        },
      },
    },

    // Error responses
    {
      description: 'unauthorized request',
      providerState: 'no valid token',
      request: {
        method: 'GET',
        path: '/api/phase6/role-gates',
      },
      response: {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: Matchers.string('Authentication required'),
          },
        },
      },
    },
    {
      description: 'forbidden request',
      providerState: 'insufficient permissions',
      request: {
        method: 'DELETE',
        path: '/api/phase6/role-gates/12345678-1234-1234-1234-123456789012',
        headers: {
          'Authorization': 'Bearer limited-token',
        },
      },
      response: {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: Matchers.string('Insufficient permissions'),
          },
        },
      },
    },
    {
      description: 'not found request',
      providerState: 'role gate does not exist',
      request: {
        method: 'GET',
        path: '/api/phase6/role-gates/99999999-9999-9999-9999-999999999999',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      },
      response: {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: Matchers.string('Role gate not found'),
          },
        },
      },
    },
    {
      description: 'validation error',
      providerState: 'authorized to create role gates',
      request: {
        method: 'POST',
        path: '/api/phase6/role-gates',
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: {
          name: '', // Invalid: empty name
          fromRole: 'invalid-role',
        },
      },
      response: {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: Matchers.string('Validation failed'),
            details: Matchers.eachLike({
              field: Matchers.string(),
              message: Matchers.string(),
            }),
          },
        },
      },
    },
    {
      description: 'rate limited request',
      providerState: 'rate limit exceeded',
      request: {
        method: 'GET',
        path: '/api/phase6/role-gates',
        headers: {
          'Authorization': 'Bearer valid-token',
        },
      },
      response: {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '60',
        },
        body: {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: Matchers.string('Rate limit exceeded'),
            retryAfter: Matchers.integer(60),
          },
        },
      },
    },
  ],
};

// =============================================================================
// Contract Verification
// =============================================================================

export interface VerificationResult {
  interaction: string;
  success: boolean;
  errors: string[];
  duration: number;
}

/**
 * Verify a response against a contract interaction
 */
export function verifyResponse(
  interaction: PactInteraction,
  actualResponse: { status: number; headers: Record<string, string>; body: unknown }
): VerificationResult {
  const errors: string[] = [];
  const startTime = Date.now();

  // Verify status code
  if (actualResponse.status !== interaction.response.status) {
    errors.push(
      `Status mismatch: expected ${interaction.response.status}, got ${actualResponse.status}`
    );
  }

  // Verify headers
  if (interaction.response.headers) {
    for (const [key, value] of Object.entries(interaction.response.headers)) {
      const actualValue = actualResponse.headers[key.toLowerCase()];
      if (!actualValue) {
        errors.push(`Missing header: ${key}`);
      } else if (!actualValue.includes(value)) {
        errors.push(`Header mismatch for ${key}: expected ${value}, got ${actualValue}`);
      }
    }
  }

  // Verify body structure
  if (interaction.response.body) {
    const bodyErrors = verifyBodyStructure(
      interaction.response.body,
      actualResponse.body,
      'body'
    );
    errors.push(...bodyErrors);
  }

  return {
    interaction: interaction.description,
    success: errors.length === 0,
    errors,
    duration: Date.now() - startTime,
  };
}

/**
 * Recursively verify body structure against matchers
 */
function verifyBodyStructure(
  expected: unknown,
  actual: unknown,
  path: string
): string[] {
  const errors: string[] = [];

  if (expected === null || expected === undefined) {
    return errors;
  }

  // Handle Pact matchers
  if (typeof expected === 'object' && expected !== null && 'json_class' in expected) {
    const matcher = expected as { json_class: string; contents?: unknown; min?: number };

    switch (matcher.json_class) {
      case 'Pact::SomethingLike':
        if (typeof actual !== typeof matcher.contents) {
          errors.push(`${path}: type mismatch, expected ${typeof matcher.contents}, got ${typeof actual}`);
        }
        break;

      case 'Pact::ArrayLike':
        if (!Array.isArray(actual)) {
          errors.push(`${path}: expected array, got ${typeof actual}`);
        } else if (matcher.min && actual.length < matcher.min) {
          errors.push(`${path}: array has ${actual.length} items, expected at least ${matcher.min}`);
        } else if (actual.length > 0 && matcher.contents) {
          // Verify first item structure
          errors.push(...verifyBodyStructure(matcher.contents, actual[0], `${path}[0]`));
        }
        break;

      case 'Pact::Term':
        if (typeof actual !== 'string') {
          errors.push(`${path}: expected string for term matcher, got ${typeof actual}`);
        }
        // Note: In real implementation, we'd verify against the regex
        break;
    }

    return errors;
  }

  // Handle objects
  if (typeof expected === 'object' && expected !== null) {
    if (typeof actual !== 'object' || actual === null) {
      errors.push(`${path}: expected object, got ${typeof actual}`);
      return errors;
    }

    for (const [key, value] of Object.entries(expected)) {
      if (!(key in actual)) {
        errors.push(`${path}.${key}: missing field`);
      } else {
        errors.push(...verifyBodyStructure(value, (actual as Record<string, unknown>)[key], `${path}.${key}`));
      }
    }
  }

  return errors;
}

// =============================================================================
// Contract Test Runner
// =============================================================================

export interface ContractTestConfig {
  baseUrl: string;
  authToken?: string;
  timeout?: number;
}

export interface ContractTestResults {
  contract: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  results: VerificationResult[];
  duration: number;
}

/**
 * Run contract tests against a provider
 */
export async function runContractTests(
  contract: PactContract,
  config: ContractTestConfig
): Promise<ContractTestResults> {
  const results: VerificationResult[] = [];
  const startTime = Date.now();

  for (const interaction of contract.interactions) {
    try {
      // Build request
      const url = new URL(interaction.request.path, config.baseUrl);

      if (interaction.request.query) {
        for (const [key, value] of Object.entries(interaction.request.query)) {
          url.searchParams.set(key, value);
        }
      }

      const headers: Record<string, string> = {
        ...interaction.request.headers,
      };

      // Add auth token if provided and not already in headers
      if (config.authToken && !headers['Authorization']) {
        headers['Authorization'] = `Bearer ${config.authToken}`;
      }

      // Make request
      const response = await fetch(url.toString(), {
        method: interaction.request.method,
        headers,
        body: interaction.request.body ? JSON.stringify(interaction.request.body) : undefined,
      });

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const responseBody = await response.json().catch(() => null);

      // Verify response
      const result = verifyResponse(interaction, {
        status: response.status,
        headers: responseHeaders,
        body: responseBody,
      });

      results.push(result);
    } catch (error) {
      results.push({
        interaction: interaction.description,
        success: false,
        errors: [`Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        duration: 0,
      });
    }
  }

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return {
    contract: `${contract.consumer.name} -> ${contract.provider.name}`,
    total: results.length,
    passed,
    failed,
    skipped: 0,
    results,
    duration: Date.now() - startTime,
  };
}

/**
 * Generate contract file
 */
export function generateContractFile(contract: PactContract): string {
  return JSON.stringify(contract, null, 2);
}

/**
 * Publish contract to Pact Broker
 */
export async function publishContract(
  contract: PactContract,
  brokerUrl: string,
  options: {
    version: string;
    branch?: string;
    tags?: string[];
    token?: string;
  }
): Promise<void> {
  const url = `${brokerUrl}/pacts/provider/${encodeURIComponent(contract.provider.name)}/consumer/${encodeURIComponent(contract.consumer.name)}/version/${encodeURIComponent(options.version)}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(contract),
  });

  if (!response.ok) {
    throw new Error(`Failed to publish contract: ${response.statusText}`);
  }

  // Tag the version if tags provided
  if (options.tags) {
    for (const tag of options.tags) {
      await fetch(
        `${brokerUrl}/pacticipants/${encodeURIComponent(contract.consumer.name)}/versions/${encodeURIComponent(options.version)}/tags/${encodeURIComponent(tag)}`,
        {
          method: 'PUT',
          headers,
        }
      );
    }
  }
}

// =============================================================================
// Exports
// =============================================================================

export const pactContracts = {
  phase6: PHASE6_CONTRACTS,
  matchers: Matchers,
  verify: verifyResponse,
  run: runContractTests,
  generate: generateContractFile,
  publish: publishContract,
};
