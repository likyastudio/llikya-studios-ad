// kullanım: node render.mjs still <w> <out.png> <t...>  |  node render.mjs video <w> <fps> <out.mp4> [t0 t1]
import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import { spawn } from 'child_process';
import path from 'path';
const [mode, W, ...rest] = process.argv.slice(2);
const w = +W, h = process.env.WIDE ? Math.round(w * 9 / 16) : Math.round(w * 16 / 9);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox','--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: w, height: h } });
await page.goto('file://' + path.resolve('scene.html') + (process.env.WIDE ? '?wide' : ''));
await page.evaluate(() => window.ready);
if (mode === 'still') {
  const out = rest[0];
  for (const t of rest.slice(1)) {
    await page.evaluate(t => window.R(t), +t);
    await page.screenshot({ path: out.replace('.png', `_${(+t).toFixed(2)}.png`) });
  }
} else {
  const fps = +rest[0], out = rest[1];
  const t0 = +(rest[2] ?? 0), t1 = +(rest[3] ?? 30);
  const ff = spawn('ffmpeg', ['-y','-loglevel','error','-f','image2pipe','-framerate',String(fps),'-c:v','mjpeg','-i','-','-c:v','libx264','-pix_fmt','yuv420p','-crf','16','-preset','medium',out], { stdio: ['pipe','inherit','inherit'] });
  const n = Math.round((t1 - t0) * fps);
  for (let i = 0; i < n; i++) {
    await page.evaluate(t => window.R(t), t0 + i / fps);
    const buf = await page.screenshot({ type: 'jpeg', quality: 93 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
}
await browser.close();
