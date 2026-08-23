/**
 * SQLite storage.
 *
 * Uses node:sqlite from the standard library, so the running site has exactly
 * one runtime dependency. Every statement in this file is prepared with bound
 * parameters; string-built SQL is never used anywhere in the codebase.
 *
 * Access rules that matter for security live here rather than in routes:
 * queries that read or mutate a user's own data always take the owner id as a
 * bound parameter and filter on it in SQL, so a tampered id in a request
 * cannot reach another account's rows.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, randomBytes, createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../..', import.meta.url));

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  user_agent  TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- One filtering profile per user; the dashboard reads and writes only these.
CREATE TABLE IF NOT EXISTS profiles (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,
  lists        TEXT NOT NULL DEFAULT 'gambling',
  safe_search  INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id);

CREATE TABLE IF NOT EXISTS allow_entries (
  id         TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain     TEXT NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (profile_id, domain)
);
CREATE INDEX IF NOT EXISTS idx_allow_user ON allow_entries(user_id);

CREATE TABLE IF NOT EXISTS enquiries (
  id          TEXT PRIMARY KEY,
  reference   TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  org         TEXT NOT NULL DEFAULT '',
  topic       TEXT NOT NULL,
  message     TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  handled_at  TEXT
);

-- Submitted reviews are held unpublished until a human verifies the account.
-- Nothing here is displayed as a testimonial until published = 1, which is
-- why the reviews page currently shows an empty state.
CREATE TABLE IF NOT EXISTS reviews (
  id          TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT '',
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body        TEXT NOT NULL,
  email       TEXT NOT NULL,
  published   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  key        TEXT NOT NULL,
  at         INTEGER NOT NULL,
  ok         INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attempts_key_at ON login_attempts(key, at);

-- First-party, cookie-less page counts. No identifiers are stored: the
-- visitor hash is salted per-day and truncated, and is only used to separate
-- unique-ish views from repeat views within one day.
CREATE TABLE IF NOT EXISTS page_views (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  day          TEXT NOT NULL,
  path         TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  referrer_host TEXT NOT NULL DEFAULT '',
  utm_source   TEXT NOT NULL DEFAULT '',
  utm_medium   TEXT NOT NULL DEFAULT '',
  utm_campaign TEXT NOT NULL DEFAULT '',
  at           INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_views_day_path ON page_views(day, path);

CREATE TABLE IF NOT EXISTS coverage_checks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  domain     TEXT NOT NULL,
  listed     INTEGER NOT NULL,
  at         INTEGER NOT NULL
);
`;

let db;

export function getDb() {
  if (db) return db;
  const file = process.env.NETGUARD_DB || path.join(root, 'data', 'netguard.db');
  if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true });
  db = new DatabaseSync(file);
  db.exec(SCHEMA);
  return db;
}

/** Test helper: swap in an isolated in-memory database. */
export function useDatabase(instance) {
  db = instance;
  if (db) db.exec(SCHEMA);
  return db;
}

export function resetDb() {
  db = undefined;
}

export const now = () => Date.now();
export const newId = () => randomUUID();

/** URL-safe random token, used for session ids and CSRF secrets. */
export function token(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

// ---------------------------------------------------------------- users

export const users = {
  create({ email, passwordHash, displayName, role = 'member' }) {
    const id = newId();
    getDb()
      .prepare('INSERT INTO users (id, email, password_hash, display_name, role) VALUES (?, ?, ?, ?, ?)')
      .run(id, email, passwordHash, displayName, role);
    return this.byId(id);
  },
  byId(id) {
    return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
  },
  byEmail(email) {
    return getDb().prepare('SELECT * FROM users WHERE email = ?').get(email);
  },
  touchLogin(id) {
    getDb().prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(id);
  },
  count() {
    return getDb().prepare('SELECT COUNT(*) AS n FROM users').get().n;
  },
  /**
   * Deletes the account. Sessions, profiles and allowlist entries go with it
   * through ON DELETE CASCADE, so there is no orphaned row and no archived
   * copy kept "just in case".
   */
  remove(id) {
    return getDb().prepare('DELETE FROM users WHERE id = ?').run(id).changes > 0;
  },
};

// ------------------------------------------------------------- sessions

export const sessions = {
  create(userId, userAgent, ttlMs) {
    const id = token(32);
    const created = now();
    getDb()
      .prepare('INSERT INTO sessions (id, user_id, created_at, expires_at, user_agent) VALUES (?, ?, ?, ?, ?)')
      .run(id, userId, created, created + ttlMs, String(userAgent || '').slice(0, 200));
    return id;
  },
  get(id) {
    if (!id) return undefined;
    return getDb()
      .prepare('SELECT s.*, u.email, u.display_name, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ?')
      .get(id, now());
  },
  destroy(id) {
    if (!id) return;
    getDb().prepare('DELETE FROM sessions WHERE id = ?').run(id);
  },
  destroyAllFor(userId) {
    getDb().prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  },
  countFor(userId) {
    return getDb()
      .prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ? AND expires_at > ?')
      .get(userId, now()).n;
  },
  purgeExpired() {
    getDb().prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now());
  },
};

// ------------------------------------------------------------- profiles

export const profiles = {
  create(userId, label, lists = 'gambling') {
    const id = newId();
    getDb().prepare('INSERT INTO profiles (id, user_id, label, lists) VALUES (?, ?, ?, ?)').run(id, userId, label, lists);
    return this.forUser(userId).find((p) => p.id === id);
  },
  forUser(userId) {
    return getDb().prepare('SELECT * FROM profiles WHERE user_id = ? ORDER BY created_at').all(userId);
  },
  /** Ownership is enforced in SQL, not by comparing in JS after the fetch. */
  ownedBy(id, userId) {
    return getDb().prepare('SELECT * FROM profiles WHERE id = ? AND user_id = ?').get(id, userId);
  },
  /**
   * Partial update. Only the fields present in `patch` are written, and the
   * WHERE clause carries the owner, so a guessed id updates zero rows rather
   * than someone else's profile.
   */
  update(id, userId, patch = {}) {
    const existing = this.ownedBy(id, userId);
    if (!existing) return false;
    const label = patch.label === undefined ? existing.label : patch.label;
    const lists = patch.lists === undefined ? existing.lists : patch.lists;
    const safeSearch = patch.safeSearch === undefined ? existing.safe_search : patch.safeSearch ? 1 : 0;
    const result = getDb()
      .prepare('UPDATE profiles SET label = ?, lists = ?, safe_search = ? WHERE id = ? AND user_id = ?')
      .run(label, lists, safeSearch, id, userId);
    return result.changes > 0;
  },
};

export const allowEntries = {
  /**
   * Refuses to write unless the profile belongs to the user. Returns the new
   * id, or null when the profile is not theirs. The caller must not assume
   * the id it was given in the URL is one it owns.
   */
  add(profileId, userId, domain, note = '') {
    const owns = getDb().prepare('SELECT 1 FROM profiles WHERE id = ? AND user_id = ?').get(profileId, userId);
    if (!owns) return null;
    const id = newId();
    getDb()
      .prepare('INSERT INTO allow_entries (id, profile_id, user_id, domain, note) VALUES (?, ?, ?, ?, ?)')
      .run(id, profileId, userId, domain, note);
    return id;
  },
  forProfile(profileId, userId) {
    return getDb()
      .prepare('SELECT * FROM allow_entries WHERE profile_id = ? AND user_id = ? ORDER BY domain')
      .all(profileId, userId);
  },
  remove(id, userId) {
    return getDb().prepare('DELETE FROM allow_entries WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;
  },
};

// ------------------------------------------------------------ enquiries

export const enquiries = {
  create({ name, email, org, topic, message }) {
    const id = newId();
    // Human-quotable reference so the thank-you page and the reply can agree.
    const reference = `NG-${new Date().getFullYear()}-${randomBytes(3).toString('hex').toUpperCase()}`;
    getDb()
      .prepare('INSERT INTO enquiries (id, reference, name, email, org, topic, message) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, reference, name, email, org, topic, message);
    return { id, reference };
  },
  byReference(reference) {
    return getDb().prepare('SELECT * FROM enquiries WHERE reference = ?').get(reference);
  },
  count() {
    return getDb().prepare('SELECT COUNT(*) AS n FROM enquiries').get().n;
  },
};

// -------------------------------------------------------------- reviews

export const reviews = {
  create({ displayName, role, rating, body, email }) {
    const id = newId();
    getDb()
      .prepare('INSERT INTO reviews (id, display_name, role, rating, body, email) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, displayName, role, rating, body, email);
    return id;
  },
  published() {
    return getDb().prepare('SELECT display_name, role, rating, body, created_at FROM reviews WHERE published = 1 ORDER BY created_at DESC').all();
  },
  pendingCount() {
    return getDb().prepare('SELECT COUNT(*) AS n FROM reviews WHERE published = 0').get().n;
  },
  summary() {
    const row = getDb().prepare('SELECT COUNT(*) AS n, AVG(rating) AS avg FROM reviews WHERE published = 1').get();
    return { count: row.n, average: row.n ? Number(row.avg.toFixed(2)) : null };
  },
};

// ------------------------------------------------------- login throttle

export const loginAttempts = {
  record(key, ok) {
    getDb().prepare('INSERT INTO login_attempts (key, at, ok) VALUES (?, ?, ?)').run(key, now(), ok ? 1 : 0);
  },
  recentFailures(key, windowMs) {
    return getDb()
      .prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE key = ? AND ok = 0 AND at > ?')
      .get(key, now() - windowMs).n;
  },
  /** Oldest failure still inside the window, used to tell the user when to retry. */
  oldestFailure(key, windowMs) {
    const row = getDb()
      .prepare('SELECT MIN(at) AS at FROM login_attempts WHERE key = ? AND ok = 0 AND at > ?')
      .get(key, now() - windowMs);
    return row?.at ?? null;
  },
  clear(key) {
    getDb().prepare('DELETE FROM login_attempts WHERE key = ?').run(key);
  },
  purgeOlderThan(ms) {
    getDb().prepare('DELETE FROM login_attempts WHERE at < ?').run(now() - ms);
  },
};

// ------------------------------------------------------------ analytics

const ANALYTICS_SALT = process.env.NETGUARD_ANALYTICS_SALT || token(16);

/**
 * Day-salted, truncated hash. Deliberately not reversible and not stable
 * across days, so it cannot be used to follow a person over time.
 */
export function visitorHash(ip, userAgent, day) {
  return createHash('sha256').update(`${ANALYTICS_SALT}:${day}:${ip}:${userAgent}`).digest('hex').slice(0, 16);
}

export const analytics = {
  record({ day, path: p, visitorHash: vh, referrerHost = '', utm = {} }) {
    getDb()
      .prepare(
        `INSERT INTO page_views (day, path, visitor_hash, referrer_host, utm_source, utm_medium, utm_campaign, at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(day, p, vh, referrerHost, utm.source || '', utm.medium || '', utm.campaign || '', now());
  },
  topPages(days = 7, limit = 8) {
    return getDb()
      .prepare(
        `SELECT path, COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors
         FROM page_views WHERE day >= date('now', ?) GROUP BY path ORDER BY views DESC LIMIT ?`,
      )
      .all(`-${days} days`, limit);
  },
  topCampaigns(days = 30, limit = 6) {
    return getDb()
      .prepare(
        `SELECT utm_source, utm_medium, utm_campaign, COUNT(*) AS views
         FROM page_views
         WHERE day >= date('now', ?) AND utm_source <> ''
         GROUP BY utm_source, utm_medium, utm_campaign ORDER BY views DESC LIMIT ?`,
      )
      .all(`-${days} days`, limit);
  },
  totals(days = 7) {
    return getDb()
      .prepare(
        `SELECT COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors
         FROM page_views WHERE day >= date('now', ?)`,
      )
      .get(`-${days} days`);
  },
  purgeOlderThan(days = 90) {
    getDb().prepare("DELETE FROM page_views WHERE day < date('now', ?)").run(`-${days} days`);
  },
};

export const coverageChecks = {
  record(domain, listed) {
    getDb().prepare('INSERT INTO coverage_checks (domain, listed, at) VALUES (?, ?, ?)').run(domain, listed ? 1 : 0, now());
  },
  total() {
    return getDb().prepare('SELECT COUNT(*) AS n FROM coverage_checks').get().n;
  },
};
