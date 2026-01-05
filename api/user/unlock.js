import { getUser, saveUser, getIP, CONFIG } from './state.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const ip = getIP(req);
    const user = await getUser(ip);

    if (user.points < CONFIG.unlockCost) {
        return res.status(400).json({
            error: 'Not enough points',
            success: false,
            required: CONFIG.unlockCost,
            current: user.points
        });
    }

    user.points -= CONFIG.unlockCost;
    user.limit += CONFIG.unlockBonus;
    await saveUser(ip, user);

    res.status(200).json({
        success: true,
        points: user.points,
        limit: user.limit,
        remaining: Math.max(0, user.limit - user.count)
    });
}
