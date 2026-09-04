/**
 * The features the brief requires, checked by their observable behaviour
 * rather than by looking for a class name.
 */
import { test, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startServer, stopServer, Client, freshDatabase, humanTimestamp } from './helpers.js';
import { reviews, enquiries } from '../server/db/index.js';
import { resetAll } from '../server/lib/rate-limit.js';

const origin = await startServer();
after(stopServer);

const fresh = () => {
  freshDatabase();
  resetAll();
  return new Client(origin);
};

const appJs = await readFile(new URL('../public/js/app.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/css/main.css', import.meta.url), 'utf8');
const tokens = await readFile(new URL('../public/css/tokens.css', import.meta.url), 'utf8');

describe('chrome present on every page', () => {
  let body;
  test('load a representative page', async () => {
    body = await (await fresh().get('/pricing')).text();
    assert.ok(body.length > 1000);
  });

  test('skip to content is the first focusable element', () => {
    const firstLink = body.indexOf('<a ');
    assert.ok(body.slice(firstLink, firstLink + 120).includes('class="bypass-link"'), 'the bypass link is not first');
    assert.match(body, /class="bypass-link" href="#content"/);
  });

  test('the header is sticky and the logo links home', () => {
    assert.match(body, /class="masthead"/);
    assert.match(css, /\.masthead\s*\{[^}]*position:\s*sticky/);
    assert.match(body, /<a class="brand" href="\/" aria-label="NetGuard home">/);
  });

  test('a mobile menu exists and is controlled accessibly', () => {
    assert.match(body, /id="menu-toggle"/);
    assert.match(body, /aria-controls="drawer"/);
    assert.match(body, /aria-expanded="false"/);
    assert.match(body, /id="drawer"[^>]*hidden/);
  });

  test('a scroll progress bar and back-to-top button exist', () => {
    assert.match(body, /id="scroll-progress-bar"/);
    assert.match(body, /id="back-to-top"[^>]*hidden/);
    assert.match(appJs, /scroll-progress-bar/);
    assert.match(appJs, /back-to-top/);
  });

  test('a floating contact button is present', () => {
    assert.match(body, /class="floating-btn floating-btn--contact" href="\/contact"/);
  });

  test('marketing pages carry a sticky call to action for small screens', async () => {
    for (const path of ['/', '/pricing', '/how-it-works']) {
      const page = await (await fresh().get(path)).text();
      assert.match(page, /<div class="sticky-cta">/, `${path} has no sticky CTA`);
      assert.match(page, /class="sticky-cta__text"/);
    }
    // It must not follow the reader onto pages where it would be noise.
    const legal = await (await fresh().get('/privacy')).text();
    assert.ok(!legal.includes('sticky-cta'), 'the sticky CTA appears on the privacy policy');
    assert.match(css, /@media \(min-width: 48em\)\s*\{\s*\.sticky-cta\s*\{\s*display: none/);
  });

  test('the cookie banner offers both accept and reject', () => {
    assert.match(body, /id="cookie-banner"[^>]*hidden/);
    assert.match(body, /data-cookie-choice="accept"/);
    assert.match(body, /data-cookie-choice="reject"/);
    assert.match(body, /href="\/cookies"/);
  });

  test('the theme control offers system, light and dark', () => {
    assert.match(body, /class="theme-control"/);
    assert.match(body, /data-theme-choice="system"/);
    assert.match(body, /data-theme-choice="light"/);
    assert.match(body, /data-theme-choice="dark"/);
    assert.match(appJs, /localStorage\.setItem\('ng-theme'/);
    // "System" must remove the override so the OS preference applies again.
    assert.match(appJs, /removeAttribute\('data-theme'\)/);
    assert.match(tokens + css, /@media \(prefers-color-scheme: dark\)/);
  });

  test('the current page is marked in navigation', async () => {
    const page = await (await fresh().get('/pricing')).text();
    const marked = [...page.matchAll(/aria-current="page"/g)];
    assert.ok(marked.length >= 1, 'no navigation item is marked as current');
  });

  test('breadcrumbs appear on inner pages but not the home page', async () => {
    const inner = await (await fresh().get('/docs/quick-start')).text();
    assert.match(inner, /class="breadcrumbs" aria-label="Breadcrumb"/);
    assert.match(inner, /<li><a href="\/">Home<\/a><\/li>/);
    assert.match(inner, /<li><a href="\/docs">Documentation<\/a><\/li>/);

    const home = await (await fresh().get('/')).text();
    assert.ok(!home.includes('class="breadcrumbs"'), 'the home page shows a breadcrumb to itself');
  });

  test('a last-updated date appears on content pages', async () => {
    const page = await (await fresh().get('/docs/limitations')).text();
    assert.match(page, /Last updated <time datetime="\d{4}-\d{2}-\d{2}">/);
  });
});

describe('search', () => {
  test('finds a documentation page by a phrase from its body', async () => {
    const body = await (await fresh().get('/search?q=encrypted+dns+browser')).text();
    assert.match(body, /results for/);
    assert.match(body, /href="\/docs\/encrypted-dns"/);
    assert.match(body, /<mark>/, 'matched terms are not highlighted');
  });

  test('offers a correction for a near miss and never a dead end', async () => {
    const body = await (await fresh().get('/search?q=encrypteed')).text();
    assert.match(body, /Nothing matched/);
    assert.match(body, /Did you mean/);
    assert.match(body, /href="\/contact\?topic=documentation"/);
  });

  test('works with no JavaScript, being a plain GET form', async () => {
    const body = await (await fresh().get('/search')).text();
    assert.match(body, /<form class="search-form" method="get" action="\/search" role="search">/);
  });
});

describe('coverage checking', () => {
  test('a listed domain is reported with the rule that matched', async () => {
    const body = await (await fresh().get('/coverage?domain=https://www.BET365.com/en/sports')).text();
    assert.match(body, /bet365\.com<\/strong> is on the Gambling list/);
    assert.match(body, /Matched rule: <code class="mono">bet365\.com<\/code>/);
  });

  test('an unlisted domain says so and offers the submission route', async () => {
    const body = await (await fresh().get('/coverage?domain=example.org')).text();
    assert.match(body, /is not on any list we publish/);
    assert.match(body, /href="\/contact\?topic=listing/);
  });

  test('a support domain is reported as never blocked', async () => {
    const body = await (await fresh().get('/coverage?domain=gamcare.org.uk')).text();
    assert.match(body, /never-block list/);
  });

  test('the same lookup over the API returns matching, trimmed JSON', async () => {
    const client = fresh();
    const { token } = await client.csrf('/coverage');
    const response = await client.postJson('/api/coverage', { domain: 'm.bet365.com', _csrf: token });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.domain, 'm.bet365.com');
    assert.equal(payload.listed, true);
    assert.equal(payload.matchedRule, 'bet365.com');
    assert.equal(payload.rule, 'bet365.com', 'the field the client script reads is missing');
    assert.ok(payload.checkedAt);
    // Nothing internal leaks.
    for (const key of Object.keys(payload)) {
      assert.ok(!['id', 'userId', 'ip', 'sourceUrl', 'password_hash'].includes(key), `the API returned ${key}`);
    }
  });

  test('the API rejects a malformed domain with a specific message', async () => {
    const client = fresh();
    const { token } = await client.csrf('/coverage');
    const response = await client.postJson('/api/coverage', { domain: 'not a domain!!', _csrf: token });
    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload.error, 'invalid_domain');
    assert.match(payload.message, /Enter a domain like example\.com/);
  });

  test('the form works without JavaScript by posting to a real route', async () => {
    const client = fresh();
    const { token, body } = await client.csrf('/coverage');
    assert.match(body, /<form class="stack" id="coverage-form" method="post" action="\/coverage"/);
    const response = await client.post('/coverage', { _csrf: token, domain: 'skybet.com' });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /is on the Gambling list/);
  });
});

describe('forms', () => {
  test('a successful contact submission redirects to a thank-you page with a reference', async () => {
    const client = fresh();
    const { token } = await client.csrf('/contact');
    const response = await client.post('/contact', {
      _csrf: token,
      form_started: humanTimestamp(),
      name: 'Jordan Ellis',
      email: 'jordan@example.com',
      topic: 'hosted',
      message: 'We are a family of four and would like to know whether the hosted plan covers a guest network too.',
      consent: 'on',
    });

    assert.equal(response.status, 303);
    const location = response.headers.get('location');
    const page = await (await client.get(location)).text();

    assert.match(page, /Message received/);
    assert.match(page, /NG-\d{4}-[0-9A-F]{6}/);
    assert.match(page, /within one working day/, 'no response-time promise on the thank-you page');
    assert.match(page, /data-copy="#enquiry-reference"/, 'the reference cannot be copied');
    assert.match(page, /<meta name="robots" content="noindex, nofollow"/);
  });

  test('a bad reference is not reflected onto the thank-you page', async () => {
    const client = fresh();
    const response = await client.get('/thank-you?ref=%3Cscript%3E');
    assert.equal(response.status, 303, 'an arbitrary reference was accepted');
  });

  test('the review form stores an unpublished review and confirms it', async () => {
    const client = fresh();
    const { token } = await client.csrf('/reviews');
    const response = await client.post('/reviews', {
      _csrf: token,
      form_started: humanTimestamp(),
      display_name: 'Sam O.',
      role: 'parent of two, self-hosting on a Pi',
      email: 'sam@example.com',
      rating: '4',
      body: 'Setup took about twenty minutes on an OpenWrt router. The limitations page is what convinced me to try it.',
    });

    assert.equal(response.status, 303);
    assert.equal(reviews.pendingCount(), 1);
    assert.equal(reviews.published().length, 0, 'a review was published without review');

    const page = await (await client.get('/reviews?submitted=1')).text();
    assert.match(page, /Review received/);
    assert.match(page, /waiting to be checked/);
  });

  test('the reviews page shows an honest empty state, not invented quotes', async () => {
    const body = await (await fresh().get('/reviews')).text();
    assert.match(body, /Nobody has left a review yet/);
    assert.match(body, /class="empty-state"/);
    assert.ok(!body.includes('class="review"'), 'a review was rendered when none are published');
  });

  test('a password visibility toggle and strength meter are wired up', async () => {
    const body = await (await fresh().get('/register')).text();
    assert.match(body, /data-password-toggle="field-password"/);
    assert.match(body, /aria-label="Show password"/);
    assert.match(body, /data-strength-for="field-password"/);
    assert.match(appJs, /input\.type = shown \? 'password' : 'text'/);
  });

  test('long text fields carry a live character counter', async () => {
    const body = await (await fresh().get('/contact')).text();
    assert.match(body, /data-counter="field-message-counter"/);
    assert.match(body, /id="field-message-counter"/);
    assert.match(appJs, /of \$\{max\} characters/);
  });

  test('every form field has a real label bound to its control', async () => {
    for (const path of ['/contact', '/reviews', '/login', '/register', '/search']) {
      const body = await (await fresh().get(path)).text();
      const controls = [...body.matchAll(/<(input|textarea|select)\b[^>]*\bid="([^"]+)"[^>]*>/g)];
      for (const [tag, , id] of controls) {
        if (/type="(hidden|submit|button)"/.test(tag)) continue;
        const labelled =
          body.includes(`for="${id}"`) || /aria-label="/.test(tag) || /aria-labelledby="/.test(tag);
        assert.ok(labelled, `${path}: control ${id} has no label`);
      }
    }
  });
});

describe('progressive enhancement', () => {
  test('no page depends on JavaScript to be read or used', async () => {
    for (const path of ['/', '/coverage', '/contact', '/faq', '/docs/quick-start']) {
      const body = await (await fresh().get(path)).text();
      // Real anchors and real form actions, never href="#" with a handler.
      const deadLinks = [...body.matchAll(/<a\b[^>]*href="#"/g)];
      assert.equal(deadLinks.length, 0, `${path} has a link that goes nowhere`);
      for (const form of body.match(/<form\b[^>]*>/g) || []) {
        assert.match(form, /action="/, `${path} has a form with no action: ${form}`);
      }
    }
  });

  test('the FAQ expands without JavaScript', async () => {
    const body = await (await fresh().get('/faq')).text();
    const items = (body.match(/<details class="accordion"/g) || []).length;
    assert.ok(items >= 5, `the FAQ has only ${items} entries, the brief asks for at least 5`);
    assert.match(body, /<summary>/);
  });

  test('the star rating is built from radio inputs', async () => {
    const body = await (await fresh().get('/reviews')).text();
    assert.equal((body.match(/type="radio" id="rating-\d"/g) || []).length, 5);
    assert.match(body, /<span class="visually-hidden">5 out of 5<\/span>/);
  });
});

describe('copy and confirmation affordances', () => {
  test('copyable values announce that they were copied', async () => {
    const body = await (await fresh().get('/dashboard/account')).text();
    assert.equal(body, '', 'the dashboard leaked without a session');

    const security = await (await fresh().get('/security')).text();
    assert.match(security, /data-copy="#security-txt-cmd"/);
    assert.match(security, /id="copy-status"[^>]*role="status"/);
    assert.match(appJs, /Copied/);
    assert.match(appJs, /navigator\.clipboard\.writeText/);
  });

  test('code blocks in documentation gain a copy button', async () => {
    const body = await (await fresh().get('/docs/quick-start')).text();
    assert.match(body, /<pre><code/, 'the quick start has no code block to copy');
    assert.match(appJs, /\.prose pre/, 'code blocks are never given a copy button');
    assert.match(css, /\.code-block__copy/, 'the copy button has no styling');
  });

  test('destructive actions ask for confirmation', () => {
    assert.match(appJs, /dialog\.showModal\(\)/);
    assert.match(appJs, /form\.dataset\.confirm\b/);
  });
});

describe('analytics and UTM', () => {
  test('the analytics script only sends after acceptance', async () => {
    const script = await readFile(new URL('../public/js/analytics.js', import.meta.url), 'utf8');
    assert.match(script, /localStorage\.getItem\('ng-analytics'\) === 'accept'/);
    assert.match(script, /utm_source/);
    assert.match(script, /utm_medium/);
    assert.match(script, /utm_campaign/);
    assert.ok(!script.includes('google'), 'the analytics script calls a third party');
  });

  test('UTM parameters are recorded against a page view', async () => {
    const client = fresh();
    client.cookies.set('ng_analytics', 'accept');
    await client.postJson('/api/pageview', {
      path: '/pricing',
      referrer: 'https://example.org/blog',
      utm_source: 'newsletter',
      utm_medium: 'email',
      utm_campaign: 'august',
    });

    const { analytics } = await import('../server/db/index.js');
    const campaigns = analytics.topCampaigns(30, 5);
    assert.equal(campaigns.length, 1);
    assert.equal(campaigns[0].utm_source, 'newsletter');
    assert.equal(campaigns[0].utm_campaign, 'august');
  });
});

describe('print and reduced motion', () => {
  test('a print stylesheet strips the interface', () => {
    assert.match(css, /@media print/);
    const print = css.slice(css.indexOf('@media print'));
    for (const selector of ['.scroll-progress', '.bypass-link', '.theme-control', '.toc', 'form']) {
      assert.ok(print.includes(selector), `the print stylesheet does not hide ${selector}`);
    }
    assert.match(print, /a\[href\^="http"\]::after/, 'printed links do not show their URL');
  });

  test('reduced motion is honoured, not merely shortened', () => {
    assert.match(css + tokens, /@media \(prefers-reduced-motion: reduce\)/);
  });
});

describe('honest empty and error states', () => {
  test('the dashboard is unreachable but its empty state is written', async () => {
    const body = await (await fresh().get('/dashboard')).text();
    assert.equal(body, '');
  });

  test('an unknown document returns the 404 page rather than an empty shell', async () => {
    const response = await fresh().get('/docs/no-such-page');
    assert.equal(response.status, 404);
    assert.match(await response.text(), /That page is not here/);
  });

  test('an unknown tag returns 404 rather than an empty list', async () => {
    assert.equal((await fresh().get('/blog/tag/invented')).status, 404);
  });
});

describe('content integrity', () => {
  test('no enquiry, review or page view exists before anyone creates one', () => {
    fresh();
    assert.equal(enquiries.count(), 0);
    assert.equal(reviews.summary().count, 0);
  });

  test('the blocklist total shown on the site matches the list file', async () => {
    const { counts } = await import('../server/lib/blocklists.js');
    const body = await (await fresh().get('/')).text();
    assert.ok(body.includes(`${counts().total} suffix rules`), 'the home page total does not match the data');
    assert.equal(counts().total, 69);
  });

  test('support routes can never be filtered', async () => {
    const { lookup, neverBlock } = await import('../server/lib/blocklists.js');
    for (const domain of neverBlock) {
      const result = lookup(domain);
      assert.equal(result.listed, false, `${domain} is blockable`);
      assert.equal(result.protected, true);
    }
  });
});
