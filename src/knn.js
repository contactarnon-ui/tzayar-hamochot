/* ---- זיהוי משולב: הרשת + "הציור הכי דומה ששמרת" (משותף לאפליקציה ולשרת, מוזרק בבנייה) ---- */
const KNN_ANG = [-45, -30, -15, 15, 30, 45];
// הכנה: שחור־לבן, עובי קו אחיד, טשטוש, ונרמול (וקטור יחידה ממורכז) – כך שמכפלה = מתאם צורה
function knnPrep(d, S) {
  const n = S * S, f = 28 / S, b = new Uint8Array(n), t = new Uint8Array(n), o = new Float32Array(n), h = new Float32Array(n);
  for (let y = 0; y < 28; y++) for (let x = 0; x < 28; x++) if (d[y * 28 + x] >= 6) b[((y / f) | 0) * S + ((x / f) | 0)] = 1;
  if (S === 28) {
    for (let y = 0, i = 0; y < S; y++) for (let x = 0; x < S; x++, i++) t[i] = b[i] | (x > 0 ? b[i - 1] : 0) | (x < S - 1 ? b[i + 1] : 0);
    for (let y = 0, i = 0; y < S; y++) for (let x = 0; x < S; x++, i++) o[i] = t[i] | (y > 0 ? t[i - S] : 0) | (y < S - 1 ? t[i + S] : 0);
  } else for (let i = 0; i < n; i++) o[i] = b[i];
  for (let pass = 0; pass < (S === 28 ? 2 : 1); pass++) {
    for (let y = 0, i = 0; y < S; y++) for (let x = 0; x < S; x++, i++) { let s = o[i], c = 1; if (x > 0) { s += o[i - 1]; c++; } if (x < S - 1) { s += o[i + 1]; c++; } h[i] = s / c; }
    for (let y = 0, i = 0; y < S; y++) for (let x = 0; x < S; x++, i++) { let s = h[i], c = 1; if (y > 0) { s += h[i - S]; c++; } if (y < S - 1) { s += h[i + S]; c++; } o[i] = s / c; }
  }
  let m = 0; for (let i = 0; i < n; i++) m += o[i]; m /= n;
  let q = 0; for (let i = 0; i < n; i++) { o[i] -= m; q += o[i] * o[i]; }
  q = 1 / (Math.sqrt(q) + 1e-9); for (let i = 0; i < n; i++) o[i] *= q;
  return o;
}
function knnDot(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
// דמיון לכל מילה = הדמיון לציור הכי דומה שלה. exs: [{c, d}] ; must: מילים שחייבים לחשב במדויק
function wordSims(d, exs, K, must) {
  const s1 = new Float32Array(K), q14 = knnPrep(d, 14);
  for (const e of exs) { const u = e.u14 || (e.u14 = knnPrep(e.d, 14)); const v = knnDot(q14, u); if (v > s1[e.c]) s1[e.c] = v; }
  const cand = new Set(must || []);
  [...s1].map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 6).forEach(x => cand.add(x[1]));
  const qs = [knnPrep(d, 28)].concat(KNN_ANG.map(a => knnPrep(tf8(d, a), 28)));
  const s = new Float32Array(K);
  for (const e of exs) {
    if (!cand.has(e.c)) continue;
    const u = e.u28 || (e.u28 = knnPrep(e.d, 28));
    for (const q of qs) { const v = knnDot(q, u); if (v > s[e.c]) s[e.c] = v; }
  }
  return s;
}
// שילוב: חצי מהרשת, חצי מהציור הכי דומה
function mixP(p, s) {
  const K = p.length, q = new Float32Array(K); let mx = 0, sum = 0;
  for (let i = 0; i < K; i++) if (s[i] > mx) mx = s[i];
  for (let i = 0; i < K; i++) { q[i] = s[i] > 0 ? Math.exp((s[i] - mx) / 0.04) : 0; sum += q[i]; }
  const P = new Float32Array(K);
  for (let i = 0; i < K; i++) P[i] = 0.5 * p[i] + 0.5 * (sum ? q[i] / sum : 1 / K);
  return P;
}
