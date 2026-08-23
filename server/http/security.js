/**
 * Security headers.
 *
 * A per-response nonce is generated so the Content-Security-Policy can stay
 * strict: no 'unsafe-inline', no 'unsafe-eval', no wildcard hosts. The site
 * loads no third-party scripts, fonts, styles or images at all, so 'self' is
 * genuinely sufficient rather than aspirational.
 */
import { randomBytes } from 'node:crypto';

export const isProduction = () => process.env.NODE_ENV === 'production';

/**
 * Framing policy.
 *
 * Production denies framing outright. A deployment can opt into specific
 * ancestors via NETGUARD_FRAME_ANCESTORS (space-separated origins), which is
 * how this app is run inside the hosted preview pane during development.
 * The default is always 'none'.
 */
function frameAncestors() {
  const configured = (process.env.NETGUARD_FRAME_ANCESTORS || '').trim();
  if (!configured || isProduction()) return "'none'";
  return configured;
}

export function makeNonce() {
  return randomBytes(16).toString('base64');
}

/**
 * @param {string} nonce  per-response script nonce
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
    // Legacy directive, still honoured by some agents.
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
    // No feature on this site needs any of these.
    'Permissions-Policy': [
      'accelerometer=()', 'autoplay=()', 'camera=()', 'display-capture=()',
      'encrypted-media=()', 'fullscreen=(self)', 'geolocation=()', 'gyroscope=()',
      'magnetometer=()', 'microphone=()', 'midi=()', 'payment=()',
      'picture-in-picture=()', 'publickey-credentials-get=()', 'usb=()',
    ].join(', '),
  };

  // X-Frame-Options has no wildcard form, so it is only meaningful when we
  // are denying outright. When ancestors are allowed, frame-ancestors above
  // is the directive that applies.
  if (ancestors === "'none'") headers['X-Frame-Options'] = 'DENY';

  if (https) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
  }

  return headers;
}

/**
 * True when the original request reached the edge over HTTPS. Trusts
 * X-Forwarded-Proto only when the app is explicitly told it sits behind a
 * proxy, so the header cannot be spoofed in a direct-exposure deployment.
 */
export function requestIsHttps(req) {
  if (req.socket?.encrypted) return true;
  if (process.env.NETGUARD_TRUST_PROXY === '1') {
    const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
    return proto === 'https';
  }
  return false;
}

/**
 * Client address, honouring the proxy header only when trusted. Used for
 * rate-limit keys and the salted analytics hash, never stored raw.
 */
export function clientIp(req) {
  if (process.env.NETGUARD_TRUST_PROXY === '1') {
    const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (fwd) return fwd;
  }
  return req.socket?.remoteAddress || '0.0.0.0';
}
