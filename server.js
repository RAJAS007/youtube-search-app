const express = require('express');
const path = require('path');
const ytSearch = require('yt-search');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

const app = express();
const port = process.env.PORT || 3000;

// Tell the app where to find the FFmpeg engine
ffmpeg.setFfmpegPath(ffmpegPath);

app.use(cors());
app.use(express.static(__dirname));

// 1. SEARCH API
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Query required' });
    
    console.log(`Searching: ${query}`);
    const searchResult = await ytSearch(query);
    res.json(searchResult);
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// 2. SPOTIFY RESOLVER API
app.get('/api/resolve', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL required' });

    console.log(`Resolving Spotify: ${url}`);
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124 Safari/537.36' }
    });

    const $ = cheerio.load(response.data);
    let title = $('title').text().replace('| Spotify', '').replace('- song by', '-').trim();
    console.log(`Resolved: ${title}`);
    
    res.json({ title });
  } catch (error) {
    res.status(500).json({ error: 'Resolve failed' });
  }
});

// 3. CONVERSION API (Fixed for "0B" error)
app.get('/api/convert-to-mp3', (req, res) => {
    const { url, title } = req.query;
    if (!url) return res.status(400).send('URL required');

    const externalMp4Api = `https://ironman.koyeb.app/ironman/dl/v2/ytmp4?url=${url}`;
    const safeFilename = (title || 'audio').replace(/[^a-z0-9]/gi, '_');

    console.log(`Converting stream: ${safeFilename}`);

    // Header fix: We DO NOT set Content-Length because streaming size is unknown
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.mp3"`);
    res.setHeader('Content-Type', 'audio/mpeg');

    // Add User-Agent to input options so the source doesn't block ffmpeg
    ffmpeg(externalMp4Api)
        .inputOptions([
            '-headers', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        ])
        .format('mp3')
        .audioBitrate(128)
        .on('error', (err) => {
            console.error('FFmpeg Error:', err.message);
            // Only convert error if stream hasn't started
            if (!res.headersSent) res.status(500).send('Conversion failed');
        })
        .pipe(res, { end: true });
});

// Serve node_modules and fallback to index.html
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(port, () => console.log(`✅ Server running on port ${port}`));
