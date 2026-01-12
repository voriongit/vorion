/**
 * Complaint System
 * Epic 11: User complaint filing and resolution
 *
 * Implements the Right to Redress through structured complaint handling.
 */

import type { ClientRight, ViolationSeverity, RightsViolation } from './bill-of-rights';

// ============================================================================
// Types
// ============================================================================

export type ComplaintStatus =
  | 'draft'           // User started but not submitted
  | 'submitted'       // Awaiting initial review
  | 'investigating'   // Under investigation
  | 'escalated'       // Escalated to human review
  | 'resolved'        // Resolution provided
  | 'appealed'        // User appealed decision
  | 'closed';         // Final closure

export type ComplaintCategory =
  | 'service_failure'     // Agent failed to perform
  | 'rights_violation'    // Specific rights breach
  | 'data_misuse'         // Improper data handling
  | 'financial_harm'      // Monetary loss
  | 'discrimination'      // Unfair treatment
  | 'security_breach'     // Security incident
  | 'misinformation'      // False information provided
  | 'other';              // Other issues

export type ResolutionType =
  | 'apology'            // Formal apology
  | 'correction'         // Error corrected
  | 'compensation'       // Financial compensation
  | 'agent_penalty'      // Agent trust score impact
  | 'agent_suspension'   // Agent suspended
  | 'policy_change'      // Policy updated
  | 'dismissed';         // Complaint not upheld

export interface ComplaintEvidence {
  type: 'interaction_log' | 'screenshot' | 'document' | 'transaction' | 'other';
  description: string;
  url?: string;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
}

export interface Complaint {
  id: string;
  userId: string;
  agentId?: string;

  // Classification
  category: ComplaintCategory;
  rightsViolated?: ClientRight[];
  severity: ViolationSeverity;

  // Details
  title: string;
  description: string;
  evidence: ComplaintEvidence[];
  expectedResolution?: string;

  // Status tracking
  status: ComplaintStatus;
  submittedAt?: Date;
  assignedTo?: string;
  escalatedAt?: Date;
  resolvedAt?: Date;
  closedAt?: Date;

  // Resolution
  resolution?: {
    type: ResolutionType;
    description: string;
    compensationAmount?: number;
    agentPenalty?: string;
    decidedBy: string;
    decidedAt: Date;
  };

  // SLA tracking
  slaDeadline?: Date;
  slaBreached: boolean;

  // Communication
  messages: ComplaintMessage[];

  // Audit
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplaintMessage {
  id: string;
  complaintId: string;
  authorType: 'user' | 'agent' | 'system' | 'human_reviewer';
  authorId: string;
  content: string;
  attachments?: string[];
  createdAt: Date;
}

export interface ComplaintStats {
  total: number;
  byStatus: Record<ComplaintStatus, number>;
  byCategory: Record<ComplaintCategory, number>;
  averageResolutionTime: number; // hours
  slaComplianceRate: number; // percentage
  satisfactionRate: number; // percentage
}

// ============================================================================
// SLA Configuration
// ============================================================================

const SLA_HOURS: Record<ViolationSeverity, number> = {
  minor: 72,      // 3 days
  moderate: 48,   // 2 days
  serious: 24,    // 1 day
  critical: 4,    // 4 hours
};

// ============================================================================
// In-Memory Storage (Production: Database)
// ============================================================================

const complaints = new Map<string, Complaint>();
const complaintMessages = new Map<string, ComplaintMessage[]>();

// ============================================================================
// Complaint Functions
// ============================================================================

/**
 * Create a new complaint (draft)
 */
export function createComplaint(
  userId: string,
  category: ComplaintCategory,
  title: string,
  description: string,
  options?: {
    agentId?: string;
    rightsViolated?: ClientRight[];
    severity?: ViolationSeverity;
    evidence?: ComplaintEvidence[];
    expectedResolution?: string;
  }
): Complaint {
  const id = `complaint-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const complaint: Complaint = {
    id,
    userId,
    agentId: options?.agentId,
    category,
    rightsViolated: options?.rightsViolated,
    severity: options?.severity || 'moderate',
    title,
    description,
    evidence: options?.evidence || [],
    expectedResolution: options?.expectedResolution,
    status: 'draft',
    slaBreached: false,
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  complaints.set(id, complaint);
  complaintMessages.set(id, []);

  return complaint;
}

/**
 * Submit a complaint for review
 */
export async function submitComplaint(
  complaintId: string
): Promise<{ success: boolean; slaDeadline?: Date; error?: string }> {
  const complaint = complaints.get(complaintId);
  if (!complaint) {
    return { success: false, error: 'Complaint not found' };
  }

  if (complaint.status !== 'draft') {
    return { success: false, error: 'Complaint already submitted' };
  }

  // Validate required fields
  if (!complaint.title || !complaint.description) {
    return { success: false, error: 'Title and description required' };
  }

  // Set SLA deadline based on severity
  const slaHours = SLA_HOURS[complaint.severity];
  const slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000);

  complaint.status = 'submitted';
  complaint.submittedAt = new Date();
  complaint.slaDeadline = slaDeadline;
  complaint.updatedAt = new Date();

  complaints.set(complaintId, complaint);

  // Add system message
  addSystemMessage(complaintId, `Complaint submitted. SLA response deadline: ${slaDeadline.toISOString()}`);

  return { success: true, slaDeadline };
}

/**
 * Add evidence to a complaint
 */
export function addEvidence(
  complaintId: string,
  evidence: ComplaintEvidence
): { success: boolean; error?: string } {
  const complaint = complaints.get(complaintId);
  if (!complaint) {
    return { success: false, error: 'Complaint not found' };
  }

  if (complaint.status === 'closed' || complaint.status === 'resolved') {
    return { success: false, error: 'Cannot add evidence to closed complaint' };
  }

  complaint.evidence.push(evidence);
  complaint.updatedAt = new Date();
  complaints.set(complaintId, complaint);

  return { success: true };
}

/**
 * Add a message to complaint thread
 */
export function addMessage(
  complaintId: string,
  authorType: ComplaintMessage['authorType'],
  authorId: string,
  content: string,
  attachments?: string[]
): ComplaintMessage | null {
  const complaint = complaints.get(complaintId);
  if (!complaint) return null;

  const message: ComplaintMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    complaintId,
    authorType,
    authorId,
    content,
    attachments,
    createdAt: new Date(),
  };

  const messages = complaintMessages.get(complaintId) || [];
  messages.push(message);
  complaintMessages.set(complaintId, messages);

  complaint.messages = messages;
  complaint.updatedAt = new Date();
  complaints.set(complaintId, complaint);

  return message;
}

/**
 * Add system message
 */
function addSystemMessage(complaintId: string, content: string): void {
  addMessage(complaintId, 'system', 'system', content);
}

/**
 * Assign complaint to reviewer
 */
export function assignComplaint(
  complaintId: string,
  reviewerId: string
): { success: boolean; error?: string } {
  const complaint = complaints.get(complaintId);
  if (!complaint) {
    return { success: false, error: 'Complaint not found' };
  }

  complaint.assignedTo = reviewerId;
  complaint.status = 'investigating';
  complaint.updatedAt = new Date();

  complaints.set(complaintId, complaint);
  addSystemMessage(complaintId, `Complaint assigned to reviewer ${reviewerId}`);

  return { success: true };
}

/**
 * Escalate complaint to human review
 */
export async function escalateComplaint(
  complaintId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const complaint = complaints.get(complaintId);
  if (!complaint) {
    return { success: false, error: 'Complaint not found' };
  }

  complaint.status = 'escalated';
  complaint.escalatedAt = new Date();
  complaint.updatedAt = new Date();

  // Reduce SLA for escalated complaints
  const newSlaHours = Math.max(4, SLA_HOURS[complaint.severity] / 2);
  complaint.slaDeadline = new Date(Date.now() + newSlaHours * 60 * 60 * 1000);

  complaints.set(complaintId, complaint);
  addSystemMessage(complaintId, `Escalated to human review: ${reason}`);

  return { success: true };
}

/**
 * Resolve a complaint
 */
export async function resolveComplaint(
  complaintId: string,
  resolution: {
    type: ResolutionType;
    description: string;
    compensationAmount?: number;
    agentPenalty?: string;
    decidedBy: string;
  }
): Promise<{ success: boolean; violation?: RightsViolation; error?: string }> {
  const complaint = complaints.get(complaintId);
  if (!complaint) {
    return { success: false, error: 'Complaint not found' };
  }

  complaint.status = 'resolved';
  complaint.resolvedAt = new Date();
  complaint.resolution = {
    ...resolution,
    decidedAt: new Date(),
  };
  complaint.updatedAt = new Date();

  // Check SLA compliance
  if (complaint.slaDeadline && new Date() > complaint.slaDeadline) {
    complaint.slaBreached = true;
  }

  complaints.set(complaintId, complaint);
  addSystemMessage(complaintId, `Complaint resolved: ${resolution.type} - ${resolution.description}`);

  // Create rights violation record if applicable
  let violation: RightsViolation | undefined;
  if (resolution.type !== 'dismissed' && complaint.rightsViolated?.length) {
    violation = {
      id: `violation-${complaintId}`,
      userId: complaint.userId,
      agentId: complaint.agentId || 'unknown',
      rightViolated: complaint.rightsViolated[0],
      severity: complaint.severity,
      description: complaint.description,
      evidence: { complaintId, resolution },
      status: 'confirmed',
      reportedAt: complaint.submittedAt || complaint.createdAt,
      resolvedAt: new Date(),
      resolution: resolution.description,
      compensationOffered: resolution.compensationAmount,
      agentPenalty: resolution.agentPenalty,
    };
  }

  return { success: true, violation };
}

/**
 * Appeal a resolution
 */
export function appealResolution(
  complaintId: string,
  appealReason: string
): { success: boolean; error?: string } {
  const complaint = complaints.get(complaintId);
  if (!complaint) {
    return { success: false, error: 'Complaint not found' };
  }

  if (complaint.status !== 'resolved') {
    return { success: false, error: 'Can only appeal resolved complaints' };
  }

  complaint.status = 'appealed';
  complaint.updatedAt = new Date();

  complaints.set(complaintId, complaint);
  addMessage(complaintId, 'user', complaint.userId, `Appeal: ${appealReason}`);
  addSystemMessage(complaintId, 'Resolution appealed. Under review by senior staff.');

  return { success: true };
}

/**
 * Close a complaint
 */
export function closeComplaint(
  complaintId: string,
  closureNote?: string
): { success: boolean; error?: string } {
  const complaint = complaints.get(complaintId);
  if (!complaint) {
    return { success: false, error: 'Complaint not found' };
  }

  complaint.status = 'closed';
  complaint.closedAt = new Date();
  complaint.updatedAt = new Date();

  complaints.set(complaintId, complaint);
  if (closureNote) {
    addSystemMessage(complaintId, `Complaint closed: ${closureNote}`);
  }

  return { success: true };
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get complaint by ID
 */
export function getComplaint(complaintId: string): Complaint | null {
  return complaints.get(complaintId) || null;
}

/**
 * Get all complaints for a user
 */
export function getUserComplaints(userId: string): Complaint[] {
  const userComplaints: Complaint[] = [];
  for (const complaint of complaints.values()) {
    if (complaint.userId === userId) {
      userComplaints.push(complaint);
    }
  }
  return userComplaints.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Get all complaints against an agent
 */
export function getAgentComplaints(agentId: string): Complaint[] {
  const agentComplaints: Complaint[] = [];
  for (const complaint of complaints.values()) {
    if (complaint.agentId === agentId) {
      agentComplaints.push(complaint);
    }
  }
  return agentComplaints.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Get pending complaints (for dashboard)
 */
export function getPendingComplaints(): Complaint[] {
  const pending: Complaint[] = [];
  for (const complaint of complaints.values()) {
    if (['submitted', 'investigating', 'escalated', 'appealed'].includes(complaint.status)) {
      pending.push(complaint);
    }
  }
  return pending.sort((a, b) => {
    // Priority: escalated > appealed > submitted > investigating
    const priorityOrder: Record<string, number> = {
      escalated: 0,
      appealed: 1,
      submitted: 2,
      investigating: 3,
    };
    return (priorityOrder[a.status] || 99) - (priorityOrder[b.status] || 99);
  });
}

/**
 * Get SLA breached complaints
 */
export function getSlaBreachedComplaints(): Complaint[] {
  const breached: Complaint[] = [];
  const now = new Date();

  for (const complaint of complaints.values()) {
    if (
      complaint.slaDeadline &&
      now > complaint.slaDeadline &&
      !['resolved', 'closed'].includes(complaint.status)
    ) {
      complaint.slaBreached = true;
      breached.push(complaint);
    }
  }

  return breached;
}

/**
 * Get complaint statistics
 */
export function getComplaintStats(): ComplaintStats {
  const stats: ComplaintStats = {
    total: complaints.size,
    byStatus: {
      draft: 0,
      submitted: 0,
      investigating: 0,
      escalated: 0,
      resolved: 0,
      appealed: 0,
      closed: 0,
    },
    byCategory: {
      service_failure: 0,
      rights_violation: 0,
      data_misuse: 0,
      financial_harm: 0,
      discrimination: 0,
      security_breach: 0,
      misinformation: 0,
      other: 0,
    },
    averageResolutionTime: 0,
    slaComplianceRate: 100,
    satisfactionRate: 0,
  };

  let totalResolutionTime = 0;
  let resolvedCount = 0;
  let slaCompliantCount = 0;
  let slaApplicableCount = 0;

  for (const complaint of complaints.values()) {
    stats.byStatus[complaint.status]++;
    stats.byCategory[complaint.category]++;

    if (complaint.resolvedAt && complaint.submittedAt) {
      const resolutionTime = complaint.resolvedAt.getTime() - complaint.submittedAt.getTime();
      totalResolutionTime += resolutionTime / (1000 * 60 * 60); // Convert to hours
      resolvedCount++;

      if (complaint.slaDeadline) {
        slaApplicableCount++;
        if (!complaint.slaBreached) {
          slaCompliantCount++;
        }
      }
    }
  }

  if (resolvedCount > 0) {
    stats.averageResolutionTime = totalResolutionTime / resolvedCount;
  }

  if (slaApplicableCount > 0) {
    stats.slaComplianceRate = (slaCompliantCount / slaApplicableCount) * 100;
  }

  return stats;
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Auto-escalate overdue complaints
 */
export async function autoEscalateOverdue(): Promise<{ escalatedCount: number }> {
  const overdue = getSlaBreachedComplaints();
  let escalatedCount = 0;

  for (const complaint of overdue) {
    if (complaint.status !== 'escalated') {
      await escalateComplaint(complaint.id, 'SLA deadline exceeded - auto-escalated');
      escalatedCount++;
    }
  }

  return { escalatedCount };
}

/**
 * Clear all data (for testing)
 */
export function clearComplaintData(): void {
  complaints.clear();
  complaintMessages.clear();
}
