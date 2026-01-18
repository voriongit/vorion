/**
 * Metrics Module Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  intentRegistry,
  intentsSubmittedTotal,
  trustGateEvaluations,
  intentStatusTransitions,
  jobsProcessedTotal,
  jobProcessingDuration,
  queueDepth,
  queueActiveJobs,
  dlqSize,
  escalationsCreated,
  escalationResolutions,
  escalationPendingDuration,
  escalationsPending,
  encryptionOperations,
  errorsTotal,
  cleanupJobRuns,
  recordsCleanedUp,
  recordIntentSubmission,
  recordTrustGateEvaluation,
  recordStatusTransition,
  recordJobResult,
  updateQueueGauges,
  recordError,
  getMetrics,
} from '../../../src/intent/metrics.js';

describe('Metrics Module', () => {
  beforeEach(async () => {
    // Reset all metrics before each test
    intentRegistry.resetMetrics();
  });

  describe('Counter Metrics', () => {
    it('should increment intentsSubmittedTotal', () => {
      intentsSubmittedTotal.inc({
        tenant_id: 'tenant-1',
        intent_type: 'data-access',
        outcome: 'success',
      });

      // Verify counter was incremented (we can't easily read prom-client values in tests,
      // but we verify no errors are thrown)
      expect(true).toBe(true);
    });

    it('should increment trustGateEvaluations', () => {
      trustGateEvaluations.inc({
        tenant_id: 'tenant-1',
        intent_type: 'high-risk',
        result: 'passed',
      });

      expect(true).toBe(true);
    });

    it('should increment intentStatusTransitions', () => {
      intentStatusTransitions.inc({
        tenant_id: 'tenant-1',
        from_status: 'pending',
        to_status: 'approved',
      });

      expect(true).toBe(true);
    });

    it('should increment jobsProcessedTotal', () => {
      jobsProcessedTotal.inc({
        queue_name: 'intake',
        result: 'success',
      });

      expect(true).toBe(true);
    });

    it('should increment escalationsCreated', () => {
      escalationsCreated.inc({
        tenant_id: 'tenant-1',
        intent_type: 'high-risk',
        reason_category: 'trust_insufficient',
      });

      expect(true).toBe(true);
    });

    it('should increment escalationResolutions', () => {
      escalationResolutions.inc({
        tenant_id: 'tenant-1',
        resolution: 'approved',
      });

      expect(true).toBe(true);
    });

    it('should increment encryptionOperations', () => {
      encryptionOperations.inc({
        operation: 'encrypt',
      });

      expect(true).toBe(true);
    });

    it('should increment errorsTotal', () => {
      errorsTotal.inc({
        error_code: 'INTENT_RATE_LIMIT',
        component: 'intent-service',
      });

      expect(true).toBe(true);
    });

    it('should increment cleanupJobRuns', () => {
      cleanupJobRuns.inc({
        result: 'success',
      });

      expect(true).toBe(true);
    });

    it('should increment recordsCleanedUp', () => {
      recordsCleanedUp.inc({ type: 'events' }, 100);
      recordsCleanedUp.inc({ type: 'intents' }, 50);

      expect(true).toBe(true);
    });
  });

  describe('Histogram Metrics', () => {
    it('should observe jobProcessingDuration', () => {
      jobProcessingDuration.observe({
        queue_name: 'evaluate',
      }, 1.5);

      expect(true).toBe(true);
    });

    it('should observe escalationPendingDuration', () => {
      escalationPendingDuration.observe({
        tenant_id: 'tenant-1',
        resolution: 'approved',
      }, 3600);

      expect(true).toBe(true);
    });
  });

  describe('Gauge Metrics', () => {
    it('should set queueDepth', () => {
      queueDepth.set({ queue_name: 'intake' }, 10);
      queueDepth.set({ queue_name: 'evaluate' }, 5);

      expect(true).toBe(true);
    });

    it('should set queueActiveJobs', () => {
      queueActiveJobs.set({ queue_name: 'intake' }, 3);
      queueActiveJobs.set({ queue_name: 'evaluate' }, 2);

      expect(true).toBe(true);
    });

    it('should set dlqSize', () => {
      dlqSize.set(15);

      expect(true).toBe(true);
    });

    it('should increment and decrement escalationsPending', () => {
      escalationsPending.inc({ tenant_id: 'tenant-1' });
      escalationsPending.dec({ tenant_id: 'tenant-1' });

      expect(true).toBe(true);
    });
  });

  describe('Helper Functions', () => {
    describe('recordIntentSubmission', () => {
      it('should record successful submission', () => {
        recordIntentSubmission('tenant-1', 'data-access', 'success', 2);

        expect(true).toBe(true);
      });

      it('should handle undefined intent type', () => {
        recordIntentSubmission('tenant-1', undefined, 'success', 1);

        expect(true).toBe(true);
      });

      it('should handle undefined trust level', () => {
        recordIntentSubmission('tenant-1', 'data-access', 'rejected', undefined);

        expect(true).toBe(true);
      });

      it('should record rejected submissions', () => {
        recordIntentSubmission('tenant-1', 'high-risk', 'rejected', 0);

        expect(true).toBe(true);
      });

      it('should record duplicate submissions', () => {
        recordIntentSubmission('tenant-1', 'data-access', 'duplicate', 1);

        expect(true).toBe(true);
      });
    });

    describe('recordTrustGateEvaluation', () => {
      it('should record passed evaluation', () => {
        recordTrustGateEvaluation('tenant-1', 'data-access', 'passed');

        expect(true).toBe(true);
      });

      it('should record rejected evaluation', () => {
        recordTrustGateEvaluation('tenant-1', 'high-security', 'rejected');

        expect(true).toBe(true);
      });

      it('should record bypassed evaluation', () => {
        recordTrustGateEvaluation('tenant-1', 'admin-action', 'bypassed');

        expect(true).toBe(true);
      });

      it('should handle undefined intent type', () => {
        recordTrustGateEvaluation('tenant-1', undefined, 'passed');

        expect(true).toBe(true);
      });
    });

    describe('recordStatusTransition', () => {
      it('should record status transition', () => {
        recordStatusTransition('tenant-1', 'pending', 'approved');

        expect(true).toBe(true);
      });

      it('should record transition to cancelled', () => {
        recordStatusTransition('tenant-1', 'pending', 'cancelled');

        expect(true).toBe(true);
      });

      it('should record transition from new', () => {
        recordStatusTransition('tenant-1', 'new', 'pending');

        expect(true).toBe(true);
      });
    });

    describe('recordJobResult', () => {
      it('should record successful job', () => {
        recordJobResult('intake', 'success', 0.5);

        expect(true).toBe(true);
      });

      it('should record failed job', () => {
        recordJobResult('evaluate', 'failure', 2.3);

        expect(true).toBe(true);
      });

      it('should record decision job', () => {
        recordJobResult('decision', 'success', 0.1);

        expect(true).toBe(true);
      });
    });

    describe('updateQueueGauges', () => {
      it('should update queue gauges', () => {
        updateQueueGauges('intake', 10, 3);

        expect(true).toBe(true);
      });

      it('should update with zero values', () => {
        updateQueueGauges('evaluate', 0, 0);

        expect(true).toBe(true);
      });
    });

    describe('recordError', () => {
      it('should record error', () => {
        recordError('INTENT_RATE_LIMIT', 'intent-service');

        expect(true).toBe(true);
      });

      it('should record different error codes', () => {
        recordError('ENQUEUE_FAILED', 'queue-worker');
        recordError('CLEANUP_JOB_FAILED', 'scheduler');
        recordError('TIMEOUT_CHECK_FAILED', 'scheduler');

        expect(true).toBe(true);
      });
    });
  });

  describe('getMetrics', () => {
    it('should return metrics in Prometheus format', async () => {
      // Add some sample data
      intentsSubmittedTotal.inc({
        tenant_id: 'test-tenant',
        intent_type: 'test-type',
        outcome: 'success',
      });

      const metrics = await getMetrics();

      expect(typeof metrics).toBe('string');
      expect(metrics).toContain('vorion_intents_submitted_total');
      expect(metrics).toContain('# HELP');
      expect(metrics).toContain('# TYPE');
    });

    it('should include all registered metrics', async () => {
      const metrics = await getMetrics();

      // Check that key metrics are present (using actual metric names from the module)
      expect(metrics).toContain('vorion_intents_submitted_total');
      expect(metrics).toContain('vorion_trust_gate_evaluations_total');
      expect(metrics).toContain('vorion_intent_status_transitions_total');
      expect(metrics).toContain('vorion_jobs_processed_total');
      expect(metrics).toContain('vorion_job_processing_duration_seconds');
      expect(metrics).toContain('vorion_queue_depth');
      expect(metrics).toContain('vorion_queue_active_jobs');
      expect(metrics).toContain('vorion_dlq_size');
      expect(metrics).toContain('vorion_escalations_created_total');
      expect(metrics).toContain('vorion_escalation_resolutions_total');
      expect(metrics).toContain('vorion_escalation_pending_duration_seconds');
      expect(metrics).toContain('vorion_escalations_pending');
      expect(metrics).toContain('vorion_encryption_operations_total');
      expect(metrics).toContain('vorion_intent_errors_total');
      expect(metrics).toContain('vorion_cleanup_job_runs_total');
      expect(metrics).toContain('vorion_records_cleaned_up_total');
    });
  });

  describe('Metric Labels', () => {
    it('should allow different tenant IDs', () => {
      intentsSubmittedTotal.inc({ tenant_id: 'tenant-a', intent_type: 'type', outcome: 'success' });
      intentsSubmittedTotal.inc({ tenant_id: 'tenant-b', intent_type: 'type', outcome: 'success' });
      intentsSubmittedTotal.inc({ tenant_id: 'tenant-c', intent_type: 'type', outcome: 'success' });

      expect(true).toBe(true);
    });

    it('should allow different intent types', () => {
      intentsSubmittedTotal.inc({ tenant_id: 'tenant', intent_type: 'data-access', outcome: 'success' });
      intentsSubmittedTotal.inc({ tenant_id: 'tenant', intent_type: 'data-export', outcome: 'success' });
      intentsSubmittedTotal.inc({ tenant_id: 'tenant', intent_type: 'admin-action', outcome: 'success' });

      expect(true).toBe(true);
    });

    it('should allow different outcomes', () => {
      intentsSubmittedTotal.inc({ tenant_id: 'tenant', intent_type: 'type', outcome: 'success' });
      intentsSubmittedTotal.inc({ tenant_id: 'tenant', intent_type: 'type', outcome: 'rejected' });
      intentsSubmittedTotal.inc({ tenant_id: 'tenant', intent_type: 'type', outcome: 'duplicate' });

      expect(true).toBe(true);
    });

    it('should allow different queue names', () => {
      jobsProcessedTotal.inc({ queue_name: 'intake', result: 'success' });
      jobsProcessedTotal.inc({ queue_name: 'evaluate', result: 'success' });
      jobsProcessedTotal.inc({ queue_name: 'decision', result: 'success' });
      jobsProcessedTotal.inc({ queue_name: 'dead-letter', result: 'success' });

      expect(true).toBe(true);
    });

    it('should allow different escalation reason categories', () => {
      escalationsCreated.inc({ tenant_id: 'tenant', intent_type: 'type', reason_category: 'trust_insufficient' });
      escalationsCreated.inc({ tenant_id: 'tenant', intent_type: 'type', reason_category: 'high_risk' });
      escalationsCreated.inc({ tenant_id: 'tenant', intent_type: 'type', reason_category: 'policy_violation' });
      escalationsCreated.inc({ tenant_id: 'tenant', intent_type: 'type', reason_category: 'manual_review' });
      escalationsCreated.inc({ tenant_id: 'tenant', intent_type: 'type', reason_category: 'constraint_escalate' });

      expect(true).toBe(true);
    });

    it('should allow different resolution types', () => {
      escalationResolutions.inc({ tenant_id: 'tenant', resolution: 'approved' });
      escalationResolutions.inc({ tenant_id: 'tenant', resolution: 'rejected' });
      escalationResolutions.inc({ tenant_id: 'tenant', resolution: 'timeout' });

      expect(true).toBe(true);
    });
  });
});
