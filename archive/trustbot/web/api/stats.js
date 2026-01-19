/**
 * Vercel Serverless API - Stats Endpoint
 */

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    return res.status(200).json({
        hitlLevel: 100,
        avgTrust: 765,
        agentCount: 8,
        day: 1,
    });
}
