/**
 * Phase 6 Incident Response Runbooks
 *
 * Standardized procedures for handling operational incidents
 */

// =============================================================================
// Types
// =============================================================================

export interface Runbook {
  id: string;
  name: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: RunbookCategory;
  tags: string[];
  estimatedResolutionMinutes: number;
  steps: RunbookStep[];
  escalation: EscalationPolicy;
  relatedRunbooks?: string[];
  lastUpdated: Date;
  owner: string;
}

export type RunbookCategory =
  | 'availability'
  | 'performance'
  | 'security'
  | 'data'
  | 'infrastructure'
  | 'integration';

export interface RunbookStep {
  order: number;
  title: string;
  description: string;
  type: 'manual' | 'automated' | 'decision';
  commands?: string[];
  checkpoints?: string[];
  rollback?: string;
  timeoutMinutes?: number;
  onFailure?: 'continue' | 'escalate' | 'abort';
}

export interface EscalationPolicy {
  levels: EscalationLevel[];
  autoEscalateMinutes: number;
}

export interface EscalationLevel {
  level: number;
  name: string;
  contacts: string[];
  notificationChannels: ('slack' | 'pagerduty' | 'email' | 'sms')[];
}

export interface IncidentTimeline {
  timestamp: Date;
  action: string;
  actor: string;
  details?: string;
}

export interface Incident {
  id: string;
  runbookId: string;
  severity: Runbook['severity'];
  status: 'detected' | 'acknowledged' | 'investigating' | 'mitigating' | 'resolved' | 'postmortem';
  title: string;
  description: string;
  detectedAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  commander?: string;
  timeline: IncidentTimeline[];
  affectedSystems: string[];
  customerImpact: string;
  rootCause?: string;
  resolution?: string;
}

// =============================================================================
// Phase 6 Runbooks
// =============================================================================

export const PHASE6_RUNBOOKS: Runbook[] = [
  // =========================================================================
  // Critical Severity
  // =========================================================================
  {
    id: 'RB-001',
    name: 'Complete Service Outage',
    description: 'Trust Engine API is completely unavailable',
    severity: 'critical',
    category: 'availability',
    tags: ['outage', 'api', 'critical'],
    estimatedResolutionMinutes: 30,
    owner: 'platform-team',
    lastUpdated: new Date('2024-01-15'),
    escalation: {
      autoEscalateMinutes: 5,
      levels: [
        { level: 1, name: 'On-Call Engineer', contacts: ['oncall@example.com'], notificationChannels: ['pagerduty', 'slack'] },
        { level: 2, name: 'Platform Lead', contacts: ['platform-lead@example.com'], notificationChannels: ['pagerduty', 'sms'] },
        { level: 3, name: 'VP Engineering', contacts: ['vp-eng@example.com'], notificationChannels: ['sms', 'email'] },
      ],
    },
    steps: [
      {
        order: 1,
        title: 'Acknowledge Incident',
        description: 'Acknowledge the alert and join the incident channel',
        type: 'manual',
        checkpoints: ['Alert acknowledged in PagerDuty', 'Joined #incident-response channel'],
        timeoutMinutes: 2,
      },
      {
        order: 2,
        title: 'Verify Outage Scope',
        description: 'Confirm the outage and identify affected endpoints',
        type: 'automated',
        commands: [
          'curl -I https://api.example.com/health',
          'kubectl get pods -n phase6 -o wide',
          'kubectl logs -n phase6 -l app=trust-engine --tail=100',
        ],
        checkpoints: ['Health endpoint status confirmed', 'Pod status documented'],
        timeoutMinutes: 5,
      },
      {
        order: 3,
        title: 'Check Infrastructure Health',
        description: 'Verify database, cache, and dependent services',
        type: 'automated',
        commands: [
          'kubectl exec -n phase6 deploy/trust-engine -- nc -zv postgres.db 5432',
          'kubectl exec -n phase6 deploy/trust-engine -- redis-cli -h redis.cache ping',
          'kubectl get events -n phase6 --sort-by=.lastTimestamp | tail -20',
        ],
        onFailure: 'escalate',
      },
      {
        order: 4,
        title: 'Attempt Pod Restart',
        description: 'If pods are unhealthy, attempt rolling restart',
        type: 'decision',
        commands: [
          'kubectl rollout restart deployment/trust-engine -n phase6',
          'kubectl rollout status deployment/trust-engine -n phase6 --timeout=5m',
        ],
        rollback: 'kubectl rollout undo deployment/trust-engine -n phase6',
        timeoutMinutes: 10,
      },
      {
        order: 5,
        title: 'Check Recent Deployments',
        description: 'Review if a recent deployment caused the outage',
        type: 'manual',
        commands: [
          'kubectl rollout history deployment/trust-engine -n phase6',
          'git log --oneline -10 origin/main',
        ],
        checkpoints: ['Recent deployments identified', 'Potential culprit commit identified'],
      },
      {
        order: 6,
        title: 'Rollback if Needed',
        description: 'Rollback to last known good version if deployment related',
        type: 'decision',
        commands: [
          'kubectl rollout undo deployment/trust-engine -n phase6',
          'kubectl rollout status deployment/trust-engine -n phase6 --timeout=5m',
        ],
        timeoutMinutes: 10,
      },
      {
        order: 7,
        title: 'Verify Recovery',
        description: 'Confirm service is operational',
        type: 'automated',
        commands: [
          'curl -I https://api.example.com/health',
          'curl https://api.example.com/api/phase6/role-gates -H "Authorization: Bearer $TEST_TOKEN"',
        ],
        checkpoints: ['Health endpoint returns 200', 'API endpoints functional'],
      },
      {
        order: 8,
        title: 'Update Status Page',
        description: 'Update public status page with resolution',
        type: 'manual',
        checkpoints: ['Status page updated', 'Customer notification sent if applicable'],
      },
    ],
    relatedRunbooks: ['RB-002', 'RB-003'],
  },

  {
    id: 'RB-002',
    name: 'Database Connection Failure',
    description: 'Trust Engine cannot connect to the database',
    severity: 'critical',
    category: 'data',
    tags: ['database', 'connection', 'postgres'],
    estimatedResolutionMinutes: 20,
    owner: 'platform-team',
    lastUpdated: new Date('2024-01-15'),
    escalation: {
      autoEscalateMinutes: 5,
      levels: [
        { level: 1, name: 'On-Call Engineer', contacts: ['oncall@example.com'], notificationChannels: ['pagerduty'] },
        { level: 2, name: 'DBA', contacts: ['dba@example.com'], notificationChannels: ['pagerduty', 'sms'] },
      ],
    },
    steps: [
      {
        order: 1,
        title: 'Check Database Status',
        description: 'Verify database is running and accessible',
        type: 'automated',
        commands: [
          'kubectl get pods -n database -l app=postgres',
          'kubectl exec -n database deploy/postgres -- pg_isready',
          'kubectl logs -n database deploy/postgres --tail=50',
        ],
      },
      {
        order: 2,
        title: 'Check Connection Pool',
        description: 'Verify connection pool health',
        type: 'automated',
        commands: [
          'kubectl exec -n database deploy/postgres -- psql -c "SELECT count(*) FROM pg_stat_activity;"',
          'kubectl exec -n database deploy/postgres -- psql -c "SELECT state, count(*) FROM pg_stat_activity GROUP BY state;"',
        ],
      },
      {
        order: 3,
        title: 'Kill Idle Connections',
        description: 'Terminate idle connections if pool exhausted',
        type: 'decision',
        commands: [
          'kubectl exec -n database deploy/postgres -- psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = \'idle\' AND query_start < now() - interval \'10 minutes\';"',
        ],
      },
      {
        order: 4,
        title: 'Restart Database if Needed',
        description: 'Restart database pod if unresponsive',
        type: 'decision',
        commands: [
          'kubectl rollout restart statefulset/postgres -n database',
          'kubectl rollout status statefulset/postgres -n database --timeout=5m',
        ],
        rollback: 'kubectl exec -n database deploy/postgres -- pg_ctl stop -m fast',
        timeoutMinutes: 10,
        onFailure: 'escalate',
      },
      {
        order: 5,
        title: 'Verify Application Recovery',
        description: 'Restart application pods to re-establish connections',
        type: 'automated',
        commands: [
          'kubectl rollout restart deployment/trust-engine -n phase6',
          'kubectl rollout status deployment/trust-engine -n phase6 --timeout=3m',
        ],
      },
    ],
  },

  {
    id: 'RB-003',
    name: 'Security Breach Detected',
    description: 'Potential security breach or unauthorized access',
    severity: 'critical',
    category: 'security',
    tags: ['security', 'breach', 'unauthorized-access'],
    estimatedResolutionMinutes: 60,
    owner: 'security-team',
    lastUpdated: new Date('2024-01-15'),
    escalation: {
      autoEscalateMinutes: 2,
      levels: [
        { level: 1, name: 'Security On-Call', contacts: ['security-oncall@example.com'], notificationChannels: ['pagerduty', 'slack'] },
        { level: 2, name: 'CISO', contacts: ['ciso@example.com'], notificationChannels: ['sms', 'email'] },
        { level: 3, name: 'CEO', contacts: ['ceo@example.com'], notificationChannels: ['sms'] },
      ],
    },
    steps: [
      {
        order: 1,
        title: 'Isolate Affected Systems',
        description: 'Immediately isolate potentially compromised systems',
        type: 'manual',
        commands: [
          'kubectl cordon <affected-node>',
          'kubectl scale deployment/trust-engine -n phase6 --replicas=0',
        ],
        checkpoints: ['Systems isolated', 'Traffic blocked'],
        timeoutMinutes: 5,
      },
      {
        order: 2,
        title: 'Preserve Evidence',
        description: 'Capture logs and system state for forensics',
        type: 'automated',
        commands: [
          'kubectl logs -n phase6 deploy/trust-engine --all-containers --since=1h > /tmp/incident-logs.txt',
          'kubectl get events -n phase6 --sort-by=.lastTimestamp > /tmp/incident-events.txt',
          'aws s3 cp /tmp/incident-* s3://security-forensics/$(date +%Y%m%d-%H%M)/',
        ],
        checkpoints: ['Logs preserved', 'Evidence stored securely'],
      },
      {
        order: 3,
        title: 'Identify Attack Vector',
        description: 'Analyze logs to identify how breach occurred',
        type: 'manual',
        checkpoints: ['Attack vector identified', 'Scope of breach determined'],
      },
      {
        order: 4,
        title: 'Revoke Compromised Credentials',
        description: 'Revoke any compromised API keys, tokens, or credentials',
        type: 'manual',
        commands: [
          '# Revoke all API keys for affected organization',
          'curl -X POST https://api.example.com/admin/orgs/{orgId}/revoke-keys',
          '# Rotate JWT signing keys if needed',
          'kubectl create secret generic jwt-secret -n phase6 --from-literal=key=$(openssl rand -base64 32) --dry-run=client -o yaml | kubectl apply -f -',
        ],
        checkpoints: ['Compromised credentials revoked', 'New credentials issued if needed'],
      },
      {
        order: 5,
        title: 'Patch Vulnerability',
        description: 'Apply security patch or configuration fix',
        type: 'manual',
        checkpoints: ['Vulnerability patched', 'Fix verified'],
      },
      {
        order: 6,
        title: 'Restore Service',
        description: 'Gradually restore service after remediation',
        type: 'decision',
        commands: [
          'kubectl scale deployment/trust-engine -n phase6 --replicas=3',
          'kubectl uncordon <affected-node>',
        ],
      },
      {
        order: 7,
        title: 'Notify Stakeholders',
        description: 'Notify legal, compliance, and affected customers',
        type: 'manual',
        checkpoints: ['Legal notified', 'Compliance notified', 'Affected customers notified'],
      },
    ],
  },

  // =========================================================================
  // High Severity
  // =========================================================================
  {
    id: 'RB-004',
    name: 'High Latency Alert',
    description: 'API response times exceeding SLO thresholds',
    severity: 'high',
    category: 'performance',
    tags: ['latency', 'performance', 'slo'],
    estimatedResolutionMinutes: 30,
    owner: 'platform-team',
    lastUpdated: new Date('2024-01-15'),
    escalation: {
      autoEscalateMinutes: 15,
      levels: [
        { level: 1, name: 'On-Call Engineer', contacts: ['oncall@example.com'], notificationChannels: ['slack', 'pagerduty'] },
        { level: 2, name: 'Platform Lead', contacts: ['platform-lead@example.com'], notificationChannels: ['pagerduty'] },
      ],
    },
    steps: [
      {
        order: 1,
        title: 'Identify Slow Endpoints',
        description: 'Determine which endpoints are experiencing high latency',
        type: 'automated',
        commands: [
          'curl -s https://api.example.com/metrics | grep http_request_duration',
          'kubectl top pods -n phase6',
        ],
      },
      {
        order: 2,
        title: 'Check Resource Utilization',
        description: 'Verify CPU, memory, and network utilization',
        type: 'automated',
        commands: [
          'kubectl top nodes',
          'kubectl describe hpa -n phase6',
        ],
      },
      {
        order: 3,
        title: 'Check Database Performance',
        description: 'Look for slow queries or database issues',
        type: 'automated',
        commands: [
          'kubectl exec -n database deploy/postgres -- psql -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE state = \'active\' ORDER BY duration DESC LIMIT 10;"',
        ],
      },
      {
        order: 4,
        title: 'Scale if Needed',
        description: 'Scale up pods if traffic is higher than normal',
        type: 'decision',
        commands: [
          'kubectl scale deployment/trust-engine -n phase6 --replicas=5',
          'kubectl rollout status deployment/trust-engine -n phase6 --timeout=3m',
        ],
      },
      {
        order: 5,
        title: 'Enable Caching if Needed',
        description: 'Enable or increase caching for hot paths',
        type: 'decision',
        commands: [
          'kubectl set env deployment/trust-engine -n phase6 CACHE_TTL=300',
        ],
      },
    ],
  },

  {
    id: 'RB-005',
    name: 'Role Gate Evaluation Failures',
    description: 'Role gate evaluations returning errors',
    severity: 'high',
    category: 'availability',
    tags: ['role-gates', 'evaluation', 'errors'],
    estimatedResolutionMinutes: 20,
    owner: 'trust-engine-team',
    lastUpdated: new Date('2024-01-15'),
    escalation: {
      autoEscalateMinutes: 10,
      levels: [
        { level: 1, name: 'On-Call Engineer', contacts: ['oncall@example.com'], notificationChannels: ['slack'] },
      ],
    },
    steps: [
      {
        order: 1,
        title: 'Check Error Logs',
        description: 'Analyze error logs for role gate evaluation failures',
        type: 'automated',
        commands: [
          'kubectl logs -n phase6 deploy/trust-engine --tail=200 | grep -i "role.*gate\\|evaluation"',
        ],
      },
      {
        order: 2,
        title: 'Verify Gate Configurations',
        description: 'Check if gate configurations are valid',
        type: 'automated',
        commands: [
          'curl https://api.example.com/api/phase6/role-gates -H "Authorization: Bearer $TOKEN" | jq .',
        ],
      },
      {
        order: 3,
        title: 'Check Feature Flags',
        description: 'Verify feature flags are correctly set',
        type: 'manual',
        checkpoints: ['Feature flags verified', 'No recent flag changes'],
      },
      {
        order: 4,
        title: 'Test Gate Evaluation',
        description: 'Manually test gate evaluation endpoint',
        type: 'automated',
        commands: [
          'curl -X POST https://api.example.com/api/phase6/role-gates/evaluate -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d \'{"gateId": "test-gate", "context": {"trustScore": 80}}\'',
        ],
      },
    ],
  },

  {
    id: 'RB-006',
    name: 'Provenance Verification Failures',
    description: 'Provenance records failing signature verification',
    severity: 'high',
    category: 'security',
    tags: ['provenance', 'signature', 'verification'],
    estimatedResolutionMinutes: 30,
    owner: 'security-team',
    lastUpdated: new Date('2024-01-15'),
    escalation: {
      autoEscalateMinutes: 10,
      levels: [
        { level: 1, name: 'Security On-Call', contacts: ['security-oncall@example.com'], notificationChannels: ['slack', 'pagerduty'] },
      ],
    },
    steps: [
      {
        order: 1,
        title: 'Identify Failing Records',
        description: 'Get list of records failing verification',
        type: 'automated',
        commands: [
          'kubectl logs -n phase6 deploy/trust-engine --tail=500 | grep "signature.*invalid\\|verification.*failed"',
        ],
      },
      {
        order: 2,
        title: 'Check Signing Key Status',
        description: 'Verify signing keys are valid and accessible',
        type: 'automated',
        commands: [
          'kubectl get secret provenance-signing-key -n phase6 -o yaml',
          'kubectl exec -n phase6 deploy/trust-engine -- cat /keys/provenance-key.pub | head -5',
        ],
      },
      {
        order: 3,
        title: 'Check Key Rotation',
        description: 'Verify if a recent key rotation caused issues',
        type: 'manual',
        checkpoints: ['Key rotation history reviewed', 'No mismatched keys found'],
      },
      {
        order: 4,
        title: 'Verify Specific Record',
        description: 'Manually verify a failing record',
        type: 'automated',
        commands: [
          'curl -X POST https://api.example.com/api/phase6/provenance/verify -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d \'{"id": "<record-id>"}\'',
        ],
      },
    ],
  },

  // =========================================================================
  // Medium Severity
  // =========================================================================
  {
    id: 'RB-007',
    name: 'Cache Miss Rate High',
    description: 'Cache hit rate below threshold causing increased latency',
    severity: 'medium',
    category: 'performance',
    tags: ['cache', 'redis', 'performance'],
    estimatedResolutionMinutes: 20,
    owner: 'platform-team',
    lastUpdated: new Date('2024-01-15'),
    escalation: {
      autoEscalateMinutes: 30,
      levels: [
        { level: 1, name: 'On-Call Engineer', contacts: ['oncall@example.com'], notificationChannels: ['slack'] },
      ],
    },
    steps: [
      {
        order: 1,
        title: 'Check Redis Status',
        description: 'Verify Redis is running and healthy',
        type: 'automated',
        commands: [
          'kubectl get pods -n cache -l app=redis',
          'kubectl exec -n cache deploy/redis -- redis-cli info | grep -E "connected_clients|used_memory|keyspace"',
        ],
      },
      {
        order: 2,
        title: 'Analyze Cache Stats',
        description: 'Review cache hit/miss statistics',
        type: 'automated',
        commands: [
          'kubectl exec -n cache deploy/redis -- redis-cli info stats | grep -E "keyspace_hits|keyspace_misses"',
        ],
      },
      {
        order: 3,
        title: 'Check Memory Pressure',
        description: 'Verify Redis has sufficient memory',
        type: 'automated',
        commands: [
          'kubectl exec -n cache deploy/redis -- redis-cli info memory',
        ],
      },
      {
        order: 4,
        title: 'Flush Cache if Needed',
        description: 'Clear cache if corrupted or stale',
        type: 'decision',
        commands: [
          'kubectl exec -n cache deploy/redis -- redis-cli FLUSHDB',
        ],
        rollback: 'Cache will be repopulated automatically',
      },
    ],
  },

  {
    id: 'RB-008',
    name: 'Certificate Expiration Warning',
    description: 'TLS certificate approaching expiration',
    severity: 'medium',
    category: 'infrastructure',
    tags: ['certificate', 'tls', 'expiration'],
    estimatedResolutionMinutes: 15,
    owner: 'platform-team',
    lastUpdated: new Date('2024-01-15'),
    escalation: {
      autoEscalateMinutes: 60,
      levels: [
        { level: 1, name: 'On-Call Engineer', contacts: ['oncall@example.com'], notificationChannels: ['slack'] },
      ],
    },
    steps: [
      {
        order: 1,
        title: 'Check Certificate Expiration',
        description: 'Verify current certificate expiration date',
        type: 'automated',
        commands: [
          'echo | openssl s_client -servername api.example.com -connect api.example.com:443 2>/dev/null | openssl x509 -noout -dates',
        ],
      },
      {
        order: 2,
        title: 'Verify Cert-Manager Status',
        description: 'Check if cert-manager is configured for auto-renewal',
        type: 'automated',
        commands: [
          'kubectl get certificate -n phase6 -o wide',
          'kubectl describe certificate -n phase6',
        ],
      },
      {
        order: 3,
        title: 'Trigger Manual Renewal',
        description: 'Force certificate renewal if auto-renewal failed',
        type: 'decision',
        commands: [
          'kubectl delete secret tls-secret -n phase6',
          'kubectl annotate certificate phase6-tls -n phase6 cert-manager.io/force-renew=$(date +%s)',
        ],
      },
    ],
  },

  // =========================================================================
  // Low Severity
  // =========================================================================
  {
    id: 'RB-009',
    name: 'Disk Space Warning',
    description: 'Disk usage approaching threshold',
    severity: 'low',
    category: 'infrastructure',
    tags: ['disk', 'storage', 'capacity'],
    estimatedResolutionMinutes: 30,
    owner: 'platform-team',
    lastUpdated: new Date('2024-01-15'),
    escalation: {
      autoEscalateMinutes: 120,
      levels: [
        { level: 1, name: 'On-Call Engineer', contacts: ['oncall@example.com'], notificationChannels: ['slack'] },
      ],
    },
    steps: [
      {
        order: 1,
        title: 'Check Disk Usage',
        description: 'Identify filesystems with high usage',
        type: 'automated',
        commands: [
          'kubectl exec -n phase6 deploy/trust-engine -- df -h',
        ],
      },
      {
        order: 2,
        title: 'Identify Large Files',
        description: 'Find largest files consuming space',
        type: 'automated',
        commands: [
          'kubectl exec -n phase6 deploy/trust-engine -- du -sh /var/log/* | sort -rh | head -10',
        ],
      },
      {
        order: 3,
        title: 'Clean Up Logs',
        description: 'Remove old log files',
        type: 'decision',
        commands: [
          'kubectl exec -n phase6 deploy/trust-engine -- find /var/log -name "*.log" -mtime +7 -delete',
        ],
      },
      {
        order: 4,
        title: 'Expand Volume if Needed',
        description: 'Request volume expansion if cleanup insufficient',
        type: 'manual',
        checkpoints: ['Volume expansion requested', 'Change approved'],
      },
    ],
  },

  {
    id: 'RB-010',
    name: 'API Rate Limiting Triggered',
    description: 'Client hitting rate limits frequently',
    severity: 'low',
    category: 'integration',
    tags: ['rate-limit', 'api', 'client'],
    estimatedResolutionMinutes: 15,
    owner: 'support-team',
    lastUpdated: new Date('2024-01-15'),
    escalation: {
      autoEscalateMinutes: 60,
      levels: [
        { level: 1, name: 'Support Engineer', contacts: ['support@example.com'], notificationChannels: ['slack'] },
      ],
    },
    steps: [
      {
        order: 1,
        title: 'Identify Affected Client',
        description: 'Determine which client is hitting rate limits',
        type: 'automated',
        commands: [
          'kubectl logs -n phase6 deploy/trust-engine --tail=500 | grep "rate.*limit" | awk \'{print $NF}\' | sort | uniq -c | sort -rn',
        ],
      },
      {
        order: 2,
        title: 'Review Client Usage',
        description: 'Analyze client request patterns',
        type: 'manual',
        checkpoints: ['Request patterns documented', 'Legitimate use case confirmed'],
      },
      {
        order: 3,
        title: 'Adjust Rate Limits',
        description: 'Increase rate limits if justified',
        type: 'decision',
        commands: [
          'kubectl set env deployment/trust-engine -n phase6 RATE_LIMIT_<CLIENT>=1000',
        ],
      },
      {
        order: 4,
        title: 'Notify Client',
        description: 'Contact client about rate limiting and solutions',
        type: 'manual',
        checkpoints: ['Client contacted', 'Solution discussed'],
      },
    ],
  },
];

// =============================================================================
// Incident Manager
// =============================================================================

export class IncidentManager {
  private incidents = new Map<string, Incident>();
  private runbooks = new Map<string, Runbook>();

  constructor() {
    for (const runbook of PHASE6_RUNBOOKS) {
      this.runbooks.set(runbook.id, runbook);
    }
  }

  /**
   * Create new incident
   */
  createIncident(params: {
    runbookId: string;
    title: string;
    description: string;
    affectedSystems: string[];
    customerImpact: string;
  }): Incident {
    const runbook = this.runbooks.get(params.runbookId);
    if (!runbook) {
      throw new Error(`Runbook not found: ${params.runbookId}`);
    }

    const incident: Incident = {
      id: `INC-${Date.now()}`,
      runbookId: params.runbookId,
      severity: runbook.severity,
      status: 'detected',
      title: params.title,
      description: params.description,
      detectedAt: new Date(),
      timeline: [{
        timestamp: new Date(),
        action: 'Incident created',
        actor: 'system',
        details: `Runbook: ${runbook.name}`,
      }],
      affectedSystems: params.affectedSystems,
      customerImpact: params.customerImpact,
    };

    this.incidents.set(incident.id, incident);
    return incident;
  }

  /**
   * Acknowledge incident
   */
  acknowledgeIncident(incidentId: string, commander: string): void {
    const incident = this.incidents.get(incidentId);
    if (!incident) throw new Error(`Incident not found: ${incidentId}`);

    incident.status = 'acknowledged';
    incident.acknowledgedAt = new Date();
    incident.commander = commander;
    incident.timeline.push({
      timestamp: new Date(),
      action: 'Incident acknowledged',
      actor: commander,
    });
  }

  /**
   * Update incident status
   */
  updateStatus(incidentId: string, status: Incident['status'], actor: string, details?: string): void {
    const incident = this.incidents.get(incidentId);
    if (!incident) throw new Error(`Incident not found: ${incidentId}`);

    incident.status = status;
    if (status === 'resolved') {
      incident.resolvedAt = new Date();
    }

    incident.timeline.push({
      timestamp: new Date(),
      action: `Status changed to ${status}`,
      actor,
      details,
    });
  }

  /**
   * Add timeline entry
   */
  addTimelineEntry(incidentId: string, action: string, actor: string, details?: string): void {
    const incident = this.incidents.get(incidentId);
    if (!incident) throw new Error(`Incident not found: ${incidentId}`);

    incident.timeline.push({
      timestamp: new Date(),
      action,
      actor,
      details,
    });
  }

  /**
   * Set root cause
   */
  setRootCause(incidentId: string, rootCause: string): void {
    const incident = this.incidents.get(incidentId);
    if (!incident) throw new Error(`Incident not found: ${incidentId}`);
    incident.rootCause = rootCause;
  }

  /**
   * Set resolution
   */
  setResolution(incidentId: string, resolution: string): void {
    const incident = this.incidents.get(incidentId);
    if (!incident) throw new Error(`Incident not found: ${incidentId}`);
    incident.resolution = resolution;
  }

  /**
   * Get incident
   */
  getIncident(incidentId: string): Incident | undefined {
    return this.incidents.get(incidentId);
  }

  /**
   * Get active incidents
   */
  getActiveIncidents(): Incident[] {
    return Array.from(this.incidents.values())
      .filter((i) => i.status !== 'resolved' && i.status !== 'postmortem');
  }

  /**
   * Get runbook
   */
  getRunbook(runbookId: string): Runbook | undefined {
    return this.runbooks.get(runbookId);
  }

  /**
   * Get runbooks by severity
   */
  getRunbooksBySeverity(severity: Runbook['severity']): Runbook[] {
    return Array.from(this.runbooks.values())
      .filter((r) => r.severity === severity);
  }

  /**
   * Get runbooks by category
   */
  getRunbooksByCategory(category: RunbookCategory): Runbook[] {
    return Array.from(this.runbooks.values())
      .filter((r) => r.category === category);
  }

  /**
   * Search runbooks
   */
  searchRunbooks(query: string): Runbook[] {
    const lower = query.toLowerCase();
    return Array.from(this.runbooks.values())
      .filter((r) =>
        r.name.toLowerCase().includes(lower) ||
        r.description.toLowerCase().includes(lower) ||
        r.tags.some((t) => t.toLowerCase().includes(lower))
      );
  }

  /**
   * Generate postmortem template
   */
  generatePostmortemTemplate(incidentId: string): string {
    const incident = this.incidents.get(incidentId);
    if (!incident) throw new Error(`Incident not found: ${incidentId}`);

    const runbook = this.runbooks.get(incident.runbookId);
    const duration = incident.resolvedAt
      ? Math.round((incident.resolvedAt.getTime() - incident.detectedAt.getTime()) / 60000)
      : 'Ongoing';

    return `# Incident Postmortem: ${incident.id}

## Summary
**Title:** ${incident.title}
**Severity:** ${incident.severity}
**Duration:** ${duration} minutes
**Incident Commander:** ${incident.commander || 'N/A'}

## Timeline
| Time | Action | Actor | Details |
|------|--------|-------|---------|
${incident.timeline.map((t) =>
  `| ${t.timestamp.toISOString()} | ${t.action} | ${t.actor} | ${t.details || ''} |`
).join('\n')}

## Impact
**Affected Systems:** ${incident.affectedSystems.join(', ')}
**Customer Impact:** ${incident.customerImpact}

## Root Cause
${incident.rootCause || '_To be determined_'}

## Resolution
${incident.resolution || '_To be documented_'}

## Lessons Learned
1. _What went well?_
2. _What could be improved?_
3. _Where did we get lucky?_

## Action Items
| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| | | | |

## Related Runbook
**Runbook:** ${runbook?.name || 'N/A'} (${incident.runbookId})
`;
  }
}

// =============================================================================
// Exports
// =============================================================================

export const incidentRunbooks = {
  runbooks: PHASE6_RUNBOOKS,
  manager: new IncidentManager(),
};
