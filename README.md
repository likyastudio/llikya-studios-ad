# Likya Studios — 30 sn reklam (9:16 + 16:9)

Brif: `brief/PROMPT.md`, onaylar: `brief/APPROVALS.md`. Varlıklar ve kaynakları: `assets_in/` ve `assets_in/CREDITS.md`.

## Yeniden üretim
- Sahne: `build/scene.html` (9:16), `?wide` ile 16:9. Render: `node build/render.mjs video 540 30 out.mp4` (16:9 için `WIDE=1`).
- Ses: `python3 build/audio.py` (müzik + SFX, kodla), `vo/generate.py` (ElevenLabs, varsayılan kuru çalışma), `build/mix_final.py` (ducking, −14 LUFS).
- Finaller: `build/build_finals.sh` (ses onayından sonra).

## Durum
Seslendirme yok; SF Pro dosyası ve şeffaf logo bekleniyor. `ELEVENLABS_API_KEY` yalnızca ortam değişkeninden okunur, depoya yazılmaz.
