/**
 * Static file serving for /public.
 *
 * Path traversal is prevented by resolving the request against the public
 * root and confirming the result is still inside it. Only an allowlist of
 * extensions is served, dotfiles are refused, and every response carries an
 * explicit content type so nothing is sniffed.
 *
 * Fingerprinted assets (?v=) get a one-year immutable cache; everything else
 * gets a short cache plus an ETag so edits show up during development.
 */
import { createReadStream } from 'node:fs';
import { stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { brotliCompressSync, gzipSync, constants as zlibConstants } from 'node:zlib';

const publicRoot = fileURLToPath(new URL('../../public', import.meta.url));

const TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
};

const IMMUTABLE = new Set(['.woff2', '.png', '.svg', '.ico', '.webp', '.avif', '.jpg', '.jpeg']);

/**
 * Text assets are worth compressing; woff2, png and ico are already
 * compressed and would only get larger.
 */
const COMPRESSIBLE = new Set(['.css', '.js', '.mjs', '.svg', '.txt', '.xml', '.json', '.webmanifest']);

const etagCache = new Map();

/**
 * Compressed copies, built on first request and kept in memory. There are a
 * handful of static assets and they do not change while the process runs, so
 * compressing each one once is cheaper and simpler than a build step.
 */
const compressedCache = new Map();

function negotiate(acceptEncoding) {
  const accepted = String(acceptEncoding || '').toLowerCase();
  if (accepted.includes('br')) return 'br';
  if (accepted.includes('gzip')) return 'gzip';
  return null;
}

async function compressedBody(file, key, encoding) {
  const cacheKey = `${key}:${encoding}`;
  const hit = compressedCache.get(cacheKey);
  if (hit) return hit;

  const source = await readFile(file);
  const body =
    encoding === 'br'
      ? brotliCompressSync(source, {
          params: {
            [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
            [zlibConstants.BROTLI_PARAM_SIZE_HINT]: source.length,
          },
        })
      : gzipSync(source, { level: 9 });

  // Only keep it if it actually helped.
  const result = body.length < source.length ? body : null;
  compressedCache.set(cacheKey, result);
  return result;
}

async function etagFor(file, stats) {
  const key = `${file}:${stats.mtimeMs}:${stats.size}`;
  const hit = etagCache.get(key);
  if (hit) return hit;
  const tag = `"${createHash('sha1').update(key).digest('base64url').slice(0, 20)}"`;
  etagCache.set(key, tag);
  return tag;
}

/**
 * @returns {boolean} true when the request was handled.
 */
export async function serveStatic(req, res, pathname, { fingerprinted = false } = {}) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;

  // Reject encoded traversal and NUL bytes before touching the filesystem.
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return false;
  }
  if (decoded.includes('\0')) return false;

  const resolved = path.resolve(publicRoot, `.${path.posix.normalize(decoded)}`);
  if (resolved !== publicRoot && !resolved.startsWith(publicRoot + path.sep)) return false;
  if (path.basename(resolved).startsWith('.')) return false;

  const ext = path.extname(resolved).toLowerCase();
  const type = TYPES[ext];
  if (!type) return false;

  let stats;
  try {
    stats = await stat(resolved);
  } catch {
    return false;
  }
  if (!stats.isFile()) return false;

  const etag = await etagFor(resolved, stats);
  const cache = fingerprinted
    ? 'public, max-age=31536000, immutable'
    : IMMUTABLE.has(ext)
      ? 'public, max-age=604800'
      : 'public, max-age=300, must-revalidate';

  const headers = {
    'Content-Type': type,
    'Content-Length': String(stats.size),
    'Cache-Control': cache,
    ETag: etag,
    'Last-Modified': stats.mtime.toUTCString(),
    'X-Content-Type-Options': 'nosniff',
  };

  // Vary is required whenever the body depends on a request header, or a
  // shared cache will serve a compressed body to a client that cannot read it.
  if (COMPRESSIBLE.has(ext)) headers.Vary = 'Accept-Encoding';

  // SVG can carry script; serving it sandboxed keeps that inert.
  if (ext === '.svg') headers['Content-Security-Policy'] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

  const inm = req.headers['if-none-match'];
  if (inm && inm.split(',').some((t) => t.trim() === etag)) {
    res.writeHead(304, { ETag: etag, 'Cache-Control': cache });
    res.end();
    return true;
  }

  if (req.method === 'HEAD') {
    res.writeHead(200, headers);
    res.end();
    return true;
  }

  const encoding = COMPRESSIBLE.has(ext) ? negotiate(req.headers['accept-encoding']) : null;
  if (encoding) {
    const body = await compressedBody(resolved, `${resolved}:${stats.mtimeMs}`, encoding);
    if (body) {
      res.writeHead(200, {
        ...headers,
        'Content-Encoding': encoding,
        'Content-Length': String(body.length),
      });
      res.end(body);
      return true;
    }
  }

  res.writeHead(200, headers);
  createReadStream(resolved).pipe(res);
  return true;
}
