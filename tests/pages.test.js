/**
 * Every page renders, and each one carries the things a page must never be
 * missing: a unique title, a real description, one h1, a canonical URL and a
 * working footer.
 */
import { test, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, stopServer, Client } from './helpers.js';

const origin = await startServer();
const client = new Client(origin);

after(stopServer);

const PAGES = [
  '/',
  '/how-it-works',
  '/coverage',
  '/pricing',
  '/docs',
  '/docs/quick-start',
  '/docs/router-setup',
  '/docs/limitations',
  '/docs/encrypted-dns',
  '/docs/troubleshooting',
  '/docs/api',
  '/docs/self-hosting',
  '/blog',
  '/blog/why-blocklist-counts-are-meaningless',
  '/blog/dns-over-https-broke-our-assumptions',
  '/blog/no-query-logs-by-default',
  '/blog/what-we-got-wrong-about-nxdomain',
  '/blog/tag/dns',
  '/about',
  '/case-study',
  '/content-policy',
  '/accessibility',
  '/security',
  '/contact',
  '/reviews',
  '/search',
  '/faq',
  '/help',
  '/status',
  '/changelog',
  '/sitemap',
  '/privacy',
  '/cookies',
  '/terms',
  '/login',
  '/register',
];

const bodies = new Map();

describe('every page', () => {
  for (const path of PAGES) {
    test(`${path} renders a complete document`, async () => {
      const response = await client.get(path);
      assert.equal(response.status, 200, `${path} returned ${response.status}`);
      assert.match(response.headers.get('content-type'), /text\/html/);

      const body = await response.text();
      bodies.set(path, body);

      assert.match(body, /^<!doctype html>/i, `${path} has no doctype`);
      assert.match(body, /<html lang="en-GB"/, `${path} has no language`);

      const h1s = body.match(/<h1[\s>]/g) || [];
      assert.equal(h1s.length, 1, `${path} has ${h1s.length} h1 elements, expected exactly 1`);

      assert.match(body, /<link rel="canonical" href="https:\/\//, `${path} has no canonical URL`);
      assert.match(body, /class="skip-link"/, `${path} has no skip link`);
      assert.match(body, /<footer class="site-footer">/, `${path} has no footer`);
      assert.match(body, /id="main"/, `${path} has no main landmark`);
      assert.match(body, /<meta name="viewport"/, `${path} has no viewport meta`);
    });
  }
});

describe('metadata', () => {
  test('every page title is unique and reasonably short', () => {
    const seen = new Map();
    for (const [path, body] of bodies) {
      const title = body.match(/<title>([^<]+)<\/title>/)?.[1];
      assert.ok(title, `${path} has no title`);
      assert.ok(title.length <= 75, `${path} title is ${title.length} characters: ${title}`);
      assert.ok(!seen.has(title), `${path} shares a title with ${seen.get(title)}`);
      seen.set(title, path);
    }
  });

  test('every page has a unique, substantial meta description', () => {
    const seen = new Map();
    for (const [path, body] of bodies) {
      const description = body.match(/<meta name="description" content="([^"]+)"/)?.[1];
      assert.ok(description, `${path} has no meta description`);
      assert.ok(description.length >= 70, `${path} description is only ${description.length} characters`);
      assert.ok(description.length <= 320, `${path} description is ${description.length} characters`);
      assert.ok(!seen.has(description), `${path} shares a description with ${seen.get(description)}`);
      seen.set(description, path);
    }
  });

  test('every page has social card tags pointing at a real image', () => {
    for (const [path, body] of bodies) {
      assert.match(body, /<meta property="og:title"/, `${path} has no og:title`);
      assert.match(body, /<meta property="og:image" content="[^"]+\/img\/social-card\.png"/, `${path} has no og:image`);
      assert.match(body, /<meta property="og:image:alt"/, `${path} has no og:image:alt`);
      assert.match(body, /<meta name="twitter:card" content="summary_large_image"/, `${path} has no twitter card`);
    }
  });
});

describe('honesty rules', () => {
  test('no em dashes anywhere in rendered copy', () => {
    for (const [path, body] of bodies) {
      assert.ok(!body.includes('\u2014'), `${path} contains an em dash`);
    }
  });

  test('no emoji anywhere in rendered copy', () => {
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
    for (const [path, body] of bodies) {
      assert.ok(!emoji.test(body), `${path} contains an emoji`);
    }
  });

  test('no photographs of people are served', () => {
    for (const [path, body] of bodies) {
      const images = [...body.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]);
      for (const src of images) {
        assert.ok(!/unsplash|pexels|placeholder|avatar\.|face|portrait|headshot/i.test(src), `${path} loads ${src}`);
      }
    }
  });

  test('every image has alternative text', () => {
    for (const [path, body] of bodies) {
      for (const tag of body.match(/<img[^>]*>/g) || []) {
        assert.match(tag, /\salt="/, `${path} has an image with no alt attribute: ${tag}`);
        const alt = tag.match(/\salt="([^"]*)"/)?.[1];
        assert.ok(alt && alt.length > 15, `${path} has a thin alt attribute: ${tag}`);
      }
    }
  });

  test('no placeholder text survived into any page', () => {
    for (const [path, body] of bodies) {
      for (const word of ['Lorem ipsum', 'TODO', 'FIXME', 'Coming soon', 'Your text here', 'Sarah Chen']) {
        assert.ok(!body.includes(word), `${path} contains placeholder text: ${word}`);
      }
    }
  });

  test('every statistic on the home page prints its source', () => {
    const body = bodies.get('/');
    const values = (body.match(/class="stat__value">([^<]+)</g) || []).length;
    const sources = (body.match(/class="stat__source"/g) || []).length;
    assert.ok(values > 0, 'the home page shows no statistics at all');
    assert.equal(sources, values, 'a statistic is missing its citation');
    assert.match(body, /gamblingcommission\.gov\.uk/, 'the citation does not link to the publisher');
  });

  test('the footer carries the current year and a working support link', () => {
    const year = new Date().getFullYear();
    for (const [path, body] of bodies) {
      assert.ok(body.includes(`&copy; ${year}`), `${path} footer does not show ${year}`);
      assert.match(body, /href="\/help"/, `${path} footer has no support link`);
    }
  });

  test('every page links to at least three other internal pages', () => {
    for (const [path, body] of bodies) {
      const hrefs = new Set([...body.matchAll(/href="(\/[^"#?]*)/g)].map((m) => m[1]));
      hrefs.delete(path);
      assert.ok(hrefs.size >= 3, `${path} links to only ${hrefs.size} internal pages`);
    }
  });

  test('contact details are click-to-act', () => {
    const body = bodies.get('/contact');
    assert.match(body, /href="tel:\+44/, 'no tel: link on the contact page');
    assert.match(body, /href="mailto:[^"]+@/, 'no mailto: link on the contact page');
    assert.match(body, /href="tel:08088020133"/, 'the helpline number is not dialable');
  });
});

describe('the 404 page', () => {
  test('is a real page, not a bare status line', async () => {
    const response = await client.get('/this-does-not-exist');
    assert.equal(response.status, 404);
    const body = await response.text();
    assert.match(body, /Error 404/);
    assert.match(body, /<form[^>]+action="\/search"/, 'the 404 page offers no search');
    assert.match(body, /site-footer/, 'the 404 page has no footer');
    assert.match(body, /<meta name="robots" content="noindex, follow"/);
  });

  test('reflects the requested path without allowing markup through', async () => {
    const response = await client.get('/%3Cscript%3Ealert(1)%3C/script%3E');
    const body = await response.text();
    assert.equal(response.status, 404);
    assert.ok(!body.includes('<script>alert(1)'), 'the 404 page reflected raw markup');
  });
});

describe('machine-readable endpoints', () => {
  test('robots.txt points at the sitemap and protects private paths', async () => {
    const body = await (await client.get('/robots.txt')).text();
    assert.match(body, /Sitemap: https:\/\/[^\s]+\/sitemap\.xml/);
    assert.match(body, /Disallow: \/dashboard/);
    assert.match(body, /User-agent: \*/);
  });

  test('sitemap.xml lists every public page exactly once', async () => {
    const body = await (await client.get('/sitemap.xml')).text();
    const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    assert.equal(new Set(locs).size, locs.length, 'the sitemap contains duplicates');
    for (const path of ['/', '/pricing', '/docs/quick-start', '/blog/no-query-logs-by-default', '/help']) {
      assert.ok(locs.some((loc) => loc.endsWith(path)), `the sitemap is missing ${path}`);
    }
    for (const path of ['/dashboard', '/login', '/thank-you']) {
      assert.ok(!locs.some((loc) => loc.endsWith(path)), `the sitemap should not list ${path}`);
    }
  });

  test('the RSS feed is well-formed and carries every note', async () => {
    const response = await client.get('/blog/feed.xml');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /application\/rss\+xml/);
    const body = await response.text();
    assert.equal((body.match(/<item>/g) || []).length, 4);
    assert.match(body, /<atom:link[^>]+rel="self"/);
  });

  test('the manifest and opensearch descriptions parse', async () => {
    const manifest = await (await client.get('/site.webmanifest')).json();
    assert.equal(manifest.start_url, '/');
    assert.ok(manifest.icons.length >= 2);

    const opensearch = await (await client.get('/opensearch.xml')).text();
    assert.match(opensearch, /<Url type="text\/html"[^>]+searchTerms/);
  });

  test('security.txt has a contact and a future expiry', async () => {
    const body = await (await client.get('/.well-known/security.txt')).text();
    assert.match(body, /^Contact: mailto:/m);
    const expires = new Date(body.match(/^Expires: (.+)$/m)[1]);
    assert.ok(expires > new Date(), 'security.txt has already expired');
  });
});
