import gzip,json,numpy as np
from PIL import Image, ImageFilter
def convert(vals):
    a=(np.array(vals).reshape(28,28)>0.15).astype('uint8')*255
    im=Image.fromarray(a).resize((280,280),Image.BILINEAR)
    im=im.point(lambda v:255 if v>60 else 0).filter(ImageFilter.MaxFilter(3))
    arr=np.array(im); ys,xs=np.nonzero(arr>128)
    if len(xs)==0: return None
    x0,x1,y0,y1=xs.min(),xs.max(),ys.min(),ys.max(); w,h=x1-x0+1,y1-y0+1; s=20/max(w,h)
    crop=im.crop((x0,y0,x1+1,y1+1)).resize((max(1,round(w*s)),max(1,round(h*s))),Image.LANCZOS)
    out=Image.new('L',(28,28),0); out.paste(crop,((28-crop.width)//2,(28-crop.height)//2))
    d=np.clip(np.round(np.array(out)/255*15),0,15).astype('uint8').reshape(-1)
    return d
if __name__=='__main__':
    rows=[json.loads(l) for l in gzip.open('package/src/drawings/cat.ndjson.gz','rt')][:6]
    s=Image.new('L',(112*6,112),255)
    for i,r in enumerate(rows):
        d=convert(r); s.paste(Image.fromarray((255-d.reshape(28,28)*17).astype('uint8')).resize((112,112),Image.NEAREST),(i*112,0))
    s.save('conv.png')
