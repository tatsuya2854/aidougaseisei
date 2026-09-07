#!/usr/bin/env bash
# Cut the reference-style promo: eight Veo clips seeded from handoff/plates_ref
# (any missing clip falls back to a slow push on its seed plate), then the
# ending from product_end.py, where the real illustrator bottle is composited
# over the "?" bottle. Output: out/chenme_halloween_promo_ref.mp4
set -euo pipefail
cd "$(dirname "$0")/.."
CLIPS=handoff/clips
WORK=handoff/.work
PLATES=handoff/plates_ref
mkdir -p "$CLIPS" "$WORK" out

# shot  plate     seconds     (shot 08 is 2.00s of "?" + the composited ending, built separately)
SHOTS=(
  "01 01_face  1.40"
  "02 02_stone 2.60"
  "03 03_hands 2.00"
  "04 04_raise 2.20"
  "05 05_pump  2.20"
  "06 06_sit   2.80"
  "07 07_hug   1.80"
)
rm -f "$WORK/list.txt"
for row in "${SHOTS[@]}"; do
  set -- $row; n=$1; plate=$2; dur=$3
  out="$WORK/$n.mp4"
  if [ -f "$CLIPS/$n.mp4" ]; then
    echo "shot $n: generated clip, first ${dur}s"
    ffmpeg -y -hide_banner -loglevel error -i "$CLIPS/$n.mp4" -t "$dur" -an \
      -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30" \
      -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p "$out"
  else
    echo "shot $n: no clip yet, slow push on the seed plate"
    frames=$(python3 -c "print(round($dur*30))")
    ffmpeg -y -hide_banner -loglevel error -loop 1 -i "$PLATES/$plate.png" -frames:v "$frames" -an \
      -vf "scale=2160:3840,zoompan=z='1+0.06*on/$frames':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30" \
      -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p "$out"
  fi
  echo "file '$n.mp4'" >> "$WORK/list.txt"
done

echo "shot 08: '?' product shot -> flash -> real bottle composited (never generated)"
python3 handoff/product_end.py --out "$WORK/08_end.mp4"
echo "file '08_end.mp4'" >> "$WORK/list.txt"

ffmpeg -y -hide_banner -loglevel error -f concat -safe 0 -i "$WORK/list.txt" \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p "$WORK/video_ref.mp4"

# score: cuts at the shot boundaries, flash 2.0s into shot 08
python3 audio/make_music.py --dur 21.6 --cuts 1.40,4.00,6.00,8.20,10.40,13.20,15.00 \
  --pops "" --reveal 17.00 --out "$WORK/score_ref.wav"

ffmpeg -y -hide_banner -loglevel error -i "$WORK/video_ref.mp4" -i "$WORK/score_ref.wav" \
  -c:v copy -c:a aac -b:a 192k -ar 44100 -shortest -movflags +faststart \
  out/chenme_halloween_promo_ref.mp4
ffprobe -v error -show_entries format=duration -of csv=p=0 out/chenme_halloween_promo_ref.mp4
echo "-> out/chenme_halloween_promo_ref.mp4"
