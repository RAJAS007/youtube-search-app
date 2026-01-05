const express = require('express');
const path = require('path');
const ytSearch = require('yt-search');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ytdl = require('@distube/ytdl-core');

const app = express();
const port = process.env.PORT || 3000;

// FFmpeg path configuration
ffmpeg.setFfmpegPath(ffmpegPath);

// ==========================================
// ENHANCED LOGGING
// ==========================================
const log = {
  info: (msg) => console.log(`[${new Date().toISOString()}] ℹ️  ${msg}`),
  success: (msg) => console.log(`[${new Date().toISOString()}] ✅ ${msg}`),
  error: (msg) => console.error(`[${new Date().toISOString()}] ❌ ${msg}`),
  warn: (msg) => console.warn(`[${new Date().toISOString()}] ⚠️  ${msg}`)
};

// ==========================================
// IN-MEMORY CACHE (LRU-style)
// ==========================================
class SimpleCache {
  constructor(maxSize = 100, ttlMs = 10 * 60 * 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.value;
  }

  set(key, value) {
    if (this.cache.size >= this.maxSize) {
      // Delete oldest entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, {
      value,
      expiry: Date.now() + this.ttlMs
    });
  }

  clear() {
    this.cache.clear();
  }

  get size() {
    return this.cache.size;
  }
}

const searchCache = new SimpleCache(100, 10 * 60 * 1000); // 100 entries, 10 min TTL

// ==========================================
// RATE LIMITING (Simple in-memory)
// ==========================================
class RateLimiter {
  constructor(windowMs = 60000, maxRequests = 100) {
    this.requests = new Map();
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;

    // Cleanup old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  isAllowed(ip) {
    const now = Date.now();
    const record = this.requests.get(ip) || { count: 0, resetTime: now + this.windowMs };

    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + this.windowMs;
    } else {
      record.count++;
    }

    this.requests.set(ip, record);
    return record.count <= this.maxRequests;
  }

  getRemainingRequests(ip) {
    const record = this.requests.get(ip);
    if (!record) return this.maxRequests;
    return Math.max(0, this.maxRequests - record.count);
  }

  cleanup() {
    const now = Date.now();
    for (const [ip, record] of this.requests) {
      if (now > record.resetTime) {
        this.requests.delete(ip);
      }
    }
  }
}

const searchLimiter = new RateLimiter(60000, 100);   // 100 req/min for search
const convertLimiter = new RateLimiter(60000, 20);   // 20 req/min for conversions

// ==========================================
// USER STATE STORAGE (Anti-Cheat)
// ==========================================
const CONFIG = {
  dailyFreeLimit: 5,
  ptsPerAd: 40,
  ptsPerDownload: 4,
  unlockCost: 100,
  unlockBonus: 5,
  adDuration: 15000  // 15 seconds in ms
};

class UserStateManager {
  constructor() {
    this.users = new Map();
    // Cleanup stale users every hour
    setInterval(() => this.cleanup(), 60 * 60 * 1000);
  }

  getIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
  }

  getUser(ip) {
    const today = new Date().toDateString();
    let user = this.users.get(ip);

    // Create new user or reset daily counts
    if (!user || user.date !== today) {
      user = {
        points: user?.points || 0,  // Keep points across days
        count: 0,
        limit: CONFIG.dailyFreeLimit,
        date: today,
        adStartTime: null,
        streak: user?.streak || 1
      };
      this.users.set(ip, user);
    }
    return user;
  }

  save(ip, user) {
    this.users.set(ip, user);
  }

  cleanup() {
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
    for (const [ip, user] of this.users) {
      const userDate = new Date(user.date).getTime();
      if (userDate < cutoff) {
        this.users.delete(ip);
      }
    }
    log.info(`User state cleanup: ${this.users.size} users remain`);
  }

  get totalUsers() {
    return this.users.size;
  }

  // Get all users for admin dashboard
  getAllUsers() {
    return Array.from(this.users.entries()).map(([ip, user]) => ({
      ip: ip.substring(0, 8) + '***', // Partial IP for privacy
      points: user.points,
      downloads: user.count,
      limit: user.limit,
      date: user.date
    }));
  }

  // Get stats summary
  getStats() {
    let totalPoints = 0;
    let totalDownloads = 0;
    let activeToday = 0;
    const today = new Date().toDateString();

    for (const user of this.users.values()) {
      totalPoints += user.points;
      totalDownloads += user.count;
      if (user.date === today) activeToday++;
    }

    return {
      totalUsers: this.users.size,
      activeToday,
      totalPoints,
      totalDownloads
    };
  }
}

const userManager = new UserStateManager();

// ==========================================
// ANALYTICS TRACKER
// ==========================================
class Analytics {
  constructor() {
    this.data = {
      pageViews: 0,
      searches: 0,
      downloads: { mp3: 0, mp4: 0 },
      adStarts: 0,
      adClaims: 0,
      unlocks: 0,
      errors: 0,
      searchQueries: new Map(), // Track popular searches
      hourlyViews: new Array(24).fill(0),
      dailyStats: new Map()
    };
    this.startTime = Date.now();
  }

  track(event, details = {}) {
    const hour = new Date().getHours();
    const today = new Date().toDateString();

    switch (event) {
      case 'pageView':
        this.data.pageViews++;
        this.data.hourlyViews[hour]++;
        break;
      case 'search':
        this.data.searches++;
        const query = details.query?.toLowerCase();
        if (query) {
          this.data.searchQueries.set(query, (this.data.searchQueries.get(query) || 0) + 1);
        }
        break;
      case 'download':
        if (details.type === 'mp3') this.data.downloads.mp3++;
        else this.data.downloads.mp4++;
        break;
      case 'adStart':
        this.data.adStarts++;
        break;
      case 'adClaim':
        this.data.adClaims++;
        break;
      case 'unlock':
        this.data.unlocks++;
        break;
      case 'error':
        this.data.errors++;
        break;
    }

    // Track daily stats
    if (!this.data.dailyStats.has(today)) {
      this.data.dailyStats.set(today, { views: 0, searches: 0, downloads: 0 });
    }
    const daily = this.data.dailyStats.get(today);
    if (event === 'pageView') daily.views++;
    if (event === 'search') daily.searches++;
    if (event === 'download') daily.downloads++;
  }

  getTopSearches(limit = 10) {
    return Array.from(this.data.searchQueries.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([query, count]) => ({ query, count }));
  }

  getDailyStats(days = 7) {
    const stats = [];
    const entries = Array.from(this.data.dailyStats.entries());
    return entries.slice(-days);
  }

  getSummary() {
    const uptimeMs = Date.now() - this.startTime;
    const uptimeHours = Math.floor(uptimeMs / (1000 * 60 * 60));
    const uptimeMins = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));

    return {
      uptime: `${uptimeHours}h ${uptimeMins}m`,
      pageViews: this.data.pageViews,
      searches: this.data.searches,
      downloads: this.data.downloads,
      totalDownloads: this.data.downloads.mp3 + this.data.downloads.mp4,
      adStarts: this.data.adStarts,
      adClaims: this.data.adClaims,
      adConversionRate: this.data.adStarts > 0
        ? Math.round((this.data.adClaims / this.data.adStarts) * 100) + '%'
        : '0%',
      unlocks: this.data.unlocks,
      errors: this.data.errors,
      hourlyViews: this.data.hourlyViews,
      topSearches: this.getTopSearches(10)
    };
  }
}

const analytics = new Analytics();


// ==========================================
// MIDDLEWARE
// ==========================================
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();

  // Track page views (only for main page, not API calls)
  if (req.path === '/' || req.path === '/index.html') {
    analytics.track('pageView');
  }

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const emoji = status >= 400 ? '🔴' : '🟢';
    log.info(`${emoji} ${req.method} ${req.path} ${status} (${duration}ms)`);
  });
  next();
});

// ==========================================
// ADMIN PASSWORD (set in environment or use default)
// ==========================================
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'musichub2026';

// ==========================================
// SERVER INFO & STARTUP TIME
// ==========================================
const serverStartTime = Date.now();
const version = '3.2.0';

// ==========================================
// HEALTH & STATUS ENDPOINTS
// ==========================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - serverStartTime) / 1000) + 's'
  });
});

app.get('/api/status', (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = uptimeSeconds % 60;

  res.json({
    status: 'online',
    version,
    uptime: `${hours}h ${minutes}m ${seconds}s`,
    cache: {
      size: searchCache.size,
      maxSize: 100
    },
    users: userManager.totalUsers,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
    },
    environment: process.env.NODE_ENV || 'production'
  });
});

// ==========================================
// USER STATE API (Anti-Cheat)
// ==========================================

// Get current user state
app.get('/api/user/state', (req, res) => {
  const ip = userManager.getIP(req);
  const user = userManager.getUser(ip);

  res.json({
    points: user.points,
    count: user.count,
    limit: user.limit,
    remaining: Math.max(0, user.limit - user.count),
    streak: user.streak
  });
});

// Start ad timer (must be called before claiming reward)
app.post('/api/ad/start', (req, res) => {
  const ip = userManager.getIP(req);
  const user = userManager.getUser(ip);

  user.adStartTime = Date.now();
  userManager.save(ip, user);
  analytics.track('adStart');

  log.info(`Ad started for IP: ${ip.substring(0, 8)}...`);
  res.json({ success: true, duration: CONFIG.adDuration / 1000 });
});

// Claim ad reward (verifies 15 seconds passed)
app.post('/api/ad/claim', (req, res) => {
  const ip = userManager.getIP(req);
  const user = userManager.getUser(ip);

  if (!user.adStartTime) {
    log.warn(`Ad claim without start for IP: ${ip.substring(0, 8)}...`);
    return res.status(400).json({ error: 'Ad not started', success: false });
  }

  const elapsed = Date.now() - user.adStartTime;

  if (elapsed < CONFIG.adDuration) {
    const remaining = Math.ceil((CONFIG.adDuration - elapsed) / 1000);
    log.warn(`Ad claim too early (${remaining}s left) for IP: ${ip.substring(0, 8)}...`);
    return res.status(400).json({
      error: `Wait ${remaining} more seconds`,
      success: false,
      remaining
    });
  }

  // Reward the user
  user.points += CONFIG.ptsPerAd;
  user.adStartTime = null;
  userManager.save(ip, user);
  analytics.track('adClaim');

  log.success(`Ad reward claimed: +${CONFIG.ptsPerAd} pts for IP: ${ip.substring(0, 8)}...`);
  res.json({
    success: true,
    points: user.points,
    earned: CONFIG.ptsPerAd
  });
});

// Check if download is allowed
app.get('/api/download/check', (req, res) => {
  const ip = userManager.getIP(req);
  const user = userManager.getUser(ip);

  const canDownload = user.count < user.limit;

  res.json({
    allowed: canDownload,
    count: user.count,
    limit: user.limit,
    remaining: Math.max(0, user.limit - user.count)
  });
});

// Record successful download
app.post('/api/download/complete', (req, res) => {
  const ip = userManager.getIP(req);
  const user = userManager.getUser(ip);

  if (user.count >= user.limit) {
    return res.status(403).json({ error: 'Download limit reached', success: false });
  }

  user.count++;
  user.points += CONFIG.ptsPerDownload;
  userManager.save(ip, user);
  analytics.track('download', { type: 'mp3' });

  log.info(`Download recorded for IP: ${ip.substring(0, 8)}... (${user.count}/${user.limit})`);
  res.json({
    success: true,
    count: user.count,
    limit: user.limit,
    remaining: Math.max(0, user.limit - user.count),
    points: user.points,
    earned: CONFIG.ptsPerDownload
  });
});

// Unlock more downloads with points
app.post('/api/user/unlock', (req, res) => {
  const ip = userManager.getIP(req);
  const user = userManager.getUser(ip);

  if (user.points < CONFIG.unlockCost) {
    return res.status(400).json({
      error: 'Not enough points',
      success: false,
      required: CONFIG.unlockCost,
      current: user.points
    });
  }

  user.points -= CONFIG.unlockCost;
  user.limit += CONFIG.unlockBonus;
  userManager.save(ip, user);
  analytics.track('unlock');

  log.success(`Unlock purchased for IP: ${ip.substring(0, 8)}... (new limit: ${user.limit})`);
  res.json({
    success: true,
    points: user.points,
    limit: user.limit,
    remaining: Math.max(0, user.limit - user.count)
  });
});

// ==========================================
// SEARCH API (with caching & rate limiting)
// ==========================================
app.get('/api/search', async (req, res) => {
  try {
    const clientIP = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || 'unknown';

    // Rate limiting check
    if (!searchLimiter.isAllowed(clientIP)) {
      log.warn(`Rate limit exceeded for IP: ${clientIP}`);
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: '60 seconds'
      });
    }

    const query = req.query.q?.trim();
    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    if (query.length > 200) {
      return res.status(400).json({ error: 'Query too long (max 200 characters)' });
    }

    // Check cache first
    const cacheKey = query.toLowerCase();
    const cachedResult = searchCache.get(cacheKey);
    if (cachedResult) {
      log.info(`Cache HIT for: "${query}"`);
      res.setHeader('X-Cache', 'HIT');
      return res.json({ videos: cachedResult, cached: true });
    }

    log.info(`Searching YouTube: "${query}"`);
    const searchResult = await ytSearch(query);

    // Extract and optimize response
    const videos = (searchResult.videos || []).slice(0, 20).map(v => ({
      title: v.title,
      url: v.url,
      timestamp: v.timestamp,
      views: v.views,
      thumbnail: v.thumbnail,
      author: v.author,
      seconds: v.seconds
    }));

    // Cache the result
    searchCache.set(cacheKey, videos);
    analytics.track('search', { query });
    log.success(`Found ${videos.length} results for: "${query}"`);

    res.setHeader('X-Cache', 'MISS');
    res.json({ videos, cached: false });

  } catch (error) {
    log.error(`Search failed: ${error.message}`);
    res.status(500).json({ error: 'Search failed. Please try again.' });
  }
});

// ==========================================
// SPOTIFY RESOLVER API
// ==========================================
app.get('/api/resolve', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    // Basic Spotify URL validation
    if (!url.includes('spotify.com')) {
      return res.status(400).json({ error: 'Invalid Spotify URL' });
    }

    log.info(`Resolving Spotify: ${url}`);

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    let title = $('title').text()
      .replace('| Spotify', '')
      .replace('- song by', '-')
      .replace(' - Spotify', '')
      .trim();

    log.success(`Resolved: "${title}"`);
    res.json({ title });

  } catch (error) {
    log.error(`Spotify resolve failed: ${error.message}`);
    res.status(500).json({ error: 'Could not resolve Spotify track' });
  }
});

// ==========================================
// MP3 CONVERSION API (with rate limiting)
// ==========================================
// ==========================================
// MP3 CONVERSION API (Internal FFmpeg)
// ==========================================
app.get('/api/convert-to-mp3', async (req, res) => {
  const clientIP = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || 'unknown';

  if (!convertLimiter.isAllowed(clientIP)) {
    return res.status(429).json({ error: 'Too many requests', retryAfter: '60s' });
  }

  const { url, title } = req.query;
  if (!url || !ytdl.validateURL(url)) {
    return res.status(400).json({ error: 'Valid YouTube URL required' });
  }

  try {
    const info = await ytdl.getInfo(url);
    const videoTitle = info.videoDetails.title || title || 'audio';
    const artist = info.videoDetails.author.name || 'MusicHub';
    const safeFilename = videoTitle.replace(/[^a-z0-9\s-]/gi, '').replace(/\s+/g, '_').substring(0, 100);

    log.info(`Converting MP3: ${safeFilename}`);

    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.mp3"`);
    res.setHeader('Content-Type', 'audio/mpeg');

    const stream = ytdl(url, { quality: 'highestaudio', highWaterMark: 1 << 23 }); // 8MB buffer

    ffmpeg(stream)
      .format('mp3')
      .audioBitrate(128)
      .outputOptions('-id3v2_version', '3')
      .outputOptions('-metadata', `title=${videoTitle}`)
      .outputOptions('-metadata', `artist=${artist}`)
      .on('error', (err) => {
        log.error(`FFmpeg error: ${err.message}`);
        if (!res.headersSent) res.status(500).end();
      })
      .pipe(res, { end: true });

  } catch (error) {
    log.error(`MP3 Error: ${error.message}`);
    res.status(500).json({ error: 'Conversion failed' });
  }
});

// ==========================================
// MP4 DOWNLOAD API (Internal ytdl-core)
// ==========================================
app.get('/api/download-mp4', async (req, res) => {
  const { url, title, quality = '720p' } = req.query;

  if (!url || !ytdl.validateURL(url)) return res.status(400).json({ error: 'Invalid URL' });

  const safeFilename = (title || 'video').replace(/[^a-z0-9\s-]/gi, '').replace(/\s+/g, '_').substring(0, 100);
  log.info(`MP4 Request: ${safeFilename} [${quality}]`);

  try {
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.mp4"`);
    res.setHeader('Content-Type', 'video/mp4');

    const info = await ytdl.getInfo(url);
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
    } else {
      // Fallback to 720p/360p or best mp4 with audio
      format = info.formats.find(f => f.qualityLabel === quality && f.hasAudio && f.container === 'mp4');
    }

    if (!format) {
      format = info.formats.find(f => f.qualityLabel === '720p' && f.hasAudio && f.container === 'mp4')
        || ytdl.chooseFormat(info.formats, { quality: 'highest' });
      needsMerge = false;
    }

    const opts = { highWaterMark: 1 << 23 };

    if (needsMerge) {
      const audioFormat = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
      const videoStream = ytdl(url, { format, ...opts });
      const audioStream = ytdl(url, { format: audioFormat, ...opts });

      ffmpeg()
        .input(videoStream)
        .input(audioStream)
        .format('mp4')
        .outputOptions('-c:v copy')
        .outputOptions('-c:a aac')
        .outputOptions('-movflags frag_keyframe+empty_moov')
        .on('error', err => {
          log.error(`Merge error: ${err.message}`);
          if (!res.headersSent) res.status(500).end();
        })
        .pipe(res, { end: true });
    } else {
      ytdl(url, { format, ...opts })
        .on('error', err => {
          log.error(`Stream error: ${err.message}`);
          if (!res.headersSent) res.status(500).end();
        })
        .pipe(res);
    }

  } catch (error) {
    log.error(`MP4 Error: ${error.message}`);
    res.status(500).json({ error: 'Download failed' });
  }
});

// ==========================================
// CACHE MANAGEMENT (optional admin endpoint)
// ==========================================
app.post('/api/cache/clear', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY && process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  searchCache.clear();
  log.info('Cache cleared by admin');
  res.json({ success: true, message: 'Cache cleared' });
});

// ==========================================
// ADMIN DASHBOARD API
// ==========================================

// Verify admin password
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;

  if (password === ADMIN_PASSWORD) {
    log.info('Admin login successful');
    res.json({ success: true });
  } else {
    log.warn('Admin login failed');
    res.status(401).json({ success: false, error: 'Invalid password' });
  }
});

// Get dashboard data (password protected)
app.post('/api/admin/dashboard', (req, res) => {
  const { password } = req.body;

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const analyticsData = analytics.getSummary();
  const userStats = userManager.getStats();
  const users = userManager.getAllUsers();

  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    server: {
      version,
      uptime: analyticsData.uptime,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
      },
      cache: searchCache.size
    },
    analytics: analyticsData,
    users: userStats,
    recentUsers: users.slice(-20) // Last 20 users
  });
});

// Admin dashboard HTML page
app.get('/admin', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MusicHub Admin Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Inter', sans-serif; }
    body { background: #0a0a0b; color: #fff; min-height: 100vh; padding: 20px; }
    .login-container { max-width: 400px; margin: 100px auto; text-align: center; }
    .login-box { background: #18181b; padding: 40px; border-radius: 16px; border: 1px solid #27272a; }
    .login-box h1 { margin-bottom: 8px; font-size: 24px; }
    .login-box p { color: #71717a; margin-bottom: 24px; font-size: 14px; }
    input { width: 100%; padding: 12px 16px; background: #27272a; border: 1px solid #3f3f46; border-radius: 8px; color: #fff; font-size: 14px; margin-bottom: 16px; }
    input:focus { outline: none; border-color: #6366f1; }
    button { width: 100%; padding: 12px; background: #6366f1; color: #fff; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px; }
    button:hover { background: #4f46e5; }
    .error { color: #ef4444; font-size: 13px; margin-bottom: 16px; }
    
    .dashboard { display: none; max-width: 1200px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .header h1 { font-size: 28px; }
    .logout-btn { background: #27272a; padding: 8px 16px; border-radius: 8px; border: 1px solid #3f3f46; color: #fff; cursor: pointer; font-size: 13px; }
    
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat-card { background: #18181b; padding: 20px; border-radius: 12px; border: 1px solid #27272a; }
    .stat-label { font-size: 12px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .stat-value { font-size: 32px; font-weight: 800; }
    .stat-value.accent { color: #6366f1; }
    .stat-value.green { color: #22c55e; }
    .stat-value.gold { color: #fbbf24; }
    
    .section { background: #18181b; padding: 20px; border-radius: 12px; border: 1px solid #27272a; margin-bottom: 16px; }
    .section h2 { font-size: 16px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
    
    .table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .table th, .table td { padding: 10px; text-align: left; border-bottom: 1px solid #27272a; }
    .table th { color: #71717a; font-weight: 500; font-size: 11px; text-transform: uppercase; }
    
    .chart-container { height: 120px; display: flex; align-items: flex-end; gap: 4px; padding-top: 20px; }
    .chart-bar { flex: 1; background: #6366f1; border-radius: 4px 4px 0 0; min-height: 4px; transition: height 0.3s; position: relative; }
    .chart-bar:hover { background: #818cf8; }
    .chart-bar span { position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); font-size: 10px; color: #71717a; white-space: nowrap; }
    
    .refresh-btn { background: #27272a; border: 1px solid #3f3f46; padding: 8px 16px; border-radius: 8px; color: #fff; cursor: pointer; font-size: 13px; }
    .refresh-btn:hover { background: #3f3f46; }
    
    @media (max-width: 768px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .stat-value { font-size: 24px; }
    }
  </style>
</head>
<body>
  <div class="login-container" id="loginView">
    <div class="login-box">
      <h1>🔐 Admin Access</h1>
      <p>Enter password to view dashboard</p>
      <div id="error" class="error" style="display:none;"></div>
      <input type="password" id="password" placeholder="Password" onkeypress="if(event.key==='Enter')login()">
      <button onclick="login()">Login</button>
    </div>
  </div>

  <div class="dashboard" id="dashboard">
    <div class="header">
      <h1>📊 MusicHub Dashboard</h1>
      <div>
        <button class="refresh-btn" onclick="loadData()">🔄 Refresh</button>
        <button class="logout-btn" onclick="logout()">Logout</button>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card"><div class="stat-label">Page Views</div><div class="stat-value accent" id="pageViews">-</div></div>
      <div class="stat-card"><div class="stat-label">Total Searches</div><div class="stat-value" id="searches">-</div></div>
      <div class="stat-card"><div class="stat-label">Downloads</div><div class="stat-value green" id="downloads">-</div></div>
      <div class="stat-card"><div class="stat-label">Total Users</div><div class="stat-value" id="totalUsers">-</div></div>
      <div class="stat-card"><div class="stat-label">Active Today</div><div class="stat-value gold" id="activeToday">-</div></div>
      <div class="stat-card"><div class="stat-label">Ad Conversion</div><div class="stat-value" id="adConversion">-</div></div>
    </div>

    <div class="section">
      <h2>📈 Hourly Traffic (Last 24h)</h2>
      <div class="chart-container" id="hourlyChart"></div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
      <div class="section">
        <h2>🔥 Top Searches</h2>
        <table class="table" id="topSearches"><tr><td>Loading...</td></tr></table>
      </div>
      <div class="section">
        <h2>👥 Recent Users</h2>
        <table class="table" id="userTable"><tr><td>Loading...</td></tr></table>
      </div>
    </div>

    <div class="section">
      <h2>⚙️ Server Info</h2>
      <table class="table">
        <tr><th>Version</th><td id="version">-</td></tr>
        <tr><th>Uptime</th><td id="uptime">-</td></tr>
        <tr><th>Memory</th><td id="memory">-</td></tr>
        <tr><th>Cache Size</th><td id="cache">-</td></tr>
      </table>
    </div>
  </div>

  <script>
    let adminPassword = '';
    
    async function login() {
      const pwd = document.getElementById('password').value;
      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pwd })
        });
        const data = await res.json();
        if (data.success) {
          adminPassword = pwd;
          document.getElementById('loginView').style.display = 'none';
          document.getElementById('dashboard').style.display = 'block';
          loadData();
        } else {
          document.getElementById('error').innerText = 'Invalid password';
          document.getElementById('error').style.display = 'block';
        }
      } catch (e) {
        document.getElementById('error').innerText = 'Connection error';
        document.getElementById('error').style.display = 'block';
      }
    }
    
    function logout() {
      adminPassword = '';
      location.reload();
    }
    
    async function loadData() {
      try {
        const res = await fetch('/api/admin/dashboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: adminPassword })
        });
        const data = await res.json();
        
        document.getElementById('pageViews').innerText = data.analytics.pageViews.toLocaleString();
        document.getElementById('searches').innerText = data.analytics.searches.toLocaleString();
        document.getElementById('downloads').innerText = data.analytics.totalDownloads.toLocaleString();
        document.getElementById('totalUsers').innerText = data.users.totalUsers.toLocaleString();
        document.getElementById('activeToday').innerText = data.users.activeToday.toLocaleString();
        document.getElementById('adConversion').innerText = data.analytics.adConversionRate;
        
        document.getElementById('version').innerText = data.server.version;
        document.getElementById('uptime').innerText = data.server.uptime;
        document.getElementById('memory').innerText = data.server.memory.used + ' / ' + data.server.memory.total;
        document.getElementById('cache').innerText = data.server.cache + ' entries';
        
        // Hourly chart
        const max = Math.max(...data.analytics.hourlyViews, 1);
        document.getElementById('hourlyChart').innerHTML = data.analytics.hourlyViews.map((v, i) => 
          '<div class="chart-bar" style="height:' + (v/max*100) + '%"><span>' + i + 'h</span></div>'
        ).join('');
        
        // Top searches
        document.getElementById('topSearches').innerHTML = data.analytics.topSearches.length 
          ? data.analytics.topSearches.map(s => '<tr><td>' + s.query + '</td><td>' + s.count + '</td></tr>').join('')
          : '<tr><td colspan="2">No searches yet</td></tr>';
        
        // Users table
        document.getElementById('userTable').innerHTML = data.recentUsers.length
          ? '<tr><th>IP</th><th>Points</th><th>DLs</th></tr>' + 
            data.recentUsers.map(u => '<tr><td>' + u.ip + '</td><td>' + u.points + '</td><td>' + u.downloads + '/' + u.limit + '</td></tr>').join('')
          : '<tr><td>No users yet</td></tr>';
          
      } catch (e) {
        console.error('Failed to load data:', e);
      }
    }
  </script>
</body>
</html>`);
});

// ==========================================
// STATIC FILES & FALLBACK
// ==========================================
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// ==========================================
// ERROR HANDLING
// ==========================================
app.use((err, req, res, next) => {
  log.error(`Unhandled error: ${err.message}`);
  res.status(500).json({ error: 'Internal server error' });
});

// ==========================================
// GRACEFUL SHUTDOWN
// ==========================================
process.on('SIGTERM', () => {
  log.info('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  log.info('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// ==========================================
// START SERVER
// ==========================================
app.listen(port, () => {
  log.success(`🚀 MusicHub Server v${version} running on port ${port}`);
  log.info(`Environment: ${process.env.NODE_ENV || 'production'}`);
  log.info(`Cache: 100 entries, 10 min TTL`);
  log.info(`Rate limits: 100 search/min, 20 convert/min`);
});
