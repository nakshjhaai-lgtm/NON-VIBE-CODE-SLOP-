/**
 * Shared view components.
 *
 * These exist so a button, a form field or a status badge is built one way
 * across the whole site. When a page needs a variation it passes an option
 * rather than hand-rolling markup, which is what keeps the design system from
 * drifting page to page.
 */
import { html, raw, cx } from '../lib/html.js';
import { icon, starIcon } from './icons.js';
import { CSRF_FIELD } from '../http/csrf.js';

/** Hidden CSRF input. Every state-changing form must include this. */
export function csrfField(token) {
  return html`<input type="hidden" name="${CSRF_FIELD}" value="${token}" />`;
}

/**
 * A honeypot plus a timing check. Together they stop the overwhelming
 * majority of automated form spam without making a human solve a puzzle,
 * which is the accessible way to meet the bot-protection requirement.
 */
export function botTrap(issuedAt) {
  return html`
    <div class="visually-hidden" aria-hidden="true">
      <label for="website-url">Leave this field empty</label>
      <input type="text" id="website-url" name="website_url" tabindex="-1" autocomplete="off" />
    </div>
    <input type="hidden" name="form_started" value="${issuedAt}" />
  `;
}

/**
 * A form field with label, hint, error and optional counter, wired together
 * with the ids that assistive technology needs.
 */
export function field({
  name,
  label,
  type = 'text',
  value = '',
  hint = '',
  error = '',
  required = false,
  autocomplete,
  maxlength,
  rows,
  placeholder,
  inputmode,
  pattern,
  counter = false,
  options,
}) {
  const id = `field-${name}`;
  const hintId = hint ? `${id}-hint` : '';
  const errorId = error ? `${id}-error` : '';
  const counterId = counter ? `${id}-counter` : '';
  const describedBy = [hintId, errorId, counterId].filter(Boolean).join(' ');

  const shared = raw(
    [
      `id="${id}"`,
      `name="${name}"`,
      'class="field__control"',
      required ? 'required' : '',
      describedBy ? `aria-describedby="${describedBy}"` : '',
      error ? 'aria-invalid="true"' : '',
      autocomplete ? `autocomplete="${autocomplete}"` : '',
      maxlength ? `maxlength="${maxlength}"` : '',
      placeholder ? `placeholder="${placeholder}"` : '',
      inputmode ? `inputmode="${inputmode}"` : '',
      pattern ? `pattern="${pattern}"` : '',
      counter ? `data-counter="${counterId}"` : '',
    ]
      .filter(Boolean)
      .join(' '),
  );

  let control;
  if (type === 'textarea') {
    control = html`<textarea ${shared} rows="${rows || 6}">${value}</textarea>`;
  } else if (type === 'select') {
    control = html`<select ${shared}>
      ${options.map(
        (option) => html`<option value="${option.value}" ${option.value === value ? raw('selected') : ''}>${option.label}</option>`,
      )}
    </select>`;
  } else {
    control = html`<input ${shared} type="${type}" value="${value}" />`;
  }

  return html`
    <div class="${cx('field', error && 'field--invalid')}">
      <label class="field__label" for="${id}">
        ${label}${required ? '' : html` <span class="text-muted">(optional)</span>`}
      </label>
      ${hint ? html`<p class="field__hint" id="${hintId}">${hint}</p>` : ''}
      ${control}
      ${counter ? html`<span class="field__counter" id="${counterId}"></span>` : ''}
      ${error ? html`<p class="field__error" id="${errorId}">${icon('error')}<span>${error}</span></p>` : ''}
    </div>
  `;
}

/** Password field with a visibility toggle and optional strength meter. */
export function passwordField({ name, label, error = '', hint = '', autocomplete = 'current-password', strength = false }) {
  const id = `field-${name}`;
  const hintId = hint ? `${id}-hint` : '';
  const errorId = error ? `${id}-error` : '';
  const describedBy = [hintId, errorId, strength ? `${id}-strength` : ''].filter(Boolean).join(' ');

  return html`
    <div class="${cx('field', error && 'field--invalid')}">
      <label class="field__label" for="${id}">${label}</label>
      ${hint ? html`<p class="field__hint" id="${hintId}">${hint}</p>` : ''}
      <div class="password-field">
        <input
          class="field__control"
          id="${id}"
          name="${name}"
          type="password"
          required
          autocomplete="${autocomplete}"
          ${describedBy ? raw(`aria-describedby="${describedBy}"`) : ''}
          ${error ? raw('aria-invalid="true"') : ''}
        />
        <button
          type="button"
          class="password-toggle"
          data-password-toggle="${id}"
          aria-pressed="false"
          aria-label="Show password"
          hidden
        >
          <span data-icon-show>${icon('eye')}</span>
          <span data-icon-hide hidden>${icon('eyeOff')}</span>
        </button>
      </div>
      ${strength
        ? html`<div class="strength" id="${id}-strength" data-strength-for="${id}" hidden>
            <div class="strength__track"><div class="strength__fill" data-level="0"></div></div>
            <span class="strength__text" role="status"></span>
          </div>`
        : ''}
      ${error ? html`<p class="field__error" id="${errorId}">${icon('error')}<span>${error}</span></p>` : ''}
    </div>
  `;
}

/** A star rating built from radio inputs, so it works without JavaScript. */
export function ratingField({ name = 'rating', error = '' }) {
  const stars = [5, 4, 3, 2, 1];
  return html`
    <fieldset class="${cx('field', error && 'field--invalid')}">
      <legend class="field__label">Your rating</legend>
      <div class="rating">
        ${stars.map(
          (n) => html`
            <input type="radio" id="rating-${n}" name="${name}" value="${n}" required />
            <label for="rating-${n}">
              ${starIcon()}<span class="visually-hidden">${n} out of 5</span>
            </label>
          `,
        )}
      </div>
      ${error ? html`<p class="field__error">${icon('error')}<span>${error}</span></p>` : ''}
    </fieldset>
  `;
}

const MESSAGE_ICONS = { info: 'info', success: 'success', warning: 'warning', error: 'error' };

/**
 * A status message. Colour is never the only signal: each variant carries a
 * distinct icon and its own wording.
 */
export function message(kind, content, { title = '', list = [] } = {}) {
  const live = kind === 'error' ? 'assertive' : 'polite';
  const role = kind === 'error' ? 'alert' : 'status';
  return html`
    <div class="message message--${kind}" role="${role}" aria-live="${live}">
      ${icon(MESSAGE_ICONS[kind])}
      <div>
        ${title ? html`<strong>${title}</strong>` : ''}
        <span>${content}</span>
        ${list.length
          ? html`<ul class="message__list">
              ${list.map((item) => html`<li>${item}</li>`)}
            </ul>`
          : ''}
      </div>
    </div>
  `;
}

/** Summarises validation failures above a form and links to each field. */
export function errorSummary(errors) {
  const entries = Object.entries(errors || {});
  if (entries.length === 0) return '';
  return html`
    <div class="message message--error" role="alert" tabindex="-1" id="error-summary">
      ${icon('error')}
      <div>
        <strong>${entries.length === 1 ? 'There is one problem with this form' : `There are ${entries.length} problems with this form`}</strong>
        <ul class="message__list">
          ${entries.map(([name, text]) => html`<li><a href="#field-${name}">${text}</a></li>`)}
        </ul>
      </div>
    </div>
  `;
}

const BADGE_ICONS = { positive: 'success', caution: 'warning', critical: 'error', neutral: 'info' };

export function badge(tone, label) {
  return html`<span class="badge badge--${tone}">${icon(BADGE_ICONS[tone])}<span>${label}</span></span>`;
}

/** A statistic with the source printed beneath it. */
export function stat({ value, label, detail, source, publisher, url, retrieved }) {
  return html`
    <div class="stat">
      <p class="stat__value">${value}</p>
      <p class="stat__label">${label}</p>
      ${detail ? html`<p class="text-sm text-muted">${detail}</p>` : ''}
      <p class="stat__source">
        Source:
        <a href="${url}" rel="noopener noreferrer">${publisher}, ${source}</a>${retrieved ? html` (retrieved ${retrieved})` : ''}
      </p>
    </div>
  `;
}

export function panel(content, { tone = '', tag = 'div', label = '' } = {}) {
  const cls = cx('panel', tone && `panel--${tone}`);
  return raw(
    `<${tag} class="${cls}"${label ? ` aria-label="${label}"` : ''}>${content}</${tag}>`,
  );
}

/** An expandable disclosure. Uses <details> so it works with JS disabled. */
export function accordionItem({ question, answer, open = false }) {
  return html`
    <details class="accordion" ${open ? raw('open') : ''}>
      <summary>
        <span>${question}</span>
        ${icon('chevronDown')}
      </summary>
      <div class="accordion__body">${answer}</div>
    </details>
  `;
}

/** A copyable code line with a confirmation. */
export function copyable(text, { id, label = 'Copy' }) {
  return html`
    <div class="copyable">
      <code id="${id}">${text}</code>
      <button type="button" class="btn btn--quiet btn--sm" data-copy="#${id}">
        ${icon('copy')}<span data-copy-label>${label}</span>
      </button>
    </div>
  `;
}

/** The empty state pattern: says what is missing and what to do about it. */
export function emptyState({ title, body, action }) {
  return html`
    <div class="empty-state">
      ${icon('document')}
      <h3>${title}</h3>
      <p>${body}</p>
      ${action ? html`<p>${action}</p>` : ''}
    </div>
  `;
}

/** Page heading block with optional last-updated line. */
export function pageHeader({ title, lead, updated, meta }) {
  return html`
    <div class="page-header">
      <div class="container">
        <h1>${title}</h1>
        ${lead ? html`<p class="lead">${lead}</p>` : ''}
        ${updated || meta
          ? html`<p class="page-header__meta">
              ${updated ? html`Last updated <time datetime="${updated}">${formatDate(updated)}</time>` : ''}
              ${updated && meta ? raw(' &middot; ') : ''}${meta || ''}
            </p>`
          : ''}
      </div>
    </div>
  `;
}

/** Consistent, unambiguous date formatting. */
export function formatDate(iso) {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** The confirmation dialog markup, included on pages with destructive actions. */
export function confirmDialog() {
  return html`
    <dialog id="confirm-dialog" aria-labelledby="confirm-dialog-title">
      <h2 id="confirm-dialog-title" data-confirm-title>Are you sure?</h2>
      <p data-confirm-body></p>
      <div class="dialog__actions">
        <form method="dialog"><button type="submit" class="btn btn--quiet">Cancel</button></form>
        <button type="button" class="btn btn--danger" data-confirm-ok>Confirm</button>
      </div>
    </dialog>
  `;
}

/** Visually hidden live region for copy confirmations. */
export function copyStatusRegion() {
  return html`<div id="copy-status" class="visually-hidden" role="status" aria-live="polite"></div>`;
}
