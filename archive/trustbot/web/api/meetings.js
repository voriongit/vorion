/**
 * Vercel Serverless API - Meetings Endpoint
 */

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { room, topic, duration } = req.body || {};

    if (!room || !topic) {
        return res.status(400).json({ error: 'Room and topic required' });
    }

    // In a real system, this would register a meeting event
    console.log(`[MEETING] Scheduled in ${room}: ${topic} (${duration}m)`);

    return res.status(200).json({
        success: true,
        message: `Meeting "${topic}" scheduled in ${room}`
    });
}
