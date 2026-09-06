#!/usr/bin/env bash
# Encode the rendered frames + score into the deliverables.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out
ffmpeg -y -hide_banner -loglevel error -framerate 30 -i frames3d/f%05d.jpg -i audio/score.wav \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -profile:v high -level 4.2 \
  -x264-params "keyint=60:min-keyint=30:scenecut=0" -movflags +faststart \
  -c:a aac -b:a 192k -ar 44100 -shortest out/chenme_halloween_promo.mp4
ffmpeg -y -hide_banner -loglevel error -framerate 30 -i frames3d/f%05d.jpg \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -movflags +faststart \
  out/chenme_halloween_promo_noaudio.mp4
ffmpeg -y -hide_banner -loglevel error -i out/chenme_halloween_promo.mp4 \
  -vf "fps=10,scale=264:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4" \
  -loop 0 out/chenme_halloween_promo_preview.gif
ls -la out
