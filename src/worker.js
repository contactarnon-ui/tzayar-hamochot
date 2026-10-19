// צייר המוחות – Cloudflare Worker (D1 + Web Push)
import { WORDS, WFILTER, wordProblem } from './words.js';
import APP from './app.html';
import SIM from './sim.html';
import { ICONS } from './icons.js';

const N = 28, IN = N * N;
const MIN_EX = 1, MAX_EX = 10, MIN_WORDS = 5;
const BASE = { 1: 10, 2: 20, 3: 30, 4: 10 };
const LVL = new Map();
for (const k of ['1', '2', '3']) for (const w of WORDS[k]) LVL.set(w, +k);
// מילה חופשית (לא מהמאגר, עברה סינון) = רמה 4, ניקוד כמו פשוטה
const lvlOf = w => LVL.get(w) || (wordProblem(w) ? 0 : 4);

/*__KNN__*/
/* ---------- ניקוד ---------- */
export function sizeBonus(k) { return Math.min(2, Math.max(0, (k - MIN_WORDS) * 0.05)); }
// מכפיל סיכון: ציור אחד = ×3, עשרה ציורים = ×1
export function riskMult(n) { return Math.round((3 - (Math.min(MAX_EX, Math.max(1, n)) - 1) * 2 / 9) * 10) / 10; }
const CURSE_MULT = { mirror: 1.5 };
const curseMult = c => MODE === 'ink' ? 1 : (CURSE_MULT[c] || 1);
export function scoreFor(lvl, k, conf, ok, n, curse, extra = 1) {
  const b = BASE[lvl] || 10, m = riskMult(n) * curseMult(curse);
  return ok ? Math.max(1, Math.round(b * (1 + sizeBonus(k)) * m * extra * conf)) : -Math.round(b / 2 * m);
}
function maxScore(lvl, k, n, curse) { return Math.round((BASE[lvl] || 10) * (1 + sizeBonus(k)) * riskMult(n) * curseMult(curse)); }
const CURSES = ['line', 'three', 'mirror', 'white', 'time', 'straight', 'flip', 'rotate', 'shaky', 'dots', 'fade', 'tiny', 'fat'];
/* דמיון: הציור מושווה לציורים שבעל המוח שמר למילה */
const SIM_OK = 0.8, SIM_LO = 0.66, SIM_HI = 0.95;
const SIM_TF = [-45, -30, -15, 0, 15, 30, 45]; // הטיה עד 45° לכל כיוון, בלי היפוכים
// אותו עובי קו לכולם: הופכים לשחור־לבן ומעבים ב־1 פיקסל, כך שמשווים רק צורה
function thickN(d){const b=new Float32Array(IN);for(let y=0;y<N;y++)for(let x=0;x<N;x++){let on=0;for(let a=-1;a<=1&&!on;a++)for(let c=-1;c<=1;c++){const yy=y+a,xx=x+c;if(yy>=0&&yy<N&&xx>=0&&xx<N&&d[yy*N+xx]>=6){on=1;break;}}b[y*N+x]=on?15:0;}return b;}
function prep(d){return blur2(thickN(d));}
function blur2(d) { let o = Float32Array.from(d); for (let pass = 0; pass < 2; pass++) { const n = new Float32Array(IN); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let s = 0, c = 0; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const yy = y + a, xx = x + b; if (yy < 0 || yy >= N || xx < 0 || xx >= N) continue; s += o[yy * N + xx]; c++; } n[y * N + x] = s / c; } o = n; } return o; }
// מתאם (פירסון): משווה צורה, לא רק כמות דיו במרכז
function cosSim(a,b){let ma=0,mb=0;const n=a.length;for(let i=0;i<n;i++){ma+=a[i];mb+=b[i];}ma/=n;mb/=n;let s=0,x=0,y=0;for(let i=0;i<n;i++){const u=a[i]-ma,v=b[i]-mb;s+=u*v;x+=u*u;y+=v*v;}return s/Math.sqrt(x*y+1e-9);}
// היפוכים וסיבובים: 4 סיבובים × עם/בלי מראה
// הטיה קלה בלבד: סיבוב בזווית (מעלות), בלי היפוכים
function tf8(d,deg){if(!deg)return d;const o=new d.constructor(d.length),r=deg*Math.PI/180,c=Math.cos(r),s=Math.sin(r),m=(N-1)/2,isI=!(d instanceof Float32Array);for(let y=0;y<N;y++)for(let x=0;x<N;x++){const u=c*(x-m)+s*(y-m)+m,v=-s*(x-m)+c*(y-m)+m,x0=Math.floor(u),y0=Math.floor(v),fx=u-x0,fy=v-y0;let val=0;for(const [dx,dy,w] of [[0,0,(1-fx)*(1-fy)],[1,0,fx*(1-fy)],[0,1,(1-fx)*fy],[1,1,fx*fy]]){const xx=x0+dx,yy=y0+dy;if(xx>=0&&xx<N&&yy>=0&&yy<N)val+=d[yy*N+xx]*w;}o[y*N+x]=isI?Math.round(val):val;}return o;}
function simTo(d, exs) { const bd = prep(d), eb = exs.map(prep); let m = 0; for (const k of SIM_TF) { const t = tf8(bd, k); for (const e of eb) m = Math.max(m, cosSim(t, e)); } return m; }
const simFactor = s => Math.min(1, Math.max(0, (s - SIM_LO) / (SIM_HI - SIM_LO)));
async function unzipEx(b) {
  if (!b) return [];
  if (b[0] === 'P') return JSON.parse(decodeURIComponent(escape(atob(b.slice(1)))));
  const s = atob(b.slice(1)), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  const ds = new Blob([u]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return JSON.parse(await new Response(ds).text());
}

/* ---------- רשת עצבית (שיפוט) ---------- */
function b64ToF32(b) {
  const s = atob(b), u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return new Float32Array(u.buffer);
}
function strToD(s) {
  const d = new Uint8Array(IN);
  for (let i = 0; i < IN; i++) d[i] = parseInt(s[i], 16) || 0;
  return d;
}
function forward(net, d) {
  const H = net.H, W1 = net.W1, h = new Float32Array(H);
  const nz = []; for (let i = 0; i < IN; i++) if (d[i]) nz.push(i);
  for (let j = 0; j < H; j++) {
    let s = net.b1[j]; const o = j * IN;
    for (const i of nz) s += W1[o + i] * (d[i] / 15);
    h[j] = s > 0 ? s : 0;
  }
  const K = net.W2.length, p = new Float32Array(K); let m = -1e9;
  for (let k = 0; k < K; k++) { let s = net.b2[k]; const w = net.W2[k]; for (let j = 0; j < H; j++) s += w[j] * h[j]; p[k] = s; if (s > m) m = s; }
  let sum = 0; for (let k = 0; k < K; k++) { p[k] = Math.exp(p[k] - m); sum += p[k]; }
  for (let k = 0; k < K; k++) p[k] /= sum;
  return p;
}
function decodeNet(json) {
  const o = JSON.parse(json);
  return { H: o.H, W1: b64ToF32(o.W1), b1: b64ToF32(o.b1), W2: o.W2.map(b64ToF32), b2: o.b2 };
}

/* ---------- עזרים ---------- */
const now = () => Date.now();
const uid = () => crypto.randomUUID();
function json(o, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
const err = (msg, status = 400) => json({ error: msg }, status);
const MODE = /*__MODE__*/'curse';
const NS_PLAIN = false;
function nsOf(url) { const b = url.searchParams.get('ns') === 'test' ? 'test' : 'live'; return MODE === 'ink' ? 'ink' + b : b; }
// דיו: יחס בין אורך הקו של המצייר לאורך הקו בציורים של בעל המוח
const INK_MAX = 10, DEF_L = 3;
function inkMult(r) { return Math.round((1 + (INK_MAX - 1) * Math.min(1, Math.max(0, (1 - r) / 0.85))) * 10) / 10; }
function medL(rows) { const Ls = rows.map(a => +a[2]).filter(x => x > 0).sort((x, y) => x - y); return Ls.length ? Ls[Ls.length >> 1] : DEF_L; }
async function body(req) { try { return await req.json(); } catch { return {}; } }
async function auth(req, env, ns) {
  const t = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!t) return null;
  return env.DB.prepare('SELECT id,name,code,score FROM players WHERE token=? AND ns=?').bind(t, ns).first();
}
function cleanName(n) { return String(n || '').replace(/\s+/g, ' ').trim().slice(0, 14); }
function b64url(buf) { let s = ''; for (const x of new Uint8Array(buf)) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }

/* ---------- Web Push (VAPID, בלי תוכן – ה-Service Worker מושך את ההודעה) ---------- */
async function vapidAuth(env, endpoint, origin) {
  const aud = new URL(endpoint).origin;
  const enc = s => b64url(new TextEncoder().encode(JSON.stringify(s)));
  const unsigned = enc({ typ: 'JWT', alg: 'ES256' }) + '.' + enc({ aud, exp: Math.floor(now() / 1000) + 12 * 3600, sub: origin });
  const key = await crypto.subtle.importKey('jwk', JSON.parse(env.VAPID_PRIVATE_JWK), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned));
  return `vapid t=${unsigned}.${b64url(sig)}, k=${env.VAPID_PUBLIC}`;
}
async function pushTo(env, playerId, origin) {
  if (!env.VAPID_PRIVATE_JWK || !env.VAPID_PUBLIC) return;
  const { results } = await env.DB.prepare('SELECT endpoint FROM push_subs WHERE player_id=?').bind(playerId).all();
  for (const r of results) {
    try {
      const res = await fetch(r.endpoint, { method: 'POST', headers: { TTL: '86400', Urgency: 'normal', Authorization: await vapidAuth(env, r.endpoint, origin) } });
      if (res.status === 404 || res.status === 410) await env.DB.prepare('DELETE FROM push_subs WHERE endpoint=?').bind(r.endpoint).run();
    } catch (e) { /* ממשיכים */ }
  }
}
async function note(env, ns, playerId, kind, text, points, ctx, origin) {
  const id = uid();
  await env.DB.prepare('INSERT INTO notes(id,ns,player_id,kind,text,points,created) VALUES(?,?,?,?,?,?,?)').bind(id, ns, playerId, kind, text, points, now()).run();
  ctx.waitUntil(pushTo(env, playerId, origin));
  return id;
}
/* הקלטות ציור: נוצרת אוטומטית בפעם הראשונה (בלי צורך לשנות את מסד הנתונים ידנית) */
let recsReady = false;
async function ensureRecs(DB) {
  if (recsReady) return;
  await DB.prepare('CREATE TABLE IF NOT EXISTS recs (attempt_id TEXT PRIMARY KEY, ns TEXT NOT NULL, note_id TEXT, rec TEXT, created INTEGER NOT NULL)').run();
  await DB.prepare('CREATE INDEX IF NOT EXISTS recs_note ON recs(note_id)').run();
  // אפשר לנסות שוב אחרי כישלון – מבטלים את ההגבלה של ניסיון אחד
  await DB.prepare('DROP INDEX IF EXISTS att_once').run();
  // ניקוד לא יורד מתחת ל־0
  await DB.prepare('UPDATE players SET score=0 WHERE score<0').run();
  await DB.prepare('CREATE INDEX IF NOT EXISTS att_cp ON attempts(challenge_id, player_id)').run();
  recsReady = true;
}

/* ---------- Service Worker ---------- */
const SW = `
self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('push',e=>{e.waitUntil((async()=>{
 const sub=await self.registration.pushManager.getSubscription();
 let notes=[];
 try{const r=await fetch('/api/push/notes',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({endpoint:sub&&sub.endpoint})});notes=(await r.json()).notes||[];}catch(err){}
 if(!notes.length)notes=[{text:'יש תוצאה חדשה באתגר שלך',id:'x'}];
 for(const n of notes.slice(0,3))await self.registration.showNotification('צייר המוחות',{body:n.text,tag:n.id,icon:'/icon-192.png',badge:'/icon-192.png',lang:'he',dir:'rtl'});
})());});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil((async()=>{
 const all=await self.clients.matchAll({type:'window',includeUncontrolled:true});
 for(const c of all){if('focus' in c)return c.focus();}
 return self.clients.openWindow('/');
})());});
`;

const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#FF5A36"/><path d="M256 118c-34-30-96-22-112 22-42 2-66 46-48 82-28 24-24 76 10 94-2 40 40 70 78 56 18 28 54 30 72 10 18 20 54 18 72-10 38 14 80-16 78-56 34-18 38-70 10-94 18-36-6-80-48-82-16-44-78-52-112-22z" fill="#FFF6EA" stroke="#1F2440" stroke-width="16" stroke-linejoin="round"/><path d="M256 132v262M200 190c20 8 30 26 26 48M312 190c-20 8-30 26-26 48M170 290c22-10 46-6 60 12M342 290c-22-10-46-6-60 12" fill="none" stroke="#1F2440" stroke-width="14" stroke-linecap="round"/><circle cx="196" cy="246" r="14" fill="#FF5A36"/><circle cx="316" cy="246" r="14" fill="#FF5A36"/><circle cx="256" cy="330" r="14" fill="#FF5A36"/></svg>`;

function manifest() {
  return JSON.stringify({
    name: 'צייר המוחות', short_name: 'צייר המוחות', lang: 'he', dir: 'rtl',
    description: 'מלמדים מוח מלאכותי לזהות ציורים ומאתגרים את המוחות של כולם',
    start_url: '/', scope: '/', display: 'standalone', orientation: 'portrait',
    background_color: '#FBF6EC', theme_color: '#FBF6EC',
    icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }, { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }]
  });
}

/* ---------- API ---------- */
async function api(req, env, ctx, url) {
  const ns = nsOf(url), p = url.pathname, m = req.method, DB = env.DB, origin = url.origin;

  if (p === '/api/words') return json(WORDS);
  if (p === '/api/vapid') return json({ key: env.VAPID_PUBLIC || null });

  if (p === '/api/register' && m === 'POST') {
    const name = cleanName((await body(req)).name);
    if (name.length < 2) return err('שם קצר מדי');
    if (await DB.prepare('SELECT 1 FROM players WHERE ns=? AND name=?').bind(ns, name).first()) return err('השם הזה תפוס – נסו שם אחר');
    const code = String(1000 + Math.floor(Math.random() * 9000)), token = uid() + uid();
    const id = uid();
    await DB.prepare('INSERT INTO players(id,ns,name,code,token,score,created) VALUES(?,?,?,?,?,0,?)').bind(id, ns, name, code, token, now()).run();
    return json({ id, name, code, token, score: 0 });
  }
  if (p === '/api/login' && m === 'POST') {
    const b = await body(req), name = cleanName(b.name);
    const r = await DB.prepare('SELECT id,name,code,token,score FROM players WHERE ns=? AND name=? AND code=?').bind(ns, name, String(b.code || '').trim()).first();
    if (!r) return err('השם או הקוד לא נכונים', 401);
    return json(r);
  }
  if (p === '/api/push/notes' && m === 'POST') {
    const b = await body(req);
    const s = b.endpoint && await DB.prepare('SELECT player_id FROM push_subs WHERE endpoint=?').bind(b.endpoint).first();
    if (!s) return json({ notes: [] });
    const { results } = await DB.prepare('SELECT id,text FROM notes WHERE player_id=? AND seen=0 ORDER BY created DESC LIMIT 3').bind(s.player_id).all();
    return json({ notes: results });
  }
  if (p === '/api/leaders') {
    const { results } = await DB.prepare(`SELECT p.id,p.name,p.score,(p.id LIKE 'bot_%') bot,COALESCE(b.ready_words,0) words FROM players p LEFT JOIN brains b ON b.player_id=p.id WHERE p.ns=? ORDER BY p.score DESC, p.created ASC LIMIT 30`).bind(ns).all();
    return json({ leaders: results });
  }
  if (p === '/api/feed') {
    const { results } = await DB.prepare(`SELECT a.word,a.lvl,a.ok,a.conf,a.points,a.k,a.guess,a.created,d.name drawer,o.name owner,(a.player_id LIKE 'bot_%') dbot,(a.owner_id LIKE 'bot_%') obot FROM attempts a JOIN players d ON d.id=a.player_id JOIN players o ON o.id=a.owner_id WHERE a.ns=? ORDER BY a.created DESC LIMIT 40`).bind(ns).all();
    const stats = await DB.prepare(`SELECT lvl, COUNT(*) n, SUM(ok) ok, AVG(CASE WHEN ok=1 THEN conf END) conf FROM attempts WHERE ns=? GROUP BY lvl`).bind(ns).all();
    const open = await DB.prepare(`SELECT COUNT(*) n FROM challenges WHERE ns=? AND status='open'`).bind(ns).first();
    return json({ feed: results, stats: stats.results, open: open.n });
  }
  if (p === '/api/bots/tick' && m === 'POST') {
    if (!ns.endsWith('test')) return err('רק בסביבת הבדיקה', 403);
    return json({ log: await botTick(env, ns, ctx, origin) });
  }
  if (p === '/api/reset' && m === 'POST') {
    if (!ns.endsWith('test')) return err('אפשר לאפס רק את סביבת הבדיקה', 403);
    await DB.batch([
      DB.prepare(`DELETE FROM brains WHERE ns=?`).bind(ns), DB.prepare(`DELETE FROM challenges WHERE ns=?`).bind(ns),
      DB.prepare(`DELETE FROM attempts WHERE ns=?`).bind(ns), DB.prepare(`DELETE FROM notes WHERE ns=?`).bind(ns),
      DB.prepare(`DELETE FROM push_subs WHERE ns=?`).bind(ns), DB.prepare(`DELETE FROM players WHERE ns=?`).bind(ns)]);
    try { await ensureRecs(DB); await DB.prepare(`DELETE FROM recs WHERE ns=?`).bind(ns).run(); } catch (e) { }
    return json({ ok: true });
  }

  /* ---- מכאן נדרשת התחברות ---- */
  const me = await auth(req, env, ns);
  if (!me) return err('צריך להתחבר מחדש', 401);

  if (p === '/api/me') {
    const rank = await DB.prepare('SELECT COUNT(*)+1 r FROM players WHERE ns=? AND score>?').bind(ns, me.score).first();
    const { results: notes } = await DB.prepare('SELECT id,kind,text,points,created FROM notes WHERE player_id=? AND seen=0 ORDER BY created ASC LIMIT 10').bind(me.id).all();
    return json({ me: { id: me.id, name: me.name, code: me.code, score: me.score, rank: rank.r }, notes });
  }
  if (p === '/api/notes') {
    await ensureRecs(DB);
    const { results } = await DB.prepare('SELECT n.id,n.kind,n.text,n.points,n.seen,n.created,r.attempt_id aid FROM notes n LEFT JOIN recs r ON r.note_id=n.id WHERE n.player_id=? ORDER BY n.created DESC LIMIT 30').bind(me.id).all();
    return json({ notes: results });
  }
  // ניהול: רק מנהל המשחק – מחיקת כל השחקנים שאינם רובוטים
  if (p === '/api/admin/purge') {
    if (me.name !== ADMIN_NAME || me.id.startsWith('bot_')) return err('אין הרשאה', 403);
    const sel = `SELECT id FROM players WHERE ns=? AND id NOT LIKE 'bot_%' AND id<>?`;
    const { results } = await DB.prepare(`SELECT name FROM players WHERE ns=? AND id NOT LIKE 'bot_%' AND id<>? ORDER BY name`).bind(ns, me.id).all();
    if (m !== 'POST') return json({ names: results.map(r => r.name) });
    await ensureRecs(DB);
    await DB.batch([
      DB.prepare(`DELETE FROM notes WHERE player_id IN (${sel})`).bind(ns, me.id),
      DB.prepare(`DELETE FROM push_subs WHERE player_id IN (${sel})`).bind(ns, me.id),
      DB.prepare(`DELETE FROM brains WHERE player_id IN (${sel})`).bind(ns, me.id),
      DB.prepare(`DELETE FROM attempts WHERE player_id IN (${sel}) OR owner_id IN (${sel})`).bind(ns, me.id, ns, me.id),
      DB.prepare(`DELETE FROM challenges WHERE owner_id IN (${sel})`).bind(ns, me.id),
      DB.prepare(`DELETE FROM recs WHERE ns=? AND attempt_id NOT IN (SELECT id FROM attempts)`).bind(ns),
      DB.prepare(`DELETE FROM players WHERE ns=? AND id NOT LIKE 'bot_%' AND id<>?`).bind(ns, me.id)]);
    return json({ ok: true, deleted: results.length });
  }
  // רשימת הניסיונות על אתגר שלי
  if (p === '/api/recs') {
    const cid = url.searchParams.get('c') || '';
    const { results } = await DB.prepare(`SELECT a.id,a.ok,a.points,a.created,d.name drawer,(a.player_id LIKE 'bot_%') bot FROM attempts a JOIN players d ON d.id=a.player_id WHERE a.challenge_id=? AND a.owner_id=? ORDER BY a.created DESC LIMIT 50`).bind(cid, me.id).all();
    return json({ attempts: results });
  }
  // ניסיון אחד + הקלטת הציור
  const mRec = p.match(/^\/api\/rec\/([\w-]+)$/);
  if (mRec) {
    await ensureRecs(DB);
    const a = await DB.prepare(`SELECT a.id,a.word,a.lvl,a.ok,a.conf,a.guess,a.points,a.d,a.created,a.player_id,a.owner_id,d.name drawer,(a.player_id LIKE 'bot_%') bot,r.rec FROM attempts a JOIN players d ON d.id=a.player_id LEFT JOIN recs r ON r.attempt_id=a.id WHERE a.id=?`).bind(mRec[1]).first();
    if (!a || (a.owner_id !== me.id && a.player_id !== me.id)) return err('לא נמצא', 404);
    const { player_id, owner_id, ...rest } = a;
    const ow = await DB.prepare('SELECT name FROM players WHERE id=?').bind(owner_id).first();
    return json({ attempt: { ...rest, mine: player_id === me.id, owner: ow ? ow.name : '' } });
  }
  // הניסיונות שלי באתגר מסוים (כדי ללמוד מהכישלונות)
  if (p === '/api/mytries') {
    const { results } = await DB.prepare(`SELECT id,ok,conf,guess,points,d,created FROM attempts WHERE challenge_id=? AND player_id=? ORDER BY created ASC LIMIT 30`).bind(url.searchParams.get('c') || '', me.id).all();
    return json({ attempts: results });
  }
  if (p === '/api/notes/seen' && m === 'POST') {
    await DB.prepare('UPDATE notes SET seen=1 WHERE player_id=?').bind(me.id).run();
    return json({ ok: true });
  }
  if (p === '/api/push/sub' && m === 'POST') {
    const b = await body(req);
    if (!b.endpoint) return err('חסר מנוי');
    await DB.prepare('INSERT OR REPLACE INTO push_subs(endpoint,ns,player_id,created) VALUES(?,?,?,?)').bind(b.endpoint, ns, me.id, now()).run();
    return json({ ok: true });
  }

  if (p === '/api/brain' && m === 'GET') {
    const r = await DB.prepare('SELECT cats,net,ex,rounds,updated FROM brains WHERE player_id=?').bind(me.id).first();
    return json({ brain: r || null });
  }
  if (p === '/api/brain' && m === 'PUT') {
    const b = await body(req);
    if (!Array.isArray(b.cats)) return err('מוח לא תקין');
    const cats = b.cats.filter(c => lvlOf(c.w)).map(c => ({ w: c.w, n: Math.min(MAX_EX, Math.max(0, c.n | 0)) }));
    if (cats.length !== b.cats.length) return err('יש במוח מילה שלא מתאימה למשחק');
    if (b.net) { const o = JSON.parse(b.net); if (!o.W2 || o.W2.length !== cats.length) return err('הרשת לא תואמת למילים'); }
    const ready = cats.filter(c => c.n >= MIN_EX).length;
    await DB.prepare(`INSERT INTO brains(player_id,ns,cats,ready_words,net,ex,rounds,updated) VALUES(?,?,?,?,?,?,?,?)
      ON CONFLICT(player_id) DO UPDATE SET cats=excluded.cats,ready_words=excluded.ready_words,net=excluded.net,ex=excluded.ex,rounds=excluded.rounds,updated=excluded.updated`)
      .bind(me.id, ns, JSON.stringify(cats), ready, b.net || null, b.ex || null, b.rounds | 0, now()).run();
    // אתגר פתוח על מילה שנמחקה או נמחקה מהמוח – נסגר
    const { results: open } = await DB.prepare(`SELECT id,word FROM challenges WHERE owner_id=? AND status='open'`).bind(me.id).all();
    const okW = new Set(cats.filter(c => c.n >= MIN_EX).map(c => c.w));
    for (const c of open) if (!okW.has(c.word) || ready < MIN_WORDS)
      await DB.prepare(`UPDATE challenges SET status='closed',closed_at=? WHERE id=?`).bind(now(), c.id).run();
    return json({ ok: true, ready });
  }

  if (p === '/api/square') {
    const { results } = await DB.prepare(`SELECT c.id,c.word,c.lvl,c.tries,c.created,c.curse,o.name owner,(c.owner_id LIKE 'bot_%') bot,COALESCE(b.ready_words,0) k,b.cats,b.ex,(SELECT COUNT(*) FROM attempts a2 WHERE a2.challenge_id=c.id AND a2.player_id=?) my
      FROM challenges c JOIN players o ON o.id=c.owner_id LEFT JOIN brains b ON b.player_id=c.owner_id
      WHERE c.ns=? AND c.status='open' AND c.owner_id<>? AND NOT EXISTS (SELECT 1 FROM attempts a WHERE a.challenge_id=c.id AND a.player_id=? AND a.ok=1)
      ORDER BY c.created DESC LIMIT 60`).bind(me.id, ns, me.id, me.id).all();
    const exCache = new Map();
    const out = await Promise.all(results.map(async c => {
      const cats = c.cats ? JSON.parse(c.cats) : [], k = cats.findIndex(x => x.w === c.word), n = (cats[k] || { n: 1 }).n;
      const { cats: _c, ex, ...rest } = c;
      const min = maxScore(c.lvl, c.k, n, c.curse);
      let Lm = DEF_L;
      if (MODE === 'ink' && ex) { if (!exCache.has(ex)) exCache.set(ex, await unzipEx(ex)); Lm = medL(exCache.get(ex).filter(a => a[0] === k)); }
      return { ...rest, n, mult: riskMult(n), cmult: curseMult(c.curse), min, max: MODE === 'ink' ? min * INK_MAX : min, Lmed: Lm, inkMax: INK_MAX };
    }));
    return json({ challenges: out });
  }
  if (p === '/api/mine') {
    const { results } = await DB.prepare(`SELECT c.id,c.word,c.lvl,c.status,c.tries,c.created,c.curse,s.name solver,(SELECT COUNT(*) FROM attempts a WHERE a.challenge_id=c.id AND a.ok=1) solves FROM challenges c LEFT JOIN players s ON s.id=c.solved_by
      WHERE c.owner_id=? AND c.status<>'closed' ORDER BY c.status='open' DESC, c.created DESC LIMIT 60`).bind(me.id).all();
    return json({ challenges: results });
  }
  if (p === '/api/challenge' && m === 'POST') {
    const word = String((await body(req)).word || '');
    const lvl = lvlOf(word); if (!lvl) return err('המילה לא מתאימה למשחק');
    const br = await DB.prepare('SELECT cats,ready_words,net FROM brains WHERE player_id=?').bind(me.id).first();
    if (!br || !br.net) return err('קודם צריך לאמן את המוח');
    const rw = JSON.parse(br.cats).filter(c => c.n >= MIN_EX).length;
    if (rw !== br.ready_words) { br.ready_words = rw; await DB.prepare('UPDATE brains SET ready_words=? WHERE player_id=?').bind(rw, me.id).run(); }
    if (br.ready_words < MIN_WORDS) return err(`צריך לפחות ${MIN_WORDS} מילים עם ${MIN_EX} ציורים כל אחת`);
    const c = JSON.parse(br.cats).find(c => c.w === word);
    if (!c || c.n < MIN_EX) return err(`למילה צריך לפחות ${MIN_EX} ציורים`);
    if (await DB.prepare(`SELECT 1 FROM challenges WHERE owner_id=? AND word=? AND status='open'`).bind(me.id, word).first()) return err('המילה הזאת כבר באתגר');
    if (await DB.prepare(`SELECT 1 FROM attempts WHERE owner_id=? AND word=? AND ok=1 LIMIT 1`).bind(me.id, word).first()) return err('המילה הזאת כבר נפתרה – אי אפשר לפרסם אותה שוב');
    const id = uid();
    const curse = MODE === 'ink' ? null : CURSES[Math.floor(Math.random() * CURSES.length)];
    await DB.prepare('INSERT INTO challenges(id,ns,owner_id,word,lvl,status,tries,created,curse) VALUES(?,?,?,?,?,\'open\',0,?,?)').bind(id, ns, me.id, word, lvl, now(), curse).run();
    return json({ ok: true, id, curse });
  }
  const mDel = p.match(/^\/api\/challenge\/([\w-]+)$/);
  if (mDel && m === 'DELETE') {
    await DB.prepare(`UPDATE challenges SET status='closed',closed_at=? WHERE id=? AND owner_id=? AND status='open'`).bind(now(), mDel[1], me.id).run();
    return json({ ok: true });
  }

  if (p === '/api/attempt' && m === 'POST') {
    const b = await body(req);
    const c = await DB.prepare(`SELECT c.*,o.name owner FROM challenges c JOIN players o ON o.id=c.owner_id WHERE c.id=? AND c.ns=?`).bind(b.id, ns).first();
    if (!c) return err('האתגר לא נמצא', 404);
    const ds = typeof b.d === 'string' && /^[0-9a-f]{784}$/.test(b.d) ? b.d : null;
    const rec = typeof b.rec === 'string' && b.rec.length < 24000 && /^[A-Za-z0-9+/=]*$/.test(b.rec) ? b.rec : null;
    const r = await runAttempt(env, ns, me, c, ds, +b.L || 0, ctx, origin, rec);
    return r.error ? err(r.error) : json(r);
  }
  return err('לא נמצא', 404);
}


/* ---------- ניסיון אתגר (משותף לשחקנים ולרובוטים) ---------- */
const isBot = id => typeof id === 'string' && id.startsWith('bot_');
async function runAttempt(env, ns, me, c, ds, Lin, ctx, origin, rec = null) {
  const DB = env.DB;
  if (c.owner_id === me.id) return { error: 'אי אפשר לאתגר את המוח של עצמך' };
  if (c.status !== 'open') return { error: 'האתגר נסגר' };
  await ensureRecs(DB);
  if (await DB.prepare('SELECT 1 FROM attempts WHERE challenge_id=? AND player_id=? AND ok=1').bind(c.id, me.id).first()) return { error: 'כבר פתרת את האתגר הזה' };
  const br = await DB.prepare('SELECT cats,ready_words,net,ex FROM brains WHERE player_id=?').bind(c.owner_id).first();
  const cats = br ? JSON.parse(br.cats) : [];
  const k = cats.findIndex(x => x.w === c.word);
  if (!br || !br.net || k < 0) return { error: 'המוח של בעל האתגר השתנה – האתגר נסגר' };
  let ok = false, conf = 0, guess = '', sim = 0, prob = 0;
  const exEvery = await unzipEx(br.ex), exAll = exEvery.filter(a => a[0] === k), exK = exAll.map(a => strToD(a[1]));
  const Lmed = medL(exAll);
  const L = Math.max(0, Lin || 0), inkR = L ? L / Lmed : 1, im = MODE === 'ink' ? inkMult(inkR) : 1;
  const nEx = Math.max(1, exK.length || cats[k].n);
  if (ds) {
    const d = strToD(ds), p2 = forward(decodeNet(br.net), d);
    // זיהוי משולב: הרשת + הציור הכי דומה ששמר בעל המוח
    let P = p2, sv = null;
    if (exK.length) {
      const topP = [...p2].map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 6).map(x => x[1]);
      sv = wordSims(d, exEvery.map(a => ({ c: a[0], d: strToD(a[1]) })), p2.length, [k, ...topP]); P = mixP(p2, sv);
    }
    let g = 0; for (let i = 1; i < P.length; i++) if (P[i] > P[g]) g = i;
    sim = sv ? sv[k] : 1; prob = P[k];
    ok = g === k && sim >= SIM_OK; conf = prob * simFactor(sim); guess = g === k && !ok ? '' : cats[g].w;
  }
  const K = cats.filter(x => x.n >= MIN_EX).length, pts = scoreFor(c.lvl, K, conf, ok, nEx, c.curse, im);
  // כישלון מוריד נקודות רק למי שמצייר; בעל המוח לא מפסיד
  const ownerPts = ok ? pts : 0;
  // האתגר נשאר פתוח גם אחרי הצלחה (נעלם רק אצל מי שפתר). solved_by = הפותר האחרון
  if (ok) await DB.prepare('UPDATE challenges SET tries=tries+1,solved_by=? WHERE id=?').bind(me.id, c.id).run();
  else await DB.prepare('UPDATE challenges SET tries=tries+1 WHERE id=?').bind(c.id).run();
  // אתגר של רובוט נסגר אחרי 3 פותרים, כדי שיתחלפו אתגרים
  if (ok && isBot(c.owner_id)) { const sv = await DB.prepare('SELECT COUNT(*) n FROM attempts WHERE challenge_id=? AND ok=1').bind(c.id).first(); if (sv.n >= 2) await DB.prepare(`UPDATE challenges SET status='closed',closed_at=? WHERE id=?`).bind(now(), c.id).run(); }
  const aid = uid();
  await DB.batch([
    DB.prepare('INSERT INTO attempts(id,ns,challenge_id,player_id,owner_id,word,lvl,ok,conf,guess,points,k,d,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(aid, ns, c.id, me.id, c.owner_id, c.word, c.lvl, ok ? 1 : 0, conf, guess, pts, K, ds, now()),
    DB.prepare('UPDATE players SET score=MAX(0,score+?) WHERE id=?').bind(pts, me.id),
    DB.prepare('UPDATE players SET score=MAX(0,score+?) WHERE id=?').bind(ownerPts, c.owner_id)]);
  const pc = Math.round(conf * 100);
  const gain = v => v > 0 ? `קיבלת ${v} נקודות` : v < 0 ? `איבדת ${-v} נקודות` : 'לא הפסדת נקודות';
  const who = isBot(me.id) ? `🤖 ${me.name}` : me.name;
  let nid = null;
  if (!isBot(c.owner_id)) nid = await note(env, ns, c.owner_id, ok ? 'win' : 'lose', ok
    ? `${who} צייר "${c.word}" – המוח שלך זיהה ב־${pc}%. ${gain(ownerPts)}`
    : guess ? `${who} צייר "${c.word}" – המוח שלך חשב שזה "${guess}". ${gain(ownerPts)}` : `${who} צייר "${c.word}" – לא דומה מספיק לציורים שלך. ${gain(ownerPts)}`, ownerPts, ctx, origin);
  if (!isBot(c.owner_id) && (rec || ds)) { try { await ensureRecs(DB); await DB.prepare('INSERT INTO recs(attempt_id,ns,note_id,rec,created) VALUES(?,?,?,?,?)').bind(aid, ns, nid, rec, now()).run(); } catch (e) { } }
  if (!isBot(me.id)) await note(env, ns, me.id, ok ? 'dwin' : 'dlose', ok
    ? `המוח של ${c.owner} זיהה את "${c.word}" שלך ב־${pc}%. ${gain(pts)}`
    : `המוח של ${c.owner} לא זיהה את "${c.word}" שלך. ${gain(pts)}`, pts, ctx, origin);
  return { ok, conf, guess, sim, prob, n: nEx, mult: riskMult(nEx), cmult: curseMult(c.curse), imult: im, inkR, mode: MODE, points: pts, k: K, lvl: c.lvl, word: c.word, owner: c.owner, ownerBot: isBot(c.owner_id), empty: !ds };
}

/* ---------- שחקני מחשב ---------- */
const ADMIN_NAME = 'ארנווש';
const BOT_MAX_OPEN = 2, BOT_TOTAL_OPEN = 14;
function b64f32(b) { return b64ToF32(b); }
function f32b64(a) { const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
function botNet(n) {
  const s = atob(n.q), sc = b64f32(n.s), W1 = new Float32Array(64 * IN);
  for (let j = 0; j < 64; j++) for (let i = 0; i < IN; i++) { let v = s.charCodeAt(j * IN + i); if (v > 127) v -= 256; W1[j * IN + i] = v * sc[j]; }
  return JSON.stringify({ H: 64, W1: f32b64(W1), b1: n.b1, W2: n.W2, b2: n.b2 });
}
async function ensureBots(env, ns) {
  const DB = env.DB;
  const have = await DB.prepare(`SELECT COUNT(*) n FROM players WHERE ns=? AND id LIKE 'bot_%'`).bind(ns).first();
  if (have.n >= BOTS.bots.length) return;
  let added = 0; // מעט בכל פעם – כדי לא לחרוג מזמן החישוב
  for (let i = 0; i < BOTS.bots.length && added < 2; i++) {
    const bt = BOTS.bots[i], id = `bot_${ns}_${i}`;
    if (await DB.prepare('SELECT 1 FROM players WHERE id=?').bind(id).first()) continue;
    added++;
    let name = bt.name;
    if (await DB.prepare('SELECT 1 FROM players WHERE ns=? AND name=?').bind(ns, name).first()) name = name + ' ' + (i + 2);
    await DB.prepare('INSERT INTO players(id,ns,name,code,token,score,created) VALUES(?,?,?,?,?,0,?)').bind(id, ns, name, 'bot-' + uid(), 'bot-' + uid() + uid(), now()).run();
    await DB.prepare('INSERT OR REPLACE INTO brains(player_id,ns,cats,ready_words,net,ex,rounds,updated) VALUES(?,?,?,?,?,?,?,?)')
      .bind(id, ns, JSON.stringify(bt.cats), bt.cats.length, botNet(bt.net), bt.ex, 1, now()).run();
  }
}
function poolDrawing(word) {
  const p = BOTS.pool[word]; if (!p) return null;
  const s = atob(p.b), n = p.L.length, i = Math.floor(Math.random() * n);
  let hex = ''; for (let q = 0; q < IN; q++) { const byte = s.charCodeAt(i * 98 + (q >> 3)); hex += (byte >> (7 - (q & 7))) & 1 ? 'f' : '0'; }
  return { d: hex, L: p.L[i] };
}
// ציור ממה שלמדו מהשחקנים האמיתיים: ציורים ששמרו במוח שלהם או שזוהו באתגרים
async function learnedDrawing(env, ns, word, ownerId) {
  const DB = env.DB;
  const a = await DB.prepare(`SELECT d FROM attempts WHERE ns=? AND word=? AND ok=1 AND d IS NOT NULL AND player_id NOT LIKE 'bot_%' AND owner_id<>? ORDER BY RANDOM() LIMIT 1`).bind(ns, word, ownerId).first();
  const fromBrains = await DB.prepare(`SELECT cats,ex FROM brains WHERE ns=? AND player_id NOT LIKE 'bot_%' AND player_id<>? AND cats LIKE ? ORDER BY RANDOM() LIMIT 1`).bind(ns, ownerId, `%"w":"${word}"%`).first();
  const opts = [];
  if (a) opts.push({ d: a.d, L: 0 });
  if (fromBrains) {
    const k = JSON.parse(fromBrains.cats).findIndex(x => x.w === word);
    const ex = (await unzipEx(fromBrains.ex)).filter(e => e[0] === k);
    if (ex.length) { const e = ex[Math.floor(Math.random() * ex.length)]; opts.push({ d: e[1], L: e[2] || 0 }); }
  }
  return opts.length ? opts[Math.floor(Math.random() * opts.length)] : null;
}
async function botTick(env, ns, ctx, origin) {
  const DB = env.DB;
  await ensureBots(env, ns);
  const log = [];
  // 1. ניסיון אתגר
  const { results: open } = await DB.prepare(`SELECT c.*,o.name owner FROM challenges c JOIN players o ON o.id=c.owner_id WHERE c.ns=? AND c.status='open' ORDER BY RANDOM() LIMIT 20`).bind(ns).all();
  const humanFirst = open.sort((x, y) => (isBot(x.owner_id) ? 1 : 0) - (isBot(y.owner_id) ? 1 : 0) + (Math.random() - .5));
  for (const c of humanFirst.slice(0, 3)) {
    const { results: tried } = await DB.prepare('SELECT player_id FROM attempts WHERE challenge_id=?').bind(c.id).all();
    const triedSet = new Set(tried.map(t => t.player_id));
    const cand = BOTS.bots.map((_, i) => `bot_${ns}_${i}`).filter(id => id !== c.owner_id && !triedSet.has(id));
    if (!cand.length) continue;
    const id = cand[Math.floor(Math.random() * cand.length)];
    const me = await DB.prepare('SELECT id,name FROM players WHERE id=?').bind(id).first(); if (!me) continue;
    const dr = poolDrawing(c.word) || await learnedDrawing(env, ns, c.word, c.owner_id);
    if (!dr) { log.push(`אין ציור ל"${c.word}"`); continue; }
    const r = await runAttempt(env, ns, me, c, dr.d, dr.L, ctx, origin);
    log.push(`${me.name} → "${c.word}" של ${c.owner}: ${r.error || (r.ok ? 'זוהה' : 'לא זוהה') + ' ' + (r.points ?? '')}`);
    break;
  }
  // 2. פרסום אתגר
  const tot = await DB.prepare(`SELECT COUNT(*) n FROM challenges WHERE ns=? AND status='open' AND owner_id LIKE 'bot_%'`).bind(ns).first();
  if (tot.n < BOT_TOTAL_OPEN && Math.random() < 0.6) {
    const i = Math.floor(Math.random() * BOTS.bots.length), id = `bot_${ns}_${i}`;
    const mine = await DB.prepare(`SELECT word,status FROM challenges WHERE owner_id=? AND status<>'closed'`).bind(id).all();
    const openN = mine.results.filter(x => x.status === 'open').length, used = new Set(mine.results.map(x => x.word));
    const free = BOTS.bots[i].cats.map(x => x.w).filter(w => !used.has(w));
    const seeded = await DB.prepare('SELECT 1 FROM brains WHERE player_id=?').bind(id).first();
    if (seeded && openN < BOT_MAX_OPEN && free.length) {
      const word = free[Math.floor(Math.random() * free.length)];
      await DB.prepare('INSERT INTO challenges(id,ns,owner_id,word,lvl,status,tries,created) VALUES(?,?,?,?,?,\'open\',0,?)').bind(uid(), ns, id, word, LVL.get(word), now()).run();
      log.push(`${BOTS.bots[i].name} פרסם "${word}"`);
    }
  }
  return log;
}

/* ---------- ניתוב ---------- */
export default {
  async scheduled(event, env, ctx) {
    const origin = 'https://tzayar-hamochot.contactarnon.workers.dev';
    const base = MODE === 'ink' && !NS_PLAIN ? 'ink' : '';
    try { await botTick(env, base + 'live', ctx, origin); } catch (e) { console.log('bots', e && e.message); }
    try { const t = await env.DB.prepare(`SELECT 1 FROM players WHERE ns=? AND id NOT LIKE 'bot_%' LIMIT 1`).bind(base + 'test').first(); if (t) await botTick(env, base + 'test', ctx, origin); } catch (e) { }
  },
  async fetch(req, env, ctx) {
    const url = new URL(req.url), p = url.pathname;
    try {
      if (p.startsWith('/api/')) return await api(req, env, ctx, url);
      if (p === '/' || p === '/index.html')
        return new Response(APP.replace('/*__WORDS__*/null', JSON.stringify(WORDS)).replace('/*__FILTER__*/null', () => JSON.stringify(WFILTER)).replace(/__ORIGIN__/g, url.origin), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' } });
      if (p === '/sim') return new Response(SIM, { headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' } });
      if (p === '/sw.js') return new Response(SW, { headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-cache' } });
      if (p === '/manifest.webmanifest') return new Response(manifest(), { headers: { 'content-type': 'application/manifest+json' } });
      if (p === '/icon.svg') return new Response(ICON_SVG, { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=86400' } });
      if (p === '/icon-192.png' || p === '/icon-512.png' || p === '/apple-touch-icon.png') {
        const b = ICONS[p];
        if (b) { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new Response(u, { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' } }); }
        return new Response(ICON_SVG, { headers: { 'content-type': 'image/svg+xml' } });
      }
      if (p === '/robots.txt') return new Response(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /sim\nSitemap: ${url.origin}/sitemap.xml\n`, { headers: { 'content-type': 'text/plain' } });
      if (p === '/sitemap.xml') return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${url.origin}/</loc><changefreq>weekly</changefreq></url></urlset>`, { headers: { 'content-type': 'application/xml' } });
      return new Response('לא נמצא', { status: 404 });
    } catch (e) {
      return err('שגיאת שרת: ' + (e && e.message || e), 500);
    }
  }
};
