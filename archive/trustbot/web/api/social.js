/**
 * Vercel Serverless API - Social Media Endpoint
 * Category: SOCIAL
 */

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Mock social feed
    const feed = [
        { platform: 'Twitter', user: '@TrustBot', content: 'System operating at 99% efficiency.', likes: 42 },
        { platform: 'LinkedIn', user: 'TrustBot System', content: 'New quarterly report generated.', likes: 15 }
    ];

    return res.status(200).json({ success: true, feed });
}
