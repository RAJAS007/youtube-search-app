const express = require('express');
const path = require('path');
const cors = require('cors');
const axios = require('axios');
const ytSearch = require('yt-search');
const NodeCache = require('node-cache');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

// 1. Setup FFMPEG Path
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const port = process.env.PORT || 3000;
const searchCache = new NodeCache({ stdTTL: 3600 });

app.use(cors());
app.use(express.static(__dirname));

// --- SEARCH API ---
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.status(400).json({ error: 'Query required' });

        const cachedKey = `search_${query.toLowerCase().trim()}`;
        if (searchCache.has(cachedKey)) {
            return res.json(searchCache.get(cachedKey));
        }

        console.log(`🔍 Searching: ${query}`);
        const result = await ytSearch(query);
        
        const videos = result.videos.slice(0, 15).map(v => ({
            videoId: v.videoId,
            title: v.title,
            thumbnail: v.thumbnail,
            duration: v.duration,
            author: { name: v.author.name }
        }));

        searchCache.set(cachedKey, { videos });
        res.json({ videos });

    } catch (error) {
        console.error('Search Error:', error.message);
        res.status(500).json({ error: 'Search failed' });
    }
});

// --- ROBUST DOWNLOAD API ---
app.get('/api/download', async (req, res) => {
    try {
        const { url, type } = req.query; // type = 'mp3' or 'mp4'
        if (!url) return res.status(400).send('URL required');

        console.log(`⬇️ Request: ${type.toUpperCase()} | URL: ${url}`);

        // 1. Get Direct Link from API
        const apiUrl = `https://ameen-api.vercel.app/v2/yts?url=${encodeURIComponent(url)}`;
        const apiRes = await axios.get(apiUrl);
        
        const data = apiRes.data;
        // Look for the download link in various possible properties
        const directLink = data.dl || data.url || data.download_url || (data.data && data.data.url) || (data.data && data.data.dl);

        if (!directLink) {
            throw new Error('No valid download link found from API');
        }

        console.log(`🔗 Source Link Found. Starting Stream...`);

        // 2. Prepare Headers
        // Clean the title to prevent header errors
        const safeTitle = `download_${Date.now()}`; 
        const filename = `${safeTitle}.${type}`;

        res.header('Content-Disposition', `attachment; filename="${filename}"`);

        // 3. FFMPEG STREAMING LOGIC
        // We use FFmpeg for BOTH video and audio to ensure stability
        
        const command = ffmpeg(directLink);

        // Add headers to mimic a browser (Helps avoid 403 Forbidden from YouTube servers)
        command.inputOptions([
            '-headers', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            '-reconnect', '1',
            '-reconnect_streamed', '1',
            '-reconnect_delay_max', '5'
        ]);

        if (type === 'mp3') {
            // Audio Conversion
            res.header('Content-Type', 'audio/mpeg');
            command
                .format('mp3')
                .audioBitrate(128)
                .on('error', (err) => {
                    console.error('FFmpeg Audio Error:', err.message);
                    if (!res.headersSent) res.end();
                })
                .pipe(res, { end: true });

        } else {
            // Video Stream (Copy mode = Fast & CPU efficient)
            res.header('Content-Type', 'video/mp4');
            command
                .format('mp4')
                .outputOptions('-c copy') // Directly copy video/audio streams (No re-encoding)
                .on('error', (err) => {
                    console.error('FFmpeg Video Error:', err.message);
                    if (!res.headersSent) res.end();
                })
                .pipe(res, { end: true });
        }

    } catch (error) {
        console.error('Server Error:', error.message);
        if (!res.headersSent) res.status(500).send('Download Failed');
    }
});

// Serve Frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`✅ Server running on port ${port}`);
});
