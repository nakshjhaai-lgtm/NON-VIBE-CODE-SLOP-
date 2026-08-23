/**
 * Authentication.
 *
 * Passwords are hashed with argon2id (memory-hard) and never stored or
 * logged in plaintext. Login is throttled to 5 failures per 15 minutes per
 * email+IP pair, and the failure message is identical whether the account
 * exists or not so the form cannot be used to enumerate users.
 *
 * Authorisation is always decided on the server from the session cookie.
 * No route trusts a user id, role or ownership claim that arrived in a
 * request body, query string or hidden field.
 */
import { hash as argonHash, verify as argonVerify, Algorithm } from '@node-rs/argon2';
import { users, sessions, loginAttempts } from '../db/index.js';
import { passwordStrength } from './validate.js';

export const SESSION_COOKIE = 'ng_session';
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_FAILURES = 5;

const ARGON_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456, // 19 MiB, the OWASP baseline
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plain) {
  return argonHash(plain, ARGON_OPTIONS);
}

export async function verifyPassword(storedHash, plain) {
  try {
    return await argonVerify(storedHash, plain);
  } catch {
    return false;
  }
}

/** A dummy verify, so a missing account costs the same time as a wrong password. */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$Qy1n8p1wV3o0Q0d3RnJkZ0hqS2xNbk9wUXJTdFV2V3g';

export function throttleKey(email, ip) {
  return `${String(email || '').toLowerCase()}|${ip}`;
}

/**
 * @returns {{ ok: true, user: object } | { ok: false, reason: string, retryAfterMinutes?: number }}
 */
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
    // Do not confirm the address exists; the caller shows a neutral message.
    return { ok: false, duplicate: true };
  }
  const passwordHash = await hashPassword(password);
  const user = users.create({ email, passwordHash, displayName });
  return { ok: true, user };
}

/** Resolves the signed-in user from the request's session cookie. */
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
