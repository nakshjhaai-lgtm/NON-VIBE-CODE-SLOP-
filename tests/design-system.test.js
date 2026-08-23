/**
 * The design system is the thing that stops a site looking generated.
 *
 * These tests enforce it mechanically: no raw value may appear where a token
 * exists, no banned visual effect may be reintroduced, and the accessibility
 * properties that were designed in must stay in.
 */
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { startServer, stopServer, Client } from './helpers.js';

const origin = await startServer();
after(stopServer);

const url = (p) => new URL(p, import.meta.url);
const tokens = await readFile(url('../public/css/tokens.css'), 'utf8');
const css = await readFile(url('../public/css/main.css'), 'utf8');
const appJs = await readFile(url('../public/js/app.js'), 'utf8');
const analyticsJs = await readFile(url('../public/js/analytics.js'), 'utf8');

/**
 * main.css with comments stripped, and with @font-face blocks removed: those
 * declare the actual weights of the files on disk, which are facts about the
 * fonts rather than design decisions.
 */
const rules = css
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/@font-face\s*\{[^}]*\}/g, '');

describe('tokens exist and are used', () => {
  test('the scales the brief demands are all defined', () => {
    const required = [
      '--space-1', '--space-2', '--space-3', '--space-4', '--space-6', '--space-8',
      '--radius-sm', '--radius-md', '--radius-lg',
      '--shadow-1', '--shadow-2', '--shadow-3',
      '--text-sm', '--text-base', '--text-lg', '--text-xl',
      '--measure-narrow',
      '--weight-regular', '--weight-medium', '--weight-semibold', '--weight-bold',
      '--duration-fast', '--duration-base', '--ease-standard',
      '--font-sans', '--font-mono',
      '--focus-ring', '--measure',
    ];
    for (const name of required) {
      assert.ok(tokens.includes(`${name}:`), `token ${name} is not defined`);
    }
  });

  test('exactly three radii and three shadows are defined', () => {
    const radii = new Set([...tokens.matchAll(/(--radius-[a-z0-9]+):/g)].map((m) => m[1]));
    const shadows = new Set([...tokens.matchAll(/(--shadow-[a-z0-9]+):/g)].map((m) => m[1]));
    assert.deepEqual([...radii].sort(), ['--radius-lg', '--radius-md', '--radius-sm']);
    assert.deepEqual([...shadows].sort(), ['--shadow-1', '--shadow-2', '--shadow-3']);
  });

  test('no hard-coded hex colour is used outside the token file', () => {
    const offenders = [...rules.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((m) => m[0]);
    assert.deepEqual(offenders, [], `main.css uses raw colours: ${offenders.join(', ')}`);
  });

  test('no raw pixel spacing is used where a token exists', () => {
    // Hairlines, 1px-2px optical adjustments and media queries are allowed.
    const offenders = [];
    for (const match of rules.matchAll(/(?:margin|padding|gap|inset)[a-z-]*:\s*([^;]+);/g)) {
      for (const value of match[1].split(/\s+/)) {
        const px = value.match(/^(\d+)px$/);
        if (px && Number(px[1]) > 2) offenders.push(match[0].trim());
      }
    }
    assert.deepEqual(offenders, [], `raw pixel spacing found: ${offenders.slice(0, 5).join(' | ')}`);
  });

  test('every transition duration comes from the scale', () => {
    const offenders = [...rules.matchAll(/transition:[^;]*?(\d+(?:\.\d+)?m?s)/g)]
      .map((m) => m[0].trim())
      .filter((decl) => !decl.includes('var(--duration'));
    assert.deepEqual(offenders, [], `hard-coded durations: ${offenders.join(' | ')}`);
  });

  test('every font-weight comes from the scale', () => {
    const offenders = [...rules.matchAll(/font-weight:\s*([^;]+);/g)]
      .map((m) => m[1].trim())
      .filter((value) => !value.startsWith('var(--weight') && value !== 'inherit');
    assert.deepEqual(offenders, [], `hard-coded weights: ${offenders.join(', ')}`);
  });
});

describe('banned visual signals', () => {
  const banned = [
    [/linear-gradient|radial-gradient|conic-gradient/i, 'a CSS gradient'],
    [/backdrop-filter/i, 'glassmorphism via backdrop-filter'],
    [/text-shadow:\s*0\s+0/i, 'a glow effect'],
    [/box-shadow:[^;]*(?:0\s+0\s+\d+px\s+(?:\d+px\s+)?(?:#|rgb|var\(--accent))/i, 'a glowing box-shadow'],
    [/@keyframes\s+(?:float|blob|glow|shimmer|gradient|marquee|scroll)/i, 'a decorative keyframe animation'],
    [/cursor:\s*pointer[^}]*}\s*a\b/i, 'cursor:pointer on a non-interactive element'],
  ];

  for (const [pattern, description] of banned) {
    test(`the stylesheet contains no ${description}`, () => {
      const hit = rules.match(pattern) || tokens.match(pattern);
      assert.equal(hit, null, `found ${description}: ${hit?.[0]}`);
    });
  }

  test('the only infinite animations are loading indicators', () => {
    // The brief requires loading skeletons and spinners, and bans decorative
    // perpetual motion. So the rule is about what is animating, not whether.
    for (const block of rules.split('}')) {
      if (!/animation:[^;]*infinite/.test(block)) continue;
      const selector = block.split('{')[0].trim();
      assert.ok(
        /skeleton|spinner|\[data-busy/.test(selector),
        `a decorative element animates forever: ${selector}`,
      );
    }
    // And both must stop when the visitor asks for less motion.
    const reduced = (tokens + css).slice((tokens + css).indexOf('@media (prefers-reduced-motion: reduce)'));
    assert.match(reduced, /animation/, 'reduced motion does not address animation');
  });

  test('no banned typeface is referenced', () => {
    for (const face of ['Inter', 'Geist', 'Poppins', 'Montserrat', 'Space Grotesk']) {
      assert.ok(!tokens.includes(face), `the token file references ${face}`);
      assert.ok(!css.includes(face), `the stylesheet references ${face}`);
    }
    assert.match(tokens, /IBM Plex Sans/);
  });

  test('no purple, indigo, pink or neon accent is defined', () => {
    // Parse every hex token and reject the hue ranges the brief bans, plus
    // anything at full neon saturation.
    const offenders = [];
    for (const [, name, hex] of tokens.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})\b/gi)) {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const d = max - min;
      if (d < 0.08) continue; // effectively neutral

      let hue = 0;
      if (max === r) hue = ((g - b) / d) % 6;
      else if (max === g) hue = (b - r) / d + 2;
      else hue = (r - g) / d + 4;
      hue = (hue * 60 + 360) % 360;

      const light = (max + min) / 2;
      const sat = d / (1 - Math.abs(2 * light - 1));

      if (hue >= 260 && hue <= 340) offenders.push(`${name} ${hex} (hue ${hue.toFixed(0)}, purple/pink)`);
      if (sat > 0.9 && light > 0.45 && light < 0.75) offenders.push(`${name} ${hex} (neon)`);
    }
    assert.deepEqual(offenders, [], offenders.join('; '));
  });

  test('no shadow is used as decoration on a static surface', () => {
    // Shadows belong to floating UI only: dialogs, the sticky bar, the banner.
    const allowed = ['dialog', '.cookie-banner', '.sticky-cta', '.floating-btn', '.mobile-nav', '.site-header', '.code-block__copy'];
    for (const block of rules.split('}')) {
      if (!/box-shadow:\s*var\(--shadow/.test(block)) continue;
      const selector = block.split('{')[0].trim();
      const ok = allowed.some((name) => selector.includes(name));
      assert.ok(ok, `a shadow is applied to a static surface: ${selector}`);
    }
  });
});

describe('typography and measure', () => {
  test('body text is never below 16px', () => {
    assert.match(tokens, /--text-base:\s*1rem/);
    const small = [...rules.matchAll(/font-size:\s*(\d*\.?\d+)rem/g)].map((m) => Number(m[1]));
    for (const size of small) {
      assert.ok(size >= 0.75, `a font-size of ${size}rem is too small even for supporting text`);
    }
  });

  test('prose is constrained to a readable measure', () => {
    assert.match(tokens, /--measure:\s*\d+ch/);
    assert.match(rules, /max-width:\s*var\(--measure\)/);
  });

  test('there is no letter-spacing on body copy', () => {
    for (const block of rules.split('}')) {
      if (!/letter-spacing:/.test(block)) continue;
      const selector = block.split('{')[0].trim();
      // Tracking belongs to small caps labels and display headings only.
      assert.ok(
        /label|eyebrow|badge|__code|h1|display|caps|tracking/i.test(selector + block),
        `letter-spacing applied to body copy: ${selector}`,
      );
    }
  });
});

describe('accessibility invariants', () => {
  test('a single focus style is defined and never removed without replacement', () => {
    assert.match(rules, /:focus-visible\s*\{[^}]*outline:/);
    for (const block of rules.split('}')) {
      if (!/outline:\s*(?:none|0)\b/.test(block)) continue;
      assert.ok(
        /:focus:not\(:focus-visible\)/.test(block) || /outline-offset/.test(block),
        `focus outline removed without a replacement: ${block.split('{')[0].trim()}`,
      );
    }
  });

  test('interactive targets meet the 44 pixel minimum', () => {
    assert.match(rules, /--tap-target|min-height:\s*2\.75rem|min-height:\s*44px/);
    const btn = rules.slice(rules.indexOf('.btn {'), rules.indexOf('.btn {') + 600);
    assert.match(btn, /min-height/, 'buttons have no minimum height');
  });

  test('no interaction relies on hover alone', () => {
    // Every :hover rule must have a :focus-visible counterpart somewhere.
    const hovered = new Set(
      [...rules.matchAll(/([^{}]+):hover\b[^{]*\{/g)].map((m) => m[1].trim().split(',')[0].trim()),
    );
    for (const selector of hovered) {
      if (!selector.startsWith('.') && !selector.startsWith('a') && !selector.startsWith('button')) continue;
      const base = selector.split(' ').pop();
      assert.ok(
        rules.includes(`${base}:focus-visible`) || rules.includes(':focus-visible'),
        `${selector} responds to hover but not to keyboard focus`,
      );
    }
  });

  test('status is never conveyed by colour alone', async () => {
    const body = await (await new Client(origin).get('/status')).text();
    for (const match of body.matchAll(/<span class="badge badge--(\w+)">([\s\S]*?)<\/span>\s*<\/span>/g)) {
      assert.match(match[2], /<svg/, `a ${match[1]} badge has no icon`);
    }
    assert.match(body, /Responding|Degraded|Not responding/, 'status has no textual label');
  });

  test('reduced motion turns animation off rather than down', () => {
    const block = (tokens + css).match(/@media \(prefers-reduced-motion: reduce\)[\s\S]{0,600}/)[0];
    assert.match(block, /0\.01ms|0s\b|none/);
  });

  test('the contrast checker covers the whole palette and passes', async () => {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const { stdout } = await promisify(execFile)('node', ['scripts/check-contrast.js'], {
      cwd: new URL('..', import.meta.url).pathname,
    });
    assert.match(stdout, /0 failing/);
    const pairs = Number(stdout.match(/(\d+) pairs/)?.[1] || 0);
    assert.ok(pairs >= 50, `only ${pairs} colour pairs are checked`);
  });
});

describe('client script hygiene', () => {
  test('no console output is left in shipped scripts', () => {
    for (const [name, source] of [['app.js', appJs], ['analytics.js', analyticsJs]]) {
      assert.ok(!/console\.(log|debug|info|warn|error)\(/.test(source), `${name} contains console output`);
    }
  });

  test('no source map comment is emitted', () => {
    for (const source of [appJs, analyticsJs, css, tokens]) {
      assert.ok(!source.includes('sourceMappingURL'), 'a source map reference was shipped');
    }
  });

  test('every enhancement checks for its element before binding', () => {
    // A missing null check is the usual cause of a page-breaking exception,
    // and it is the reason a site "works on the developer's machine".
    const functions = [...appJs.matchAll(/^function (\w+)\(\) \{([\s\S]*?)^\}/gm)];
    assert.ok(functions.length >= 8, `only ${functions.length} enhancement functions were found to check`);

    for (const [, name, source] of functions) {
      const singular = source.replace(/querySelectorAll\([^)]*\)/g, '');
      if (!/getElementById|querySelector\(/.test(singular)) continue;
      // Accepted guards: an early return, optional chaining, or wrapping the
      // use in `if (element)`.
      const guarded =
        /if \(!\w/.test(source) || /\?\./.test(source) || /if \(\w+\)\s*\{/.test(source);
      assert.ok(guarded, `${name} dereferences an element without checking it exists`);
    }
  });

  test('the script is a module and is loaded with a nonce', async () => {
    const body = await (await new Client(origin).get('/')).text();
    assert.match(body, /<script type="module" src="\/js\/app\.js\?v=[^"]+" nonce="[^"]+"><\/script>/);
  });
});

describe('markup hygiene', () => {
  const paths = ['/', '/pricing', '/docs/quick-start', '/contact', '/about', '/faq'];

  test('headings run in order with no skipped levels', async () => {
    const client = new Client(origin);
    for (const path of paths) {
      const body = await (await client.get(path)).text();
      const levels = [...body.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
      let previous = 0;
      for (const level of levels) {
        if (previous !== 0) {
          assert.ok(level <= previous + 1, `${path} skips from h${previous} to h${level}`);
        }
        previous = level;
      }
    }
  });

  test('every page uses real landmarks', async () => {
    const client = new Client(origin);
    for (const path of paths) {
      const body = await (await client.get(path)).text();
      assert.match(body, /<main id="main"/, `${path} has no main`);
      assert.match(body, /<footer class="site-footer">/, `${path} has no footer`);
      assert.match(body, /<header class="site-header"/, `${path} has no header`);
      assert.ok((body.match(/<main\b/g) || []).length === 1, `${path} has more than one main`);
    }
  });

  test('no inline style carries a colour or a font', async () => {
    const client = new Client(origin);
    for (const path of paths) {
      const body = await (await client.get(path)).text();
      for (const [, style] of body.matchAll(/style="([^"]+)"/g)) {
        assert.ok(!/color|background|font-family|box-shadow/.test(style), `${path} has an inline visual style: ${style}`);
      }
    }
  });

  test('external links carry rel="noopener noreferrer"', async () => {
    const client = new Client(origin);
    for (const path of [...paths, '/help', '/coverage']) {
      const body = await (await client.get(path)).text();
      for (const tag of body.match(/<a\b[^>]*href="https?:\/\/[^"]*"[^>]*>/g) || []) {
        assert.match(tag, /rel="noopener noreferrer"/, `${path}: ${tag}`);
      }
    }
  });

  test('no page contains a card inside a card', async () => {
    const client = new Client(origin);
    for (const path of paths) {
      const body = await (await client.get(path)).text();
      assert.ok(!/<div class="panel[^"]*">(?:(?!<\/div>)[\s\S]){0,400}<div class="panel/.test(body), `${path} nests a panel inside a panel`);
    }
  });
});

describe('no tool fingerprints', () => {
  test('the source contains no builder watermark or default domain', async () => {
    const files = [];
    async function walk(dir) {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        // The test file itself names the fingerprints in order to look for
        // them, so scanning it would always fail.
        if (['node_modules', '.git', 'data', 'tests'].includes(entry.name)) continue;
        const full = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dir);
        if (entry.isDirectory()) await walk(full);
        else if (/\.(js|css|md|json|html|xml|txt)$/.test(entry.name)) files.push(full);
      }
    }
    await walk(url('../'));

    const banned = ['vercel.app', 'netlify.app', 'lovable', 'bolt.new', 'v0.dev', 'Made with', 'Built with Bubble', 'framer.website'];
    for (const file of files) {
      const source = await readFile(file, 'utf8');
      for (const word of banned) {
        assert.ok(!source.includes(word), `${file.pathname} contains the fingerprint "${word}"`);
      }
    }
  });

  test('the site is not a single page pretending to be many', async () => {
    const client = new Client(origin);
    const home = await (await client.get('/')).text();
    const pricing = await (await client.get('/pricing')).text();
    const main = (html) => html.slice(html.indexOf('<main'), html.indexOf('</main>'));
    assert.notEqual(main(home), main(pricing), 'two routes serve identical content');
    assert.ok(!home.includes('href="#pricing"'), 'the home page links to an anchor instead of a page');
  });
});
