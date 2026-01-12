/**
 * MIA Ownership Transfer Service
 * Story 10-5: Temporary maintainer assignment and ownership transfer
 *
 * FR121: Platform can assign temporary maintainer for critical agents
 * FR122: After extended MIA, ownership transfer flow initiated
 */

import type { MiaStatus } from './detection';

// ============================================================================
// Types
// ============================================================================

export type TransferType =
  | 'temporary_maintenance'  // Temp maintainer assigned
  | 'permanent_transfer'     // Ownership transferred
  | 'platform_takeover'      // Platform assumes control
  | 'consumer_exit';         // Consumer opts out

export type TransferStatus =
  | 'pending'       // Awaiting confirmation
  | 'in_progress'   // Transfer underway
  | 'completed'     // Successfully transferred
  | 'cancelled'     // Cancelled by party
  | 'rejected'      // Rejected by receiving party
  | 'reverted';     // Original trainer returned

export interface MaintainerAssignment {
  id: string;
  agentId: string;
  originalTrainerId: string;
  maintainerId: string;

  // Assignment details
  type: 'temporary' | 'emergency' | 'platform';
  permissions: MaintainerPermission[];
  reason: string;

  // Status
  status: 'active' | 'ended' | 'cancelled';
  assignedAt: Date;
  expiresAt?: Date;
  endedAt?: Date;

  // Activity
  actionsPerformed: MaintainerAction[];

  // Audit
  assignedBy: string;
  truthChainRef?: string;
}

export type MaintainerPermission =
  | 'respond_to_consumers'   // Answer consumer questions
  | 'basic_maintenance'      // Basic agent updates
  | 'configuration_changes'  // Change agent config
  | 'performance_monitoring' // View metrics
  | 'emergency_pause';       // Pause agent if needed

export interface MaintainerAction {
  id: string;
  assignmentId: string;
  type: string;
  description: string;
  performedAt: Date;
}

export interface OwnershipTransfer {
  id: string;
  type: TransferType;
  agentId: string;
  agentName: string;

  // Parties
  fromTrainerId: string;
  toTrainerId?: string; // null for platform takeover
  toConsumerId?: string; // for consumer exit

  // Status
  status: TransferStatus;
  initiatedAt: Date;
  completedAt?: Date;
  cancelledAt?: Date;

  // Reason and details
  reason: string;
  miaDays?: number;
  noticePeriodDays: number;
  noticeSentAt?: Date;
  noticeAcknowledgedAt?: Date;

  // Financial
  compensationOffered?: number;
  refundIssued?: number;

  // Consumer impact
  affectedConsumers: string[];
  consumerNotifiedAt?: Date;

  // Audit
  initiatedBy: string;
  approvedBy?: string;
  truthChainRef?: string;
}

export interface TransferRequest {
  type: TransferType;
  agentId: string;
  agentName: string;
  fromTrainerId: string;
  toTrainerId?: string;
  reason: string;
  miaDays?: number;
  initiatedBy: string;
}

// ============================================================================
// Configuration
// ============================================================================

const TRANSFER_CONFIG = {
  tempMaintainerDays: 30,        // Temp maintainer expires after 30 days
  noticePeriodDays: 30,          // Notice before permanent transfer
  extendedMiaDays: 60,           // Days until ownership transfer initiated
  platformTakeoverDays: 90,      // Days until platform takeover
};

// ============================================================================
// In-Memory Storage (Production: Database)
// ============================================================================

const maintainerAssignments = new Map<string, MaintainerAssignment>();
const ownershipTransfers = new Map<string, OwnershipTransfer>();
const agentMaintainers = new Map<string, string>(); // agentId -> assignmentId

// ============================================================================
// Temporary Maintainer Assignment
// ============================================================================

/**
 * Assign temporary maintainer to agent
 */
export async function assignTemporaryMaintainer(
  agentId: string,
  originalTrainerId: string,
  maintainerId: string,
  reason: string,
  options?: {
    type?: 'temporary' | 'emergency' | 'platform';
    permissions?: MaintainerPermission[];
    durationDays?: number;
    assignedBy?: string;
  }
): Promise<MaintainerAssignment> {
  const assignment: MaintainerAssignment = {
    id: `maint-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    agentId,
    originalTrainerId,
    maintainerId,
    type: options?.type || 'temporary',
    permissions: options?.permissions || [
      'respond_to_consumers',
      'basic_maintenance',
      'performance_monitoring',
    ],
    reason,
    status: 'active',
    assignedAt: new Date(),
    expiresAt: new Date(
      Date.now() + (options?.durationDays || TRANSFER_CONFIG.tempMaintainerDays) * 24 * 60 * 60 * 1000
    ),
    actionsPerformed: [],
    assignedBy: options?.assignedBy || 'system',
  };

  maintainerAssignments.set(assignment.id, assignment);
  agentMaintainers.set(agentId, assignment.id);

  return assignment;
}

/**
 * Check if user can perform action as maintainer
 */
export function canMaintainerPerform(
  agentId: string,
  maintainerId: string,
  permission: MaintainerPermission
): boolean {
  const assignmentId = agentMaintainers.get(agentId);
  if (!assignmentId) return false;

  const assignment = maintainerAssignments.get(assignmentId);
  if (!assignment) return false;

  if (assignment.status !== 'active') return false;
  if (assignment.maintainerId !== maintainerId) return false;
  if (assignment.expiresAt && new Date() > assignment.expiresAt) return false;

  return assignment.permissions.includes(permission);
}

/**
 * Record maintainer action
 */
export function recordMaintainerAction(
  assignmentId: string,
  type: string,
  description: string
): MaintainerAction | null {
  const assignment = maintainerAssignments.get(assignmentId);
  if (!assignment || assignment.status !== 'active') return null;

  const action: MaintainerAction = {
    id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    assignmentId,
    type,
    description,
    performedAt: new Date(),
  };

  assignment.actionsPerformed.push(action);
  maintainerAssignments.set(assignmentId, assignment);

  return action;
}

/**
 * End maintainer assignment
 */
export function endMaintainerAssignment(
  assignmentId: string,
  reason: 'trainer_returned' | 'expired' | 'transferred' | 'cancelled'
): { success: boolean; error?: string } {
  const assignment = maintainerAssignments.get(assignmentId);
  if (!assignment) {
    return { success: false, error: 'Assignment not found' };
  }

  assignment.status = reason === 'cancelled' ? 'cancelled' : 'ended';
  assignment.endedAt = new Date();
  maintainerAssignments.set(assignmentId, assignment);

  agentMaintainers.delete(assignment.agentId);

  return { success: true };
}

/**
 * Get active maintainer for agent
 */
export function getAgentMaintainer(agentId: string): MaintainerAssignment | null {
  const assignmentId = agentMaintainers.get(agentId);
  if (!assignmentId) return null;

  const assignment = maintainerAssignments.get(assignmentId);
  if (!assignment || assignment.status !== 'active') return null;

  // Check expiry
  if (assignment.expiresAt && new Date() > assignment.expiresAt) {
    endMaintainerAssignment(assignmentId, 'expired');
    return null;
  }

  return assignment;
}

/**
 * Get all assignments for a maintainer
 */
export function getMaintainerAssignments(maintainerId: string): MaintainerAssignment[] {
  const result: MaintainerAssignment[] = [];
  for (const assignment of maintainerAssignments.values()) {
    if (assignment.maintainerId === maintainerId && assignment.status === 'active') {
      result.push(assignment);
    }
  }
  return result;
}

// ============================================================================
// Ownership Transfer
// ============================================================================

/**
 * Initiate ownership transfer
 */
export async function initiateOwnershipTransfer(
  request: TransferRequest
): Promise<OwnershipTransfer> {
  const transfer: OwnershipTransfer = {
    id: `transfer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: request.type,
    agentId: request.agentId,
    agentName: request.agentName,
    fromTrainerId: request.fromTrainerId,
    toTrainerId: request.toTrainerId,
    status: 'pending',
    initiatedAt: new Date(),
    reason: request.reason,
    miaDays: request.miaDays,
    noticePeriodDays: TRANSFER_CONFIG.noticePeriodDays,
    affectedConsumers: [],
    initiatedBy: request.initiatedBy,
  };

  ownershipTransfers.set(transfer.id, transfer);

  return transfer;
}

/**
 * Send transfer notice
 */
export async function sendTransferNotice(
  transferId: string,
  affectedConsumers: string[]
): Promise<{ success: boolean; error?: string }> {
  const transfer = ownershipTransfers.get(transferId);
  if (!transfer) {
    return { success: false, error: 'Transfer not found' };
  }

  transfer.affectedConsumers = affectedConsumers;
  transfer.noticeSentAt = new Date();
  transfer.status = 'in_progress';
  ownershipTransfers.set(transferId, transfer);

  // In production: trigger actual notifications via notification service

  return { success: true };
}

/**
 * Complete ownership transfer
 */
export async function completeTransfer(
  transferId: string,
  approvedBy: string,
  options?: {
    compensation?: number;
    refund?: number;
  }
): Promise<{ success: boolean; error?: string }> {
  const transfer = ownershipTransfers.get(transferId);
  if (!transfer) {
    return { success: false, error: 'Transfer not found' };
  }

  if (transfer.status !== 'in_progress' && transfer.status !== 'pending') {
    return { success: false, error: `Cannot complete transfer in ${transfer.status} status` };
  }

  transfer.status = 'completed';
  transfer.completedAt = new Date();
  transfer.approvedBy = approvedBy;
  transfer.compensationOffered = options?.compensation;
  transfer.refundIssued = options?.refund;

  ownershipTransfers.set(transferId, transfer);

  // End any active maintainer assignments
  const assignmentId = agentMaintainers.get(transfer.agentId);
  if (assignmentId) {
    endMaintainerAssignment(assignmentId, 'transferred');
  }

  return { success: true };
}

/**
 * Cancel ownership transfer (e.g., trainer returned)
 */
export async function cancelTransfer(
  transferId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const transfer = ownershipTransfers.get(transferId);
  if (!transfer) {
    return { success: false, error: 'Transfer not found' };
  }

  if (transfer.status === 'completed') {
    return { success: false, error: 'Cannot cancel completed transfer' };
  }

  transfer.status = 'cancelled';
  transfer.cancelledAt = new Date();
  transfer.reason = `${transfer.reason} | Cancelled: ${reason}`;

  ownershipTransfers.set(transferId, transfer);

  return { success: true };
}

/**
 * Revert transfer (trainer returned after completion)
 */
export async function revertTransfer(
  transferId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const transfer = ownershipTransfers.get(transferId);
  if (!transfer) {
    return { success: false, error: 'Transfer not found' };
  }

  // Only recently completed transfers can be reverted (within 30 days)
  if (transfer.status !== 'completed') {
    return { success: false, error: 'Can only revert completed transfers' };
  }

  const daysSinceComplete = transfer.completedAt
    ? Math.floor((Date.now() - transfer.completedAt.getTime()) / (24 * 60 * 60 * 1000))
    : 999;

  if (daysSinceComplete > 30) {
    return { success: false, error: 'Transfer completed more than 30 days ago' };
  }

  transfer.status = 'reverted';
  transfer.reason = `${transfer.reason} | Reverted: ${reason}`;

  ownershipTransfers.set(transferId, transfer);

  return { success: true };
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get transfer by ID
 */
export function getTransfer(transferId: string): OwnershipTransfer | null {
  return ownershipTransfers.get(transferId) || null;
}

/**
 * Get transfers for a trainer
 */
export function getTrainerTransfers(
  trainerId: string,
  direction: 'from' | 'to' | 'both' = 'both'
): OwnershipTransfer[] {
  const result: OwnershipTransfer[] = [];
  for (const transfer of ownershipTransfers.values()) {
    if (
      (direction === 'from' || direction === 'both') &&
      transfer.fromTrainerId === trainerId
    ) {
      result.push(transfer);
    } else if (
      (direction === 'to' || direction === 'both') &&
      transfer.toTrainerId === trainerId
    ) {
      result.push(transfer);
    }
  }
  return result.sort((a, b) => b.initiatedAt.getTime() - a.initiatedAt.getTime());
}

/**
 * Get transfers for an agent
 */
export function getAgentTransfers(agentId: string): OwnershipTransfer[] {
  const result: OwnershipTransfer[] = [];
  for (const transfer of ownershipTransfers.values()) {
    if (transfer.agentId === agentId) {
      result.push(transfer);
    }
  }
  return result.sort((a, b) => b.initiatedAt.getTime() - a.initiatedAt.getTime());
}

/**
 * Get pending transfers
 */
export function getPendingTransfers(): OwnershipTransfer[] {
  const result: OwnershipTransfer[] = [];
  for (const transfer of ownershipTransfers.values()) {
    if (transfer.status === 'pending' || transfer.status === 'in_progress') {
      result.push(transfer);
    }
  }
  return result;
}

// ============================================================================
// Automated Transfer Flow
// ============================================================================

/**
 * Check if agent should trigger ownership transfer
 */
export function shouldInitiateTransfer(
  miaDays: number,
  hasTempMaintainer: boolean
): { shouldTransfer: boolean; type: TransferType; reason: string } {
  if (miaDays >= TRANSFER_CONFIG.platformTakeoverDays) {
    return {
      shouldTransfer: true,
      type: 'platform_takeover',
      reason: `Trainer MIA for ${miaDays} days - platform takeover`,
    };
  }

  if (miaDays >= TRANSFER_CONFIG.extendedMiaDays && !hasTempMaintainer) {
    return {
      shouldTransfer: true,
      type: 'permanent_transfer',
      reason: `Trainer MIA for ${miaDays} days - ownership transfer initiated`,
    };
  }

  return {
    shouldTransfer: false,
    type: 'temporary_maintenance',
    reason: 'No transfer needed',
  };
}

/**
 * Process MIA trainer for potential transfers
 */
export async function processMiaTrainer(
  trainerId: string,
  miaDays: number,
  agentIds: string[]
): Promise<{
  maintainersAssigned: string[];
  transfersInitiated: string[];
}> {
  const maintainersAssigned: string[] = [];
  const transfersInitiated: string[] = [];

  for (const agentId of agentIds) {
    const existingMaintainer = getAgentMaintainer(agentId);
    const { shouldTransfer, type, reason } = shouldInitiateTransfer(
      miaDays,
      !!existingMaintainer
    );

    if (shouldTransfer) {
      // Initiate transfer
      const transfer = await initiateOwnershipTransfer({
        type,
        agentId,
        agentName: `Agent ${agentId}`,
        fromTrainerId: trainerId,
        reason,
        miaDays,
        initiatedBy: 'system',
      });
      transfersInitiated.push(transfer.id);
    } else if (!existingMaintainer && miaDays >= 30) {
      // Assign temporary maintainer (platform-managed)
      const assignment = await assignTemporaryMaintainer(
        agentId,
        trainerId,
        'platform',
        `Trainer MIA for ${miaDays} days`,
        { type: 'platform' }
      );
      maintainersAssigned.push(assignment.id);
    }
  }

  return { maintainersAssigned, transfersInitiated };
}

// ============================================================================
// Statistics
// ============================================================================

export function getTransferStats(): {
  total: number;
  byStatus: Record<TransferStatus, number>;
  byType: Record<TransferType, number>;
  activeMaintenanceAssignments: number;
  averageNoticePeriod: number;
} {
  const stats = {
    total: ownershipTransfers.size,
    byStatus: {
      pending: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
      rejected: 0,
      reverted: 0,
    } as Record<TransferStatus, number>,
    byType: {
      temporary_maintenance: 0,
      permanent_transfer: 0,
      platform_takeover: 0,
      consumer_exit: 0,
    } as Record<TransferType, number>,
    activeMaintenanceAssignments: 0,
    averageNoticePeriod: TRANSFER_CONFIG.noticePeriodDays,
  };

  for (const transfer of ownershipTransfers.values()) {
    stats.byStatus[transfer.status]++;
    stats.byType[transfer.type]++;
  }

  for (const assignment of maintainerAssignments.values()) {
    if (assignment.status === 'active') {
      stats.activeMaintenanceAssignments++;
    }
  }

  return stats;
}

// ============================================================================
// Clear Data (Testing)
// ============================================================================

export function clearTransferData(): void {
  maintainerAssignments.clear();
  ownershipTransfers.clear();
  agentMaintainers.clear();
}
