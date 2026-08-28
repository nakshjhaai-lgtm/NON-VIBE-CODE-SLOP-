/**
 * Security headers for the standards-based edge runtime.
 *
 * A per-response nonce keeps the Content-Security-Policy strict: no
 * `unsafe-inline`, no `unsafe-eval`, and no third-party asset origins.
 */
import { env } from '../lib/env.js';
import { bytesToBase64, randomBytes } from '../lib/crypto.js';

export const isProduction = () => env('CONTEXT', 'production') === 'production';

/** Production denies framing; local previews may opt into named ancestors. */
function frameAncestors() {
  const configured = env('NETGUARD_FRAME_ANCESTORS').trim();
  if (!configured || isProduction()) return "'none'";
  return configured;
}

export function makeNonce() {
  return bytesToBase64(randomBytes(16));
}

/**
 * @param {string} nonce per-response script nonce
 * @param {{ https?: boolean }} opts
 */
export function securityHeaders(nonce, { https = false } = {}) {
  const ancestors = frameAncestors();
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "form-action 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "manifest-src 'self'",
    `frame-ancestors ${ancestors}`,
    "block-all-mixed-content",
  ];
  if (https) csp.push('upgrade-insecure-requests');

  const headers = {
    'Content-Security-Policy': csp.join('; '),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'Permissions-Policy': [
      'accelerometer=()', 'autoplay=()', 'camera=()', 'display-capture=()',
      'encrypted-media=()', 'fullscreen=(self)', 'geolocation=()', 'gyroscope=()',
      'magnetometer=()', 'microphone=()', 'midi=()', 'payment=()',
      'picture-in-picture=()', 'publickey-credentials-get=()', 'usb=()',
    ].join(', '),
  };

  if (ancestors === "'none'") headers['X-Frame-Options'] = 'DENY';
  if (https) headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
  return headers;
}

/** Works with both Fetch Requests and the small compatibility request shape. */
export function requestIsHttps(req) {
  try {
    if (req?.url && new URL(req.url).protocol === 'https:') return true;
  } catch {
    // A path-only compatibility URL falls through to the socket hint.
  }
  return Boolean(req?.socket?.encrypted);
}

/** The edge adapter supplies Netlify's trusted client address here. */
export function clientIp(req) {
  return req?.clientIp || req?.socket?.remoteAddress || '0.0.0.0';
}
