/**
 * Viewport overflow invariants.
 *
 * The pages are rendered by a server and deployed to a CDN, so the only way
 * to guarantee nothing pushes the document sideways is to pin the layout
 * primitives: every multi-column grid needs an explicit track definition at
 * its base (single-column) breakpoint, and wide content (code, tables) must
 * scroll inside its own box rather than growing the grid track.
 *
 * These are static checks against the stylesheet plus rendered-markup checks
 * for the naming conventions the site deliberately uses instead of the
 * generic builder classes.
 */
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startServer, stopServer, Client } from './helpers.js';

const origin = await startServer();
after(stopServer);

const url = (p) => new URL(p, import.meta.url);
const css = await readFile(url('../public/css/main.css'), 'utf8');
const tokens = await readFile(url('../public/css/tokens.css'), 'utf8');

/** main.css with comments stripped, whitespace normalised for matching. */
const plain = css
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/@font-face\s*\{[^}]*\}/g, '')
  .replace(/\s+/g, ' ');

function blockFor(selector) {
  const needle = `${selector} {`;
  const start = plain.indexOf(needle);
  if (start === -1) return '';
  const end = plain.indexOf('}', start);
  return plain.slice(start + needle.length, end);
}

describe('grids cannot grow to their widest child', () => {
  // At the base breakpoint these grids are single-column. An implicit auto
  // track would size to the max-content of a pre or table inside it, pushing
  // the page past the viewport; the explicit track keeps it at the container
  // width so wide content scrolls inside itself instead.
  const singleColumnGrids = ['.grid', '.split', '.feature-list', '.figures', '.stat-grid', '.footer-grid', '.hero__grid', '.app-shell'];

  test('every grid declares a base minmax(0, 1fr) track', () => {
    for (const name of singleColumnGrids) {
      const block = blockFor(name);
      assert.ok(block.includes('grid-template-columns: minmax(0, 1fr)'), `${name} has no base minmax(0, 1fr) track`);
    }
  });

  test('grid children are allowed to shrink below their content', () => {
    for (const rule of ['.grid > *', '.split > *', '.hero__grid > *', '.app-shell > *']) {
      const block = blockFor(rule);
      assert.ok(block.includes('min-width: 0'), `${rule} lacks min-width: 0`);
    }
    assert.ok(blockFor('.footer-col').includes('min-width: 0'), '.footer-col lacks min-width: 0');
  });

  test('wide content scrolls inside its own box, never inside the page', () => {
    assert.match(blockFor('pre'), /max-width: 100%/);
    assert.match(blockFor('pre'), /overflow-x: auto/);
    const tableWrap = blockFor('.table-wrap');
    assert.match(tableWrap, /max-width: 100%/);
    assert.match(tableWrap, /overflow-x: auto/);
  });

  test('the page root keeps the last-resort sideways-scroll guard', () => {
    assert.match(blockFor('html'), /overflow-x: hidden/);
    assert.match(tokens, /--page-max/);
  });

  test('status rows wrap instead of pushing their bars off-screen', () => {
    const row = blockFor('.status-row');
    assert.match(row, /flex-wrap: wrap/);
    assert.match(blockFor('.status-row > *'), /min-width: 0/);
    assert.match(blockFor('.uptime-bars'), /max-width: 100%/);
  });
});

describe('rendered markup uses the naming conventions, not builder defaults', () => {
  test('the home page hero contains no inline svg artwork', async () => {
    const body = await (await new Client(origin).get('/')).text();
    const hero = body.slice(body.indexOf('<section class="hero">'), body.indexOf('</section>'));
    assert.ok(!hero.includes('<svg'), 'hero still contains an inline svg');
    assert.ok(hero.includes('/img/network-diagram.png'), 'hero diagram is not the raster asset');
  });

  test('the kicker/lede classes are used and the generic names are gone', async () => {
    const client = new Client(origin);
    const home = await (await client.get('/')).text();
    const docs = await (await client.get('/docs/troubleshooting')).text();
    assert.match(docs, /class="lede"/);
    assert.match(home, /class="kicker hero__kicker"/);
    assert.ok(!/class="(?:lead|eyebrow)"/.test(home + docs), 'generic lead/eyebrow classes are still emitted');
  });

  test('skip-to-content targets the content landmark', async () => {
    const body = await (await new Client(origin).get('/pricing')).text();
    assert.match(body, /class="bypass-link" href="#content"/);
    assert.match(body, /<main id="content"/);
    assert.ok(!body.includes('id="main"'), 'the main landmark still uses the generic id');
  });
});
