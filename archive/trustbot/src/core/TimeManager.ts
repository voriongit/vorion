/**
 * Trust-Gated Time Service
 * 
 * Manages the heartbeat of the system (Ticks) and controls access to 
 * Wall-Clock time based on Agent Tier.
 * 
 * NOTE: This is the legacy TimeManager. For new code, use TimeService.ts
 * which provides the full trust-gated infrastructure.
 */

// Minimal agent interface for backwards compatibility
interface AgentWithTier {
    tier: number;
}

export interface TimeContext {
    tick: number;
    phase: 'PLANNING' | 'EXECUTION' | 'REVIEW' | 'IDLE';
    timestamp?: Date; // Only available to Tier 2+
    formattedEST?: string; // Only available to Tier 2+
}

export class TimeManager {
    private static instance: TimeManager;
    private tick: number = 0;
    private timer: NodeJS.Timeout | null = null;
    private readonly TICK_MS = 1000; // 1 second per tick for simulation

    // Observers
    private listeners: ((context: TimeContext) => void)[] = [];

    private constructor() { }

    static getInstance(): TimeManager {
        if (!TimeManager.instance) {
            TimeManager.instance = new TimeManager();
        }
        return TimeManager.instance;
    }

    /**
     * Start the system clock
     */
    start() {
        if (this.timer) return;
        this.timer = setInterval(() => this.onTick(), this.TICK_MS);
        console.log('[TimeManager] Clock started');
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    private onTick() {
        this.tick++;

        // Determine current phase based on EST time
        const estTime = this.getEST();
        const hour = estTime.getHours();

        let phase: TimeContext['phase'] = 'IDLE';
        if (hour >= 9 && hour < 11) phase = 'PLANNING';      // 9AM - 11AM
        else if (hour >= 11 && hour < 16) phase = 'EXECUTION'; // 11AM - 4PM
        else if (hour >= 16 && hour < 17) phase = 'REVIEW';    // 4PM - 5PM

        // Broadcast to system listeners (Internal components always get full context)
        const systemContext: TimeContext = {
            tick: this.tick,
            phase,
            timestamp: estTime,
            formattedEST: this.formatEST(estTime)
        };

        this.listeners.forEach(cb => cb(systemContext));
    }

    /**
     * Get Time Context for a specific Agent (Trust-Gated)
     */
    getContext(agent: AgentWithTier): TimeContext {
        const baseContext: TimeContext = {
            tick: this.tick,
            phase: 'IDLE' // Default
        };

        // Recalculate phase (lightweight)
        const est = this.getEST();
        const hour = est.getHours();
        if (hour >= 9 && hour < 11) baseContext.phase = 'PLANNING';
        else if (hour >= 11 && hour < 16) baseContext.phase = 'EXECUTION';
        else if (hour >= 16 && hour < 17) baseContext.phase = 'REVIEW';

        // Gating Logic
        if (agent.tier >= 2) {
            // Tier 2+ gets actual timestamps
            baseContext.timestamp = est;
            baseContext.formattedEST = this.formatEST(est);
        }

        return baseContext;
    }

    /**
     * Subscribe to ticks (For system components like T5-Planner)
     */
    subscribe(callback: (context: TimeContext) => void) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    // --- Helpers ---

    private getEST(): Date {
        // Create date object for current time
        const now = new Date();
        // Convert to EST (New York)
        // Note: Ideally use date-fns-tz or moment-timezone for robust handling
        // For partial MVP without extra deps, we use Intl
        const estString = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
        return new Date(estString);
    }

    private formatEST(date: Date): string {
        return date.toLocaleTimeString("en-US", {
            timeZone: "America/New_York",
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        }) + " EST";
    }
}

export const timeManager = TimeManager.getInstance();
