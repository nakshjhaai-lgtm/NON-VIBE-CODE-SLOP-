/**
 * Local preview server (development only).
 *
 * Mirrors the Netlify Edge runtime so the redesign can be previewed locally:
 * static files from `public/` are served directly, and every other path is
 * rendered by the real application handler. Binds to 0.0.0.0 so it is visible
 * through the platform preview tunnel.
 */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createMemoryStorage } from './server/db/index.js';
import { handleRequest, initialize, useStorage } from './server/index.js';

const storage = createMemoryStorage();
useStorage(storage);
initialize();

const publicRoot = fileURLToPath(new URL('./public/', import.meta.url));
const types = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
};

const port = Number(process.env.PORT || 5000);

async function staticAsset(incoming) {
  const url = new URL(incoming.url, `http://${incoming.headers.host}`);
  let decoded;
  try {
    decoded = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.includes('..') || decoded.split('/').some((p) => p.startsWith('.'))) return null;
  const file = path.resolve(publicRoot, `.${decoded}`);
  if (!file.startsWith(publicRoot)) return null;
  const type = types[path.extname(file).toLowerCase()];
  if (!type) return null;
  try {
    const info = await stat(file);
    if (!info.isFile()) return null;
    const etag = `"${createHash('sha1').update(`${file}:${info.mtimeMs}:${info.size}`).digest('hex').slice(0, 20)}"`;
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

const server = http.createServer(async (incoming, outgoing) => {
  try {
    let result = incoming.method === 'GET' || incoming.method === 'HEAD' ? await staticAsset(incoming) : null;
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
      const response = await handleRequest(request, { ip: incoming.socket.remoteAddress || '127.0.0.1', storage });
      const headers = Object.fromEntries(response.headers);
      const setCookies = response.headers.getSetCookie?.() || [];
      if (setCookies.length) headers['set-cookie'] = setCookies;
      result = {
        status: response.status,
        headers,
        body: response.body ? Buffer.from(await response.arrayBuffer()) : null,
      };
    }
    if (result.body) result.headers['content-length'] = String(result.body.length);
    outgoing.writeHead(result.status, result.headers);
    if (incoming.method === 'HEAD' || !result.body) outgoing.end();
    else outgoing.end(result.body);
  } catch (error) {
    outgoing.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    outgoing.end(String(error?.stack || error));
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`NetGuard preview listening on http://0.0.0.0:${port}`);
});
