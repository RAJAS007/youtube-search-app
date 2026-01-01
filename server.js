const express = require('express');
const path = require('path');
const cors = require('cors');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

// Configure FFMPEG path automatically
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(__dirname));

// --- 1. SEARCH API (Using Ameen API) ---
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.status(400).json({ error: 'Query required' });

        // Call Ameen API for search results
        const apiUrl = `https://ameen-api.vercel.app/v2/yts?q=${encodeURIComponent(query)}`;
        const response = await axios.get(apiUrl);
        
        // Return the data directly to frontend
        res.json(response.data);
    } catch (error) {
        console.error('Search Error:', error.message);
        res.status(500).json({ error: 'Search failed' });
    }
});

// --- 2. DOWNLOAD & CONVERT API ---
app.get('/api/download', async (req, res) => {
    try {
        const { url, type } = req.query; // type = 'mp3' or 'mp4'
        if (!url) return res.status(400).send('URL required');

        console.log(`⬇️ Processing: ${type.toUpperCase()} for ${url}`);

        // 1. Get the Direct Download Link from Ameen API
        // We assume the API returns a JSON with 'dl' or 'url' when passed a YouTube link
        const apiUrl = `https://ameen-api.vercel.app/v2/yts?url=${encodeURIComponent(url)}`;
        const apiRes = await axios.get(apiUrl);
        
        // Extract the actual video file URL from the API response
        // Note: We check multiple common property names just in case
        const videoData = apiRes.data;
        const directLink = videoData.dl || videoData.url || videoData.download_url || (videoData.data && videoData.data.url);

        if (!directLink) {
            throw new Error('Could not retrieve download link from API');
        }

        const filename = `download.${type}`;

        // 2. Set Headers for Download
        res.header('Content-Disposition', `attachment; filename="${filename}"`);

        // 3. Handle Conversion based on Type
        if (type === 'mp3') {
            // --- CONVERT VIDEO TO AUDIO ---
            res.header('Content-Type', 'audio/mpeg');
            
            ffmpeg(directLink)
                .format('mp3')
                .audioBitrate(128)
                .on('error', (err) => {
                    console.error('Conversion Error:', err.message);
                    if (!res.headersSent) res.status(500).end();
                })
                .pipe(res, { end: true });

        } else {
            // --- STREAM VIDEO DIRECTLY ---
            res.header('Content-Type', 'video/mp4');
            
            const videoStream = await axios({
                url: directLink,
                method: 'GET',
                responseType: 'stream'
            });
            
            videoStream.data.pipe(res);
        }

    } catch (error) {
        console.error('Download/Convert Error:', error.message);
        if (!res.headersSent) res.status(500).send('Server Error: ' + error.message);
    }
});

// Serve Frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
});
