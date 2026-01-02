<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Music Downloader</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        :root { --accent: #3ea6ff; --bg: #f9f9f9; }
        * { box-sizing: border-box; font-family: 'Roboto', sans-serif; }
        body { margin: 0; background: var(--bg); display: flex; flex-direction: column; min-height: 100vh; }
        
        /* HEADER */
        header { background: white; padding: 15px 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); display: flex; gap: 15px; align-items: center; position: sticky; top: 0; z-index: 10; }
        .logo { color: red; font-size: 24px; }
        .search-box { flex: 1; display: flex; background: #eee; border-radius: 40px; overflow: hidden; max-width: 600px; margin: 0 auto; }
        input { border: none; background: transparent; padding: 10px 20px; flex: 1; outline: none; }
        button#searchBtn { border: none; background: #ddd; px: 20px; cursor: pointer; width: 60px; }

        /* GRID */
        .container { padding: 20px; flex: 1; max-width: 1200px; margin: 0 auto; width: 100%; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
        
        /* CARDS */
        .card { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); transition: transform 0.2s; }
        .card:hover { transform: translateY(-5px); }
        .thumb { padding-top: 56.25%; background: #000; position: relative; }
        .thumb img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; }
        .info { padding: 15px; }
        .title { font-weight: 500; margin-bottom: 5px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 14px; }
        .btns { display: flex; gap: 10px; margin-top: 10px; }
        .btn { flex: 1; padding: 8px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 5px; }
        .btn-mp3 { background: #333; color: white; }
        .btn-mp4 { background: #eee; color: #333; }

        /* POPUP */
        .popup { position: fixed; bottom: 20px; right: 20px; background: white; padding: 20px; border-radius: 12px; box-shadow: 0 5px 20px rgba(0,0,0,0.2); width: 300px; display: none; z-index: 100; }
        .bar-bg { background: #eee; height: 5px; border-radius: 5px; margin-top: 10px; overflow: hidden; }
        .bar-fill { height: 100%; background: var(--accent); width: 0%; transition: width 0.2s; }
        .bar-fill.anim { width: 100%; animation: load 1.5s infinite; background: linear-gradient(90deg, var(--accent), #8ecae6, var(--accent)); background-size: 200%; }
        @keyframes load { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
        
        .empty { text-align: center; margin-top: 50px; color: #777; }
    </style>
</head>
<body>

<header>
    <i class="fab fa-youtube logo"></i>
    <div class="search-box">
        <input type="text" id="input" placeholder="Search or paste link...">
        <button id="searchBtn"><i class="fas fa-search"></i></button>
    </div>
</header>

<div class="container">
    <div id="grid" class="grid"></div>
    <div id="empty" class="empty">
        <h2>Ready to Download</h2>
        <p>Paste a YouTube/Spotify link or search for music.</p>
    </div>
</div>

<div class="popup" id="popup">
    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
        <strong id="pStatus">Downloading...</strong>
        <span id="pPct">0%</span>
    </div>
    <div class="bar-bg"><div class="bar-fill" id="pBar"></div></div>
</div>

<script>
    const ui = {
        input: document.getElementById('input'),
        grid: document.getElementById('grid'),
        empty: document.getElementById('empty'),
        popup: document.getElementById('popup'),
        status: document.getElementById('pStatus'),
        bar: document.getElementById('pBar'),
        pct: document.getElementById('pPct')
    };

    // SEARCH
    async function search() {
        let q = ui.input.value.trim();
        if(!q) return;
        
        ui.grid.innerHTML = '';
        ui.empty.style.display = 'none';

        // SPOTIFY RESOLVER
        if(q.includes('spotify.com')) {
            ui.empty.innerText = 'Resolving Spotify Link...';
            ui.empty.style.display = 'block';
            try {
                const res = await fetch(`/api/resolve?url=${encodeURIComponent(q)}`);
                const data = await res.json();
                if(data.title) q = data.title;
            } catch(e) { alert('Could not resolve Spotify link'); return; }
        }

        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        
        if(!data.videos || !data.videos.length) {
            ui.empty.innerText = 'No results found';
            ui.empty.style.display = 'block';
            return;
        }

        ui.empty.style.display = 'none';
        ui.grid.innerHTML = data.videos.map(v => `
            <div class="card">
                <div class="thumb"><img src="${v.thumbnail}"></div>
                <div class="info">
                    <div class="title">${v.title}</div>
                    <div class="btns">
                        <button class="btn btn-mp3" onclick="dl('${v.url}', 'mp3', '${v.title.replace(/'/g,"")}')"><i class="fas fa-music"></i> MP3</button>
                        <button class="btn btn-mp4" onclick="dl('${v.url}', 'mp4', '${v.title.replace(/'/g,"")}')"><i class="fas fa-video"></i> MP4</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // DOWNLOAD LOGIC
    async function dl(url, type, title) {
        ui.popup.style.display = 'block';
        ui.bar.className = 'bar-fill';
        ui.bar.style.width = '0%';
        ui.status.innerText = type === 'mp3' ? 'Converting...' : 'Downloading...';
        
        // MP3 = Use OUR Server (Convert) | MP4 = Use External API directly
        let api = type === 'mp3' 
            ? `/api/convert-to-mp3?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`
            : `https://ironman.koyeb.app/ironman/dl/v2/ytmp4?url=${url}`;

        try {
            const res = await fetch(api);
            if(!res.ok) throw new Error('Download failed');

            const reader = res.body.getReader();
            const total = +res.headers.get('Content-Length');
            let received = 0;
            let chunks = [];

            while(true) {
                const {done, value} = await reader.read();
                if(done) break;
                chunks.push(value);
                received += value.length;
                
                if(total) {
                    const pct = Math.floor((received / total) * 100);
                    ui.bar.style.width = pct + '%';
                    ui.pct.innerText = pct + '%';
                } else {
                    ui.bar.classList.add('anim');
                    ui.pct.innerText = '';
                }
            }

            // Save File
            ui.status.innerText = 'Saving...';
            const blob = new Blob(chunks);
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${title}.${type}`;
            a.click();
            
            setTimeout(() => { ui.popup.style.display = 'none'; }, 2000);

        } catch(e) {
            ui.status.innerText = 'Error!';
            ui.bar.style.background = 'red';
            ui.bar.style.width = '100%';
        }
    }

    document.getElementById('searchBtn').onclick = search;
    ui.input.onkeypress = e => e.key === 'Enter' && search();
</script>

</body>
</html>
