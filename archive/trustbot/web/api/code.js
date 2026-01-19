/**
 * Vercel Serverless API - Code Execution Endpoint
 * Category: CODE
 */

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { code, language } = req.body || {};

    // Simulated execution
    return res.status(200).json({
        success: true,
        output: `Executed ${language} code successfully.\n> Result: [Mock Output]`,
        duration: '12ms'
    });
}
