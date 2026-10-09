# Likya Studios reklam: oturum devir notu

Önce `README.md`, `brief/PROMPT.md`, `brief/APPROVALS.md` dosyalarını oku. Görüntü finali hazır (`finals/*_paylasim.mp4`). Bekleyen iş: seslendirme.

## Seslendirme görevi (kullanıcı onaylı: "sesi sen üret, elit sınıf uyumlu olsun")
- Ton: `vo/script.json` içindeki `direction` alanı. Elit/lüks marka: sakin, kendinden emin, alçak ve sıcak, ölçülü tempo, abartısız. Türkçe net olmalı.
- Araç: `npm install`, sonra `node vo/generate.mjs ...` (SDK). Anahtar yalnızca `ELEVENLABS_API_KEY` ortam değişkeninden okunur.
- Sıra: (1) `voices` ile Türkçeye uygun, elit tonlu 2-3 aday ses seç; (2) `estimate` ile kredi tahminini kullanıcıya göster; (3) telaffuz denemesi (`sample`) için ayrıca onay iste, sonra `--go`; (4) kullanıcı sesi seçince `full --takes 2 --go`; (5) `build/mix_final.py --lines vo/<voiceId> <take>` ile ducking'li karışım (−14 LUFS / −1 dBTP); (6) satır süreleri `start_hint` çakışırsa `build/scene.html` süreleri sese göre ayarlanır, `build/render_hq.mjs` ile yeniden render edilir.
- Kural: Kullanıcı onayı olmadan `--go` verme (ücretli). Anahtarı sohbete isteme/yazdırma, dosyaya yazma. Anahtar veya ağ yoksa dur ve ortam ayarlarını (api.elevenlabs.io izni, ELEVENLABS_API_KEY) hatırlat.
- Telaffuz yazımları `script.json > respell` içinde; ekrandaki resmî yazımlar değişmez.

## Eksikler
Şeffaf logo dosyası, SF Pro Display font dosyası (şimdilik Inter). Gelince `build/scene.html` güncellenip yeniden render edilir.
