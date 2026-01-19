/**
 * Leader Election Service
 *
 * Uses Redis to elect a single leader among multiple instances.
 * Only the leader runs scheduled tasks (cleanup, escalation timeouts).
 *
 * Implementation:
 * - Uses SET NX EX for atomic leader acquisition
 * - Stores instance ID as value
 * - Heartbeat extends TTL every 10s
 * - If heartbeat fails, another instance can take over
 * - On graceful shutdown, resign leadership
 */

import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { getRedis } from './redis.js';
import { createLogger } from './logger.js';
import {
  schedulerLeaderElectionsTotal,
  schedulerIsLeader,
} from '../intent/metrics.js';

const logger = createLogger({ component: 'leader-election' });

const LEADER_KEY = 'scheduler:leader';
const LEADER_TTL = 30; // seconds
const HEARTBEAT_INTERVAL = 10000; // ms (10 seconds)
const LEADER_CHECK_INTERVAL = 15000; // ms (15 seconds) - for non-leaders to try becoming leader

/**
 * Generate a unique instance ID
 * Format: hostname-pid-random
 */
function generateInstanceId(): string {
  const host = hostname();
  const pid = process.pid;
  const random = randomUUID().slice(0, 8);
  return `${host}-${pid}-${random}`;
}

export interface LeaderElection {
  /** Attempt to become the leader */
  tryBecomeLeader(): Promise<boolean>;
  /** Check if this instance is currently the leader */
  isLeader(): boolean;
  /** Start the heartbeat to maintain leadership */
  startHeartbeat(): void;
  /** Stop the heartbeat */
  stopHeartbeat(): void;
  /** Resign leadership (for graceful shutdown) */
  resign(): Promise<void>;
  /** Get the instance ID */
  getInstanceId(): string;
  /** Start periodic leader checks (for non-leaders) */
  startLeaderCheck(onBecameLeader: () => void): void;
  /** Stop periodic leader checks */
  stopLeaderCheck(): void;
}

class LeaderElectionImpl implements LeaderElection {
  private readonly instanceId: string;
  private _isLeader = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private leaderCheckTimer: ReturnType<typeof setInterval> | null = null;
  private onBecameLeaderCallback: (() => void) | null = null;

  constructor() {
    this.instanceId = generateInstanceId();
    logger.info({ instanceId: this.instanceId }, 'Leader election initialized');
  }

  getInstanceId(): string {
    return this.instanceId;
  }

  async tryBecomeLeader(): Promise<boolean> {
    try {
      const redis = getRedis();

      // Try to acquire leadership using SET NX EX (atomic)
      const result = await redis.set(
        LEADER_KEY,
        this.instanceId,
        'EX',
        LEADER_TTL,
        'NX'
      );

      if (result === 'OK') {
        // We became the leader
        if (!this._isLeader) {
          this._isLeader = true;
          schedulerLeaderElectionsTotal.inc();
          schedulerIsLeader.set(1);
          logger.info(
            { instanceId: this.instanceId },
            'Acquired scheduler leadership'
          );
        }
        return true;
      }

      // Check if we're already the leader (key exists with our ID)
      const currentLeader = await redis.get(LEADER_KEY);
      if (currentLeader === this.instanceId) {
        if (!this._isLeader) {
          this._isLeader = true;
          schedulerIsLeader.set(1);
        }
        return true;
      }

      // Another instance is the leader
      if (this._isLeader) {
        this._isLeader = false;
        schedulerIsLeader.set(0);
        logger.warn(
          { instanceId: this.instanceId, currentLeader },
          'Lost scheduler leadership'
        );
      }

      return false;
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'Failed to acquire leadership'
      );
      // On Redis failure, don't assume leadership
      if (this._isLeader) {
        this._isLeader = false;
        schedulerIsLeader.set(0);
      }
      return false;
    }
  }

  isLeader(): boolean {
    return this._isLeader;
  }

  startHeartbeat(): void {
    if (this.heartbeatTimer) {
      return; // Already running
    }

    logger.debug({ instanceId: this.instanceId }, 'Starting leader heartbeat');

    this.heartbeatTimer = setInterval(async () => {
      await this.sendHeartbeat();
    }, HEARTBEAT_INTERVAL);

    // Don't keep the process alive just for heartbeat
    this.heartbeatTimer.unref();
  }

  private async sendHeartbeat(): Promise<void> {
    if (!this._isLeader) {
      return;
    }

    try {
      const redis = getRedis();

      // Use Lua script for atomic check-and-extend
      // Only extend if we still own the key
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("expire", KEYS[1], ARGV[2])
        else
          return 0
        end
      `;

      const result = await redis.eval(script, 1, LEADER_KEY, this.instanceId, LEADER_TTL);

      if (result !== 1) {
        // We lost leadership
        this._isLeader = false;
        schedulerIsLeader.set(0);
        logger.warn(
          { instanceId: this.instanceId },
          'Lost scheduler leadership during heartbeat'
        );

        // Stop heartbeat and start checking for leadership again
        this.stopHeartbeat();
        if (this.onBecameLeaderCallback) {
          this.startLeaderCheck(this.onBecameLeaderCallback);
        }
      } else {
        logger.debug({ instanceId: this.instanceId }, 'Leader heartbeat sent');
      }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'Failed to send leader heartbeat'
      );
      // On failure, assume we lost leadership to be safe
      this._isLeader = false;
      schedulerIsLeader.set(0);
    }
  }

  stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      logger.debug({ instanceId: this.instanceId }, 'Stopped leader heartbeat');
    }
  }

  startLeaderCheck(onBecameLeader: () => void): void {
    if (this.leaderCheckTimer) {
      return; // Already running
    }

    this.onBecameLeaderCallback = onBecameLeader;

    logger.debug({ instanceId: this.instanceId }, 'Starting periodic leader check');

    this.leaderCheckTimer = setInterval(async () => {
      if (!this._isLeader) {
        const acquired = await this.tryBecomeLeader();
        if (acquired) {
          // Stop checking and start heartbeat
          this.stopLeaderCheck();
          this.startHeartbeat();
          // Notify that we became leader
          onBecameLeader();
        }
      }
    }, LEADER_CHECK_INTERVAL);

    // Don't keep the process alive just for leader check
    this.leaderCheckTimer.unref();
  }

  stopLeaderCheck(): void {
    if (this.leaderCheckTimer) {
      clearInterval(this.leaderCheckTimer);
      this.leaderCheckTimer = null;
      logger.debug({ instanceId: this.instanceId }, 'Stopped leader check');
    }
  }

  async resign(): Promise<void> {
    this.stopHeartbeat();
    this.stopLeaderCheck();

    if (!this._isLeader) {
      logger.debug({ instanceId: this.instanceId }, 'Not leader, nothing to resign');
      return;
    }

    try {
      const redis = getRedis();

      // Use Lua script for atomic check-and-delete
      // Only delete if we own the key
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      const result = await redis.eval(script, 1, LEADER_KEY, this.instanceId);

      if (result === 1) {
        logger.info({ instanceId: this.instanceId }, 'Resigned scheduler leadership');
      } else {
        logger.debug(
          { instanceId: this.instanceId },
          'Leadership already transferred or expired'
        );
      }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        'Failed to resign leadership'
      );
    } finally {
      this._isLeader = false;
      schedulerIsLeader.set(0);
    }
  }
}

// Singleton instance
let leaderElectionInstance: LeaderElection | null = null;

/**
 * Get the leader election singleton
 */
export function getLeaderElection(): LeaderElection {
  if (!leaderElectionInstance) {
    leaderElectionInstance = new LeaderElectionImpl();
  }
  return leaderElectionInstance;
}

/**
 * Reset the leader election instance (for testing)
 */
export function resetLeaderElection(): void {
  if (leaderElectionInstance) {
    leaderElectionInstance.stopHeartbeat();
    leaderElectionInstance.stopLeaderCheck();
    leaderElectionInstance = null;
  }
}
