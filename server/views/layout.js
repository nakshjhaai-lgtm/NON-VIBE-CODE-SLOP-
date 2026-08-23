/**
 * The page shell.
 *
 * Every response goes through here, so the things that must never be missing
 * from a page cannot be forgotten: a unique title, a real meta description, a
 * canonical URL, social card tags, the skip link, breadcrumbs, and a footer
 * with working links.
 *
 * The inline theme script is the only inline script on the site; it must run
 * before paint to avoid a flash of the wrong theme, and it carries the
 * per-response CSP nonce.
 */
import { html, raw, escapeHtml, jsonScript } from '../lib/html.js';
import { icon, logoMark } from './icons.js';
import { site, primaryNav, footerNav, legal } from '../lib/site.js';

/** Cache-busting suffix so CSS/JS can be served immutable but still update. */
export const ASSET_VERSION = process.env.NETGUARD_ASSET_VERSION || String(Date.now());

const v = (path) => `${path}?v=${ASSET_VERSION}`;

function metaTags({ title, description, canonical, robots, image, type, published, modified }) {
  const img = `${site.origin}${image || '/img/social-card.png'}`;
  return html`
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${canonical}" />
    ${robots ? html`<meta name="robots" content="${robots}" />` : ''}

    <meta property="og:site_name" content="${site.name}" />
    <meta property="og:type" content="${type || 'website'}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${img}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="NetGuard: DNS filtering that blocks gambling sites at the network level." />
    <meta property="og:locale" content="${site.locale}" />
    ${published ? html`<meta property="article:published_time" content="${published}" />` : ''}
    ${modified ? html`<meta property="article:modified_time" content="${modified}" />` : ''}

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${img}" />
  `;
}

function breadcrumbTrail(crumbs) {
  if (!crumbs || crumbs.length === 0) return '';
  return html`
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <div class="container">
        <ol>
          <li><a href="/">Home</a></li>
          ${crumbs.map((crumb, i) =>
            i === crumbs.length - 1
              ? html`<li><span aria-current="page">${crumb.label}</span></li>`
              : html`<li><a href="${crumb.href}">${crumb.label}</a></li>`,
          )}
        </ol>
      </div>
    </nav>
  `;
}

function header(currentPath, user) {
  const isCurrent = (href) =>
    href === '/' ? currentPath === '/' : currentPath === href || currentPath.startsWith(`${href}/`);

  return html`
    <header class="site-header" id="site-header" data-scrolled="false">
      <div class="container">
        <div class="site-header__bar">
          <a class="brand" href="/" aria-label="${site.name} home">
            ${logoMark()}
            <span>${site.name}</span>
          </a>

          <nav class="site-nav" aria-label="Primary">
            <ul class="site-nav__list">
              ${primaryNav.map(
                (item) => html`
                  <li>
                    <a
                      class="site-nav__link"
                      href="${item.href}"
                      ${isCurrent(item.href) ? raw('aria-current="page"') : ''}
                      >${item.label}</a
                    >
                  </li>
                `,
              )}
            </ul>
          </nav>

          <div class="header-actions">
            <a class="btn btn--quiet btn--sm" href="/search">${icon('search')}<span>Search</span></a>

            <div class="theme-control" role="group" aria-label="Colour theme">
              <button type="button" data-theme-choice="light" aria-pressed="false">
                ${icon('sun')}<span class="visually-hidden">Light theme</span>
              </button>
              <button type="button" data-theme-choice="system" aria-pressed="true">
                ${icon('monitor')}<span class="visually-hidden">Match system theme</span>
              </button>
              <button type="button" data-theme-choice="dark" aria-pressed="false">
                ${icon('moon')}<span class="visually-hidden">Dark theme</span>
              </button>
            </div>

            ${user
              ? html`<a class="btn btn--quiet btn--sm" href="/dashboard">${icon('chart')}<span>Dashboard</span></a>`
              : html`<a class="btn btn--quiet btn--sm" href="/login">Sign in</a>`}

            <a class="btn btn--primary btn--sm" href="/coverage">Check a domain</a>

            <button
              type="button"
              class="nav-toggle"
              id="nav-toggle"
              aria-expanded="false"
              aria-controls="mobile-nav"
            >
              ${icon('menu')}
              <span class="visually-hidden">Menu</span>
            </button>
          </div>
        </div>

        <nav class="mobile-nav" id="mobile-nav" aria-label="Mobile" hidden>
          <ul class="mobile-nav__list">
            ${primaryNav.map(
              (item) => html`
                <li>
                  <a
                    class="mobile-nav__link"
                    href="${item.href}"
                    ${isCurrent(item.href) ? raw('aria-current="page"') : ''}
                    >${item.label}</a
                  >
                </li>
              `,
            )}
            <li>
              <a class="mobile-nav__link" href="${user ? '/dashboard' : '/login'}"
                >${user ? 'Dashboard' : 'Sign in'}</a
              >
            </li>
            <li><a class="mobile-nav__link" href="/search">Search</a></li>
          </ul>
        </nav>
      </div>
    </header>
  `;
}

function footer() {
  return html`
    <footer class="site-footer">
      <div class="container">
        <div class="footer-grid">
          <div class="footer-col">
            <a class="brand" href="/" aria-label="${site.name} home">${logoMark()}<span>${site.name}</span></a>
            <p class="text-sm text-secondary" style="margin-top: var(--space-3)">
              DNS filtering that blocks gambling domains for every device on a network, with published
              blocklist sources and no client software to install.
            </p>
            <p class="text-sm">
              <a href="tel:${site.contact.phoneHref}">${site.contact.phone}</a><br />
              <a href="mailto:${site.contact.email}">${site.contact.email}</a>
            </p>
            <p class="text-sm text-muted">
              ${site.contact.address.street}<br />
              ${site.contact.address.locality} ${site.contact.address.postcode}<br />
              ${site.contact.address.countryName}
            </p>
          </div>

          ${footerNav.map(
            (group) => html`
              <div class="footer-col">
                <h2>${group.heading}</h2>
                <ul>
                  ${group.links.map((link) => html`<li><a href="${link.href}">${link.label}</a></li>`)}
                </ul>
              </div>
            `,
          )}
        </div>

        <div class="footer-bottom">
          <p class="text-sm">
            &copy; ${legal.year} ${legal.company}. Published under the terms on our
            <a href="/terms">terms page</a>.
          </p>
          <p class="text-sm">
            <a href="/help">If gambling is causing you harm, support is available</a>
          </p>
        </div>
      </div>
    </footer>
  `;
}

function floatingStack() {
  return html`
    <div class="floating-stack">
      <a class="floating-btn floating-btn--contact" href="/contact" data-floating-contact>
        ${icon('mail')}<span>Contact</span>
      </a>
      <button type="button" class="floating-btn" id="back-to-top" hidden>
        ${icon('arrowUp')}<span class="visually-hidden">Back to top</span>
      </button>
    </div>
  `;
}

/**
 * A persistent call to action on small screens, where the header CTA has
 * scrolled away. Hidden from 48em upwards by the stylesheet. Only marketing
 * pages ask for it, by setting `stickyCta`.
 */
function stickyCta(cta) {
  if (!cta) return '';
  return html`
    <div class="sticky-cta">
      <p class="sticky-cta__text">${cta.title}<span>${cta.detail}</span></p>
      <a class="btn btn--primary btn--sm" href="${cta.href}">${cta.label}</a>
    </div>
  `;
}

function cookieBanner() {
  return html`
    <section class="cookie-banner" id="cookie-banner" aria-label="Cookie choices" hidden>
      <div class="container">
        <div>
          <h2>Cookies on this site</h2>
          <p class="text-sm">
            We use one cookie to keep you signed in and one to remember these choices. We would also like
            to count page views so we can see which documentation is actually used. That counting is done
            on our own server, stores no identifiers, and sets no cookie. You can decline it.
            <a href="/cookies">Read the cookie policy</a>.
          </p>
        </div>
        <div class="btn-row">
          <button type="button" class="btn btn--primary btn--sm" data-cookie-choice="accept">
            Accept analytics
          </button>
          <button type="button" class="btn btn--quiet btn--sm" data-cookie-choice="reject">
            Decline analytics
          </button>
        </div>
      </div>
    </section>
  `;
}

/**
 * @param {object} opts
 * @param {string} opts.title        page title, without the site suffix
 * @param {string} opts.description  unique meta description
 * @param {object} opts.content      page body (safe HTML)
 */
export function layout({
  title,
  description,
  path: currentPath = '/',
  canonical,
  crumbs = [],
  content,
  nonce,
  user = null,
  schema = null,
  robots = '',
  bodyClass = '',
  image,
  type,
  published,
  modified,
  analyticsEnabled = true,
  hideChrome = false,
  stickyCta: cta = null,
}) {
  const fullTitle = `${title} | ${site.name}`;
  const url = canonical || `${site.origin}${currentPath}`;

  return html`<!doctype html>
<html lang="${site.lang}" data-theme-preference="system">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${fullTitle}</title>
    ${metaTags({ title: fullTitle, description, canonical: url, robots, image, type, published, modified })}

    <meta name="theme-color" content="${site.themeColor}" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#14171a" media="(prefers-color-scheme: dark)" />
    <meta name="format-detection" content="telephone=no" />

    <link rel="icon" href="/favicon.ico" sizes="32x32" />
    <link rel="icon" href="/img/logo.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/img/apple-touch-icon.png" />
    <link rel="manifest" href="/site.webmanifest" />

    <!-- Fonts are self-hosted; preloading the two faces used above the fold
         removes the swap flash without blocking render. -->
    <link rel="preload" href="/fonts/ibm-plex-sans-400.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="preload" href="/fonts/ibm-plex-sans-600.woff2" as="font" type="font/woff2" crossorigin />

    <link rel="stylesheet" href="${v('/css/tokens.css')}" />
    <link rel="stylesheet" href="${v('/css/main.css')}" />

    <link rel="search" type="application/opensearchdescription+xml" title="${site.name}" href="/opensearch.xml" />
    <link rel="alternate" type="application/rss+xml" title="${site.name} notes" href="/blog/feed.xml" />

    ${schema ? html`<script type="application/ld+json" nonce="${nonce}">${jsonScript(schema)}</script>` : ''}

    <!-- Applies the saved theme before first paint. Kept tiny and inline on
         purpose: an external file would still flash. -->
    <script nonce="${nonce}">
      (function () {
        try {
          var stored = localStorage.getItem('ng-theme');
          var pref = stored === 'light' || stored === 'dark' ? stored : 'system';
          var root = document.documentElement;
          root.setAttribute('data-theme-preference', pref);
          if (pref !== 'system') root.setAttribute('data-theme', pref);
        } catch (e) {
          /* localStorage unavailable: system theme still applies via CSS. */
        }
      })();
    </script>
  </head>
  <body class="${bodyClass}">
    <a class="skip-link" href="#main">Skip to main content</a>

    <div class="scroll-progress" aria-hidden="true">
      <div class="scroll-progress__bar" id="scroll-progress-bar"></div>
    </div>

    ${hideChrome ? '' : header(currentPath, user)} ${hideChrome ? '' : breadcrumbTrail(crumbs)}

    <main id="main" tabindex="-1">${content}</main>

    ${hideChrome ? '' : footer()} ${hideChrome ? '' : stickyCta(cta)} ${hideChrome ? '' : floatingStack()}
    ${hideChrome ? '' : cookieBanner()}

    <script type="module" src="${v('/js/app.js')}" nonce="${nonce}"></script>
    ${analyticsEnabled
      ? html`<script type="module" src="${v('/js/analytics.js')}" nonce="${nonce}" defer></script>`
      : ''}
  </body>
</html>`;
}
