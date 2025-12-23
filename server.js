const express = require('express');
const path = require('path');
const ytSearch = require('yt-search');
const ytdl = require('ytdl-core');
const cors = require('cors');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3000;

// Enable CORS
app.use(cors());
app.use(express.json());

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

// Get video info by ID
app.get('/api/video/:id', async (req, res) => {
  try {
    const videoId = req.params.id;
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    
    const info = await ytdl.getInfo(url);
    
    // Extract available formats
    const formats = info.formats
      .filter(format => format.hasVideo && format.hasAudio)
      .map(format => ({
        quality: format.qualityLabel || format.quality,
        container: format.container,
        hasAudio: format.hasAudio,
        hasVideo: format.hasVideo,
        url: format.url,
        itag: format.itag
      }));
    
    res.json({
      title: info.videoDetails.title,
      author: info.videoDetails.author.name,
      lengthSeconds: info.videoDetails.lengthSeconds,
      viewCount: info.videoDetails.viewCount,
      thumbnail: info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url,
      formats: formats
    });
    
  } catch (error) {
    console.error('Video info error:', error);
    res.status(500).json({ error: 'Failed to fetch video info' });
  }
});

// Download video endpoint
app.get('/api/download/:id', async (req, res) => {
  try {
    const videoId = req.params.id;
    const quality = req.query.quality || 'highest';
    const format = req.query.format || 'mp4';
    
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const info = await ytdl.getInfo(url);
    
    // Set headers for download
    const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');
    const filename = `${title.substring(0, 50)}.${format}`;
    
    res.header('Content-Disposition', `attachment; filename="${filename}"`);
    res.header('Content-Type', 'video/mp4');
    
    // Stream the video
    ytdl(url, {
      quality: quality,
      filter: format === 'mp4' ? 'audioandvideo' : 'audioonly'
    }).pipe(res);
    
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Download failed' });
  }
});

// Get available formats
app.get('/api/formats/:id', async (req, res) => {
  try {
    const videoId = req.params.id;
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    
    const info = await ytdl.getInfo(url);
    
    const formats = {
      video: info.formats
        .filter(f => f.hasVideo && f.hasAudio)
        .map(f => ({
          quality: f.qualityLabel,
          container: f.container,
          itag: f.itag,
          size: f.contentLength ? `${(f.contentLength / (1024 * 1024)).toFixed(2)} MB` : 'Unknown'
        })),
      audio: info.formats
        .filter(f => f.hasAudio && !f.hasVideo)
        .map(f => ({
          quality: f.audioBitrate ? `${f.audioBitrate} kbps` : 'audio',
          container: f.container,
          itag: f.itag
        }))
    };
    
    res.json(formats);
  } catch (error) {
    console.error('Formats error:', error);
    res.status(500).json({ error: 'Failed to get formats' });
  }
});

// Serve node_modules
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

// All routes go to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
  console.log(`🔍 Search: /api/search?q=query`);
  console.log(`📥 Download: /api/download/VIDEO_ID?quality=720p`);
});
