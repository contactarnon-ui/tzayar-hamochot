# אימון מחדש של הרובוטים: בלי היפוכים, הטיה עד 45°, 10 ציורים לכל מילה. אותן מילים לכל רובוט.
import json,base64,zlib,random,numpy as np
from scipy.ndimage import rotate
exec(open('train_bots.py').read().split("NAMES=")[0].replace("def train(","def _old_train("))
random.seed(21); np.random.seed(21)
ANG=(-45,-30,-15,0,15,30,45)
def train(exs,K,steps):
    W1=np.random.randn(H,IN).astype(np.float32)*np.sqrt(2/IN); b1=np.zeros(H,np.float32)
    W2=(np.random.randn(K,H)*np.sqrt(1/H)).astype(np.float32); b2=np.zeros(K,np.float32)
    rot={}
    byc=[[e for e in exs if e[0]==k] for k in range(K)]
    for it in range(steps):
        k=random.randrange(K); j=random.randrange(len(byc[k])); c,d=byc[k][j]; a=random.choice(ANG)
        key=(k,j,a)
        if key not in rot: rot[key]=np.clip(np.round(rotate(d.reshape(N,N).astype(float),a,reshape=False,order=1)),0,15).reshape(-1) if a else d
        x=shift(rot[key],random.randint(-2,2),random.randint(-2,2)).astype(np.float32)/15
        nz=np.nonzero(x)[0]
        h=W1[:,nz]@x[nz]+b1; h=np.maximum(h,0)
        z=W2@h+b2; z-=z.max(); p=np.exp(z); p/=p.sum()
        g=p.copy(); g[c]-=1
        dh=W2.T@g; W2-=LR*np.outer(g,h); b2-=LR*g
        dh*=(h>0); W1[:,nz]-=LR*np.outer(dh,x[nz]); b1-=LR*dh
    return W1,b1,W2,b2
old=json.load(open('botdata.json'))
bots=[]
for ob in old['bots']:
    ws=[c['w'] for c in ob['cats']]; exs=[]; cats=[]
    for k,w in enumerate(ws):
        idx=random.sample(range(0,min(50,len(DATA[w]))),10)
        for i in idx: exs.append((k,DATA[w][i]))
        cats.append({'w':w,'n':10})
    W1,b1,W2,b2=train(exs,len(ws),40000+3000*len(ws))
    hold=[(k,DATA[w][i]) for k,w in enumerate(ws) for i in range(70,min(80,len(DATA[w])))]
    sc=np.abs(W1).max(axis=1)/127+1e-9; q=np.round(W1/sc[:,None]).astype(np.int8)
    exj=json.dumps([[c,''.join('0123456789abcdef'[int(v)] for v in d),Lof(d)] for c,d in exs])
    co=zlib.compressobj(9,zlib.DEFLATED,-15); z=co.compress(exj.encode())+co.flush()
    bots.append({'name':ob['name'],'cats':cats,'net':{'q':b64(q),'s':b64(sc.astype(np.float32)),'b1':b64(b1),'W2':[b64(r) for r in W2],'b2':[float(v) for v in b2]},'ex':'Z'+base64.b64encode(z).decode()})
    print(ob['name'],len(ws),'words','train',round(acc((W1,b1,W2,b2),exs),2),'holdout',round(acc((W1,b1,W2,b2),hold),2),flush=True)
old['bots']=bots; old['ver']=2
json.dump(old,open('botdata.json','w'),ensure_ascii=False)
import os;print('size',os.path.getsize('botdata.json'))
