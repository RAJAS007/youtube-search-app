const express = require('express');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ytdl = require('@distube/ytdl-core');
const axios = require('axios');

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

// MP3 Conversion using ytdl-core + ffmpeg (with Metadata)
app.get('/api/convert-to-mp3', async (req, res) => {
    const { url, title } = req.query;

    if (!url || !ytdl.validateURL(url)) {
        return res.status(400).json({ error: 'Valid YouTube URL required' });
    }

    // Fallback if no cookies configured
    if (!agent) {
        log.info(`No cookies found. Using fallback proxy for: ${title}`);
        try {
            const extUrl = `https://ironman.koyeb.app/ironman/dl/v2/ytmp4?url=${encodeURIComponent(url)}`;
            const response = await axios({ url: extUrl, method: 'GET', responseType: 'stream' });

            const safeFilename = getSafeFilename(title);
            res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.mp3"`);
            res.setHeader('Content-Type', 'audio/mpeg');

            ffmpeg(response.data)
                .format('mp3')
                .audioBitrate(128)
                .pipe(res, { end: true });
            return;
        } catch (e) {
            log.error(`Fallback failed: ${e.message}`);
            return res.status(500).json({ error: 'Download failed (Fallback)' });
        }
    }

    try {
        // Get video info first for metadata
        const info = await ytdl.getInfo(url, { agent });
        const videoTitle = info.videoDetails.title || title || 'audio';
        const artist = info.videoDetails.author.name || 'MusicHub';
        const safeFilename = getSafeFilename(videoTitle);

        log.info(`MP3 Request: ${safeFilename}`);

        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.mp3"`);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Access-Control-Allow-Origin', '*');

        // High quality audio stream (with buffer optimization)
        const stream = ytdl(url, {
            quality: 'highestaudio',
            ...ytdlOpts
        });

        const command = ffmpeg(stream)
            .format('mp3')
            .audioBitrate(128)
            .outputOptions('-id3v2_version', '3')
            .outputOptions('-metadata', `title=${videoTitle}`)
            .outputOptions('-metadata', `artist=${artist}`)
            .outputOptions('-metadata', `album=MusicHub Download`);

        command.on('error', (err) => {
            log.error(`FFmpeg error: ${err.message}`);
            // Only send error if headers haven't been sent (streaming hasn't started essentially)
            // If streaming started, client will just see a cut-off stream
            if (!res.headersSent) res.status(500).end();
        })
            .pipe(res, { end: true });

    } catch (error) {
        log.error(`MP3 Init error: ${error.message}`);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// MP4 Direct Download using ytdl-core (with Quality Support)
app.get('/api/download-mp4', async (req, res) => {
    const { url, title, quality = '720p' } = req.query;

    if (!url || !ytdl.validateURL(url)) {
        return res.status(400).json({ error: 'Valid YouTube URL required' });
    }

    // Fallback if no cookies configured
    if (!agent) {
        log.info(`No cookies found. Redirecting to fallback for MP4: ${title}`);
        const extUrl = `https://ironman.koyeb.app/ironman/dl/v2/ytmp4?url=${encodeURIComponent(url)}`;
        return res.redirect(extUrl);
    }

    const safeFilename = getSafeFilename(title);
    log.info(`MP4 Request: ${safeFilename} [${quality}]`);

    try {
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.mp4"`);
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Access-Control-Allow-Origin', '*');

        // Get video info
        const info = await ytdl.getInfo(url, { agent });

        let format;
        let needsMerge = false;

        if (quality === 'Highest') {
            format = ytdl.chooseFormat(info.formats, { quality: 'highestvideo' });
            needsMerge = !format.hasAudio;
        } else if (quality === '1080p') {
            format = info.formats.find(f => f.qualityLabel === '1080p' && f.container === 'mp4');
            if (!format) {
                format = info.formats.find(f => f.qualityLabel === '1080p');
                needsMerge = !!format;
            }
        } else if (quality === '720p') {
            format = info.formats.find(f => f.qualityLabel === '720p' && f.hasAudio && f.container === 'mp4');
        } else if (quality === '360p') {
            format = info.formats.find(f => f.qualityLabel === '360p' && f.hasAudio && f.container === 'mp4');
        }

        // Fallback
        if (!format) {
            log.info(`Quality ${quality} not found, falling back`);
            format = info.formats.find(f => f.qualityLabel === '720p' && f.hasAudio && f.container === 'mp4')
                || ytdl.chooseFormat(info.formats, { quality: 'highest' });
            needsMerge = false;
        }

        const opts = { ...ytdlOpts };

        if (needsMerge) {
            log.info(`Merging needed for ${quality}`);
            const audioFormat = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
            const videoStream = ytdl(url, { format: format, ...opts });
            const audioStream = ytdl(url, { format: audioFormat, ...opts });

            ffmpeg()
                .input(videoStream)
                .input(audioStream)
                .format('mp4')
                .outputOptions('-c:v copy')
                .outputOptions('-c:a aac')
                .outputOptions('-movflags frag_keyframe+empty_moov')
                .on('error', (err) => {
                    log.error(`Merge error: ${err.message}`);
                    if (!res.headersSent) res.status(500).end();
                })
                .pipe(res, { end: true });
        } else {
            log.info(`Direct streaming ${format.qualityLabel}`);
            ytdl(url, { format: format, ...opts })
                .on('error', (err) => {
                    log.error(`Stream error: ${err.message}`);
                    if (!res.headersSent) res.status(500).end();
                })
                .pipe(res);
        }

    } catch (error) {
        log.error(`MP4 Init error: ${error.message}`);
        res.status(500).json({ error: 'Server error' });
    }
});

// Start server
app.listen(port, () => {
    log.success(`🎵 Enhanced Downloader running on port ${port}`);
});
