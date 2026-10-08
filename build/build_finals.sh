#!/bin/bash
# Seslendirme onaylandıktan sonra: ../audio/final_mix.wav hazır olmalı (mix_final.py çıktısı).
set -e; cd "$(dirname "$0")"
test -f ../audio/final_mix.wav || { echo "önce mix_final.py ile final_mix.wav üretin"; exit 1; }
mkdir -p ../finals
node render.mjs video 1080 60 ../finals/_v9x16.mp4
WIDE=1 node render.mjs video 1920 60 ../finals/_v16x9.mp4
ffmpeg -y -v error -i ../finals/_v9x16.mp4 -i ../audio/final_mix.wav -c:v copy -c:a aac -b:a 320k -shortest ../finals/Likya_Studios_Ad_9x16_1080x1920_60fps.mp4
ffmpeg -y -v error -i ../finals/_v16x9.mp4 -i ../audio/final_mix.wav -c:v copy -c:a aac -b:a 320k -shortest ../finals/Likya_Studios_Ad_16x9_1920x1080_60fps.mp4
echo tamam
