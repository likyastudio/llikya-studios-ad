#!/usr/bin/env python3
"""VO'yu müzik ve SFX ile karıştırır. Müzik konuşma sırasında VO'nun en az 15 dB altına iner.
kullanım: python3 mix_final.py <vo_hat.wav|--lines KLASÖR TAKE> [--out ../audio/final_mix.wav]
  --lines: KLASÖR/takeN_01..07.mp3 dosyalarını script.json'daki start_hint'lere yerleştirir ve süreleri raporlar."""
import sys, json, subprocess, wave, os, numpy as np
SR = 48000; N = SR * 30
def load(path):
    raw = subprocess.run(['ffmpeg','-v','error','-i',path,'-f','f32le','-ac','2','-ar',str(SR),'-'],capture_output=True,check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)
def save(path, x):
    w = wave.open(path,'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(x,-1,1)*32767).astype('<i2').tobytes()); w.close()
def fit(x):
    y = np.zeros((N,2)); y[:min(N,len(x))] = x[:N]; return y
args = sys.argv[1:]; out = '../audio/final_mix.wav'
if '--out' in args: i = args.index('--out'); out = args[i+1]; del args[i:i+2]
if args[0] == '--lines':
    d, take = args[1], args[2]; S = json.load(open('../vo/script.json', encoding='utf-8')); vo = np.zeros((N,2)); prev_end = 0
    for l in S['lines']:
        x = load(f"{d}/take{take}_{l['id']}.mp3"); s = int(l['start_hint']*SR); dur = len(x)/SR
        print(f"satır {l['id']}: başlangıç {l['start_hint']:.2f}s, süre {dur:.2f}s, bitiş {l['start_hint']+dur:.2f}s")
        if s < prev_end: print('  UYARI: önceki satırla çakışıyor, start_hint ve sahne süresi yeniden ayarlanmalı')
        e = min(N, s+len(x)); vo[s:e] += x[:e-s]; prev_end = e
    save('../audio/vo_stem.wav', vo)
else: vo = fit(load(args[0])); save('../audio/vo_stem.wav', vo)
mus = fit(load('../audio/music_stem.wav')); sfx = fit(load('../audio/sfx_stem.wav'))
# VO etkinlik zarfı (20 ms RMS), açılış 60 ms, bırakma 450 ms
hop = int(SR*.02); m = np.abs(vo).max(axis=1); fr = m[:len(m)//hop*hop].reshape(-1,hop); rms = np.sqrt((fr**2).mean(axis=1))
act = rms > max(rms.max()*0.05, 1e-4); vo_rms = np.sqrt((vo[np.repeat(act,hop)[:N]]**2).mean()) if act.any() else 1
g = np.zeros(len(act)); a_c, r_c = np.exp(-1/3), np.exp(-1/22)
for i,v in enumerate(act): 
    prev = g[i-1] if i else 0; t = 1.0 if v else 0.0; c = a_c if t > prev else r_c; g[i] = t + (prev-t)*c
env = np.repeat(g, hop); env = np.pad(env, (0, N-len(env)), mode='edge')[:N]
# gerekli düşüş: müzik, konuşma bölgelerinde VO RMS'sinin >=15 dB altında
mus_rms_open = np.sqrt((mus[np.repeat(act,hop)[:N]]**2).mean()) if act.any() else 1
need_db = max(15 + 20*np.log10(max(mus_rms_open,1e-9)/max(vo_rms,1e-9)), 15)
duck = 10**(-need_db/20)
print(f'VO RMS {20*np.log10(vo_rms):.1f} dBFS; müzik konuşmada {need_db:.1f} dB düşürülüyor (hedef ≥15 dB altta)')
mus_d = mus * (1 - env*(1-duck))[:,None]
mix = vo*1.0 + mus_d*1.0 + sfx*0.85
save('../audio/_premaster.wav', mix)
# -14 LUFS / -1 dBTP (iki geçiş loudnorm)
p = subprocess.run(['ffmpeg','-hide_banner','-i','../audio/_premaster.wav','-af','loudnorm=I=-14:TP=-1.5:LRA=7:print_format=json','-f','null','-'],capture_output=True,text=True).stderr
j = json.loads(p[p.rindex('{'):])
af = f"loudnorm=I=-14:TP=-1.5:LRA=7:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']},alimiter=limit=0.89:level=disabled"
subprocess.run(['ffmpeg','-y','-v','error','-i','../audio/_premaster.wav','-af',af,'-ar','48000',out],check=True)
print('yazıldı', out)
