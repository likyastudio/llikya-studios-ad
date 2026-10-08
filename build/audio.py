# Orijinal müzik + SFX, tamamen kodla üretilir (üçüncü taraf dosya yok). Çıktı: ../audio/*.wav
import numpy as np, wave, os
SR=48000; DUR=30.0; N=int(SR*DUR)
rng=np.random.default_rng(7)
OUT='../audio'; os.makedirs(OUT,exist_ok=True)
BPM=110; BEAT=60/BPM; BAR=BEAT*4
def tt(d): return np.arange(int(SR*d))/SR
def env_ad(n,a,d_tau):
    t=np.arange(n)/SR; e=np.minimum(1,t/max(a,1e-4))*np.exp(-t/d_tau); return e
def lp(x,fc,order=2):
    X=np.fft.rfft(x); f=np.fft.rfftfreq(len(x),1/SR); return np.fft.irfft(X/(1+(f/fc)**(2*order)),len(x))
def hp(x,fc,order=2):
    X=np.fft.rfft(x); f=np.fft.rfftfreq(len(x),1/SR); r=(f/fc)**(2*order); return np.fft.irfft(X*r/(1+r),len(x))
def place(buf,x,t0,gain=1.0,pan=0.0):
    i=int(t0*SR); 
    if i>=N: return
    x=x[:N-i]; l=np.cos((pan+1)*np.pi/4); r=np.sin((pan+1)*np.pi/4)
    buf[i:i+len(x),0]+=x*gain*l; buf[i:i+len(x),1]+=x*gain*r
def mtof(m): return 440*2**((m-69)/12)
def saw(f,n,detune=0.0):
    t=np.arange(n)/SR; y=np.zeros(n)
    for h in range(1,14):
        y+=np.sin(2*np.pi*f*(1+detune)*h*t+h)/h
    return y*0.5
def sweep_noise(d,f0,f1,bw=0.6,seed=0):
    # STFT bant geçiren gürültü: merkez frekans f0→f1 (log), bw oktav
    r=np.random.default_rng(seed); n=int(SR*d); x=r.standard_normal(n); W=2048; H=W//2
    win=np.hanning(W); y=np.zeros(n+W); fr=np.fft.rfftfreq(W,1/SR)+1e-6
    for k,s in enumerate(range(0,n,H)):
        p=s/n; fc=f0*(f1/f0)**p
        g=np.exp(-0.5*((np.log2(fr/fc))/bw)**2)
        seg=x[s:s+W]; 
        if len(seg)<W: seg=np.pad(seg,(0,W-len(seg)))
        y[s:s+W]+=np.fft.irfft(np.fft.rfft(seg*win)*g,W)*win
    return y[:n]
# ---------------- SFX ----------------
def whoosh(d=0.9,up=True,seed=1):
    a,b=(300,6000) if up else (6000,300)
    y=sweep_noise(d,a,b,0.7,seed); n=len(y); t=np.arange(n)/n
    e=np.sin(np.pi*t**(0.7 if up else 1.4))**1.5
    return y/np.max(np.abs(y))*e
def hit(f=70,d=0.7):
    t=tt(d); fr=f*(1+2.5*np.exp(-t*18)); ph=2*np.pi*np.cumsum(fr)/SR
    y=np.sin(ph)*np.exp(-t*7)+0.35*hp(rng.standard_normal(len(t)),1500)*np.exp(-t*40)
    return y
def shimmer(d=1.6,base=1318):
    t=tt(d); y=np.zeros(len(t))
    for k,r in enumerate([1,1.5,2,2.52,3,4.01]): y+=np.sin(2*np.pi*base*r*t+k)*np.exp(-t*(2.2+k*.6))/(1+k*.4)
    return y*0.5
def pop(f=880,d=0.25):
    t=tt(d); return np.sin(2*np.pi*f*(1+0.5*np.exp(-t*30))*t)*np.exp(-t*18)
def tick(d=0.08):
    t=tt(d); return hp(rng.standard_normal(len(t)),3000)*np.exp(-t*90)
def cardslide(d=0.22,seed=3):
    y=sweep_noise(d,2500,7000,0.8,seed); n=len(y); return y/np.max(np.abs(y))*np.hanning(n)
def thump(d=0.35):
    t=tt(d); return np.sin(2*np.pi*55*(1+.8*np.exp(-t*25))*t)*np.exp(-t*14)
def blip(f,d=0.3):
    t=tt(d); return (np.sin(2*np.pi*f*t)+.4*np.sin(2*np.pi*f*2*t))*np.exp(-t*14)
def riser(d=1.0):
    t=tt(d); f=300*(8**(t/d)); ph=2*np.pi*np.cumsum(f)/SR
    return np.sin(ph)*(t/d)**2*0.5
sfx=np.zeros((N,2))
W=lambda t,up=True,g=.55,seed=1,d=.9:place(sfx,whoosh(d,up,seed),t,g,rng.uniform(-.3,.3))
# açılış
W(0.05,True,.45,2,1.0); place(sfx,shimmer(2.0,1568),0.9,.35); place(sfx,hit(60,1.0),0.95,.55)
for t0 in (1.35,1.6,1.85): W(t0-.2,True,.35,int(t0*10),.35); place(sfx,tick(),t0+.35,.5)
place(sfx,hit(80,.5),1.85+.5,.35)
# geçişler (sahne başlarında)
for k,t0 in enumerate((3.0,7.0,12.0,17.0,21.1,24.0)): W(t0-.15,True,.6,10+k,.8); place(sfx,hit(65,.6),t0+.55,.4)
# S1
for k,t0 in enumerate((3.45,3.7,3.95)): place(sfx,cardslide(.25,k),t0,.35); place(sfx,tick(),t0+.45,.45)
for k,t0 in enumerate((4.7,4.95,5.2)): W(t0,True,.25,20+k,.35); place(sfx,pop(700+k*180),t0+.55,.5,(k-1)*.5)
place(sfx,blip(1568,.4),5.9,.35,-.3); place(sfx,blip(2093,.4),6.2,.35,.3)
# S2 Wine
W(7.35,True,.5,31,.7); place(sfx,hit(75,.6),7.95,.45); place(sfx,tick(),7.45+.5,.4); place(sfx,tick(),7.7+.5,.4)
place(sfx,pop(990),8.7,.5); place(sfx,shimmer(1.4,1760),8.95,.28); place(sfx,pop(660),9.2,.4)
# S3 Batak
W(12.35,True,.5,41,.7); place(sfx,tick(),12.95,.4)
for k,t0 in enumerate((13.4,13.62,13.84)): place(sfx,cardslide(.28,10+k),t0,.55,(k-1)*.5); place(sfx,thump(),t0+.5,.5,(k-1)*.4)
place(sfx,pop(784),14.7,.5); place(sfx,shimmer(1.0,2093),14.85,.22)
# S4 Astro
W(17.35,True,.45,51,.7); place(sfx,shimmer(2.4,1175),17.7,.35); place(sfx,hit(62,.8),17.75,.4)
for t0,f in ((18.4,1568),(18.9,1760),(19.4,2093),(20.1,1760)): place(sfx,blip(f,.5),t0,.28,np.sin(t0))
place(sfx,pop(740),19.2,.45)
# S5 AI
W(21.45,True,.45,61,.6)
for k,t0 in enumerate((21.8,22.05,22.3,22.55,22.85,23.15)): place(sfx,blip(880*2**([0,4,7,12,7,16][k]/12),.25),t0,.3,(k%3-1)*.5)
# S6
W(24.1,True,.5,71,.8)
for k,t0 in enumerate((24.45,24.6,24.75)): place(sfx,pop(600+k*150),t0,.4,(k-1)*.5)
W(25.1,False,.4,72,.6); place(sfx,hit(58,1.0),25.75,.65); place(sfx,shimmer(1.8,1568),25.8,.35)
place(sfx,tick(),26.3,.4); place(sfx,pop(1046),26.85,.55); place(sfx,shimmer(1.4,2093),26.9,.25); place(sfx,tick(),27.2,.4)
# S7
place(sfx,riser(.8),27.3,.28); W(27.9,False,.5,81,.5); place(sfx,hit(55,1.4),28.1,.7); place(sfx,shimmer(2.0,1568),28.5,.3)
# ---------------- MÜZİK ----------------
mus=np.zeros((N,2))
chords=[[57,60,64,67,71],[53,57,60,64,67],[48,55,60,64,67],[55,59,62,66,69]]  # Am9, Fmaj9, Cmaj7add9, G6/9 benzeri
nb=int(np.ceil(DUR/BAR))
final=[48,55,60,64,67,72]  # Cadd9, 28 sn'de
for b in range(nb):
    t0=b*BAR; ch=chords[b%4]
    if t0>=28-1e-6: ch=final
    d=BAR+0.8 if t0<27.9 else DUR-t0
    n=int(SR*d); pad=np.zeros(n)
    for m in ch[1:]: pad+=saw(mtof(m),n,0.003)+saw(mtof(m),n,-0.003)
    pad=lp(pad,1400); t=np.arange(n)/SR
    e=np.minimum(1,t/0.6)*np.minimum(1,(d-t)/0.8 if t0<28-1e-6 else 1)
    if t0>=28-1e-6: e=np.minimum(1,t/0.15)*np.exp(-t/2.6)+0.0
    amp=np.interp(t0,[0,3,7,24,28],[.5,.7,.8,1.0,1.0])
    place(mus,pad*e/ max(1,len(ch)),t0,.55*amp,0)
    # bas
    root=ch[0]-12 if t0<28-1e-6 else ch[0]-12
    nbs=np.sin(2*np.pi*mtof(root)*t[:int(SR*BAR)])*np.exp(-t[:int(SR*BAR)]/1.2)
    if t0>=3: place(mus,nbs,t0,.42*amp,0)
# arpej (8'likler), 3 sn'den itibaren, ping-pong
t=0.0; step=BEAT/2; i=0
while t<28:
    if t>=3.0:
        b=int(t//BAR); ch=chords[b%4]; pat=[1,2,3,4,3,2,3,4]; m=ch[pat[i%8]]+12
        n=int(SR*0.5); tn=np.arange(n)/SR
        y=(np.sin(2*np.pi*mtof(m)*tn)+.35*np.sin(2*np.pi*mtof(m)*2*tn)+.1*np.sin(2*np.pi*mtof(m)*3*tn))*np.exp(-tn/0.16)
        g=0.16*np.interp(t,[3,7,17,24],[.5,.8,.9,1.1]); pan=-.55 if i%2==0 else .55
        place(mus,y,t,g,pan); place(mus,y,t+step*1.5,g*.35,-pan)
    t+=step; i+=1
# vuruşlar
t=0.0; j=0
while t<28:
    if t>=3.0:
        kg=.5 if t<24 else .7
        place(mus,hit(52,.35)*0.9,t,kg*0.5) if (j%4 in (0,)) or (t>=7 and j%4==2) else None
        h=hp(rng.standard_normal(int(SR*.06)),7000)*np.exp(-tt(.06)*70)
        place(mus,h,t+BEAT/2,.12,.4)
    t+=BEAT; j+=1
# açılış için ince "hava"
air=hp(rng.standard_normal(N),4000)*0.02*np.interp(np.arange(N)/SR,[0,1.5,3,30],[0.5,1,.3,.2]); mus[:,0]+=air; mus[:,1]+=air[::-1]
# basit stereo reverb (kısa tekrar)
def verb(x):
    y=x.copy()
    for d,g in ((0.067,.35),(0.113,.28),(0.187,.2),(0.271,.14)):
        k=int(d*SR); y[k:]+=x[:-k]*g; 
    return y
mus=verb(mus); sfx=verb(sfx)*0.8+sfx*0.4
# ses (VO) yer tutucu: sessiz
vo=np.zeros((N,2))
def save(name,x):
    x=np.clip(x,-1,1); w=wave.open(f'{OUT}/{name}.wav','wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((x*32767).astype('<i2').tobytes()); w.close()
# normalizasyon: müzik tepe -6 dBFS, SFX tepe -3 dBFS
mus*=0.5/np.max(np.abs(mus)); sfx*=0.7/np.max(np.abs(sfx))
save('music_stem',mus); save('sfx_stem',sfx); save('vo_stem_placeholder',vo)
print('ok',np.max(np.abs(mus)),np.max(np.abs(sfx)))
