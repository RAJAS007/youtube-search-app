import { getUser, saveUser, getIP, CONFIG } from '../user/state.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const ip = getIP(req);
    const user = await getUser(ip);

    if (!user.adStartTime) {
        return res.status(400).json({ error: 'Ad not started', success: false });
    }

    const elapsed = Date.now() - user.adStartTime;

    if (elapsed < CONFIG.adDuration) {
        const remaining = Math.ceil((CONFIG.adDuration - elapsed) / 1000);
        return res.status(400).json({
            error: `Wait ${remaining} more seconds`,
            success: false,
            remaining
        });
    }

    // Reward the user
    user.points += CONFIG.ptsPerAd;
    user.adStartTime = null;
    await saveUser(ip, user);

    res.status(200).json({
        success: true,
        points: user.points,
        earned: CONFIG.ptsPerAd
    });
}
