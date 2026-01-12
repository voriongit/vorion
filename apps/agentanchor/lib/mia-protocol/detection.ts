/**
 * MIA Detection Service
 * Story 10-1: Detect trainer inactivity
 *
 * FR116: System detects trainer inactivity (configurable threshold, default 30 days)
 * FR117: System tracks last login, last agent update, last response time
 */

// ============================================================================
// Types
// ============================================================================

export type MiaStatus =
  | 'active'      // Normal activity
  | 'notice'      // First warning (7 days inactive)
  | 'warning'     // Second warning (14 days inactive)
  | 'critical'    // Third warning (21 days inactive)
  | 'mia';        // MIA status (30+ days inactive)

export type ActivityType =
  | 'login'           // User logged in
  | 'agent_update'    // Updated an agent
  | 'agent_create'    // Created an agent
  | 'response'        // Responded to consumer/escalation
  | 'support'         // Provided support
  | 'maintenance'     // Maintenance activity
  | 'payment'         // Financial activity
  | 'profile_update'; // Updated profile

export interface ActivityEvent {
  id: string;
  trainerId: string;
  type: ActivityType;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface TrainerActivityProfile {
  trainerId: string;

  // Activity timestamps
  lastLogin: Date | null;
  lastAgentUpdate: Date | null;
  lastResponse: Date | null;
  lastActivity: Date | null;

  // Calculated metrics
  daysSinceLastActivity: number;
  activityScore: number; // 0-100
  averageResponseTime: number; // hours

  // Status
  currentStatus: MiaStatus;
  statusChangedAt: Date;
  statusHistory: StatusChange[];

  // Agent impact
  totalAgents: number;
  activeConsumers: number;

  // Tracking
  createdAt: Date;
  updatedAt: Date;
}

export interface StatusChange {
  from: MiaStatus;
  to: MiaStatus;
  changedAt: Date;
  reason: string;
  automatic: boolean;
}

export interface MiaConfig {
  noticeDays: number;      // Default: 7
  warningDays: number;     // Default: 14
  criticalDays: number;    // Default: 21
  miaDays: number;         // Default: 30
  scanIntervalHours: number; // Default: 1
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG: MiaConfig = {
  noticeDays: 7,
  warningDays: 14,
  criticalDays: 21,
  miaDays: 30,
  scanIntervalHours: 1,
};

let config: MiaConfig = { ...DEFAULT_CONFIG };

export function setMiaConfig(newConfig: Partial<MiaConfig>): MiaConfig {
  config = { ...config, ...newConfig };
  return config;
}

export function getMiaConfig(): MiaConfig {
  return { ...config };
}

// ============================================================================
// In-Memory Storage (Production: Database)
// ============================================================================

const activityEvents = new Map<string, ActivityEvent[]>();
const trainerProfiles = new Map<string, TrainerActivityProfile>();

// ============================================================================
// Activity Recording
// ============================================================================

/**
 * Record a trainer activity event
 */
export function recordActivity(
  trainerId: string,
  type: ActivityType,
  metadata?: Record<string, unknown>
): ActivityEvent {
  const event: ActivityEvent = {
    id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    trainerId,
    type,
    timestamp: new Date(),
    metadata,
  };

  // Store event
  const events = activityEvents.get(trainerId) || [];
  events.push(event);

  // Keep only last 90 days of events
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const filtered = events.filter(e => e.timestamp > cutoff);
  activityEvents.set(trainerId, filtered);

  // Update profile
  updateTrainerProfile(trainerId);

  return event;
}

/**
 * Record login activity
 */
export function recordLogin(trainerId: string): ActivityEvent {
  return recordActivity(trainerId, 'login');
}

/**
 * Record agent update activity
 */
export function recordAgentUpdate(
  trainerId: string,
  agentId: string
): ActivityEvent {
  return recordActivity(trainerId, 'agent_update', { agentId });
}

/**
 * Record response activity
 */
export function recordResponse(
  trainerId: string,
  context: 'consumer' | 'escalation' | 'support'
): ActivityEvent {
  return recordActivity(trainerId, 'response', { context });
}

// ============================================================================
// Profile Management
// ============================================================================

/**
 * Get or create trainer profile
 */
export function getTrainerProfile(trainerId: string): TrainerActivityProfile {
  let profile = trainerProfiles.get(trainerId);

  if (!profile) {
    profile = createNewProfile(trainerId);
    trainerProfiles.set(trainerId, profile);
  }

  return profile;
}

/**
 * Create new trainer profile
 */
function createNewProfile(trainerId: string): TrainerActivityProfile {
  const now = new Date();
  return {
    trainerId,
    lastLogin: null,
    lastAgentUpdate: null,
    lastResponse: null,
    lastActivity: null,
    daysSinceLastActivity: 0,
    activityScore: 100,
    averageResponseTime: 0,
    currentStatus: 'active',
    statusChangedAt: now,
    statusHistory: [],
    totalAgents: 0,
    activeConsumers: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Update trainer profile from activity events
 */
function updateTrainerProfile(trainerId: string): void {
  const events = activityEvents.get(trainerId) || [];
  const profile = getTrainerProfile(trainerId);

  // Find latest timestamps by type
  for (const event of events) {
    if (event.type === 'login') {
      if (!profile.lastLogin || event.timestamp > profile.lastLogin) {
        profile.lastLogin = event.timestamp;
      }
    }
    if (event.type === 'agent_update' || event.type === 'agent_create') {
      if (!profile.lastAgentUpdate || event.timestamp > profile.lastAgentUpdate) {
        profile.lastAgentUpdate = event.timestamp;
      }
    }
    if (event.type === 'response') {
      if (!profile.lastResponse || event.timestamp > profile.lastResponse) {
        profile.lastResponse = event.timestamp;
      }
    }

    // Update overall last activity
    if (!profile.lastActivity || event.timestamp > profile.lastActivity) {
      profile.lastActivity = event.timestamp;
    }
  }

  // Calculate days since last activity
  if (profile.lastActivity) {
    profile.daysSinceLastActivity = Math.floor(
      (Date.now() - profile.lastActivity.getTime()) / (24 * 60 * 60 * 1000)
    );
  }

  // Calculate activity score (0-100)
  profile.activityScore = calculateActivityScore(profile, events);

  // Update MIA status
  const newStatus = determineStatus(profile.daysSinceLastActivity);
  if (newStatus !== profile.currentStatus) {
    const statusChange: StatusChange = {
      from: profile.currentStatus,
      to: newStatus,
      changedAt: new Date(),
      reason: `${profile.daysSinceLastActivity} days inactive`,
      automatic: true,
    };
    profile.statusHistory.push(statusChange);
    profile.currentStatus = newStatus;
    profile.statusChangedAt = new Date();
  }

  profile.updatedAt = new Date();
  trainerProfiles.set(trainerId, profile);
}

/**
 * Calculate activity score based on recent activity
 */
function calculateActivityScore(
  profile: TrainerActivityProfile,
  events: ActivityEvent[]
): number {
  // Base score of 100, reduced by inactivity
  let score = 100;

  // Deduct for days inactive
  score -= profile.daysSinceLastActivity * 2;

  // Bonus for recent activity frequency (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentEvents = events.filter(e => e.timestamp > thirtyDaysAgo);
  score += Math.min(30, recentEvents.length); // Max 30 point bonus

  // Ensure 0-100 range
  return Math.max(0, Math.min(100, score));
}

/**
 * Determine MIA status based on inactive days
 */
function determineStatus(daysSinceLastActivity: number): MiaStatus {
  if (daysSinceLastActivity >= config.miaDays) return 'mia';
  if (daysSinceLastActivity >= config.criticalDays) return 'critical';
  if (daysSinceLastActivity >= config.warningDays) return 'warning';
  if (daysSinceLastActivity >= config.noticeDays) return 'notice';
  return 'active';
}

// ============================================================================
// Detection Scanning
// ============================================================================

/**
 * Scan all trainers for MIA status (run periodically)
 */
export async function runMiaDetectionScan(): Promise<{
  scanned: number;
  statusChanges: Array<{
    trainerId: string;
    from: MiaStatus;
    to: MiaStatus;
  }>;
}> {
  const statusChanges: Array<{
    trainerId: string;
    from: MiaStatus;
    to: MiaStatus;
  }> = [];

  for (const [trainerId, profile] of trainerProfiles) {
    const previousStatus = profile.currentStatus;
    updateTrainerProfile(trainerId);
    const newProfile = trainerProfiles.get(trainerId)!;

    if (newProfile.currentStatus !== previousStatus) {
      statusChanges.push({
        trainerId,
        from: previousStatus,
        to: newProfile.currentStatus,
      });
    }
  }

  return {
    scanned: trainerProfiles.size,
    statusChanges,
  };
}

/**
 * Get trainers by MIA status
 */
export function getTrainersByStatus(status: MiaStatus): TrainerActivityProfile[] {
  const result: TrainerActivityProfile[] = [];
  for (const profile of trainerProfiles.values()) {
    if (profile.currentStatus === status) {
      result.push(profile);
    }
  }
  return result.sort((a, b) => b.daysSinceLastActivity - a.daysSinceLastActivity);
}

/**
 * Get trainers approaching MIA
 */
export function getApproachingMia(
  daysThreshold: number = config.criticalDays
): TrainerActivityProfile[] {
  const result: TrainerActivityProfile[] = [];
  for (const profile of trainerProfiles.values()) {
    if (
      profile.daysSinceLastActivity >= daysThreshold &&
      profile.currentStatus !== 'mia'
    ) {
      result.push(profile);
    }
  }
  return result.sort((a, b) => b.daysSinceLastActivity - a.daysSinceLastActivity);
}

/**
 * Get MIA statistics
 */
export function getMiaStats(): {
  total: number;
  byStatus: Record<MiaStatus, number>;
  averageDaysInactive: number;
  miaRate: number;
} {
  const stats = {
    total: trainerProfiles.size,
    byStatus: {
      active: 0,
      notice: 0,
      warning: 0,
      critical: 0,
      mia: 0,
    } as Record<MiaStatus, number>,
    averageDaysInactive: 0,
    miaRate: 0,
  };

  let totalDays = 0;
  for (const profile of trainerProfiles.values()) {
    stats.byStatus[profile.currentStatus]++;
    totalDays += profile.daysSinceLastActivity;
  }

  if (stats.total > 0) {
    stats.averageDaysInactive = totalDays / stats.total;
    stats.miaRate = (stats.byStatus.mia / stats.total) * 100;
  }

  return stats;
}

// ============================================================================
// Manual Status Management
// ============================================================================

/**
 * Manually override trainer status
 */
export function setTrainerStatus(
  trainerId: string,
  status: MiaStatus,
  reason: string
): { success: boolean; error?: string } {
  const profile = trainerProfiles.get(trainerId);
  if (!profile) {
    return { success: false, error: 'Trainer not found' };
  }

  const statusChange: StatusChange = {
    from: profile.currentStatus,
    to: status,
    changedAt: new Date(),
    reason,
    automatic: false,
  };

  profile.statusHistory.push(statusChange);
  profile.currentStatus = status;
  profile.statusChangedAt = new Date();
  profile.updatedAt = new Date();

  trainerProfiles.set(trainerId, profile);
  return { success: true };
}

/**
 * Mark trainer as returned (reactivate from MIA)
 */
export function markTrainerReturned(
  trainerId: string
): { success: boolean; error?: string } {
  // Record a login event
  recordLogin(trainerId);

  // Reset status to active
  return setTrainerStatus(trainerId, 'active', 'Trainer returned and logged in');
}

// ============================================================================
// Clear Data (Testing)
// ============================================================================

export function clearMiaData(): void {
  activityEvents.clear();
  trainerProfiles.clear();
}
