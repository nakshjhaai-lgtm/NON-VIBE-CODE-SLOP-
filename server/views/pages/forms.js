/**
 * Pages built around a form: contact, the thank-you page it leads to,
 * reviews, and the search page.
 */
import { html, raw, escapeHtml } from '../../lib/html.js';
import { icon } from '../icons.js';
import { site } from '../../lib/site.js';
import {
  pageHeader,
  field,
  csrfField,
  botTrap,
  errorSummary,
  message,
  emptyState,
  ratingField,
  formatDate,
  copyable,
  copyStatusRegion,
} from '../components.js';
import { highlight } from '../../lib/search.js';

export const CONTACT_TOPICS = [
  { value: 'support', label: 'Help with setup or something not working' },
  { value: 'listing', label: 'A domain that should or should not be blocked' },
  { value: 'hosted', label: 'The hosted plan' },
  { value: 'organisation', label: 'Schools, clinics and treatment services' },
  { value: 'documentation', label: 'Something wrong or missing in the documentation' },
  { value: 'notes', label: 'A response to something we wrote' },
  { value: 'accessibility', label: 'An accessibility problem' },
  { value: 'case-study', label: 'Sharing my own deployment figures' },
  { value: 'other', label: 'Something else' },
];

/* -------------------------------------------------------------- contact */

export function contactPage({ csrf, values = {}, errors = {}, issuedAt }) {
  return html`
    ${pageHeader({
      title: 'Contact',
      lead: `${site.contact.responseTime} There is no ticket queue and no chatbot; the message reaches one of two people.`,
      updated: '2026-08-20',
    })}

    <div class="section">
      <div class="container">
        <div class="split split--sidebar-left">
          <div class="stack">
            <div class="panel panel--accent">
              <h2>If gambling is causing harm right now</h2>
              <p>
                Please do not wait for us to reply. The National Gambling Helpline is free and open
                ${site.helpline.hours}.
              </p>
              <p>
                <a class="btn btn--primary" href="tel:${site.helpline.phoneHref}"
                  >${icon('phone')}<span>${site.helpline.phone}</span></a
                >
              </p>
              <p class="text-sm text-muted"><a href="/help">Other routes to support</a></p>
            </div>

            <div class="panel">
              <h2>Other ways to reach us</h2>
              <ul class="feature-list">
                <li>
                  ${icon('mail')}
                  <div>
                    <h3>Email</h3>
                    <p><a href="mailto:${site.contact.email}">${site.contact.email}</a></p>
                  </div>
                </li>
                <li>
                  ${icon('lock')}
                  <div>
                    <h3>Security reports</h3>
                    <p>
                      <a href="mailto:${site.contact.securityEmail}">${site.contact.securityEmail}</a>, and the
                      <a href="/security">disclosure policy</a>.
                    </p>
                  </div>
                </li>
                <li>
                  ${icon('phone')}
                  <div>
                    <h3>Telephone</h3>
                    <p>
                      <a href="tel:${site.contact.phoneHref}">${site.contact.phone}</a><br />
                      <span class="text-sm text-muted">${site.contact.hours}</span>
                    </p>
                  </div>
                </li>
                <li>
                  ${icon('location')}
                  <div>
                    <h3>Post</h3>
                    <p>
                      ${site.contact.address.street}<br />
                      ${site.contact.address.locality} ${site.contact.address.postcode}<br />
                      ${site.contact.address.countryName}
                    </p>
                    <p class="text-sm text-muted"><a href="/about">Directions and access</a></p>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          <div>
            ${errorSummary(errors)}

            <form method="post" action="/contact" class="stack" novalidate data-validate>
              ${csrfField(csrf)} ${botTrap(issuedAt)}

              <h2>Send a message</h2>

              ${field({
                name: 'name',
                label: 'Your name',
                required: true,
                autocomplete: 'name',
                maxlength: 80,
                value: values.name || '',
                error: errors.name || '',
              })}
              ${field({
                name: 'email',
                label: 'Email address',
                type: 'email',
                required: true,
                autocomplete: 'email',
                maxlength: 254,
                value: values.email || '',
                error: errors.email || '',
                hint: 'Used to reply to you, and for nothing else. We do not add it to a mailing list.',
              })}
              ${field({
                name: 'org',
                label: 'Organisation',
                required: false,
                autocomplete: 'organization',
                maxlength: 120,
                value: values.org || '',
                error: errors.org || '',
              })}
              ${field({
                name: 'topic',
                label: 'What is this about',
                type: 'select',
                required: true,
                value: values.topic || 'support',
                error: errors.topic || '',
                options: CONTACT_TOPICS,
              })}
              ${field({
                name: 'message',
                label: 'Message',
                type: 'textarea',
                required: true,
                rows: 8,
                maxlength: 4000,
                counter: true,
                value: values.message || '',
                error: errors.message || '',
                hint: 'If something is not working, please include what you tried and what happened instead.',
              })}

              <div class="field">
                <label class="choice" for="field-consent">
                  <input
                    type="checkbox"
                    id="field-consent"
                    name="consent"
                    value="on"
                    ${values.consent ? 'checked' : ''}
                    aria-describedby="${errors.consent ? 'field-consent-error' : 'field-consent-hint'}"
                  />
                  <span
                    >I understand this message will be stored so it can be answered, and deleted after twelve
                    months.</span
                  >
                </label>
                <p class="field__hint" id="field-consent-hint">
                  What we keep and for how long is set out in the <a href="/privacy">privacy policy</a>.
                </p>
                ${errors.consent
                  ? html`<p class="field__error" id="field-consent-error">${icon('error')}<span>${errors.consent}</span></p>`
                  : ''}
              </div>

              <div class="btn-row">
                <button type="submit" class="btn btn--primary">${icon('mail')}<span>Send message</span></button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function thankYouPage({ reference }) {
  return html`
    ${pageHeader({
      title: 'Message received',
      lead: 'It reached us. Here is what happens next.',
    })}

    <div class="section">
      <div class="container">
        <div class="stack" style="max-width: 68ch;">
          ${message('success', 'Your message has been saved and will be read by a person.', {
            title: 'Sent',
          })}

          <div class="panel">
            <h2>Your reference</h2>
            <p>Quote this if you need to chase the message or send more detail.</p>
            ${copyable(reference, { id: 'enquiry-reference', label: 'Copy reference' })}
          </div>

          <h2>What happens next</h2>
          <ol>
            <li>${site.contact.responseTime} That is a promise about the first reply, not about a resolution.</li>
            <li>The reply comes from a person at ${site.contact.supportEmail}. Add it to your contacts if your mail provider is strict.</li>
            <li>If it is a setup problem, we will usually ask which router you have and what your device currently reports as its resolver.</li>
          </ol>

          <h2>While you wait</h2>
          <ul>
            <li><a href="/docs/troubleshooting">Troubleshooting</a> covers the five problems we are asked about most, in order of frequency.</li>
            <li><a href="/docs/limitations">Limitations</a> explains the cases where the filter is behaving correctly but not doing what you hoped.</li>
            <li><a href="/faq">The FAQ</a> answers the commercial and privacy questions.</li>
          </ul>

          <div class="btn-row">
            <a class="btn" href="/">${icon('arrowLeft')}<span>Back to the home page</span></a>
            <a class="btn btn--quiet" href="/docs">Read the documentation</a>
          </div>
        </div>
      </div>
    </div>

    ${copyStatusRegion()}
  `;
}

/* -------------------------------------------------------------- reviews */

export function reviewsPage({ csrf, published, summary, values = {}, errors = {}, issuedAt, submitted }) {
  return html`
    ${pageHeader({
      title: 'Reviews',
      lead: 'What people who use this actually said. There are no invented ones, which is why this page may look empty.',
      updated: '2026-08-20',
      meta: summary.count ? `${summary.average} out of 5 from ${summary.count} reviews` : 'No reviews yet',
    })}

    <div class="section">
      <div class="container">
        <div class="split split--sidebar">
          <div class="stack">
            ${submitted
              ? message(
                  'success',
                  'Thank you. Your review has been saved and is waiting to be checked. It will appear here once we have confirmed it came from someone using the product.',
                  { title: 'Review received' },
                )
              : ''}

            <h2>Published reviews</h2>

            ${published.length === 0
              ? emptyState({
                  title: 'Nobody has left a review yet',
                  body: html`This is a new product with a small number of users, and none of them have written a
                    review. We could fill this space with plausible quotations from people who do not exist, which is
                    what a lot of sites do. We would rather show you an empty page and let you judge the product on
                    the documentation.`,
                  action: html`<a class="btn" href="#leave-a-review">Be the first</a>`,
                })
              : html`
                  <div class="stack">
                    ${published.map(
                      (review) => html`
                        <article class="review">
                          <div class="review__head">
                            <div>
                              <p class="review__name">${review.display_name}</p>
                              <p class="review__meta">${review.role}</p>
                            </div>
                            <p class="review__meta">
                              <span class="visually-hidden">Rated </span>${review.rating} out of 5
                            </p>
                          </div>
                          <p>${review.body}</p>
                        </article>
                      `,
                    )}
                  </div>
                `}
          </div>

          <div class="panel panel--sunken">
            <h2>How reviews are handled</h2>
            <ul class="text-sm">
              <li>Nothing is published automatically. A person reads each one first.</li>
              <li>We check the reviewer is a real user, usually by matching the email against an account or an enquiry.</li>
              <li>We do not edit the wording. We publish it or we do not.</li>
              <li>Critical reviews are published. A page of five-star reviews is not evidence of anything.</li>
              <li>Nothing is offered in exchange for a review.</li>
              <li>Your email address is never shown.</li>
            </ul>
            <p class="text-sm"><a href="/content-policy">The full content and proof policy</a></p>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="container">
        <div id="leave-a-review" style="max-width: 68ch;">
          <h2>Leave a review</h2>
          ${errorSummary(errors)}
          <form method="post" action="/reviews" class="stack" novalidate data-validate>
            ${csrfField(csrf)} ${botTrap(issuedAt)}
            ${ratingField({ name: 'rating', error: errors.rating || '' })}
            ${field({
              name: 'display_name',
              label: 'Name to display',
              required: true,
              maxlength: 80,
              value: values.display_name || '',
              error: errors.display_name || '',
              hint: 'A first name and initial is fine. This is shown publicly.',
            })}
            ${field({
              name: 'role',
              label: 'How you use it',
              required: true,
              maxlength: 80,
              value: values.role || '',
              error: errors.role || '',
              hint: 'For example: parent of two, self-hosting on a Pi, IT lead at a treatment service.',
            })}
            ${field({
              name: 'email',
              label: 'Email address',
              type: 'email',
              required: true,
              autocomplete: 'email',
              maxlength: 254,
              value: values.email || '',
              error: errors.email || '',
              hint: 'Not published. Used only to check the review is genuine, and deleted once it is.',
            })}
            ${field({
              name: 'body',
              label: 'Your review',
              type: 'textarea',
              required: true,
              rows: 6,
              maxlength: 4000,
              counter: true,
              value: values.body || '',
              error: errors.body || '',
              hint: 'What you were trying to do, and whether it worked. Specific is more useful than positive.',
            })}
            <div class="btn-row">
              <button type="submit" class="btn btn--primary">${icon('star')}<span>Submit review</span></button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}

/* --------------------------------------------------------------- search */

export function searchPage({ query, results, suggestions, documentCount }) {
  const trimmed = (query || '').trim();

  return html`
    ${pageHeader({
      title: 'Search',
      lead: `Covers all ${documentCount} pages on this site: documentation, notes and everything else.`,
    })}

    <div class="section">
      <div class="container">
        <div style="max-width: 68ch;">
          <form class="search-form" method="get" action="/search" role="search">
            <label class="field__label" for="field-q">Search this site</label>
            <div class="input-group">
              <input
                class="field__control"
                id="field-q"
                name="q"
                type="search"
                value="${trimmed}"
                maxlength="100"
                autocomplete="off"
                spellcheck="false"
                aria-describedby="search-hint"
              />
              <button type="submit" class="btn btn--primary">${icon('search')}<span>Search</span></button>
            </div>
            <p class="field__hint" id="search-hint">
              Whole words work best. The index is built at startup and searched on the server, so nothing about your
              query leaves this request.
            </p>
          </form>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="container">
        <div style="max-width: 68ch;">
          ${!trimmed
            ? html`
                <h2>Popular pages</h2>
                <ul>
                  <li><a href="/docs/quick-start">Quick start</a></li>
                  <li><a href="/docs/router-setup">Router setup</a></li>
                  <li><a href="/docs/troubleshooting">Troubleshooting</a></li>
                  <li><a href="/docs/limitations">What this cannot do</a></li>
                  <li><a href="/coverage">Check whether a domain is blocked</a></li>
                </ul>
              `
            : results.length === 0
              ? html`
                  ${emptyState({
                    title: `Nothing matched "${trimmed}"`,
                    body: suggestions.length
                      ? html`Did you mean <a href="/search?q=${encodeURIComponent(suggestions[0])}">${suggestions[0]}</a>?`
                      : 'Try a shorter phrase, or a word that would appear in the page itself rather than a description of it.',
                    action: html`<a class="btn" href="/contact?topic=documentation">Ask us instead</a>`,
                  })}
                `
              : html`
                  <h2>${results.length} ${results.length === 1 ? 'result' : 'results'} for "${trimmed}"</h2>
                  <ol class="stack">
                    ${results.map(
                      (result) => html`
                        <li class="search-result">
                          <h3><a href="${result.url}">${result.title}</a></h3>
                          <p class="search-result__url">${site.origin}${result.url}</p>
                          <p>${raw(highlight(result.excerpt, trimmed, escapeHtml))}</p>
                          ${result.updated
                            ? html`<p class="text-sm text-muted">
                                Updated <time datetime="${result.updated}">${formatDate(result.updated)}</time>
                              </p>`
                            : ''}
                        </li>
                      `,
                    )}
                  </ol>
                `}
        </div>
      </div>
    </div>
  `;
}
