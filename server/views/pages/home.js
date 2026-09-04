import { html } from '../../lib/html.js';
import { icon } from '../icons.js';
import { site, statistics, statisticsCaveat } from '../../lib/site.js';
import { counts } from '../../lib/blocklists.js';
import { stat, message, csrfField, copyStatusRegion, formatDate } from '../components.js';
import { allPosts } from '../../lib/content.js';

/**
 * The home page.
 *
 * The primary action sits above the fold and is a real one: check a domain
 * against the published lists. There is no signup wall in front of it,
 * because the fastest way to find out whether this product is useful to you
 * is to try the thing it does.
 */
export function homePage({ csrf, reviewSummary, accountDeleted = false }) {
  const data = counts();
  const posts = allPosts().slice(0, 2);

  return html`
    ${accountDeleted
      ? html`<div class="container" style="padding-top: 1.5rem;">
          ${message(
            'success',
            html`Your account, its profiles and its allowlist entries have been deleted. There is no archived copy and
              nothing to restore. If you self-host, your resolver carries on working; it never needed an account.`,
            { title: 'Account deleted' },
          )}
        </div>`
      : ''}

    <section class="hero">
      <div class="container">
        <div class="hero__grid">
          <div class="hero__copy">
            <p class="eyebrow hero__eyebrow">${icon('shield')} Network-level DNS filtering</p>
            <h1>Block gambling sites on every device in the house, from one place</h1>
            <p class="lead">
              ${site.name} is a DNS resolver that refuses to look up gambling domains. Point your router at it once
              and every phone, laptop, console and television on the network is covered, with no software to install
              on any of them.
            </p>

            <form
              class="stack hero__form"
              id="coverage-form"
              action="/coverage"
              method="post"
              aria-labelledby="coverage-form-heading"
            >
              <h2 class="visually-hidden" id="coverage-form-heading">Check whether a domain is blocked</h2>
              ${csrfField(csrf)}
              <label class="field__label" for="field-domain">Check a domain against our lists</label>
              <div class="input-group">
                <input
                  class="field__control"
                  id="field-domain"
                  name="domain"
                  type="text"
                  inputmode="url"
                  autocomplete="off"
                  spellcheck="false"
                  placeholder="example.com"
                  maxlength="253"
                  aria-describedby="field-domain-hint"
                />
                <button type="submit" class="btn btn--primary">${icon('search')}<span>Check</span></button>
              </div>
              <p class="field__hint" id="field-domain-hint">
                No account, no email address. The lookup runs against the same lists the resolver uses.
              </p>
              <div class="coverage-result" id="coverage-result" role="region" aria-label="Coverage result" hidden></div>
            </form>

            <p class="hero__note">
              <span class="hero__rule">${data.total} suffix rules</span> across ${data.listCount} lists, each covering
              every subdomain. Last reviewed
              <time datetime="${data.lastUpdated}">${formatDate(data.lastUpdated)}</time>.
              <a href="/coverage">See every entry</a>.
            </p>
          </div>

          <div class="hero__aside">
            <figure class="hero__diagram">
              <img
                src="/img/network-diagram.svg"
                width="520"
                height="360"
                alt="Diagram showing NetGuard between a home router and the devices on its network."
                loading="eager"
                decoding="async"
              />
            </figure>
            <div class="panel panel--honesty">
              <p class="eyebrow panel__eyebrow">${icon('info')} Read before you rely on it</p>
              <h2>What this does not do</h2>
              <p class="text-sm">
                DNS filtering is a speed bump, not a lock. Anyone with administrator rights can undo it in a minute,
                a VPN bypasses it entirely, and mobile data is not covered at all.
              </p>
              <p class="text-sm">
                <a href="/docs/limitations">Read the full list of limitations</a> before you rely on it.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="section section--figures">
      <div class="container">
        <div class="section__intro">
          <p class="eyebrow section__label">The figures</p>
          <h2>Why anyone bothers</h2>
          <p>
            These figures come from the Gambling Commission's annual survey. They are quoted with their source and
            their uncertainty, because a statistic without either is decoration.
          </p>
        </div>

        <ul class="figures figures--3">
          <li>${stat(statistics.problemGambling)}</li>
          <li>${stat(statistics.youngAdults)}</li>
          <li>${stat(statistics.affectedOthers)}</li>
        </ul>

        <aside class="panel panel--note">
          <p class="eyebrow panel__eyebrow">${icon('info')} A note on these figures</p>
          <p class="text-sm">${statisticsCaveat}</p>
        </aside>
      </div>
    </section>

    <section class="section section--how">
      <div class="container">
        <div class="split">
          <div>
            <p class="eyebrow section__label">The mechanism</p>
            <h2>How it works</h2>
            <p>
              Every time a device opens a website it first asks a DNS resolver to turn the name into an address.
              ${site.name} sits in that position. When the name is on a list you have enabled, it answers that the
              name does not exist, and the connection never starts.
            </p>
            <p>
              That is the whole mechanism. It is why it covers devices with no settings screen, and why it is
              defeated by anything that does not ask DNS.
            </p>
            <p><a href="/how-it-works">The longer explanation, with the packet-level detail</a>.</p>
          </div>

          <ul class="feature-list">
            <li>
              <span class="feature-list__mark">${icon('server')}</span>
              <div>
                <p class="feature-list__num">01</p>
                <h3>One change, every device</h3>
                <p>Set it on the router and anything joining the network is covered, including devices you cannot configure.</p>
              </div>
            </li>
            <li>
              <span class="feature-list__mark">${icon('lock')}</span>
              <div>
                <p class="feature-list__num">02</p>
                <h3>No query logging by default</h3>
                <p>A DNS log is a diary of a household. Ours is off unless you turn it on, and we explain what turning it on means.</p>
              </div>
            </li>
            <li>
              <span class="feature-list__mark">${icon('document')}</span>
              <div>
                <p class="feature-list__num">03</p>
                <h3>Lists you can read</h3>
                <p>Every rule is published with the register it came from and the date a person last checked it.</p>
              </div>
            </li>
            <li>
              <span class="feature-list__mark">${icon('shield')}</span>
              <div>
                <p class="feature-list__num">04</p>
                <h3>Support routes are never blocked</h3>
                <p>GamCare, GAMSTOP, BeGambleAware, the NHS and Citizens Advice can never be filtered, whatever a list says.</p>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <section class="section section--reviews">
      <div class="container">
        <div class="section__intro">
          <p class="eyebrow section__label">Word of mouth</p>
          <h2>Reviews</h2>
        </div>
        ${reviewSummary.count === 0
          ? message(
              'info',
              html`This is a new product and nobody has left a review yet. Rather than fill the space with invented
                quotations, we have left it empty. When real reviews arrive they will appear here, with the
                verification we did on each.
                <a href="/reviews">Read the review policy or leave one</a>.`,
              { title: 'No reviews yet' },
            )
          : html`<p>
              ${reviewSummary.average} out of 5 from ${reviewSummary.count}
              ${reviewSummary.count === 1 ? 'review' : 'reviews'}. <a href="/reviews">Read them all</a>.
            </p>`}
      </div>
    </section>

    <section class="section section--notes">
      <div class="container">
        <div class="split">
          <div>
            <p class="eyebrow section__label">From the journal</p>
            <h2>Recent notes</h2>
            <ul class="post-list">
              ${posts.map(
                (post) => html`
                  <li>
                    <p class="post-meta">
                      <time datetime="${post.date}">${formatDate(post.date)}</time> &middot; ${post.readingMinutes} minute read
                    </p>
                    <h2><a href="/blog/${post.slug}">${post.title}</a></h2>
                    <p>${post.summary || post.description}</p>
                  </li>
                `,
              )}
            </ul>
            <p><a href="/blog">All notes</a></p>
          </div>

          <aside class="panel panel--callout">
            <p class="eyebrow panel__eyebrow">${icon('phone')} If gambling is causing harm right now</p>
            <h2>There is help, and it is free</h2>
            <p>
              The National Gambling Helpline is free, confidential and open ${site.helpline.hours}.
            </p>
            <p>
              <a class="btn btn--primary" href="tel:${site.helpline.phoneHref}">${icon('phone')}<span>Call ${site.helpline.phone}</span></a>
            </p>
            <p class="text-sm text-muted">
              Run by GamCare. ${site.helpline.note}
              <a href="/help">Other support routes</a>.
            </p>
          </aside>
        </div>
      </div>
    </section>

    <section class="section section--start">
      <div class="container">
        <div class="section__intro">
          <p class="eyebrow section__label">Take the first step</p>
          <h2>Start with one device</h2>
          <p>
            The quick start changes DNS settings on a single machine so you can see what filtering does before you
            change anything for anyone else. It takes about fifteen minutes and costs nothing.
          </p>
        </div>
        <div class="btn-row">
          <a class="btn btn--primary" href="/docs/quick-start">${icon('book')}<span>Read the quick start</span></a>
          <a class="btn" href="/pricing">See pricing</a>
          <a class="btn btn--quiet" href="/case-study">Read the deployment write-up</a>
        </div>
      </div>
    </section>

    ${copyStatusRegion()}
  `;
}

/** Structured data for the home page. Describes the organisation, honestly. */
export function homeSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: site.name,
    url: site.origin,
    logo: `${site.origin}/img/logo.svg`,
    description: site.description,
    email: site.contact.email,
    telephone: site.contact.phone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: site.contact.address.street,
      addressLocality: site.contact.address.locality,
      addressRegion: site.contact.address.region,
      postalCode: site.contact.address.postcode,
      addressCountry: site.contact.address.country,
    },
  };
}
