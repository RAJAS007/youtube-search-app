const express = require('express');
const path = require('path');
const ytSearch = require('yt-search');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// Enable CORS
app.use(cors());
// Serve static files
app.use(express.static(__dirname));

// API endpoint for YouTube search
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ error: 'Search query required' });
    }
    
    console.log(`Searching YouTube for: ${query}`);
    const searchResult = await ytSearch(query);
    res.json(searchResult);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search YouTube' });
  }
});

// API endpoint for video info by ID
app.get('/api/video', async (req, res) => {
  try {
    const videoId = req.query.id;
    if (!videoId) {
      return res.status(400).json({ error: 'Video ID required' });
    }
    
    console.log(`Fetching video info for: ${videoId}`);
    
    // Try to get video info by searching
    const searchResult = await ytSearch({ videoId: videoId });
    
    if (searchResult && searchResult.title) {
      res.json(searchResult);
    } else {
      // Fallback: Search and filter
      const searchResult = await ytSearch(videoId);
      if (searchResult.videos && searchResult.videos.length > 0) {
        const video = searchResult.videos.find(v => v.videoId === videoId) || searchResult.videos[0];
        res.json(video);
      } else {
        res.status(404).json({ error: 'Video not found' });
      }
    }
  } catch (error) {
    console.error('Video info error:', error);
    res.status(500).json({ error: 'Failed to fetch video info' });
  }
});

// Download endpoint (placeholder - requires ytdl-core)
app.get('/api/download', (req, res) => {
  const { id, quality } = req.query;
  res.json({ 
    message: 'Download endpoint',
    note: 'Implement with ytdl-core in production',
    videoId: id,
    quality: quality
  });
});

// Serve node_modules
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

// All other routes go to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
  console.log(`🔍 Search API: http://localhost:${port}/api/search?q=your_query`);
  console.log(`🎬 Video API: http://localhost:${port}/api/video?id=VIDEO_ID`);
  console.log(`📥 Download API: http://localhost:${port}/api/download?id=VIDEO_ID&quality=720p`);
});
