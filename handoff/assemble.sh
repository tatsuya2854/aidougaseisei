#!/usr/bin/env bash
# Rebuild the 24s cut from AI-generated clips, falling back to the 3D render
# for any shot that has no clip yet. The product cut is never regenerated.
set -euo pipefail
cd "$(dirname "$0")/.."
CLIPS=handoff/clips
WORK=handoff/.work
mkdir -p "$CLIPS" "$WORK" out

# shot: name  duration  first-frame-of-the-3D-render  [lead: seconds of 3D render
#       played before the generated clip, for shots whose start plate is mid-action]
SHOTS=(
  "01 2.70 0 0.62"
  "02 2.70 81"
  "03 2.40 162"
  "04 2.40 234"
  "05 2.20 306"
  "06 2.40 372"
  "07 2.00 444"
  "08 2.60 504"
)
rm -f "$WORK/list.txt"
for row in "${SHOTS[@]}"; do
  set -- $row; n=$1; dur=$2; start=$3; lead=${4:-0}
  frames=$(python3 -c "print(round($dur*30))")
  out="$WORK/$n.mp4"
  if [ -f "$CLIPS/$n.mp4" ]; then
    echo "shot $n: using generated clip (lead ${lead}s of 3D render)"
    clipdur=$(python3 -c "print(round($dur-$lead,3))")
    ffmpeg -y -hide_banner -loglevel error -i "$CLIPS/$n.mp4" -t "$clipdur" -an \
      -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30" \
      -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p "$WORK/${n}_clip.mp4"
    if [ "$lead" != "0" ]; then
      leadframes=$(python3 -c "print(round($lead*30))")
      ffmpeg -y -hide_banner -loglevel error -framerate 30 -start_number "$start" \
        -i frames3d/f%05d.jpg -frames:v "$leadframes" -an \
        -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p "$WORK/${n}_lead.mp4"
      printf "file '%s_lead.mp4'\nfile '%s_clip.mp4'\n" "$n" "$n" > "$WORK/${n}_cat.txt"
      ffmpeg -y -hide_banner -loglevel error -f concat -safe 0 -i "$WORK/${n}_cat.txt" -c copy "$out"
    else
      mv "$WORK/${n}_clip.mp4" "$out"
    fi
  else
    echo "shot $n: no clip, falling back to the 3D render"
    ffmpeg -y -hide_banner -loglevel error -framerate 30 -start_number "$start" \
      -i frames3d/f%05d.jpg -frames:v "$frames" -an \
      -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p "$out"
  fi
  echo "file '$n.mp4'" >> "$WORK/list.txt"
done

echo "shot 09: product cut, composited (never regenerated)"
cp handoff/09_product_cut.mp4 "$WORK/09.mp4"
echo "file '09.mp4'" >> "$WORK/list.txt"

ffmpeg -y -hide_banner -loglevel error -f concat -safe 0 -i "$WORK/list.txt" \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p "$WORK/raw.mp4"

# generated clips carry no captions, so lay the kinetic type back over the whole cut
if [ -f handoff/captions_overlay.mov ]; then
  echo "compositing captions"
  ffmpeg -y -hide_banner -loglevel error -i "$WORK/raw.mp4" -i handoff/captions_overlay.mov \
    -filter_complex "[1:v]setpts=PTS+0.6667/TB,format=rgba[c];[0:v][c]overlay=0:0:eof_action=pass" \
    -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p "$WORK/video.mp4"
else
  cp "$WORK/raw.mp4" "$WORK/video.mp4"
fi

ffmpeg -y -hide_banner -loglevel error -i "$WORK/video.mp4" -i audio/score.wav \
  -c:v copy -c:a aac -b:a 192k -ar 44100 -shortest -movflags +faststart \
  out/chenme_halloween_promo_ai.mp4
ffprobe -v error -show_entries format=duration -of csv=p=0 out/chenme_halloween_promo_ai.mp4
echo "-> out/chenme_halloween_promo_ai.mp4"
