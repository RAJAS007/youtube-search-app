/**
 * MusicHub Premium - Main Script
 * Version: 3.1 - Restored Features & Fixes
 */

// ==========================================
// CONFIG & STATE
// ==========================================
const CONFIG = {
    adLink: "https://www.effectivegatecpm.com/rey536wd4n?key=40890ac4e198ed5f5ee7eaeb9e169aee",
    renderUrl: "https://youtube-search-app-r16f.onrender.com",
    upiId: "raheemarar948@okicici"
};

const state = {
    points: 0,
    count: 0,
    limit: 5,
    streak: 1,
    favorites: JSON.parse(localStorage.getItem('mh_favorites') || '[]'),
    playlists: JSON.parse(localStorage.getItem('mh_playlists') || '[]'),
    searchHistory: JSON.parse(localStorage.getItem('mh_search_history') || '[]'),
    activeDownloads: [],
    lastResults: [],
    currentDonationAmount: 100,
    pendingDownload: null  // For quality selection flow
};

// ==========================================
// UTILS
// ==========================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const formatViews = (n) => {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n || '0';
};

const showToast = (msg, type = 'success') => {
    const toast = document.createElement('div');
    toast.className = `glass-panel`;
    toast.style.cssText = `
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%) translateY(-100px);
        padding: 12px 24px; border-radius: 50px; display: flex; align-items: center; gap: 10px;
        z-index: 9999; transition: 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        border: 1px solid ${type === 'error' ? 'var(--danger)' : 'var(--success)'};
    `;
    toast.innerHTML = `
        <i class="fas ${type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle'}" 
           style="color: ${type === 'error' ? 'var(--danger)' : 'var(--success)'}"></i>
        <span style="font-weight: 600; font-size: 14px;">${msg}</span>
    `;
    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => toast.style.transform = 'translateX(-50%) translateY(0)');

    // Remove
    setTimeout(() => {
        toast.style.transform = 'translateX(-50%) translateY(-100px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// ==========================================
// CORE APP CLASS
// ==========================================
class App {
    constructor() {
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.syncState();
        this.renderHistory();
        this.updateStreakUI(); // Initial XP render

        // Initial "Trending" load (simulated)
        this.handleSearch('New Music 2026', false);
    }

    setupEventListeners() {
        // Search
        $('#searchForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSearch($('#searchInput').value);
        });

        // Sidebar Toggles
        $('.points-pill').addEventListener('click', () => this.toggleSidebar(true));
        $('#closeSidebar').addEventListener('click', () => this.toggleSidebar(false));
        $('.overlay').addEventListener('click', () => this.toggleSidebar(false));

        // Chips
        $$('.chip').forEach(chip => {
            if (!chip.onclick) { // Avoid overwriting donation chips
                chip.addEventListener('click', () => {
                    $('#searchInput').value = chip.innerText.replace(/[^\w\s]/gi, '').trim();
                    this.handleSearch($('#searchInput').value);
                });
            }
        });

        // Nav Links
        $('#navFavs').addEventListener('click', () => this.showFavorites());

        // History Focus
        $('#searchInput').addEventListener('focus', () => $('#searchHistory').style.display = 'block');
        $('#searchInput').addEventListener('blur', () => setTimeout(() => $('#searchHistory').style.display = 'none', 200));
    }

    async syncState() {
        try {
            const res = await fetch('/api/user/state');
            const data = await res.json();
            state.points = data.points;
            state.count = data.count;
            state.limit = data.limit;
            state.streak = data.streak;
            this.updateUI();
        } catch (e) {
            console.error('Sync failed', e);
        }
    }

    updateUI() {
        $('#ptsDisplay').innerText = state.points;
        $('#sbPts').innerText = state.points;
        $('#sbLimit').innerText = `${state.count}/${state.limit}`;
        this.updateXP();
        this.updateStreakUI();
    }

    // New Feature: XP Logic
    updateXP() {
        const level = Math.floor(Math.sqrt(state.points / 150)) + 1;
        $('#levelName').innerText = `LEVEL ${level}`;
        $('#levelPts').innerText = `${state.points % 150}/150 XP`;
        $('#xpBar').style.width = `${(state.points % 150) / 1.5}%`;
    }

    // New Feature: Streak UI
    updateStreakUI() {
        $('#streakCount').innerText = `${state.streak} Days`;
        let html = '';
        for (let i = 1; i <= 7; i++) {
            const isActive = i <= state.streak;
            const isToday = i === state.streak;
            // Simple visual representation
            html += `<div style="width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:${isActive ? '800' : '600'};
                background:${isActive ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.05)'};
                color:${isActive ? 'white' : 'rgba(255,255,255,0.3)'};
                border:1px solid ${isActive ? 'transparent' : 'rgba(255,255,255,0.1)'};
                box-shadow:${isActive ? '0 0 10px rgba(249,115,22,0.4)' : 'none'}">
                ${i}
            </div>`;
        }
        $('#streakDays').innerHTML = html;
    }

    toggleSidebar(show) {
        if (show) {
            $('.sidebar').classList.add('active');
            $('.overlay').classList.add('active');
        } else {
            $('.sidebar').classList.remove('active');
            $('.overlay').classList.remove('active');
        }
    }

    // ==========================================
    // SEARCH ENGINE
    // ==========================================
    async handleSearch(query, saveHistory = true) {
        if (!query) return;

        // UI Prep
        $('#searchInput').blur();
        $('#grid').innerHTML = Array(8).fill('<div class="media-card skeleton"><div class="thumb-container"></div><div class="card-content"></div></div>').join('');

        if (saveHistory) this.addToHistory(query);

        // Spotify Resolve
        if (query.includes('spotify.com')) {
            try {
                const res = await fetch(`/api/resolve?url=${encodeURIComponent(query)}`);
                const data = await res.json();
                if (data.title) query = data.title;
            } catch (e) { console.error(e); }
        }

        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            const data = await res.json();

            state.lastResults = data.videos || [];
            this.renderGrid(state.lastResults);
        } catch (e) {
            showToast('Search failed', 'error');
            $('#grid').innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;"><h3>No results found</h3></div>';
        }
    }

    renderGrid(videos) {
        if (!videos.length) {
            $('#grid').innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;"><h3>No results found</h3></div>';
            return;
        }

        $('#grid').innerHTML = videos.map((v, i) => {
            const isFav = state.favorites.some(f => f.url === v.url);
            return `
                <div class="media-card glass" style="animation: fadeInUp 0.5s ease backwards ${i * 0.05}s">
                    <div class="thumb-container">
                        <img src="${v.thumbnail}" class="thumb-img" loading="lazy">
                        <div class="play-overlay">
                            <div class="play-icon"><i class="fas fa-play"></i></div>
                        </div>
                        <button class="btn btn-icon glass" onclick="app.toggleFav(${i})"
                                style="position: absolute; top: 10px; right: 10px; color: ${isFav ? '#ef4444' : 'white'}">
                            <i class="${isFav ? 'fas' : 'far'} fa-heart"></i>
                        </button>
                    </div>
                    <div class="card-content">
                        <div class="card-title">${v.title}</div>
                        <div class="card-meta">
                            <span><i class="fas fa-user"></i> ${v.author.name}</span>
                            <span>${v.timestamp}</span>
                        </div>
                        <div class="card-actions">
                            <button class="btn btn-secondary" onclick="app.initDownload(${i}, 'mp3')">
                                <i class="fas fa-music"></i> Audio
                            </button>
                            <button class="btn btn-primary" onclick="app.initDownload(${i}, 'mp4')">
                                <i class="fas fa-video"></i> Video
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ==========================================
    // FEATURES: FAVS & PLAYLISTS
    // ==========================================
    toggleFav(index) {
        const video = state.lastResults[index];
        const idx = state.favorites.findIndex(f => f.url === video.url);

        if (idx > -1) {
            state.favorites.splice(idx, 1);
            showToast('Removed from Favorites');
        } else {
            state.favorites.push(video);
            showToast('Added to Favorites');
        }
        localStorage.setItem('mh_favorites', JSON.stringify(state.favorites));

        // Re-render if looking at favs, otherwise just update specific card icon
        if ($('#searchInput').value === '') this.renderGrid(state.lastResults); // Simple refresh
    }

    showFavorites() {
        this.toggleSidebar(false);
        $('#searchInput').value = '';
        state.lastResults = state.favorites;
        this.renderGrid(state.favorites);
    }

    // ==========================================
    // HISTORY
    // ==========================================
    addToHistory(query) {
        if (!state.searchHistory.includes(query)) {
            state.searchHistory.unshift(query);
            if (state.searchHistory.length > 5) state.searchHistory.pop();
            localStorage.setItem('mh_search_history', JSON.stringify(state.searchHistory));
            this.renderHistory();
        }
    }

    renderHistory() {
        $('#searchHistory').innerHTML = state.searchHistory.map(q =>
            `<div style="padding:12px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.05)" 
                  onclick="$('#searchInput').value='${q}'; app.handleSearch('${q}')">
                <i class="fas fa-history" style="margin-right:10px;color:var(--text-secondary)"></i> ${q}
            </div>`
        ).join('');
    }

    // ==========================================
    // DOWNLOAD MANAGER (FIXED)
    // ==========================================
    async initDownload(index, type) {
        const video = state.lastResults[index];

        // Check Limits
        try {
            const res = await fetch('/api/download/check');
            const checks = await res.json();

            if (!checks.allowed) {
                this.showLimitModal();
                return;
            }

            // For MP4, show quality selection modal
            if (type === 'mp4') {
                state.pendingDownload = { video, index };
                this.showQualityModal(video);
                return;
            }

            // For MP3, start directly
            this.addDownloadItem(video, type);
            this.processDownload(video, type, '128kbps');

        } catch (e) {
            showToast('Network Error', 'error');
        }
    }

    // Show quality selection modal
    showQualityModal(video) {
        $('#qualityVideoName').innerText = video.title;
        $('#qualityModal').classList.add('active');
    }

    // Handle quality selection
    selectQuality(quality) {
        $('#qualityModal').classList.remove('active');

        if (state.pendingDownload) {
            const { video } = state.pendingDownload;
            this.addDownloadItem(video, 'mp4');
            this.processDownload(video, 'mp4', quality);
            state.pendingDownload = null;
        }
    }

    addDownloadItem(video, type) {
        const id = Date.now();
        const el = document.createElement('div');
        el.className = 'dl-item';
        el.id = `dl-${id}`;
        el.innerHTML = `
            <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:600;">
                <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;">
                    ${video.title}
                </span>
                <span class="status-text" style="color:var(--accent)">Preparing...</span>
            </div>
            <div class="dl-progress"><div class="dl-fill" style="width:0%"></div></div>
        `;
        $('#dlManagerList').prepend(el);
        this.toggleSidebar(true);
        return id;
    }

    async processDownload(video, type, quality = '720p') {
        // Get the download item UI elements
        const item = $('#dlManagerList').firstElementChild;
        if (!item) return;

        const bar = item.querySelector('.dl-fill');
        const txt = item.querySelector('.status-text');

        // Use smart endpoints with auto-fallback (ytdl-core -> pytubefix)
        const api = type === 'mp3'
            ? `/api/smart/mp3?url=${encodeURIComponent(video.url)}&title=${encodeURIComponent(video.title)}`
            : `/api/smart/mp4?url=${encodeURIComponent(video.url)}&title=${encodeURIComponent(video.title)}&quality=${quality}`;

        // Show selected quality in status
        if (type === 'mp4') {
            txt.innerText = `${quality} selected...`;
        }

        try {
            txt.innerText = 'Connecting...';
            bar.style.width = '5%';

            const response = await fetch(api);

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            // Check which engine was used
            const engine = response.headers.get('X-Download-Engine') || 'unknown';
            if (engine.includes('fallback')) {
                txt.innerText = 'Using backup engine...';
            }

            const reader = response.body.getReader();
            const contentLength = +response.headers.get('Content-Length');
            let receivedLength = 0;
            let chunks = [];

            // Read stream
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                chunks.push(value);
                receivedLength += value.length;

                if (contentLength) {
                    const percent = Math.floor((receivedLength / contentLength) * 100);
                    bar.style.width = `${percent}%`;
                    txt.innerText = `Downloading... ${percent}%`;
                } else {
                    txt.innerText = `Downloading... ${(receivedLength / 1024 / 1024).toFixed(1)} MB`;
                    // Simulate progress for unknown size
                    const fakePercent = Math.min(90, receivedLength / 50000);
                    bar.style.width = `${fakePercent}%`;
                }
            }

            // Create blob and trigger download
            bar.style.width = '100%';
            txt.innerText = 'Saving file...';

            const blob = new Blob(chunks);
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `${video.title.replace(/[^a-z0-9\s-]/gi, '').substring(0, 80)}.${type}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);

            // Success
            bar.style.backgroundColor = 'var(--success)';
            txt.innerText = 'Downloaded!';
            txt.style.color = 'var(--success)';

            // Register download with server
            await fetch('/api/download/complete', { method: 'POST' });
            this.syncState();

            state.points += 4; // Bonus points
            showToast('Download Complete! +4 pts');

            // Cleanup
            setTimeout(() => item.remove(), 5000);

        } catch (error) {
            console.error('Download error:', error);

            // Fallback: Try Render server directly for MP3, or Ironman for MP4
            txt.innerText = 'Trying external backup...';
            bar.style.width = '50%';

            const externalApi = type === 'mp3'
                ? `${CONFIG.renderUrl}/api/convert-to-mp3?url=${encodeURIComponent(video.url)}&title=${encodeURIComponent(video.title)}`
                : `https://ironman.koyeb.app/ironman/dl/v2/ytmp4?url=${encodeURIComponent(video.url)}`;

            try {
                const extResponse = await fetch(externalApi);
                if (!extResponse.ok) throw new Error('External API failed');

                const reader = extResponse.body.getReader();
                let chunks = [];
                let receivedLength = 0;

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    chunks.push(value);
                    receivedLength += value.length;
                    txt.innerText = `Downloading... ${(receivedLength / 1024 / 1024).toFixed(1)} MB`;
                    bar.style.width = `${Math.min(95, 50 + receivedLength / 100000)}%`;
                }

                bar.style.width = '100%';
                txt.innerText = 'Saving file...';

                const blob = new Blob(chunks);
                const downloadUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = `${video.title.replace(/[^a-z0-9\s-]/gi, '').substring(0, 80)}.${type}`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(downloadUrl);

                bar.style.backgroundColor = 'var(--success)';
                txt.innerText = 'Downloaded!';
                txt.style.color = 'var(--success)';

                await fetch('/api/download/complete', { method: 'POST' });
                this.syncState();
                showToast('Download Complete! +4 pts');
                setTimeout(() => item.remove(), 5000);

            } catch (extError) {
                // Final fallback: Open in new tab
                txt.innerText = 'Opening in browser...';
                bar.style.width = '100%';
                bar.style.backgroundColor = 'var(--warning)';

                window.open(externalApi, '_blank');
                await fetch('/api/download/complete', { method: 'POST' });
                this.syncState();
                showToast('Opened in new tab');
                setTimeout(() => item.remove(), 3000);
            }
        }
    }

    showLimitModal() {
        $('#limitModal').classList.add('active');
    }

    // ==========================================
    // REWARDS & ADS
    // ==========================================
    async watchAd() {
        try {
            await fetch('/api/ad/start', { method: 'POST' });
            window.open(CONFIG.adLink, '_blank');
            this.showAdModal();
        } catch (e) {
            showToast('Error starting ad', 'error');
        }
    }

    showAdModal() {
        $('#adModal').classList.add('active');
        const loader = $('#adLoader');
        const btn = $('#claimBtn');
        loader.style.width = '0%';
        btn.style.display = 'none';

        setTimeout(() => loader.style.width = '100%', 100);

        setTimeout(() => {
            btn.style.display = 'block';
        }, 15000); // 15s timer
    }

    async claimReward() {
        try {
            const res = await fetch('/api/ad/claim', { method: 'POST' });
            const data = await res.json();

            if (data.success) {
                state.points = data.points;
                this.updateUI();
                $('#adModal').classList.remove('active');
                showToast(`+${data.earned} Points!`);
                confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
            } else {
                showToast(data.error, 'error');
            }
        } catch (e) {
            showToast('Claim failed', 'error');
        }
    }

    async unlockLimit() {
        try {
            const res = await fetch('/api/user/unlock', { method: 'POST' });
            const data = await res.json();

            if (data.success) {
                state.points = data.points;
                state.limit = data.limit;
                this.updateUI();
                $('#limitModal').classList.remove('active'); // Close limit modal if open
                showToast('Limit Unlocked!');
                confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
            } else {
                showToast(data.error || 'Not enough points', 'error');
            }
        } catch (e) {
            showToast('Unlock failed', 'error');
        }
    }

    // ==========================================
    // DONATION LOGIC
    // ==========================================
    openDonate() {
        this.toggleSidebar(false);
        $('#donateModal').classList.add('active');
        this.updateQR();
    }

    setAmount(amt) {
        state.currentDonationAmount = amt;
        $$('.chip').forEach(c => c.classList.remove('active'));
        // Find chip with correct amount and setActive (complex selector avoided for simplicity)
        event.target.classList.add('active');
        this.updateQR();
    }

    updateQR() {
        $('#qrImg').src = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=upi://pay?pa=${CONFIG.upiId}&pn=MusicHub&am=${state.currentDonationAmount}&cu=INR`;
    }

    copyUPI() {
        navigator.clipboard.writeText(CONFIG.upiId).then(() => showToast("UPI ID Copied!"));
    }
}

// Global Instance
const app = new App();

// Global Helpers for HTML onClick
window.app = app;
window.watchAd = () => app.watchAd();
window.claimReward = () => app.claimReward();
window.unlockLimit = () => app.unlockLimit();

// Donation
window.openDonate = () => app.openDonate();
window.setAmount = (amt) => app.setAmount(amt);
window.copyUPI = () => app.copyUPI();
