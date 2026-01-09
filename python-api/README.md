# MusicHub Pytubefix API

A Python Flask API for YouTube video downloads using pytubefix.

## Deploy to Render

1. Create a new **Web Service** on Render
2. Connect your GitHub repo (or upload this folder)
3. Configure:
   - **Name**: `musichub-pytubefix`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python main.py`
   - **Environment Variables**: 
     - `PORT` = `5000` (optional, defaults to 5000)

4. After deployment, copy the URL (e.g., `https://musichub-pytubefix.onrender.com`)

5. Add this URL as an environment variable on your **Node.js Render service**:
   - `PYTUBEFIX_API_URL` = `https://musichub-pytubefix.onrender.com`

## Endpoints

- `GET /api/health` - Health check
- `GET /api/info?url=...` - Video information
- `GET /api/stream/mp4?url=...&resolution=720p` - Stream MP4
- `GET /api/stream/mp3?url=...` - Stream audio
- `GET /api/resolutions?url=...` - Available resolutions

## Local Testing

```bash
pip install -r requirements.txt
python main.py
```

API will be available at `http://localhost:5000`
