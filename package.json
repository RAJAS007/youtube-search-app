const express = require('express');
const path = require('path');
const ytSearch = require('yt-search');
const cors = require('cors');
const ytdl = require('@distube/ytdl-core');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(__dirname));

// --- SEARCH API ---
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Query required' });
    
    console.log(`🔍 Searching: ${query}`);
    const result = await ytSearch(query);
    
    // Send optimized data
    const videos = result.videos.slice(0, 15).map(v => ({
      videoId: v.videoId,
      title: v.title,
      thumbnail: v.thumbnail,
      duration: v.duration,
      author: { name: v.author.name }
    }));
    
    res.json({ videos });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// --- DOWNLOAD API (YOUR OWN) ---
app.get('/api/download', async (req, res) => {
  try {
    const { id, type } = req.query;
    if (!id || !ytdl.validateID(id)) return res.status(400).send('Invalid ID');

    console.log(`📥 Starting Internal Download: ${id} (${type})`);

    const info = await ytdl.getInfo(id);
    const title = info.videoDetails.title.replace(/[^a-z0-9]/gi, '_');

    // Choose Format
    let format;
    if (type === 'mp3') {
      format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
      res.header('Content-Type', 'audio/mpeg');
      res.header('Content-Disposition', `attachment; filename="${title}.mp3"`);
    } else {
      // Get best video that has audio (usually 360p/720p)
      format = ytdl.chooseFormat(info.formats, { quality: 'highest', filter: 'audioandvideo' });
      res.header('Content-Type', 'video/mp4');
      res.header('Content-Disposition', `attachment; filename="${title}.mp4"`);
    }

    // Pipe the stream
    ytdl(id, { format: format })
      .on('error', (err) => {
        console.error('Stream Error:', err.message);
        if (!res.headersSent) res.status(500).send('Stream Failed');
      })
      .pipe(res);

  } catch (error) {
    console.error('Internal Download Error:', error.message);
    res.status(500).send('Internal Server Error');
  }
});

app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
