import { getUser, saveUser, getIP, CONFIG } from '../user/state.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const ip = getIP(req);
    const user = await getUser(ip);

    user.adStartTime = Date.now();
    await saveUser(ip, user);

    res.status(200).json({
        success: true,
        duration: CONFIG.adDuration / 1000
    });
}
