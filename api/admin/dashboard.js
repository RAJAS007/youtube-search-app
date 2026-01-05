import { redis } from '../user/state.js';

const ADMIN_PASSWORD = 'Rajas';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { password } = req.body;

    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // Get all keys from Redis
        const keys = await redis.keys('user:*');

        let totalUsers = keys.length;
        let totalPoints = 0;
        let totalDownloads = 0;
        let activeToday = 0;
        const today = new Date().toDateString();
        const recentUsers = [];

        for (const key of keys.slice(-20)) {
            const user = await redis.get(key);
            if (user) {
                totalPoints += user.points || 0;
                totalDownloads += user.count || 0;
                if (user.date === today) activeToday++;
                recentUsers.push({
                    ip: key.replace('user:', '').substring(0, 8) + '***',
                    points: user.points,
                    downloads: user.count,
                    limit: user.limit,
                    date: user.date
                });
            }
        }

        res.status(200).json({
            success: true,
            timestamp: new Date().toISOString(),
            users: {
                totalUsers,
                activeToday,
                totalPoints,
                totalDownloads
            },
            recentUsers
        });

    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
}
