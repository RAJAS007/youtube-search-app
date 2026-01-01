const express = require('express');
const path = require('path');
const ytSearch = require('yt-search');
const cors = require('cors');
const NodeCache = require('node-cache');
const ytdl = require('@distube/ytdl-core');

const app = express();
const port = process.env.PORT || 3000;
const searchCache = new NodeCache({ stdTTL: 3600 }); // Cache for 1 hour

app.use(cors());
app.use(express.static(__dirname));

// --- 1. IMPROVED SEARCH API ---
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Query required' });

    // Check Cache First (Instant Result)
    const cachedKey = `search_${query.toLowerCase().trim()}`;
    const cachedResult = searchCache.get(cachedKey);
    if (cachedResult) {
      console.log(`⚡ Serving from cache: ${query}`);
      return res.json(cachedResult);
    }

    console.log(`🔍 Searching YouTube: ${query}`);
    const result = await ytSearch(query);
    
    // Optimize: Send only necessary data to frontend
    const optimizedVideos = result.videos.slice(0, 15).map(v => ({
      videoId: v.videoId,
      title: v.title,
      thumbnail: v.thumbnail,
      duration: v.duration,
      author: { name: v.author.name },
      views: v.views
    }));

    const responseData = { videos: optimizedVideos };
    
    // Save to Cache
    searchCache.set(cachedKey, responseData);
    
    res.json(responseData);

  } catch (error) {
    console.error('Search Error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// --- 2. NEW DOWNLOAD API (Internal) ---
app.get('/api/download', async (req, res) => {
  try {
    const { id, type } = req.query; // id = videoId, type = mp3 or mp4
    if (!id || !ytdl.validateID(id)) {
      return res.status(400).send('Invalid Video ID');
    }

    const info = await ytdl.getInfo(id);
    const title = info.videoDetails.title.replace(/[^a-z0-9]/gi, '_');
    
    // Determine Format
    let format;
    if (type === 'mp3') {
      // Audio only (Highest quality)
      format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
      res.header('Content-Disposition', `attachment; filename="${title}.mp3"`);
      res.header('Content-Type', 'audio/mpeg');
    } else {
      // Video (Video + Audio)
      format = ytdl.chooseFormat(info.formats, { quality: '18' }); // Quality 18 is standard 360p with audio (most reliable)
      res.header('Content-Disposition', `attachment; filename="${title}.mp4"`);
      res.header('Content-Type', 'video/mp4');
    }

    // Stream directly to client
    ytdl(id, { format: format })
      .on('error', (err) => {
        console.error('Stream Error:', err);
        if (!res.headersSent) res.status(500).send('Download Stream Error');
      })
      .pipe(res);

  } catch (error) {
    console.error('Download Error:', error);
    res.status(500).send('Failed to process download');
  }
});

app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
