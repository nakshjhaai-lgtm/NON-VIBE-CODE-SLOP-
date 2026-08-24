/**
 * Netlify adapter for the existing Node HTTP application.
 *
 * The application deliberately owns its HTTP and security pipeline. This
 * adapter presents a Netlify Request as Node's IncomingMessage/ServerResponse
 * pair, so routes, CSRF, sessions, form posts, APIs, compression and static
 * asset handling continue to use that one pipeline unchanged.
 */
import { Readable, Writable } from 'node:stream';
import { initialize, handleWithErrors } from '../../server/index.js';

let ready = false;

function nodeHeaders(headers) {
  const result = Object.create(null);
  for (const [name, value] of headers) result[name.toLowerCase()] = value;
  return result;
}

class NetlifyResponse extends Writable {
  constructor(resolve) {
    super();
    this.statusCode = 200;
    this.headers = {};
    this.headersSent = false;
    this.chunks = [];
    this.resolve = resolve;
  }

  writeHead(statusCode, headers = {}) {
    this.statusCode = statusCode;
    this.headers = { ...this.headers, ...headers };
    this.headersSent = true;
    return this;
  }

  _write(chunk, encoding, callback) {
    this.headersSent = true;
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
    callback();
  }

  _final(callback) {
    const headers = new Headers();
    for (const [name, value] of Object.entries(this.headers)) {
      if (Array.isArray(value)) for (const item of value) headers.append(name, item);
      else if (value !== undefined) headers.set(name, String(value));
    }
    this.resolve(new Response(this.chunks.length ? Buffer.concat(this.chunks) : null, { status: this.statusCode, headers }));
    callback();
  }
}

async function incomingRequest(request) {
  const url = new URL(request.url);
  const source = request.method === 'GET' || request.method === 'HEAD' ? [] : [Buffer.from(await request.arrayBuffer())];
  const body = Readable.from(source);
  // This is the intentionally small IncomingMessage shape the application
  // relies on; the request body remains a normal Node readable stream.
  body.method = request.method;
  body.url = `${url.pathname}${url.search}`;
  body.headers = nodeHeaders(request.headers);
  // Fetch Request does not expose a Host header, while IncomingMessage does.
  body.headers.host ||= url.host;
  body.socket = { encrypted: url.protocol === 'https:', remoteAddress: request.headers.get('x-nf-client-connection-ip') || '0.0.0.0' };
  return body;
}

export default async function app(request) {
  if (!ready) {
    initialize();
    ready = true;
  }

  const req = await incomingRequest(request);
  return new Promise((resolve) => {
    const res = new NetlifyResponse(resolve);
    // Node's HTTP server emits finish after end; the application uses this
    // event only for its privacy-safe request log.
    res.on('finish', () => {});
    handleWithErrors(req, res);
  });
}

export const config = { path: '/*' };
