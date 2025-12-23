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

// Legal disclaimer middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// API endpoint for YouTube search
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) {
            return res.status(400).json({ error: 'Search query required' });
        }
        
        console.log(`Searching for: "${query}"`);
        const searchResult = await ytSearch(query);
        
        // Format response
        const videos = searchResult.videos.map(video => ({
            id: video.videoId,
            title: video.title,
            thumbnail: video.thumbnail,
            channel: video.author.name,
            duration: video.duration?.seconds || video.duration,
            views: video.views,
            uploaded: video.ago,
            description: video.description
        }));
        
        res.json({ success: true, videos: videos });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed', details: error.message });
    }
});

// Get video info by ID
app.get('/api/video/:id', async (req, res) => {
    try {
        const videoId = req.params.id;
        if (!videoId) {
            return res.status(400).json({ error: 'Video ID required' });
        }
        
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        const info = await ytdl.getInfo(url);
        
        // Get available formats
        const formats = info.formats
            .filter(f => f.hasAudio || f.hasVideo)
            .map(f => ({
                itag: f.itag,
                quality: f.qualityLabel || f.quality,
                container: f.container,
                hasAudio: f.hasAudio,
                hasVideo: f.hasVideo,
                audioBitrate: f.audioBitrate,
                size: f.contentLength ? `${(f.contentLength / (1024 * 1024)).toFixed(2)} MB` : 'Unknown'
            }))
            .sort((a, b) => {
                // Sort by quality
                const qualityOrder = ['1440p', '1080p', '720p', '480p', '360p', '240p', '144p'];
                const aIndex = qualityOrder.indexOf(a.quality);
                const bIndex = qualityOrder.indexOf(b.quality);
                return bIndex - aIndex;
            });
        
        res.json({
            success: true,
            video: {
                id: videoId,
                title: info.videoDetails.title,
                channel: info.videoDetails.author.name,
                duration: info.videoDetails.lengthSeconds,
                thumbnail: info.videoDetails.thumbnails.pop().url,
                description: info.videoDetails.description,
                views: info.videoDetails.viewCount,
                formats: formats
            }
        });
        
    } catch (error) {
        console.error('Video info error:', error);
        res.status(500).json({ error: 'Failed to get video info', details: error.message });
    }
});

// **REAL DOWNLOAD ENDPOINT**
app.get('/api/download/:id', async (req, res) => {
    try {
        const videoId = req.params.id;
        const itag = req.query.itag || 'highest';
        const format = req.query.format || 'mp4';
        
        if (!videoId) {
            return res.status(400).json({ error: 'Video ID required' });
        }
        
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        const info = await ytdl.getInfo(url);
        
        // Sanitize filename
        const title = info.videoDetails.title.replace(/[^\w\s]/gi, '').substring(0, 50);
        const filename = `${title}.${format}`;
        
        // Set download headers
        res.header('Content-Disposition', `attachment; filename="${filename}"`);
        
        // Stream the video
        const stream = ytdl(url, {
            quality: itag === 'highest' ? 'highest' : itag,
            filter: format === 'mp3' ? 'audioonly' : 'audioandvideo'
        });
        
        stream.on('error', (error) => {
            console.error('Stream error:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Download failed' });
            }
        });
        
        stream.pipe(res);
        
        console.log(`Download started: ${title} (${itag})`);
        
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Download failed', details: error.message });
    }
});

// Get available formats for a video
app.get('/api/formats/:id', async (req, res) => {
    try {
        const videoId = req.params.id;
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        const info = await ytdl.getInfo(url);
        
        const videoFormats = info.formats
            .filter(f => f.hasVideo && f.hasAudio)
            .map(f => ({
                itag: f.itag,
                quality: f.qualityLabel || f.quality,
                container: f.container,
                size: f.contentLength ? `${(f.contentLength / (1024 * 1024)).toFixed(2)} MB` : 'Unknown'
            }))
            .sort((a, b) => {
                const qualityOrder = ['1440p', '1080p', '720p', '480p', '360p', '240p', '144p'];
                const aIndex = qualityOrder.indexOf(a.quality);
                const bIndex = qualityOrder.indexOf(b.quality);
                return bIndex - aIndex;
            });
        
        const audioFormats = info.formats
            .filter(f => f.hasAudio && !f.hasVideo)
            .map(f => ({
                itag: f.itag,
                quality: f.audioBitrate ? `${f.audioBitrate} kbps` : 'audio',
                container: f.container
            }));
        
        res.json({
            success: true,
            video: videoFormats,
            audio: audioFormats
        });
        
    } catch (error) {
        console.error('Formats error:', error);
        res.status(500).json({ error: 'Failed to get formats' });
    }
});

// Legal disclaimer
app.get('/api/disclaimer', (req, res) => {
    res.json({
        disclaimer: "This tool is for EDUCATIONAL PURPOSES ONLY. Downloading YouTube videos may violate YouTube's Terms of Service and copyright laws. Use responsibly and respect content creators' rights."
    });
});

// Serve node_modules
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

// All other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`
    ╔══════════════════════════════════════════════╗
    ║     YouTube Downloader Server Running        ║
    ║     PORT: ${port}                            ║
    ║                                              ║
    ║  ⚠️  LEGAL DISCLAIMER:                       ║
    ║  This tool is for EDUCATIONAL PURPOSES ONLY  ║
    ║  Respect YouTube's Terms of Service          ║
    ║  and copyright laws                          ║
    ╚══════════════════════════════════════════════╝
    `);
    console.log(`Endpoints:`);
    console.log(`  Search:        http://localhost:${port}/api/search?q=query`);
    console.log(`  Video Info:    http://localhost:${port}/api/video/VIDEO_ID`);
    console.log(`  Formats:       http://localhost:${port}/api/formats/VIDEO_ID`);
    console.log(`  Download:      http://localhost:${port}/api/download/VIDEO_ID?itag=18`);
});
