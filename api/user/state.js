import { Redis } from '@upstash/redis';

// Initialize Upstash Redis (set these in Vercel Environment Variables)
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const CONFIG = {
    dailyFreeLimit: 5,
    ptsPerAd: 40,
    ptsPerDownload: 4,
    unlockCost: 100,
    unlockBonus: 5,
    adDuration: 15000
};

// Get user key from IP
function getUserKey(ip) {
    return `user:${ip}`;
}

// Get or create user
async function getUser(ip) {
    const key = getUserKey(ip);
    const today = new Date().toDateString();

    let user = await redis.get(key);

    if (!user || user.date !== today) {
        user = {
            points: user?.points || 0,
            count: 0,
            limit: CONFIG.dailyFreeLimit,
            date: today,
            adStartTime: null,
            streak: user?.streak || 1
        };
        await redis.set(key, user, { ex: 86400 * 7 }); // 7 day expiry
    }

    return user;
}

// Save user
async function saveUser(ip, user) {
    await redis.set(getUserKey(ip), user, { ex: 86400 * 7 });
}

// Get IP from request
function getIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.headers['x-real-ip'] ||
        'unknown';
}

export default async function handler(req, res) {
    const ip = getIP(req);
    const user = await getUser(ip);

    res.status(200).json({
        points: user.points,
        count: user.count,
        limit: user.limit,
        remaining: Math.max(0, user.limit - user.count),
        streak: user.streak
    });
}

export { getUser, saveUser, getIP, CONFIG, redis };
