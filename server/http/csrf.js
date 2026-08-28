/**
 * CSRF protection: double-submit tokens plus a same-origin check.
 *
 * A cryptographically random secret is stored in an HttpOnly, SameSite cookie
 * and copied into every rendered form. A cross-site page can submit a form but
 * cannot read that cookie, so it cannot supply the matching field. Comparing
 * the two values directly removes the old runtime-local signing key and makes
 * tokens reliable across Netlify edge isolates without weakening the
 * double-submit property.
 */
import { randomToken, timingSafeEqual } from '../lib/crypto.js';

export const CSRF_COOKIE = 'ng_csrf';
export const CSRF_FIELD = '_csrf';

export function newSecret() {
  return randomToken(24);
}

export function tokenFor(secret) {
  return String(secret || '');
}

export function verifyToken(secret, token) {
  if (!secret || !token) return false;
  return timingSafeEqual(secret, token);
}

function requestHeader(req, name) {
  if (typeof req?.headers?.get === 'function') return req.headers.get(name);
  return req?.headers?.[name] || req?.headers?.[name.toLowerCase()];
}

/**
 * Confirms the request originated from this site. Returns null when fine, or
 * a reason string when it should be rejected.
 */
export function checkOrigin(req, host) {
  const origin = requestHeader(req, 'origin');
  // Same-origin form posts from older agents may omit Origin; fall back to Referer.
  const source = origin && origin !== 'null' ? origin : requestHeader(req, 'referer');
  if (!source) return 'missing Origin and Referer headers';
  let parsed;
  try {
    parsed = new URL(source);
  } catch {
    return 'unparseable Origin';
  }
  if (parsed.host !== host) return `Origin ${parsed.host} does not match ${host}`;
  return null;
}
