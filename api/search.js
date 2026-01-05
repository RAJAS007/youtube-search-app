import ytSearch from 'yt-search';

export default async function handler(req, res) {
    try {
        const query = req.query.q?.trim();

        if (!query) {
            return res.status(400).json({ error: 'Query parameter "q" is required' });
        }

        if (query.length > 200) {
            return res.status(400).json({ error: 'Query too long (max 200 characters)' });
        }

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

        res.status(200).json({ videos, cached: false });

    } catch (error) {
        console.error('Search error:', error.message);
        res.status(500).json({ error: 'Search failed. Please try again.' });
    }
}
