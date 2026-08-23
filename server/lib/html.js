/**
 * HTML construction with escaping on by default.
 *
 * Every value interpolated into the `html` tagged template is escaped unless
 * it has been explicitly marked safe. This is the single mechanism the whole
 * view layer uses, so "escape user content" is a property of the templating
 * itself rather than something each page has to remember.
 */

const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapes text for use in element content and quoted attribute values. */
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** Marker for strings that are already valid, trusted HTML. */
class SafeString {
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

/**
 * Marks a string as trusted HTML. Only ever call this on markup this
 * codebase generated, never on request data.
 */
export function raw(value) {
  return new SafeString(String(value));
}

export function isSafe(value) {
  return value instanceof SafeString;
}

function render(value) {
  if (value == null || value === false) return '';
  if (value instanceof SafeString) return value.value;
  if (Array.isArray(value)) return value.map(render).join('');
  return escapeHtml(value);
}

/**
 * Tagged template that escapes interpolations.
 *
 *   html`<p>${userInput}</p>`            -> escaped
 *   html`<div>${raw(trustedMarkup)}</div>` -> inserted verbatim
 */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) {
    out += render(values[i]) + strings[i + 1];
  }
  return new SafeString(out);
}

/** Escapes a string for safe embedding inside a <script type="application/json"> block. */
export function jsonScript(data) {
  return raw(
    JSON.stringify(data)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029'),
  );
}

/**
 * Builds a class attribute value from a list, dropping falsy entries so
 * conditional modifiers read cleanly at the call site.
 */
export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

/**
 * Serialises a URL query string. Used for pagination and filter links so we
 * never hand-concatenate query strings.
 */
export function qs(params) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '') continue;
    sp.set(key, String(value));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}
