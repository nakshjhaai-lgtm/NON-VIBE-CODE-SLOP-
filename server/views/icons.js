/**
 * Inline SVG icons.
 *
 * Emoji are not used as icons anywhere on this site: they render differently
 * on every platform, are announced unpredictably by screen readers, and read
 * as decoration rather than interface. These are drawn on a 24x24 grid with a
 * consistent 1.75 stroke so they sit together evenly.
 *
 * Icons are decorative by default (aria-hidden) because they always sit next
 * to a text label. Pass a `title` only when an icon genuinely stands alone.
 */
import { html, raw, escapeHtml } from '../lib/html.js';

const PATHS = {
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M15.5 15.5 20 20"/>',
  check: '<path d="M4 12.5 9 17.5 20 6.5"/>',
  cross: '<path d="M6 6l12 12M18 6L6 18"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.75v.5"/>',
  warning: '<path d="M12 4.5 21 19.5H3Z"/><path d="M12 10v4M12 16.75v.5"/>',
  error: '<circle cx="12" cy="12" r="8.5"/><path d="M9 9l6 6M15 9l-6 6"/>',
  success: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.5 11 15.5 16 9"/>',
  arrowUp: '<path d="M12 20V4M5 11l7-7 7 7"/>',
  arrowRight: '<path d="M4 12h15M13 6l6 6-6 6"/>',
  arrowLeft: '<path d="M20 12H5M11 18l-6-6 6-6"/>',
  chevronDown: '<path d="M6 9.5l6 6 6-6"/>',
  chevronRight: '<path d="M9.5 6l6 6-6 6"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14.5V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V8a1.5 1.5 0 0 1 1.5-1.5H10"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>',
  phone: '<path d="M7.5 4h-2A2.5 2.5 0 0 0 3 6.6C3 14 10 21 17.4 21a2.5 2.5 0 0 0 2.6-2.5v-2l-4.5-1.5-2 2.5a14.5 14.5 0 0 1-5.5-5.5L10.5 10Z"/>',
  location: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.5l3.5 2"/>',
  shield: '<path d="M12 3.5 5 6v6c0 4.5 3 7.8 7 9.5 4-1.7 7-5 7-9.5V6Z"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/>',
  eye: '<path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M4 4l16 16"/><path d="M9.5 9.6A3 3 0 0 0 12 15a3 3 0 0 0 2.4-1.2"/><path d="M6.6 6.7C4 8.4 2.5 12 2.5 12S6 17.5 12 17.5c1.5 0 2.8-.3 3.9-.8"/><path d="M18.2 15c2-1.6 3.3-3 3.3-3S18 6.5 12 6.5c-.7 0-1.3 0-1.9.2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>',
  monitor: '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M8 20h8M12 16.5V20"/>',
  document: '<path d="M13 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V9Z"/><path d="M13 3.5V9h5.5"/>',
  star: '<path d="m12 3.8 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 10l5.9-.9Z"/>',
  filter: '<path d="M3.5 5.5h17l-6.5 7.5V20l-4-2v-5Z"/>',
  server: '<rect x="3.5" y="4" width="17" height="6.5" rx="1.5"/><rect x="3.5" y="13.5" width="17" height="6.5" rx="1.5"/><path d="M7 7.25v.01M7 16.75v.01"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v4.5h-4.5"/>',
  users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M17.5 20a6.5 6.5 0 0 0-2.2-4.9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  download: '<path d="M12 3.5v11M7.5 10.5 12 15l4.5-4.5"/><path d="M4.5 19.5h15"/>',
  book: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H4Z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5H20Z"/>',
  code: '<path d="M8.5 8 4 12l4.5 4M15.5 8 20 12l-4.5 4M13.5 5l-3 14"/>',
  link: '<path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7L11.7 6.6"/><path d="M13.5 10.5a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 0 0 5.7 5.7l1.4-1.4"/>',
  print: '<path d="M7 9V4h10v5"/><rect x="3.5" y="9" width="17" height="7" rx="1.5"/><path d="M7 14h10v6H7Z"/>',
  cookie: '<path d="M20.5 12a8.5 8.5 0 1 1-8-8.5 3.2 3.2 0 0 0 3.2 3.2 3.2 3.2 0 0 0 3.2 3.2c.6 0 1.1-.1 1.6-.4"/><path d="M9 9.5v.01M8 14.5v.01M13.5 14v.01"/>',
  bell: '<path d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 4 1.5 5.5 1.5 5.5h-14s1.5-1.5 1.5-5.5Z"/><path d="M10 18.5a2 2 0 0 0 4 0"/>',
  chart: '<path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 17v-5M12.5 17V8M17 17v-7"/>',
  logout: '<path d="M9.5 20H6a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 6 4h3.5"/><path d="M14 8.5 17.5 12 14 15.5"/><path d="M17.5 12H9"/>',
};

/**
 * @param {string} name    key from PATHS
 * @param {{ title?: string, className?: string }} opts
 */
export function icon(name, { title = '', className = '' } = {}) {
  const d = PATHS[name];
  if (!d) throw new Error(`unknown icon: ${name}`);
  const a11y = title
    ? `role="img" aria-label="${escapeHtml(title)}"`
    : 'aria-hidden="true" focusable="false"';
  const cls = className ? ` class="${escapeHtml(className)}"` : '';
  return raw(
    `<svg${cls} ${a11y} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`,
  );
}

/** The brand mark, matching public/img/logo.svg. */
export function logoMark() {
  return html`<svg class="brand__mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <path d="M16 3.2 5.4 6.8v8.9c0 6.2 4.3 10.7 10.6 13.1 6.3-2.4 10.6-6.9 10.6-13.1V6.8Z" fill="currentColor" />
    <circle cx="16" cy="15" r="5.7" fill="none" stroke="var(--bg-surface)" stroke-width="2.2" />
    <path d="M12.2 18.8 19.8 11.2" stroke="var(--emphasis)" stroke-width="2.6" stroke-linecap="round" />
  </svg>`;
}

/** A filled star, used by the rating control and review display. */
export function starIcon() {
  return raw(
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor"><path d="m12 3.8 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 10l5.9-.9Z"/></svg>',
  );
}
