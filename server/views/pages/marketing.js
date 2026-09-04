/**
 * The explanatory pages: how it works, pricing, about, case study,
 * accessibility, security disclosure and the content policy.
 *
 * These share a file because they share a shape: a page header, then prose
 * sections built from the same components as everywhere else.
 */
import { html } from '../../lib/html.js';
import { icon } from '../icons.js';
import { site, statistics, legal } from '../../lib/site.js';
import { counts, lists, neverBlock } from '../../lib/blocklists.js';
import { pageHeader, badge, message, accordionItem, copyable, copyStatusRegion, formatDate } from '../components.js';

/* ---------------------------------------------------------- how it works */

export function howItWorksPage() {
  return html`
    ${pageHeader({
      title: 'How it works',
      lead: 'A resolver that answers most questions normally and declines a specific set. The mechanism in full, including where it stops.',
      updated: '2026-08-12',
    })}

    <div class="section">
      <div class="container">
        <div class="split split--sidebar">
          <div class="prose stack">
            <h2 id="the-lookup">The lookup</h2>
            <p>
              Opening a website begins with a question. Before any page content moves, the device asks a DNS resolver
              to turn a name such as <code class="mono">example.com</code> into an IP address. Only once it has an
              address can it open a connection.
            </p>
            <p>
              ${site.name} occupies that resolver position. For almost every name it behaves like any other resolver:
              it answers from cache if it can, and otherwise asks an upstream resolver and caches the reply. For names
              on a list you have enabled it answers <code class="mono">NXDOMAIN</code>, which means the name does not
              exist. The device gives up before a connection is attempted.
            </p>

            <h2 id="why-nxdomain">Why NXDOMAIN and not an address</h2>
            <p>
              The alternative is to answer with <code class="mono">0.0.0.0</code>, an address that goes nowhere. We
              shipped that first and it was a mistake: several routers discard such answers as a rebind attack, and
              some clients wait out a full TCP timeout before giving up.
              <a href="/blog/what-we-got-wrong-about-nxdomain">The postmortem is here</a>.
            </p>

            <h2 id="what-it-covers">What it covers</h2>
            <p>
              Anything that asks DNS, which in practice is nearly everything on a network. That includes devices with
              no settings screen worth using: televisions, consoles, smart speakers, a guest's phone joining the
              Wi-Fi.
            </p>
            <p>
              It covers them because the filtering happens at the network, not on the device. There is nothing to
              install and nothing to keep updated on each machine.
            </p>

            <h2 id="what-it-misses">What it misses</h2>
            <p>Four things, and it is worth being blunt about each.</p>
            <ul>
              <li>
                <strong>A browser using its own encrypted resolver.</strong> DNS over HTTPS lets an application skip
                the system resolver entirely. Nothing is broken and no error appears; we are simply not asked. See
                <a href="/docs/encrypted-dns">encrypted DNS</a>.
              </li>
              <li>
                <strong>A VPN.</strong> It takes DNS with it. There is no DNS-layer answer to this.
              </li>
              <li><strong>Mobile data.</strong> The filter applies to your network, and a phone that leaves it is unfiltered.</li>
              <li>
                <strong>Anyone with administrator rights.</strong> DNS is a setting, and settings can be changed back
                in under a minute.
              </li>
            </ul>
            <p><a href="/docs/limitations">The complete version of this list</a> is part of the documentation, not hidden in a footnote.</p>

            <h2 id="what-we-store">What we store</h2>
            <p>
              Query logging is off by default. The resolver holds answers in memory to serve them quickly; it does not
              write a record of who asked for what.
              <a href="/blog/no-query-logs-by-default">Why, and what it costs us</a>.
            </p>
            <p>
              This website keeps a little more, and the <a href="/privacy">privacy policy</a> lists all of it: an
              account row if you make one, an enquiry if you send one, and a day-salted hash for page counting if you
              accepted analytics.
            </p>
          </div>

          <nav class="toc" aria-labelledby="toc-heading">
            <h2 id="toc-heading">On this page</h2>
            <ul>
              <li><a href="#the-lookup">The lookup</a></li>
              <li><a href="#why-nxdomain">Why NXDOMAIN</a></li>
              <li><a href="#what-it-covers">What it covers</a></li>
              <li><a href="#what-it-misses">What it misses</a></li>
              <li><a href="#what-we-store">What we store</a></li>
            </ul>
          </nav>
        </div>
      </div>
    </div>
  `;
}

/* --------------------------------------------------------------- pricing */

const plans = [
  {
    name: 'Self-hosted',
    price: 'Free',
    period: 'no account required',
    desc: 'Run the resolver on your own hardware. This is the whole product; nothing is held back for a paid tier.',
    cta: { href: '/docs/self-hosting', label: 'Self-hosting guide' },
    includes: [
      'Every blocklist, with sources',
      'DNS over HTTPS endpoint',
      'Per-device allowlists',
      'Query logging, off by default',
      'Documentation and troubleshooting',
    ],
    excludes: ['Hosting, which is yours to provide', 'Support beyond email'],
  },
  {
    name: 'Hosted',
    price: '£4',
    period: 'per month, per network',
    desc: 'We run the resolver. Same software, same lists, on infrastructure you do not have to maintain.',
    recommended: true,
    cta: { href: '/contact?topic=hosted', label: 'Ask about hosted' },
    includes: [
      'Everything in self-hosted',
      'Two resolver locations for redundancy',
      'Dashboard for lists and allowlists',
      'Email support within one working day',
      'Cancel from the dashboard, no notice period',
    ],
    excludes: ['A contract or a minimum term'],
  },
  {
    name: 'Organisation',
    price: 'Talk to us',
    period: 'priced on what you need',
    desc: 'Schools, clinics and treatment services. Priced on the work involved rather than a per-seat number we invented.',
    cta: { href: '/contact?topic=organisation', label: 'Start a conversation' },
    includes: [
      'Everything in hosted',
      'Multiple networks under one account',
      'Help with rollout and router configuration',
      'A named person to email',
    ],
    excludes: [],
  },
];

export function pricingPage() {
  return html`
    ${pageHeader({
      title: 'Pricing',
      lead: 'Three ways to run it. The software is the same in all three; what differs is who operates it.',
      updated: '2026-08-01',
    })}

    <div class="section">
      <div class="container">
        <div class="grid grid--3">
          ${plans.map(
            (plan) => html`
              <div class="plan ${plan.recommended ? 'plan--recommended' : ''}">
                <h2 class="plan__name">${plan.name} ${plan.recommended ? badge('positive', 'Most households') : ''}</h2>
                <p class="plan__price">${plan.price} <span class="plan__period">${plan.period}</span></p>
                <p class="plan__desc">${plan.desc}</p>
                <ul>
                  ${plan.includes.map((item) => html`<li>${icon('check')}<span>${item}</span></li>`)}
                  ${plan.excludes.map((item) => html`<li data-excluded>${icon('minus')}<span>${item}</span></li>`)}
                </ul>
                <a class="btn ${plan.recommended ? 'btn--primary' : ''} btn--block" href="${plan.cta.href}">${plan.cta.label}</a>
              </div>
            `,
          )}
        </div>
      </div>
    </div>

    <div class="section">
      <div class="container">
        <div class="section__intro">
          <h2>Questions about the price</h2>
        </div>
        <div class="accordion">
          ${accordionItem({
            question: 'Why is the self-hosted version free?',
            answer: html`<p>
              Because the alternative is a filter that only exists while someone keeps paying for it, in a product
              category where losing the filter at a bad moment matters. The code and the lists are the product;
              hosting is a service we sell separately to people who would rather not run a server.
            </p>`,
            open: true,
          })}
          ${accordionItem({
            question: 'Is £4 per month per device?',
            answer: html`<p>
              Per network. A household with fifteen devices pays the same as a household with three, because the
              resolver does the same work either way.
            </p>`,
          })}
          ${accordionItem({
            question: 'Is there a free trial of the hosted plan?',
            answer: html`<p>
              There is no time-limited trial, because the self-hosted version is free and does the same thing. If you
              want to know whether the filtering suits you, run it on one device from the
              <a href="/docs/quick-start">quick start</a> and decide from there.
            </p>`,
          })}
          ${accordionItem({
            question: 'What happens if I stop paying?',
            answer: html`<p>
              The hosted resolver stops answering for your network at the end of the period you paid for. Your devices
              fall back to their secondary resolver, which for most people means unfiltered internet rather than no
              internet. We email before that happens. Your configuration is exportable at any time, so you can move it
              to a self-hosted instance.
            </p>`,
          })}
          ${accordionItem({
            question: 'Do you offer a discount for treatment services?',
            answer: html`<p>
              Yes, and we would rather discuss it than publish a percentage.
              <a href="/contact?topic=organisation">Get in touch</a> and tell us what you are doing.
            </p>`,
          })}
        </div>
      </div>
    </div>

    <div class="section">
      <div class="container">
        ${message(
          'info',
          html`Prices are in pounds sterling and include VAT where applicable. ${site.name} is
            ${legal.companyNumber === 'Not yet incorporated'
              ? 'not yet an incorporated company, which is why no company number appears in the footer. We will publish it when it exists.'
              : `registered in England and Wales, number ${legal.companyNumber}.`}`,
          { title: 'The commercial small print, such as it is' },
        )}
      </div>
    </div>
  `;
}

/* ----------------------------------------------------------------- about */

const team = [
  {
    initials: 'PR',
    name: 'Priya Raghunathan',
    role: 'Resolver and blocklists',
    bio: 'Maintains the resolver and reviews every blocklist change. Previously spent eight years on network infrastructure for an ISP.',
  },
  {
    initials: 'TB',
    name: 'Tomas Brennan',
    role: 'Web, documentation and support',
    bio: 'Writes the documentation and answers the support email. The troubleshooting page exists because he kept writing the same reply.',
  },
];

export function aboutPage() {
  return html`
    ${pageHeader({
      title: `About ${site.name}`,
      lead: 'Two people, one resolver, and a deliberate decision not to exaggerate anything.',
      updated: '2026-08-20',
    })}

    <div class="section">
      <div class="container">
        <div class="split">
          <div class="prose stack">
            <h2>Why this exists</h2>
            <p>
              A friend of ours asked for help blocking gambling sites on a family network. The available options were
              a parental-control product that wanted to see every domain the household visited, a browser extension
              that covered one browser on one machine, and a router setting nobody could find.
            </p>
            <p>
              None of them said plainly what they could not do. Every one implied the problem was solved. That gap
              between what a filter can do and what it is sold as doing is the thing we set out to close, and it is
              why <a href="/docs/limitations">the limitations page</a> is linked from the home page rather than buried.
            </p>

            <h2>What we will not do</h2>
            <ul>
              <li>Log queries by default. <a href="/blog/no-query-logs-by-default">The reasoning</a>.</li>
              <li>Publish a blocklist count designed to look impressive. <a href="/blog/why-blocklist-counts-are-meaningless">Why the big numbers are padding</a>.</li>
              <li>Show a testimonial we did not receive, or a metric we did not measure. See the <a href="/content-policy">content and proof policy</a>.</li>
              <li>Block a route to help. GamCare, GAMSTOP and the NHS can never be filtered.</li>
              <li>Claim the filter cannot be bypassed. It can, in four documented ways.</li>
            </ul>

            <h2>How we are funded</h2>
            <p>
              By the hosted plan and nothing else. No investors, no advertising, no affiliate revenue, and
              specifically no relationship with any gambling operator or affiliate. If that ever changes it will be
              written here before it is written anywhere else.
            </p>
          </div>

          <div class="stack">
            <div class="panel">
              <h2>At a glance</h2>
              <dl class="stack">
                <div>
                  <dt class="text-sm text-muted">Started</dt>
                  <dd>${legal.established}</dd>
                </div>
                <div>
                  <dt class="text-sm text-muted">People</dt>
                  <dd>Two, part time</dd>
                </div>
                <div>
                  <dt class="text-sm text-muted">Based</dt>
                  <dd>${site.contact.address.locality}, ${site.contact.address.countryName}</dd>
                </div>
                <div>
                  <dt class="text-sm text-muted">Blocklist rules</dt>
                  <dd>${counts().total} across ${counts().listCount} lists</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="container">
        <div class="section__intro" id="team">
          <h2>Who builds it</h2>
          <p>
            There are no photographs on this page. We are not comfortable using stock portraits or generated faces to
            imply a larger team, and neither of us wants our picture on the internet. Names, roles and what each
            person is responsible for seemed more useful than a headshot.
          </p>
        </div>

        <div class="grid grid--2">
          ${team.map(
            (person) => html`
              <div class="person">
                <span class="avatar" aria-hidden="true">${person.initials}</span>
                <div>
                  <h3>${person.name}</h3>
                  <span class="person__role">${person.role}</span>
                  <p>${person.bio}</p>
                </div>
              </div>
            `,
          )}
        </div>
      </div>
    </div>

    <div class="section">
      <div class="container">
        <div class="split">
          <div>
            <h2>Where we are</h2>
            <p>
              ${site.contact.address.street}<br />
              ${site.contact.address.locality} ${site.contact.address.postcode}<br />
              ${site.contact.address.countryName}
            </p>
            <p class="text-sm text-muted">
              This is a studio address rather than a shopfront, and there is nobody at a reception desk. If you want
              to meet, email first and we will arrange it.
            </p>
            <h3>Getting here</h3>
            <ul>
              <li><strong>By Underground:</strong> Old Street on the Northern line, about eight minutes on foot along City Road heading north.</li>
              <li><strong>By Overground:</strong> Haggerston, about fifteen minutes on foot west across the Regent's Canal.</li>
              <li><strong>By bus:</strong> routes 21, 76, 141 and 205 stop on City Road within three minutes' walk.</li>
              <li><strong>By bicycle:</strong> Santander Cycles docking station on Wharf Road, directly outside.</li>
              <li><strong>Step-free access:</strong> the entrance is level from Wharf Road and there is a lift to all floors.</li>
            </ul>
            <p>
              <a
                href="https://www.openstreetmap.org/?mlat=${site.contact.geo.latitude}&amp;mlon=${site.contact.geo.longitude}#map=17/${site.contact.geo.latitude}/${site.contact.geo.longitude}"
                rel="noopener noreferrer"
                >${icon('external')}<span>Open in OpenStreetMap for directions</span></a
              >
            </p>
          </div>
          <figure>
            <img
              src="/img/location-map.svg"
              width="520"
              height="380"
              alt="Schematic map of Wharf Road, London N1, with the studio marked."
              loading="lazy"
              decoding="async"
            />
            <figcaption>
              Hand-drawn schematic, not to scale. Use the OpenStreetMap link for an accurate map and turn-by-turn
              directions.
            </figcaption>
          </figure>
        </div>
      </div>
    </div>
  `;
}

/* ------------------------------------------------------------ case study */

export function caseStudyPage() {
  return html`
    ${pageHeader({
      title: 'Case study: a six-device household',
      lead: 'One deployment, written up with the numbers we actually measured and the two things that went wrong.',
      updated: '2026-08-15',
      meta: 'Thirty days to 15 August 2026',
    })}

    <div class="section">
      <div class="container">
        <div class="split split--sidebar">
          <div class="prose stack">
            ${message(
              'info',
              html`This is our own household, not a customer. We have not deployed at enough scale to have a customer
                case study yet, and writing one up as though we had would be a fabrication. When a customer is willing
                to be named and quoted, their write-up will replace this one and will say who they are.`,
              { title: 'Whose deployment this is' },
            )}

            <h2 id="setup">The setup</h2>
            <p>
              A Raspberry Pi 4 with 2 GB of memory, running the resolver, on a domestic fibre connection behind an
              OpenWrt router. Six devices: two laptops, two phones, a television and a games console. The gambling and
              affiliate lists enabled, lottery and crypto lists off.
            </p>
            <p>
              DHCP option 6 set to the Pi's address, so every device is told to use it directly rather than through
              the router. That is the configuration described in <a href="/docs/router-setup">router setup</a>.
            </p>

            <h2 id="numbers">What we measured</h2>
            <p>Read from the resolver's own counters and <code class="mono">systemd-cgtop</code> over thirty days.</p>

            <div class="table-wrap">
              <table>
                <caption>Resolver metrics, 17 July to 15 August 2026</caption>
                <thead>
                  <tr><th scope="col">Measure</th><th scope="col" class="numeric">Value</th></tr>
                </thead>
                <tbody>
                  <tr><th scope="row">Queries per day, mean</th><td class="numeric">41,300</td></tr>
                  <tr><th scope="row">Cache hit rate</th><td class="numeric">78%</td></tr>
                  <tr><th scope="row">Median response, cached</th><td class="numeric">&lt; 1 ms</td></tr>
                  <tr><th scope="row">Median response, uncached</th><td class="numeric">24 ms</td></tr>
                  <tr><th scope="row">Resident memory</th><td class="numeric">84 MB</td></tr>
                  <tr><th scope="row">Blocked share of queries</th><td class="numeric">0.9%</td></tr>
                  <tr><th scope="row">Unplanned downtime</th><td class="numeric">6 minutes</td></tr>
                </tbody>
              </table>
            </div>

            <p>
              The blocked share is low because nobody in this household is trying to reach gambling sites. It is a
              measure of ambient advertising and tracking rather than of intent, and it should not be read as a
              general figure. A household with an active problem would look completely different, and we have no data
              on what that looks like because we do not log queries.
            </p>

            <h2 id="wrong">The two things that went wrong</h2>
            <p>
              <strong>Six minutes of downtime</strong> when the Pi's SD card remounted read-only during a log rotation.
              Every device lost DNS. Because a public secondary was configured, most recovered within seconds onto
              unfiltered DNS, which is exactly the trade-off described in
              <a href="/docs/troubleshooting">troubleshooting</a>: the filter fails open, not closed. We moved the
              resolver to a USB SSD.
            </p>
            <p>
              <strong>A television stopped updating.</strong> Its update endpoint sat on a CDN hostname that shared a
              parent domain with an entry on the affiliate list. The suffix rule caught it. We narrowed the rule,
              published the correction in the <a href="/changelog">changelog</a>, and it is the reason the coverage
              checker now shows which rule matched rather than just a yes or no.
            </p>

            <h2 id="conclusion">What we would tell someone else</h2>
            <p>
              Set a secondary resolver and decide deliberately whether it should be a public one. Put the resolver on
              storage that does not wear out. Expect one false positive in the first month and know where to report
              it.
            </p>
            <p>
              And do not expect the numbers above to be yours. One household is one data point. If you deploy this and
              are willing to have your figures published, <a href="/contact?topic=case-study">we would like to hear from you</a>.
            </p>
          </div>

          <nav class="toc" aria-labelledby="cs-toc">
            <h2 id="cs-toc">On this page</h2>
            <ul>
              <li><a href="#setup">The setup</a></li>
              <li><a href="#numbers">What we measured</a></li>
              <li><a href="#wrong">What went wrong</a></li>
              <li><a href="#conclusion">Conclusion</a></li>
            </ul>
          </nav>
        </div>
      </div>
    </div>
  `;
}

/* --------------------------------------------------------- content policy */

export function contentPolicyPage() {
  return html`
    ${pageHeader({
      title: 'Content and proof policy',
      lead: 'The rules this site holds itself to about what may appear on a page. Written down so you can hold us to them.',
      updated: '2026-08-20',
    })}

    <div class="section">
      <div class="container">
        <div class="prose stack" style="max-width: 68ch;">
          <p>
            Marketing sites routinely carry invented social proof: testimonials from people who do not exist, counters
            that count nothing, logos of companies that are not customers, and portraits generated by a model. Each of
            those is a lie told to make a product look established. This page records what we do instead.
          </p>

          <h2>Statistics</h2>
          <p>
            Every figure about gambling harm on this site comes from a named publication, and the citation appears
            next to the figure rather than in a footnote. Where the evidence disagrees with itself, we say so:
            the note beside the survey figures explains that health-survey methodology reports a rate under 1% while
            the Gambling Commission's survey reports ${statistics.problemGambling.value}, and that the Commission
            advises against comparing them directly.
          </p>
          <p>Figures about our own product are measured, and the measurement conditions are stated. We do not estimate and then round up.</p>

          <h2>Testimonials and reviews</h2>
          <p>
            There are none, because nobody has left one yet. The <a href="/reviews">reviews page</a> shows an empty
            state and a form. When reviews arrive they will be published with whatever verification we were able to
            do, and unverified ones will be labelled as such.
          </p>
          <p>We will not write a review ourselves, commission one, or offer anything in exchange for one.</p>

          <h2>Photographs of people</h2>
          <p>
            There are none anywhere on this site. No stock photography of a team, no generated faces, no
            people-at-laptops. The <a href="/about#team">about page</a> uses initials.
          </p>

          <h2>Logos and customer lists</h2>
          <p>
            No "trusted by" row, because there is nobody to put in it. If that changes, a logo will appear only with
            written permission from the organisation, and only while they are actually a customer.
          </p>

          <h2>Counters</h2>
          <p>
            Numbers that appear on this site are computed from data at the moment the page renders. The blocklist
            total is counted from the list file. The review count is counted from published reviews. There is no
            animated counter climbing to an impressive number, because there is no impressive number.
          </p>

          <h2>Claims about capability</h2>
          <p>
            Anywhere the product's effectiveness is described, its limits are described in the same place or linked
            from it. We do not use "complete", "total", "unbreakable" or "guaranteed" about a filter that can be
            switched off from the settings app.
          </p>

          <h2>Illustrations</h2>
          <p>
            The diagrams are hand-authored SVG drawn for this site. They are schematics, and where one is not to
            scale the caption says so.
          </p>

          <h2>If we break these rules</h2>
          <p>
            Tell us at <a href="mailto:${site.contact.email}">${site.contact.email}</a> and we will correct the page
            and note the correction in the <a href="/changelog">changelog</a>. We would rather be embarrassed than
            wrong.
          </p>
        </div>
      </div>
    </div>
  `;
}

/* ------------------------------------------------------------- coverage */

export function coveragePage({ csrf, query, result }) {
  const data = counts();

  return html`
    ${pageHeader({
      title: 'Coverage',
      lead: 'Every rule we publish, and a lookup to check a specific domain against them.',
      updated: data.lastUpdated,
      meta: `${data.total} rules across ${data.listCount} lists`,
    })}

    <div class="section">
      <div class="container">
        <div class="split">
          <div>
            <h2>Check a domain</h2>
            <form class="stack" id="coverage-form" method="post" action="/coverage" data-busy-on-submit>
              <input type="hidden" name="_csrf" value="${csrf}" />
              <div class="field">
                <label class="field__label" for="field-domain">Domain</label>
                <div class="input-group">
                  <input
                    class="field__control"
                    id="field-domain"
                    name="domain"
                    type="text"
                    inputmode="url"
                    spellcheck="false"
                    autocomplete="off"
                    maxlength="253"
                    value="${query || ''}"
                    placeholder="example.com"
                    aria-describedby="field-domain-hint"
                  />
                  <button type="submit" class="btn btn--primary">${icon('search')}<span>Check</span></button>
                </div>
                <p class="field__hint" id="field-domain-hint">
                  A full URL works too; we reduce it to the hostname. This checks our published lists, not your
                  device's DNS settings.
                </p>
              </div>
            </form>

            <div class="coverage-result" id="coverage-result" role="region" aria-label="Coverage result" ${result ? '' : 'hidden'}>
              ${result ? coverageResult(result) : ''}
            </div>
          </div>

          <div class="panel panel--sunken">
            <h2>What a result means</h2>
            <p class="text-sm">
              A listed domain is refused whenever the list it is on is enabled for your network. A rule also covers
              every subdomain of it, so <code class="mono">bet365.com</code> covers
              <code class="mono">m.bet365.com</code>.
            </p>
            <p class="text-sm">
              An unlisted domain is not blocked today. If you think it should be,
              <a href="/contact?topic=listing">submit it</a> and a person will check it against the public register
              before anything is added.
            </p>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="container">
        <div class="section__intro">
          <h2>The lists</h2>
          <p>
            Each entry is a suffix rule covering that domain and all of its subdomains. The review date is when a
            person last checked the list against its source, not when a script last ran.
          </p>
        </div>

        <div class="stack-lg">
          ${lists.map(
            (list) => html`
              <section class="panel" aria-labelledby="list-${list.id}">
                <h3 id="list-${list.id}">${list.name} ${badge('neutral', `${list.rules.length} rules`)}</h3>
                <p>${list.description}</p>
                <p class="text-sm text-muted">
                  Source: <a href="${list.sourceUrl}" rel="noopener noreferrer">${list.sourceName}</a>. Reviewed
                  <time datetime="${list.updated}">${formatDate(list.updated)}</time>.
                </p>
                <details class="accordion">
                  <summary><span>Show all ${list.rules.length} rules</span>${icon('chevronDown')}</summary>
                  <div class="accordion__body">
                    <ul class="mono text-sm">
                      ${list.rules.map((rule) => html`<li>${rule}</li>`)}
                    </ul>
                  </div>
                </details>
              </section>
            `,
          )}
        </div>
      </div>
    </div>

    <div class="section">
      <div class="container">
        <div class="split">
          <div>
            <h2>Never blocked</h2>
            <p>
              These domains are refused entry to every list. A filter that stood between someone and a helpline would
              be indefensible, so this check runs before any list is consulted.
            </p>
            <ul class="mono text-sm">
              ${[...neverBlock].map((domain) => html`<li>${domain}</li>`)}
            </ul>
          </div>
          <div>
            <h2>Why the total is small</h2>
            <p>
              ${data.total} rules is a deliberately short list of suffix rules, each one checked by a person against a
              public register. Aggregated feeds advertise millions of entries, most of which are dead domains and
              subdomain permutations.
            </p>
            <p><a href="/blog/why-blocklist-counts-are-meaningless">The full argument, including where a short list loses</a>.</p>
          </div>
        </div>
      </div>
    </div>

    ${copyStatusRegion()}
  `;
}

/** Server-rendered coverage result, matching what the client renders. */
export function coverageResult(result) {
  if (result.protected) {
    return message(
      'info',
      html`<strong>${result.domain}</strong> is on the never-block list. Routes to gambling support are never
        filtered, whatever a list says.`,
    );
  }
  if (result.listed) {
    return html`
      ${message(
        'success',
        html`<strong>${result.domain}</strong> is on the ${result.list} list. It is blocked whenever that list is
          enabled.`,
      )}
      <p class="text-sm text-muted">
        Matched rule: <code class="mono">${result.rule}</code>, which also covers every subdomain of it. Source:
        <a href="${result.sourceUrl}" rel="noopener noreferrer">${result.source}</a>.
      </p>
    `;
  }
  return html`
    ${message(
      'warning',
      html`<strong>${result.domain}</strong> is not on any list we publish, so it would not be blocked today.`,
    )}
    <p class="text-sm text-muted">
      If you believe it should be, <a href="/contact?topic=listing&amp;domain=${result.domain}">submit it for review</a>.
      Every submission is checked by a person before anything is added.
    </p>
  `;
}

/* -------------------------------------------------------- accessibility */

export function accessibilityPage() {
  return html`
    ${pageHeader({
      title: 'Accessibility statement',
      lead: 'What we have done, what we have tested, and the two things we know are not right yet.',
      updated: '2026-08-21',
    })}

    <div class="section">
      <div class="container">
        <div class="prose stack" style="max-width: 68ch;">
          <h2>Commitment</h2>
          <p>
            This site aims to meet WCAG 2.2 at level AA. Accessibility is not a feature that was added at the end; the
            colour palette was chosen by running every foreground and background pairing through a contrast check
            before any page was written, and the check runs as part of the test suite so a change that breaks it fails
            the build.
          </p>

          <h2>What has been done</h2>
          <ul>
            <li>All 56 colour pairings meet at least 4.5:1 for body text and 3:1 for large text and interface borders, in both light and dark themes.</li>
            <li>Status is never signalled by colour alone: each message and badge carries its own icon and wording.</li>
            <li>Every interactive target is at least 44 by 44 CSS pixels.</li>
            <li>A single, consistent focus ring appears on keyboard focus everywhere, and is never removed.</li>
            <li>The site works entirely without JavaScript: forms submit, navigation opens, search runs, and the coverage checker returns a rendered page.</li>
            <li>Headings run in order with no levels skipped, and every page has exactly one <code class="mono">h1</code>.</li>
            <li>Images carry descriptive alternative text; decorative SVG is hidden from assistive technology.</li>
            <li>Form fields have real labels, errors are announced, and an error summary at the top of the form links to each field.</li>
            <li>A bypass link is the first focusable element on every page.</li>
            <li>Motion respects <code class="mono">prefers-reduced-motion</code>: transitions are reduced to near zero rather than merely shortened.</li>
            <li>Text reflows to 320 pixels wide without horizontal scrolling, and remains usable at 200% zoom.</li>
          </ul>

          <h2>How it was tested</h2>
          <p>
            Keyboard-only traversal of every page and every form. Automated contrast checking of the full palette.
            Manual checks at 320, 375, 768 and 1280 pixels wide. Rendering with JavaScript disabled and with CSS
            disabled.
          </p>
          <p>
            It has not been tested with a screen reader by someone who uses one daily, and it has not been through a
            third-party audit. Saying otherwise would be the kind of claim this site exists to avoid.
          </p>

          <h2>Known problems</h2>
          <ul>
            <li>
              The blocklist tables on the coverage page are long. They are inside a scrollable region with a keyboard
              focus stop, which is correct but tedious to traverse. A filter control would be better.
            </li>
            <li>
              The uptime bars on the status page convey their information through an adjacent text summary. The bars
              themselves are hidden from assistive technology rather than made meaningful individually.
            </li>
          </ul>

          <h2>Telling us about a problem</h2>
          <p>
            Email <a href="mailto:${site.contact.email}">${site.contact.email}</a> or
            <a href="/contact?topic=accessibility">use the contact form</a>. ${site.contact.responseTime} Please say
            which page and what happened; a description of what you expected is more useful than a screenshot.
          </p>
          <p>
            This statement was prepared on 21 August 2026 by reviewing the site against WCAG 2.2 AA. It is reviewed
            whenever a page is added.
          </p>
        </div>
      </div>
    </div>
  `;
}

/* --------------------------------------------------------- security page */

export function securityPage() {
  return html`
    ${pageHeader({
      title: 'Report a vulnerability',
      lead: 'How to tell us about a security problem, what we will do, and what this site does to prevent one.',
      updated: '2026-08-27',
    })}

    <div class="section">
      <div class="container">
        <div class="split split--sidebar">
          <div class="prose stack">
            <h2 id="reporting">Reporting</h2>
            <p>
              Email <a href="mailto:${site.contact.securityEmail}">${site.contact.securityEmail}</a>. Include what you
              found, how to reproduce it, and what you think the impact is. If a proof of concept touches data that is
              not yours, stop at the point of demonstrating access rather than retrieving anything.
            </p>
            <p>We will acknowledge within one working day and tell you what we intend to do within five.</p>

            <h3>What is in scope</h3>
            <ul>
              <li>This website and its API.</li>
              <li>The resolver software, including the list distribution and its signatures.</li>
            </ul>

            <h3>What is not</h3>
            <ul>
              <li>Findings from automated scanners with no demonstrated impact.</li>
              <li>Missing headers on endpoints that serve no content.</li>
              <li>Denial of service through volume.</li>
              <li>Social engineering of either of us.</li>
            </ul>

            <h3>Safe harbour</h3>
            <p>
              If you act in good faith, stay within scope, avoid privacy violations and data destruction, and give us
              reasonable time to fix the problem, we will not pursue any action against you. We do not currently pay
              bounties, and we will credit you by name if you want that.
            </p>

            <h2 id="measures">What this site does</h2>
            <p>Not a complete list, but the parts a reporter usually wants to know.</p>
            <ul>
              <li>Passwords are salted and hashed with PBKDF2-HMAC-SHA-256 at 180,000 iterations, never stored or logged in any other form.</li>
              <li>Login is limited to five failures per account and address per fifteen minutes, and the response is identical whether or not the account exists.</li>
              <li>Sessions are opaque random identifiers in an HttpOnly, Secure, SameSite=Lax cookie, rotated on login and destroyed on logout.</li>
              <li>Every form and account-changing request carries a random double-submit CSRF token, compared in constant time, with the Origin header checked as well.</li>
              <li>State writes use atomic ETag preconditions, so concurrent requests cannot silently overwrite one another.</li>
              <li>Ownership is checked before every account-data mutation, so a guessed identifier returns nothing rather than changing someone else's record.</li>
              <li>Input is validated server-side against a schema, and only fields named in that schema are read from a submission.</li>
              <li>Output escaping is a property of the template engine, not something each page remembers to do.</li>
              <li>Content-Security-Policy allows scripts only from this origin with a per-response nonce; there is no <code class="mono">unsafe-inline</code> and no <code class="mono">unsafe-eval</code>.</li>
              <li>Request bodies are capped at 64 KiB and only two content types are parsed.</li>
              <li>There are no file uploads, because nothing here needs one.</li>
              <li>The deployed application has no third-party runtime package, native binding or runtime build step.</li>
            </ul>

            <h2 id="config">Reporting configuration</h2>
            <p>The machine-readable version of this page is at <code class="mono">/.well-known/security.txt</code>.</p>
            ${copyable(`curl ${site.origin}/.well-known/security.txt`, { id: 'security-txt-cmd' })}
          </div>

          <nav class="toc" aria-labelledby="sec-toc">
            <h2 id="sec-toc">On this page</h2>
            <ul>
              <li><a href="#reporting">Reporting</a></li>
              <li><a href="#measures">What this site does</a></li>
              <li><a href="#config">security.txt</a></li>
            </ul>
          </nav>
        </div>
      </div>
    </div>
    ${copyStatusRegion()}
  `;
}
