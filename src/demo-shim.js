// מצב הדגמה: "שרת" מדומה בתוך הדפדפן (localStorage משותף לכל הטלפונים באותו דפדפן)
(function(){
window.__DEMO=true;
const WORDS=/*__WORDS__*/null;
const N=28,IN=N*N,MIN_EX=1,MAX_EX=10,MIN_WORDS=5,BASE={1:10,2:20,3:30,4:10};
const LVL=new Map();for(const k of ['1','2','3'])for(const w of WORDS[k])LVL.set(w,+k);
const WF_S=/*__FILTER__*/null;
function wordProblemS(w, F = WF_S) {
  w = String(w || '').trim();
  if (!w) return 'כתבו מילה';
  if (/\s/.test(w)) return 'רק מילה אחת, בלי רווחים';
  if (!/^[\u05D0-\u05EA'"׳״-]+$/.test(w)) return 'רק אותיות בעברית';
  const L = w.replace(/['"׳״-]/g, '').length;
  if (L < 2) return 'מילה קצרה מדי';
  if (L > 12) return 'מילה ארוכה מדי';
  const norm = s => s.replace(/['"׳״-]/g, '').replace(/[ךםןףץ]/g, c => 'כמנפצ'['ךםןףץ'.indexOf(c)]).replace(/(.)\1+/g, '$1');
  const bad = new Set(F.bad.map(norm)), sub = F.sub.map(norm), n = norm(w), forms = [n];
  for (let i = 1; i <= 3 && i < n.length - 1; i++) { if (!'הובכלש'.includes(n[i - 1])) break; forms.push(n.slice(i)); }
  if (forms.some(f => bad.has(f)) || sub.some(s => n.includes(s))) return 'המילה הזאת לא מתאימה למשחק';
  return '';
}
const lvlOf=w=>LVL.get(w)||(wordProblemS(w)?0:4);
const sizeBonus=k=>Math.min(2,Math.max(0,(k-MIN_WORDS)*0.05));
const riskMult=n=>Math.round((3-(Math.min(MAX_EX,Math.max(1,n))-1)*2/9)*10)/10;
const CM={mirror:1.5},cmul=c=>CM[c]||1;
const scoreFor=(l,k,c,ok,n,cu)=>{const b=BASE[l]||10,m=riskMult(n)*cmul(cu);return ok?Math.max(1,Math.round(b*(1+sizeBonus(k))*m*c)):-Math.round(b/2*m);};
const maxScore=(l,k,n,cu)=>Math.round((BASE[l]||10)*(1+sizeBonus(k))*riskMult(n)*cmul(cu));
const CURSES=['line','three','mirror','white','time','straight','flip','rotate','shaky','dots','fade','tiny','fat'],SIM_OK=0.8,SIM_LO=0.66,SIM_HI=0.95,SIM_TF=[-45,-30,-15,0,15,30,45];
// אותו עובי קו לכולם: הופכים לשחור־לבן ומעבים ב־1 פיקסל, כך שמשווים רק צורה
function thickN(d){const b=new Float32Array(IN);for(let y=0;y<N;y++)for(let x=0;x<N;x++){let on=0;for(let a=-1;a<=1&&!on;a++)for(let c=-1;c<=1;c++){const yy=y+a,xx=x+c;if(yy>=0&&yy<N&&xx>=0&&xx<N&&d[yy*N+xx]>=6){on=1;break;}}b[y*N+x]=on?15:0;}return b;}
function prep(d){return blur2(thickN(d));}
function blur2(d){let o=Float32Array.from(d);for(let pass=0;pass<2;pass++){const n=new Float32Array(IN);for(let y=0;y<N;y++)for(let x=0;x<N;x++){let s=0,c=0;for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const yy=y+a,xx=x+b;if(yy<0||yy>=N||xx<0||xx>=N)continue;s+=o[yy*N+xx];c++;}n[y*N+x]=s/c;}o=n;}return o;}
// הטיה קלה בלבד: סיבוב בזווית (מעלות), בלי היפוכים
function tf8(d,deg){if(!deg)return d;const o=new d.constructor(d.length),r=deg*Math.PI/180,c=Math.cos(r),s=Math.sin(r),m=(N-1)/2,isI=!(d instanceof Float32Array);for(let y=0;y<N;y++)for(let x=0;x<N;x++){const u=c*(x-m)+s*(y-m)+m,v=-s*(x-m)+c*(y-m)+m,x0=Math.floor(u),y0=Math.floor(v),fx=u-x0,fy=v-y0;let val=0;for(const [dx,dy,w] of [[0,0,(1-fx)*(1-fy)],[1,0,fx*(1-fy)],[0,1,(1-fx)*fy],[1,1,fx*fy]]){const xx=x0+dx,yy=y0+dy;if(xx>=0&&xx<N&&yy>=0&&yy<N)val+=d[yy*N+xx]*w;}o[y*N+x]=isI?Math.round(val):val;}return o;}
function cosSim(a,b){let ma=0,mb=0;const n=a.length;for(let i=0;i<n;i++){ma+=a[i];mb+=b[i];}ma/=n;mb/=n;let s=0,x=0,y=0;for(let i=0;i<n;i++){const u=a[i]-ma,v=b[i]-mb;s+=u*v;x+=u*u;y+=v*v;}return s/Math.sqrt(x*y+1e-9);}
const hexD=s=>{const d=new Uint8Array(IN);for(let i=0;i<IN;i++)d[i]=parseInt(s[i],16)||0;return d;};
async function unzipEx(b){if(!b)return [];if(b[0]==='P')return JSON.parse(decodeURIComponent(escape(atob(b.slice(1)))));const s=atob(b.slice(1)),u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return JSON.parse(await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text());}
const uid=()=>(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2));
const mem={};
function load(ns){try{const v=localStorage.getItem('tzdemo_db_'+ns);if(v)return JSON.parse(v);}catch(e){}return mem[ns]||(mem[ns]={players:[],brains:{},challenges:[],attempts:[],notes:[]});}
function save(ns,db){mem[ns]=db;try{localStorage.setItem('tzdemo_db_'+ns,JSON.stringify(db));}catch(e){}}
function b64ToF32(b){const s=atob(b),u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return new Float32Array(u.buffer);}
function forward(netS,ds){
 const o=JSON.parse(netS),W1=b64ToF32(o.W1),b1=b64ToF32(o.b1),W2=o.W2.map(b64ToF32),H=o.H,h=new Float32Array(H),d=[];
 for(let i=0;i<IN;i++)d.push(parseInt(ds[i],16)||0);
 for(let j=0;j<H;j++){let s=b1[j];const q=j*IN;for(let i=0;i<IN;i++)if(d[i])s+=W1[q+i]*d[i]/15;h[j]=s>0?s:0;}
 const K=W2.length,p=new Float32Array(K);let m=-1e9;for(let k=0;k<K;k++){let s=o.b2[k];for(let j=0;j<H;j++)s+=W2[k][j]*h[j];p[k]=s;if(s>m)m=s;}
 let sum=0;for(let k=0;k<K;k++){p[k]=Math.exp(p[k]-m);sum+=p[k];}for(let k=0;k<K;k++)p[k]/=sum;return p;
}
const R=(o,st=200)=>new Response(JSON.stringify(o),{status:st,headers:{'content-type':'application/json'}});
const E=(m,st=400)=>R({error:m},st);
async function handle(method,url,headers,body){
 const ns=url.searchParams.get('ns')==='test'?'test':'live',p=url.pathname.replace(/^.*\/api\//,'/api/'),db=load(ns);
 const P=id=>db.players.find(x=>x.id===id);
 if(p==='/api/words')return R(WORDS);
 if(p==='/api/vapid')return R({key:null});
 if(p==='/api/register'){const name=String(body.name||'').replace(/\s+/g,' ').trim().slice(0,14);if(name.length<2)return E('שם קצר מדי');if(db.players.some(x=>x.name===name))return E('השם הזה תפוס – נסו שם אחר');
  const pl={id:uid(),name,code:String(1000+Math.floor(Math.random()*9000)),token:uid()+uid(),score:0,created:Date.now()};db.players.push(pl);save(ns,db);return R(pl);}
 if(p==='/api/login'){const pl=db.players.find(x=>x.name===String(body.name||'').trim()&&x.code===String(body.code||'').trim());return pl?R(pl):E('השם או הקוד לא נכונים',401);}
 if(p==='/api/leaders'){return R({leaders:db.players.slice().sort((a,b)=>b.score-a.score||a.created-b.created).slice(0,30).map(x=>({id:x.id,name:x.name,score:x.score,words:(db.brains[x.id]||{}).ready_words||0}))});}
 if(p==='/api/feed'){const feed=db.attempts.slice().reverse().slice(0,40).map(a=>({...a,drawer:(P(a.player_id)||{}).name,owner:(P(a.owner_id)||{}).name}));
  const stats=[1,2,3].map(l=>{const xs=db.attempts.filter(a=>a.lvl===l),ok=xs.filter(a=>a.ok);return {lvl:l,n:xs.length,ok:ok.length,conf:ok.length?ok.reduce((s,a)=>s+a.conf,0)/ok.length:null};}).filter(s=>s.n);
  return R({feed,stats,open:db.challenges.filter(c=>c.status==='open').length});}
 if(p==='/api/reset'){if(ns!=='test')return E('אפשר לאפס רק את סביבת הבדיקה',403);save(ns,{players:[],brains:{},challenges:[],attempts:[],notes:[]});return R({ok:true});}
 const tok=(headers.authorization||'').replace(/^Bearer\s+/i,''),me=db.players.find(x=>x.token===tok);
 if(!me)return E('צריך להתחבר מחדש',401);
 if(p==='/api/me'){return R({me:{id:me.id,name:me.name,code:me.code,score:me.score,rank:db.players.filter(x=>x.score>me.score).length+1},notes:db.notes.filter(n=>n.player_id===me.id&&!n.seen).slice(-10)});}
 if(p==='/api/notes')return R({notes:db.notes.filter(n=>n.player_id===me.id).slice(-30).reverse()});
 if(p==='/api/notes/seen'){db.notes.forEach(n=>{if(n.player_id===me.id)n.seen=1;});save(ns,db);return R({ok:true});}
 if(p==='/api/push/sub')return R({ok:true});
 if(p==='/api/brain'&&method==='GET'){return R({brain:db.brains[me.id]||null});}
 if(p==='/api/brain'&&method==='PUT'){
  const cats=(body.cats||[]).map(c=>({w:c.w,n:Math.min(MAX_EX,c.n|0)}));if(cats.some(c=>!lvlOf(c.w)))return E('יש במוח מילה שלא מתאימה למשחק');
  const ready=cats.filter(c=>c.n>=MIN_EX).length;
  db.brains[me.id]={cats:JSON.stringify(cats),ready_words:ready,net:body.net,ex:body.ex,rounds:body.rounds|0,updated:Date.now()};
  const okW=new Set(cats.filter(c=>c.n>=MIN_EX).map(c=>c.w));
  db.challenges.forEach(c=>{if(c.owner_id===me.id&&c.status==='open'&&(!okW.has(c.word)||ready<MIN_WORDS))c.status='closed';});
  save(ns,db);return R({ok:true,ready});}
 if(p==='/api/square'){return R({challenges:db.challenges.filter(c=>c.status==='open'&&c.owner_id!==me.id&&!db.attempts.some(a=>a.challenge_id===c.id&&a.player_id===me.id&&a.ok)).slice().reverse()
  .map(c=>{const br=db.brains[c.owner_id]||{},k=br.ready_words||0,n=((br.cats?JSON.parse(br.cats):[]).find(x=>x.w===c.word)||{n:1}).n;return {id:c.id,word:c.word,lvl:c.lvl,tries:c.tries,created:c.created,curse:c.curse,owner:(P(c.owner_id)||{}).name,k,n,mult:riskMult(n),cmult:cmul(c.curse),max:maxScore(c.lvl,k,n,c.curse)};})});}
 if(p==='/api/mine'){return R({challenges:db.challenges.filter(c=>c.owner_id===me.id&&c.status!=='closed').slice().reverse().map(c=>({...c,solver:c.solved_by?(P(c.solved_by)||{}).name:null}))});}
 if(p==='/api/challenge'&&method==='POST'){
  const w=String(body.word||''),lvl=lvlOf(w);if(!lvl)return E('המילה לא מתאימה למשחק');const br=db.brains[me.id];
  if(!br||!br.net)return E('קודם צריך לאמן את המוח');if(br.ready_words<MIN_WORDS)return E(`צריך לפחות ${MIN_WORDS} מילים עם ${MIN_EX} ציורים כל אחת`);
  const c=JSON.parse(br.cats).find(c=>c.w===w);if(!c||c.n<MIN_EX)return E(`למילה צריך לפחות ${MIN_EX} ציורים`);
  if(db.challenges.some(c=>c.owner_id===me.id&&c.word===w&&c.status==='open'))return E('המילה הזאת כבר באתגר');
  if(db.challenges.some(c=>c.owner_id===me.id&&c.word===w&&c.status==='solved'))return E('המילה הזאת כבר נפתרה – אי אפשר לפרסם אותה שוב');
  const ch={id:uid(),owner_id:me.id,word:w,lvl,status:'open',tries:0,created:Date.now(),curse:CURSES[Math.floor(Math.random()*CURSES.length)]};db.challenges.push(ch);save(ns,db);return R({ok:true,id:ch.id});}
 const md=p.match(/^\/api\/challenge\/(.+)$/);
 if(md&&method==='DELETE'){const c=db.challenges.find(c=>c.id===md[1]&&c.owner_id===me.id&&c.status==='open');if(c)c.status='closed';save(ns,db);return R({ok:true});}
 if(p==='/api/attempt'){
  const c=db.challenges.find(c=>c.id===body.id);if(!c)return E('האתגר לא נמצא',404);
  if(c.owner_id===me.id)return E('אי אפשר לאתגר את המוח של עצמך');
  if(c.status!=='open')return E('האתגר נסגר');
  if(db.attempts.some(a=>a.challenge_id===c.id&&a.player_id===me.id&&a.ok))return E('כבר פתרת את האתגר הזה');
  const br=db.brains[c.owner_id],cats=br?JSON.parse(br.cats):[],k=cats.findIndex(x=>x.w===c.word);
  if(!br||!br.net||k<0)return E('המוח של בעל האתגר השתנה – האתגר נסגר');
  const ds=typeof body.d==='string'&&/^[0-9a-f]{784}$/.test(body.d)?body.d:null;let ok=false,conf=0,guess='',sim=0;
  const exK=(await unzipEx(br.ex)).filter(a=>a[0]===k).map(a=>hexD(a[1])),nEx=Math.max(1,exK.length||cats[k].n);
  if(ds){const pr=forward(br.net,ds);let g=0;for(let i=1;i<pr.length;i++)if(pr[i]>pr[g])g=i;const bd=prep(hexD(ds)),eb=exK.map(prep);sim=1;if(eb.length){sim=0;for(const q of SIM_TF){const t=tf8(bd,q);for(const e of eb)sim=Math.max(sim,cosSim(t,e));}}ok=g===k&&sim>=SIM_OK;conf=pr[k]*Math.min(1,Math.max(0,(sim-SIM_LO)/(SIM_HI-SIM_LO)));guess=g===k&&!ok?'':cats[g].w;}
  const K=cats.filter(x=>x.n>=MIN_EX).length,pts=scoreFor(c.lvl,K,conf,ok,nEx,c.curse),owner=P(c.owner_id);
  c.tries++;if(ok)c.solved_by=me.id;
  db.attempts.push({id:uid(),challenge_id:c.id,player_id:me.id,owner_id:c.owner_id,word:c.word,lvl:c.lvl,ok:ok?1:0,conf,guess,points:pts,k:K,created:Date.now()});
  me.score=Math.max(0,me.score+pts);if(ok)owner.score+=pts;
  const pc=Math.round(conf*100),gain=ok?`קיבלת ${pts} נקודות`:`איבדת ${-pts} נקודות`;
  db.notes.push({id:uid(),player_id:owner.id,kind:ok?'win':'lose',text:ok?`${me.name} צייר "${c.word}" – המוח שלך זיהה ב־${pc}%. ${gain}`:guess?`${me.name} צייר "${c.word}" – המוח שלך חשב שזה "${guess}". לא הפסדת נקודות`:`${me.name} צייר "${c.word}" – לא דומה מספיק לציורים שלך. לא הפסדת נקודות`,points:ok?pts:0,seen:0,created:Date.now()});
  db.notes.push({id:uid(),player_id:me.id,kind:ok?'dwin':'dlose',text:ok?`המוח של ${owner.name} זיהה את "${c.word}" שלך ב־${pc}%. ${gain}`:`המוח של ${owner.name} לא זיהה את "${c.word}" שלך. ${gain}`,points:pts,seen:0,created:Date.now()});
  save(ns,db);return R({ok,conf,guess,sim,n:nEx,mult:riskMult(nEx),cmult:cmul(c.curse),points:pts,k:K,lvl:c.lvl,word:c.word,owner:owner.name,empty:!ds});}
 return E('לא נמצא',404);
}
const realFetch=window.fetch.bind(window);
window.fetch=async(input,opt={})=>{
 const url=new URL(typeof input==='string'?input:input.url,location.href);
 if(!/\/api\//.test(url.pathname))return realFetch(input,opt);
 let body={};try{body=opt.body?JSON.parse(opt.body):{};}catch(e){}
 await new Promise(r=>setTimeout(r,80));
 try{return await handle((opt.method||'GET').toUpperCase(),url,opt.headers||{},body);}catch(e){return E('שגיאה: '+e.message,500);}
};
})();
