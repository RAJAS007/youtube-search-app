const express = require('express');
const cors = require('cors');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

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

// Middleware
app.use(cors());

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', service: 'mp3-converter', timestamp: new Date().toISOString() });
});

// MP3 Conversion - The only heavy endpoint
app.get('/api/convert-to-mp3', async (req, res) => {
    const { url, title } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL required' });
    }

    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
        return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    const externalMp4Api = `https://ironman.koyeb.app/ironman/dl/v2/ytmp4?url=${encodeURIComponent(url)}`;
    const safeFilename = (title || 'audio')
        .replace(/[^a-z0-9\s-]/gi, '')
        .replace(/\s+/g, '_')
        .substring(0, 100);

    log.info(`Converting: "${safeFilename}"`);

    try {
        const response = await axios({
            method: 'get',
            url: externalMp4Api,
            responseType: 'stream',
            timeout: 120000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.mp3"`);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Access-Control-Allow-Origin', '*');

        ffmpeg(response.data)
            .format('mp3')
            .audioBitrate(128)
            .on('start', () => log.info(`FFmpeg started: ${safeFilename}`))
            .on('end', () => log.success(`Done: ${safeFilename}`))
            .on('error', (err) => {
                log.error(`FFmpeg error: ${err.message}`);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Conversion failed' });
                }
            })
            .pipe(res, { end: true });

    } catch (error) {
        log.error(`Stream error: ${error.message}`);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Could not fetch source' });
        }
    }
});

// Start server
app.listen(port, () => {
    log.success(`🎵 MP3 Converter running on port ${port}`);
});
