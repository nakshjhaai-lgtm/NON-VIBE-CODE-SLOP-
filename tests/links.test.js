/**
 * Crawls the site the way a visitor or a search engine would, and refuses to
 * let a dead link, a dead anchor or an unreachable page exist.
 */
import { test, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { startServer, stopServer } from './helpers.js';

const origin = await startServer();
after(stopServer);

/** Breadth-first crawl of every same-origin link reachable from the home page. */
async function crawl() {
  const status = new Map();
  const idsByPath = new Map();
  const anchorRefs = [];
  const linkSources = new Map();
  const queue = ['/'];

  while (queue.length) {
    const path = queue.shift();
    if (status.has(path)) continue;

    const response = await fetch(origin + path, { redirect: 'manual' });
    status.set(path, response.status);
    if (response.status !== 200) continue;
    if (!(response.headers.get('content-type') || '').includes('text/html')) continue;

    const body = await response.text();
    idsByPath.set(path, new Set([...body.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));

    for (const [, href] of body.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
      const [beforeHash, hash] = href.split('#');
      const target = beforeHash.split('?')[0] || path;
      if (hash) anchorRefs.push({ from: path, target, hash });
      if (!linkSources.has(target)) linkSources.set(target, path);
      if (!status.has(target) && !queue.includes(target)) queue.push(target);
    }
  }

  return { status, idsByPath, anchorRefs, linkSources };
}

const site = await crawl();

const css = await readFile(new URL('../public/css/main.css', import.meta.url), 'utf8');
const tokens = await readFile(new URL('../public/css/tokens.css', import.meta.url), 'utf8');
const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');

describe('link integrity', () => {
  test('the crawl reaches the whole site', () => {
    assert.ok(site.status.size >= 45, `only ${site.status.size} URLs were reachable from the home page`);
  });

  test('no link on the site is broken', () => {
    const broken = [...site.status]
      .filter(([, code]) => code >= 400)
      .map(([path, code]) => `${path} (${code}, linked from ${site.linkSources.get(path)})`);
    assert.deepEqual(broken, []);
  });

  test('no link points at a redirect chain a visitor can see', () => {
    // Redirects are fine as destinations of a form post, but a link in the
    // page should go straight to the final URL.
    const redirects = [...site.status]
      .filter(([path, code]) => code >= 300 && code < 400 && !['/thank-you', '/dashboard'].includes(path))
      .map(([path, code]) => `${path} (${code})`);
    assert.deepEqual(redirects, []);
  });

  test('every in-page anchor resolves to a real element', () => {
    const dead = new Set();
    for (const { from, target, hash } of site.anchorRefs) {
      const ids = site.idsByPath.get(target);
      if (!ids) continue;
      if (!ids.has(hash)) dead.add(`${from} links to ${target}#${hash}, which does not exist`);
    }
    assert.deepEqual([...dead], []);
  });

  test('every page in the sitemap is reachable and returns 200', async () => {
    const xml = await (await fetch(`${origin}/sitemap.xml`)).text();
    for (const [, loc] of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const path = new URL(loc).pathname;
      const response = await fetch(origin + path, { redirect: 'manual' });
      assert.equal(response.status, 200, `${path} is in the sitemap but returns ${response.status}`);
    }
  });

  test('every documentation page is linked from the documentation index', async () => {
    const index = await (await fetch(`${origin}/docs`)).text();
    const { allDocs } = await import('../server/lib/content.js');
    for (const doc of allDocs()) {
      assert.ok(index.includes(`href="/docs/${doc.slug}"`), `/docs/${doc.slug} is orphaned`);
    }
  });

  test('every footer link resolves', async () => {
    const { footerNav } = await import('../server/lib/site.js');
    for (const group of footerNav) {
      for (const link of group.links) {
        const path = link.href.split('#')[0];
        const response = await fetch(origin + path, { redirect: 'manual' });
        assert.equal(response.status, 200, `footer link ${link.href} returns ${response.status}`);
      }
    }
  });

  test('every primary navigation link resolves', async () => {
    const { primaryNav } = await import('../server/lib/site.js');
    for (const item of primaryNav) {
      const response = await fetch(origin + item.href, { redirect: 'manual' });
      assert.equal(response.status, 200, `nav link ${item.href} returns ${response.status}`);
    }
  });

  test('every static asset referenced by a page exists', async () => {
    const assets = new Set();
    for (const path of site.idsByPath.keys()) {
      const body = await (await fetch(origin + path)).text();
      for (const [, href] of body.matchAll(/(?:href|src)="(\/(?:css|js|img|fonts)\/[^"]+)"/g)) {
        assets.add(href.split('?')[0]);
      }
    }
    assert.ok(assets.size >= 4, 'no assets were found to check');
    for (const asset of assets) {
      const response = await fetch(origin + asset);
      assert.equal(response.status, 200, `${asset} is referenced but returns ${response.status}`);
    }
  });
});

describe('transfer size', () => {
  // fetch() transparently decompresses and rewrites Accept-Encoding, so it
  // cannot measure what actually crosses the wire. These use raw HTTP.
  const raw = (path, encoding) =>
    new Promise((resolve, reject) => {
      const url = new URL(origin + path);
      const req = httpRequest(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          headers: encoding === null ? {} : { 'Accept-Encoding': encoding },
        },
        (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () =>
            resolve({ status: res.statusCode, headers: res.headers, bytes: Buffer.concat(chunks).length, body: Buffer.concat(chunks) }),
          );
        },
      );
      req.on('error', reject);
      req.end();
    });

  test('text responses are compressed when the client accepts it', async () => {
    for (const path of ['/', '/docs/api', '/css/main.css', '/js/app.js']) {
      const compressed = await raw(path, 'br');
      const plain = await raw(path, null);
      assert.equal(compressed.headers['content-encoding'], 'br', `${path} was not compressed`);
      assert.match(compressed.headers.vary || '', /Accept-Encoding/, `${path} has no Vary header`);
      assert.ok(
        compressed.bytes < plain.bytes * 0.5,
        `${path} only shrank from ${plain.bytes} to ${compressed.bytes} bytes`,
      );
    }
  });

  test('gzip is used when brotli is not available', async () => {
    const response = await raw('/', 'gzip');
    assert.equal(response.headers['content-encoding'], 'gzip');
  });

  test('a client that accepts nothing still gets a readable response', async () => {
    const response = await raw('/', null);
    assert.equal(response.headers['content-encoding'], undefined);
    assert.match(response.body.toString('utf8'), /<!doctype html>/i);
  });

  test('already-compressed formats are not compressed again', async () => {
    for (const path of ['/fonts/ibm-plex-sans-400.woff2', '/img/social-card.png', '/favicon.ico']) {
      const response = await raw(path, 'br, gzip');
      assert.equal(response.headers['content-encoding'], undefined, `${path} was needlessly re-compressed`);
    }
  });

  test('the home page is small enough to arrive in a couple of round trips', async () => {
    const { bytes } = await raw('/', 'br');
    assert.ok(bytes < 25 * 1024, `the home page is ${(bytes / 1024).toFixed(1)} KB over the wire`);
  });

  test('the whole critical path is modest', async () => {
    let total = 0;
    for (const path of [
      '/',
      '/css/tokens.css',
      '/css/main.css',
      '/js/app.js',
      '/fonts/ibm-plex-sans-400.woff2',
      '/fonts/ibm-plex-sans-600.woff2',
    ]) {
      total += (await raw(path, 'br')).bytes;
    }
    assert.ok(total < 120 * 1024, `the first view transfers ${(total / 1024).toFixed(1)} KB`);
  });
});

describe('responsive safety', () => {
  test('nothing can force horizontal scrolling', () => {
    // Fixed widths wider than the narrowest supported viewport are the usual
    // cause. 320px is the floor the brief implies by asking for 375px to work.
    const offenders = [];
    for (const [, value] of rules.matchAll(/(?<!max-|min-)\bwidth:\s*(\d+)px/g)) {
      if (Number(value) > 320) offenders.push(`${value}px`);
    }
    assert.deepEqual(offenders, [], `fixed widths wider than 320px: ${offenders.join(', ')}`);
    assert.match(rules, /overflow-x:\s*(?:auto|hidden)/, 'no scroll container is defined for wide content');
  });

  test('wide content is placed in a scroll container rather than overflowing', () => {
    for (const selector of ['.table-wrap', 'pre']) {
      const block = rules.slice(rules.indexOf(`${selector} {`));
      assert.match(block.slice(0, 300), /overflow-x:\s*auto/, `${selector} can overflow the page`);
    }
  });

  test('the page itself cannot scroll sideways', () => {
    // The root carries the final guard. It is on html, not body, so that
    // position: sticky on the header keeps working.
    const html = rules.slice(rules.indexOf('html {'), rules.indexOf('body {'));
    assert.match(html, /overflow-x:\s*hidden/, 'the root has no horizontal overflow guard');
  });

  test('no grid track can be forced open by its content', () => {
    // A bare `1fr` is `minmax(auto, 1fr)`: the track cannot shrink below its
    // content, so one long token or a wide table drags the page sideways.
    // Every flexible track must be floored with minmax(0, ...).
    const offenders = [];
    for (const [, value] of rules.matchAll(/grid-template-columns:\s*([^;]+);/g)) {
      const bare = value.match(/(?:^|[\s(,])(\d*\.?\d+)fr/g);
      if (bare && !/minmax\(\s*0/.test(value)) offenders.push(value.trim());
      else if (bare) {
        // Mixed track lists: every fr must sit inside a minmax(0, ...).
        const floored = (value.match(/minmax\(\s*0[^)]*fr\s*\)/g) || []).length;
        if (floored < bare.length) offenders.push(value.trim());
      }
    }
    assert.deepEqual(offenders, [], `unfloored fr tracks: ${offenders.join(' | ')}`);
  });

  test('flex items that hold wide content can shrink', () => {
    // A flex item's automatic minimum size is its content. Anything holding
    // a URL, token or <code> needs an explicit min-width: 0.
    for (const selector of ['.input-group .field__control', '.copyable code']) {
      const block = rules.slice(rules.indexOf(`${selector} {`));
      assert.match(block.slice(0, 200), /min-width:\s*0/, `${selector} cannot shrink below its content`);
    }
  });

  test('images and media are constrained to their container', () => {
    assert.match(rules, /img[^{]*\{[^}]*max-width:\s*100%/s);
  });

  test('long words and URLs cannot push the layout wide', () => {
    assert.match(rules, /overflow-wrap:\s*(?:break-word|anywhere)/);
  });

  test('the breakpoints the brief names are all handled', () => {
    // 375, 768 and 1280 must each land inside a defined range.
    const breakpoints = [...(rules + tokens).matchAll(/min-width:\s*(\d+(?:\.\d+)?)em/g)].map((m) => Number(m[1]) * 16);
    assert.ok(breakpoints.length >= 3, 'the layout has fewer than three breakpoints');
    assert.ok(Math.min(...breakpoints) >= 375, 'a breakpoint fires below the smallest supported width');
    assert.ok(Math.max(...breakpoints) <= 1280, 'the widest breakpoint is above the largest tested width');
  });

  test('layout is built with grid and flex rather than absolute positioning', () => {
    const absolute = (rules.match(/position:\s*absolute/g) || []).length;
    const modern = (rules.match(/display:\s*(?:grid|flex)/g) || []).length;
    assert.ok(modern > absolute * 3, `${absolute} absolute positions against ${modern} grid/flex declarations`);
  });
});
