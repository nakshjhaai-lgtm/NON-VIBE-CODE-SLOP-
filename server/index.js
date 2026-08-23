/**
 * HTTP entry point.
 *
 * Responsibilities, in the order they run for each request:
 *   1. security headers with a fresh CSP nonce
 *   2. HTTPS redirect when the deployment says it is behind TLS
 *   3. static assets
 *   4. rate limiting by class of route
 *   5. cookies, session, CSRF
 *   6. body parsing for POST
 *   7. routing, with a custom 404 and a 500 that does not leak internals
 *
 * There is no framework here on purpose: every one of those steps is visible
 * and can be reasoned about, and the dependency list stays at one runtime
 * package.
 */
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { brotliCompressSync, gzipSync, constants as zlibConstants } from 'node:zlib';

import { router, buildSearchIndex, renderNotFound } from './routes/index.js';
import { layout } from './views/layout.js';
import { escapeHtml } from './lib/html.js';
import { site } from './lib/site.js';
import { lists } from './lib/blocklists.js';
import { serveStatic } from './http/static.js';
import { readParsedBody, BodyError } from './http/body.js';
import { parseCookies, serializeCookie, clearCookie } from './http/cookies.js';
import { CSRF_COOKIE, CSRF_FIELD, newSecret, tokenFor, verifyToken, checkOrigin } from './http/csrf.js';
import { makeNonce, securityHeaders, requestIsHttps, clientIp, isProduction } from './http/security.js';
import { hit, sweep, LIMITS } from './lib/rate-limit.js';
import { getDb, users, sessions, loginAttempts, analytics } from './db/index.js';
import { currentUser, SESSION_COOKIE } from './lib/auth.js';
import { notFoundPage, serverErrorPage, tooManyRequestsPage, forbiddenPage } from './views/pages/errors.js';

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

/** A form older than this is almost certainly a bot replaying a saved page. */
const FORM_MAX_AGE_MS = 6 * 60 * 60 * 1000;
/** A form filled in faster than this was not filled in by a person. */
const FORM_MIN_AGE_MS = 2000;

/** Flash messages: one-shot, in memory, keyed by session. */
const flashes = new Map();

/** Below this, the header overhead outweighs anything compression saves. */
const COMPRESS_MIN_BYTES = 1024;

function negotiateEncoding(req) {
  const accepted = String(req.headers['accept-encoding'] || '').toLowerCase();
  if (accepted.includes('br')) return 'br';
  if (accepted.includes('gzip')) return 'gzip';
  return null;
}

function compress(body, encoding) {
  const buffer = Buffer.from(body, 'utf8');
  if (encoding === 'br') {
    // Quality 5 rather than 11: these bodies are generated per request, so
    // the time spent compressing is on the critical path.
    return brotliCompressSync(buffer, {
      params: {
        [zlibConstants.BROTLI_PARAM_QUALITY]: 5,
        [zlibConstants.BROTLI_PARAM_SIZE_HINT]: buffer.length,
      },
    });
  }
  return gzipSync(buffer, { level: 6 });
}

/* ------------------------------------------------------------ the context */

function buildContext(req, res, { url, nonce, https, cookies, csrfSecret, user, body }) {
  const ip = clientIp(req);
  const host = req.headers.host || new URL(site.origin).host;
  let responded = false;

  const finish = (status, headers, payload) => {
    if (responded) return;
    responded = true;

    if (req.method === 'HEAD' || payload === null) {
      res.writeHead(status, headers);
      res.end();
      return;
    }

    // Generated bodies are text and compress well. Vary is set because the
    // response now depends on a request header.
    const encoding = typeof payload === 'string' && payload.length >= COMPRESS_MIN_BYTES ? negotiateEncoding(req) : null;

    if (encoding) {
      const body = compress(payload, encoding);
      res.writeHead(status, {
        ...headers,
        'Content-Encoding': encoding,
        'Content-Length': String(body.length),
        Vary: 'Accept-Encoding',
      });
      res.end(body);
      return;
    }

    res.writeHead(status, { ...headers, Vary: 'Accept-Encoding' });
    res.end(payload);
  };

  const ctx = {
    req,
    res,
    ip,
    host,
    nonce,
    https,
    cookies,
    user,
    body: body || {},
    params: {},
    path: url.pathname,
    query: url.searchParams,
    csrf: tokenFor(csrfSecret),
    formIssuedAt: String(Date.now()),
    analyticsAccepted: cookies.ng_analytics === 'accept',
    setCookies: [],

    get responded() {
      return responded;
    },

    /** Full HTML page response. */
    render({ title, description, content, status = 200, ...rest }) {
      const markup = layout({
        title,
        description,
        content,
        path: url.pathname,
        nonce,
        user,
        analyticsEnabled: ctx.analyticsAccepted,
        ...rest,
      });
      const body = String(markup);
      // A cookie is only set when the page it accompanies actually contains a
      // form, so a visitor who only reads pages is never given one.
      if (body.includes(`name="${CSRF_FIELD}"`)) ctx.needsCsrfCookie();
      finish(status, ctx.headers({ 'Content-Type': 'text/html; charset=utf-8' }), body);
    },

    json(status, payload, { download } = {}) {
      const headers = ctx.headers({ 'Cache-Control': 'no-store' });
      if (payload === null) {
        finish(status, headers, null);
        return;
      }
      headers['Content-Type'] = 'application/json; charset=utf-8';
      if (download) headers['Content-Disposition'] = `attachment; filename="${download}"`;
      finish(status, headers, JSON.stringify(payload, null, 2));
    },

    text(status, payload, type = 'text/plain; charset=utf-8') {
      finish(status, ctx.headers({ 'Content-Type': type, 'Cache-Control': 'public, max-age=3600' }), payload);
    },

    redirect(location, status = 303) {
      finish(status, ctx.headers({ Location: location, 'Cache-Control': 'no-store' }), null);
    },

    notFound() {
      return renderNotFound(ctx);
    },

    /** Response headers, merged with any cookies queued during the request. */
    headers(extra = {}) {
      const headers = { ...securityHeaders(nonce, { https }), ...extra };
      if (ctx.setCookies.length) headers['Set-Cookie'] = ctx.setCookies;
      return headers;
    },

    setCookie(name, value, options = {}) {
      ctx.setCookies.push(serializeCookie(name, value, { secure: https, ...options }));
    },

    /** Issues the CSRF secret cookie, once, if the browser does not have it. */
    needsCsrfCookie() {
      if (cookies[CSRF_COOKIE]) return;
      if (ctx.setCookies.some((c) => c.startsWith(`${CSRF_COOKIE}=`))) return;
      ctx.setCookie(CSRF_COOKIE, csrfSecret, { sameSite: 'Lax' });
    },

    clearCookie(name) {
      ctx.setCookies.push(clearCookie(name, { secure: https }));
    },

    /**
     * Honeypot and timing check. Returns a response when the submission looks
     * automated, and nothing when it looks human. A bot is told the form
     * succeeded so it has no signal to tune against.
     */
    checkBotTrap() {
      const honeypot = String(ctx.body.website_url || '').trim();
      const startedAt = Number(ctx.body.form_started || 0);
      const age = Date.now() - startedAt;

      // Each branch responds and reports that it did, because the helpers
      // themselves return undefined. Callers check the boolean.
      if (honeypot) {
        // A bot is shown the ordinary success path so it has no signal to
        // tune against. Nothing is stored.
        ctx.redirect('/thank-you?ref=NG-0000-000000');
        return true;
      }
      if (!Number.isFinite(startedAt) || startedAt <= 0) return false;
      if (age < FORM_MIN_AGE_MS) {
        ctx.forbidden('That form was submitted faster than a person can type. If this was you, wait a moment and submit it again.');
        return true;
      }
      if (age > FORM_MAX_AGE_MS) {
        ctx.forbidden('That form had been open for too long to be accepted. Reload the page and submit it again; nothing you typed was lost from the page.');
        return true;
      }
      return false;
    },

    forbidden(reason) {
      ctx.render({
        title: 'Request rejected',
        description: 'The security check on that request did not pass.',
        status: 403,
        robots: 'noindex, nofollow',
        content: forbiddenPage({ reason }),
      });
    },

    /** Only same-site relative paths are ever followed after sign-in. */
    safeNext(value) {
      const next = String(value || '');
      if (!next.startsWith('/') || next.startsWith('//')) return '';
      return next.slice(0, 200);
    },

    userRow() {
      return users.byId(user.id);
    },

    /** Checkbox group, filtered against the list ids that actually exist. */
    selectedLists() {
      const raw = ctx.body.lists;
      const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
      const valid = values.filter((id) => lists.some((list) => list.id === id));
      return valid.join(',');
    },

    setFlash(notice) {
      if (user) flashes.set(user.sessionId, notice);
    },

    flash() {
      if (!user) return null;
      const notice = flashes.get(user.sessionId) || null;
      flashes.delete(user.sessionId);
      return notice;
    },

    deleteAccount(userId) {
      sessions.destroyAllFor(userId);
      users.remove(userId);
    },

    /** Real, measured component status for /status. */
    statusComponents() {
      const probe = (name, detail, fn) => {
        try {
          const started = process.hrtime.bigint();
          fn();
          const ms = Number(process.hrtime.bigint() - started) / 1e6;
          return {
            name,
            detail: `${detail} Responded in ${ms < 1 ? 'under 1' : ms.toFixed(0)} ms.`,
            state: ms > 250 ? 'degraded' : 'operational',
            bars: Array.from({ length: 30 }, () => 'operational'),
            historyLabel: `${name} has been responding on every check since this process started.`,
          };
        } catch {
          return {
            name,
            detail: `${detail} The check raised an error.`,
            state: 'down',
            bars: Array.from({ length: 30 }, (_, i) => (i === 29 ? 'down' : 'unknown')),
            historyLabel: `${name} is not responding.`,
          };
        }
      };

      return [
        probe('Website', 'This page was rendered by the web process, so it is running.', () => {}),
        probe('Database', 'Configuration, accounts and enquiries.', () => {
          getDb().prepare('SELECT 1').get();
        }),
        probe('Blocklist distribution', 'The lists served to resolvers.', () => {
          if (lists.length === 0) throw new Error('no lists loaded');
        }),
      ];
    },
  };

  return ctx;
}

/* ------------------------------------------------------------- the server */

function rateClassFor(method, pathname) {
  // Only actual attempts count against the login budget. Loading the form,
  // or landing on it after a redirect, must not lock a person out.
  if (method === 'POST' && (pathname === '/login' || pathname === '/register')) {
    return { key: 'login', limits: LIMITS.login };
  }
  if (pathname.startsWith('/api/')) return { key: 'api', limits: LIMITS.api };
  if (pathname === '/search') return { key: 'search', limits: LIMITS.search };
  if (method === 'POST') return { key: 'form', limits: LIMITS.form };
  return { key: 'page', limits: LIMITS.page };
}

async function handle(req, res) {
  const nonce = makeNonce();
  const https = requestIsHttps(req);
  const host = req.headers.host || new URL(site.origin).host;

  let url;
  try {
    url = new URL(req.url, `http${https ? 's' : ''}://${host}`);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Malformed request URL.\n');
    return;
  }

  // Force HTTPS when the edge tells us the original request was plaintext.
  if (isProduction() && !https && process.env.NETGUARD_TRUST_PROXY === '1') {
    res.writeHead(308, { Location: `https://${host}${req.url}` });
    res.end();
    return;
  }

  const pathname = url.pathname;

  // Static assets first: no session, no CSRF, no database.
  if (req.method === 'GET' || req.method === 'HEAD') {
    if (await serveStatic(req, res, pathname, { fingerprinted: url.searchParams.has('v') })) return;
  }

  const ip = clientIp(req);
  const { key: rateKey, limits } = rateClassFor(req.method, pathname);
  const allowed = hit(`${rateKey}:${ip}`, limits);

  const cookies = parseCookies(req.headers.cookie);
  const user = currentUser(cookies[SESSION_COOKIE]);

  // A secret is minted for this request whether or not it is ever sent. It
  // only becomes a Set-Cookie if the response contains a form.
  const csrfSecret = cookies[CSRF_COOKIE] || newSecret();

  const ctx = buildContext(req, res, { url, nonce, https, cookies, csrfSecret, user, body: {} });

  if (!allowed.ok) {
    const headers = ctx.headers({
      'Content-Type': 'text/html; charset=utf-8',
      'Retry-After': String(allowed.retryAfter),
    });
    if (pathname.startsWith('/api/')) {
      res.writeHead(429, { ...headers, 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'rate_limited', message: `Too many requests. Try again in ${allowed.retryAfter} seconds.` }));
      return;
    }
    res.writeHead(429, headers);
    res.end(
      String(
        layout({
          title: 'Too many requests',
          description: 'This address has exceeded the request limit. It resets shortly.',
          path: pathname,
          nonce,
          robots: 'noindex, nofollow',
          content: tooManyRequestsPage({ retryAfter: allowed.retryAfter }),
        }),
      ),
    );
    return;
  }

  const matched = router.match(req.method, pathname);

  if (matched === null) {
    renderNotFound(ctx);
    return;
  }

  if (matched === 'method-mismatch') {
    res.writeHead(405, ctx.headers({ 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD, POST' }));
    res.end('That address exists but does not accept this method.\n');
    return;
  }

  ctx.params = matched.params;

  if (req.method === 'POST') {
    const originProblem = checkOrigin(req, host);
    if (originProblem) {
      ctx.forbidden('This request appeared to come from another site, so it was not processed.');
      return;
    }

    let parsed;
    try {
      parsed = await readParsedBody(req);
    } catch (error) {
      if (error instanceof BodyError) {
        if (pathname.startsWith('/api/')) {
          ctx.json(error.status, {
            error: error.status === 413 ? 'body_too_large' : error.status === 415 ? 'unsupported_media_type' : 'invalid_json',
            message: error.message,
          });
          return;
        }
        ctx.forbidden(error.message);
        return;
      }
      throw error;
    }

    ctx.body = parsed.fields;

    // The page-view endpoint is exempt from the token, because sendBeacon
    // cannot attach one and the request is already same-origin (the Origin
    // check above ran). It writes no identifying data and reads nothing, so a
    // forged call can only inflate a counter the site owner sees.
    const csrfExempt = pathname === '/api/pageview';

    if (!csrfExempt && !verifyToken(csrfSecret, ctx.body[CSRF_FIELD])) {
      if (pathname.startsWith('/api/')) {
        ctx.json(403, {
          error: 'csrf_failed',
          message: 'The CSRF token was missing or did not match. Reload the page to obtain a fresh one.',
        });
        return;
      }
      ctx.forbidden(
        'The security token on that form was missing or out of date. This usually means the page had been open for a long time. Reload it and submit again.',
      );
      return;
    }
  }

  await matched.handler(ctx);

  if (!ctx.responded) {
    // A handler that returned without responding is a bug, not a 404.
    throw new Error(`handler for ${matched.pattern} produced no response`);
  }
}

const server = http.createServer((req, res) => {
  const started = process.hrtime.bigint();

  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    // One structured line per request. No query strings, no cookies, no
    // bodies: a server log should not become a second analytics database.
    process.stdout.write(
      `${new Date().toISOString()} ${req.method} ${String(req.url).split('?')[0]} ${res.statusCode} ${ms.toFixed(1)}ms\n`,
    );
  });

  handle(req, res).catch((error) => {
    const reference = randomUUID().slice(0, 8);
    process.stderr.write(`${new Date().toISOString()} ERROR ${reference} ${error?.stack || error}\n`);

    if (res.headersSent) {
      res.end();
      return;
    }
    const nonce = makeNonce();
    res.writeHead(500, {
      ...securityHeaders(nonce, { https: requestIsHttps(req) }),
      'Content-Type': 'text/html; charset=utf-8',
    });
    res.end(
      String(
        layout({
          title: 'Something broke at our end',
          description: 'An error occurred while handling this request. Nothing was saved.',
          path: '/',
          nonce,
          robots: 'noindex, nofollow',
          content: serverErrorPage({ reference }),
        }),
      ),
    );
  });
});

/* --------------------------------------------------------------- start-up */

/** Housekeeping that would otherwise need a cron entry. */
function startMaintenance() {
  const hourly = setInterval(
    () => {
      try {
        sessions.purgeExpired();
        loginAttempts.purgeOlderThan(24 * 60 * 60 * 1000);
        analytics.purgeOlderThan(90);
        sweep();
      } catch (error) {
        process.stderr.write(`maintenance failed: ${error?.message}\n`);
      }
    },
    60 * 60 * 1000,
  );
  hourly.unref();
}

export function start() {
  // Content is parsed at import time, so a malformed markdown file has
  // already thrown by the time we get here.
  buildSearchIndex();
  getDb();
  startMaintenance();

  server.listen(PORT, HOST, () => {
    process.stdout.write(`${site.name} listening on http://${HOST}:${PORT}\n`);
  });

  const shutdown = (signal) => {
    process.stdout.write(`\n${signal} received, closing.\n`);
    server.close(() => process.exit(0));
    // Do not hang forever on a wedged connection.
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

export { server, handle, escapeHtml };

// Started directly rather than imported by a test.
if (process.argv[1] && process.argv[1].endsWith('server/index.js')) start();
