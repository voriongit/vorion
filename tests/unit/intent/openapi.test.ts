/**
 * OpenAPI Specification Tests
 *
 * Validates the structure and correctness of the INTENT module OpenAPI specification.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { OpenAPIV3_1 } from 'openapi-types';
import {
  intentOpenApiSpec,
  getOpenApiSpec,
  getOpenApiSpecJson,
} from '../../../src/intent/openapi.js';

describe('OpenAPI Specification', () => {
  describe('getOpenApiSpec', () => {
    it('should return a valid OpenAPI document object', () => {
      const spec = getOpenApiSpec();
      expect(spec).toBeDefined();
      expect(spec.openapi).toBe('3.1.0');
    });
  });

  describe('getOpenApiSpecJson', () => {
    it('should return valid JSON string', () => {
      const json = getOpenApiSpecJson();
      expect(typeof json).toBe('string');
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should return the same content as the object spec', () => {
      const json = getOpenApiSpecJson();
      const parsed = JSON.parse(json);
      const spec = getOpenApiSpec();
      expect(parsed.openapi).toBe(spec.openapi);
      expect(parsed.info.title).toBe(spec.info.title);
    });
  });

  describe('intentOpenApiSpec structure', () => {
    let spec: OpenAPIV3_1.Document;

    beforeAll(() => {
      spec = intentOpenApiSpec;
    });

    describe('info section', () => {
      it('should have required info fields', () => {
        expect(spec.info).toBeDefined();
        expect(spec.info.title).toBe('Vorion INTENT Module API');
        expect(spec.info.version).toBe('1.0.0');
        expect(spec.info.description).toBeDefined();
        expect(spec.info.description!.length).toBeGreaterThan(100);
      });

      it('should have contact information', () => {
        expect(spec.info.contact).toBeDefined();
        expect(spec.info.contact!.name).toBe('Vorion API Support');
        expect(spec.info.contact!.email).toBe('api-support@vorion.io');
      });

      it('should have license information', () => {
        expect(spec.info.license).toBeDefined();
        expect(spec.info.license!.name).toBe('MIT');
      });
    });

    describe('servers section', () => {
      it('should have at least one server defined', () => {
        expect(spec.servers).toBeDefined();
        expect(spec.servers!.length).toBeGreaterThan(0);
      });

      it('should have API v1 base path', () => {
        const server = spec.servers![0];
        expect(server.url).toBe('/api/v1');
        expect(server.description).toBeDefined();
      });
    });

    describe('tags', () => {
      it('should have all required tags defined', () => {
        expect(spec.tags).toBeDefined();
        const tagNames = spec.tags!.map(t => t.name);
        expect(tagNames).toContain('Intents');
        expect(tagNames).toContain('Escalations');
        expect(tagNames).toContain('Events');
        expect(tagNames).toContain('GDPR');
        expect(tagNames).toContain('Health');
        expect(tagNames).toContain('OpenAPI');
      });

      it('should have descriptions for all tags', () => {
        spec.tags!.forEach(tag => {
          expect(tag.description).toBeDefined();
          expect(tag.description!.length).toBeGreaterThan(0);
        });
      });
    });

    describe('paths', () => {
      it('should have all required intent endpoints', () => {
        const paths = Object.keys(spec.paths!);
        expect(paths).toContain('/intent');
        expect(paths).toContain('/intent/{id}');
        expect(paths).toContain('/intent/{id}/cancel');
        expect(paths).toContain('/intent/{id}/escalate');
        expect(paths).toContain('/intent/{id}/events');
      });

      it('should have escalation endpoint', () => {
        const paths = Object.keys(spec.paths!);
        expect(paths).toContain('/intent/escalation/{id}/resolve');
      });

      it('should have health endpoint', () => {
        const paths = Object.keys(spec.paths!);
        expect(paths).toContain('/intent/health');
      });

      it('should have OpenAPI documentation endpoint', () => {
        const paths = Object.keys(spec.paths!);
        expect(paths).toContain('/intent/openapi.json');
      });

      it('should have GDPR endpoints', () => {
        const paths = Object.keys(spec.paths!);
        expect(paths).toContain('/intent/gdpr/export/{entityId}');
        expect(paths).toContain('/intent/gdpr/erase/{entityId}');
      });
    });

    describe('POST /intent endpoint', () => {
      let postIntent: OpenAPIV3_1.OperationObject;

      beforeAll(() => {
        postIntent = (spec.paths!['/intent'] as OpenAPIV3_1.PathItemObject).post!;
      });

      it('should have correct operation ID', () => {
        expect(postIntent.operationId).toBe('submitIntent');
      });

      it('should have summary and description', () => {
        expect(postIntent.summary).toBe('Submit a new intent');
        expect(postIntent.description).toBeDefined();
      });

      it('should require authentication', () => {
        expect(postIntent.security).toBeDefined();
        expect(postIntent.security!.length).toBeGreaterThan(0);
        expect(postIntent.security![0]).toHaveProperty('bearerAuth');
      });

      it('should have request body', () => {
        expect(postIntent.requestBody).toBeDefined();
        const body = postIntent.requestBody as OpenAPIV3_1.RequestBodyObject;
        expect(body.required).toBe(true);
        expect(body.content['application/json']).toBeDefined();
      });

      it('should have correct response codes', () => {
        expect(postIntent.responses).toBeDefined();
        expect(postIntent.responses!['202']).toBeDefined();
        expect(postIntent.responses!['400']).toBeDefined();
        expect(postIntent.responses!['401']).toBeDefined();
        expect(postIntent.responses!['403']).toBeDefined();
        expect(postIntent.responses!['429']).toBeDefined();
        expect(postIntent.responses!['500']).toBeDefined();
      });

      it('should include rate limit headers in 202 response', () => {
        const response202 = postIntent.responses!['202'] as OpenAPIV3_1.ResponseObject;
        expect(response202.headers).toBeDefined();
        expect(response202.headers!['X-RateLimit-Limit']).toBeDefined();
        expect(response202.headers!['X-RateLimit-Remaining']).toBeDefined();
        expect(response202.headers!['X-RateLimit-Reset']).toBeDefined();
      });

      it('should have request body examples', () => {
        const body = postIntent.requestBody as OpenAPIV3_1.RequestBodyObject;
        const jsonContent = body.content['application/json'];
        expect(jsonContent.examples).toBeDefined();
        expect(jsonContent.examples!['basic']).toBeDefined();
        expect(jsonContent.examples!['withPriority']).toBeDefined();
      });
    });

    describe('GET /intent endpoint', () => {
      let getIntents: OpenAPIV3_1.OperationObject;

      beforeAll(() => {
        getIntents = (spec.paths!['/intent'] as OpenAPIV3_1.PathItemObject).get!;
      });

      it('should have correct operation ID', () => {
        expect(getIntents.operationId).toBe('listIntents');
      });

      it('should have pagination parameters', () => {
        expect(getIntents.parameters).toBeDefined();
        const paramRefs = getIntents.parameters!.map(
          (p) => (p as OpenAPIV3_1.ReferenceObject).$ref || (p as OpenAPIV3_1.ParameterObject).name
        );
        expect(paramRefs.some(ref => ref?.includes('Limit'))).toBe(true);
        expect(paramRefs.some(ref => ref?.includes('Cursor'))).toBe(true);
      });

      it('should have filter parameters', () => {
        expect(getIntents.parameters).toBeDefined();
        const paramRefs = getIntents.parameters!.map(
          (p) => (p as OpenAPIV3_1.ReferenceObject).$ref || (p as OpenAPIV3_1.ParameterObject).name
        );
        expect(paramRefs.some(ref => ref?.includes('EntityId') || ref === 'entityId')).toBe(true);
        expect(paramRefs.some(ref => ref?.includes('Status') || ref === 'status')).toBe(true);
      });
    });

    describe('GET /intent/{id} endpoint', () => {
      let getIntent: OpenAPIV3_1.OperationObject;

      beforeAll(() => {
        getIntent = (spec.paths!['/intent/{id}'] as OpenAPIV3_1.PathItemObject).get!;
      });

      it('should have correct operation ID', () => {
        expect(getIntent.operationId).toBe('getIntent');
      });

      it('should return 404 for not found', () => {
        expect(getIntent.responses!['404']).toBeDefined();
      });
    });

    describe('DELETE /intent/{id} endpoint', () => {
      let deleteIntent: OpenAPIV3_1.OperationObject;

      beforeAll(() => {
        deleteIntent = (spec.paths!['/intent/{id}'] as OpenAPIV3_1.PathItemObject).delete!;
      });

      it('should have correct operation ID', () => {
        expect(deleteIntent.operationId).toBe('deleteIntent');
      });

      it('should be tagged with GDPR', () => {
        expect(deleteIntent.tags).toContain('GDPR');
      });

      it('should return 204 on success', () => {
        expect(deleteIntent.responses!['204']).toBeDefined();
      });
    });

    describe('PUT /intent/escalation/{id}/resolve endpoint', () => {
      let resolveEscalation: OpenAPIV3_1.OperationObject;

      beforeAll(() => {
        resolveEscalation = (spec.paths!['/intent/escalation/{id}/resolve'] as OpenAPIV3_1.PathItemObject).put!;
      });

      it('should have correct operation ID', () => {
        expect(resolveEscalation.operationId).toBe('resolveEscalation');
      });

      it('should have request body with resolution options', () => {
        expect(resolveEscalation.requestBody).toBeDefined();
        const body = resolveEscalation.requestBody as OpenAPIV3_1.RequestBodyObject;
        expect(body.required).toBe(true);
      });

      it('should have examples for approve and reject', () => {
        const body = resolveEscalation.requestBody as OpenAPIV3_1.RequestBodyObject;
        const jsonContent = body.content['application/json'];
        expect(jsonContent.examples).toBeDefined();
        expect(jsonContent.examples!['approve']).toBeDefined();
        expect(jsonContent.examples!['reject']).toBeDefined();
      });
    });

    describe('GET /intent/health endpoint', () => {
      let healthCheck: OpenAPIV3_1.OperationObject;

      beforeAll(() => {
        healthCheck = (spec.paths!['/intent/health'] as OpenAPIV3_1.PathItemObject).get!;
      });

      it('should have correct operation ID', () => {
        expect(healthCheck.operationId).toBe('getIntentHealth');
      });

      it('should not require authentication', () => {
        // Health endpoint typically doesn't have security requirement
        // or has an empty security array to override global security
        expect(healthCheck.security).toBeUndefined();
      });

      it('should return 503 for unhealthy state', () => {
        expect(healthCheck.responses!['503']).toBeDefined();
      });
    });
  });

  describe('components', () => {
    let spec: OpenAPIV3_1.Document;
    let components: OpenAPIV3_1.ComponentsObject;

    beforeAll(() => {
      spec = intentOpenApiSpec;
      components = spec.components!;
    });

    describe('securitySchemes', () => {
      it('should have bearerAuth scheme', () => {
        expect(components.securitySchemes).toBeDefined();
        expect(components.securitySchemes!['bearerAuth']).toBeDefined();
      });

      it('should be configured for JWT', () => {
        const bearerAuth = components.securitySchemes!['bearerAuth'] as OpenAPIV3_1.SecuritySchemeObject;
        expect(bearerAuth.type).toBe('http');
        expect(bearerAuth.scheme).toBe('bearer');
        expect(bearerAuth.bearerFormat).toBe('JWT');
      });
    });

    describe('parameters', () => {
      it('should have common parameters defined', () => {
        expect(components.parameters).toBeDefined();
        expect(components.parameters!['IntentId']).toBeDefined();
        expect(components.parameters!['TenantId']).toBeDefined();
        expect(components.parameters!['Limit']).toBeDefined();
        expect(components.parameters!['Cursor']).toBeDefined();
      });

      it('should have correct IntentId parameter configuration', () => {
        const intentId = components.parameters!['IntentId'] as OpenAPIV3_1.ParameterObject;
        expect(intentId.name).toBe('id');
        expect(intentId.in).toBe('path');
        expect(intentId.required).toBe(true);
        expect(intentId.schema).toBeDefined();
        expect((intentId.schema as OpenAPIV3_1.SchemaObject).format).toBe('uuid');
      });
    });

    describe('headers', () => {
      it('should have rate limit headers defined', () => {
        expect(components.headers).toBeDefined();
        expect(components.headers!['X-RateLimit-Limit']).toBeDefined();
        expect(components.headers!['X-RateLimit-Remaining']).toBeDefined();
        expect(components.headers!['X-RateLimit-Reset']).toBeDefined();
      });
    });

    describe('schemas', () => {
      it('should have Intent schema', () => {
        expect(components.schemas!['Intent']).toBeDefined();
        const intent = components.schemas!['Intent'] as OpenAPIV3_1.SchemaObject;
        expect(intent.type).toBe('object');
        expect(intent.required).toContain('id');
        expect(intent.required).toContain('tenantId');
        expect(intent.required).toContain('entityId');
        expect(intent.required).toContain('goal');
        expect(intent.required).toContain('status');
      });

      it('should have IntentSubmission schema', () => {
        expect(components.schemas!['IntentSubmission']).toBeDefined();
        const submission = components.schemas!['IntentSubmission'] as OpenAPIV3_1.SchemaObject;
        expect(submission.required).toContain('entityId');
        expect(submission.required).toContain('goal');
        expect(submission.required).toContain('context');
      });

      it('should have IntentStatus enum', () => {
        expect(components.schemas!['IntentStatus']).toBeDefined();
        const status = components.schemas!['IntentStatus'] as OpenAPIV3_1.SchemaObject;
        expect(status.enum).toBeDefined();
        expect(status.enum).toContain('pending');
        expect(status.enum).toContain('evaluating');
        expect(status.enum).toContain('approved');
        expect(status.enum).toContain('denied');
        expect(status.enum).toContain('escalated');
        expect(status.enum).toContain('cancelled');
      });

      it('should have Escalation schema', () => {
        expect(components.schemas!['Escalation']).toBeDefined();
        const escalation = components.schemas!['Escalation'] as OpenAPIV3_1.SchemaObject;
        expect(escalation.required).toContain('id');
        expect(escalation.required).toContain('intentId');
        expect(escalation.required).toContain('status');
        expect(escalation.required).toContain('timeout');
      });

      it('should have EscalationStatus enum', () => {
        expect(components.schemas!['EscalationStatus']).toBeDefined();
        const status = components.schemas!['EscalationStatus'] as OpenAPIV3_1.SchemaObject;
        expect(status.enum).toContain('pending');
        expect(status.enum).toContain('acknowledged');
        expect(status.enum).toContain('approved');
        expect(status.enum).toContain('rejected');
        expect(status.enum).toContain('timeout');
      });

      it('should have EscalationReasonCategory enum', () => {
        expect(components.schemas!['EscalationReasonCategory']).toBeDefined();
        const category = components.schemas!['EscalationReasonCategory'] as OpenAPIV3_1.SchemaObject;
        expect(category.enum).toContain('trust_insufficient');
        expect(category.enum).toContain('high_risk');
        expect(category.enum).toContain('policy_violation');
        expect(category.enum).toContain('manual_review');
        expect(category.enum).toContain('constraint_escalate');
      });

      it('should have IntentEvent schema', () => {
        expect(components.schemas!['IntentEvent']).toBeDefined();
        const event = components.schemas!['IntentEvent'] as OpenAPIV3_1.SchemaObject;
        expect(event.required).toContain('id');
        expect(event.required).toContain('intentId');
        expect(event.required).toContain('eventType');
        expect(event.required).toContain('occurredAt');
        expect(event.properties).toHaveProperty('hash');
        expect(event.properties).toHaveProperty('previousHash');
      });

      it('should have Error schema', () => {
        expect(components.schemas!['Error']).toBeDefined();
        const error = components.schemas!['Error'] as OpenAPIV3_1.SchemaObject;
        expect(error.required).toContain('error');
        expect(error.properties).toHaveProperty('error');
      });

      it('should have GDPR schemas', () => {
        expect(components.schemas!['GdprDataExport']).toBeDefined();
        expect(components.schemas!['GdprEraseResponse']).toBeDefined();
      });

      it('should have ChainVerificationResult schema', () => {
        expect(components.schemas!['ChainVerificationResult']).toBeDefined();
        const verification = components.schemas!['ChainVerificationResult'] as OpenAPIV3_1.SchemaObject;
        expect(verification.required).toContain('valid');
        expect(verification.properties).toHaveProperty('invalidAt');
        expect(verification.properties).toHaveProperty('error');
      });

      it('should have HealthResponse schema', () => {
        expect(components.schemas!['HealthResponse']).toBeDefined();
        const health = components.schemas!['HealthResponse'] as OpenAPIV3_1.SchemaObject;
        expect(health.required).toContain('status');
        expect(health.properties).toHaveProperty('checks');
      });
    });

    describe('responses', () => {
      it('should have common error responses', () => {
        expect(components.responses).toBeDefined();
        expect(components.responses!['BadRequest']).toBeDefined();
        expect(components.responses!['Unauthorized']).toBeDefined();
        expect(components.responses!['Forbidden']).toBeDefined();
        expect(components.responses!['NotFound']).toBeDefined();
        expect(components.responses!['TooManyRequests']).toBeDefined();
        expect(components.responses!['InternalError']).toBeDefined();
      });

      it('should have Retry-After header in TooManyRequests response', () => {
        const tooManyRequests = components.responses!['TooManyRequests'] as OpenAPIV3_1.ResponseObject;
        expect(tooManyRequests.headers).toBeDefined();
        expect(tooManyRequests.headers!['Retry-After']).toBeDefined();
      });
    });
  });

  describe('global security', () => {
    it('should have global security requirement', () => {
      const spec = intentOpenApiSpec;
      expect(spec.security).toBeDefined();
      expect(spec.security!.length).toBeGreaterThan(0);
      expect(spec.security![0]).toHaveProperty('bearerAuth');
    });
  });

  describe('schema validation', () => {
    let spec: OpenAPIV3_1.Document;

    beforeAll(() => {
      spec = intentOpenApiSpec;
    });

    it('should have valid $ref references in paths', () => {
      const paths = spec.paths!;

      Object.values(paths).forEach((pathItem) => {
        if (!pathItem) return;
        const item = pathItem as OpenAPIV3_1.PathItemObject;

        // Check each method
        ['get', 'post', 'put', 'delete', 'patch'].forEach((method) => {
          const operation = item[method as keyof OpenAPIV3_1.PathItemObject] as
            | OpenAPIV3_1.OperationObject
            | undefined;
          if (!operation) return;

          // Check parameters
          operation.parameters?.forEach((param) => {
            if ('$ref' in param) {
              const refPath = param.$ref.replace('#/components/parameters/', '');
              expect(spec.components?.parameters?.[refPath]).toBeDefined();
            }
          });

          // Check responses
          Object.values(operation.responses || {}).forEach((response) => {
            if (!response) return;
            if ('$ref' in response) {
              const refPath = response.$ref.replace('#/components/responses/', '');
              expect(spec.components?.responses?.[refPath]).toBeDefined();
            }
          });
        });
      });
    });

    it('should have valid schema references', () => {
      const schemas = spec.components?.schemas || {};

      Object.values(schemas).forEach((schema) => {
        if (!schema) return;
        const s = schema as OpenAPIV3_1.SchemaObject;

        // Check $ref in properties
        if (s.properties) {
          Object.values(s.properties).forEach((prop) => {
            if (!prop) return;
            if ('$ref' in prop) {
              const refPath = prop.$ref.replace('#/components/schemas/', '');
              expect(schemas[refPath]).toBeDefined();
            }
          });
        }

        // Check $ref in items (for arrays)
        if (s.items && '$ref' in s.items) {
          const refPath = s.items.$ref.replace('#/components/schemas/', '');
          expect(schemas[refPath]).toBeDefined();
        }
      });
    });

    it('should have descriptions for main schemas', () => {
      const schemas = spec.components?.schemas || {};
      const mainSchemas = [
        'Intent',
        'IntentSubmission',
        'IntentEvent',
        'IntentEvaluation',
        'Escalation',
        'Error',
        'HealthResponse',
        'GdprDataExport',
        'GdprEraseResponse',
        'ChainVerificationResult',
      ];

      mainSchemas.forEach((name) => {
        const schema = schemas[name] as OpenAPIV3_1.SchemaObject;
        expect(schema, `Schema ${name} should exist`).toBeDefined();
        expect(schema.description, `Schema ${name} should have description`).toBeDefined();
      });
    });

    it('should have unique operation IDs', () => {
      const operationIds = new Set<string>();
      const paths = spec.paths!;

      Object.values(paths).forEach((pathItem) => {
        if (!pathItem) return;
        const item = pathItem as OpenAPIV3_1.PathItemObject;

        ['get', 'post', 'put', 'delete', 'patch'].forEach((method) => {
          const operation = item[method as keyof OpenAPIV3_1.PathItemObject] as
            | OpenAPIV3_1.OperationObject
            | undefined;
          if (operation?.operationId) {
            expect(operationIds.has(operation.operationId)).toBe(false);
            operationIds.add(operation.operationId);
          }
        });
      });
    });
  });

  describe('IntentSubmission schema details', () => {
    let submissionSchema: OpenAPIV3_1.SchemaObject;

    beforeAll(() => {
      submissionSchema = intentOpenApiSpec.components?.schemas?.[
        'IntentSubmission'
      ] as OpenAPIV3_1.SchemaObject;
    });

    it('should have entityId as UUID format', () => {
      expect(submissionSchema.properties?.entityId).toBeDefined();
      const entityId = submissionSchema.properties!.entityId as OpenAPIV3_1.SchemaObject;
      expect(entityId.format).toBe('uuid');
    });

    it('should have goal with length constraints', () => {
      expect(submissionSchema.properties?.goal).toBeDefined();
      const goal = submissionSchema.properties!.goal as OpenAPIV3_1.SchemaObject;
      expect(goal.minLength).toBe(1);
      expect(goal.maxLength).toBe(1024);
    });

    it('should have priority with range 0-9', () => {
      expect(submissionSchema.properties?.priority).toBeDefined();
      const priority = submissionSchema.properties!.priority as OpenAPIV3_1.SchemaObject;
      expect(priority.minimum).toBe(0);
      expect(priority.maximum).toBe(9);
      expect(priority.default).toBe(0);
    });

    it('should have intentType with length constraints', () => {
      expect(submissionSchema.properties?.intentType).toBeDefined();
      const intentType = submissionSchema.properties!.intentType as OpenAPIV3_1.SchemaObject;
      expect(intentType.minLength).toBe(1);
      expect(intentType.maxLength).toBe(128);
    });

    it('should have idempotencyKey with max length', () => {
      expect(submissionSchema.properties?.idempotencyKey).toBeDefined();
      const idempotencyKey = submissionSchema.properties!.idempotencyKey as OpenAPIV3_1.SchemaObject;
      expect(idempotencyKey.maxLength).toBe(128);
    });
  });

  describe('Intent schema details', () => {
    let intentSchema: OpenAPIV3_1.SchemaObject;

    beforeAll(() => {
      intentSchema = intentOpenApiSpec.components?.schemas?.['Intent'] as OpenAPIV3_1.SchemaObject;
    });

    it('should have trustLevel with range 0-4', () => {
      expect(intentSchema.properties?.trustLevel).toBeDefined();
      const trustLevel = intentSchema.properties!.trustLevel as OpenAPIV3_1.SchemaObject;
      expect(trustLevel.minimum).toBe(0);
      expect(trustLevel.maximum).toBe(4);
    });

    it('should have trustScore with range 0-1000', () => {
      expect(intentSchema.properties?.trustScore).toBeDefined();
      const trustScore = intentSchema.properties!.trustScore as OpenAPIV3_1.SchemaObject;
      expect(trustScore.minimum).toBe(0);
      expect(trustScore.maximum).toBe(1000);
    });

    it('should have deletedAt as nullable datetime', () => {
      expect(intentSchema.properties?.deletedAt).toBeDefined();
      const deletedAt = intentSchema.properties!.deletedAt as OpenAPIV3_1.SchemaObject;
      expect(deletedAt.format).toBe('date-time');
      expect(deletedAt.nullable).toBe(true);
    });

    it('should have cancellationReason as nullable', () => {
      expect(intentSchema.properties?.cancellationReason).toBeDefined();
      const cancellationReason = intentSchema.properties!.cancellationReason as OpenAPIV3_1.SchemaObject;
      expect(cancellationReason.nullable).toBe(true);
    });
  });

  describe('Escalation schema details', () => {
    let escalationSchema: OpenAPIV3_1.SchemaObject;

    beforeAll(() => {
      escalationSchema = intentOpenApiSpec.components?.schemas?.[
        'Escalation'
      ] as OpenAPIV3_1.SchemaObject;
    });

    it('should have required fields for escalation', () => {
      expect(escalationSchema.required).toContain('id');
      expect(escalationSchema.required).toContain('intentId');
      expect(escalationSchema.required).toContain('tenantId');
      expect(escalationSchema.required).toContain('reason');
      expect(escalationSchema.required).toContain('reasonCategory');
      expect(escalationSchema.required).toContain('escalatedTo');
      expect(escalationSchema.required).toContain('status');
      expect(escalationSchema.required).toContain('timeout');
      expect(escalationSchema.required).toContain('timeoutAt');
      expect(escalationSchema.required).toContain('slaBreached');
    });

    it('should have resolution as nullable object', () => {
      expect(escalationSchema.properties?.resolution).toBeDefined();
      const resolution = escalationSchema.properties!.resolution as OpenAPIV3_1.SchemaObject;
      expect(resolution.nullable).toBe(true);
      expect(resolution.properties).toHaveProperty('resolvedBy');
      expect(resolution.properties).toHaveProperty('resolvedAt');
      expect(resolution.properties).toHaveProperty('notes');
    });

    it('should have slaBreached as boolean', () => {
      expect(escalationSchema.properties?.slaBreached).toBeDefined();
      const slaBreached = escalationSchema.properties!.slaBreached as OpenAPIV3_1.SchemaObject;
      expect(slaBreached.type).toBe('boolean');
    });
  });
});
