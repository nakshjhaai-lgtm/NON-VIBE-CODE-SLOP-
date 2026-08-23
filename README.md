# NetGuard

A website for a DNS resolver that blocks gambling domains at the network
level. Server-rendered Node, one runtime dependency, no build step for the
pages themselves.

The product it describes is a demonstration: the resolver addresses are IETF
documentation ranges, the domain is a reserved example domain, and the company
is not incorporated. Everything that *could* be real is real, and everything
that could not be is labelled as such rather than invented. See
[`/content-policy`](content/) for the rules the site holds itself to.

## Running it

```
npm install
npm run build     # fonts, icons, social card, diagrams
npm start         # http://localhost:3000
```

`npm run dev` restarts on change. `npm test` runs the contrast checker and the
full suite. Node 22.5 or newer is required, for `node:sqlite`.

Copy `.env.example` to `.env` before deploying. `NETGUARD_CSRF_KEY` and
`NETGUARD_ANALYTICS_SALT` must be set to persistent random values, or every
restart invalidates all sessions and form tokens.

## How it is put together

```
content/          markdown for docs and notes, parsed once at boot
public/css/       tokens.css defines the design system, main.css uses it
public/js/        progressive enhancement only; nothing here is required
scripts/          asset generation, contrast checking
server/db/        schema and queries, all parameterised
server/http/      headers, cookies, CSRF, body parsing, routing, static files
server/lib/       templating, validation, auth, search, blocklists, content
server/routes/    the route table and the machine-readable endpoints
server/views/     layout, shared components, one module per page group
tests/            184 tests over the running server
```

### The design system comes first

`public/css/tokens.css` is the only file permitted to name a colour, a spacing
value, a radius, a shadow, a duration or a font weight. `main.css` references
tokens exclusively, and `tests/design-system.test.js` fails the build if a raw
value creeps in. Inconsistency is what makes a site look generated, so it is
enforced mechanically rather than by discipline.

Three radii, three shadows (floating UI only), one focus ring, a 68ch measure,
a 16px minimum body size and 44px minimum targets. All 56 foreground and
background pairings are contrast-checked in both themes by
`scripts/check-contrast.js`, which runs as the first step of `npm test`.

### Rendering

`server/lib/html.js` provides a tagged template that escapes every
interpolation by default. Escaping is a property of the template, not
something each page has to remember, which is why there is no XSS surface to
audit page by page.

Content lives in markdown under `content/` and is parsed, rendered and
indexed once at startup. A file missing a title or description throws at boot
rather than producing a broken page later.

### Progressive enhancement

Every page works with JavaScript disabled: forms submit to real routes,
search runs on the server, the coverage checker returns a rendered page, and
the FAQ expands because it is built from `<details>`. `public/js/app.js` only
improves what already works, and every enhancement checks for its element
before binding.

### Security

- argon2id password hashing; five failures locks an account for fifteen minutes
- signed double-submit CSRF tokens compared in constant time, plus an Origin check
- opaque session cookies, HttpOnly, SameSite=Lax, Secure over HTTPS, 12 hour expiry
- every query parameterised; ownership enforced in the `WHERE` clause
- server-side schema validation, with only named fields reaching the database
- CSP with a per-response nonce, no `unsafe-inline`, no `unsafe-eval`
- 64 KiB body cap, two accepted content types, no file uploads
- rate limits per class of route; a honeypot and a timing check on every form

`npm run audit` checks the runtime dependency tree. There is one runtime
dependency.

### Privacy

The resolver logs no queries. This site sets no cookie until you sign in,
submit a form, or accept analytics. Page counting is first-party and stores a
day-salted truncated hash that cannot be reversed or followed across days.
There is no third-party request anywhere on the site, and the CSP forbids one.

## Tests

```
npm test
```

- `tests/pages.test.js` every page renders with unique metadata and one `h1`
- `tests/security.test.js` CSRF, injection, escaping, auth, access control, traversal
- `tests/features.test.js` the interactive behaviour the site promises
- `tests/design-system.test.js` token discipline and the banned visual signals
- `tests/links.test.js` a full crawl: no broken link, no dead anchor, no overflow

## Licence

UNLICENSED. Not for redistribution.
