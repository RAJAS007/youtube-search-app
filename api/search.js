import ytSearch from 'yt-search';
import { Redis } from '@upstash/redis';

// Initialize Redis (automatically uses UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN)
const redis = Redis.fromEnv();

export default async function handler(req, res) {
    try {
        const query = req.query.q?.trim();

        if (!query) {
            return res.status(400).json({ error: 'Query parameter "q" is required' });
        }

        if (query.length > 200) {
            return res.status(400).json({ error: 'Query too long (max 200 characters)' });
        }

        // Cache Key
        const CACHE_KEY = `search:${query.toLowerCase()}`;

        // 1. Check Cache
        const cachedResult = await redis.get(CACHE_KEY);
        if (cachedResult) {
            return res.status(200).json({ videos: cachedResult, cached: true });
        }

        // 2. Perform Search (if not cached)
        const searchResult = await ytSearch(query);

        const videos = (searchResult.videos || []).slice(0, 20).map(v => ({
            title: v.title,
            url: v.url,
            timestamp: v.timestamp,
            views: v.views,
            thumbnail: v.thumbnail,
            author: v.author,
            seconds: v.seconds
        }));

        // 3. Save to Cache (TTL: 2 hours)
        await redis.set(CACHE_KEY, videos, { ex: 7200 });

        res.status(200).json({ videos, cached: false });

    } catch (error) {
        console.error('Search error:', error.message);
        // Fallback: if Redis fails, just return error or maybe results?
        // Usually if Redis fails, we should just return 500 or proceed without cache.
        // For now, simple error handling.
        res.status(500).json({ error: 'Search failed. Please try again.' });
    }
}
