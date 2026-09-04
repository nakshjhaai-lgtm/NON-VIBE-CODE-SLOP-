/**
 * Client behaviour.
 *
 * Everything here is an enhancement. Each feature checks for the elements it
 * needs and exits quietly if they are absent, and every corresponding
 * interaction has a server-rendered fallback: forms submit normally, links
 * navigate, and <details> still opens without JavaScript.
 *
 * There are no console statements, no third-party scripts and no polling.
 */

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/** Small helper: run a function only if the selector matches something. */
function on(selector, fn, root = document) {
  const el = root.querySelector(selector);
  if (el) fn(el);
  return el;
}

/* ------------------------------------------------------------------ theme */

/**
 * Three-state theme control: light, dark, or follow the system.
 * The preference is stored so it survives navigation; "system" removes the
 * override entirely rather than freezing the current appearance.
 */
function initTheme() {
  const control = document.querySelector('.theme-control');
  if (!control) return;

  const root = document.documentElement;
  const buttons = [...control.querySelectorAll('[data-theme-choice]')];

  const read = () => {
    try {
      const stored = localStorage.getItem('ng-theme');
      return stored === 'light' || stored === 'dark' ? stored : 'system';
    } catch {
      return 'system';
    }
  };

  const apply = (preference) => {
    root.setAttribute('data-theme-preference', preference);
    if (preference === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', preference);

    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.dataset.themeChoice === preference));
    }
  };

  apply(read());

  for (const button of buttons) {
    button.addEventListener('click', () => {
      const choice = button.dataset.themeChoice;
      try {
        if (choice === 'system') localStorage.removeItem('ng-theme');
        else localStorage.setItem('ng-theme', choice);
      } catch {
        /* Private mode: the choice still applies for this page view. */
      }
      apply(choice);
    });
  }
}

/* ------------------------------------------------------------ mobile menu */

function initMobileNav() {
  const toggle = document.getElementById('menu-toggle');
  const nav = document.getElementById('drawer');
  if (!toggle || !nav) return;

  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    nav.hidden = !open;
    document.body.classList.toggle('nav-open', open);
  };

  toggle.addEventListener('click', () => {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });

  // Close on Escape, and when a link is followed.
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      toggle.focus();
    }
  });

  // If the viewport grows past the breakpoint, drop the mobile state so the
  // desktop nav is never hidden behind a stale attribute.
  const wide = window.matchMedia('(min-width: 62em)');
  const sync = () => {
    if (wide.matches) setOpen(false);
  };
  wide.addEventListener('change', sync);
}

/* -------------------------------------------------- header + scroll state */

function initScrollUi() {
  const header = document.getElementById('masthead');
  const bar = document.getElementById('scroll-progress-bar');
  const toTop = document.getElementById('back-to-top');

  if (toTop) {
    toTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion.matches ? 'auto' : 'smooth' });
      // Move focus to the top of the document, not just the viewport.
      const main = document.getElementById('content');
      if (main) main.focus({ preventScroll: true });
    });
  }

  let ticking = false;
  const update = () => {
    ticking = false;
    const y = window.scrollY;

    if (header) header.dataset.scrolled = String(y > 4);

    if (bar) {
      const height = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = height > 0 ? Math.min(1, y / height) : 0;
      bar.style.width = `${(ratio * 100).toFixed(2)}%`;
    }

    if (toTop) toTop.hidden = y < 600;
  };

  const request = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request, { passive: true });
  update();
}

/* -------------------------------------------------------------- clipboard */

/**
 * Copy-to-clipboard with a visible confirmation. The button label is restored
 * afterwards, and the result is announced for screen readers.
 */
function initCopy() {
  const status = document.getElementById('copy-status');

  // Every fenced code block in prose gets a copy button. Adding them here
  // rather than in the markdown keeps the content free of interface concerns,
  // and a reader without JavaScript still sees the code and can select it.
  let blockId = 0;
  for (const pre of document.querySelectorAll('.prose pre')) {
    const code = pre.querySelector('code');
    if (!code) continue;
    if (!code.id) code.id = `code-block-${++blockId}`;

    const wrap = document.createElement('div');
    wrap.className = 'code-block';
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(pre);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn--quiet btn--sm code-block__copy';
    button.dataset.copy = `#${code.id}`;
    button.innerHTML = '<span data-copy-label>Copy</span>';
    button.setAttribute('aria-label', 'Copy this code block');
    wrap.appendChild(button);
  }

  for (const button of document.querySelectorAll('[data-copy]')) {
    button.addEventListener('click', async () => {
      const selector = button.dataset.copy;
      const source = selector ? document.querySelector(selector) : null;
      const text = source ? source.textContent.trim() : button.dataset.copyText || '';
      if (!text) return;

      const label = button.querySelector('[data-copy-label]') || button;
      const original = label.textContent;

      let ok = true;
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        ok = false;
      }

      label.textContent = ok ? 'Copied' : 'Press Ctrl+C';
      if (status) status.textContent = ok ? `Copied: ${text}` : 'Copying was blocked by the browser. Select the text and copy manually.';

      if (!ok && source) {
        const range = document.createRange();
        range.selectNodeContents(source);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }

      window.setTimeout(() => {
        label.textContent = original;
        if (status) status.textContent = '';
      }, 2500);
    });
  }
}

/* ------------------------------------------------------------------ forms */

/**
 * Live character counters. The server enforces the same limit; this only
 * tells the user where they stand before they submit.
 */
function initCounters() {
  for (const field of document.querySelectorAll('[data-counter]')) {
    const target = document.getElementById(field.dataset.counter);
    if (!target) continue;
    const max = Number(field.getAttribute('maxlength')) || 0;

    const update = () => {
      const used = field.value.length;
      target.textContent = max ? `${used} of ${max} characters` : `${used} characters`;
      target.dataset.state = max && used > max * 0.9 ? 'near' : 'ok';
    };
    field.addEventListener('input', update);
    update();
  }
}

/** Password visibility toggle. */
function initPasswordToggles() {
  for (const toggle of document.querySelectorAll('[data-password-toggle]')) {
    const input = document.getElementById(toggle.dataset.passwordToggle);
    if (!input) continue;

    toggle.hidden = false;
    toggle.addEventListener('click', () => {
      const shown = input.type === 'text';
      input.type = shown ? 'password' : 'text';
      toggle.setAttribute('aria-pressed', String(!shown));
      const label = shown ? 'Show password' : 'Hide password';
      toggle.setAttribute('aria-label', label);
      const text = toggle.querySelector('[data-password-label]');
      if (text) text.textContent = label;
      toggle.querySelector('[data-icon-show]')?.toggleAttribute('hidden', !shown);
      toggle.querySelector('[data-icon-hide]')?.toggleAttribute('hidden', shown);
    });
  }
}

/**
 * Password strength meter.
 *
 * This mirrors the server's scoring so the user sees the same verdict they
 * will get on submit. The server is still the authority: this is advisory.
 */
const WEAK_LIST = new Set([
  'password', 'password1', 'password123', 'passw0rd', '123456', '12345678', '123456789', '1234567890',
  'qwerty', 'qwertyuiop', 'abc123', 'letmein', 'welcome', 'monkey', 'dragon', 'iloveyou',
  'admin', 'administrator', 'root', 'toor', 'changeme', 'secret', 'trustno1', 'sunshine',
  'princess', 'football', 'baseball', 'superman', 'starwars', 'whatever', 'zaq12wsx',
  'netguard', 'netguard123', 'password!', 'p@ssword', 'p@ssw0rd', 'correcthorsebatterystaple',
]);

function scorePassword(value) {
  const normalised = value.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!value) return { score: 0, label: 'Enter a password', hint: 'At least 12 characters.' };
  if (WEAK_LIST.has(value.toLowerCase()) || WEAK_LIST.has(normalised)) {
    return { score: 0, label: 'Too common', hint: 'This password appears on well-known guessing lists.' };
  }
  if (/^(.)\1+$/.test(value)) {
    return { score: 0, label: 'Too repetitive', hint: 'This is one character repeated.' };
  }
  if (value.length < 12) {
    return { score: value.length >= 8 ? 1 : 0, label: 'Too short', hint: `Use at least 12 characters. You have ${value.length}.` };
  }

  let variety = 0;
  if (/[a-z]/.test(value)) variety++;
  if (/[A-Z]/.test(value)) variety++;
  if (/\d/.test(value)) variety++;
  if (/[^A-Za-z0-9]/.test(value)) variety++;
  const unique = new Set(value).size;

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

function initStrengthMeters() {
  for (const meter of document.querySelectorAll('[data-strength-for]')) {
    const input = document.getElementById(meter.dataset.strengthFor);
    if (!input) continue;

    const fill = meter.querySelector('.strength__fill');
    const text = meter.querySelector('.strength__text');
    meter.hidden = false;

    const update = () => {
      const { score, label, hint } = scorePassword(input.value);
      if (fill) {
        fill.style.width = `${(score / 4) * 100}%`;
        fill.dataset.level = String(score);
      }
      if (text) text.textContent = input.value ? `${label}. ${hint}` : hint;
    };
    input.addEventListener('input', update);
    update();
  }
}

/**
 * Marks a submitting form as busy so the button cannot be double-clicked into
 * two submissions. The button keeps its width to avoid a layout shift.
 */
function initSubmitState() {
  for (const form of document.querySelectorAll('form[data-busy-on-submit]')) {
    form.addEventListener('submit', () => {
      const button = form.querySelector('button[type="submit"], button:not([type])');
      if (!button || button.dataset.busy === 'true') return;
      button.dataset.busy = 'true';
      button.disabled = true;
      // Re-enable if the browser restores the page from bfcache.
      window.addEventListener('pageshow', () => {
        button.dataset.busy = 'false';
        button.disabled = false;
      }, { once: true });
    });
  }
}

/**
 * Confirmation dialogs for destructive actions. Falls back to a normal
 * submit when <dialog> is unsupported, and the server re-checks intent.
 */
function initConfirmDialogs() {
  const dialog = document.getElementById('confirm-dialog');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  const titleEl = dialog.querySelector('[data-confirm-title]');
  const bodyEl = dialog.querySelector('[data-confirm-body]');
  const okBtn = dialog.querySelector('[data-confirm-ok]');
  let pendingForm = null;

  for (const form of document.querySelectorAll('form[data-confirm]')) {
    form.addEventListener('submit', (event) => {
      if (form.dataset.confirmed === 'true') return;
      event.preventDefault();
      pendingForm = form;
      if (titleEl) titleEl.textContent = form.dataset.confirmTitle || 'Are you sure?';
      if (bodyEl) bodyEl.textContent = form.dataset.confirm;
      if (okBtn) okBtn.textContent = form.dataset.confirmOk || 'Confirm';
      dialog.showModal();
    });
  }

  okBtn?.addEventListener('click', () => {
    dialog.close();
    if (pendingForm) {
      pendingForm.dataset.confirmed = 'true';
      pendingForm.requestSubmit();
      pendingForm = null;
    }
  });

  dialog.addEventListener('close', () => {
    pendingForm = null;
  });
}

/* ------------------------------------------------------------------- tabs */

function initTabs() {
  for (const tablist of document.querySelectorAll('[role="tablist"]')) {
    const tabs = [...tablist.querySelectorAll('[role="tab"]')];
    if (tabs.length === 0) continue;

    const select = (tab) => {
      for (const other of tabs) {
        const selected = other === tab;
        other.setAttribute('aria-selected', String(selected));
        other.tabIndex = selected ? 0 : -1;
        const panel = document.getElementById(other.getAttribute('aria-controls'));
        if (panel) panel.hidden = !selected;
      }
    };

    tablist.addEventListener('click', (event) => {
      const tab = event.target.closest('[role="tab"]');
      if (tab) select(tab);
    });

    tablist.addEventListener('keydown', (event) => {
      const index = tabs.indexOf(document.activeElement);
      if (index === -1) return;
      let next = null;
      if (event.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length];
      if (event.key === 'ArrowLeft') next = tabs[(index - 1 + tabs.length) % tabs.length];
      if (event.key === 'Home') next = tabs[0];
      if (event.key === 'End') next = tabs[tabs.length - 1];
      if (!next) return;
      event.preventDefault();
      next.focus();
      select(next);
    });
  }
}

/* ---------------------------------------------------------- cookie banner */

/**
 * Analytics is off until it is accepted. The banner is rendered hidden and
 * only shown when no choice has been recorded, so it never flashes for
 * people who have already answered.
 */
function initCookieBanner() {
  // /cookies?reset=1 clears the server's cookie; the stored copy has to go
  // too, or the banner would stay hidden and the page would have lied.
  if (document.querySelector('[data-reset-analytics-choice]')) {
    try {
      localStorage.removeItem('ng-analytics');
    } catch {
      /* Nothing stored to clear. */
    }
  }

  const banner = document.getElementById('cookie-banner');
  if (!banner) return;

  const read = () => {
    try {
      return localStorage.getItem('ng-analytics');
    } catch {
      return 'reject';
    }
  };

  if (!read()) banner.hidden = false;

  for (const button of banner.querySelectorAll('[data-cookie-choice]')) {
    button.addEventListener('click', () => {
      const choice = button.dataset.cookieChoice === 'accept' ? 'accept' : 'reject';
      try {
        localStorage.setItem('ng-analytics', choice);
      } catch {
        /* Nothing to persist; the default (no analytics) applies. */
      }
      banner.hidden = true;
      if (choice === 'accept') {
        window.dispatchEvent(new CustomEvent('ng:analytics-allowed'));
      }
    });
  }
}

/* ------------------------------------------------------- coverage look-up */

/**
 * Progressive enhancement of the coverage form: posts in the background and
 * swaps in the result. Without JavaScript the same form does a full page
 * submit to the same endpoint and renders the same markup.
 */
function initCoverageForm() {
  const form = document.getElementById('coverage-form');
  const output = document.getElementById('coverage-result');
  if (!form || !output) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const data = new FormData(form);

    output.setAttribute('aria-busy', 'true');
    output.innerHTML = '<div class="skeleton skeleton--line"></div><div class="skeleton skeleton--line"></div>';
    if (button) {
      button.dataset.busy = 'true';
      button.disabled = true;
    }

    try {
      const response = await fetch('/api/coverage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ domain: data.get('domain'), _csrf: data.get('_csrf') }),
      });
      const payload = await response.json();
      output.innerHTML = renderCoverage(payload, response.ok);
    } catch {
      output.innerHTML =
        '<p class="message message--error" role="alert"><span>The lookup could not be completed. Check your connection and try again.</span></p>';
    } finally {
      output.removeAttribute('aria-busy');
      if (button) {
        button.dataset.busy = 'false';
        button.disabled = false;
      }
    }
  });
}

function escapeText(value) {
  const div = document.createElement('div');
  div.textContent = String(value);
  return div.innerHTML;
}

function renderCoverage(payload, ok) {
  if (!ok || payload.error) {
    return `<div class="message message--error" role="alert"><span>${escapeText(payload.message || 'That lookup could not be completed.')}</span></div>`;
  }
  const domain = escapeText(payload.domain);

  if (payload.protected) {
    return `<div class="message message--info" role="status"><span><strong>${domain}</strong> is on the never-block list. Routes to gambling support are never filtered, whatever a list says.</span></div>`;
  }

  if (payload.listed) {
    return `<div class="message message--success" role="status"><span><strong>${domain}</strong> is on the ${escapeText(payload.list)} list. It is blocked whenever that list is enabled.</span></div>
      <p class="text-sm text-muted">Matched rule: <code>${escapeText(payload.matchedRule)}</code>, which also covers every subdomain of it. Source: ${escapeText(payload.source)}.</p>`;
  }

  return `<div class="message message--warning" role="status"><span><strong>${domain}</strong> is not on any list we publish, so it would not be blocked today.</span></div>
    <p class="text-sm text-muted">If you believe it should be, <a href="/contact?topic=listing&amp;domain=${encodeURIComponent(payload.domain)}">submit it for review</a>. Every submission is checked by a person before anything is added.</p>`;
}

/* ------------------------------------------------------------------- init */

function boot() {
  initTheme();
  initMobileNav();
  initScrollUi();
  initCopy();
  initCounters();
  initPasswordToggles();
  initStrengthMeters();
  initSubmitState();
  initConfirmDialogs();
  initTabs();
  initCookieBanner();
  initCoverageForm();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
