/**
 * Error pages. A 404 that helps you find the thing you wanted is worth more
 * than a large number and a joke.
 */
import { html } from '../../lib/html.js';
import { icon } from '../icons.js';
import { site } from '../../lib/site.js';

const SUGGESTIONS = [
  { href: '/docs/quick-start', label: 'Quick start' },
  { href: '/docs/troubleshooting', label: 'Troubleshooting' },
  { href: '/coverage', label: 'Check a domain' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/blog', label: 'Engineering notes' },
  { href: '/contact', label: 'Contact us' },
];

export function notFoundPage({ path }) {
  return html`
    <div class="error-page">
      <div class="container">
        <span class="error-page__code">Error 404</span>
        <h1>That page is not here</h1>
        <p class="lede">
          ${path ? html`Nothing is published at <code class="mono">${path}</code>.` : 'Nothing is published at that address.'}
          It may have moved, or the link that brought you here may be wrong.
        </p>

        <form class="search-form" method="get" action="/search" role="search">
          <label class="field__label" for="field-q">Search the site</label>
          <div class="input-group">
            <input class="field__control" id="field-q" name="q" type="search" maxlength="100" autocomplete="off" />
            <button type="submit" class="btn btn--primary">${icon('search')}<span>Search</span></button>
          </div>
        </form>

        <h2>Or try one of these</h2>
        <ul>
          ${SUGGESTIONS.map((item) => html`<li><a class="btn btn--quiet btn--sm" href="${item.href}">${item.label}</a></li>`)}
        </ul>

        <p class="text-sm text-muted">
          If a link on this site brought you here, that is our mistake.
          <a href="/contact?topic=documentation">Tell us which page it was on</a> and we will fix it.
        </p>
      </div>
    </div>
  `;
}

export function serverErrorPage({ reference }) {
  return html`
    <div class="error-page">
      <div class="container">
        <span class="error-page__code">Error 500</span>
        <h1>Something broke at our end</h1>
        <p class="lede">
          This is a fault in our code, not something you did. The request was not completed and nothing was saved.
        </p>
        ${reference
          ? html`<p>
              The fault was logged with the reference <code class="mono">${reference}</code>. Quoting it lets us find
              the exact request.
            </p>`
          : ''}
        <p>
          If it keeps happening, email
          <a href="mailto:${site.contact.supportEmail}">${site.contact.supportEmail}</a>.
          ${site.contact.responseTime}
        </p>
        <ul>
          <li><a class="btn btn--quiet btn--sm" href="/">Home</a></li>
          <li><a class="btn btn--quiet btn--sm" href="/status">Service status</a></li>
        </ul>
      </div>
    </div>
  `;
}

/** Shown when a rate limit is hit on a page request rather than an API call. */
export function tooManyRequestsPage({ retryAfter }) {
  return html`
    <div class="error-page">
      <div class="container">
        <span class="error-page__code">Error 429</span>
        <h1>Too many requests</h1>
        <p class="lede">
          This address has made more requests than the limit allows. The limit exists to keep a small service
          available, and it resets shortly.
        </p>
        <p>Try again in ${retryAfter} ${retryAfter === 1 ? 'second' : 'seconds'}.</p>
        <p class="text-sm text-muted">
          If you are doing something legitimate that needs a higher limit,
          <a href="/contact?topic=other">tell us what it is</a> rather than working around it.
        </p>
      </div>
    </div>
  `;
}

export function forbiddenPage({ reason }) {
  return html`
    <div class="error-page">
      <div class="container">
        <span class="error-page__code">Error 403</span>
        <h1>That request was rejected</h1>
        <p class="lede">${reason || 'The security check on this request did not pass.'}</p>
        <p>
          The usual cause is a form left open long enough for its token to expire, or a browser that is blocking this
          site's cookies. Reloading the page and submitting again normally fixes it.
        </p>
        <ul>
          <li><a class="btn btn--quiet btn--sm" href="/">Home</a></li>
          <li><a class="btn btn--quiet btn--sm" href="/contact">Contact us</a></li>
        </ul>
      </div>
    </div>
  `;
}
