/**
 * Small transactional data store for Netlify Blobs.
 *
 * Netlify Edge Functions have no durable writable filesystem, so a local
 * database file cannot safely back accounts or forms. Application state is represented
 * as one compact JSON document in a site-scoped Blob. Each request reads with
 * strong consistency and commits with an ETag precondition; if another edge
 * isolate won the write, the request is replayed against the newer document.
 * This preserves the original relational ownership rules without a native
 * database binary, a package install, or a build step.
 */
import { randomToken, sha256Hex } from '../lib/crypto.js';

const SCHEMA_VERSION = 1;
const MAX_COMMIT_ATTEMPTS = 5;

const sqlTimestamp = (date = new Date()) => date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
const clone = (value) => (value === undefined ? undefined : structuredClone(value));

export const now = () => Date.now();
export const newId = () => globalThis.crypto.randomUUID();
export const token = (bytes = 32) => randomToken(bytes);

export function createDatabaseState() {
  return {
    version: SCHEMA_VERSION,
    meta: {
      created_at: new Date().toISOString(),
      analytics_salt: token(16),
      last_maintenance_at: 0,
    },
    users: [],
    sessions: [],
    profiles: [],
    allow_entries: [],
    enquiries: [],
    reviews: [],
    login_attempts: [],
    page_views: [],
    coverage_checks: [],
    flashes: {},
    counters: { login_attempts: 0, page_views: 0, coverage_checks: 0 },
  };
}

function normaliseState(value) {
  if (value === null || value === undefined) return { state: createDatabaseState(), migrated: false };
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The NetGuard data blob is not a JSON object.');
  if (Number(value.version || 0) > SCHEMA_VERSION) throw new Error('The NetGuard data blob was written by a newer application version.');

  const defaults = createDatabaseState();
  const state = clone(value);
  let migrated = state.version !== SCHEMA_VERSION;
  state.version = SCHEMA_VERSION;

  for (const name of [
    'users', 'sessions', 'profiles', 'allow_entries', 'enquiries', 'reviews',
    'login_attempts', 'page_views', 'coverage_checks',
  ]) {
    if (!Array.isArray(state[name])) {
      state[name] = defaults[name];
      migrated = true;
    }
  }
  if (!state.meta || typeof state.meta !== 'object' || Array.isArray(state.meta)) {
    state.meta = defaults.meta;
    migrated = true;
  }
  for (const [key, fallback] of Object.entries(defaults.meta)) {
    if (state.meta[key] === undefined) {
      state.meta[key] = fallback;
      migrated = true;
    }
  }
  if (!state.flashes || typeof state.flashes !== 'object' || Array.isArray(state.flashes)) {
    state.flashes = {};
    migrated = true;
  }
  if (!state.counters || typeof state.counters !== 'object' || Array.isArray(state.counters)) {
    state.counters = defaults.counters;
    migrated = true;
  }
  for (const [key, fallback] of Object.entries(defaults.counters)) {
    if (!Number.isSafeInteger(state.counters[key]) || state.counters[key] < 0) {
      state.counters[key] = fallback;
      migrated = true;
    }
  }
  return { state, migrated };
}

let standalone = createDatabaseState();
let active = null;
let transactionTail = Promise.resolve();

function current() {
  return active?.state || standalone;
}

function changed() {
  if (active) active.dirty = true;
}

/** Replaces the standalone in-memory state used by tests and local tooling. */
export function useDatabase(state = createDatabaseState()) {
  const normalised = normaliseState(state).state;
  standalone = normalised;
  return standalone;
}

export function resetDb() {
  return useDatabase(createDatabaseState());
}

/** A lightweight health probe used by the status page. */
export function getDb() {
  const state = current();
  if (!state || state.version !== SCHEMA_VERSION) throw new Error('database state unavailable');
  return state;
}

export class DatabaseConflictError extends Error {
  constructor() {
    super('The data changed while this request was being saved. Please retry.');
    this.name = 'DatabaseConflictError';
  }
}

/**
 * Runs an operation against a consistent state snapshot.
 *
 * Storage adapters expose `load()` and `commit(data, etag)`. A commit result
 * of `{ modified: false }` means another isolate changed the ETag first, so
 * the side-effect-free HTTP operation is replayed with fresh state.
 */
export async function runInDatabase(storage, operation) {
  let release;
  const previous = transactionTail;
  transactionTail = new Promise((resolve) => { release = resolve; });
  await previous;

  try {
    for (let attempt = 0; attempt < MAX_COMMIT_ATTEMPTS; attempt++) {
      const loaded = await storage.load();
      const { state, migrated } = normaliseState(loaded?.data);
      active = { state, dirty: migrated };

      try {
        maintainState();
        const result = await operation(attempt);
        if (!active.dirty) return result;

        const committed = await storage.commit(active.state, loaded?.etag || null);
        if (committed?.modified) {
          standalone = clone(active.state);
          storage.adopt?.(standalone, committed.etag);
          return result;
        }
      } finally {
        active = null;
      }
    }
    throw new DatabaseConflictError();
  } finally {
    active = null;
    release();
  }
}

/** In-memory implementation with the same optimistic concurrency contract. */
export function createMemoryStorage(initial = createDatabaseState()) {
  let data = normaliseState(initial).state;
  let revision = 1;
  standalone = data;

  return {
    load() {
      return { data: clone(data), etag: `"memory-${revision}"` };
    },
    commit(next, etag) {
      if (etag !== `"memory-${revision}"`) return { modified: false };
      data = clone(next);
      revision++;
      standalone = data;
      return { modified: true, etag: `"memory-${revision}"` };
    },
    adopt(next) {
      data = clone(next);
      standalone = data;
    },
    reset(next = createDatabaseState()) {
      data = normaliseState(next).state;
      revision++;
      standalone = data;
    },
    state() {
      return clone(data);
    },
  };
}

/** Purges bounded-lifetime data at most once per hour. */
export function maintainState(force = false) {
  const state = current();
  const at = now();
  if (!force && at - Number(state.meta.last_maintenance_at || 0) < 60 * 60 * 1000) return;

  state.sessions = state.sessions.filter((row) => row.expires_at > at);
  const activeSessions = new Set(state.sessions.map((row) => row.id));
  for (const sessionId of Object.keys(state.flashes)) {
    if (!activeSessions.has(sessionId)) delete state.flashes[sessionId];
  }
  state.login_attempts = state.login_attempts.filter((row) => row.at > at - 24 * 60 * 60 * 1000);
  const oldestDay = new Date(at - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  state.page_views = state.page_views.filter((row) => row.day >= oldestDay);
  state.meta.last_maintenance_at = at;
  // Updating the maintenance timestamp is itself a state change.
  changed();
}

// ---------------------------------------------------------------- users

export const users = {
  create({ email, passwordHash, displayName, role = 'member' }) {
    const state = current();
    const normalEmail = String(email).toLowerCase();
    if (state.users.some((row) => row.email === normalEmail)) throw new Error('email already exists');
    const row = {
      id: newId(),
      email: normalEmail,
      password_hash: passwordHash,
      display_name: displayName,
      role,
      created_at: sqlTimestamp(),
      last_login_at: null,
    };
    state.users.push(row);
    changed();
    return clone(row);
  },
  byId(id) {
    return clone(current().users.find((row) => row.id === id));
  },
  byEmail(email) {
    const normalEmail = String(email || '').toLowerCase();
    return clone(current().users.find((row) => row.email === normalEmail));
  },
  touchLogin(id) {
    const row = current().users.find((entry) => entry.id === id);
    if (!row) return;
    row.last_login_at = sqlTimestamp();
    changed();
  },
  count() {
    return current().users.length;
  },
  remove(id) {
    const state = current();
    const before = state.users.length;
    state.users = state.users.filter((row) => row.id !== id);
    if (state.users.length === before) return false;
    const profileIds = new Set(state.profiles.filter((row) => row.user_id === id).map((row) => row.id));
    state.sessions = state.sessions.filter((row) => row.user_id !== id);
    state.profiles = state.profiles.filter((row) => row.user_id !== id);
    state.allow_entries = state.allow_entries.filter((row) => row.user_id !== id && !profileIds.has(row.profile_id));
    changed();
    return true;
  },
};

// ------------------------------------------------------------- sessions

export const sessions = {
  create(userId, userAgent, ttlMs) {
    const id = token(32);
    const created = now();
    current().sessions.push({
      id,
      user_id: userId,
      created_at: created,
      expires_at: created + ttlMs,
      user_agent: String(userAgent || '').slice(0, 200),
    });
    changed();
    return id;
  },
  get(id) {
    if (!id) return undefined;
    const state = current();
    const session = state.sessions.find((row) => row.id === id);
    if (!session) return undefined;
    if (session.expires_at <= now()) {
      state.sessions = state.sessions.filter((row) => row.id !== id);
      changed();
      return undefined;
    }
    const user = state.users.find((row) => row.id === session.user_id);
    if (!user) return undefined;
    return clone({ ...session, email: user.email, display_name: user.display_name, role: user.role });
  },
  destroy(id) {
    if (!id) return;
    const state = current();
    const before = state.sessions.length;
    state.sessions = state.sessions.filter((row) => row.id !== id);
    if (state.sessions.length !== before) changed();
  },
  destroyAllFor(userId) {
    const state = current();
    const before = state.sessions.length;
    state.sessions = state.sessions.filter((row) => row.user_id !== userId);
    if (state.sessions.length !== before) changed();
  },
  countFor(userId) {
    const at = now();
    return current().sessions.filter((row) => row.user_id === userId && row.expires_at > at).length;
  },
  purgeExpired() {
    const state = current();
    const before = state.sessions.length;
    state.sessions = state.sessions.filter((row) => row.expires_at > now());
    if (state.sessions.length !== before) changed();
  },
};

// ------------------------------------------------------------- profiles

export const profiles = {
  create(userId, label, lists = 'gambling') {
    const row = {
      id: newId(),
      user_id: userId,
      label,
      lists,
      safe_search: 0,
      created_at: sqlTimestamp(),
    };
    current().profiles.push(row);
    changed();
    return clone(row);
  },
  forUser(userId) {
    return current().profiles
      .filter((row) => row.user_id === userId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(clone);
  },
  ownedBy(id, userId) {
    return clone(current().profiles.find((row) => row.id === id && row.user_id === userId));
  },
  update(id, userId, patch = {}) {
    const row = current().profiles.find((entry) => entry.id === id && entry.user_id === userId);
    if (!row) return false;
    if (patch.label !== undefined) row.label = patch.label;
    if (patch.lists !== undefined) row.lists = patch.lists;
    if (patch.safeSearch !== undefined) row.safe_search = patch.safeSearch ? 1 : 0;
    changed();
    return true;
  },
};

export const allowEntries = {
  add(profileId, userId, domain, note = '') {
    const state = current();
    if (!state.profiles.some((row) => row.id === profileId && row.user_id === userId)) return null;
    if (state.allow_entries.some((row) => row.profile_id === profileId && row.domain === domain)) {
      throw new Error('domain is already allowlisted for this profile');
    }
    const row = {
      id: newId(),
      profile_id: profileId,
      user_id: userId,
      domain,
      note,
      created_at: sqlTimestamp(),
    };
    state.allow_entries.push(row);
    changed();
    return row.id;
  },
  forProfile(profileId, userId) {
    return current().allow_entries
      .filter((row) => row.profile_id === profileId && row.user_id === userId)
      .sort((a, b) => a.domain.localeCompare(b.domain))
      .map(clone);
  },
  remove(id, userId) {
    const state = current();
    const before = state.allow_entries.length;
    state.allow_entries = state.allow_entries.filter((row) => !(row.id === id && row.user_id === userId));
    if (state.allow_entries.length === before) return false;
    changed();
    return true;
  },
};

// ------------------------------------------------------------ enquiries

export const enquiries = {
  create({ name, email, org, topic, message }) {
    const state = current();
    let reference;
    do {
      const bytes = new Uint8Array(3);
      globalThis.crypto.getRandomValues(bytes);
      reference = `NG-${new Date().getFullYear()}-${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
    } while (state.enquiries.some((row) => row.reference === reference));

    const row = {
      id: newId(), reference, name, email, org: org || '', topic, message,
      created_at: sqlTimestamp(), handled_at: null,
    };
    state.enquiries.push(row);
    changed();
    return { id: row.id, reference };
  },
  byReference(reference) {
    return clone(current().enquiries.find((row) => row.reference === reference));
  },
  count() {
    return current().enquiries.length;
  },
};

// -------------------------------------------------------------- reviews

export const reviews = {
  create({ displayName, role, rating, body, email }) {
    const row = {
      id: newId(), display_name: displayName, role: role || '', rating, body, email,
      published: 0, created_at: sqlTimestamp(),
    };
    current().reviews.push(row);
    changed();
    return row.id;
  },
  published() {
    return current().reviews
      .filter((row) => row.published === 1)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(({ display_name, role, rating, body, created_at }) => clone({ display_name, role, rating, body, created_at }));
  },
  pendingCount() {
    return current().reviews.filter((row) => row.published === 0).length;
  },
  summary() {
    const rows = current().reviews.filter((row) => row.published === 1);
    const average = rows.length ? rows.reduce((sum, row) => sum + row.rating, 0) / rows.length : null;
    return { count: rows.length, average: average === null ? null : Number(average.toFixed(2)) };
  },
};

// ------------------------------------------------------- login throttle

export const loginAttempts = {
  record(key, ok) {
    const state = current();
    state.counters.login_attempts++;
    state.login_attempts.push({ id: state.counters.login_attempts, key, at: now(), ok: ok ? 1 : 0 });
    changed();
  },
  recentFailures(key, windowMs) {
    const since = now() - windowMs;
    return current().login_attempts.filter((row) => row.key === key && row.ok === 0 && row.at > since).length;
  },
  oldestFailure(key, windowMs) {
    const since = now() - windowMs;
    const rows = current().login_attempts.filter((row) => row.key === key && row.ok === 0 && row.at > since);
    return rows.length ? Math.min(...rows.map((row) => row.at)) : null;
  },
  clear(key) {
    const state = current();
    const before = state.login_attempts.length;
    state.login_attempts = state.login_attempts.filter((row) => row.key !== key);
    if (state.login_attempts.length !== before) changed();
  },
  purgeOlderThan(ms) {
    const state = current();
    const before = state.login_attempts.length;
    state.login_attempts = state.login_attempts.filter((row) => row.at >= now() - ms);
    if (state.login_attempts.length !== before) changed();
  },
};

// ------------------------------------------------------------ analytics

/** Day-salted, truncated hash that cannot be followed from one day to the next. */
export async function visitorHash(ip, userAgent, day) {
  return (await sha256Hex(`${current().meta.analytics_salt}:${day}:${ip}:${userAgent}`)).slice(0, 16);
}

function sinceDay(days) {
  return new Date(now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export const analytics = {
  record({ day, path, visitorHash: hash, referrerHost = '', utm = {} }) {
    const state = current();
    state.counters.page_views++;
    state.page_views.push({
      id: state.counters.page_views,
      day,
      path,
      visitor_hash: hash,
      referrer_host: referrerHost,
      utm_source: utm.source || '',
      utm_medium: utm.medium || '',
      utm_campaign: utm.campaign || '',
      at: now(),
    });
    changed();
  },
  topPages(days = 7, limit = 8) {
    const grouped = new Map();
    for (const row of current().page_views.filter((entry) => entry.day >= sinceDay(days))) {
      const value = grouped.get(row.path) || { path: row.path, views: 0, visitors: new Set() };
      value.views++;
      value.visitors.add(row.visitor_hash);
      grouped.set(row.path, value);
    }
    return [...grouped.values()]
      .map((row) => ({ path: row.path, views: row.views, visitors: row.visitors.size }))
      .sort((a, b) => b.views - a.views || a.path.localeCompare(b.path))
      .slice(0, limit);
  },
  topCampaigns(days = 30, limit = 6) {
    const grouped = new Map();
    for (const row of current().page_views.filter((entry) => entry.day >= sinceDay(days) && entry.utm_source)) {
      const key = `${row.utm_source}\u0000${row.utm_medium}\u0000${row.utm_campaign}`;
      const value = grouped.get(key) || {
        utm_source: row.utm_source, utm_medium: row.utm_medium, utm_campaign: row.utm_campaign, views: 0,
      };
      value.views++;
      grouped.set(key, value);
    }
    return [...grouped.values()].sort((a, b) => b.views - a.views).slice(0, limit);
  },
  totals(days = 7) {
    const rows = current().page_views.filter((entry) => entry.day >= sinceDay(days));
    return { views: rows.length, visitors: new Set(rows.map((row) => row.visitor_hash)).size };
  },
  purgeOlderThan(days = 90) {
    const state = current();
    const before = state.page_views.length;
    state.page_views = state.page_views.filter((row) => row.day >= sinceDay(days));
    if (state.page_views.length !== before) changed();
  },
};

export const coverageChecks = {
  record(domain, listed) {
    const state = current();
    state.counters.coverage_checks++;
    state.coverage_checks.push({ id: state.counters.coverage_checks, domain, listed: listed ? 1 : 0, at: now() });
    changed();
  },
  total() {
    return current().coverage_checks.length;
  },
};

/** Persistent one-shot notices keyed by opaque session ID. */
export const flashMessages = {
  set(sessionId, notice) {
    if (!sessionId) return;
    current().flashes[sessionId] = clone(notice);
    changed();
  },
  take(sessionId) {
    if (!sessionId) return null;
    const notice = current().flashes[sessionId] || null;
    if (notice) {
      delete current().flashes[sessionId];
      changed();
    }
    return clone(notice);
  },
};
