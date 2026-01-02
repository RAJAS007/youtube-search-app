const express = require('express');
const path = require('path');
const ytSearch = require('yt-search');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// --- NEW: REQUIRED HEADERS FOR FFMPEG.WASM ---
app.use((req, res, next) => {
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    next();
});
// ---------------------------------------------

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
