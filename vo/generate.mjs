#!/usr/bin/env node
/* ElevenLabs Türkçe seslendirme (SDK: @elevenlabs/elevenlabs-js).
 * Anahtar yalnızca ortamdan (veya .env dosyasından, ki o depoya girmez) okunur: ELEVENLABS_API_KEY.
 * Varsayılan her komut KURU ÇALIŞMADIR: kredi harcamaz. Ücretli üretim için açıkça --go gerekir.
 *
 *   node vo/generate.mjs voices                          # sesleri listele (ücretsiz)
 *   node vo/generate.mjs estimate [--takes 2 --voices 3] # kredi tahmini (ağ gerekmez)
 *   node vo/generate.mjs sample --voice ID [--go]        # kısa telaffuz denemesi
 *   node vo/generate.mjs full --voice ID --takes 2 [--go] # tam metin, satır satır, N deneme
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const S = JSON.parse(fs.readFileSync(path.join(HERE, 'script.json'), 'utf8'));

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i < 0 ? def : args[i + 1]; };
const go = args.includes('--go');
const takes = +opt('takes', 2);
const nVoices = +opt('voices', 1);
const voiceId = opt('voice');

const respell = (t) => Object.entries(S.respell).reduce((a, [from, to]) => a.replaceAll(from, to), t);
const chars = (texts) => texts.reduce((n, t) => n + respell(t).length, 0);
const voiceSettings = {
  stability: S.voice_settings.stability,
  similarityBoost: S.voice_settings.similarity_boost,
  style: S.voice_settings.style,
  useSpeakerBoost: S.voice_settings.use_speaker_boost,
};
const client = () => {
  if (!process.env.ELEVENLABS_API_KEY) {
    console.error('ELEVENLABS_API_KEY tanımlı değil (anahtarı sohbete yazmayın; ortam ayarlarına ekleyin).');
    process.exit(1);
  }
  return new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
};

const full = S.lines.map((l) => l.text);

if (cmd === 'voices') {
  const { voices } = await client().voices.getAll();
  for (const v of voices) console.log(v.voiceId, v.name, v.labels?.language ?? '', v.category ?? '');
} else if (cmd === 'estimate') {
  const c = chars(full), t = chars([S.pronunciation_test]);
  console.log(`Tam metin: ${c} karakter → ~${c} kredi/deneme (multilingual v2: 1 kredi/karakter)`);
  console.log(`Telaffuz denemesi: ${t} karakter → ~${t} kredi/ses`);
  console.log(`${nVoices} ses × ${takes} deneme: ~${c * takes * nVoices} kredi; + telaffuz ~${t * nVoices}`);
} else if (cmd === 'sample' || cmd === 'full') {
  if (!voiceId) { console.error('--voice gerekli'); process.exit(1); }
  const jobs = cmd === 'sample'
    ? [{ name: 'sample', text: respell(S.pronunciation_test), seed: 1001 }]
    : Array.from({ length: takes }, (_, k) => S.lines.map((l) => ({
        name: `take${k + 1}_${l.id}`, text: respell(l.text), seed: 1001 + k }))).flat();
  const total = jobs.reduce((n, j) => n + j.text.length, 0);
  console.log(`${jobs.length} istek, ${total} karakter ≈ ${total} kredi.`);
  if (!go) {
    console.log('KURU ÇALIŞMA: --go verilmedi, hiçbir şey gönderilmedi.');
  } else {
    const el = client();
    const out = path.join(HERE, voiceId);
    fs.mkdirSync(out, { recursive: true });
    for (const j of jobs) {
      const stream = await el.textToSpeech.convert(voiceId, {
        text: j.text, modelId: S.model_id, languageCode: S.language, voiceSettings, seed: j.seed,
        outputFormat: 'mp3_44100_128',
      });
      fs.writeFileSync(path.join(out, `${j.name}.mp3`), Buffer.from(await new Response(stream).arrayBuffer()));
      console.log('yazıldı', j.name);
    }
  }
} else {
  console.error('Kullanım: voices | estimate | sample --voice ID [--go] | full --voice ID [--takes N] [--go]');
  process.exit(1);
}
