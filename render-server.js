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



// Start server
app.listen(port, () => {
    log.success(`🎵 Enhanced Downloader running on port ${port}`);
});
