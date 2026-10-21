# Sayı Kulesi

Likya Studios'un yukarıdan sayı bırakmalı bulmaca oyunu. Saf HTML, CSS ve Vanilla JavaScript. Derleme, bağımlılık, sunucu veya hesap gerekmez.

## Dosyalar

| Dosya | İçerik |
| --- | --- |
| `index.html` | Sayfa iskeleti ve pencereler (başlangıç, oyun sonu, kazanma) |
| `style.css` | Koyu lacivert tema, pastel bloklar, animasyonlar, mobil uyum |
| `game.js` | Bölüm 1: oyun mantığı (`Core`, DOM'dan bağımsız). Bölüm 2: arayüz, animasyon, ses, depolama |

## Yerelde çalıştırma

`index.html` dosyasını tarayıcıda açmak yeterlidir. Yerel sunucu isterseniz:

```
cd sayi-kulesi
python3 -m http.server 8080      # http://localhost:8080
```

## Nasıl oynanır

- 5 sütun, 7 satır. Sıradaki blok 2 veya 4'tür (yaklaşık %70 / %30).
- Bir sütuna dokun (bilgisayarda `1`–`5` tuşları). Blok o sütunun en alt boş hücresine yerleşir. Dolu sütuna blok bırakılamaz.
- Eşit iki sayı yan yana veya üst üste gelince birleşir (2+2=4, 4+4=8 …).
- Bütün sütunlar dolunca oyun biter. 2048 bloğuna ulaşınca kutlama çıkar, istersen devam edersin.

## Kurallar (ayrıntı)

Bırakılan bloktan başlayarak şu döngü çalışır:

1. Blok; **alt, sol, sağ, üst** komşularından değeri eşit olan ilkiyle birleşir (bu öncelik sırasıyla).
2. Alt komşuyla birleşmede sonuç **alttaki hücrede** kalır, üstteki hücre boşalır. Yan komşuyla birleşmede sonuç bırakılan bloğun hücresinde kalır, komşu hücre boşalır.
3. Boşalan hücrenin üstündeki bloklar aşağı düşer (yerçekimi).
4. Yeni oluşan blok ve düşen bloklar yeniden kontrol edilir. Başka birleşme kalmayana kadar sürer (zincir).

Birleşmeler her zaman ikişerlidir ve toplam değer korunur: tahtadaki sayıların toplamı, bırakılan blokların toplamına eşittir.

**Puan:** her birleşme, oluşan değer × zincirdeki sırası kadar puan verir. Örnek: `[8, 4, 2]` üstüne 2 → 4×1 + 8×2 + 16×3 = **68**. Zincir 2 ve üstündeyse ekranda "KOMBO ×N" görünür.

**Neden yatay birleşme var?** Yalnızca dikey birleşmeyle, 7 satırlık bir sütunda ulaşılabilecek en büyük blok 256'dır. 2048 için en az 10 satır gerekir. 5×7 tahta korunarak hedefin ulaşılabilir olması için yatay birleşme eklendi.

## Kayıt

Yalnızca en yüksek skor (`sayiKulesi.best`) ve ses tercihi (`sayiKulesi.sound`) tarayıcının LocalStorage'ında tutulur. Sunucuya hiçbir şey gönderilmez.

## Cloudflare Pages'e yayınlama

Bu klasör olduğu gibi statik siteye dönüşür. Derleme komutu yoktur.

Panelden: Workers & Pages → Create → Pages → Direct Upload → `sayi-kulesi` klasörünü yükle.

Komut satırından (yeni bir proje oluşturur, mevcut siteleri etkilemez):

```
npx wrangler pages deploy sayi-kulesi --project-name=sayi-kulesi
```

İlk dağıtım `https://sayi-kulesi.pages.dev` benzeri bir adrese çıkar. `games.likyastudios.live` sitesine bağlamak ayrı ve bilinçli bir adımdır: gerekirse Pages projesinde özel alan adı olarak (ör. `kule.likyastudios.live`) eklenir. Bu depo mevcut siteyi değiştirmez.

## Testler

Depo kökünden:

```
node --test tests/sayi-kulesi/logic.test.mjs   # mantık: 12 test, 400 rastgele oyun
node tests/sayi-kulesi/ui.test.mjs             # tarayıcı: 21 test (Playwright + Chromium)
```

Tarayıcı testleri `window.SayiKulesi` kancasını kullanır (`load`, `getState`, `isBusy`). Oyunun kendisi bu kancaya bağımlı değildir.
