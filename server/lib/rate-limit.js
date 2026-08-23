/**
 * In-process rate limiting.
 *
 * A fixed-window counter per key. Deliberately memory-only: this app runs as
 * a single process, and persisting general request counts would mean writing
 * a row for every hit. Login throttling is separate and *is* persisted (see
 * db.loginAttempts) because it must survive a restart.
 */

const buckets = new Map();

/**
 * @param {string} key
 * @param {{ limit: number, windowMs: number }} opts
 * @returns {{ ok: boolean, remaining: number, retryAfter: number }}
 */
export function hit(key, { limit, windowMs }) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }

  bucket.count++;
  if (bucket.count > limit) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true, remaining: limit - bucket.count, retryAfter: 0 };
}

export function peek(key) {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= Date.now()) return null;
  return bucket;
}

export function reset(key) {
  buckets.delete(key);
}

export function resetAll() {
  buckets.clear();
}

/** Drops expired buckets so the map cannot grow without bound. */
export function sweep() {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export const LIMITS = {
  // Generous: normal browsing with assets should never approach this.
  page: { limit: 240, windowMs: 60_000 },
  // Form posts are much cheaper to abuse, so they are tighter.
  form: { limit: 10, windowMs: 60_000 },
  // The account lockout is the 5-per-15-minutes control (see lib/auth.js); it
  // is per account and address, and survives a restart. This is a second,
  // coarser ceiling on raw POSTs from one address, set higher so the lockout
  // fires first and the person is told why rather than getting a bare 429.
  login: { limit: 12, windowMs: 15 * 60_000 },
  search: { limit: 60, windowMs: 60_000 },
  api: { limit: 60, windowMs: 60_000 },
};
