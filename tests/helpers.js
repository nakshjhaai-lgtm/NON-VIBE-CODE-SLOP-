/**
 * Test harness.
 *
 * Starts the real server on an ephemeral port against an in-memory database,
 * so the tests exercise the same code path a browser does: real headers, real
 * cookies, real CSRF, real routing. Nothing is stubbed.
 */
import { DatabaseSync } from 'node:sqlite';
import { useDatabase } from '../server/db/index.js';

process.env.NETGUARD_DB = ':memory:';
process.env.NETGUARD_CSRF_KEY = 'test-key-not-used-in-production';

const { server } = await import('../server/index.js');
const { buildSearchIndex } = await import('../server/routes/index.js');

useDatabase(new DatabaseSync(':memory:'));
buildSearchIndex();

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
  return useDatabase(new DatabaseSync(':memory:'));
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
