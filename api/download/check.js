import { getUser, getIP } from '../user/state.js';

export default async function handler(req, res) {
    const ip = getIP(req);
    const user = await getUser(ip);

    const canDownload = user.count < user.limit;

    res.status(200).json({
        allowed: canDownload,
        count: user.count,
        limit: user.limit,
        remaining: Math.max(0, user.limit - user.count)
    });
}
