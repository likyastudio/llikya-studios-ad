# Sayı Kulesi: geliştirme raporu

## Teslim
`sayi-kulesi/` klasörü: `index.html`, `style.css`, `game.js`, `README.md`. Harici kütüphane, backend veya hesap yok. Cloudflare Pages'e doğrudan statik yüklenebilir. `games.likyastudios.live` sitesine dokunulmadı.
Testler: `tests/sayi-kulesi/` (mantık ve tarayıcı).

## Verilen karar: 2048 hedefi
Brifteki kurallarla (5×7, yalnızca dikey birleşme) 2048 matematiksel olarak ulaşılamazdı. Tek sütunda ulaşılabilecek en büyük blok 7 satırda 256, 2048 için en az 10 satır gerekir (tüm sütun durumları taranarak doğrulandı). Onayınla **yatay birleşme** eklendi. 5×7 tahta, dikey kurallar ve zincir puanı aynı kaldı.

## Mimari
- `Core` (game.js, bölüm 1): saf durum makinesi. `drop(state, sütun)` bir hamlenin tüm adımlarını (yerleşme, birleşme, düşme) liste olarak döndürür. DOM, zamanlayıcı veya ses içermez, Node'da test edilir.
- Arayüz (bölüm 2): bu adım listesini sırayla oynatır. Durum hamle anında kesinleşir, animasyon yalnızca gösterimdir. Hamle sonunda ekran durumla yeniden eşitlenir.
- Çift dokunuş: animasyon sürerken giriş kilitlidir. Yeniden başlatma, eski animasyon döngüsünü iptal eder.

## Test sonuçları
- Mantık: 12/12 geçti (yerleşme, birleşme, eşitsizlik, zincir, yerçekimi, dolu sütun, oyun sonu, yeniden başlatma, 2048). 400 rastgele oyunda her hamlede şunlar doğrulandı: toplam değer korunuyor, puan adım puanlarının toplamı, eşit komşu kalmıyor, kimlikler tekil, sütun 7'yi aşmıyor.
- Tarayıcı (Chromium): 21/21 geçti, konsol hatası yok. Dokunma ve 1–5 tuşları, kombo göstergesi, çift tıklama, dolu sütun uyarısı, oyun sonu, animasyon sırasında yeniden başlatma, rekorun yeniden yüklemede kalması, 2048 penceresi ve devam, ses tercihi, 60 hamlelik rastgele oyunda ekran/durum uyumu.
- Ekran uyumu: 320×568, 360×640, 390×844, 412×915, 768×1024, 1280×720. Yatay ve dikey taşma yok, tahta ve imza ekranda, dokunma alanı ≥ 40 px, 5 haneli sayılar hücreye sığıyor.

## Denge ölçümü (simülasyon, 300 oyun)
- Rastgele oynayan: ortalama 478 hamle, medyan en büyük blok 256.
- Basit açgözlü bot: medyan en büyük blok 2048.

2048 ulaşılabilir ama uzun bir oyun (yaklaşık 800+ blok). Daha kısa istenirse hedef veya sıradaki blok dağılımı ayarlanabilir.

## Bilinen sınırlar
- Ses WebAudio ile üretilir, ilk dokunuştan sonra çalar (tarayıcı kuralı). Gerçek cihazda kulakla denenmedi.
- Gerçek telefon denenmedi, mobil Chromium emülasyonu kullanıldı (iOS Safari ayrıca kontrol edilmeli).
- Oyun durumu kaydedilmez, sayfa yenilenince oyun baştan başlar (yalnızca rekor ve ses tercihi kalıcı).
