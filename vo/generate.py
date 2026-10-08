#!/usr/bin/env python3
"""ElevenLabs Türkçe seslendirme. Anahtar YALNIZCA ortamdan okunur: ELEVENLABS_API_KEY.
Varsayılan her komut KURU ÇALIŞMADIR (kredi harcamaz). Ücretli üretim için açıkça --go verilmeli.

  python3 generate.py voices                      # sesleri listele (ücretsiz)
  python3 generate.py estimate [--takes 2 --voices 3]   # kredi tahmini
  python3 generate.py sample --voice ID [--go]    # kısa telaffuz denemesi
  python3 generate.py full --voice ID --takes 2 [--go]  # tam metin, satır satır, N deneme
"""
import os, sys, json, argparse, urllib.request, urllib.error
HERE = os.path.dirname(os.path.abspath(__file__))
S = json.load(open(os.path.join(HERE, 'script.json'), encoding='utf-8'))
API = 'https://api.elevenlabs.io/v1'

def respell(t):
    for a, b in S['respell'].items(): t = t.replace(a, b)
    return t
def key():
    k = os.environ.get('ELEVENLABS_API_KEY')
    if not k: sys.exit('ELEVENLABS_API_KEY ortamda tanımlı değil (anahtarı sohbete yazmayın; ortam ayarlarına ekleyin).')
    return k
def req(path, body=None):
    r = urllib.request.Request(API + path, data=None if body is None else json.dumps(body).encode(),
                               headers={'xi-api-key': key(), 'Content-Type': 'application/json'})
    try: return urllib.request.urlopen(r, timeout=120).read()
    except urllib.error.HTTPError as e: sys.exit(f'HTTP {e.code}: {e.read()[:300]!r}')
def chars(texts): return sum(len(respell(t)) for t in texts)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('cmd', choices=['voices', 'estimate', 'sample', 'full'])
    ap.add_argument('--voice'); ap.add_argument('--takes', type=int, default=2); ap.add_argument('--voices', type=int, default=1)
    ap.add_argument('--go', action='store_true'); a = ap.parse_args()
    full = [l['text'] for l in S['lines']]
    if a.cmd == 'voices':
        v = json.loads(req('/voices'))['voices']
        for x in v: print(x['voice_id'], x['name'], x.get('labels', {}).get('language', ''), x.get('category', ''))
        return
    if a.cmd == 'estimate':
        c = chars(full); t = chars([S['pronunciation_test']])
        print(f'Tam metin: {c} karakter → ~{c} kredi/deneme (multilingual v2: 1 kredi/karakter)')
        print(f'Telaffuz denemesi: {t} karakter → ~{t} kredi/ses')
        print(f'{a.voices} ses × {a.takes} deneme: ~{c*a.takes*a.voices} kredi; + telaffuz ~{t*a.voices}')
        return
    if not a.voice: sys.exit('--voice gerekli')
    jobs = []
    if a.cmd == 'sample': jobs = [('sample', respell(S['pronunciation_test']), 1)]
    else:
        for tk in range(1, a.takes + 1):
            for l in S['lines']: jobs.append((f"take{tk}_{l['id']}", respell(l['text']), tk))
    total = sum(len(j[1]) for j in jobs)
    print(f'{len(jobs)} istek, {total} karakter ≈ {total} kredi.')
    if not a.go: print('KURU ÇALIŞMA: --go verilmedi, hiçbir şey gönderilmedi.'); return
    out = os.path.join(HERE, a.voice); os.makedirs(out, exist_ok=True)
    for name, text, tk in jobs:
        body = {'text': text, 'model_id': S['model_id'], 'language_code': S['language'], 'voice_settings': S['voice_settings'], 'seed': 1000 + tk}
        audio = req(f'/text-to-speech/{a.voice}?output_format=mp3_44100_128', body)
        open(os.path.join(out, name + '.mp3'), 'wb').write(audio); print('yazıldı', name)
main()
