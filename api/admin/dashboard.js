const ADMIN_PASSWORD = 'Rajas';

export default async function handler(req, res) {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { password } = req.body || {};

        if (password !== ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Return mock data for now (Redis not configured yet)
        // Once you add Upstash env vars, this will show real data
        res.status(200).json({
            success: true,
            timestamp: new Date().toISOString(),
            users: {
                totalUsers: 0,
                activeToday: 0,
                totalPoints: 0,
                totalDownloads: 0
            },
            recentUsers: [],
            message: 'Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to Vercel env vars for real data'
        });

    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: 'Failed to fetch stats: ' + error.message });
    }
}
