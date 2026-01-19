/**
 * Vercel Serverless API - CRM Endpoint
 * Category: CRM
 */

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    return res.status(200).json({
        success: true,
        contacts: [
            { id: 'C-001', name: 'Acme Corp', status: 'Lead' },
            { id: 'C-002', name: 'Wayne Enterprises', status: 'Customer' }
        ]
    });
}
