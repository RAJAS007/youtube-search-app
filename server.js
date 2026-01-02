const express = require('express');
const path = require('path');
const ytSearch = require('yt-search');
const cors = require('cors');
const ytdl = require('@distube/ytdl-core');
const ffmpeg = require('fluent-ffmpeg');

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

// --- NEW: Internal Audio Download & Conversion Endpoint ---
app.get('/api/download-mp3', async (req, res) => {
    try {
        const url = req.query.url;
        if (!url || !ytdl.validateURL(url)) {
            return res.status(400).send('Invalid YouTube URL');
        }

        // Get video info to create a filename
        const info = await ytdl.getBasicInfo(url);
        const title = info.videoDetails.title.replace(/[^a-z0-9]/gi, '_');
        
        // Set headers to tell the browser this is a file download
        res.header('Content-Disposition', `attachment; filename="${title}.mp3"`);
        res.header('Content-Type', 'audio/mpeg');

        // Create the audio stream from YouTube
        const stream = ytdl(url, { 
            quality: 'highestaudio',
            filter: 'audioonly' 
        });

        // Use FFmpeg to convert the stream to MP3 and pipe it to the response
        ffmpeg(stream)
            .audioBitrate(128)
            .format('mp3')
            .on('error', (err) => {
                console.error('FFmpeg error:', err);
                if (!res.headersSent) {
                    res.status(500).send('Conversion failed');
                }
            })
            .pipe(res, { end: true }); // Pipe directly to user response

    } catch (error) {
        console.error('Download error:', error);
        res.status(500).send('Server Error');
    }
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
});
