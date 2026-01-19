/**
 * Vercel Serverless API - HITL Control Endpoint
 */

let hitlLevel = 100;

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

    const { level } = req.body || {};

    if (typeof level === 'number' && level >= 0 && level <= 100) {
        hitlLevel = level;
        return res.status(200).json({ success: true, hitlLevel: level });
    }

    return res.status(400).json({ error: 'Invalid level' });
}
