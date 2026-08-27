/**
 * Compatibility test harness.
 *
 * Production is Fetch API + Netlify Edge. The test-only HTTP bridge below is
 * intentionally thin: it translates an IncomingMessage to Request and a
 * Response back to ServerResponse, while all application behaviour still
 * runs through the production handler and transactional memory adapter.
 */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { brotliCompressSync, gzipSync, constants as zlibConstants } from 'node:zlib';
import { createDatabaseState, createMemoryStorage } from '../server/db/index.js';
import { handleRequest, initialize, useStorage } from '../server/index.js';

const storage = createMemoryStorage();
useStorage(storage);
initialize();

const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
const types = {
  '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};
const compressible = /^(?:text\/|application\/(?:json|xml|javascript))/;

async function staticAsset(incoming) {
  const url = new URL(incoming.url, `http://${incoming.headers.host}`);
  let decoded;
  try { decoded = decodeURIComponent(url.pathname); } catch { return null; }
  if (decoded.includes('\0') || decoded.includes('..') || decoded.split('/').some((part) => part.startsWith('.'))) return null;
  const file = path.resolve(publicRoot, `.${decoded}`);
  if (!file.startsWith(publicRoot)) return null;
  const type = types[path.extname(file).toLowerCase()];
  if (!type) return null;
  try {
    const info = await stat(file);
    if (!info.isFile()) return null;
    const etag = `"${createHash('sha1').update(`${file}:${info.mtimeMs}:${info.size}`).digest('hex').slice(0, 20)}"`;
    if (incoming.headers['if-none-match'] === etag) {
      return { status: 304, headers: { etag, 'cache-control': 'public, max-age=300' }, body: null };
    }
    const headers = {
      'content-type': type,
      'cache-control': 'public, max-age=300',
      etag,
      'last-modified': info.mtime.toUTCString(),
      'x-content-type-options': 'nosniff',
    };
    if (path.extname(file).toLowerCase() === '.svg') {
      headers['content-security-policy'] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
    }
    return { status: 200, headers, body: await readFile(file) };
  } catch {
    return null;
  }
}

function encoded(body, headers, accepted) {
  if (!body || body.length < 1024 || !compressible.test(headers['content-type'] || '')) return { body, headers };
  let result = body;
  let encoding;
  if (String(accepted || '').includes('br')) {
    result = brotliCompressSync(body, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 5 } });
    encoding = 'br';
  } else if (String(accepted || '').includes('gzip')) {
    result = gzipSync(body, { level: 6 });
    encoding = 'gzip';
  }
  if (!encoding) return { body, headers };
  return { body: result, headers: { ...headers, 'content-encoding': encoding, vary: 'Accept-Encoding' } };
}

const server = http.createServer(async (incoming, outgoing) => {
  try {
    let result = (incoming.method === 'GET' || incoming.method === 'HEAD') ? await staticAsset(incoming) : null;
    if (!result) {
      const chunks = [];
      for await (const chunk of incoming) chunks.push(chunk);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const origin = `http://${incoming.headers.host}`;
      const request = new Request(new URL(incoming.url, origin), {
        method: incoming.method,
        headers: incoming.headers,
        body,
      });
      const response = await handleRequest(request, {
        ip: incoming.socket.remoteAddress || '127.0.0.1',
        storage,
      });
      const headers = Object.fromEntries(response.headers);
      const setCookies = response.headers.getSetCookie?.() || [];
      if (setCookies.length) headers['set-cookie'] = setCookies;
      result = {
        status: response.status,
        headers,
        body: response.body ? Buffer.from(await response.arrayBuffer()) : null,
      };
    }

    const output = encoded(result.body, result.headers, incoming.headers['accept-encoding']);
    if (output.body) output.headers['content-length'] = String(output.body.length);
    outgoing.writeHead(result.status, output.headers);
    if (incoming.method === 'HEAD' || !output.body) outgoing.end();
    else outgoing.end(output.body);
  } catch (error) {
    outgoing.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    outgoing.end(String(error?.stack || error));
  }
});

let base = '';

export async function startServer() {
  if (base) return base;
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  return base;
}

export async function stopServer() {
  if (!base) return;
  await new Promise((resolve) => server.close(resolve));
  base = '';
}

export function freshDatabase() {
  storage.reset(createDatabaseState());
  return storage.state();
}

/** A cookie jar that behaves enough like a browser for these tests. */
export class Client {
  constructor(origin) {
    this.origin = origin;
    this.cookies = new Map();
  }

  cookieHeader() {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  store(response) {
    for (const raw of response.headers.getSetCookie?.() || []) {
      const [pair] = raw.split(';');
      const eq = pair.indexOf('=');
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (value === '') this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  async get(path, options = {}) {
    const response = await fetch(`${this.origin}${path}`, {
      redirect: 'manual',
      headers: { Cookie: this.cookieHeader(), ...(options.headers || {}) },
    });
    this.store(response);
    return response;
  }

  /** Reads a page and extracts its CSRF token, as a browser would. */
  async csrf(path) {
    const response = await this.get(path);
    const body = await response.text();
    const match = body.match(/name="_csrf" value="([^"]+)"/);
    return { token: match?.[1] || '', body, response };
  }

  async post(path, fields, options = {}) {
    const body = new URLSearchParams(fields).toString();
    const response = await fetch(`${this.origin}${path}`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: this.origin,
        Cookie: this.cookieHeader(),
        ...(options.headers || {}),
      },
      body,
    });
    this.store(response);
    return response;
  }

  async postJson(path, payload, options = {}) {
    const response = await fetch(`${this.origin}${path}`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/json',
        Origin: this.origin,
        Cookie: this.cookieHeader(),
        ...(options.headers || {}),
      },
      body: JSON.stringify(payload),
    });
    this.store(response);
    return response;
  }
}

/** Form posts need a plausible age to pass the timing trap. */
export const humanTimestamp = () => String(Date.now() - 5000);
