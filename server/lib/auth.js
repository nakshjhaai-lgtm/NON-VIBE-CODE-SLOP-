/**
 * Authentication for the Web Crypto edge runtime.
 *
 * Passwords use salted PBKDF2-HMAC-SHA-256 and are never stored or logged in
 * plaintext. Login is throttled to five failures per fifteen minutes for each
 * email/address pair. Authorisation always comes from the opaque session
 * cookie and server-side ownership checks.
 */
import { users, sessions, loginAttempts } from '../db/index.js';
import { passwordStrength } from './validate.js';
import { base64ToBytes, bytesToBase64Url, randomBytes, timingSafeEqual } from './crypto.js';

export const SESSION_COOKIE = 'ng_session';
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_FAILURES = 5;

// Chosen to stay inside Netlify Edge's CPU budget while remaining deliberately
// expensive alongside the strict password policy and persistent lockout.
export const PBKDF2_ITERATIONS = 180_000;
const HASH_NAME = 'PBKDF2';
const HASH_DIGEST = 'SHA-256';
const HASH_PREFIX = 'pbkdf2-sha256';
const encoder = new TextEncoder();

async function derive(plain, salt, iterations = PBKDF2_ITERATIONS) {
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(String(plain)),
    HASH_NAME,
    false,
    ['deriveBits'],
  );
  return new Uint8Array(
    await globalThis.crypto.subtle.deriveBits(
      { name: HASH_NAME, hash: HASH_DIGEST, salt, iterations },
      key,
      256,
    ),
  );
}

export async function hashPassword(plain) {
  const salt = randomBytes(16);
  const digest = await derive(plain, salt);
  return `${HASH_PREFIX}$${PBKDF2_ITERATIONS}$${bytesToBase64Url(salt)}$${bytesToBase64Url(digest)}`;
}

export async function verifyPassword(storedHash, plain) {
  try {
    const [prefix, rawIterations, rawSalt, expected] = String(storedHash).split('$');
    const iterations = Number(rawIterations);
    if (prefix !== HASH_PREFIX || !Number.isSafeInteger(iterations) || iterations < 10_000 || iterations > 1_000_000) return false;
    const digest = bytesToBase64Url(await derive(plain, base64ToBytes(rawSalt), iterations));
    return timingSafeEqual(digest, expected);
  } catch {
    return false;
  }
}

/** A dummy verify keeps missing-account and wrong-password work equivalent. */
const DUMMY_HASH = 'pbkdf2-sha256$180000$AQIDBAUGBwgJCgsMDQ4PEA$hP-eTJA7n0avYe5-ZqbcHgmP9gbwqSiRF44F-G2FBxc';

export function throttleKey(email, ip) {
  return `${String(email || '').toLowerCase()}|${ip}`;
}

export async function attemptLogin({ email, password, ip, userAgent }) {
  const key = throttleKey(email, ip);
  const failures = loginAttempts.recentFailures(key, LOGIN_WINDOW_MS);

  if (failures >= LOGIN_MAX_FAILURES) {
    const oldest = loginAttempts.oldestFailure(key, LOGIN_WINDOW_MS);
    const unlockAt = (oldest ?? Date.now()) + LOGIN_WINDOW_MS;
    const minutes = Math.max(1, Math.ceil((unlockAt - Date.now()) / 60000));
    return {
      ok: false,
      locked: true,
      retryAfterMinutes: minutes,
      reason: `Too many failed sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or reset your password.`,
    };
  }

  const user = users.byEmail(String(email || '').toLowerCase());
  const valid = user
    ? await verifyPassword(user.password_hash, password)
    : (await verifyPassword(DUMMY_HASH, password), false);

  if (!valid) {
    loginAttempts.record(key, false);
    const left = LOGIN_MAX_FAILURES - (failures + 1);
    return {
      ok: false,
      attemptsLeft: Math.max(0, left),
      reason:
        left > 0
          ? `Email address or password is incorrect. ${left} attempt${left === 1 ? '' : 's'} left before this address is locked for 15 minutes.`
          : 'Email address or password is incorrect. This address is now locked for 15 minutes.',
    };
  }

  loginAttempts.clear(key);
  users.touchLogin(user.id);
  const sessionId = sessions.create(user.id, userAgent, SESSION_TTL_MS);
  return { ok: true, user, sessionId };
}

export async function register({ email, password, displayName }) {
  const strength = passwordStrength(password);
  if (strength.score < 2) {
    return { ok: false, field: 'password', reason: `${strength.label}. ${strength.hint}` };
  }
  if (users.byEmail(email)) {
    // Do not confirm that the address exists.
    return { ok: false, duplicate: true };
  }
  const passwordHash = await hashPassword(password);
  const user = users.create({ email, passwordHash, displayName });
  return { ok: true, user };
}

export function currentUser(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  return {
    id: session.user_id,
    email: session.email,
    displayName: session.display_name,
    role: session.role,
    sessionId: session.id,
  };
}

export function logout(sessionId) {
  sessions.destroy(sessionId);
}
