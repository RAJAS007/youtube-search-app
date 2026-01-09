#!/bin/bash
# Install FFmpeg for video/audio merging
apt-get update && apt-get install -y ffmpeg

# Install Python dependencies
pip install -r requirements.txt
