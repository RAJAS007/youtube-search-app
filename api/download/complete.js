import { getUser, saveUser, getIP, CONFIG } from '../user/state.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const ip = getIP(req);
    const user = await getUser(ip);

    if (user.count >= user.limit) {
        return res.status(403).json({ error: 'Download limit reached', success: false });
    }

    user.count++;
    user.points += CONFIG.ptsPerDownload;
    await saveUser(ip, user);

    res.status(200).json({
        success: true,
        count: user.count,
        limit: user.limit,
        remaining: Math.max(0, user.limit - user.count),
        points: user.points,
        earned: CONFIG.ptsPerDownload
    });
}
