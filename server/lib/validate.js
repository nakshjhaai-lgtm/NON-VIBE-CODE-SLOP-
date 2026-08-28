/**
 * Server-side input validation.
 *
 * Nothing that arrives from a client is trusted: every field a route accepts
 * is declared here with a type, bounds and a specific, human error message.
 * Routes receive either clean typed values or a map of field -> message, and
 * unknown submitted fields are dropped rather than passed through (which is
 * what stops mass-assignment / field tampering).
 */

export const LIMITS = {
  name: 80,
  email: 254,
  subject: 120,
  message: 4000,
  password: 200,
  query: 100,
  domain: 253,
  org: 120,
};

const EMAIL = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;
const DOMAIN = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(?:\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

/** Collapses whitespace and strips control characters. */
export function clean(value) {
  if (typeof value !== 'string') return '';
  return value
    // deno-lint-ignore no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\r\n/g, '\n')
    .trim();
}

/** Collapses all runs of whitespace, for single-line fields. */
export function collapse(value) {
  return clean(value).replace(/\s+/g, ' ');
}

export const rules = {
  text({ label, min = 1, max = 200, required = true, multiline = false } = {}) {
    return (input) => {
      const value = multiline ? clean(input) : collapse(input);
      if (!value) {
        if (required) return { error: `${label} is required.` };
        return { value: '' };
      }
      if (value.length < min) {
        return { error: `${label} needs to be at least ${min} characters. You entered ${value.length}.` };
      }
      if (value.length > max) {
        return { error: `${label} must be ${max} characters or fewer. You entered ${value.length}.` };
      }
      return { value };
    };
  },

  email({ label = 'Email address', required = true } = {}) {
    return (input) => {
      const value = collapse(input).toLowerCase();
      if (!value) return required ? { error: `${label} is required.` } : { value: '' };
      if (value.length > LIMITS.email) return { error: `${label} must be ${LIMITS.email} characters or fewer.` };
      if (!EMAIL.test(value)) {
        return { error: `${label} does not look like an email address. Check for a missing @ or domain.` };
      }
      return { value };
    };
  },

  domain({ label = 'Domain', required = true } = {}) {
    return (input) => {
      let value = collapse(input).toLowerCase();
      if (!value) return required ? { error: `${label} is required.` } : { value: '' };
      // Accept a pasted URL and reduce it to a hostname.
      value = value.replace(/^[a-z]+:\/\//, '').split('/')[0].split('?')[0].replace(/\.$/, '');
      if (value.startsWith('www.')) value = value.slice(4);
      if (!DOMAIN.test(value)) {
        return { error: `Enter a domain like example.com. "${value.slice(0, 40)}" is not a valid domain name.` };
      }
      return { value };
    };
  },

  password({ label = 'Password', min = 12 } = {}) {
    return (input) => {
      const value = typeof input === 'string' ? input : '';
      if (!value) return { error: `${label} is required.` };
      if (value.length < min) {
        return { error: `${label} must be at least ${min} characters. Yours is ${value.length}.` };
      }
      if (value.length > LIMITS.password) {
        return { error: `${label} must be ${LIMITS.password} characters or fewer.` };
      }
      return { value };
    };
  },

  integer({ label, min = -Infinity, max = Infinity, required = true } = {}) {
    return (input) => {
      const str = collapse(input);
      if (!str) return required ? { error: `${label} is required.` } : { value: null };
      if (!/^-?\d+$/.test(str)) return { error: `${label} must be a whole number.` };
      const value = Number(str);
      if (value < min || value > max) return { error: `${label} must be between ${min} and ${max}.` };
      return { value };
    };
  },

  choice({ label, options, required = true } = {}) {
    return (input) => {
      const value = collapse(input);
      if (!value) return required ? { error: `${label} is required.` } : { value: '' };
      if (!options.includes(value)) return { error: `${label} is not one of the available options.` };
      return { value };
    };
  },

  checkbox({ label, required = false } = {}) {
    return (input) => {
      const checked = input === 'on' || input === 'true' || input === '1';
      if (required && !checked) return { error: `${label} must be ticked to continue.` };
      return { value: checked };
    };
  },
};

/**
 * Runs a schema against submitted fields.
 *
 * @param {Record<string, string>} body    parsed form fields
 * @param {Record<string, Function>} schema field name -> rule
 * @returns {{ ok: boolean, data: object, errors: Record<string,string> }}
 */
export function validate(body, schema) {
  const data = {};
  const errors = {};
  for (const [field, rule] of Object.entries(schema)) {
    const result = rule(body[field]);
    if (result.error) errors[field] = result.error;
    else data[field] = result.value;
  }
  return { ok: Object.keys(errors).length === 0, data, errors };
}

/**
 * A small denylist of passwords that are common enough to be guessed
 * immediately. The public breach API is not reachable from this deployment,
 * so we ship a local list rather than pretend to check one.
 */
const WEAK = new Set([
  'password', 'password1', 'password123', 'passw0rd', '123456', '12345678', '123456789', '1234567890',
  'qwerty', 'qwertyuiop', 'abc123', 'letmein', 'welcome', 'monkey', 'dragon', 'iloveyou',
  'admin', 'administrator', 'root', 'toor', 'changeme', 'secret', 'trustno1', 'sunshine',
  'princess', 'football', 'baseball', 'superman', 'starwars', 'whatever', 'zaq12wsx',
  'netguard', 'netguard123', 'password!', 'p@ssword', 'p@ssw0rd', 'correcthorsebatterystaple',
]);

/**
 * Scores a password 0-4 for the strength meter, and reports the reason so the
 * user is told what is actually wrong rather than just seeing a red bar.
 */
export function passwordStrength(password) {
  const value = String(password || '');
  const normalised = value.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (WEAK.has(value.toLowerCase()) || WEAK.has(normalised)) {
    return { score: 0, label: 'Too common', hint: 'This password appears on well-known guessing lists. Choose something else.' };
  }
  if (value.length < 12) {
    return { score: value.length >= 8 ? 1 : 0, label: 'Too short', hint: 'Use at least 12 characters. A short phrase works well.' };
  }

  let variety = 0;
  if (/[a-z]/.test(value)) variety++;
  if (/[A-Z]/.test(value)) variety++;
  if (/\d/.test(value)) variety++;
  if (/[^A-Za-z0-9]/.test(value)) variety++;

  const unique = new Set(value).size;
  if (/^(.)\1+$/.test(value)) {
    return { score: 0, label: 'Too repetitive', hint: 'This is one character repeated. Mix in more.' };
  }

  let score = 1;
  if (value.length >= 12 && variety >= 2) score = 2;
  if (value.length >= 14 && variety >= 3 && unique >= 8) score = 3;
  if (value.length >= 18 && variety >= 3 && unique >= 12) score = 4;

  const labels = ['Very weak', 'Weak', 'Reasonable', 'Strong', 'Very strong'];
  const hints = [
    'Add length and variety.',
    'Add length, or mix in numbers and punctuation.',
    'Acceptable. A few more characters would help.',
    'Good. Store it in a password manager.',
    'Good. Store it in a password manager.',
  ];
  return { score, label: labels[score], hint: hints[score] };
}

export function isWeakPassword(password) {
  return passwordStrength(password).score < 2;
}
