-- צייר המוחות – מבנה מסד הנתונים (D1)
-- ns = 'live' לשחקנים אמיתיים, 'test' לסביבת הסימולציה

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  ns TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  token TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS players_name ON players(ns, name);
CREATE UNIQUE INDEX IF NOT EXISTS players_token ON players(token);
CREATE INDEX IF NOT EXISTS players_score ON players(ns, score DESC);

-- המוח: הרשת (לשיפוט בשרת) + הציורים (לסנכרון בין מכשירים)
CREATE TABLE IF NOT EXISTS brains (
  player_id TEXT PRIMARY KEY,
  ns TEXT NOT NULL,
  cats TEXT NOT NULL,        -- JSON: [{"w":"חתול","n":7}, ...] בסדר יציאות הרשת
  ready_words INTEGER NOT NULL DEFAULT 0,  -- מילים עם 5 ציורים ומעלה
  net TEXT,                  -- JSON משקלים (base64)
  ex TEXT,                   -- ציורים דחוסים (base64)
  rounds INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  ns TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  word TEXT NOT NULL,
  lvl INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',   -- open | solved | closed
  solved_by TEXT,
  tries INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL,
  closed_at INTEGER,
  curse TEXT               -- line | three | mirror | white | time
);
CREATE INDEX IF NOT EXISTS ch_open ON challenges(ns, status, created DESC);
CREATE INDEX IF NOT EXISTS ch_owner ON challenges(owner_id, status);

CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  ns TEXT NOT NULL,
  challenge_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  word TEXT NOT NULL,
  lvl INTEGER NOT NULL,
  ok INTEGER NOT NULL,
  conf REAL NOT NULL,
  guess TEXT,
  points INTEGER NOT NULL,
  k INTEGER NOT NULL,
  d TEXT,
  created INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS att_once ON attempts(challenge_id, player_id);
CREATE INDEX IF NOT EXISTS att_feed ON attempts(ns, created DESC);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  ns TEXT NOT NULL,
  player_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  text TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  seen INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS notes_p ON notes(player_id, seen, created DESC);

CREATE TABLE IF NOT EXISTS push_subs (
  endpoint TEXT PRIMARY KEY,
  ns TEXT NOT NULL,
  player_id TEXT NOT NULL,
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS push_p ON push_subs(player_id);
