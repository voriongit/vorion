/**
 * Uptime API Endpoint
 * 
 * Tracks system start time and returns uptime in seconds.
 * Uses environment variable or first-access timestamp for persistence.
 */

// Store start time in memory (resets on cold start, but that's expected for serverless)
let systemStartTime = null;

export default function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const now = Date.now();

        // Initialize start time on first call
        if (!systemStartTime) {
            // Check for environment variable (set during deployment)
            const envStartTime = process.env.SYSTEM_START_TIME;
            if (envStartTime) {
                systemStartTime = parseInt(envStartTime, 10);
            } else {
                // Use current time as start (serverless cold start)
                systemStartTime = now;
            }
        }

        const uptimeMs = now - systemStartTime;
        const uptimeSeconds = Math.floor(uptimeMs / 1000);

        // Calculate breakdown
        const days = Math.floor(uptimeSeconds / 86400);
        const hours = Math.floor((uptimeSeconds % 86400) / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = uptimeSeconds % 60;

        res.status(200).json({
            uptime: uptimeSeconds,
            uptimeMs,
            startTime: systemStartTime,
            startTimeISO: new Date(systemStartTime).toISOString(),
            breakdown: {
                days,
                hours,
                minutes,
                seconds,
            },
            formatted: days > 0
                ? `${days}d ${hours}h ${minutes}m ${seconds}s`
                : `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
        });
    } catch (error) {
        console.error('Uptime API error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
