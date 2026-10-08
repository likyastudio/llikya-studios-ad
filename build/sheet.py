import sys,glob
from PIL import Image,ImageDraw
files=sorted(glob.glob(sys.argv[1]+'/f_*.png'),key=lambda f:float(f.split('_')[-1][:-4]))
cols=int(sys.argv[3]) if len(sys.argv)>3 else 8
ims=[Image.open(f) for f in files];w,h=ims[0].size
rows=(len(ims)+cols-1)//cols
S=Image.new('RGB',(cols*w,rows*h),(20,20,20))
for i,(im,f) in enumerate(zip(ims,files)):
    S.paste(im,((i%cols)*w,(i//cols)*h));ImageDraw.Draw(S).text(((i%cols)*w+6,(i//cols)*h+6),f.split('_')[-1][:-4]+'s',fill=(255,255,0))
S.save(sys.argv[2]);print(S.size)
