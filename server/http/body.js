/**
 * Request body reading.
 *
 * Hard byte ceiling enforced while streaming, so an oversized or lying
 * Content-Length cannot exhaust memory. Only the two content types this app
 * actually accepts are parsed; anything else is rejected.
 */

export const MAX_BODY_BYTES = 64 * 1024;

export class BodyError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function readBody(req, limit = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > limit) {
      reject(new BodyError(413, 'Request body is too large.'));
      return;
    }

    const chunks = [];
    let size = 0;
    let settled = false;

    const fail = (err) => {
      if (settled) return;
      settled = true;
      req.removeAllListeners('data');
      req.removeAllListeners('end');
      reject(err);
    };

    req.on('data', (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > limit) {
        // Stop reading; the connection is closed by the caller's error path.
        req.pause();
        fail(new BodyError(413, 'Request body is too large.'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks, size));
    });
    req.on('error', fail);
    req.on('aborted', () => fail(new BodyError(400, 'Request aborted.')));
  });
}

/**
 * Parses a form submission into a flat object of strings.
 *
 * Repeated keys keep their last value except for keys ending in `[]`, which
 * collect into an array. Field count is capped so a crafted body cannot
 * create an enormous object.
 */
export function parseForm(buffer, { maxFields = 100 } = {}) {
  const params = new URLSearchParams(buffer.toString('utf8'));
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
  if (buffer.length === 0) return {};
  let parsed;
  try {
    parsed = JSON.parse(buffer.toString('utf8'));
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
  const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  const buffer = await readBody(req, limit);
  if (type === 'application/x-www-form-urlencoded') return { kind: 'form', fields: parseForm(buffer) };
  if (type === 'application/json') return { kind: 'json', fields: parseJson(buffer) };
  if (type === '' && buffer.length === 0) return { kind: 'empty', fields: {} };
  throw new BodyError(415, `Unsupported content type: ${type || 'none'}.`);
}
