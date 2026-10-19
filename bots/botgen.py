# רובוטים עם אופי: כל רובוט מצייר בסגנון משלו, מתוך ספריית ציורים פשוטים (shapes.py)
import json, base64, zlib, random, math, sys, numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import rotate
sys.path.insert(0, '/home/claude/qd')
from shapes import S
random.seed(5); np.random.seed(5)
N = 28; IN = 784; H = 64; LR = 0.015

# ---------- כלים לקווים ----------
def length(st): return sum(math.dist(st[i], st[i + 1]) for i in range(len(st) - 1))
def resample(st, step):
    if len(st) < 2: return list(st)
    out = [st[0]]; acc = 0
    for i in range(len(st) - 1):
        a, b = st[i], st[i + 1]; d = math.dist(a, b)
        while acc + d >= step and d > 0:
            t = (step - acc) / d; a = (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t); out.append(a); d = math.dist(a, b); acc = 0
        acc += d
    if math.dist(out[-1], st[-1]) > 0.5: out.append(st[-1])
    return out
def smooth_noise(n, amp, corr=6):
    v = np.cumsum(np.random.randn(n + corr)) ; v = np.convolve(v, np.ones(corr) / corr, 'valid')[:n]
    v = v - np.linspace(v[0], v[-1], n) if n > 1 else v * 0
    return v / (np.abs(v).max() + 1e-9) * amp * random.uniform(.5, 1)
def jitter(sts, amp):
    out = []
    for st in sts:
        st = resample(st, 3); n = len(st); dx = smooth_noise(n, amp); dy = smooth_noise(n, amp)
        ox, oy = random.uniform(-amp, amp) * .6, random.uniform(-amp, amp) * .6
        out.append([(x + dx[i] + ox, y + dy[i] + oy) for i, (x, y) in enumerate(st)])
    return out
def affine(sts, rot=0, sx=1, sy=1, cx=50, cy=50):
    c, s = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    return [[(cx + ((x - cx) * sx) * c - ((y - cy) * sy) * s, cy + ((x - cx) * sx) * s + ((y - cy) * sy) * c) for x, y in st] for st in sts]
def rdp(st, eps):
    if len(st) < 3: return st
    a, b = st[0], st[-1]; dmax, idx = 0, 0
    for i in range(1, len(st) - 1):
        p = st[i]; num = abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])); den = math.dist(a, b) or 1e-9
        d = num / den if math.dist(a, b) > 0 else math.dist(a, p)
        if d > dmax: dmax, idx = d, i
    if dmax > eps: return rdp(st[:idx + 1], eps)[:-1] + rdp(st[idx:], eps)
    return [a, b]
def chaikin(st, k=3):
    for _ in range(k):
        if len(st) < 3: return st
        closed = math.dist(st[0], st[-1]) < 1
        out = [] if closed else [st[0]]
        for i in range(len(st) - 1):
            a, b = st[i], st[i + 1]; out += [(a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25), (a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75)]
        if closed: out.append(out[0])
        else: out.append(st[-1])
        st = out
    return st
def wavy(st, a=1.5, per=18):
    st = resample(st, 1.5); out = []; s = 0
    for i, p in enumerate(st):
        q = st[min(i + 1, len(st) - 1)]; r = st[max(i - 1, 0)]; tx, ty = q[0] - r[0], q[1] - r[1]; n = math.hypot(tx, ty) or 1
        if i: s += math.dist(st[i - 1], p)
        off = a * math.sin(2 * math.pi * s / per); out.append((p[0] - ty / n * off, p[1] + tx / n * off))
    return out
def dashes(st, on=9, off=5):
    st = resample(st, 1.5); out = []; cur = []; s = 0
    for i, p in enumerate(st):
        if i: s += math.dist(st[i - 1], p)
        if (s % (on + off)) < on: cur.append(p)
        elif cur:
            if len(cur) > 1: out.append(cur)
            cur = []
    if len(cur) > 1: out.append(cur)
    return out
def overshoot(st, d=6):
    if len(st) < 2 or math.dist(st[0], st[-1]) < 1: return st
    a, b = st[0], st[1]; n = math.dist(a, b) or 1; a2 = (a[0] + (a[0] - b[0]) / n * d, a[1] + (a[1] - b[1]) / n * d)
    y, z = st[-1], st[-2]; m = math.dist(y, z) or 1; y2 = (y[0] + (y[0] - z[0]) / m * d, y[1] + (y[1] - z[1]) / m * d)
    return [a2] + st + [y2]

# ---------- אופי לכל רובוט ----------
def st_pixel(sts): return [rdp(resample(s, 2), 5) for s in jitter(sts, 1.5)]
def st_neat(sts): return jitter(sts, .8)
def st_wavy(sts): return [wavy(s) for s in jitter(sts, 1)]
def st_sketch(sts):
    out = []
    for s in sts: out += jitter([s], 1.8) + jitter([s], 1.8)
    return out
def st_scribble(sts): return [overshoot(s, 6) for s in jitter(sts, 3.5)]
def st_minimal(sts):
    tot = sum(length(s) for s in sts); keep = []; acc = 0
    for s in sorted(sts, key=length, reverse=True):
        if acc < tot * .72 or not keep: keep.append(s); acc += length(s)
    return jitter(keep, 1)
def st_dashed(sts): return [d for s in jitter(sts, 1) for d in dashes(s)]
def st_round(sts): return [chaikin(resample(s, 7), 3) for s in jitter(sts, 1.2)]
def st_tilt(sts): return [chaikin(s, 2) for s in jitter(affine(sts, rot=random.choice([-1, 1]) * random.uniform(12, 25)), 1.2)]
def st_wide(sts): return jitter(affine(sts, sx=1.3, sy=.85), 1)
def st_tall(sts): return jitter(affine(sts, sx=.8, sy=1.25), 1)
def st_bold(sts): return jitter(sts, 1.4)
STYLES = [('פיקסל', st_pixel, 18, 'קווים ישרים וחדים'), ('נוירון', st_neat, 18, 'מדויק ונקי'), ('סינפסה', st_wavy, 16, 'קווים גליים'),
          ('שרבוטון', st_sketch, 14, 'סקיצה בקו כפול'), ('קשקשון', st_scribble, 18, 'מקשקש ובורח מהקווים'), ('ביט', st_minimal, 18, 'מינימליסט – רק העיקר'),
          ('דיודה', st_dashed, 18, 'קו מקווקו'), ("צ'יפ", st_round, 18, 'הכל מעוגל'), ('מעגלי', st_tilt, 18, 'מצייר עקום'),
          ('רובי', st_wide, 18, 'רחב ונמוך'), ('בייט', st_tall, 18, 'צר וגבוה'), ('לוגי', st_bold, 26, 'קו עבה')]

# ---------- ציור כמו באפליקציה ----------
def human(sts):
    return affine(sts, rot=random.uniform(-7, 7), sx=random.uniform(.92, 1.08), sy=random.uniform(.92, 1.08))
def to_canvas(sts):
    return [[(30 + x * 2.2, 30 + y * 2.2) for x, y in s] for s in sts]
def raster(cs, pen):
    img = Image.new('L', (280, 280), 255); d = ImageDraw.Draw(img); r = pen / 2
    for s in cs:
        pts = resample(s, 2) if len(s) > 1 else s
        for x, y in pts: d.ellipse((x - r, y - r, x + r, y + r), fill=0)
    arr = np.array(img); yy, xx = np.nonzero(arr < 128)
    x0, x1, y0, y1 = xx.min(), xx.max(), yy.min(), yy.max(); w, h = x1 - x0 + 1, y1 - y0 + 1; sc = 20 / max(w, h)
    crop = img.crop((x0, y0, x1 + 1, y1 + 1)).resize((max(1, round(w * sc)), max(1, round(h * sc))), Image.LANCZOS)
    out = Image.new('L', (28, 28), 255); out.paste(crop, ((28 - crop.width) // 2, (28 - crop.height) // 2))
    dd = np.clip(np.round((255 - np.array(out, float)) / 255 * 15), 0, 15).astype('uint8').reshape(-1)
    L = round(sum(length(s) for s in cs) / max(w + 18, h + 18), 2)
    return dd, L
def rec_of(cs):
    b = bytearray(); first = True
    for s in cs:
        pts = resample(s, 7)
        for i, (x, y) in enumerate(pts):
            k = 0 if i == 0 else 2
            dt = (0 if first else 30) if i == 0 else 2
            first = False
            b += bytes([k, max(0, min(255, round(x / 280 * 255))), max(0, min(255, round(y / 280 * 255))), dt])
    return base64.b64encode(bytes(b)).decode()
def make(word, style, pen):
    cs = to_canvas(style(human(S[word])))
    cs = [s for s in cs if len(s) > 1]
    d, L = raster(cs, pen)
    return d, L, cs

# ---------- אימון (כמו באפליקציה: הזזה + הטיה עד 45°) ----------
ANG = (-45, -30, -15, 0, 15, 30, 45)
def shift(a, dx, dy):
    o = np.zeros((N, N), a.dtype); s = a.reshape(N, N)
    ys = slice(max(0, dy), N + min(0, dy)); xs = slice(max(0, dx), N + min(0, dx)); ys2 = slice(max(0, -dy), N + min(0, -dy)); xs2 = slice(max(0, -dx), N + min(0, -dx))
    o[ys, xs] = s[ys2, xs2]; return o.reshape(-1)
def train(exs, K, steps):
    W1 = np.random.randn(H, IN).astype(np.float32) * np.sqrt(2 / IN); b1 = np.zeros(H, np.float32)
    W2 = (np.random.randn(K, H) * np.sqrt(1 / H)).astype(np.float32); b2 = np.zeros(K, np.float32)
    rot = {}; byc = [[e for e in exs if e[0] == k] for k in range(K)]
    for it in range(steps):
        k = random.randrange(K); j = random.randrange(len(byc[k])); c, d = byc[k][j]; a = random.choice(ANG); key = (k, j, a)
        if key not in rot: rot[key] = np.clip(np.round(rotate(d.reshape(N, N).astype(float), a, reshape=False, order=1)), 0, 15).reshape(-1) if a else d
        x = shift(rot[key], random.randint(-2, 2), random.randint(-2, 2)).astype(np.float32) / 15; nz = np.nonzero(x)[0]
        h = np.maximum(W1[:, nz] @ x[nz] + b1, 0); z = W2 @ h + b2; z -= z.max(); p = np.exp(z); p /= p.sum(); g = p.copy(); g[c] -= 1
        dh = W2.T @ g; W2 -= LR * np.outer(g, h); b2 -= LR * g; dh *= (h > 0); W1[:, nz] -= LR * np.outer(dh, x[nz]); b1 -= LR * dh
    return W1, b1, W2, b2
def acc(net, exs):
    W1, b1, W2, b2 = net; return sum(int(np.argmax(W2 @ np.maximum(W1 @ (d.astype(np.float32) / 15) + b1, 0) + b2) == c) for c, d in exs) / len(exs)
b64 = lambda a: base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()
def pack2(ds):
    q = np.concatenate([np.round(d / 5).astype(np.uint8) for d in ds]); return base64.b64encode(np.packbits(np.unpackbits(q[:, None], axis=1)[:, 6:].reshape(-1)).tobytes()).decode()

words = list(S); use = {w: 0 for w in words}
bots = []; sheet = []
for bi, (name, style, pen, desc) in enumerate(STYLES):
    pick = sorted(words, key=lambda w: (use[w], random.random()))[:30]
    for w in pick: use[w] += 1
    brain_w, extra_w = pick[:20], pick[20:]
    exs = []; cats = []
    for k, w in enumerate(brain_w):
        for _ in range(5):
            d, L, cs = make(w, style, pen); exs.append((k, d, L))
        cats.append({'w': w, 'n': 5})
    W1, b1, W2, b2 = train([(c, d) for c, d, L in exs], len(brain_w), 110000)
    a = acc((W1, b1, W2, b2), [(c, d) for c, d, L in exs])
    draw = {}
    for w in brain_w + extra_w:
        ds = []; Ls = []; rs = []
        for _ in range(3):
            d, L, cs = make(w, style, pen); ds.append(d); Ls.append(L); rs.append(rec_of(cs))
        draw[w] = {'b2': pack2(ds), 'L': Ls, 'r': rs}
        if len(sheet) < 400 and w in brain_w[:4]: sheet.append((bi, d))
    sc = np.abs(W1).max(axis=1) / 127 + 1e-9; q = np.round(W1 / sc[:, None]).astype(np.int8)
    exj = json.dumps([[c, ''.join('0123456789abcdef'[int(v)] for v in d), L] for c, d, L in exs])
    co = zlib.compressobj(9, zlib.DEFLATED, -15); z = co.compress(exj.encode()) + co.flush()
    bots.append({'name': name, 'style': desc, 'cats': cats, 'net': {'q': b64(q), 's': b64(sc.astype(np.float32)), 'b1': b64(b1), 'W2': [b64(r) for r in W2], 'b2': [float(v) for v in b2]}, 'ex': 'Z' + base64.b64encode(z).decode(), 'draw': draw})
    print(name, desc, 'train acc', round(a, 2), flush=True)
json.dump({'ver': 4, 'bots': bots, 'pool': {}}, open('botdata.json', 'w'), ensure_ascii=False)
import os; print('size', os.path.getsize('botdata.json'))
# דף דוגמה
im = Image.new('L', (12 * 4 * 70, 70), 255)
seen = {}
for bi, d in sheet:
    i = seen.get(bi, 0)
    if i >= 4: continue
    seen[bi] = i + 1
    im.paste(Image.fromarray((255 - d.reshape(28, 28).astype(int) * 17).astype('uint8')).resize((70, 70), Image.BICUBIC), ((bi * 4 + i) * 70, 0))
im.save('/tmp/claude-0/-home-claude/8ae2fec7-ce89-5bd6-aeed-903fad144f06/scratchpad/bots_sheet.png')
