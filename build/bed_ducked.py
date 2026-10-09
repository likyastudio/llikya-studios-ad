# Müzik+SFX yatağı; müzik, tahmini konuşma pencerelerinde 15 dB kısılır (kendi VO zamanlamanız farklıysa stem'leri kullanın).
import wave, numpy as np, subprocess
SR=48000
def load(p):
    raw=subprocess.run(['ffmpeg','-v','error','-i',p,'-f','f32le','-ac','2','-ar',str(SR),'-'],capture_output=True,check=True).stdout
    return np.frombuffer(raw,np.float32).reshape(-1,2).astype(np.float64)
mus=load('../audio/music_stem.wav'); sfx=load('../audio/sfx_stem.wav'); N=len(mus)
win=[(0.3,2.8),(3.2,6.9),(7.2,11.6),(12.2,16.4),(17.2,20.8),(21.3,23.8),(24.3,27.8)]
t=np.arange(N)/SR; g=np.zeros(N)
for a,b in win: g[(t>=a)&(t<=b)]=1
k=int(0.25*SR); g=np.convolve(g,np.hanning(k)/np.hanning(k).sum(),mode='same')
mix=mus*(1-g*(1-10**(-15/20)))[:,None]*0.8+sfx*0.7
w=wave.open('../finals/ses_destek/_bed.wav','wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((np.clip(mix,-1,1)*32767).astype('<i2').tobytes()); w.close()
