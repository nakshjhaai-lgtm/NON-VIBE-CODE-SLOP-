/**
 * Standards-based HTTP application for Netlify Edge Functions.
 *
 * Requests and responses use the Fetch API throughout. Static assets are
 * served directly by Netlify's CDN; application routes retain the same
 * server-rendered pages, forms, APIs, sessions, CSRF checks, validation and
 * security headers without Node HTTP streams or a writable filesystem.
 */
import { router, buildSearchIndex, renderNotFound } from './routes/index.js';
import { layout } from './views/layout.js';
import { escapeHtml } from './lib/html.js';
import { site } from './lib/site.js';
import { lists } from './lib/blocklists.js';
import { readParsedBody, BodyError } from './http/body.js';
import { parseCookies, serializeCookie, clearCookie } from './http/cookies.js';
import { CSRF_COOKIE, CSRF_FIELD, newSecret, tokenFor, verifyToken, checkOrigin } from './http/csrf.js';
import { makeNonce, securityHeaders } from './http/security.js';
import { hit, LIMITS } from './lib/rate-limit.js';
import {
  createMemoryStorage,
  flashMessages,
  getDb,
  runInDatabase,
  sessions,
  users,
} from './db/index.js';
import { currentUser, SESSION_COOKIE } from './lib/auth.js';
import { serverErrorPage, tooManyRequestsPage, forbiddenPage } from './views/pages/errors.js';

const FORM_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const FORM_MIN_AGE_MS = 2000;

let initialized = false;
let defaultStorage = createMemoryStorage();

/** Initialise the in-memory search index once per edge isolate. */
export function initialize() {
  if (initialized) return;
  buildSearchIndex();
  initialized = true;
}

/** Test/local hook; production always passes a Netlify Blobs adapter. */
export function useStorage(storage) {
  defaultStorage = storage;
}

function plainHeaders(headers) {
  const out = Object.create(null);
  for (const [name, value] of headers) out[name.toLowerCase()] = value;
  return out;
}

function applyHeaders(target, values) {
  if (!values) return;
  if (values instanceof Headers) {
    for (const [name, value] of values) target.append(name, value);
    return;
  }
  for (const [name, value] of Object.entries(values)) {
    if (Array.isArray(value)) for (const item of value) target.append(name, String(item));
    else if (value !== undefined && value !== null) target.set(name, String(value));
  }
}

function buildContext(request, runtime, { url, nonce, https, cookies, csrfSecret, user, body }) {
  const requestHeaders = plainHeaders(request.headers);
  const ip = runtime.ip || requestHeaders['x-nf-client-connection-ip'] || '0.0.0.0';
  const host = url.host || new URL(site.origin).host;
  const req = {
    method: request.method,
    url: `${url.pathname}${url.search}`,
    headers: requestHeaders,
    clientIp: ip,
    socket: { encrypted: https, remoteAddress: ip },
  };

  let response = null;

  const finish = (status, headers, payload) => {
    if (response) return;
    const responseHeaders = headers instanceof Headers ? headers : new Headers(headers || {});
    const responseBody = request.method === 'HEAD' || payload === null ? null : payload;
    response = new Response(responseBody, { status, headers: responseHeaders });
  };

  const ctx = {
    req,
    request,
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
      return response !== null;
    },

    get response() {
      return response;
    },

    render({ title, description, content, status = 200, responseHeaders, ...rest }) {
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
      const page = String(markup);
      if (page.includes(`name="${CSRF_FIELD}"`)) ctx.needsCsrfCookie();
      finish(status, ctx.headers({ 'Content-Type': 'text/html; charset=utf-8', ...responseHeaders }), page);
    },

    json(status, payload, { download, headers: extraHeaders } = {}) {
      const headers = ctx.headers({ 'Cache-Control': 'no-store', ...extraHeaders });
      if (payload === null) {
        finish(status, headers, null);
        return;
      }
      headers.set('Content-Type', 'application/json; charset=utf-8');
      if (download) headers.set('Content-Disposition', `attachment; filename="${download}"`);
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

    headers(extra = {}) {
      const headers = new Headers();
      applyHeaders(headers, securityHeaders(nonce, { https }));
      applyHeaders(headers, extra);
      for (const cookie of ctx.setCookies) headers.append('Set-Cookie', cookie);
      return headers;
    },

    setCookie(name, value, options = {}) {
      ctx.setCookies.push(serializeCookie(name, value, { secure: https, ...options }));
    },

    needsCsrfCookie() {
      if (cookies[CSRF_COOKIE]) return;
      if (ctx.setCookies.some((cookie) => cookie.startsWith(`${CSRF_COOKIE}=`))) return;
      ctx.setCookie(CSRF_COOKIE, csrfSecret, { sameSite: 'Lax' });
    },

    clearCookie(name) {
      ctx.setCookies.push(clearCookie(name, { secure: https }));
    },

    checkBotTrap() {
      const honeypot = String(ctx.body.website_url || '').trim();
      const startedAt = Number(ctx.body.form_started || 0);
      const age = Date.now() - startedAt;

      if (honeypot) {
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

    safeNext(value) {
      const next = String(value || '');
      if (!next.startsWith('/') || next.startsWith('//')) return '';
      return next.slice(0, 200);
    },

    userRow() {
      return users.byId(user.id);
    },

    selectedLists() {
      const raw = ctx.body.lists;
      const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
      return values.filter((id) => lists.some((list) => list.id === id)).join(',');
    },

    setFlash(notice) {
      if (user) flashMessages.set(user.sessionId, notice);
    },

    flash() {
      return user ? flashMessages.take(user.sessionId) : null;
    },

    deleteAccount(userId) {
      sessions.destroyAllFor(userId);
      users.remove(userId);
    },

    statusComponents() {
      const probe = (name, detail, fn) => {
        try {
          const started = performance.now();
          fn();
          const ms = performance.now() - started;
          return {
            name,
            detail: `${detail} Responded in ${ms < 1 ? 'under 1' : ms.toFixed(0)} ms.`,
            state: ms > 250 ? 'degraded' : 'operational',
            bars: Array.from({ length: 30 }, () => 'operational'),
            historyLabel: `${name} has been responding on every check since this edge isolate started.`,
          };
        } catch {
          return {
            name,
            detail: `${detail} The check raised an error.`,
            state: 'down',
            bars: Array.from({ length: 30 }, (_, index) => (index === 29 ? 'down' : 'unknown')),
            historyLabel: `${name} is not responding.`,
          };
        }
      };

      return [
        probe('Website', 'This page was rendered by the edge application, so it is running.', () => {}),
        probe('Database', 'Configuration, accounts and enquiries.', () => getDb()),
        probe('Blocklist distribution', 'The lists served to resolvers.', () => {
          if (lists.length === 0) throw new Error('no lists loaded');
        }),
      ];
    },
  };

  return ctx;
}

function rateClassFor(method, pathname) {
  if (method === 'POST' && (pathname === '/login' || pathname === '/register')) {
    return { key: 'login', limits: LIMITS.login };
  }
  if (pathname.startsWith('/api/')) return { key: 'api', limits: LIMITS.api };
  if (pathname === '/search') return { key: 'search', limits: LIMITS.search };
  if (method === 'POST') return { key: 'form', limits: LIMITS.form };
  return { key: 'page', limits: LIMITS.page };
}

async function handle(
  request,
  runtime = {},
  bodyOutcome = { parsed: { kind: 'empty', fields: {} }, error: null },
  allowed,
) {
  const nonce = makeNonce();
  const url = new URL(request.url);
  const https = url.protocol === 'https:';
  const pathname = url.pathname;
  const requestHeaders = plainHeaders(request.headers);
  if (!allowed) {
    const ip = runtime.ip || requestHeaders['x-nf-client-connection-ip'] || '0.0.0.0';
    const { key, limits } = rateClassFor(request.method, pathname);
    allowed = hit(`${key}:${ip}`, limits);
  }

  const cookies = parseCookies(requestHeaders.cookie);
  const user = currentUser(cookies[SESSION_COOKIE]);
  const csrfSecret = cookies[CSRF_COOKIE] || newSecret();
  const ctx = buildContext(request, runtime, { url, nonce, https, cookies, csrfSecret, user, body: {} });

  if (!allowed.ok) {
    if (pathname.startsWith('/api/')) {
      ctx.json(
        429,
        { error: 'rate_limited', message: `Too many requests. Try again in ${allowed.retryAfter} seconds.` },
        { headers: { 'Retry-After': String(allowed.retryAfter) } },
      );
      return ctx.response;
    }
    ctx.render({
      title: 'Too many requests',
      description: 'This address has exceeded the request limit. It resets shortly.',
      status: 429,
      robots: 'noindex, nofollow',
      responseHeaders: { 'Retry-After': String(allowed.retryAfter) },
      content: tooManyRequestsPage({ retryAfter: allowed.retryAfter }),
    });
    return ctx.response;
  }

  const matched = router.match(request.method, pathname);
  if (matched === null) {
    renderNotFound(ctx);
    return ctx.response;
  }
  if (matched === 'method-mismatch') {
    const headers = ctx.headers({ 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD, POST' });
    return new Response(request.method === 'HEAD' ? null : 'That address exists but does not accept this method.\n', { status: 405, headers });
  }

  ctx.params = matched.params;

  if (request.method === 'POST') {
    const originProblem = checkOrigin(request, url.host);
    if (originProblem) {
      ctx.forbidden('This request appeared to come from another site, so it was not processed.');
      return ctx.response;
    }

    if (bodyOutcome.error) {
      const error = bodyOutcome.error;
      if (pathname.startsWith('/api/')) {
        ctx.json(error.status, {
          error: error.status === 413 ? 'body_too_large' : error.status === 415 ? 'unsupported_media_type' : 'invalid_json',
          message: error.message,
        });
      } else {
        ctx.forbidden(error.message);
      }
      return ctx.response;
    }

    ctx.body = bodyOutcome.parsed.fields;
    const csrfExempt = pathname === '/api/pageview';
    if (!csrfExempt && !verifyToken(csrfSecret, ctx.body[CSRF_FIELD])) {
      if (pathname.startsWith('/api/')) {
        ctx.json(403, {
          error: 'csrf_failed',
          message: 'The CSRF token was missing or did not match. Reload the page to obtain a fresh one.',
        });
      } else {
        ctx.forbidden(
          'The security token on that form was missing or out of date. This usually means the page had been open for a long time. Reload it and submit again.',
        );
      }
      return ctx.response;
    }
  }

  await matched.handler(ctx);
  if (!ctx.responded) throw new Error(`handler for ${matched.pattern} produced no response`);
  return ctx.response;
}

function errorResponse(request, error) {
  const reference = globalThis.crypto.randomUUID().slice(0, 8);
  console.error(`${new Date().toISOString()} ERROR ${reference}`, error?.stack || error);
  const nonce = makeNonce();
  const url = new URL(request.url);
  const headers = new Headers({
    ...securityHeaders(nonce, { https: url.protocol === 'https:' }),
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  const page = layout({
    title: 'Something broke at our end',
    description: 'An error occurred while handling this request. Nothing was saved.',
    path: '/',
    nonce,
    robots: 'noindex, nofollow',
    content: serverErrorPage({ reference }),
  });
  return new Response(request.method === 'HEAD' ? null : String(page), { status: 500, headers });
}

/** Main application entry used by Netlify and by the compatibility test harness. */
export async function handleRequest(request, runtime = {}) {
  initialize();
  const started = performance.now();
  let response;

  // Rate limiting precedes body reads, as it did in the long-running server.
  // The result is also calculated only once if an ETag conflict replays the
  // database operation.
  const requestHeaders = plainHeaders(request.headers);
  const requestUrl = new URL(request.url);
  const ip = runtime.ip || requestHeaders['x-nf-client-connection-ip'] || '0.0.0.0';
  const { key: rateKey, limits } = rateClassFor(request.method, requestUrl.pathname);
  const allowed = hit(`${rateKey}:${ip}`, limits);

  let bodyOutcome = { parsed: { kind: 'empty', fields: {} }, error: null };
  if (request.method === 'POST' && allowed.ok) {
    try {
      bodyOutcome = { parsed: await readParsedBody(request), error: null };
    } catch (error) {
      if (!(error instanceof BodyError)) return errorResponse(request, error);
      bodyOutcome = { parsed: null, error };
    }
  }

  try {
    response = await runInDatabase(
      runtime.storage || defaultStorage,
      () => handle(request, runtime, bodyOutcome, allowed),
    );
  } catch (error) {
    response = errorResponse(request, error);
  }

  console.log(
    `${new Date().toISOString()} ${request.method} ${new URL(request.url).pathname} ${response.status} ${(performance.now() - started).toFixed(1)}ms`,
  );
  return response;
}

export { handle, escapeHtml };
