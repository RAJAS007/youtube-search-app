const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Serve static files
app.use(express.static(__dirname));

// Serve node_modules for ytsearch
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

// All routes go to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
