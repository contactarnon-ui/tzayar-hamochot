import gzip,json,base64,zlib,random,numpy as np
from mapping import M
from conv import convert
random.seed(7); np.random.seed(7)
N=28; IN=784; H=64; LR=0.015
words=list(M)
DATA={}
for w in words:
    rows=[json.loads(l) for l in gzip.open(f'package/src/drawings/{M[w]}.ndjson.gz','rt')]
    ds=[d for d in (convert(r) for r in rows) if d is not None]
    DATA[w]=ds
def tf8(d,k):
    a=d.reshape(N,N)
    if k&4: a=a[:,::-1]
    a=np.rot90(a,-(k&3))  # match client rotation direction roughly; invariance makes exact match irrelevant
    return a.reshape(-1)
def shift(a,dx,dy):
    o=np.zeros_like(a.reshape(N,N)); s=a.reshape(N,N)
    ys=slice(max(0,dy),N+min(0,dy)); xs=slice(max(0,dx),N+min(0,dx))
    ys2=slice(max(0,-dy),N+min(0,-dy)); xs2=slice(max(0,-dx),N+min(0,-dx))
    o[ys,xs]=s[ys2,xs2]; return o.reshape(-1)
def train(exs,K,steps):
    W1=np.random.randn(H,IN).astype(np.float32)*np.sqrt(2/IN); b1=np.zeros(H,np.float32)
    W2=(np.random.randn(K,H)*np.sqrt(1/H)).astype(np.float32); b2=np.zeros(K,np.float32)
    byc=[[e for e in exs if e[0]==k] for k in range(K)]
    for it in range(steps):
        k=random.randrange(K); c,d=random.choice(byc[k])
        x=shift(tf8(d,random.randrange(8)),random.randint(-2,2),random.randint(-2,2)).astype(np.float32)/15
        nz=np.nonzero(x)[0]
        h=W1[:,nz]@x[nz]+b1; h=np.maximum(h,0)
        z=W2@h+b2; z-=z.max(); p=np.exp(z); p/=p.sum()
        g=p.copy(); g[c]-=1
        dh=W2.T@g; W2-=LR*np.outer(g,h); b2-=LR*g
        dh*= (h>0)
        W1[:,nz]-=LR*np.outer(dh,x[nz]); b1-=LR*dh
    return W1,b1,W2,b2
def acc(net,exs):
    W1,b1,W2,b2=net; ok=0
    for c,d in exs:
        x=d.astype(np.float32)/15; h=np.maximum(W1@x+b1,0); ok+=int(np.argmax(W2@h+b2)==c)
    return ok/len(exs)
b64=lambda a:base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()
def Lof(d): return round(float((d>=8).sum())/40,2)
NAMES=['פיקסל','נוירון','סינפסה','שרבוטון','קשקשון','ביט','דיודה','צ\'יפ','מעגלי','רובי','בייט','לוגי']
bots=[]
for bi,name in enumerate(NAMES):
    nw=random.randint(8,18); ws=random.sample(words,nw)
    exs=[];cats=[]
    for k,w in enumerate(ws):
        n=random.choice([1,2,3,3,4,5,5,6,8,10])
        idx=random.sample(range(0,min(50,len(DATA[w]))),n)
        for i in idx: exs.append((k,DATA[w][i]))
        cats.append({'w':w,'n':n})
    W1,b1,W2,b2=train(exs,len(ws),24000+1500*nw)
    # holdout accuracy on dataset drawings 70..90
    hold=[(k,DATA[w][i]) for k,w in enumerate(ws) for i in range(70,min(80,len(DATA[w])))]
    sc=np.abs(W1).max(axis=1)/127+1e-9; q=np.round(W1/sc[:,None]).astype(np.int8)
    exj=json.dumps([[c,''.join('0123456789abcdef'[v] for v in d),Lof(d)] for c,d in exs])
    co=zlib.compressobj(9,zlib.DEFLATED,-15); z=co.compress(exj.encode())+co.flush()
    bots.append({'name':name,'cats':cats,'net':{'q':b64(q),'s':b64(sc.astype(np.float32)),'b1':b64(b1),'W2':[b64(r) for r in W2],'b2':[float(v) for v in b2]},'ex':'Z'+base64.b64encode(z).decode()})
    print(name,nw,'words',len(exs),'ex','train acc',round(acc((W1,b1,W2,b2),exs),2),'holdout',round(acc((W1,b1,W2,b2),hold),2))
pool={}
for w in words:
    sel=DATA[w][50:62]
    bits=b''.join(np.packbits((d>=7).astype(np.uint8)).tobytes() for d in sel)
    pool[w]={'b':base64.b64encode(bits).decode(),'L':[Lof(d) for d in sel]}
json.dump({'bots':bots,'pool':pool},open('botdata.json','w'),ensure_ascii=False)
import os;print('size',os.path.getsize('botdata.json'))
