/**
 * MusicHub Premium - Main Script
 * Version: 3.0
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
    favorites: JSON.parse(localStorage.getItem('mh_favorites') || '[]'),
    playlists: JSON.parse(localStorage.getItem('mh_playlists') || '[]'),
    searchHistory: JSON.parse(localStorage.getItem('mh_search_history') || '[]'),
    activeDownloads: [],
    lastResults: []
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
            chip.addEventListener('click', () => {
                $('#searchInput').value = chip.innerText.replace(/[^\w\s]/gi, '').trim();
                this.handleSearch($('#searchInput').value);
            });
        });

        // Nav Links
        $('#navFavs').addEventListener('click', () => this.showFavorites());
        $('#navPlaylists').addEventListener('click', () => this.showPlaylists());
        
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
            this.updateUI();
        } catch (e) {
            console.error('Sync failed', e);
        }
    }

    updateUI() {
        $('#ptsDisplay').innerText = state.points;
        $('#sbPts').innerText = state.points;
        $('#sbLimit').innerText = `${state.count}/${state.limit}`;
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
    // DOWNLOAD MANAGER
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

            // Start Download
            this.addDownloadItem(video, type);
            this.processDownload(video, type);

        } catch (e) {
            showToast('Network Error', 'error');
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

    async processDownload(video, type) {
        // Simulated progress for UX
        const item = $('#dlManagerList').firstElementChild;
        const bar = item.querySelector('.dl-fill');
        const txt = item.querySelector('.status-text');
        
        let p = 0;
        const interval = setInterval(() => {
            p += Math.random() * 5;
            if (p > 90) p = 90;
            bar.style.width = p + '%';
            txt.innerText = 'Converting...';
        }, 200);

        // Actual Request
        const endpoint = type === 'mp3' ? '/api/convert-to-mp3' : '/api/download-mp4';
        const url = `${CONFIG.renderUrl}${endpoint}?url=${encodeURIComponent(video.url)}&title=${encodeURIComponent(video.title)}`;

        // Trigger Hidden Download
        const frame = document.createElement('iframe');
        frame.style.display = 'none';
        frame.src = url;
        document.body.appendChild(frame);

        // Cleanup simulation after presumed start
        setTimeout(async () => {
            clearInterval(interval);
            bar.style.width = '100%';
            bar.style.backgroundColor = 'var(--success)';
            txt.innerText = 'Downloaded!';
            txt.style.color = 'var(--success)';
            
            // Register download
            await fetch('/api/download/complete', { method: 'POST' });
            this.syncState();
            
            setTimeout(() => { frame.remove(); item.remove(); }, 5000);
        }, 4000);
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
}

// Global Instance
const app = new App();

// Global Helpers for HTML onClick (simpler than bindings sometimes)
window.app = app;
window.watchAd = () => app.watchAd();
window.claimReward = () => app.claimReward();
window.unlockLimit = () => app.unlockLimit();
