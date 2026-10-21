// Çalıştır: node tests/sayi-kulesi/ui.test.mjs
// Gerekli: genel kurulu Playwright ve Chromium (PLAYWRIGHT_BROWSERS_PATH).
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../sayi-kulesi');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript' };

const server = http.createServer((req, res) => {
  const p = path.join(root, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!p.startsWith(root) || !fs.existsSync(p)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }).end(fs.readFileSync(p));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/index.html`;

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox'],
});

let passed = 0;
const errors = [];
async function t(name, fn, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, ...opts });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); });
  try {
    await fn(page, ctx);
    passed++;
    console.log('ok   ', name);
  } catch (e) {
    console.log('FAIL ', name, '\n     ', e.message);
    process.exitCode = 1;
  }
  await ctx.close();
}

const idle = (page) => page.waitForFunction(() => !SayiKulesi.isBusy(), null, { timeout: 10000 });
const start = async (page) => { await page.goto(url); await page.click('#startBtn'); };
const load = (page, cols, opts) => page.evaluate(([c, o]) => SayiKulesi.load(SayiKulesi.Core.fromColumns(c, o)), [cols, opts]);
const state = (page) => page.evaluate(() => SayiKulesi.getState().cols.map((c) => c.map((b) => b.v)));
const tap = (page, c) => page.locator('.col-btn').nth(c).tap();
const score = (page) => page.$eval('#score', (e) => Number(e.dataset.value));
const blockCount = (page) => page.$$eval('#blocks .block', (n) => n.length);

await t('açılışta başlangıç penceresi görünür, Oyna ile oyun başlar', async (page) => {
  await page.goto(url);
  assert.equal(await page.isVisible('#startOverlay'), true);
  await page.click('#startBtn');
  assert.equal(await page.isVisible('#startOverlay'), false);
  assert.equal(await score(page), 0);
});

await t('1. doğru sütuna bırakma (dokunma ve 1-5 tuşları)', async (page) => {
  await start(page);
  await load(page, [[], [], [], [], []], { next: 2 });
  await tap(page, 2);
  await idle(page);
  assert.deepEqual(await state(page), [[], [], [2], [], []]);
  const pos = await page.$eval('#blocks .block', (n) => [n.style.getPropertyValue('--c'), n.style.getPropertyValue('--r'), n.dataset.v]);
  assert.deepEqual(pos, ['2', '0', '2']);
  await page.keyboard.press('5');
  await idle(page);
  const s = await state(page);
  assert.equal(s[4].length, 1);
  assert.equal(await blockCount(page), 2);
});

await t('2. eşit sayılar birleşir, puan ve ekran güncellenir', async (page) => {
  await start(page);
  await load(page, [[], [2], [], [], []], { next: 2 });
  await tap(page, 1);
  await idle(page);
  assert.deepEqual(await state(page), [[], [4], [], [], []]);
  assert.equal(await score(page), 4);
  assert.equal(await blockCount(page), 1);
  assert.equal(await page.$eval('#blocks .block', (n) => n.dataset.v), '4');
});

await t('3. eşit olmayanlar birleşmez', async (page) => {
  await start(page);
  await load(page, [[], [8], [], [], []], { next: 2 });
  await tap(page, 1);
  await idle(page);
  assert.deepEqual(await state(page), [[], [8, 2], [], [], []]);
  assert.equal(await score(page), 0);
});

await t('4. zincirleme birleşme: kombo göstergesi ve puan', async (page) => {
  await start(page);
  await load(page, [[8, 4, 2], [], [], [], []], { next: 2 });
  await tap(page, 0);
  await page.waitForSelector('#combo.show', { timeout: 5000 });
  const txt = await page.textContent('#combo');
  assert.match(txt, /KOMBO ×\d/);
  await idle(page);
  assert.deepEqual(await state(page), [[16], [], [], [], []]);
  assert.equal(await score(page), 68);
  assert.equal(await blockCount(page), 1);
});

await t('çift dokunuş: animasyon sürerken ikinci dokunuş yok sayılır', async (page) => {
  await start(page);
  await load(page, [[], [2], [], [], []], { next: 2 });
  await page.evaluate(() => {
    const b = document.querySelectorAll('.col-btn')[1];
    b.click(); b.click(); b.click(); // aynı anda üç tıklama
  });
  await idle(page);
  assert.deepEqual(await state(page), [[], [4], [], [], []]);
  assert.equal(await score(page), 4);
});

await t('5. dolu sütuna bırakılamaz, uyarı çıkar', async (page) => {
  await start(page);
  await load(page, [[2, 4, 2, 4, 2, 4, 2], [], [], [], []], { next: 2 });
  await page.locator('.col-btn').first().tap({ force: true }); // aria-disabled düğme: Playwright normalde reddeder
  await page.waitForTimeout(200);
  assert.equal((await state(page))[0].length, 7);
  assert.equal(await blockCount(page), 7);
  assert.equal(await page.textContent('#combo'), 'Bu sütun dolu');
  assert.equal(await page.$eval('.col-btn', (b) => b.getAttribute('aria-disabled')), 'true');
  assert.equal(await page.evaluate(() => SayiKulesi.isBusy()), false);
});

await t('6. bütün sütunlar dolunca Oyun Bitti penceresi', async (page) => {
  await start(page);
  const cols = [];
  for (let c = 0; c < 5; c++) cols.push(Array.from({ length: 7 }, (_, r) => ((c + r) % 2 === 0 ? 2 : 4)));
  cols[4].pop();
  await load(page, cols, { next: 2 });
  await page.keyboard.press('5');
  await page.waitForSelector('#overOverlay:not([hidden])', { timeout: 5000 });
  assert.match(await page.textContent('#overTitle'), /Oyun Bitti/);
  // oyun bitince giriş kilitli
  await page.keyboard.press('1');
  await page.waitForTimeout(150);
  assert.equal((await state(page))[0].length, 7);
  await page.click('#againBtn');
  assert.equal(await page.isVisible('#overOverlay'), false);
  assert.equal(await blockCount(page), 0);
});

await t('7. yeniden başlatma puanı ve tahtayı sıfırlar', async (page) => {
  await start(page);
  await load(page, [[], [2], [], [], []], { next: 2 });
  await tap(page, 1);
  await idle(page);
  assert.equal(await score(page), 4);
  await page.click('#restartBtn');
  assert.equal(await score(page), 0);
  assert.equal(await blockCount(page), 0);
  assert.deepEqual(await state(page), [[], [], [], [], []]);
  await page.keyboard.press('3');
  await idle(page);
  assert.equal((await state(page))[2].length, 1);
});

await t('7b. animasyon sürerken yeniden başlatma eski döngüyü iptal eder', async (page) => {
  await start(page);
  await load(page, [[8, 4, 2], [], [], [], []], { next: 2 });
  await tap(page, 0);
  await page.waitForTimeout(120);
  await page.click('#restartBtn');
  await page.waitForTimeout(1200);
  assert.equal(await score(page), 0);
  assert.equal(await blockCount(page), 0);
  assert.equal(await page.evaluate(() => SayiKulesi.isBusy()), false);
});

await t('8. rekor LocalStorage ile kalıcı kaydedilir', async (page) => {
  await start(page);
  await load(page, [[2], [], [], [], []], { next: 2 });
  await tap(page, 0);
  await idle(page);
  assert.equal(await page.evaluate(() => localStorage.getItem('sayiKulesi.best')), '4');
  assert.equal(await page.$eval('#best', (e) => e.dataset.value), '4');
  await page.reload();
  assert.equal(await page.$eval('#best', (e) => e.dataset.value), '4');
  await page.click('#startBtn');
  assert.equal(await score(page), 0);
  assert.equal(await page.$eval('#best', (e) => e.dataset.value), '4'); // yeni oyunda rekor kalır
  // daha düşük skor rekoru düşürmez
  await load(page, [[], [2], [], [], []], { next: 4 });
  await tap(page, 0);
  await idle(page);
  assert.equal(await page.evaluate(() => localStorage.getItem('sayiKulesi.best')), '4');
});

await t('9. 2048 kazanma bildirimi ve devam etme', async (page) => {
  await start(page);
  await load(page, [[1024], [], [], [], []], { next: 1024 });
  await tap(page, 1);
  await page.waitForSelector('#winOverlay:not([hidden])', { timeout: 5000 });
  assert.match(await page.textContent('#winTitle'), /Tebrikler/);
  assert.equal(await page.$eval('#blocks .block', (n) => n.dataset.v), '2048');
  await page.click('#continueBtn');
  assert.equal(await page.isVisible('#winOverlay'), false);
  await page.keyboard.press('4');
  await idle(page);
  assert.equal((await state(page))[3].length, 1); // devam edilebiliyor
  assert.equal(await page.isVisible('#winOverlay'), false);
});

await t('ses düğmesi durumu kaydedilir', async (page) => {
  await start(page);
  assert.equal(await page.getAttribute('#soundBtn', 'aria-pressed'), 'true');
  await page.click('#soundBtn');
  assert.equal(await page.getAttribute('#soundBtn', 'aria-pressed'), 'false');
  await page.reload();
  assert.equal(await page.getAttribute('#soundBtn', 'aria-pressed'), 'false');
});

await t('rastgele oyun: 60 hamle boyunca ekran durumla birebir uyumlu', async (page) => {
  await start(page);
  for (let i = 0; i < 60; i++) {
    if (await page.isVisible('#overOverlay')) break;
    await page.keyboard.press(String(1 + Math.floor(Math.random() * 5)));
    await page.waitForFunction(() => !SayiKulesi.isBusy() || !document.getElementById('overOverlay').hidden, null, { timeout: 10000 });
    const same = await page.evaluate(() => {
      const s = SayiKulesi.getState();
      const dom = [...document.querySelectorAll('#blocks .block')].map((n) => `${n.style.getPropertyValue('--c')},${n.style.getPropertyValue('--r')}:${n.querySelector('span').textContent}`).sort();
      const exp = s.cols.flatMap((c, ci) => c.map((b, ri) => `${ci},${ri}:${b.v}`)).sort();
      return JSON.stringify(dom) === JSON.stringify(exp) && Number(document.getElementById('score').dataset.value) === s.score;
    });
    assert.equal(same, true, `${i}. hamlede ekran ile durum ayrıştı`);
  }
});

for (const [w, h] of [[320, 568], [360, 640], [390, 844], [412, 915], [768, 1024], [1280, 720]]) {
  await t(`10. mobil/ekran uyumu ${w}x${h}: taşma yok, tahta ve imza görünür`, async (page) => {
    await start(page);
    await load(page, [[2, 4, 8, 16, 32, 64, 128], [4, 8, 16, 32, 64, 128, 256], [], [], []], { next: 2 });
    const m = await page.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect();
      const d = document.documentElement;
      const b = r('#board'), sign = r('.sign'), cols = r('#cols');
      return {
        hOverflow: d.scrollWidth > d.clientWidth,
        vOverflow: d.scrollHeight > innerHeight,
        boardIn: b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight,
        signIn: sign.bottom <= innerHeight && sign.top >= 0,
        tap: Math.min(...[...document.querySelectorAll('.col-btn')].map((x) => x.getBoundingClientRect().width)),
        colsBottom: cols.bottom <= sign.top + 1,
      };
    });
    assert.equal(m.hOverflow, false, 'yatay kaydırma var');
    assert.equal(m.vOverflow, false, 'dikey taşma var');
    assert.equal(m.boardIn, true, 'tahta ekran dışında');
    assert.equal(m.signIn, true, 'imza ekran dışında');
    assert.ok(m.tap >= 40, `dokunma alanı dar: ${m.tap}`);
    // 3 haneli sayılar hücreye sığıyor mu
    const fit = await page.$$eval('#blocks .face', (fs) => fs.every((f) => f.firstChild.getBoundingClientRect().width <= f.getBoundingClientRect().width));
    assert.equal(fit, true, 'sayı hücreye sığmıyor');
  }, { viewport: { width: w, height: h }, isMobile: w < 800, hasTouch: w < 800 });
}

await t('4 haneli ve 5 haneli sayılar hücreye sığar (en dar ekran)', async (page) => {
  await start(page);
  await load(page, [[1024, 2048, 4096, 8192, 16384, 32768, 65536], [], [], [], []], { next: 2 });
  const fit = await page.$$eval('#blocks .face', (fs) => fs.every((f) => f.firstChild.getBoundingClientRect().width <= f.getBoundingClientRect().width));
  assert.equal(fit, true);
}, { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });

await browser.close();
server.close();
console.log(`\n${passed} test geçti, ${errors.length} konsol/sayfa hatası`);
if (errors.length) { console.log(errors.join('\n')); process.exitCode = 1; }
