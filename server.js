const express = require('express');
const path = require('path');
const ytSearch = require('yt-search');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();
const port = process.env.PORT || 3000;

// Enable CORS
app.use(cors());
// Serve static files
app.use(express.static(__dirname));

// API endpoint for YouTube search
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ error: 'Search query required' });
    }
    
    console.log(`Searching YouTube for: ${query}`);
    const searchResult = await ytSearch(query);
    res.json(searchResult);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search YouTube' });
  }
});

// NEW: API endpoint to resolve Spotify Links to Song Titles
app.get('/api/resolve', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url || !url.includes('spotify.com')) {
      return res.status(400).json({ error: 'Invalid Spotify URL' });
    }

    console.log(`Resolving Spotify Link: ${url}`);
    
    // Fetch the Spotify page
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    // Parse metadata
    const $ = cheerio.load(response.data);
    
    // Spotify titles usually look like: "Song Name - song by Artist | Spotify"
    let rawTitle = $('title').text();
    let cleanTitle = rawTitle.replace('| Spotify', '').replace('- song by', '-').trim();

    // If it's a playlist, it might just be the playlist name, which is also fine for searching
    console.log(`Resolved to: ${cleanTitle}`);
    
    res.json({ title: cleanTitle });
  } catch (error) {
    console.error('Spotify resolution error:', error.message);
    res.status(500).json({ error: 'Failed to resolve Spotify link' });
  }
});

// Serve node_modules
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

// All other routes go to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
  console.log(`🔍 Search API: http://localhost:${port}/api/search?q=your_query`);
});
