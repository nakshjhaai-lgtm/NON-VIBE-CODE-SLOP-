/**
 * FAQ, gambling support resources, service status, changelog and sitemap.
 */
import { html } from '../../lib/html.js';
import { icon } from '../icons.js';
import { site, primaryNav, footerNav } from '../../lib/site.js';
import { counts } from '../../lib/blocklists.js';
import { pageHeader, accordionItem, message, badge, formatDate, copyStatusRegion } from '../components.js';
import { allDocs, allPosts } from '../../lib/content.js';

/* ------------------------------------------------------------------ FAQ */

export const FAQ = [
  {
    question: 'Can this be bypassed?',
    answer: html`<p>
        Yes, in four ways, and anyone who tells you otherwise is selling something. Somebody with administrator rights
        can change the DNS setting back in under a minute. A VPN carries its own DNS. Mobile data is a different
        network entirely. A browser configured to use its own encrypted resolver never asks us.
      </p>
      <p>
        DNS filtering removes the accidental and the impulsive, not the determined.
        <a href="/docs/limitations">The limitations page</a> goes through each case and says what, if anything, can be
        done about it.
      </p>`,
  },
  {
    question: 'Do you log what sites I visit?',
    answer: html`<p>
        Not by default. The resolver keeps answers in memory to serve them faster, and writes no record of who asked
        for what. You can turn logging on for your own instance if you need it for troubleshooting, and the setting
        explains what it means before you do.
      </p>
      <p>
        This is not free for us: it means we cannot show you a weekly summary, and cannot prove our own effectiveness
        with data. <a href="/blog/no-query-logs-by-default">We wrote about the trade-off</a>.
      </p>`,
  },
  {
    question: 'Why is your blocklist so much smaller than everyone else\u2019s?',
    answer: html`<p>
        We publish ${counts().total} suffix rules. Products advertising millions of entries are counting subdomain
        permutations, country variants and domains that stopped resolving years ago. A suffix rule for
        <code class="mono">bet365.com</code> already covers every subdomain, so counting them separately inflates the
        number without changing what is blocked.
      </p>
      <p>
        The honest cost of a short, hand-checked list is that it misses the offshore long tail.
        <a href="/blog/why-blocklist-counts-are-meaningless">The argument in full</a>.
      </p>`,
  },
  {
    question: 'Will this break anything else on my network?',
    answer: html`<p>
        Occasionally. A suffix rule can catch a service that shares a parent domain with a listed site; that happened
        to our own television's update endpoint. When it does, the coverage checker tells you which rule matched, and
        you can report it or add an allowlist entry. Corrections are published in the
        <a href="/changelog">changelog</a>.
      </p>`,
  },
  {
    question: 'What happens if your resolver goes down?',
    answer: html`<p>
        Your devices fall back to whatever secondary resolver they were given. If that is a public resolver, you get
        unfiltered internet rather than no internet. This is a genuine trade-off and you should choose it
        deliberately: <a href="/docs/troubleshooting">troubleshooting</a> explains both configurations and why we do
        not decide for you.
      </p>`,
  },
  {
    question: 'Is the hosted plan required?',
    answer: html`<p>
        No. The self-hosted version is free, complete, and is the same software. The hosted plan exists for people who
        would rather not run a server. Nothing is held back from the free version to make the paid one look better.
      </p>`,
  },
  {
    question: 'Do you work with GAMSTOP?',
    answer: html`<p>
        No, and we are not a substitute for it. GAMSTOP is the national self-exclusion scheme; it stops licensed
        British operators from accepting you as a customer, which is a stronger and more durable measure than
        filtering DNS. If you have not registered with it, do that first.
        <a href="/help">Support routes, including GAMSTOP</a>.
      </p>`,
  },
  {
    question: 'Can I use this for something other than gambling?',
    answer: html`<p>
        Technically yes, the resolver does not care what is on a list. We publish gambling, affiliate, lottery and
        crypto-gambling lists and maintain only those, because a list nobody is reviewing is worse than no list.
      </p>`,
  },
];

export function faqPage() {
  return html`
    ${pageHeader({
      title: 'Frequently asked questions',
      lead: 'The eight questions we are actually asked, answered without hedging.',
      updated: '2026-08-20',
    })}

    <div class="section">
      <div class="container">
        <div style="max-width: 68ch;">
          ${FAQ.map((entry, index) => accordionItem({ ...entry, open: index === 0 }))}

          <div class="stack" style="margin-top: 2rem;">
            <h2>Not answered here</h2>
            <p>
              <a href="/contact">Send the question</a> and we will answer it. If it comes up twice it goes on this
              page. ${site.contact.responseTime}
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function faqSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((entry) => ({
      '@type': 'Question',
      name: String(entry.question),
      acceptedAnswer: {
        '@type': 'Answer',
        // Strip markup: schema.org answers are plain text.
        text: String(entry.answer)
          .replace(/<[^>]+>/g, ' ')
          .replace(/&[a-z]+;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim(),
      },
    })),
  };
}

/* ----------------------------------------------------------------- help */

const RESOURCES = [
  {
    name: 'National Gambling Helpline',
    org: 'GamCare',
    detail:
      'Free and confidential, 24 hours a day, every day of the year. Available by telephone, live chat and WhatsApp. Also arranges free treatment across England, Scotland and Wales.',
    phone: site.helpline.phone,
    phoneHref: site.helpline.phoneHref,
    url: 'https://www.gamcare.org.uk/',
    urlLabel: 'gamcare.org.uk',
  },
  {
    name: 'GAMSTOP',
    org: 'The National Online Self-Exclusion Scheme',
    detail:
      'A free national scheme that stops every operator licensed in Great Britain from accepting you as a customer, for six months, one year or five years. Stronger than any filter, because it does not depend on your device settings.',
    url: 'https://www.gamstop.co.uk/',
    urlLabel: 'gamstop.co.uk',
  },
  {
    name: 'BeGambleAware',
    org: 'GambleAware',
    detail: 'Information, self-assessment tools and a directory of local treatment services.',
    url: 'https://www.begambleaware.org/',
    urlLabel: 'begambleaware.org',
  },
  {
    name: 'National Gambling Treatment Service',
    org: 'NHS',
    detail:
      'NHS gambling clinics take self-referrals in most of England. Treatment is free at the point of use and includes support for family members.',
    url: 'https://www.nhs.uk/live-well/addiction-support/gambling-addiction/',
    urlLabel: 'nhs.uk',
  },
  {
    name: 'Gamblers Anonymous Great Britain',
    org: 'Gamblers Anonymous',
    detail: 'Peer support meetings, in person and online, across Great Britain. Gam-Anon runs parallel meetings for family and friends.',
    url: 'https://www.gamblersanonymous.org.uk/',
    urlLabel: 'gamblersanonymous.org.uk',
  },
  {
    name: 'Citizens Advice',
    org: 'Citizens Advice',
    detail: 'Free, independent advice on debt, which is often the most urgent consequence and the one a filter does nothing about.',
    url: 'https://www.citizensadvice.org.uk/',
    urlLabel: 'citizensadvice.org.uk',
  },
  {
    name: 'Samaritans',
    org: 'Samaritans',
    detail: 'If things feel unbearable. Free to call from any phone, 24 hours a day.',
    phone: '116 123',
    phoneHref: '116123',
    url: 'https://www.samaritans.org/',
    urlLabel: 'samaritans.org',
  },
];

export function helpPage() {
  return html`
    ${pageHeader({
      title: 'Getting support',
      lead: 'Organisations that help with gambling harm. None of them are us, and all of them can do more than a DNS filter can.',
      updated: '2026-08-23',
    })}

    <div class="section">
      <div class="container">
        <div class="split split--sidebar">
          <div class="stack">
            <div class="panel panel--accent">
              <h2>Right now</h2>
              <p>The National Gambling Helpline is free, confidential and open ${site.helpline.hours}.</p>
              <div class="btn-row">
                <a class="btn btn--primary" href="tel:${site.helpline.phoneHref}"
                  >${icon('phone')}<span>Call ${site.helpline.phone}</span></a
                >
                <a class="btn" href="${site.helpline.url}" rel="noopener noreferrer"
                  >${icon('external')}<span>Live chat at gamcare.org.uk</span></a
                >
              </div>
              <p class="text-sm text-muted">${site.helpline.note}</p>
            </div>

            <h2>Where to go</h2>
            <ul class="stack">
              ${RESOURCES.map(
                (resource) => html`
                  <li class="panel">
                    <h3>${resource.name}</h3>
                    <p class="text-sm text-muted">${resource.org}</p>
                    <p>${resource.detail}</p>
                    <p>
                      ${resource.phone
                        ? html`<a href="tel:${resource.phoneHref}">${icon('phone')}<span>${resource.phone}</span></a> &middot; `
                        : ''}
                      <a href="${resource.url}" rel="noopener noreferrer">${icon('external')}<span>${resource.urlLabel}</span></a>
                    </p>
                  </li>
                `,
              )}
            </ul>
          </div>

          <div class="stack">
            <div class="panel panel--sunken">
              <h2>These are never blocked</h2>
              <p class="text-sm">
                Every domain on this page is on our never-block list. It is checked before any blocklist, so no list
                and no configuration can put a filter between someone and a route to help.
              </p>
              <p class="text-sm"><a href="/coverage">See the never-block list</a></p>
            </div>
            <div class="panel panel--sunken">
              <h2>We are not a support service</h2>
              <p class="text-sm">
                We build a DNS filter. We are not counsellors, we cannot advise on treatment, and our contact form is
                not monitored out of hours. Please use the helpline rather than waiting for us.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/* --------------------------------------------------------------- status */

/**
 * Status is derived from real process state: uptime of this web process and
 * whether the database answers. Nothing here is a hard-coded green tick.
 */
export function statusPage({ components, history, startedAt }) {
  const worst = components.some((c) => c.state === 'down')
    ? 'down'
    : components.some((c) => c.state === 'degraded')
      ? 'degraded'
      : 'operational';

  const tone = worst === 'operational' ? 'positive' : worst === 'degraded' ? 'caution' : 'critical';
  const headline =
    worst === 'operational'
      ? 'All components responding'
      : worst === 'degraded'
        ? 'One or more components degraded'
        : 'A component is not responding';

  return html`
    ${pageHeader({
      title: 'Service status',
      lead: 'Measured when you loaded this page, not fetched from a dashboard someone updates by hand.',
      meta: `Web process started ${formatDate(startedAt.slice(0, 10))}`,
    })}

    <div class="section">
      <div class="container">
        <div class="stack">
          ${message(worst === 'operational' ? 'success' : worst === 'degraded' ? 'warning' : 'error', headline, {
            title: 'Current status',
          })}

          <div class="stack">
            ${components.map(
              (component) => html`
                <div class="status-row" data-state="${component.state === 'operational' ? '' : component.state}">
                  <div>
                    <h2>${component.name}</h2>
                    <p class="text-sm text-muted">${component.detail}</p>
                  </div>
                  <div class="stack">
                    ${badge(
                      component.state === 'operational' ? 'positive' : component.state === 'degraded' ? 'caution' : 'critical',
                      component.state === 'operational' ? 'Responding' : component.state === 'degraded' ? 'Degraded' : 'Not responding',
                    )}
                    <div class="uptime-bars" role="img" aria-label="${component.historyLabel}">
                      ${component.bars.map((state) => html`<span data-state="${state === 'operational' ? '' : state}"></span>`)}
                    </div>
                  </div>
                </div>
              `,
            )}
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="container">
        <div class="split">
          <div>
            <h2>Recent incidents</h2>
            ${history.length === 0
              ? html`<p>None recorded. This log starts on 1 July 2026 and is written by hand when something breaks.</p>`
              : html`<ul class="stack">
                  ${history.map(
                    (entry) => html`
                      <li>
                        <p class="post-meta">
                          <time datetime="${entry.date}">${formatDate(entry.date)}</time> &middot; ${entry.duration}
                        </p>
                        <h3>${entry.title}</h3>
                        <p>${entry.detail}</p>
                      </li>
                    `,
                  )}
                </ul>`}
          </div>

          <div class="panel panel--sunken">
            <h2>What this page is not</h2>
            <p class="text-sm">
              It is not an uptime percentage measured by a third party, and there is no external monitoring service
              behind it. It reports what this web process can see about itself right now. A total outage would take
              this page down with it, which is the honest weakness of a self-hosted status page.
            </p>
            <p class="text-sm">
              If the site is unreachable and you need to know whether it is us, email
              <a href="mailto:${site.contact.supportEmail}">${site.contact.supportEmail}</a> from any other network.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ------------------------------------------------------------ changelog */

export const CHANGELOG = [
  {
    date: '2026-08-18',
    version: '0.9.2',
    changes: [
      { kind: 'Changed', text: 'The coverage API now returns the rule that matched, so a surprising block can be explained rather than just reported.' },
      { kind: 'Fixed', text: 'Narrowed an affiliate rule that was catching a shared CDN parent domain and stopping a television from updating.' },
    ],
  },
  {
    date: '2026-08-14',
    version: '0.9.1',
    changes: [
      { kind: 'Changed', text: 'Blocklists reviewed against the Gambling Commission public register. Four entries removed after their operators surrendered their licences.' },
      { kind: 'Added', text: 'Crypto-gambling list, off by default.' },
    ],
  },
  {
    date: '2026-08-04',
    version: '0.9.0',
    changes: [
      { kind: 'Added', text: 'Documentation for browser-level encrypted DNS, after a three-week support thread that turned out to be Firefox using its own resolver.' },
      { kind: 'Changed', text: 'Rewrote the limitations page to lead with reversibility rather than bury it.' },
      { kind: 'Removed', text: 'A proposed "protection status" indicator, which could not tell the truth on a device we cannot see.' },
    ],
  },
  {
    date: '2026-07-12',
    version: '0.8.1',
    changes: [
      { kind: 'Fixed', text: 'Resolver no longer holds a stale upstream socket after a network interface change, which caused intermittent SERVFAIL on laptops resuming from sleep.' },
    ],
  },
  {
    date: '2026-05-09',
    version: '0.7.0',
    changes: [
      { kind: 'Changed', text: 'Blocked lookups answer NXDOMAIN instead of 0.0.0.0. Existing installations keep their current setting rather than being changed underneath them.' },
      { kind: 'Fixed', text: 'Blocked lookups no longer trigger DNS rebind protection on Asus routers, which was discarding the answer and causing thirty-second stalls.' },
    ],
  },
  {
    date: '2026-06-17',
    version: '0.8.0',
    changes: [
      { kind: 'Changed', text: 'Query logging is off by default on new installations. Existing installations are unchanged and are told about the new default.' },
      { kind: 'Added', text: 'Signed blocklist distribution, so a refresh can be verified rather than trusted.' },
    ],
  },
];

export function changelogPage() {
  const entries = [...CHANGELOG].sort((a, b) => (a.date < b.date ? 1 : -1));

  return html`
    ${pageHeader({
      title: 'Changelog',
      lead: 'Every release, including the ones that fixed something we broke. Corrections to this website are listed here too.',
      updated: entries[0].date,
    })}

    <div class="section">
      <div class="container">
        <div class="stack-lg" style="max-width: 68ch;">
          ${entries.map(
            (entry) => html`
              <section aria-labelledby="release-${entry.version.replace(/\./g, '-')}">
                <h2 id="release-${entry.version.replace(/\./g, '-')}">
                  ${entry.version}
                  <span class="text-sm text-muted">
                    <time datetime="${entry.date}">${formatDate(entry.date)}</time>
                  </span>
                </h2>
                <ul class="stack">
                  ${entry.changes.map(
                    (change) => html`
                      <li>
                        ${badge(
                          change.kind === 'Fixed' ? 'caution' : change.kind === 'Removed' ? 'critical' : 'neutral',
                          change.kind,
                        )}
                        <span>${change.text}</span>
                      </li>
                    `,
                  )}
                </ul>
              </section>
            `,
          )}
        </div>
      </div>
    </div>
  `;
}

/* -------------------------------------------------------------- sitemap */

export function sitemapPage() {
  return html`
    ${pageHeader({
      title: 'Sitemap',
      lead: 'Every page on this site, on one page. The machine-readable version is at /sitemap.xml.',
    })}

    <div class="section">
      <div class="container">
        <div class="grid grid--2">
          <nav aria-labelledby="sm-main">
            <h2 id="sm-main">Main pages</h2>
            <ul>
              <li><a href="/">Home</a></li>
              ${primaryNav.map((item) => html`<li><a href="${item.href}">${item.label}</a></li>`)}
              <li><a href="/search">Search</a></li>
              <li><a href="/login">Sign in</a></li>
            </ul>
          </nav>

          <nav aria-labelledby="sm-docs">
            <h2 id="sm-docs">Documentation</h2>
            <ul>
              <li><a href="/docs">Documentation index</a></li>
              ${allDocs().map((doc) => html`<li><a href="/docs/${doc.slug}">${doc.title}</a></li>`)}
            </ul>
          </nav>

          <nav aria-labelledby="sm-blog">
            <h2 id="sm-blog">Notes</h2>
            <ul>
              <li><a href="/blog">All notes</a></li>
              ${allPosts().map((post) => html`<li><a href="/blog/${post.slug}">${post.title}</a></li>`)}
            </ul>
          </nav>

          ${footerNav.map(
            (group) => html`
              <nav aria-labelledby="sm-${group.heading.toLowerCase()}">
                <h2 id="sm-${group.heading.toLowerCase()}">${group.heading}</h2>
                <ul>
                  ${group.links.map((link) => html`<li><a href="${link.href}">${link.label}</a></li>`)}
                </ul>
              </nav>
            `,
          )}
        </div>
      </div>
    </div>

    ${copyStatusRegion()}
  `;
}
