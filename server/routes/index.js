/**
 * Route table.
 *
 * Every handler receives a context built in server/index.js. Handlers do not
 * touch the response object directly except through the helpers on that
 * context, so headers, escaping and status codes stay consistent.
 */
import { Router } from '../http/router.js';
import { html } from '../lib/html.js';
import { site, primaryNav, statistics } from '../lib/site.js';
import { rules, validate, LIMITS as FIELD_LIMITS } from '../lib/validate.js';
import { lookup, counts } from '../lib/blocklists.js';
import { search, suggest, addDocument, documentCount, clearIndex } from '../lib/search.js';
import {
  allDocs,
  getDoc,
  allPosts,
  getPost,
  relatedPosts,
  allTags,
  docNeighbours,
  lastContentUpdate,
} from '../lib/content.js';
import { enquiries, reviews, profiles, allowEntries, coverageChecks, analytics, visitorHash, sessions } from '../db/index.js';
import { attemptLogin, register, logout, SESSION_COOKIE, SESSION_TTL_MS } from '../lib/auth.js';
import { LIMITS as RATE_LIMITS } from '../lib/rate-limit.js';

import { homePage, homeSchema } from '../views/pages/home.js';
import {
  howItWorksPage,
  pricingPage,
  aboutPage,
  caseStudyPage,
  contentPolicyPage,
  coveragePage,
  accessibilityPage,
  securityPage,
} from '../views/pages/marketing.js';
import { docsIndexPage, docPage, docSchema, blogIndexPage, blogPostPage, blogSchema } from '../views/pages/docs.js';
import { contactPage, thankYouPage, reviewsPage, searchPage, CONTACT_TOPICS } from '../views/pages/forms.js';
import { faqPage, faqSchema, helpPage, statusPage, changelogPage, sitemapPage, CHANGELOG, FAQ } from '../views/pages/support.js';
import { privacyPage, cookiesPage, termsPage } from '../views/pages/legal.js';
import {
  loginPage,
  registerPage,
  dashboardOverviewPage,
  dashboardProfilesPage,
  dashboardAccountPage,
} from '../views/pages/account.js';
import { notFoundPage } from '../views/pages/errors.js';
import { sitemapXml, robotsTxt, securityTxt, opensearchXml, webManifest, rssFeed } from './feeds.js';

export const router = new Router();

const INSTANCE_LOADED_AT = new Date().toISOString();

/* ------------------------------------------------------- machine-readable */

// Declared before the content routes: `/blog/feed.xml` must not be matched by
// the `/blog/:slug` pattern, and the router returns the first route it finds.

router.get('/robots.txt', (ctx) => ctx.text(200, robotsTxt(), 'text/plain; charset=utf-8'));
router.get('/sitemap.xml', (ctx) => ctx.text(200, sitemapXml(), 'application/xml; charset=utf-8'));
router.get('/blog/feed.xml', (ctx) => ctx.text(200, rssFeed(), 'application/rss+xml; charset=utf-8'));
router.get('/opensearch.xml', (ctx) =>
  ctx.text(200, opensearchXml(), 'application/opensearchdescription+xml; charset=utf-8'),
);
router.get('/site.webmanifest', (ctx) => ctx.text(200, webManifest(), 'application/manifest+json'));
router.get('/.well-known/security.txt', (ctx) => ctx.text(200, securityTxt(), 'text/plain; charset=utf-8'));


/* ------------------------------------------------------------ home page */

router.get('/', (ctx) =>
  ctx.render({
    title: site.tagline,
    description: site.description,
    content: homePage({
      csrf: ctx.csrf,
      reviewSummary: reviews.summary(),
      // Set by the account-deletion redirect, so the confirmation is shown
      // once on a page the person can actually still reach.
      accountDeleted: ctx.query.get('deleted') === '1',
    }),
    schema: homeSchema(),
    stickyCta: {
      title: 'Try it on one device',
      detail: 'Fifteen minutes, no account',
      href: '/docs/quick-start',
      label: 'Quick start',
    },
  }),
);

/* ------------------------------------------------------------- marketing */

router.get('/how-it-works', (ctx) =>
  ctx.render({
    title: 'How DNS filtering works',
    description:
      'The packet-level explanation of how NetGuard blocks gambling domains: where the resolver sits, why it answers NXDOMAIN, what it covers and the four things it cannot see.',
    crumbs: [{ href: '/how-it-works', label: 'How it works' }],
    stickyCta: {
      title: 'Check a domain',
      detail: 'No account needed',
      href: '/coverage',
      label: 'Coverage',
    },
    content: howItWorksPage(),
  }),
);

router.get('/pricing', (ctx) =>
  ctx.render({
    title: 'Pricing',
    description:
      'Self-hosted is free and complete. Hosted is four pounds a month per network. Organisations are priced on the work involved. No trial, because the free version is the same software.',
    crumbs: [{ href: '/pricing', label: 'Pricing' }],
    stickyCta: {
      title: 'Self-hosted is free',
      detail: 'Same software as the paid plan',
      href: '/docs/self-hosting',
      label: 'Set it up',
    },
    content: pricingPage(),
  }),
);

router.get('/about', (ctx) =>
  ctx.render({
    title: `About ${site.name}`,
    description:
      'Two people in London building a DNS filter that tells you what it cannot do. Why it exists, how it is funded, and the things we will not do.',
    crumbs: [{ href: '/about', label: 'About' }],
    content: aboutPage(),
  }),
);

router.get('/case-study', (ctx) =>
  ctx.render({
    title: 'Case study: a six-device household',
    description:
      'Thirty days of measured figures from one Raspberry Pi deployment: 41,300 queries a day, 78% cache hit rate, 84 MB of memory, and the two things that went wrong.',
    crumbs: [{ href: '/case-study', label: 'Case study' }],
    content: caseStudyPage(),
  }),
);

router.get('/content-policy', (ctx) =>
  ctx.render({
    title: 'Content and proof policy',
    description:
      'The rules this site holds itself to: no invented testimonials, no generated faces, no uncited statistics, no counters that count nothing.',
    crumbs: [{ href: '/content-policy', label: 'Content and proof policy' }],
    content: contentPolicyPage(),
  }),
);

router.get('/accessibility', (ctx) =>
  ctx.render({
    title: 'Accessibility statement',
    description:
      'What has been done to meet WCAG 2.2 AA on this site, how it was tested, the two known problems, and how to report a barrier.',
    crumbs: [{ href: '/accessibility', label: 'Accessibility' }],
    content: accessibilityPage(),
  }),
);

router.get('/security', (ctx) =>
  ctx.render({
    title: 'Report a vulnerability',
    description:
      'Coordinated disclosure policy for NetGuard: what is in scope, our safe-harbour commitment, response times, and the measures this site already takes.',
    crumbs: [{ href: '/security', label: 'Security' }],
    content: securityPage(),
  }),
);

/* -------------------------------------------------------------- coverage */

router.get('/coverage', (ctx) => {
  const query = (ctx.query.get('domain') || '').slice(0, FIELD_LIMITS.domain);
  let result = null;
  if (query) {
    const checked = rules.domain({ label: 'Domain' })(query);
    result = checked.error ? null : lookup(checked.value);
    if (result) coverageChecks.record(result.domain, result.listed);
  }

  return ctx.render({
    title: 'Coverage: check a domain against our blocklists',
    description: `Every one of the ${counts().total} rules NetGuard publishes, with the register each came from, plus a lookup that tells you whether a specific domain is blocked and which rule matched.`,
    crumbs: [{ href: '/coverage', label: 'Coverage' }],
    content: coveragePage({ csrf: ctx.csrf, query, result }),
  });
});

router.post('/coverage', (ctx) => {
  const { ok, data, errors } = validate(ctx.body, { domain: rules.domain({ label: 'Domain' }) });

  if (!ok) {
    return ctx.render({
      title: 'Coverage: check a domain against our blocklists',
      description: `Every one of the ${counts().total} rules NetGuard publishes, with the register each came from, plus a lookup that tells you whether a specific domain is blocked.`,
      crumbs: [{ href: '/coverage', label: 'Coverage' }],
      status: 400,
      content: coveragePage({
        csrf: ctx.csrf,
        query: String(ctx.body.domain || '').slice(0, FIELD_LIMITS.domain),
        result: null,
        error: errors.domain,
      }),
    });
  }

  const result = lookup(data.domain);
  coverageChecks.record(result.domain, result.listed);

  return ctx.render({
    title: `Is ${result.domain} blocked?`,
    description: `Whether ${result.domain} appears on a NetGuard blocklist, which rule matched it, and where that rule came from.`,
    crumbs: [{ href: '/coverage', label: 'Coverage' }],
    robots: 'noindex, follow',
    content: coveragePage({ csrf: ctx.csrf, query: result.domain, result }),
  });
});

/* ------------------------------------------------------------------ docs */

router.get('/docs', (ctx) =>
  ctx.render({
    title: 'Documentation',
    description: `Setting up NetGuard, running it, and the parts where it does not work. ${allDocs().length} short pages covering quick start, router setup, encrypted DNS, troubleshooting, the API and self-hosting.`,
    crumbs: [{ href: '/docs', label: 'Documentation' }],
    content: docsIndexPage(),
  }),
);

router.get('/docs/:slug', (ctx) => {
  const doc = getDoc(ctx.params.slug);
  if (!doc) return ctx.notFound();

  return ctx.render({
    title: doc.title,
    description: doc.description,
    crumbs: [
      { href: '/docs', label: 'Documentation' },
      { href: `/docs/${doc.slug}`, label: doc.title },
    ],
    modified: doc.updated,
    schema: docSchema(doc),
    content: docPage({ doc, neighbours: docNeighbours(doc.slug) }),
  });
});

/* ------------------------------------------------------------------ blog */

router.get('/blog', (ctx) =>
  ctx.render({
    title: 'Engineering notes',
    description:
      'Things we got wrong and changed: why blocklist counts are meaningless, how encrypted DNS broke our assumptions, why query logging is off by default, and the NXDOMAIN postmortem.',
    crumbs: [{ href: '/blog', label: 'Notes' }],
    content: blogIndexPage({ tag: null }),
  }),
);

router.get('/blog/tag/:tag', (ctx) => {
  const tag = ctx.params.tag.toLowerCase();
  const entry = allTags().find((item) => item.tag === tag);
  if (!entry) return ctx.notFound();

  const titles = allPosts()
    .filter((post) => post.tags.includes(tag))
    .map((post) => post.title);

  return ctx.render({
    title: `Notes tagged ${tag}`,
    description: `${entry.count} engineering ${entry.count === 1 ? 'note' : 'notes'} from ${site.name} filed under ${tag}: ${titles.join('; ')}.`.slice(0, 300),
    crumbs: [
      { href: '/blog', label: 'Notes' },
      { href: `/blog/tag/${tag}`, label: tag },
    ],
    robots: 'noindex, follow',
    content: blogIndexPage({ tag }),
  });
});

router.get('/blog/:slug', (ctx) => {
  const post = getPost(ctx.params.slug);
  if (!post) return ctx.notFound();

  return ctx.render({
    title: post.title,
    description: post.description,
    crumbs: [
      { href: '/blog', label: 'Notes' },
      { href: `/blog/${post.slug}`, label: post.title },
    ],
    type: 'article',
    published: post.date,
    modified: post.updated || post.date,
    schema: blogSchema(post),
    content: blogPostPage({ post, related: relatedPosts(post) }),
  });
});

/* --------------------------------------------------------------- contact */

const contactSchema = {
  name: rules.text({ label: 'Your name', min: 2, max: FIELD_LIMITS.name }),
  email: rules.email({ label: 'Email address' }),
  org: rules.text({ label: 'Organisation', max: FIELD_LIMITS.org, required: false }),
  topic: rules.choice({ label: 'Topic', options: CONTACT_TOPICS.map((t) => t.value) }),
  message: rules.text({ label: 'Message', min: 20, max: FIELD_LIMITS.message, multiline: true }),
  consent: rules.checkbox({ label: 'The storage notice', required: true }),
};

router.get('/contact', (ctx) => {
  const topic = ctx.query.get('topic') || '';
  const domain = ctx.query.get('domain') || '';
  const page = ctx.query.get('page') || '';

  const values = {
    topic: CONTACT_TOPICS.some((t) => t.value === topic) ? topic : 'support',
    message: domain
      ? `I think ${domain.slice(0, 253)} should be reviewed for the blocklists, because `
      : page
        ? `On the page ${page.slice(0, 120)} I found `
        : '',
  };

  return ctx.render({
    title: 'Contact',
    description: `Email, telephone and postal contact for ${site.name}, and a form that reaches one of two people. We reply to every enquiry within one working day.`,
    crumbs: [{ href: '/contact', label: 'Contact' }],
    schema: {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: site.name,
      description: site.description,
      url: `${site.origin}/`,
      email: site.contact.email,
      telephone: site.contact.phone,
      image: `${site.origin}/img/social-card.png`,
      priceRange: 'Free to GBP 4 per month',
      address: {
        '@type': 'PostalAddress',
        streetAddress: site.contact.address.street,
        addressLocality: site.contact.address.locality,
        addressRegion: site.contact.address.region,
        postalCode: site.contact.address.postcode,
        addressCountry: site.contact.address.country,
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: site.contact.geo.latitude,
        longitude: site.contact.geo.longitude,
      },
      openingHoursSpecification: [
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          opens: '09:00',
          closes: '17:30',
        },
      ],
    },
    content: contactPage({ csrf: ctx.csrf, values, issuedAt: ctx.formIssuedAt }),
  });
});

router.post('/contact', (ctx) => {
  if (ctx.checkBotTrap()) return undefined;

  const { ok, data, errors } = validate(ctx.body, contactSchema);

  if (!ok) {
    return ctx.render({
      title: 'Contact',
      description: `Email, telephone and postal contact for ${site.name}, and a form that reaches one of two people.`,
      crumbs: [{ href: '/contact', label: 'Contact' }],
      status: 400,
      robots: 'noindex, nofollow',
      content: contactPage({ csrf: ctx.csrf, values: ctx.body, errors, issuedAt: ctx.formIssuedAt }),
    });
  }

  const { reference } = enquiries.create(data);
  return ctx.redirect(`/thank-you?ref=${encodeURIComponent(reference)}`);
});

router.get('/thank-you', (ctx) => {
  const reference = (ctx.query.get('ref') || '').slice(0, 20);
  if (!/^NG-\d{4}-[0-9A-F]{6}$/.test(reference)) return ctx.redirect('/contact');

  return ctx.render({
    title: 'Message received',
    description: 'Your enquiry reached us. Here is your reference and what happens next.',
    crumbs: [
      { href: '/contact', label: 'Contact' },
      { href: '/thank-you', label: 'Message received' },
    ],
    robots: 'noindex, nofollow',
    content: thankYouPage({ reference }),
  });
});

/* --------------------------------------------------------------- reviews */

const reviewSchema = {
  display_name: rules.text({ label: 'Name to display', min: 2, max: FIELD_LIMITS.name }),
  role: rules.text({ label: 'How you use it', min: 3, max: FIELD_LIMITS.name }),
  email: rules.email({ label: 'Email address' }),
  rating: rules.integer({ label: 'Your rating', min: 1, max: 5 }),
  body: rules.text({ label: 'Your review', min: 40, max: FIELD_LIMITS.message, multiline: true }),
};

function renderReviews(ctx, extra = {}) {
  return ctx.render({
    title: 'Reviews',
    description:
      'Reviews of NetGuard from people who use it, published only after a person has checked each one. There are none yet, and we have not invented any.',
    crumbs: [{ href: '/reviews', label: 'Reviews' }],
    content: reviewsPage({
      csrf: ctx.csrf,
      published: reviews.published(),
      summary: reviews.summary(),
      issuedAt: ctx.formIssuedAt,
      ...extra,
    }),
    ...(extra.status ? { status: extra.status } : {}),
  });
}

router.get('/reviews', (ctx) => renderReviews(ctx, { submitted: ctx.query.get('submitted') === '1' }));

router.post('/reviews', (ctx) => {
  if (ctx.checkBotTrap()) return undefined;

  const { ok, data, errors } = validate(ctx.body, reviewSchema);
  if (!ok) return renderReviews(ctx, { values: ctx.body, errors, status: 400 });

  reviews.create({
    displayName: data.display_name,
    role: data.role,
    rating: data.rating,
    body: data.body,
    email: data.email,
  });
  return ctx.redirect('/reviews?submitted=1');
});

/* ---------------------------------------------------------------- search */

router.get('/search', (ctx) => {
  const query = (ctx.query.get('q') || '').slice(0, FIELD_LIMITS.query);
  const results = query ? search(query, { limit: 20 }) : [];

  // The query is escaped wherever it is printed, but a title is also read by
  // machines and shown out of context, so only a plain phrase is echoed into
  // it. Anything else gets the generic title.
  const plainQuery = /^[\w .,'-]{1,60}$/.test(query) ? query : '';

  return ctx.render({
    title: plainQuery ? `Search results for ${plainQuery}` : 'Search',
    description: `Search all ${documentCount()} pages of ${site.name} documentation, engineering notes and policies for setup guides, limitations and answers.`,
    crumbs: [{ href: '/search', label: 'Search' }],
    robots: 'noindex, follow',
    content: searchPage({
      query,
      results,
      suggestions: query && results.length === 0 ? suggest(query) : [],
      documentCount: documentCount(),
    }),
  });
});

/* -------------------------------------------------------- support pages */

router.get('/faq', (ctx) =>
  ctx.render({
    title: 'Frequently asked questions',
    description:
      'Can it be bypassed, do you log queries, why is the blocklist small, what happens if the resolver goes down, and four more questions answered without hedging.',
    crumbs: [{ href: '/faq', label: 'FAQ' }],
    schema: faqSchema(),
    content: faqPage(),
  }),
);

router.get('/help', (ctx) =>
  ctx.render({
    title: 'Getting support for gambling harm',
    description:
      'The National Gambling Helpline, GAMSTOP, BeGambleAware, NHS treatment services and Gamblers Anonymous, with telephone numbers and links. None of these are ever blocked.',
    crumbs: [{ href: '/help', label: 'Support' }],
    content: helpPage(),
  }),
);

router.get('/status', (ctx) => {
  const components = ctx.statusComponents();
  return ctx.render({
    title: 'Service status',
    description:
      'Live status of the NetGuard website, database and blocklist distribution, measured when the page loads rather than typed into a dashboard by hand.',
    crumbs: [{ href: '/status', label: 'Status' }],
    robots: 'noindex, follow',
    content: statusPage({
      components,
      loadedAt: INSTANCE_LOADED_AT,
      history: [
        {
          date: '2026-07-22',
          duration: '6 minutes',
          title: 'Resolver unreachable on the reference deployment',
          detail:
            'The SD card on our own test Raspberry Pi remounted read-only during log rotation and the resolver stopped answering. Devices fell back to their secondary resolver, unfiltered. Moved to a USB SSD.',
        },
        {
          date: '2026-07-08',
          duration: '41 minutes',
          title: 'Website returned 502 for a subset of requests',
          detail:
            'A deployment replaced an application instance before its active requests had completed. Requests in flight failed. Deployment handling was changed to let active requests finish.',
        },
      ],
    }),
  });
});

router.get('/changelog', (ctx) =>
  ctx.render({
    title: 'Changelog',
    description: `Every ${site.name} release since 0.7.0, including the releases that fixed something we broke, and corrections made to this website.`,
    crumbs: [{ href: '/changelog', label: 'Changelog' }],
    content: changelogPage(),
  }),
);

router.get('/sitemap', (ctx) =>
  ctx.render({
    title: 'Sitemap',
    description: `Every page on the ${site.name} website in one list, including all documentation pages, engineering notes and policies.`,
    crumbs: [{ href: '/sitemap', label: 'Sitemap' }],
    content: sitemapPage(),
  }),
);

/* ----------------------------------------------------------------- legal */

router.get('/privacy', (ctx) =>
  ctx.render({
    title: 'Privacy policy',
    description:
      'The resolver logs no queries by default. This website stores an account if you make one, an enquiry if you send one, and a day-salted hash if you accept analytics. Nothing else.',
    crumbs: [{ href: '/privacy', label: 'Privacy' }],
    content: privacyPage(),
  }),
);

router.get('/cookies', (ctx) => {
  // The choice lives in a cookie and in local storage. The server can only
  // clear the cookie, so the page tells the script to clear its half too.
  const reset = ctx.query.get('reset') === '1';
  if (reset) ctx.clearCookie('ng_analytics');

  return ctx.render({
    title: 'Cookie policy',
    description:
      'Three first-party cookies: a session cookie, a CSRF cookie and one that remembers your analytics choice. No third-party cookies and no advertising.',
    crumbs: [{ href: '/cookies', label: 'Cookies' }],
    content: cookiesPage({ reset }),
  });
});

router.get('/terms', (ctx) =>
  ctx.render({
    title: 'Terms of service',
    description:
      'What NetGuard promises, what it explicitly does not, acceptable use, cancellation without notice periods, and the limits of liability for a filter that can be switched off.',
    crumbs: [{ href: '/terms', label: 'Terms' }],
    content: termsPage(),
  }),
);

/* ------------------------------------------------------------------ auth */

router.get('/login', (ctx) => {
  if (ctx.user) return ctx.redirect('/dashboard');
  return ctx.render({
    title: 'Sign in',
    description: `Sign in to a ${site.name} hosted-plan account. Self-hosting needs no account.`,
    crumbs: [{ href: '/login', label: 'Sign in' }],
    robots: 'noindex, nofollow',
    content: loginPage({
      csrf: ctx.csrf,
      issuedAt: ctx.formIssuedAt,
      next: ctx.safeNext(ctx.query.get('next')),
      notice:
        ctx.query.get('registered') === '1'
          ? { kind: 'success', title: 'Account created', text: 'Sign in with the address you just registered.' }
          : ctx.query.get('signedout') === '1'
            ? { kind: 'info', title: 'Signed out', text: 'Your session has ended and the cookie has been cleared.' }
            : ctx.query.get('next')
              ? { kind: 'info', text: 'That page needs you to be signed in.' }
              : null,
    }),
  });
});

router.post('/login', async (ctx) => {
  if (ctx.checkBotTrap()) return undefined;

  const { data, errors } = validate(ctx.body, {
    email: rules.email({ label: 'Email address' }),
    password: rules.password({ label: 'Password', min: 1 }),
  });

  const fail = (notice, status = 400, fieldErrors = {}) =>
    ctx.render({
      title: 'Sign in',
      description: `Sign in to a ${site.name} hosted-plan account.`,
      crumbs: [{ href: '/login', label: 'Sign in' }],
      robots: 'noindex, nofollow',
      status,
      content: loginPage({
        csrf: ctx.csrf,
        values: { email: ctx.body.email },
        errors: fieldErrors,
        issuedAt: ctx.formIssuedAt,
        next: ctx.safeNext(ctx.body.next),
        notice,
      }),
    });

  if (Object.keys(errors).length) return fail(null, 400, errors);

  const result = await attemptLogin({
    email: data.email,
    password: data.password,
    ip: ctx.ip,
    userAgent: String(ctx.req.headers['user-agent'] || '').slice(0, 200),
  });

  if (!result.ok) {
    return fail({ kind: 'error', title: result.locked ? 'Temporarily locked' : 'Sign-in failed', text: result.reason }, result.locked ? 429 : 401);
  }

  ctx.setCookie(SESSION_COOKIE, result.sessionId, { maxAge: SESSION_TTL_MS / 1000 });
  return ctx.redirect(ctx.safeNext(ctx.body.next) || '/dashboard');
});

router.get('/register', (ctx) => {
  if (ctx.user) return ctx.redirect('/dashboard');
  return ctx.render({
    title: 'Create an account',
    description: `Create a ${site.name} account for the hosted plan. We store an email address, a display name and a salted PBKDF2 password hash.`,
    crumbs: [{ href: '/register', label: 'Create an account' }],
    robots: 'noindex, nofollow',
    content: registerPage({ csrf: ctx.csrf, issuedAt: ctx.formIssuedAt }),
  });
});

router.post('/register', async (ctx) => {
  if (ctx.checkBotTrap()) return undefined;

  const { ok, data, errors } = validate(ctx.body, {
    display_name: rules.text({ label: 'Your name', min: 2, max: FIELD_LIMITS.name }),
    email: rules.email({ label: 'Email address' }),
    password: rules.password({ label: 'Password', min: 12 }),
    terms: rules.checkbox({ label: 'The terms of service', required: true }),
  });

  const fail = (fieldErrors) =>
    ctx.render({
      title: 'Create an account',
      description: `Create a ${site.name} account for the hosted plan.`,
      crumbs: [{ href: '/register', label: 'Create an account' }],
      robots: 'noindex, nofollow',
      status: 400,
      content: registerPage({
        csrf: ctx.csrf,
        values: { display_name: ctx.body.display_name, email: ctx.body.email, terms: ctx.body.terms },
        errors: fieldErrors,
        issuedAt: ctx.formIssuedAt,
      }),
    });

  if (!ok) return fail(errors);

  const result = await register({ email: data.email, password: data.password, displayName: data.display_name });

  if (!result.ok && result.field) return fail({ [result.field]: result.reason });
  // A duplicate address must not be confirmed to a stranger, so the outcome
  // looks identical to a successful registration. The person who owns the
  // address gets an email; nobody probing the form learns anything.
  if (!result.ok) return ctx.redirect('/login?registered=1');

  return ctx.redirect('/login?registered=1');
});

router.post('/logout', (ctx) => {
  if (ctx.user) logout(ctx.user.sessionId);
  ctx.clearCookie(SESSION_COOKIE);
  return ctx.redirect('/login?signedout=1');
});

/* ------------------------------------------------------------- dashboard */

function requireUser(ctx) {
  if (!ctx.user) {
    ctx.redirect(`/login?next=${encodeURIComponent(ctx.path)}`);
    return false;
  }
  return true;
}

router.get('/dashboard', (ctx) => {
  if (!requireUser(ctx)) return undefined;

  return ctx.render({
    title: 'Dashboard',
    description: 'Your NetGuard resolver addresses, profiles and lists.',
    robots: 'noindex, nofollow',
    content: dashboardOverviewPage({
      user: ctx.userRow(),
      profiles: profiles.forUser(ctx.user.id),
      currentPath: '/dashboard',
      notice: ctx.flash(),
      csrf: ctx.csrf,
    }),
  });
});

router.get('/dashboard/profiles', (ctx) => {
  if (!requireUser(ctx)) return undefined;

  const list = profiles.forUser(ctx.user.id);
  const entries = {};
  for (const profile of list) entries[profile.id] = allowEntries.forProfile(profile.id, ctx.user.id);

  return ctx.render({
    title: 'Profiles and lists',
    description: 'Manage which blocklists are enabled and which domains are allowlisted.',
    robots: 'noindex, nofollow',
    content: dashboardProfilesPage({
      user: ctx.userRow(),
      profiles: list,
      allowEntries: entries,
      csrf: ctx.csrf,
      currentPath: '/dashboard/profiles',
      notice: ctx.flash(),
    }),
  });
});

router.post('/dashboard/profiles', (ctx) => {
  if (!requireUser(ctx)) return undefined;

  const { ok, data, errors } = validate(ctx.body, {
    label: rules.text({ label: 'Profile name', min: 2, max: FIELD_LIMITS.name }),
  });
  if (!ok) {
    return ctx.render({
      title: 'Profiles and lists',
      description: 'Manage which blocklists are enabled and which domains are allowlisted.',
      robots: 'noindex, nofollow',
      status: 400,
      content: dashboardProfilesPage({
        user: ctx.userRow(),
        profiles: profiles.forUser(ctx.user.id),
        allowEntries: {},
        csrf: ctx.csrf,
        currentPath: '/dashboard/profiles',
        errors,
      }),
    });
  }

  profiles.create(ctx.user.id, data.label, ctx.selectedLists());
  ctx.setFlash({ kind: 'success', title: 'Profile created', text: `${data.label} is ready to use.` });
  return ctx.redirect('/dashboard/profiles');
});

router.post('/dashboard/profiles/:id', (ctx) => {
  if (!requireUser(ctx)) return undefined;

  // Ownership is enforced inside the UPDATE, so a guessed id changes nothing.
  const changed = profiles.update(ctx.params.id, ctx.user.id, { lists: ctx.selectedLists() });
  ctx.setFlash(
    changed
      ? { kind: 'success', title: 'Lists saved', text: 'The change applies to new lookups immediately.' }
      : { kind: 'error', title: 'Nothing changed', text: 'That profile does not belong to this account.' },
  );
  return ctx.redirect('/dashboard/profiles');
});

router.post('/dashboard/profiles/:id/allow', (ctx) => {
  if (!requireUser(ctx)) return undefined;

  const { ok, data, errors } = validate(ctx.body, {
    domain: rules.domain({ label: 'Domain to allow' }),
    note: rules.text({ label: 'Why', max: FIELD_LIMITS.org, required: false }),
  });

  if (!ok) {
    ctx.setFlash({ kind: 'error', title: 'Not added', text: errors.domain || errors.note });
    return ctx.redirect('/dashboard/profiles');
  }

  const added = allowEntries.add(ctx.params.id, ctx.user.id, data.domain, data.note);
  ctx.setFlash(
    added
      ? { kind: 'success', title: 'Allowlisted', text: `${data.domain} will resolve normally from now on.` }
      : { kind: 'error', title: 'Not added', text: 'That profile does not belong to this account.' },
  );
  return ctx.redirect('/dashboard/profiles');
});

router.post('/dashboard/allow/:id/delete', (ctx) => {
  if (!requireUser(ctx)) return undefined;

  const removed = allowEntries.remove(ctx.params.id, ctx.user.id);
  ctx.setFlash(
    removed
      ? { kind: 'success', title: 'Removed', text: 'That domain is filtered again.' }
      : { kind: 'error', title: 'Nothing removed', text: 'That entry does not belong to this account.' },
  );
  return ctx.redirect('/dashboard/profiles');
});

router.get('/dashboard/account', (ctx) => {
  if (!requireUser(ctx)) return undefined;

  const list = profiles.forUser(ctx.user.id);
  let allowCount = 0;
  for (const profile of list) allowCount += allowEntries.forProfile(profile.id, ctx.user.id).length;

  return ctx.render({
    title: 'Account and data',
    description: 'Everything stored about your account, an export, and account deletion.',
    robots: 'noindex, nofollow',
    content: dashboardAccountPage({
      user: ctx.userRow(),
      csrf: ctx.csrf,
      currentPath: '/dashboard/account',
      notice: ctx.flash(),
      counts: {
        sessions: sessions.countFor(ctx.user.id),
        profiles: list.length,
        allowEntries: allowCount,
      },
    }),
  });
});

router.get('/dashboard/export.json', (ctx) => {
  if (!requireUser(ctx)) return undefined;

  const row = ctx.userRow();
  const list = profiles.forUser(ctx.user.id);

  return ctx.json(
    200,
    {
      exported_at: new Date().toISOString(),
      note: 'This is everything associated with your account. Resolved-query history is absent because it is never collected.',
      account: {
        email: row.email,
        display_name: row.display_name,
        created_at: row.created_at,
        last_login_at: row.last_login_at,
      },
      profiles: list.map((profile) => ({
        label: profile.label,
        lists: (profile.lists || '').split(',').filter(Boolean),
        created_at: profile.created_at,
        allowlist: allowEntries.forProfile(profile.id, ctx.user.id).map((entry) => ({
          domain: entry.domain,
          note: entry.note,
          created_at: entry.created_at,
        })),
      })),
      resolved_queries: [],
    },
    { download: 'netguard-export.json' },
  );
});

router.post('/dashboard/sessions/revoke', (ctx) => {
  if (!requireUser(ctx)) return undefined;

  sessions.destroyAllFor(ctx.user.id);
  ctx.clearCookie(SESSION_COOKIE);
  return ctx.redirect('/login?signedout=1');
});

router.post('/dashboard/delete', (ctx) => {
  if (!requireUser(ctx)) return undefined;

  const typed = String(ctx.body.confirm_email || '').trim().toLowerCase();
  const row = ctx.userRow();

  if (typed !== row.email) {
    ctx.setFlash({
      kind: 'error',
      title: 'Not deleted',
      text: 'The address you typed did not match the address on the account, so nothing was changed.',
    });
    return ctx.redirect('/dashboard/account');
  }

  ctx.deleteAccount(ctx.user.id);
  ctx.clearCookie(SESSION_COOKIE);
  return ctx.redirect('/?deleted=1');
});

/* ------------------------------------------------------------------- API */

router.post('/api/coverage', (ctx) => {
  const { ok, data, errors } = validate(ctx.body, { domain: rules.domain({ label: 'Domain' }) });

  if (!ok) {
    return ctx.json(400, { error: 'invalid_domain', message: errors.domain });
  }

  const result = lookup(data.domain);
  coverageChecks.record(result.domain, result.listed);

  // Deliberately trimmed: only what the caller asked about. No internal ids,
  // no timing data, no record of who asked.
  if (result.protected) {
    return ctx.json(200, {
      domain: result.domain,
      listed: false,
      protected: true,
      checkedAt: new Date().toISOString(),
      listsSearched: counts().listCount,
    });
  }

  return ctx.json(200, {
    domain: result.domain,
    listed: result.listed,
    list: result.list || null,
    listId: result.listId || null,
    matchedRule: result.rule || null,
    rule: result.rule || null,
    source: result.source || null,
    checkedAt: new Date().toISOString(),
    listsSearched: counts().listCount,
  });
});

router.post('/api/pageview', async (ctx) => {
  if (!ctx.analyticsAccepted) return ctx.json(204, null);

  const path = String(ctx.body.path || '').slice(0, 200);
  if (!path.startsWith('/')) return ctx.json(400, { error: 'invalid_path', message: 'path must begin with a slash.' });

  let referrerHost = '';
  try {
    if (ctx.body.referrer) referrerHost = new URL(String(ctx.body.referrer)).host.slice(0, 100);
  } catch {
    referrerHost = '';
  }
  if (referrerHost === ctx.host) referrerHost = '';

  const day = new Date().toISOString().slice(0, 10);
  analytics.record({
    day,
    path,
    visitorHash: await visitorHash(ctx.ip, String(ctx.req.headers['user-agent'] || ''), day),
    referrerHost,
    utm: {
      source: String(ctx.body.utm_source || '').slice(0, 60),
      medium: String(ctx.body.utm_medium || '').slice(0, 60),
      campaign: String(ctx.body.utm_campaign || '').slice(0, 60),
    },
  });

  return ctx.json(204, null);
});

/* --------------------------------------------------------- search index */

/**
 * Builds the search index from the same content the pages render, plus a
 * hand-written entry per static page. Called once at startup.
 */
export function buildSearchIndex() {
  clearIndex();

  for (const doc of allDocs()) {
    addDocument({
      url: `/docs/${doc.slug}`,
      title: doc.title,
      summary: doc.description,
      body: doc.plain,
      section: 'Documentation',
      updated: doc.updated,
    });
  }

  for (const post of allPosts()) {
    addDocument({
      url: `/blog/${post.slug}`,
      title: post.title,
      summary: post.summary || post.description,
      body: post.plain,
      section: 'Notes',
      updated: post.updated || post.date,
    });
  }

  const pages = [
    {
      url: '/',
      title: `${site.name}: block gambling sites on every device`,
      summary: site.description,
      body: `DNS resolver refuses to look up gambling domains. Router setup covers every phone laptop console television. ${statistics.problemGambling.value} of adults score 8 or more on the PGSI. Speed bump not a lock.`,
    },
    {
      url: '/how-it-works',
      title: 'How it works',
      summary: 'Where the resolver sits, why it answers NXDOMAIN, what it covers and the four things it cannot see.',
      body: 'DNS lookup NXDOMAIN rebind protection encrypted DNS VPN mobile data administrator rights cache upstream resolver.',
    },
    {
      url: '/coverage',
      title: 'Coverage',
      summary: `All ${counts().total} rules across ${counts().listCount} lists, with a lookup for a specific domain.`,
      body: 'Blocklist suffix rules gambling affiliate lottery crypto never-block GamCare GAMSTOP allowlist false positive.',
    },
    {
      url: '/pricing',
      title: 'Pricing',
      summary: 'Self-hosted free, hosted four pounds a month per network, organisations priced on the work.',
      body: 'Free self-hosted hosted plan organisation schools clinics treatment services no minimum term cancel any time VAT.',
    },
    {
      url: '/about',
      title: `About ${site.name}`,
      summary: 'Two people, one resolver, and a decision not to exaggerate anything.',
      body: 'Priya Raghunathan Tomas Brennan London Wharf Road funding hosted plan no investors no advertising no affiliate revenue.',
    },
    {
      url: '/case-study',
      title: 'Case study: a six-device household',
      summary: 'Thirty days of measured figures from one Raspberry Pi deployment.',
      body: 'Raspberry Pi 41,300 queries 78 per cent cache hit rate 84 MB memory downtime SD card read-only television update endpoint.',
    },
    {
      url: '/faq',
      title: 'Frequently asked questions',
      summary: 'The eight questions we are actually asked.',
      body: FAQ.map((entry) => `${entry.question} ${String(entry.answer).replace(/<[^>]+>/g, ' ')}`).join(' '),
    },
    {
      url: '/help',
      title: 'Getting support for gambling harm',
      summary: 'Helpline, GAMSTOP, BeGambleAware, NHS treatment, Gamblers Anonymous, Citizens Advice, Samaritans.',
      body: `National Gambling Helpline ${site.helpline.phone} GamCare GAMSTOP self-exclusion BeGambleAware NHS clinics Gamblers Anonymous Citizens Advice debt Samaritans 116 123.`,
    },
    {
      url: '/reviews',
      title: 'Reviews',
      summary: 'Real reviews only. There are none yet.',
      body: 'Review policy verification no incentives critical reviews published empty state.',
    },
    {
      url: '/content-policy',
      title: 'Content and proof policy',
      summary: 'No invented testimonials, no generated faces, no uncited statistics, no counters that count nothing.',
      body: 'Statistics citation testimonials photographs logos counters claims illustrations corrections.',
    },
    {
      url: '/accessibility',
      title: 'Accessibility statement',
      summary: 'WCAG 2.2 AA, how it was tested, and the two known problems.',
      body: 'Contrast focus ring keyboard 44 pixel targets reduced motion 320 pixels zoom skip link screen reader known problems.',
    },
    {
      url: '/security',
      title: 'Report a vulnerability',
      summary: 'Coordinated disclosure policy, scope and safe harbour.',
      body: 'PBKDF2 SHA-256 CSRF atomic ETag writes ownership checks content security policy nonce rate limit safe harbour scope security.txt.',
    },
    {
      url: '/status',
      title: 'Service status',
      summary: 'Measured when you load the page.',
      body: 'Website database blocklist distribution incidents uptime secondary resolver.',
    },
    {
      url: '/changelog',
      title: 'Changelog',
      summary: 'Every release, including the ones that fixed something we broke.',
      body: CHANGELOG.map((entry) => `${entry.version} ${entry.changes.map((c) => c.text).join(' ')}`).join(' '),
    },
    {
      url: '/privacy',
      title: 'Privacy policy',
      summary: 'Everything this website and this resolver store about you.',
      body: 'No query logs PBKDF2 session cookie analytics day-salted hash UK GDPR rights ICO processors retention.',
    },
    {
      url: '/cookies',
      title: 'Cookie policy',
      summary: 'Three first-party cookies and two local storage values.',
      body: 'ng_session ng_csrf ng_analytics HttpOnly Secure SameSite local storage theme.',
    },
    {
      url: '/terms',
      title: 'Terms of service',
      summary: 'What we promise and what we do not.',
      body: 'Acceptable use accounts payment cancellation availability liability termination English law changes.',
    },
    {
      url: '/contact',
      title: 'Contact',
      summary: 'Email, telephone, post, and a form that reaches one of two people.',
      body: `${site.contact.email} ${site.contact.phone} ${site.contact.address.street} response within one working day.`,
    },
  ];

  for (const page of pages) addDocument({ ...page, section: 'Pages', updated: lastContentUpdate() });
}

/** Used by the 404 handler and by tests. */
export function renderNotFound(ctx) {
  return ctx.render({
    title: 'Page not found',
    description: 'That address does not exist on this site. Search, or try one of the pages listed here.',
    status: 404,
    robots: 'noindex, follow',
    content: notFoundPage({ path: ctx.path }),
  });
}

export const NAV_PATHS = primaryNav.map((item) => item.href);
export const PAGE_RATE = RATE_LIMITS.page;
export { html };
