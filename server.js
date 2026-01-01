const express = require('express');
const path = require('path');
const ytSearch = require('yt-search');
const cors = require('cors');
const NodeCache = require('node-cache');

const app = express();
const port = process.env.PORT || 3000;
const searchCache = new NodeCache({ stdTTL: 3600 }); // Cache searches for 1 hour

app.use(cors());
app.use(express.static(__dirname));

// --- SEARCH API (Local is faster/safer) ---
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Query required' });

    // 1. Check Cache
    const cachedKey = `search_${query.toLowerCase().trim()}`;
    const cachedResult = searchCache.get(cachedKey);
    if (cachedResult) return res.json(cachedResult);

    // 2. Perform Search
    console.log(`🔍 Searching: ${query}`);
    const result = await ytSearch(query);
    
    const optimizedVideos = result.videos.slice(0, 15).map(v => ({
      videoId: v.videoId,
      title: v.title,
      thumbnail: v.thumbnail,
      duration: v.duration,
      author: { name: v.author.name }
    }));

    const responseData = { videos: optimizedVideos };
    searchCache.set(cachedKey, responseData);
    
    res.json(responseData);

  } catch (error) {
    console.error('Search Error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Serve Frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
