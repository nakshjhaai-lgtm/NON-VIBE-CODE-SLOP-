/** Web-Crypto helpers shared by the edge-safe security and storage modules. */
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes) {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let out = '';
  for (let i = 0; i < input.length; i += 3) {
    const a = input[i];
    const b = i + 1 < input.length ? input[i + 1] : 0;
    const c = i + 2 < input.length ? input[i + 2] : 0;
    out += BASE64[a >> 2];
    out += BASE64[((a & 3) << 4) | (b >> 4)];
    out += i + 1 < input.length ? BASE64[((b & 15) << 2) | (c >> 6)] : '=';
    out += i + 2 < input.length ? BASE64[c & 63] : '=';
  }
  return out;
}

export function base64ToBytes(value) {
  const clean = String(value).replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean) || clean.length % 4 === 1) {
    throw new Error('Invalid base64 data');
  }
  const padded = clean + '='.repeat((4 - (clean.length % 4)) % 4);
  const out = [];
  for (let i = 0; i < padded.length; i += 4) {
    const a = BASE64.indexOf(padded[i]);
    const b = BASE64.indexOf(padded[i + 1]);
    const c = padded[i + 2] === '=' ? 0 : BASE64.indexOf(padded[i + 2]);
    const d = padded[i + 3] === '=' ? 0 : BASE64.indexOf(padded[i + 3]);
    if (a < 0 || b < 0 || c < 0 || d < 0) throw new Error('Invalid base64 data');
    out.push((a << 2) | (b >> 4));
    if (padded[i + 2] !== '=') out.push(((b & 15) << 4) | (c >> 2));
    if (padded[i + 3] !== '=') out.push(((c & 3) << 6) | d);
  }
  return new Uint8Array(out);
}

export function bytesToBase64Url(bytes) {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomBytes(length) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

export function randomToken(length = 32) {
  return bytesToBase64Url(randomBytes(length));
}

/** Constant-work comparison for short secrets represented as strings. */
export function timingSafeEqual(left, right) {
  const a = new TextEncoder().encode(String(left));
  const b = new TextEncoder().encode(String(right));
  const length = Math.max(a.length, b.length);
  let difference = a.length ^ b.length;
  for (let i = 0; i < length; i++) difference |= (a[i] || 0) ^ (b[i] || 0);
  return difference === 0;
}

export async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value));
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
