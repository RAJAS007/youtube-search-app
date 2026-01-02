const express = require('express');
const path = require('path');
const cors = require('cors');
const ytSearch = require('yt-search');
const NodeCache = require('node-cache');
const ytdl = require('@distube/ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

// 1. Setup FFmpeg
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const port = process.env.PORT || 3000;
const searchCache = new NodeCache({ stdTTL: 3600 });

app.use(cors());
app.use(express.static(__dirname));

// --- 1. SEARCH API ---
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

        const data = { videos };
        searchCache.set(cachedKey, data);
        res.json(data);

    } catch (error) {
        console.error('Search Error:', error.message);
        res.status(500).json({ error: 'Search failed' });
    }
});

// --- 2. INTERNAL DOWNLOAD & CONVERT API ---
app.get('/api/download', async (req, res) => {
    try {
        const { id, type } = req.query; // id = videoId, type = 'mp3' or 'mp4'
        if (!id) return res.status(400).send('Video ID required');

        console.log(`⬇️ Starting Internal Job: ${id} (${type})`);

        // Get Video Info
        const videoUrl = `https://www.youtube.com/watch?v=${id}`;
        if (!ytdl.validateURL(videoUrl)) {
            return res.status(400).send('Invalid Video ID');
        }

        const info = await ytdl.getInfo(videoUrl);
        const title = info.videoDetails.title.replace(/[^a-z0-9]/gi, '_');
        const filename = `${title}.${type}`;

        // Set Headers for Download
        res.header('Content-Disposition', `attachment; filename="${filename}"`);

        // --- AUDIO MODE (MP3) ---
        if (type === 'mp3') {
            res.header('Content-Type', 'audio/mpeg');
            
            // Get highest audio quality stream
            const audioStream = ytdl(videoUrl, { quality: 'highestaudio' });

            // Convert to MP3 using FFmpeg
            ffmpeg(audioStream)
                .format('mp3')
                .audioBitrate(128)
                .on('error', (err) => {
                    console.error('FFmpeg Audio Error:', err.message);
                    if (!res.headersSent) res.end();
                })
                .pipe(res, { end: true });

        } 
        // --- VIDEO MODE (MP4) ---
        else {
            res.header('Content-Type', 'video/mp4');
            
            // Download video with audio (Quality 18 is standard 360p/MP4 which is safest for streaming)
            // For higher quality, we would need to merge streams, but that requires temporary files (disk space).
            // Quality '18' is the most reliable single-file stream.
            const videoStream = ytdl(videoUrl, { quality: '18' });

            videoStream
                .on('error', (err) => {
                    console.error('Stream Error:', err.message);
                    if (!res.headersSent) res.end();
                })
                .pipe(res);
        }

    } catch (error) {
        console.error('Handler Error:', error.message);
        if (!res.headersSent) res.status(500).send('Server Error');
    }
});

// Serve Frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`✅ Server running on port ${port}`);
});
