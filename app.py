import os
import io
import time
from flask import Flask, request, jsonify, send_file, Response
from flask_cors import CORS
import yt_dlp

app = Flask(__name__)
CORS(app)  # Enable Cross-Origin requests so your HTML can talk to this app

# --- HELPER: SEARCH YOUTUBE ---
def search_youtube(query):
    ydl_opts = {
        'format': 'best',
        'noplaylist': True,
        'quiet': True,
        'extract_flat': True,  # Don't download, just get metadata
        'default_search': 'ytsearch8', # Return top 8 results
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(query, download=False)
            if 'entries' in info:
                return info['entries']
            return [info]
        except Exception as e:
            print(f"Search Error: {e}")
            return []

# --- ROUTE: SEARCH API ---
# Matches your HTML: fetch(`/api/search?q=${...}`)
@app.route('/api/search', methods=['GET'])
def api_search():
    query = request.args.get('q')
    if not query:
        return jsonify({'error': 'No query provided'}), 400
    
    results = search_youtube(query)
    
    # Format data to match your HTML's expectations
    videos = []
    for item in results:
        videos.append({
            'videoId': item.get('id'),
            'title': item.get('title'),
            'thumbnail': item.get('thumbnails', [{}])[0].get('url') if item.get('thumbnails') else None,
            'duration': item.get('duration'),
            'author': {'name': item.get('uploader')}
        })
    
    return jsonify({'videos': videos})

# --- ROUTE: DOWNLOAD & CONVERT ---
# Handles the "Video -> Audio" conversion logic
@app.route('/api/download', methods=['GET'])
def api_download():
    video_url = request.args.get('url')
    fmt = request.args.get('format', 'mp4') # 'mp3' or 'mp4'

    if not video_url:
        return jsonify({'error': 'Missing URL'}), 400

    # Stream the file directly back to the user without saving permanently
    # Note: For large files in production, you might want to save to a temp folder first.
    
    try:
        # Options for yt-dlp
        ydl_opts = {
            'format': 'bestaudio/best' if fmt == 'mp3' else 'bestvideo+bestaudio/best',
            'outtmpl': '-', # Output to stdout (stream)
            'quiet': True,
            'logtostderr': True,
        }

        # SPECIAL LOGIC: If MP3, convert video/audio to MP3
        if fmt == 'mp3':
            ydl_opts['postprocessors'] = [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }]

        # Generator to stream the download
        def stream_download():
            # We use a subprocess approach usually for streaming, 
            # but for simplicity in Flask + yt-dlp, we can point yt-dlp to a buffer 
            # or simply return the direct URL if we don't want to proxy the traffic.
            
            # METHOD A: Direct Download Proxy (Best for bypassing restrictions)
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=False)
                download_url = info['url']
                
                # If it's a direct stream link (like raw MP4), request it and yield chunks
                import requests
                with requests.get(download_url, stream=True) as r:
                    for chunk in r.iter_content(chunk_size=4096):
                        yield chunk

        # NOTE: A true "Convert and Stream" is complex because you need to pipe FFmpeg output.
        # For a robust MVP, we will Download to Temp -> Send -> Delete.
        
        # METHOD B: Download -> Process -> Send (Reliable)
        temp_filename = f"temp_{int(time.time())}_{hash(video_url)}.{fmt}"
        
        final_opts = {
            'format': 'bestaudio/best' if fmt == 'mp3' else 'best', # Simplified for MP4
            'outtmpl': temp_filename,
            'quiet': True
        }
        
        if fmt == 'mp3':
            final_opts['postprocessors'] = [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }]
            # yt-dlp automatically changes extension to .mp3 after conversion
            target_file = temp_filename.replace(f'.{fmt}', '.mp3')
        else:
            target_file = temp_filename

        with yt_dlp.YoutubeDL(final_opts) as ydl:
            ydl.download([video_url])

        # Send file and then remove it
        return_data = io.BytesIO()
        with open(target_file, 'rb') as fo:
            return_data.write(fo.read())
        return_data.seek(0)
        
        os.remove(target_file)
        
        return send_file(
            return_data,
            as_attachment=True,
            download_name=f"download.{fmt}",
            mimetype=f"audio/mpeg" if fmt == 'mp3' else "video/mp4"
        )

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Ensure you have ffmpeg installed on your system!
    app.run(debug=True, port=5000)
