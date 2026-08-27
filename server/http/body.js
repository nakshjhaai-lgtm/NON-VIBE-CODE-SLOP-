/**
 * Fetch Request body parsing with a hard 64 KiB ceiling.
 *
 * Only the two content types used by the site are accepted. Netlify already
 * bounds request bodies at the edge; this lower application limit is checked
 * both against Content-Length and against the bytes actually received.
 */
export const MAX_BODY_BYTES = 64 * 1024;

export class BodyError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function header(req, name) {
  if (typeof req?.headers?.get === 'function') return req.headers.get(name);
  return req?.headers?.[name] || req?.headers?.[name.toLowerCase()] || '';
}

export async function readBody(req, limit = MAX_BODY_BYTES) {
  const declared = Number(header(req, 'content-length'));
  if (Number.isFinite(declared) && declared > limit) {
    throw new BodyError(413, 'Request body is too large.');
  }

  if (!req?.body) return new Uint8Array();
  if (typeof req.body.getReader !== 'function') throw new BodyError(400, 'Request body is unavailable.');

  const reader = req.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new BodyError(413, 'Request body is too large.');
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof BodyError) throw error;
    throw new BodyError(400, 'Request body could not be read.');
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function decode(buffer) {
  return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
}

/** Parses a URL-encoded form into strings, collecting names ending in []. */
export function parseForm(buffer, { maxFields = 100 } = {}) {
  const params = new URLSearchParams(typeof buffer === 'string' ? buffer : decode(buffer));
  const out = Object.create(null);
  let count = 0;
  for (const [key, value] of params) {
    if (++count > maxFields) throw new BodyError(400, 'Too many form fields.');
    if (key.endsWith('[]')) {
      const name = key.slice(0, -2);
      (out[name] ||= []).push(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function parseJson(buffer) {
  if (buffer.byteLength === 0) return {};
  let parsed;
  try {
    parsed = JSON.parse(typeof buffer === 'string' ? buffer : decode(buffer));
  } catch {
    throw new BodyError(400, 'Request body is not valid JSON.');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new BodyError(400, 'Request body must be a JSON object.');
  }
  return parsed;
}

/** Reads and parses according to Content-Type. */
export async function readParsedBody(req, limit) {
  const type = String(header(req, 'content-type')).split(';')[0].trim().toLowerCase();
  const buffer = await readBody(req, limit);
  if (type === 'application/x-www-form-urlencoded') return { kind: 'form', fields: parseForm(buffer) };
  if (type === 'application/json') return { kind: 'json', fields: parseJson(buffer) };
  if (type === '' && buffer.byteLength === 0) return { kind: 'empty', fields: {} };
  throw new BodyError(415, `Unsupported content type: ${type || 'none'}.`);
}
