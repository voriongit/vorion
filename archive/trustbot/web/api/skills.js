import { getSkills, saveSkill, initStorage } from './lib/storage.js';

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    await initStorage();

    try {
        if (req.method === 'GET') {
            const skills = await getSkills();
            return res.status(200).json(skills || []);
        }

        if (req.method === 'POST') {
            const { action, skill } = req.body;

            if (action === 'create' && skill) {
                // Basic validation
                if (!skill.name || !skill.capabilities || !Array.isArray(skill.capabilities)) {
                    return res.status(400).json({ error: 'Invalid skill data' });
                }

                // Generate ID if missing
                const newSkill = {
                    ...skill,
                    id: skill.id || `skill-${Date.now()}`,
                    tier: skill.tier || 1,
                    price: skill.price || 0
                };

                await saveSkill(newSkill);
                return res.status(201).json(newSkill);
            }

            return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
