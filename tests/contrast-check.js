/**
 * Verifies every foreground/background pairing the design system actually
 * ships meets WCAG 2.1 AA. The design-system test calls this directly so a
 * token edit that quietly breaks contrast cannot pass the test suite.
 */
export function checkContrast(css) {
  function scope(name) {
    // Grab a declaration block by its selector so light and dark are read apart.
    const start = css.indexOf(name);
    if (start === -1) throw new Error(`missing scope ${name}`);
    const open = css.indexOf('{', start);
    let depth = 0;
    let i = open;
    for (; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') { depth--; if (depth === 0) break; }
    }
    const body = css.slice(open + 1, i);
    const vars = new Map();
    for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars.set(m[1], m[2].trim());
    return vars;
  }

  const root = scope(':root');
  const darkOverrides = scope('[data-theme="dark"]');
  const dark = new Map([...root, ...darkOverrides]);

  function resolve(vars, value, seen = 0) {
    if (seen > 10) throw new Error('var cycle');
    const m = /^var\((--[\w-]+)\)$/.exec(value.trim());
    if (m) return resolve(vars, vars.get(m[1]) ?? '', seen + 1);
    return value.trim();
  }

  function toRgb(hex) {
    const h = hex.replace('#', '').trim();
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    if (!/^[0-9a-f]{6}$/i.test(full)) throw new Error(`not a hex colour: ${hex}`);
    return [0, 2, 4].map((o) => parseInt(full.slice(o, o + 2), 16));
  }

  function luminance(hex) {
    const [r, g, b] = toRgb(hex).map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function ratio(a, b) {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  /** [foreground, background, minimum, label] */
  const PAIRS = [
    ['--text-primary', '--bg-page', 4.5, 'body text on page'],
    ['--text-primary', '--bg-surface', 4.5, 'body text on card'],
    ['--text-primary', '--bg-sunken', 4.5, 'body text on sunken'],
    ['--text-primary', '--bg-inset', 4.5, 'body text on inset'],
    ['--text-secondary', '--bg-page', 4.5, 'secondary on page'],
    ['--text-secondary', '--bg-surface', 4.5, 'secondary on card'],
    ['--text-muted', '--bg-page', 4.5, 'muted on page'],
    ['--text-muted', '--bg-surface', 4.5, 'muted on card'],
    ['--link', '--bg-page', 4.5, 'link on page'],
    ['--link', '--bg-surface', 4.5, 'link on card'],
    ['--link-visited', '--bg-surface', 4.5, 'visited link on card'],
    ['--accent-text', '--bg-surface', 4.5, 'accent text on card'],
    ['--accent-text', '--accent-subtle-bg', 4.5, 'accent text on accent chip'],
    ['--emphasis-text', '--bg-surface', 4.5, 'emphasis text on card'],
    ['--emphasis-text', '--emphasis-subtle-bg', 4.5, 'emphasis on emphasis chip'],
    ['--text-on-accent', '--accent', 4.5, 'button label on accent'],
    ['--text-on-accent', '--accent-hover', 4.5, 'button label on accent hover'],
    ['--text-on-inverse', '--bg-inverse', 4.5, 'text on inverse surface'],
    ['--positive-fg', '--positive-bg', 4.5, 'positive status'],
    ['--positive-fg', '--bg-surface', 4.5, 'positive text on card'],
    ['--caution-fg', '--caution-bg', 4.5, 'caution status'],
    ['--caution-fg', '--bg-surface', 4.5, 'caution text on card'],
    ['--critical-fg', '--critical-bg', 4.5, 'critical status'],
    ['--critical-fg', '--bg-surface', 4.5, 'critical text on card'],
    // Non-text contrast (WCAG 1.4.11) needs 3:1.
    ['--border-default', '--bg-surface', 3, 'control border on card'],
    ['--border-default', '--bg-page', 3, 'control border on page'],
    ['--focus-ring', '--bg-page', 3, 'focus ring on page'],
    ['--focus-ring', '--bg-surface', 3, 'focus ring on card'],
  ];

  let failures = 0;
  const rows = [];
  for (const [theme, vars] of [['light', root], ['dark', dark]]) {
    for (const [fgVar, bgVar, min, label] of PAIRS) {
      const fg = resolve(vars, vars.get(fgVar));
      const bg = resolve(vars, vars.get(bgVar));
      const r = ratio(fg, bg);
      const ok = r >= min;
      if (!ok) failures++;
      rows.push(`${ok ? 'PASS' : 'FAIL'}  ${theme.padEnd(5)} ${r.toFixed(2).padStart(5)}:1 (min ${min})  ${label}  [${fg} on ${bg}]`);
    }
  }
  return { rows, failures };
}
