// Yüksek kalite: node render_hq.mjs <genişlik> <fps> <K alt-kare> <işçi> <çıkış.mp4> [t0 t1]   (16:9 için WIDE=1)
import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
import { spawn, execFileSync } from 'child_process';
import fs from 'fs'; import path from 'path';
const [W, FPS, K, WORKERS, OUT, T0, T1] = process.argv.slice(2);
const w = +W, wide = !!process.env.WIDE, h = wide ? Math.round(w * 9 / 16) : Math.round(w * 16 / 9);
const fps = +FPS, k = +K, nw = +WORKERS, t0 = +(T0 ?? 0), t1 = +(T1 ?? 30), SHUTTER = 0.5; // 180° deklanşör
const total = Math.round((t1 - t0) * fps), per = Math.ceil(total / nw);
const tmp = OUT.replace(/\.mp4$/, '_seg'); fs.mkdirSync(tmp, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox','--allow-file-access-from-files'] });
async function worker(i) {
  const a = i * per, b = Math.min(total, a + per); if (a >= b) return null;
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto('file://' + path.resolve('scene.html') + (wide ? '?wide' : '')); await page.evaluate(() => window.ready);
  const seg = path.join(tmp, `s${i}.mp4`);
  const vf = (k > 1 ? `tmix=frames=${k},select='eq(mod(n\\,${k})\\,${k - 1})',setpts=N/(${fps}*TB),` : '') +
    'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p';
  const ff = spawn('ffmpeg', ['-y','-loglevel','error','-f','image2pipe','-framerate',String(fps * k),'-c:v','mjpeg','-i','-','-vf',vf,'-r',String(fps),
    '-c:v','libx264','-preset','medium','-crf','12','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709',seg], { stdio: ['pipe','inherit','inherit'] });
  for (let f = a; f < b; f++) for (let j = 0; j < k; j++) {
    const t = t0 + f / fps + (k > 1 ? (j / (k - 1) - 0.5) * SHUTTER / fps : 0);
    await page.evaluate(t => window.R(Math.max(0, t)), t);
    const buf = await page.screenshot({ type: 'jpeg', quality: 96 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); await page.close(); return seg;
}
const segs = (await Promise.all([...Array(nw).keys()].map(worker))).filter(Boolean);
await browser.close();
fs.writeFileSync(path.join(tmp, 'list.txt'), segs.map(s => `file '${path.resolve(s)}'`).join('\n'));
execFileSync('ffmpeg', ['-y','-loglevel','error','-f','concat','-safe','0','-i',path.join(tmp, 'list.txt'),'-c','copy','-movflags','+faststart',OUT]);
console.log('tamam', OUT, `${w}x${h}@${fps}`);
