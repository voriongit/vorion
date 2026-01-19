import { getChatMessages, saveChatMessage, initStorage } from './lib/storage.js';

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    await initStorage();

    try {
        if (req.method === 'GET') {
            const { channelId } = req.query;
            const messages = await getChatMessages(channelId || null);
            return res.status(200).json(messages || []);
        }

        if (req.method === 'POST') {
            const { message } = req.body;

            if (!message || !message.content || !message.senderId) {
                return res.status(400).json({ error: 'Invalid message data' });
            }

            const newMessage = {
                ...message,
                id: message.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp: new Date().toISOString()
            };

            await saveChatMessage(newMessage);
            return res.status(201).json(newMessage);
        }
    } catch (error) {
        console.error('Chat API Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
