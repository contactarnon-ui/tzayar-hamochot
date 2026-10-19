# ניקוי ציור 28x28 מקושקש: שלד דק -> קו אחיד כמו עט האפליקציה -> חזרה ל-28x28 כמו grabPad
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from skimage.morphology import skeletonize
from scipy.ndimage import binary_dilation, binary_closing
def clean(d, pen=18):
    a=np.array(d,float).reshape(28,28)/15
    big=np.array(Image.fromarray((a*255).astype('uint8')).resize((280,280),Image.BICUBIC),float)/255
    m=big>0.42
    m=binary_closing(m,iterations=2)
    sk=skeletonize(m)
    if sk.sum()<10: return None
    # מציירים את השלד בעט עגול (כמו באפליקציה)
    ys,xs=np.nonzero(sk); x0,x1,y0,y1=xs.min(),xs.max(),ys.min(),ys.max()
    # הגדלה ל-200 פיקסל בערך כמו ציור אמיתי על הלוח
    s=200/max(x1-x0+1,y1-y0+1,1)
    canvas=Image.new('L',(280,280),255); dr=ImageDraw.Draw(canvas)
    r=pen/2
    for y,x in zip(ys,xs):
        X=(x-x0)*s+40; Y=(y-y0)*s+40; dr.ellipse((X-r,Y-r,X+r,Y+r),fill=0)
    # אותו עיבוד כמו grabPad: bbox -> 20px במרכז 28x28
    arr=np.array(canvas); yy,xx=np.nonzero(arr<128)
    bx0,bx1,by0,by1=xx.min(),xx.max(),yy.min(),yy.max(); w,h=bx1-bx0+1,by1-by0+1; sc=20/max(w,h)
    crop=canvas.crop((bx0,by0,bx1+1,by1+1)).resize((max(1,round(w*sc)),max(1,round(h*sc))),Image.LANCZOS)
    out=Image.new('L',(28,28),255); out.paste(crop,((28-crop.width)//2,(28-crop.height)//2))
    return np.clip(np.round((255-np.array(out,float))/255*15),0,15).astype('uint8').reshape(-1)
