import json,base64,random,numpy as np,time
exec(open('train_bots.py').read().split("NAMES=")[0])
random.seed(11); np.random.seed(11)
K=len(words); exs=[(k,DATA[w][i]) for k,w in enumerate(words) for i in range(min(50,len(DATA[w])))]
t=time.time(); net=train(exs,K,400000); print('trained',round(time.time()-t),'s')
W1,b1,W2,b2=net
def prob(d,c):
    x=d.astype(np.float32)/15; h=np.maximum(W1@x+b1,0); z=W2@h+b2; z-=z.max(); p=np.exp(z); p/=p.sum(); return p[c],int(np.argmax(p))==c
def dens(d):
    b=(d>=7); ys,xs=np.nonzero(b.reshape(28,28)); area=(ys.max()-ys.min()+1)*(xs.max()-xs.min()+1); return b.sum()/area
old=json.load(open('botdata.json')); pool={}; stats=[]
for k,w in enumerate(words):
    cand=[]
    for d in DATA[w][50:]:
        dn=dens(d)
        if dn>0.36 or (d>=7).sum()<45: continue
        p,top=prob(d,k)
        cand.append((p,dn,d))
    cand.sort(key=lambda x:-x[0]); sel=[c[2] for c in cand[:12]]
    if len(sel)<12:  # משלימים מהשאר הכי פחות צפופים
        rest=sorted([d for d in DATA[w] if (d>=7).sum()>=45 and not any(d is s for s in sel)],key=lambda d:abs(dens(d)-0.22)); sel+=rest[:12-len(sel)]
    stats.append((w,len(cand)))
    bits=b''.join(np.packbits((d>=7).astype(np.uint8)).tobytes() for d in sel)
    pool[w]={'b':base64.b64encode(bits).decode(),'L':[Lof(d) for d in sel]}
print('weak words:',[s for s in stats if s[1]<12])
old['pool']=pool; json.dump(old,open('botdata.json','w'),ensure_ascii=False)
