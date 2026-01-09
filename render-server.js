const express = require('express');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ytdl = require('@distube/ytdl-core');

const app = express();
const port = process.env.PORT || 3000;

// FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// Simple logging
const log = {
    info: (msg) => console.log(`[${new Date().toISOString()}] ℹ️  ${msg}`),
    success: (msg) => console.log(`[${new Date().toISOString()}] ✅ ${msg}`),
    error: (msg) => console.error(`[${new Date().toISOString()}] ❌ ${msg}`)
};

// Cookie Agent Setup (for Anti-Bot)
let agent;
try {
    if (process.env.YOUTUBE_COOKIES) {
        const cookies = JSON.parse(process.env.YOUTUBE_COOKIES);
        agent = ytdl.createAgent(cookies);
        log.success('Loaded YouTube Cookies for Anti-Bot');
    }
} catch (e) {
    log.error(`Failed to load cookies: ${e.message}`);
} const ytdlOpts = { agent, highWaterMark: 1 << 23 };

// Middleware
app.use(cors());

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', service: 'mp3-converter', timestamp: new Date().toISOString() });
});

// Helper for filename
const getSafeFilename = (title) => {
    return (title || 'audio')
        .replace(/[^a-z0-9\s-]/gi, '')
        .replace(/\s+/g, '_')
        .substring(0, 100);
};

// ==========================================
// MP4 DOWNLOAD API (Ironman Redirect)
// ==========================================
app.get('/api/download-mp4', async (req, res) => {
    const { url, title } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'YouTube URL required' });
    }

    log.info(`MP4 Redirect Request: ${title || url}`);

    // Redirect to Ironman API (Fastest approach, as requested)
    const extUrl = `https://ironman.koyeb.app/ironman/dl/v2/ytmp4?url=${encodeURIComponent(url)}`;
    return res.redirect(extUrl);
});

// ==========================================
// MP3 CONVERSION API (Local ytdl-core)
// ==========================================
app.get('/api/convert-to-mp3', async (req, res) => {
    const { url, title } = req.query;
    if (!url) return res.status(400).json({ error: 'Valid YouTube URL required' });

    const safeFilename = getSafeFilename(title);
    log.info(`MP3 Proxy Request: ${safeFilename}`);

    try {
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.mp3"`);
        res.setHeader('Content-Type', 'audio/mpeg');

        // Use Ironman MP4 Stream as input (FFmpeg follows redirects)
        const ironmanUrl = `https://ironman.koyeb.app/ironman/dl/v2/ytmp4?url=${encodeURIComponent(url)}`;

        ffmpeg(ironmanUrl)
            .audioBitrate(128)
            .format('mp3')
            .on('error', (err) => {
                log.error(`FFmpeg error (Ironman Source): ${err.message}`);
                if (!res.headersSent) res.status(500).end();
            })
            .pipe(res, { end: true });

    } catch (error) {
        log.error(`MP3 Init error: ${error.message}`);
        res.status(500).json({ error: 'Server error' });
    }
});

// Start server
app.listen(port, () => {
    log.success(`🎵 Enhanced Downloader running on port ${port}`);
});
