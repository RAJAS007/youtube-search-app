"""
MusicHub Pytubefix API - Fallback Download Engine
Provides streaming endpoints for YouTube video/audio downloads
"""

from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from pytubefix import YouTube
import re
import io

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# ==========================================
# UTILITY FUNCTIONS
# ==========================================

def is_valid_youtube_url(url):
    """Validate YouTube URL formats"""
    patterns = [
        r"^(https?://)?(www\.)?youtube\.com/watch\?v=[\w-]+",
        r"^(https?://)?(www\.)?youtu\.be/[\w-]+",
        r"^(https?://)?(www\.)?youtube\.com/shorts/[\w-]+"
    ]
    return any(re.match(pattern, url) for pattern in patterns)

def get_video_id(url):
    """Extract video ID from various YouTube URL formats"""
    patterns = [
        r"(?:v=|youtu\.be/|shorts/)([a-zA-Z0-9_-]{11})"
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

# ==========================================
# API ENDPOINTS
# ==========================================

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "engine": "pytubefix",
        "version": "1.0.0"
    })

@app.route('/api/info', methods=['GET'])
def video_info():
    """Get video information - GET method for easy use"""
    url = request.args.get('url')
    
    if not url:
        return jsonify({"error": "Missing 'url' parameter"}), 400
    
    if not is_valid_youtube_url(url):
        return jsonify({"error": "Invalid YouTube URL"}), 400
    
    try:
        yt = YouTube(url)
        
        # Get available resolutions
        progressive = list(set([
            s.resolution for s in yt.streams.filter(progressive=True, file_extension='mp4')
            if s.resolution
        ]))
        all_res = list(set([
            s.resolution for s in yt.streams.filter(file_extension='mp4')
            if s.resolution
        ]))
        
        return jsonify({
            "title": yt.title,
            "author": yt.author,
            "length": yt.length,
            "views": yt.views,
            "thumbnail": yt.thumbnail_url,
            "resolutions": {
                "progressive": sorted(progressive, key=lambda x: int(x.replace('p', '')), reverse=True),
                "all": sorted(all_res, key=lambda x: int(x.replace('p', '')), reverse=True)
            }
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/stream/mp4', methods=['GET'])
def stream_mp4():
    """Stream MP4 video directly to client"""
    url = request.args.get('url')
    resolution = request.args.get('resolution', '720p')
    
    if not url:
        return jsonify({"error": "Missing 'url' parameter"}), 400
    
    if not is_valid_youtube_url(url):
        return jsonify({"error": "Invalid YouTube URL"}), 400
    
    try:
        yt = YouTube(url)
        title = yt.title
        safe_title = re.sub(r'[^\w\s-]', '', title)[:80].strip()
        
        print(f"[Pytubefix] Requested quality: {resolution} for '{title}'")
        
        stream = None
        
        # Handle 'Highest' quality option
        if resolution == 'Highest':
            stream = yt.streams.filter(
                progressive=True, 
                file_extension='mp4'
            ).order_by('resolution').desc().first()
            print(f"[Pytubefix] Highest quality selected: {stream.resolution if stream else 'None'}")
        else:
            # Try requested resolution
            stream = yt.streams.filter(
                progressive=True, 
                file_extension='mp4', 
                resolution=resolution
            ).first()
            
            if stream:
                print(f"[Pytubefix] Found exact match: {resolution}")
        
        # Fallback chain: 720p -> 480p -> 360p -> any
        if not stream:
            for fallback_res in ['720p', '480p', '360p']:
                stream = yt.streams.filter(
                    progressive=True, 
                    file_extension='mp4', 
                    resolution=fallback_res
                ).first()
                if stream:
                    print(f"[Pytubefix] Using fallback: {fallback_res}")
                    break
        
        if not stream:
            # Last resort: any progressive mp4
            stream = yt.streams.filter(
                progressive=True, 
                file_extension='mp4'
            ).order_by('resolution').desc().first()
            print(f"[Pytubefix] Using any available: {stream.resolution if stream else 'None'}")
        
        if not stream:
            return jsonify({"error": "No suitable stream found"}), 404
        
        print(f"[Pytubefix] Streaming: {stream.resolution} - {stream.filesize_mb:.1f}MB")
        
        # Stream the video
        def generate():
            buffer = io.BytesIO()
            stream.stream_to_buffer(buffer)
            buffer.seek(0)
            while chunk := buffer.read(8192):
                yield chunk
        
        return Response(
            generate(),
            mimetype='video/mp4',
            headers={
                'Content-Disposition': f'attachment; filename="{safe_title}.mp4"',
                'Content-Type': 'video/mp4',
                'X-Video-Quality': stream.resolution or 'unknown'
            }
        )
        
    except Exception as e:
        print(f"[Pytubefix] Error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/stream/mp3', methods=['GET'])
def stream_mp3():
    """Stream audio as MP3 (actually M4A/AAC for speed)"""
    url = request.args.get('url')
    
    if not url:
        return jsonify({"error": "Missing 'url' parameter"}), 400
    
    if not is_valid_youtube_url(url):
        return jsonify({"error": "Invalid YouTube URL"}), 400
    
    try:
        yt = YouTube(url)
        title = yt.title
        safe_title = re.sub(r'[^\w\s-]', '', title)[:80].strip()
        
        # Get best audio stream
        stream = yt.streams.filter(only_audio=True).order_by('abr').desc().first()
        
        if not stream:
            return jsonify({"error": "No audio stream found"}), 404
        
        # Stream the audio
        def generate():
            buffer = io.BytesIO()
            stream.stream_to_buffer(buffer)
            buffer.seek(0)
            while chunk := buffer.read(8192):
                yield chunk
        
        # Note: Pytubefix gives m4a/webm audio, not true mp3
        # For true mp3, would need FFmpeg conversion
        ext = stream.subtype  # e.g., 'mp4' or 'webm'
        mime = 'audio/mp4' if ext == 'mp4' else 'audio/webm'
        
        return Response(
            generate(),
            mimetype=mime,
            headers={
                'Content-Disposition': f'attachment; filename="{safe_title}.{ext}"',
                'Content-Type': mime
            }
        )
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/resolutions', methods=['GET'])
def get_resolutions():
    """Get available resolutions for a video"""
    url = request.args.get('url')
    
    if not url:
        return jsonify({"error": "Missing 'url' parameter"}), 400
    
    if not is_valid_youtube_url(url):
        return jsonify({"error": "Invalid YouTube URL"}), 400
    
    try:
        yt = YouTube(url)
        
        progressive = list(set([
            s.resolution for s in yt.streams.filter(progressive=True, file_extension='mp4')
            if s.resolution
        ]))
        
        return jsonify({
            "progressive": sorted(progressive, key=lambda x: int(x.replace('p', '')), reverse=True),
            "recommended": progressive[0] if progressive else "360p"
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==========================================
# LEGACY ENDPOINTS (for compatibility)
# ==========================================

@app.route('/download/<resolution>', methods=['POST'])
def download_by_resolution(resolution):
    """Legacy download endpoint (saves to server - not recommended)"""
    data = request.get_json()
    url = data.get('url') if data else None
    
    if not url:
        return jsonify({"error": "Missing 'url' parameter"}), 400
    
    if not is_valid_youtube_url(url):
        return jsonify({"error": "Invalid YouTube URL"}), 400
    
    try:
        yt = YouTube(url)
        stream = yt.streams.filter(
            progressive=True, 
            file_extension='mp4', 
            resolution=resolution
        ).first()
        
        if stream:
            import os
            video_id = get_video_id(url) or 'unknown'
            out_dir = f"./downloads/{video_id}"
            os.makedirs(out_dir, exist_ok=True)
            stream.download(output_path=out_dir)
            return jsonify({"message": f"Downloaded {resolution} successfully"}), 200
        else:
            return jsonify({"error": f"Resolution {resolution} not available"}), 404
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/video_info', methods=['POST'])
def video_info_legacy():
    """Legacy video info endpoint"""
    data = request.get_json()
    url = data.get('url') if data else None
    
    if not url:
        return jsonify({"error": "Missing 'url' parameter"}), 400
    
    if not is_valid_youtube_url(url):
        return jsonify({"error": "Invalid YouTube URL"}), 400
    
    try:
        yt = YouTube(url)
        return jsonify({
            "title": yt.title,
            "author": yt.author,
            "length": yt.length,
            "views": yt.views,
            "description": yt.description,
            "publish_date": str(yt.publish_date) if yt.publish_date else None
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==========================================
# MAIN
# ==========================================

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))
    print(f"[Pytubefix API] Starting on port {port}")
    print(f"[Endpoints]")
    print(f"   GET  /api/health")
    print(f"   GET  /api/info?url=...")
    print(f"   GET  /api/stream/mp4?url=...&resolution=720p")
    print(f"   GET  /api/stream/mp3?url=...")
    print(f"   GET  /api/resolutions?url=...")
    app.run(host='0.0.0.0', port=port, debug=False)
