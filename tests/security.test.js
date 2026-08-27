/**
 * Security behaviour, exercised over HTTP rather than by reading the source.
 * Each test corresponds to a specific way this application could be attacked.
 */
import { test, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, stopServer, Client, freshDatabase, humanTimestamp } from './helpers.js';
import { users, enquiries, profiles, allowEntries } from '../server/db/index.js';
import { hashPassword } from '../server/lib/auth.js';
import { resetAll } from '../server/lib/rate-limit.js';

const origin = await startServer();
after(stopServer);

const fresh = () => {
  freshDatabase();
  resetAll();
  return new Client(origin);
};

describe('security headers', () => {
  test('every response carries the full header set', async () => {
    const client = fresh();
    const response = await client.get('/');
    const csp = response.headers.get('content-security-policy');

    assert.ok(csp, 'no Content-Security-Policy');
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /script-src 'self' 'nonce-[A-Za-z0-9+/=_-]+'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /base-uri 'none'/);
    assert.match(csp, /object-src 'none'/);
    assert.ok(!csp.includes('unsafe-inline'), 'CSP allows unsafe-inline');
    assert.ok(!csp.includes('unsafe-eval'), 'CSP allows unsafe-eval');

    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.match(response.headers.get('permissions-policy'), /geolocation=\(\)/);
    assert.equal(response.headers.get('cross-origin-opener-policy'), 'same-origin');
  });

  test('the nonce differs on every response and matches the inline script', async () => {
    const client = fresh();
    const first = await client.get('/');
    const firstBody = await first.text();
    const second = await client.get('/pricing');

    const nonce = first.headers.get('content-security-policy').match(/'nonce-([A-Za-z0-9+/=_-]+)'/)[1];
    const other = second.headers.get('content-security-policy').match(/'nonce-([A-Za-z0-9+/=_-]+)'/)[1];

    assert.notEqual(nonce, other, 'the nonce is reused across responses');
    assert.ok(firstBody.includes(`nonce="${nonce}"`), 'the inline script does not carry the response nonce');

    // Any script tag without the nonce would be blocked, so there must be none.
    for (const tag of firstBody.match(/<script[^>]*>/g) || []) {
      assert.ok(tag.includes(`nonce="${nonce}"`), `a script tag has no nonce: ${tag}`);
    }
  });

  test('no third-party origin is referenced by any asset', async () => {
    const client = fresh();
    const body = await (await client.get('/')).text();
    const external = [...body.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
    for (const url of external) {
      const host = new URL(url).host;
      // Outbound citation links are fine; loaded subresources are not.
      const isSubresource = new RegExp(`(?:src|href)="${url.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}"[^>]*(?:stylesheet|script)`).test(body);
      assert.ok(!isSubresource, `a subresource loads from ${host}`);
    }
    assert.ok(!body.includes('googleapis.com'), 'the page references Google Fonts');
    assert.ok(!body.includes('googletagmanager'), 'the page references Google Tag Manager');
  });
});

describe('CSRF', () => {
  test('a form post without a token is rejected', async () => {
    const client = fresh();
    await client.get('/contact');
    const response = await client.post('/contact', { name: 'A', email: 'a@example.com', message: 'x'.repeat(30) });
    assert.equal(response.status, 403);
    assert.equal(enquiries.count(), 0, 'the enquiry was stored despite a missing token');
  });

  test('a forged token is rejected', async () => {
    const client = fresh();
    await client.get('/contact');
    const response = await client.post('/contact', { _csrf: 'not-a-real-token', name: 'A' });
    assert.equal(response.status, 403);
  });

  test('a cross-site Origin is rejected even with a valid token', async () => {
    const client = fresh();
    const { token } = await client.csrf('/contact');
    const response = await client.post(
      '/contact',
      { _csrf: token, name: 'A', email: 'a@example.com', message: 'x'.repeat(30) },
      { headers: { Origin: 'https://attacker.example' } },
    );
    assert.equal(response.status, 403);
    assert.equal(enquiries.count(), 0);
  });

  test('a genuine submission with a valid token succeeds', async () => {
    const client = fresh();
    const { token } = await client.csrf('/contact');
    const response = await client.post('/contact', {
      _csrf: token,
      form_started: humanTimestamp(),
      name: 'Alex Fielding',
      email: 'alex@example.com',
      org: '',
      topic: 'support',
      message: 'My router is a Fritzbox and I cannot find where to set the DNS server. Where should I look?',
      consent: 'on',
    });
    assert.equal(response.status, 303);
    assert.match(response.headers.get('location'), /^\/thank-you\?ref=NG-\d{4}-[0-9A-F]{6}$/);
    assert.equal(enquiries.count(), 1);
  });
});

describe('input validation', () => {
  test('server-side validation runs even when the client is bypassed', async () => {
    const client = fresh();
    const { token } = await client.csrf('/contact');
    const response = await client.post('/contact', {
      _csrf: token,
      form_started: humanTimestamp(),
      name: 'A',
      email: 'not-an-email',
      topic: 'nonexistent-topic',
      message: 'short',
      consent: '',
    });

    assert.equal(response.status, 400);
    const body = await response.text();
    assert.match(body, /does not look like an email address/);
    assert.match(body, /is not one of the available options/);
    assert.match(body, /at least 20 characters/);
    assert.match(body, /must be ticked/);
    assert.equal(enquiries.count(), 0);
  });

  test('errors are specific rather than a generic failure notice', async () => {
    const client = fresh();
    const { token } = await client.csrf('/contact');
    const body = await (
      await client.post('/contact', {
        _csrf: token,
        form_started: humanTimestamp(),
        name: 'Alex Fielding',
        email: 'alex@example.com',
        topic: 'support',
        message: 'tiny',
        consent: 'on',
      })
    ).text();

    assert.match(body, /You entered 4/, 'the error does not say what was actually entered');
    assert.match(body, /id="error-summary"/, 'there is no error summary at the top of the form');
    assert.match(body, /href="#field-message"/, 'the summary does not link to the failing field');
  });

  test('fields outside the schema are discarded, not written', async () => {
    const client = fresh();
    const { token } = await client.csrf('/contact');
    await client.post('/contact', {
      _csrf: token,
      form_started: humanTimestamp(),
      name: 'Alex Fielding',
      email: 'alex@example.com',
      topic: 'support',
      message: 'A perfectly ordinary message that is comfortably over the minimum length for the form.',
      consent: 'on',
      // Mass-assignment attempt.
      role: 'admin',
      id: 'chosen-by-me',
      reference: 'NG-0000-AAAAAA',
    });

    const stored = enquiries.byReference(
      // The reference is generated server-side, so the attacker's cannot exist.
      'NG-0000-AAAAAA',
    );
    assert.equal(stored, undefined, 'a client-supplied reference was accepted');
  });

  test('an oversized body is refused before it is parsed', async () => {
    const client = fresh();
    const response = await fetch(`${origin}/api/coverage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({ domain: 'a'.repeat(100000) }),
    });
    assert.equal(response.status, 413);
    assert.equal((await response.json()).error, 'body_too_large');
  });

  test('an unsupported content type is refused', async () => {
    const client = fresh();
    const response = await fetch(`${origin}/api/coverage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml', Origin: origin },
      body: '<domain>bet365.com</domain>',
    });
    assert.equal(response.status, 415);
    assert.equal((await response.json()).error, 'unsupported_media_type');
  });
});

describe('output escaping', () => {
  test('a script tag submitted through a form never reaches the page as markup', async () => {
    const client = fresh();
    const { token } = await client.csrf('/contact');
    const payload = '<script>window.pwned=1</script>';
    const body = await (
      await client.post('/contact', {
        _csrf: token,
        form_started: humanTimestamp(),
        name: payload,
        email: 'bad',
        topic: 'support',
        message: payload,
        consent: 'on',
      })
    ).text();

    assert.ok(!body.includes('<script>window.pwned'), 'a submitted script tag was rendered as markup');
    assert.ok(body.includes('&lt;script&gt;'), 'the submitted value was not echoed back escaped');
  });

  test('a query string reflected into search results is escaped', async () => {
    const client = fresh();
    const body = await (await client.get('/search?q=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E')).text();
    assert.ok(!body.includes('<img src=x'), 'search reflected raw markup');
    assert.ok(body.includes('&lt;img src=x'), 'the query was not echoed back escaped');
    // No tag in the document may have come from the query: the payload's
    // angle brackets must still be entities wherever it appears.
    const tags = body.match(/<[a-z][^>]*>/gi) || [];
    assert.ok(!tags.some((tag) => /^<img\s+src=x/i.test(tag)), 'the payload became a real tag');
  });

  test('a hostile query is not echoed into the title or meta description', async () => {
    const client = fresh();
    const body = await (await client.get('/search?q=%22%3E%3Cscript%3E')).text();
    const title = body.match(/<title>([^<]*)<\/title>/)[1];
    const description = body.match(/<meta name="description" content="([^"]*)"/)[1];
    assert.equal(title, 'Search | NetGuard', `the title echoed the query: ${title}`);
    assert.ok(!description.includes('script'), 'the description echoed the query');
  });
});

describe('injection payloads', () => {
  test('injection payloads are treated as data everywhere they are accepted', async () => {
    const client = fresh();
    const payloads = [
      "'; DROP TABLE users; --",
      "' OR '1'='1",
      "admin'--",
      "1; DELETE FROM enquiries WHERE 1=1; --",
    ];

    for (const payload of payloads) {
      await client.get(`/search?q=${encodeURIComponent(payload)}`);
      await client.get(`/coverage?domain=${encodeURIComponent(payload)}`);
      const { token } = await client.csrf('/login');
      await client.post('/login', { _csrf: token, form_started: humanTimestamp(), email: payload, password: payload });
    }

    // If any of the above had executed, this would throw or return nothing.
    assert.equal(typeof users.count(), 'number');
    assert.equal(typeof enquiries.count(), 'number');
  });
});

describe('authentication', () => {
  const password = 'correct-battery-staple-2026';

  async function seedUser(email = 'owner@example.com') {
    return users.create({ email, passwordHash: await hashPassword(password), displayName: 'Owner' });
  }

  test('passwords are stored as versioned PBKDF2 hashes, never in the clear', async () => {
    fresh();
    const user = await seedUser();
    const row = users.byId(user.id);
    assert.match(row.password_hash, /^pbkdf2-sha256\$180000\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
    assert.ok(!row.password_hash.includes(password));
  });

  test('a weak password is refused at registration with a reason', async () => {
    const client = fresh();
    const { token } = await client.csrf('/register');
    const body = await (
      await client.post('/register', {
        _csrf: token,
        form_started: humanTimestamp(),
        display_name: 'Weak Person',
        email: 'weak@example.com',
        password: 'password123',
        terms: 'on',
      })
    ).text();

    assert.match(body, /field__error/);
    assert.equal(users.count(), 0, 'a weak password created an account');
  });

  test('sign-in failures do not reveal whether an account exists', async () => {
    const client = fresh();
    await seedUser('real@example.com');

    const known = await client.csrf('/login');
    const a = await client.post('/login', {
      _csrf: known.token,
      form_started: humanTimestamp(),
      email: 'real@example.com',
      password: 'wrong-password-entirely',
    });
    const bodyA = await a.text();

    const unknown = await client.csrf('/login');
    const b = await client.post('/login', {
      _csrf: unknown.token,
      form_started: humanTimestamp(),
      email: 'nobody@example.com',
      password: 'wrong-password-entirely',
    });
    const bodyB = await b.text();

    assert.equal(a.status, b.status, 'the status differs between known and unknown accounts');
    const strip = (html) =>
      html
        .replace(/nonce="[^"]+"/g, '')
        .replace(/value="[^"]{20,}"/g, '')
        .replace(/name="form_started" value="\d+"/g, 'name="form_started"')
        .replace(/real@example\.com|nobody@example\.com/g, 'X');
    assert.equal(strip(bodyA), strip(bodyB), 'the response body reveals whether the account exists');
  });

  test('five failures lock the account for fifteen minutes', async () => {
    const client = fresh();
    await seedUser('locked@example.com');

    let lastBody = '';
    for (let i = 0; i < 6; i++) {
      const { token } = await client.csrf('/login');
      const response = await client.post('/login', {
        _csrf: token,
        form_started: humanTimestamp(),
        email: 'locked@example.com',
        password: `wrong-${i}`,
      });
      lastBody = await response.text();
    }

    assert.match(lastBody, /Too many failed sign-in attempts/);
    assert.match(lastBody, /15 minutes|1[0-5] minutes/);

    // Even the correct password is refused while the lockout is in force.
    const { token } = await client.csrf('/login');
    const response = await client.post('/login', {
      _csrf: token,
      form_started: humanTimestamp(),
      email: 'locked@example.com',
      password,
    });
    assert.equal(response.status, 429);
    assert.ok(!client.cookies.has('ng_session'), 'a session was issued during a lockout');
  });

  test('the session cookie is HttpOnly, SameSite and not readable by script', async () => {
    const client = fresh();
    await seedUser('cookie@example.com');
    const { token } = await client.csrf('/login');
    const response = await client.post('/login', {
      _csrf: token,
      form_started: humanTimestamp(),
      email: 'cookie@example.com',
      password,
    });

    const setCookie = response.headers.getSetCookie().find((c) => c.startsWith('ng_session='));
    assert.ok(setCookie, 'no session cookie was set');
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Lax/);
    assert.match(setCookie, /Path=\//);
    assert.match(setCookie, /Max-Age=43200/);

    const value = setCookie.split(';')[0].split('=')[1];
    assert.ok(value.length >= 32, 'the session identifier is too short to be unguessable');
    assert.ok(!value.includes('cookie@example.com'), 'the session cookie contains the user identity');
  });

  test('signing out destroys the session server-side, not just the cookie', async () => {
    const client = fresh();
    await seedUser('out@example.com');
    const login = await client.csrf('/login');
    await client.post('/login', {
      _csrf: login.token,
      form_started: humanTimestamp(),
      email: 'out@example.com',
      password,
    });

    const stolen = client.cookies.get('ng_session');
    assert.ok(stolen);

    const dashboard = await client.csrf('/dashboard');
    await client.post('/logout', { _csrf: dashboard.token });

    // Replay the captured cookie: the session must be gone from the database.
    const replay = await fetch(`${origin}/dashboard`, {
      redirect: 'manual',
      headers: { Cookie: `ng_session=${stolen}` },
    });
    assert.equal(replay.status, 303, 'a destroyed session still authenticated');
    assert.match(replay.headers.get('location'), /^\/login/);
  });
});

describe('access control', () => {
  const password = 'correct-battery-staple-2026';

  test('a signed-out visitor cannot reach the dashboard', async () => {
    const client = fresh();
    for (const path of ['/dashboard', '/dashboard/profiles', '/dashboard/account', '/dashboard/export.json']) {
      const response = await client.get(path);
      assert.equal(response.status, 303, `${path} was reachable`);
      assert.match(response.headers.get('location'), /^\/login\?next=/);
    }
  });

  test('one account cannot read or change another account\u2019s records', async () => {
    const client = fresh();

    const victim = users.create({ email: 'victim@example.com', passwordHash: await hashPassword(password), displayName: 'Victim' });
    const attacker = users.create({ email: 'attacker@example.com', passwordHash: await hashPassword(password), displayName: 'Attacker' });

    const victimProfile = profiles.create(victim.id, 'Victim home', 'gambling');
    const victimEntry = allowEntries.add(victimProfile.id, victim.id, 'example.com', 'mine');
    assert.ok(victimEntry, 'setup failed: the victim entry was not created');

    const login = await client.csrf('/login');
    await client.post('/login', {
      _csrf: login.token,
      form_started: humanTimestamp(),
      email: 'attacker@example.com',
      password,
    });

    const page = await client.csrf('/dashboard/profiles');
    assert.ok(!page.body.includes('Victim home'), 'the attacker can see another account\u2019s profile');

    // Attempt to change the victim's profile by guessing its id.
    await client.post(`/dashboard/profiles/${victimProfile.id}`, { _csrf: page.token, lists: 'crypto' });
    assert.equal(profiles.ownedBy(victimProfile.id, victim.id).lists, 'gambling', 'the victim\u2019s lists were changed');

    // Attempt to add to the victim's profile.
    await client.post(`/dashboard/profiles/${victimProfile.id}/allow`, {
      _csrf: page.token,
      domain: 'injected.example',
      note: 'not mine',
    });
    const entries = allowEntries.forProfile(victimProfile.id, victim.id);
    assert.equal(entries.length, 1, 'the attacker inserted a row into another account\u2019s profile');

    // Attempt to delete the victim's allowlist entry.
    await client.post(`/dashboard/allow/${victimEntry}/delete`, { _csrf: page.token });
    assert.equal(allowEntries.forProfile(victimProfile.id, victim.id).length, 1, 'the attacker deleted another account\u2019s row');

    // The export must only ever contain the attacker's own, empty data.
    const exported = await (await client.get('/dashboard/export.json')).json();
    assert.equal(exported.account.email, 'attacker@example.com');
    assert.equal(exported.profiles.length, 0);
  });

  test('the next parameter cannot be used as an open redirect', async () => {
    const client = fresh();
    users.create({ email: 'redir@example.com', passwordHash: await hashPassword(password), displayName: 'R' });
    const login = await client.csrf('/login');
    const response = await client.post('/login', {
      _csrf: login.token,
      form_started: humanTimestamp(),
      email: 'redir@example.com',
      password,
      next: 'https://attacker.example/phish',
    });
    assert.equal(response.headers.get('location'), '/dashboard');
  });
});

describe('rate limiting and bot protection', () => {
  test('the API refuses a flood and says when to retry', async () => {
    const client = fresh();
    let limited = null;
    for (let i = 0; i < 70; i++) {
      const response = await client.postJson('/api/coverage', { domain: 'bet365.com', _csrf: 'x' });
      if (response.status === 429) {
        limited = response;
        break;
      }
    }
    assert.ok(limited, 'the API never rate limited a flood of requests');
    assert.ok(Number(limited.headers.get('retry-after')) > 0, 'no Retry-After header');
    assert.equal((await limited.json()).error, 'rate_limited');
  });

  test('the honeypot field silently absorbs an automated submission', async () => {
    const client = fresh();
    const { token } = await client.csrf('/contact');
    const response = await client.post('/contact', {
      _csrf: token,
      form_started: humanTimestamp(),
      name: 'Spam Bot',
      email: 'bot@example.com',
      topic: 'support',
      message: 'Buy cheap things at my website, it is a very good website with many things.',
      consent: 'on',
      website_url: 'https://spam.example',
    });
    assert.equal(response.status, 303, 'the bot was told it failed, giving it a signal to tune against');
    assert.equal(enquiries.count(), 0, 'the honeypot submission was stored');
  });

  test('a form submitted impossibly fast is refused', async () => {
    const client = fresh();
    const { token } = await client.csrf('/contact');
    const response = await client.post('/contact', {
      _csrf: token,
      form_started: String(Date.now()),
      name: 'Fast Bot',
      email: 'fast@example.com',
      topic: 'support',
      message: 'This message was typed in under two milliseconds, which no person can do.',
      consent: 'on',
    });
    assert.equal(response.status, 403);
    assert.equal(enquiries.count(), 0);
  });
});

describe('static file serving', () => {
  test('path traversal is refused', async () => {
    const client = fresh();
    for (const path of [
      '/../package.json',
      '/css/../../package.json',
      '/%2e%2e%2fpackage.json',
      '/..%2f..%2fserver/index.js',
      '/.env',
      '/../.git/config',
    ]) {
      const response = await client.get(path);
      assert.ok(response.status === 404 || response.status === 400, `${path} returned ${response.status}`);
      const body = await response.text();
      assert.ok(!body.includes('"dependencies"'), `${path} served package.json`);
    }
  });

  test('only allowlisted extensions are served', async () => {
    const client = fresh();
    assert.equal((await client.get('/css/main.css')).status, 200);
    assert.equal((await client.get('/js/app.js')).status, 200);
    assert.equal((await client.get('/favicon.ico')).status, 200);
    // No source maps in production output.
    assert.equal((await client.get('/js/app.js.map')).status, 404);
    assert.equal((await client.get('/css/main.css.map')).status, 404);
  });

  test('SVG is served with a restrictive policy of its own', async () => {
    const client = fresh();
    const response = await client.get('/img/logo.svg');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-security-policy'), /sandbox/);
  });

  test('assets revalidate with an ETag', async () => {
    const client = fresh();
    const first = await client.get('/css/main.css');
    const etag = first.headers.get('etag');
    assert.ok(etag);
    const second = await client.get('/css/main.css', { headers: { 'If-None-Match': etag } });
    assert.equal(second.status, 304);
  });
});

describe('privacy defaults', () => {
  test('no cookie is set for a visitor who only reads a page', async () => {
    const response = await fetch(`${origin}/pricing`, { redirect: 'manual' });
    const cookies = response.headers.getSetCookie();
    assert.deepEqual(cookies, [], `an unsolicited cookie was set: ${cookies.join(', ')}`);
  });

  test('page views are not recorded until analytics is accepted', async () => {
    const client = fresh();
    const declined = await client.postJson('/api/pageview', { path: '/' });
    assert.equal(declined.status, 204);

    const { analytics } = await import('../server/db/index.js');
    assert.equal(analytics.totals(1).views, 0, 'a page view was recorded without consent');

    client.cookies.set('ng_analytics', 'accept');
    await client.postJson('/api/pageview', { path: '/pricing', utm_source: 'test' });
    assert.equal(analytics.totals(1).views, 1, 'an accepted page view was not recorded');
  });
});
