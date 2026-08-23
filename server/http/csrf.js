/**
 * CSRF protection: signed double-submit tokens.
 *
 * A random secret is stored in an HttpOnly cookie. Each rendered form embeds
 * a token derived from that secret with an HMAC, so a token cannot be forged
 * without the server key, and a cross-site page cannot read the cookie to
 * mint one. Verification is constant-time.
 *
 * The Origin header is checked as well, which catches the case of a browser
 * that sends cookies on a cross-site form post.
 */
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';

const KEY = process.env.NETGUARD_CSRF_KEY || randomBytes(32).toString('hex');
export const CSRF_COOKIE = 'ng_csrf';
export const CSRF_FIELD = '_csrf';

export function newSecret() {
  return randomBytes(24).toString('base64url');
}

export function tokenFor(secret) {
  return createHmac('sha256', KEY).update(String(secret)).digest('base64url');
}

export function verifyToken(secret, token) {
  if (!secret || !token) return false;
  const expected = Buffer.from(tokenFor(secret));
  const given = Buffer.from(String(token));
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}

/**
 * Confirms the request originated from this site. Returns null when fine, or
 * a reason string when it should be rejected.
 */
export function checkOrigin(req, host) {
  const origin = req.headers.origin;
  // Same-origin form posts from older agents may omit Origin; fall back to Referer.
  const source = origin && origin !== 'null' ? origin : req.headers.referer;
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
