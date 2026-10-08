#!/bin/bash
# önizleme: görüntü + müzik/SFX karışımı (VO yok), -14 LUFS / -1 dBTP
set -e
cd "$(dirname "$0")"
ffmpeg -y -loglevel error -i ../audio/music_stem.wav -i ../audio/sfx_stem.wav -filter_complex "[0:a]volume=0.8[m];[1:a]volume=0.9[s];[m][s]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-2:LRA=7,alimiter=limit=0.89:level=disabled[a]" -map "[a]" -ar 48000 ../audio/preview_mix.wav
ffmpeg -y -loglevel error -i ../previews/_video_only.mp4 -i ../audio/preview_mix.wav -c:v copy -c:a aac -b:a 256k -shortest ../previews/PREVIEW_v1_9x16.mp4
ffmpeg -hide_banner -nostats -i ../audio/preview_mix.wav -af ebur128=peak=true -f null - 2>&1 | grep -E "I:|Peak:"
# temas sayfası
rm -rf stills; mkdir stills
node render.mjs still 270 stills/f.png 1 2.5 4.5 6.5 8 10 12.8 15 17.8 19.5 22 23.5 25 26.5 28.3 29.5
python3 sheet.py stills ../previews/contact_sheet_v1.png 8
