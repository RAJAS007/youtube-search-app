"""
MusicHub Pytubefix API - HD Video Download Engine
Supports high-quality video downloads by merging video+audio streams
"""

from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from pytubefix import YouTube
import re
import io
import subprocess
import tempfile
import os

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

def check_ffmpeg():
    """Check if FFmpeg is available"""
    try:
        result = subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True)
        return result.returncode == 0
    except:
        return False

HAS_FFMPEG = check_ffmpeg()
print(f"[Pytubefix] FFmpeg available: {HAS_FFMPEG}")

# ==========================================
# API ENDPOINTS
# ==========================================

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "engine": "pytubefix",
        "version": "2.0.0",
        "ffmpeg": HAS_FFMPEG,
        "hd_support": HAS_FFMPEG
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
        
        # Get progressive resolutions (video+audio combined)
        progressive = list(set([
            s.resolution for s in yt.streams.filter(progressive=True, file_extension='mp4')
            if s.resolution
        ]))
        
        # Get adaptive resolutions (video only - need merging)
        adaptive = list(set([
            s.resolution for s in yt.streams.filter(adaptive=True, file_extension='mp4', only_video=True)
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
                "adaptive": sorted(adaptive, key=lambda x: int(x.replace('p', '')), reverse=True),
                "hd_available": HAS_FFMPEG and len(adaptive) > 0
            }
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/stream/mp4', methods=['GET'])
def stream_mp4():
    """Stream MP4 video - supports HD quality with FFmpeg merging"""
    url = request.args.get('url')
    resolution = request.args.get('resolution', '720p')
    
    if not url:
        return jsonify({"error": "Missing 'url' parameter"}), 400
    
    if not is_valid_youtube_url(url):
        return jsonify({"error": "Invalid YouTube URL"}), 400
    
    try:
        yt = YouTube(url)
        title = yt.title
        safe_title = re.sub(r'[^\w\s-]', '', title)[:80].strip().replace(' ', '_')
        
        print(f"[Pytubefix] Requested: {resolution} for '{title}'")
        
        # Strategy:
        # 1. Try progressive stream first (has audio, fast, up to 720p usually)
        # 2. If HD requested and FFmpeg available, use adaptive + merge
        # 3. Fallback to best progressive available
        
        video_stream = None
        audio_stream = None
        use_merge = False
        
        # Check if HD quality requested (720p, 1080p, 1440p, etc.)
        hd_resolutions = ['720p', '1080p', '1440p', '2160p', '4320p', 'Highest']
        
        if resolution in hd_resolutions and HAS_FFMPEG:
            # Try adaptive stream for HD
            if resolution == 'Highest':
                video_stream = yt.streams.filter(
                    adaptive=True, 
                    file_extension='mp4',
                    only_video=True
                ).order_by('resolution').desc().first()
            else:
                video_stream = yt.streams.filter(
                    adaptive=True, 
                    file_extension='mp4',
                    only_video=True,
                    resolution=resolution
                ).first()
            
            if video_stream:
                # Get best audio stream
                audio_stream = yt.streams.filter(
                    adaptive=True,
                    only_audio=True
                ).order_by('abr').desc().first()
                
                if audio_stream:
                    use_merge = True
                    print(f"[Pytubefix] HD mode: {video_stream.resolution} video + {audio_stream.abr} audio (merge required)")
        
        # Fallback to progressive if no HD stream or no FFmpeg
        if not use_merge:
            # Try exact resolution
            video_stream = yt.streams.filter(
                progressive=True, 
                file_extension='mp4', 
                resolution=resolution
            ).first()
            
            # Fallback chain
            if not video_stream:
                for fallback_res in ['720p', '480p', '360p']:
                    video_stream = yt.streams.filter(
                        progressive=True, 
                        file_extension='mp4', 
                        resolution=fallback_res
                    ).first()
                    if video_stream:
                        print(f"[Pytubefix] Progressive fallback: {fallback_res}")
                        break
            
            # Last resort: any progressive
            if not video_stream:
                video_stream = yt.streams.filter(
                    progressive=True, 
                    file_extension='mp4'
                ).order_by('resolution').desc().first()
        
        if not video_stream:
            return jsonify({"error": "No suitable stream found"}), 404
        
        actual_resolution = video_stream.resolution or 'unknown'
        
        # Generate video content
        if use_merge:
            print(f"[Pytubefix] Merging: {video_stream.resolution} + audio")
            
            # Download to temp files and merge with FFmpeg
            with tempfile.TemporaryDirectory() as tmpdir:
                video_path = os.path.join(tmpdir, 'video.mp4')
                audio_path = os.path.join(tmpdir, 'audio.mp4')
                output_path = os.path.join(tmpdir, 'output.mp4')
                
                # Download video and audio
                print(f"[Pytubefix] Downloading video stream...")
                video_stream.download(output_path=tmpdir, filename='video.mp4')
                
                print(f"[Pytubefix] Downloading audio stream...")
                audio_stream.download(output_path=tmpdir, filename='audio.mp4')
                
                # Merge with FFmpeg
                print(f"[Pytubefix] Merging with FFmpeg...")
                cmd = [
                    'ffmpeg', '-y',
                    '-i', video_path,
                    '-i', audio_path,
                    '-c:v', 'copy',
                    '-c:a', 'aac',
                    '-strict', 'experimental',
                    output_path
                ]
                
                result = subprocess.run(cmd, capture_output=True, text=True)
                
                if result.returncode != 0:
                    print(f"[Pytubefix] FFmpeg error: {result.stderr}")
                    # Fallback to video-only
                    output_path = video_path
                
                print(f"[Pytubefix] Streaming merged file...")
                
                def generate_from_file():
                    with open(output_path, 'rb') as f:
                        while chunk := f.read(8192):
                            yield chunk
                
                # Get file size for content-length
                file_size = os.path.getsize(output_path)
                
                return Response(
                    generate_from_file(),
                    mimetype='video/mp4',
                    headers={
                        'Content-Disposition': f'attachment; filename="{safe_title}.mp4"',
                        'Content-Type': 'video/mp4',
                        'Content-Length': str(file_size),
                        'X-Video-Quality': actual_resolution,
                        'X-Merge-Mode': 'ffmpeg'
                    }
                )
        else:
            # Stream progressive directly
            print(f"[Pytubefix] Streaming progressive: {actual_resolution}")
            
            def generate():
                buffer = io.BytesIO()
                video_stream.stream_to_buffer(buffer)
                buffer.seek(0)
                while chunk := buffer.read(8192):
                    yield chunk
            
            return Response(
                generate(),
                mimetype='video/mp4',
                headers={
                    'Content-Disposition': f'attachment; filename="{safe_title}.mp4"',
                    'Content-Type': 'video/mp4',
                    'X-Video-Quality': actual_resolution,
                    'X-Merge-Mode': 'progressive'
                }
            )
        
    except Exception as e:
        print(f"[Pytubefix] Error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/stream/mp3', methods=['GET'])
def stream_mp3():
    """Stream audio as MP3/M4A"""
    url = request.args.get('url')
    
    if not url:
        return jsonify({"error": "Missing 'url' parameter"}), 400
    
    if not is_valid_youtube_url(url):
        return jsonify({"error": "Invalid YouTube URL"}), 400
    
    try:
        yt = YouTube(url)
        title = yt.title
        safe_title = re.sub(r'[^\w\s-]', '', title)[:80].strip().replace(' ', '_')
        
        # Get best audio stream
        stream = yt.streams.filter(only_audio=True).order_by('abr').desc().first()
        
        if not stream:
            return jsonify({"error": "No audio stream found"}), 404
        
        print(f"[Pytubefix] Audio stream: {stream.abr}")
        
        # Stream the audio
        def generate():
            buffer = io.BytesIO()
            stream.stream_to_buffer(buffer)
            buffer.seek(0)
            while chunk := buffer.read(8192):
                yield chunk
        
        ext = stream.subtype  # e.g., 'mp4' or 'webm'
        mime = 'audio/mp4' if ext == 'mp4' else 'audio/webm'
        
        return Response(
            generate(),
            mimetype=mime,
            headers={
                'Content-Disposition': f'attachment; filename="{safe_title}.{ext}"',
                'Content-Type': mime,
                'X-Audio-Quality': stream.abr or 'unknown'
            }
        )
        
    except Exception as e:
        print(f"[Pytubefix] Error: {str(e)}")
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
        
        adaptive = list(set([
            s.resolution for s in yt.streams.filter(adaptive=True, file_extension='mp4', only_video=True)
            if s.resolution
        ]))
        
        # Combine all available resolutions
        all_resolutions = list(set(progressive + adaptive))
        
        return jsonify({
            "progressive": sorted(progressive, key=lambda x: int(x.replace('p', '')), reverse=True),
            "adaptive": sorted(adaptive, key=lambda x: int(x.replace('p', '')), reverse=True),
            "all": sorted(all_resolutions, key=lambda x: int(x.replace('p', '')), reverse=True),
            "recommended": adaptive[0] if adaptive else (progressive[0] if progressive else "360p"),
            "hd_available": HAS_FFMPEG
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
    print(f"[FFmpeg] Available: {HAS_FFMPEG}")
    print(f"[HD Support] {'Enabled' if HAS_FFMPEG else 'Disabled (install FFmpeg for 720p+)'}")
    print(f"[Endpoints]")
    print(f"   GET  /api/health")
    print(f"   GET  /api/info?url=...")
    print(f"   GET  /api/stream/mp4?url=...&resolution=720p")
    print(f"   GET  /api/stream/mp3?url=...")
    print(f"   GET  /api/resolutions?url=...")
    app.run(host='0.0.0.0', port=port, debug=False)
