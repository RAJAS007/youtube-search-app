<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Music Downloader (YT & Spotify)</title>
    
    <link rel="preconnect" href="https://i.ytimg.com">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #f9f9f9;
            --text-main: #0f0f0f;
            --text-sec: #606060;
            --yt-red: #ff0000;
            --spotify-green: #1db954;
            --accent-blue: #3ea6ff;
            --success-green: #2ba640;
            --error-red: #cc0000;
            --shadow-card: 0 4px 12px rgba(0,0,0,0.08);
            --header-height: 60px;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Roboto', sans-serif; -webkit-tap-highlight-color: transparent; }
        
        body {
            background-color: var(--bg-color);
            color: var(--text-main);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            overflow-x: hidden;
        }

        /* --- HEADER --- */
        header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 24px;
            height: var(--header-height);
            background: white;
            position: sticky;
            top: 0;
            z-index: 100;
            box-shadow: 0 1px 0 rgba(0,0,0,0.05);
            transition: all 0.3s ease;
        }

        .logo-section {
            display: flex;
            align-items: center;
            gap: 12px;
            cursor: pointer;
            user-select: none;
            flex-shrink: 0;
        }
        
        .logo-group { display: flex; align-items: center; gap: 5px; }
        .logo-icon { font-size: 28px; }
        .logo-icon.yt { color: var(--yt-red); }
        .logo-icon.sp { color: var(--spotify-green); }
        .logo-divider { color: #ddd; font-size: 20px; }
        
        .logo-text-main { font-size: 20px; font-weight: 700; letter-spacing: -1px; color: #212121; }
        .logo-text-sub { font-size: 20px; font-weight: 400; letter-spacing: -0.5px; color: #212121; }

        /* Search Bar Wrapper */
        .search-center {
            flex: 1;
            display: flex;
            justify-content: center;
            max-width: 600px;
            margin: 0 20px;
        }

        .search-box {
            display: flex;
            width: 100%;
            height: 40px;
            border-radius: 40px;
            border: 1px solid #ccc;
            overflow: hidden;
            background: #fff;
            box-shadow: inset 0 1px 2px #eee;
            transition: box-shadow 0.2s, border 0.2s;
        }

        .search-box:focus-within {
            border-color: #1c62b9;
            box-shadow: 0 1px 6px rgba(32, 33, 36, 0.28);
        }

        #searchInput {
            flex: 1;
            border: none;
            padding: 0 16px;
            font-size: 16px;
            outline: none;
            min-width: 0;
        }

        #searchButton {
            width: 60px;
            background: #f8f8f8;
            border: none;
            border-left: 1px solid #ccc;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }
        #searchButton i { color: #333; font-size: 18px; }

        /* --- MAIN LAYOUT --- */
        .container {
            padding: 20px;
            max-width: 1400px;
            margin: 0 auto;
            width: 100%;
            flex: 1;
        }

        .empty-state {
            text-align: center;
            margin-top: 10vh;
            color: var(--text-sec);
            padding: 20px;
            animation: fadeIn 0.5s ease;
        }
        .empty-state i { font-size: 60px; margin-bottom: 20px; opacity: 0.15; }
        .empty-state h2 { font-weight: 500; margin-bottom: 8px; color: #333; font-size: 1.4rem; }
        
        .badges {
            display: flex;
            justify-content: center;
            gap: 10px;
            margin-top: 15px;
        }
        .badge {
            background: #e5e5e5;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .badge.yt-badge { color: var(--yt-red); background: #ffe6e6; }
        .badge.sp-badge { color: var(--spotify-green); background: #e6ffe6; }

        /* --- GRID --- */
        .video-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 24px;
            display: none;
            padding-bottom: 40px;
        }
        .video-grid.active { display: grid; }
        
        .video-grid.single-mode {
            display: flex;
            justify-content: center;
        }
        .video-grid.single-mode .video-card {
            max-width: 450px;
            width: 100%;
        }

        /* --- CARDS --- */
        .video-card {
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: var(--shadow-card);
            transform: translateZ(0);
            display: flex;
            flex-direction: column;
            transition: transform 0.2s, box-shadow 0.2s;
        }

        .video-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.12); }

        .thumb {
            position: relative;
            padding-top: 56.25%;
            background: #e0e0e0;
        }
        .thumb img {
            position: absolute;
            top: 0; left: 0; width: 100%; height: 100%;
            object-fit: cover;
            opacity: 0;
            transition: opacity 0.3s ease-in;
        }
        .thumb img.loaded { opacity: 1; }

        .duration-badge {
            position: absolute;
            bottom: 6px;
            right: 6px;
            background-color: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 2px 4px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 500;
        }

        .details { padding: 14px; display: flex; flex-direction: column; flex: 1; gap: 6px; }

        .title {
            font-size: 16px;
            font-weight: 500;
            line-height: 1.3;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            color: var(--text-main);
            margin-bottom: 2px;
        }

        .meta { font-size: 13px; color: var(--text-sec); display: flex; align-items: center; gap: 5px; }
        .actions { margin-top: auto; padding-top: 10px; display: flex; gap: 10px; }

        .btn {
            flex: 1;
            padding: 10px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 500;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            font-size: 14px;
            height: 40px;
            transition: background 0.2s;
        }
        
        .btn-mp3 { background: #0f0f0f; color: white; }
        .btn-mp3:hover { background: #333; }
        .btn-mp4 { background: #f2f2f2; color: #0f0f0f; }
        .btn-mp4:hover { background: #e5e5e5; }

        /* --- SKELETON LOADER --- */
        .skeleton { background: #f0f0f0; position: relative; overflow: hidden; }
        .skeleton::after {
            content: '';
            position: absolute;
            top: 0; right: 0; bottom: 0; left: 0;
            transform: translateX(-100%);
            background-image: linear-gradient(90deg, rgba(255,255,255,0) 0, rgba(255,255,255,0.5) 20%, rgba(255,255,255,0.8) 60%, rgba(255,255,255,0));
            animation: shimmer 1.5s infinite;
        }
        @keyframes shimmer { 100% { transform: translateX(100%); } }
        .skel-card { background: white; border-radius: 12px; overflow: hidden; box-shadow: var(--shadow-card); }
        .skel-thumb { padding-top: 56.25%; width: 100%; }
        .skel-details { padding: 14px; gap: 10px; display: flex; flex-direction: column; }
        .skel-line { height: 16px; border-radius: 4px; width: 90%; }
        .skel-line.short { width: 60%; }
        .skel-btns { display: flex; gap: 10px; margin-top: 10px; }
        .skel-btn { flex: 1; height: 40px; border-radius: 8px; }

        /* --- MINI POPUP --- */
        .mini-popup {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: white;
            width: 360px;
            padding: 24px;
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            z-index: 1000;
            display: none;
            animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        .popup-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .popup-title { font-weight: 600; font-size: 15px; color: #333; }
        .popup-close { cursor: pointer; color: #999; padding: 5px; font-size: 20px; }
        .popup-content { display: flex; align-items: center; gap: 15px; }
        .format-badge { background: #0f0f0f; color: white; font-size: 12px; font-weight: 700; padding: 8px 0; width: 45px; border-radius: 8px; text-transform: uppercase; text-align: center; flex-shrink: 0; }
        .progress-area { flex: 1; }
        .progress-text { font-size: 12px; color: var(--text-sec); margin-bottom: 6px; display: flex; justify-content: space-between; }
        .progress-bar { height: 4px; background: #eee; border-radius: 2px; overflow: hidden; position: relative; }
        .progress-fill { height: 100%; background: var(--accent-blue); width: 0%; border-radius: 2px; transition: width 0.1s linear; }
        .progress-fill.complete { background: var(--success-green); }
        .progress-fill.error { background: var(--error-red); }
        .progress-fill.indeterminate { width: 100%; background: linear-gradient(90deg, var(--accent-blue) 25%, #85cbfd 50%, var(--accent-blue) 75%); background-size: 200% 100%; animation: loading 1.5s infinite linear; }
        @keyframes loading { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }

        /* --- MOBILE OPTIMIZATION --- */
        @media (max-width: 600px) {
            header { 
                padding: 0 12px;
                gap: 8px;
            }

            /* On mobile, stack logo elements or hide text */
            .logo-text-main, .logo-text-sub {
                display: none; 
            }
            
            .search-center { 
                margin: 0; 
                flex: 1; 
            }
            
            .search-box { width: 100%; }
            #searchButton { width: 50px; }

            .container { padding: 12px; }
            .video-grid { grid-template-columns: 1fr; gap: 20px; }
            
            .mini-popup {
                width: 100%;
                right: 0; bottom: 0; left: 0;
                border-radius: 20px 20px 0 0;
                padding: 20px 20px 40px 20px;
                box-shadow: 0 -5px 30px rgba(0,0,0,0.15);
            }
        }
        
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    </style>
</head>
<body>

    <header>
        <div class="logo-section" onclick="location.reload()">
            <div class="logo-group">
                <i class="fab fa-youtube logo-icon yt"></i>
                <div class="logo-divider">/</div>
                <i class="fab fa-spotify logo-icon sp"></i>
            </div>
            <span class="logo-text-main">Music</span>
            <span class="logo-text-sub">Downloader</span>
        </div>
        
        <div class="search-center">
            <div class="search-box">
                <input type="text" id="searchInput" placeholder="Search song or paste YT/Spotify link...">
                <button id="searchButton">
                    <i class="fas fa-search"></i>
                </button>
            </div>
        </div>
    </header>

    <div class="container">
        <div class="empty-state" id="emptyState">
            <i class="fas fa-cloud-download-alt"></i>
            <h2>Ready to Download</h2>
            <p>Support for YouTube Links, Spotify Links, and Search.</p>
            <div class="badges">
                <span class="badge yt-badge"><i class="fab fa-youtube"></i> YouTube</span>
                <span class="badge sp-badge"><i class="fab fa-spotify"></i> Spotify</span>
            </div>
        </div>

        <div class="video-grid" id="grid"></div>
    </div>

    <div class="mini-popup" id="downloadPopup">
        <div class="popup-header">
            <span class="popup-title">Downloading...</span>
            <i class="fas fa-times popup-close" onclick="closePopup()"></i>
        </div>
        <div class="popup-content">
            <div class="format-badge" id="popFormat">MP3</div>
            <div class="progress-area">
                <div class="progress-text">
                    <span id="popStatus">Connecting...</span>
                    <span id="popPercent">0%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" id="popBar"></div>
                </div>
            </div>
        </div>
    </div>

    <script>
        const CONFIG = {
            mp3Api: 'https://ironman.koyeb.app/ironman/dl/v2/ytmp3?url=',
            mp4Api: 'https://ironman.koyeb.app/ironman/dl/v2/ytmp4?url='
        };

        const ui = {
            input: document.getElementById('searchInput'),
            btn: document.getElementById('searchButton'),
            grid: document.getElementById('grid'),
            empty: document.getElementById('emptyState'),
            popup: document.getElementById('downloadPopup'),
            popFormat: document.getElementById('popFormat'),
            popBar: document.getElementById('popBar'),
            popStatus: document.getElementById('popStatus'),
            popPercent: document.getElementById('popPercent')
        };

        // --- SKELETON LOADER ---
        function showSkeletons(count = 8) {
            let html = '';
            for(let i=0; i<count; i++) {
                html += `
                <div class="skel-card">
                    <div class="skel-thumb skeleton"></div>
                    <div class="skel-details">
                        <div class="skel-line skeleton"></div>
                        <div class="skel-line short skeleton"></div>
                        <div class="skel-line short skeleton" style="width: 30%; margin-top: 5px;"></div>
                        <div class="skel-btns">
                            <div class="skel-btn skeleton"></div>
                            <div class="skel-btn skeleton"></div>
                        </div>
                    </div>
                </div>`;
            }
            ui.grid.innerHTML = html;
            ui.grid.classList.add('active');
            ui.grid.classList.remove('single-mode');
        }

        // --- SEARCH LOGIC ---
        async function handleSearch() {
            let query = ui.input.value.trim();
            if(!query) return;

            ui.input.blur();
            ui.empty.style.display = 'none';
            showSkeletons(8);

            // 1. CHECK FOR SPOTIFY LINK
            if (query.includes('spotify.com')) {
                try {
                    // Update UI to show we are resolving
                    ui.grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 40px; color:#666;"><h3><i class="fab fa-spotify" style="color:#1db954"></i> Resolving Spotify Link...</h3></div>';
                    
                    const res = await fetch(`/api/resolve?url=${encodeURIComponent(query)}`);
                    const data = await res.json();
                    
                    if (data.title) {
                        // Use the resolved title to search YouTube
                        query = data.title;
                        // Continue to standard search flow below...
                    } else {
                        throw new Error('Could not resolve Spotify link');
                    }
                } catch (e) {
                    ui.grid.classList.remove('active');
                    ui.empty.style.display = 'block';
                    ui.empty.innerHTML = '<h2>Spotify Error</h2><p>Could not read track info. Try searching by name.</p>';
                    return;
                }
            }

            // 2. STANDARD YOUTUBE SEARCH (Used for converted Spotify links too)
            const videoId = extractID(query);
            const searchQuery = videoId || query;

            try {
                // Re-show skeletons if we just came from Spotify resolve
                showSkeletons(8);
                
                const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
                const data = await res.json();

                if(data.videos && data.videos.length > 0) {
                    let videos = data.videos;
                    // If user pasted a direct YT link, show only that video
                    if(videoId) {
                        videos = [data.videos[0]]; 
                        ui.grid.classList.add('single-mode');
                    } else {
                        ui.grid.classList.remove('single-mode');
                    }
                    renderVideos(videos);
                } else {
                    ui.grid.classList.remove('active');
                    ui.empty.style.display = 'block';
                    ui.empty.innerHTML = '<h2>No results found</h2><p>Check the link or try another keyword.</p>';
                }
            } catch(e) {
                ui.grid.classList.remove('active');
                ui.empty.style.display = 'block';
                ui.empty.innerHTML = '<h2>Connection Error</h2><p>Please try again later.</p>';
            }
        }

        function renderVideos(videos) {
            ui.grid.innerHTML = videos.map(v => {
                const title = v.title.replace(/"/g, '&quot;');
                const thumb = v.thumbnail || `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`;
                const url = `https://www.youtube.com/watch?v=${v.videoId}`;
                const duration = formatYoutubeTime(v.duration?.seconds || v.duration);
                const safeName = v.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();

                return `
                <div class="video-card">
                    <div class="thumb">
                        <img src="${thumb}" alt="thumb" loading="lazy" onload="this.classList.add('loaded')">
                        ${duration ? `<div class="duration-badge">${duration}</div>` : ''}
                    </div>
                    <div class="details">
                        <div class="title">${title}</div>
                        <div class="meta">${v.author?.name || 'Unknown'}</div>
                        <div class="actions">
                            <button class="btn btn-mp3" onclick="triggerDownload('${url}', 'mp3', '${safeName}')">
                                <i class="fas fa-music"></i> Audio
                            </button>
                            <button class="btn btn-mp4" onclick="triggerDownload('${url}', 'mp4', '${safeName}')">
                                <i class="fas fa-video"></i> Video
                            </button>
                        </div>
                    </div>
                </div>`;
            }).join('');
        }

        // --- SECURE DOWNLOAD (No Redirects) ---
        async function triggerDownload(url, format, filename) {
            ui.popup.style.display = 'block';
            ui.popFormat.textContent = format.toUpperCase();
            ui.popBar.style.width = '0%';
            ui.popBar.className = 'progress-fill';
            ui.popStatus.textContent = 'Connecting...';
            ui.popPercent.textContent = '0%';
            
            const api = format === 'mp3' ? CONFIG.mp3Api : CONFIG.mp4Api;
            const targetUrl = api + url;

            try {
                const response = await fetch(targetUrl);
                if (!response.ok) throw new Error(`API Error: ${response.status}`);
                
                const reader = response.body.getReader();
                const contentLength = +response.headers.get('Content-Length');
                let receivedLength = 0;
                let chunks = [];

                while(true) {
                    const {done, value} = await reader.read();
                    if (done) break;
                    chunks.push(value);
                    receivedLength += value.length;

                    if(contentLength) {
                        const percent = Math.floor((receivedLength / contentLength) * 100);
                        ui.popBar.style.width = `${percent}%`;
                        ui.popPercent.textContent = `${percent}%`;
                        ui.popStatus.textContent = 'Downloading...';
                    } else {
                        if(!ui.popBar.classList.contains('indeterminate')) {
                            ui.popBar.classList.add('indeterminate');
                            ui.popPercent.textContent = '';
                            ui.popStatus.textContent = 'Downloading...';
                        }
                    }
                }

                ui.popStatus.textContent = 'Saving file...';
                const blob = new Blob(chunks);
                const blobUrl = window.URL.createObjectURL(blob);
                
                ui.popBar.classList.remove('indeterminate');
                ui.popBar.classList.add('complete');
                ui.popBar.style.width = '100%';
                ui.popPercent.textContent = '100%';
                ui.popStatus.textContent = 'Download Complete';

                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = `${filename}.${format}`;
                document.body.appendChild(a);
                a.click();
                
                setTimeout(() => {
                    window.URL.revokeObjectURL(blobUrl);
                    document.body.removeChild(a);
                    closePopup();
                }, 4000);

            } catch (error) {
                console.error("Download failed:", error);
                ui.popBar.classList.remove('indeterminate');
                ui.popBar.classList.add('error');
                ui.popBar.style.width = '100%';
                ui.popStatus.textContent = 'Download Failed (API Error)';
                ui.popPercent.textContent = '!';
            }
        }

        function closePopup() {
            ui.popup.style.display = 'none';
        }

        function extractID(url) {
            if(!url) return null;
            const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
            return (match && match[2].length === 11) ? match[2] : null;
        }

        function formatYoutubeTime(s) {
            if (!s) return '';
            const h = Math.floor(s / 3600);
            const m = Math.floor((s % 3600) / 60);
            const sec = Math.floor(s % 60);
            const pad = (num) => num.toString().padStart(2, '0');
            if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
            return `${m}:${pad(sec)}`;
        }

        ui.btn.addEventListener('click', handleSearch);
        ui.input.addEventListener('keypress', e => e.key === 'Enter' && handleSearch());
    </script>
</body>
</html>
