/**
 * Cookie parsing and serialisation.
 *
 * Every cookie this app sets is HttpOnly where it holds anything sensitive,
 * SameSite=Lax so it is not sent on cross-site POSTs, and Secure whenever the
 * request arrived over HTTPS. There is no third-party or tracking cookie.
 */

export function parseCookies(header) {
  const out = Object.create(null);
  if (!header) return out;
  for (const part of String(header).split(';')) {
    const eq = part.indexOf('=');
    if (eq < 1) continue;
    const key = part.slice(0, eq).trim();
    let value = part.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

export function serializeCookie(name, value, options = {}) {
  const {
    maxAge,
    path = '/',
    httpOnly = true,
    secure = false,
    sameSite = 'Lax',
    expires,
  } = options;

  if (!/^[\w.-]+$/.test(name)) throw new Error(`unsafe cookie name: ${name}`);

  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (path) parts.push(`Path=${path}`);
  if (typeof maxAge === 'number') parts.push(`Max-Age=${Math.floor(maxAge)}`);
  if (expires) parts.push(`Expires=${expires.toUTCString()}`);
  if (httpOnly) parts.push('HttpOnly');
  if (secure) parts.push('Secure');
  if (sameSite) parts.push(`SameSite=${sameSite}`);
  return parts.join('; ');
}

export function clearCookie(name, options = {}) {
  return serializeCookie(name, '', { ...options, maxAge: 0, expires: new Date(0) });
}
