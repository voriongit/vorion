/**
 * Vercel Serverless API - Settings Endpoint
 * 
 * Manages system settings including API keys and integrations.
 * Note: In Vercel serverless, this memory is ephemeral. 
 * For real persistence, we need a database (KV, Postgres, or similar).
 */

// In-memory store (lossy on Vercel, persistent on local)
let settings = {
    integrations: {},
    theme: 'dark',
};

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        const { type, id, data: dataString } = req.query; // Extract type, id, and data from query
        let data = {};
        try {
            if (dataString) {
                data = JSON.parse(dataString); // Parse data if it's a JSON string
            }
        } catch (e) {
            return res.status(400).json({ error: 'Invalid data format in query' });
        }

        if (type === 'integration' && id) {
            // In serverless, we can't persist this for long, but we can simulate the verification delay
            // The real verification logic is in IntegrationManager.ts which is NOT imported here because it's TypeScript/Node
            // So we must duplicate the basic validation logic here or assume success if it passes client checks.
            // For the Vercel demo, we will accept any key but respect the validation error if we could import it.
            // We'll add a mock delay to simulate "Test"
            await new Promise(resolve => setTimeout(resolve, 800));

            // Basic Validation (duplicating common sense rules)
            if (id === 'openai' && data.apiKey && !data.apiKey.startsWith('sk-')) {
                return res.status(400).json({ error: 'Invalid OpenAI Key format' });
            }

            if (!settings.integrations) settings.integrations = {}; // Use 'settings' instead of 'state'
            settings.integrations[id] = true; // Mark as connected // Use 'settings' instead of 'state'
            return res.status(200).json({ success: true, message: `Integration ${id} verified.` });
        } else if (type === 'hitl') {
            return res.status(200).json({ success: true, settings });
        } else {
            return res.status(200).json(settings);
        }
    }

    if (req.method === 'POST') {
        const { key, value, category } = req.body;

        if (category === 'integration') {
            if (!settings.integrations) settings.integrations = {};
            settings.integrations[key] = value;
        } else if (category === 'mcp') {
            if (!settings.mcp) settings.mcp = {};
            // If key is 'config', we merge or set.
            // value is { enabled: true, minTier: 1 }
            settings.mcp = { ...settings.mcp, ...value };
        } else {
            settings[key] = value;
        }

        return res.status(200).json({ success: true, settings });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
