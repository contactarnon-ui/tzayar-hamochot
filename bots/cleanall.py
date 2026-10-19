# ציורי הרובוטים בקו נקי (כמו עט האפליקציה): מאגר הציורים + אימון מחדש של הרובוטים
import json,base64,numpy as np,sys
sys.path.insert(0,'/home/claude/qd')
from clean import clean
b=json.load(open('botdata.json'))
pool={}
for w,p in b['pool'].items():
    s=base64.b64decode(p['b']); n=len(p['L']); ds=[]; Ls=[]
    for i in range(n):
        bits=np.unpackbits(np.frombuffer(s[i*98:(i+1)*98],dtype=np.uint8))[:784].astype(int)*15
        c=clean(bits)
        if c is None: continue
        ds.append(c); Ls.append(round(float((c>=8).sum())/40,2))
    q=np.concatenate([np.round(d/5).astype(np.uint8) for d in ds])  # 0..3
    packed=np.packbits(np.unpackbits(q[:,None],axis=1)[:,6:].reshape(-1))
    pool[w]={'b2':base64.b64encode(packed.tobytes()).decode(),'L':Ls}
b['pool']=pool
json.dump(b,open('botdata.json','w'),ensure_ascii=False)
print('pool ok', len(pool))
