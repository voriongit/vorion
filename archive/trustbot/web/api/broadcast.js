/**
 * Vercel Serverless API - Broadcast Endpoint
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

    const { target, message } = req.body || {};

    if (!target || !message) {
        return res.status(400).json({ error: 'Target room and message required' });
    }

    // In a real system, this would push into the Blackboard or Agent inboxes in that room
    console.log(`[BROADCAST] To ${target}: ${message}`);

    return res.status(200).json({
        success: true,
        message: `Broadcast sent to ${target}`
    });
}
