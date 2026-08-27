# NetGuard

NetGuard is a server-rendered website for a DNS resolver that blocks gambling
domains at the network level. The application runs as a Netlify Edge Function,
serves its checked-in assets through Netlify's CDN, and stores application state
in Netlify Blobs. Its project build needs no package installation, native
module, application compiler, writable local database, Node server, or Python
runtime.

The product described by the site is a demonstration: resolver addresses use
IETF documentation ranges, the domain is reserved for examples, and the company
is not incorporated. Claims that can be demonstrated are implemented; claims
that cannot are labelled rather than invented. See [`content/`](content/) for
the site's source material and content policy.

## Deploying to Netlify

The repository is deploy-ready as checked in.

1. Import the repository into Netlify, or connect it to an existing Netlify
   site.
2. Leave the build settings from [`netlify.toml`](netlify.toml) in place.
3. Optionally set `NETGUARD_ORIGIN` for the site's canonical public URL. Netlify's
   built-in `URL` value is used when this is omitted.
4. Deploy.

Netlify reads the configuration automatically:

- `public/` is the publish directory;
- `netlify/edge-functions/app.js` handles every application route;
- CSS, JavaScript, fonts, images and the favicon bypass the function and are
  served directly by the CDN;
- the build command only confirms that checked-in assets are being used;
- no package manager or dependency installation runs.

Netlify injects the credentials and endpoints needed for Blobs into the Edge
Function. There is no database to provision and no Blob token to add manually.
Published production deploys share durable production state. Deploy Previews and
old, no-longer-published deploys use keys isolated by deploy ID, so test accounts
cannot read or overwrite production accounts.

### Environment variables

No secret application variable is required. The CSRF secret is a random
HttpOnly cookie and the analytics salt is generated once inside persistent
state.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NETGUARD_ORIGIN` | No | Canonical origin used in metadata and generated absolute URLs. Falls back to Netlify's `URL`, then `https://netguard.example`. |
| `NETGUARD_ASSET_VERSION` | No | Cache-busting query value for checked-in CSS and JavaScript. |
| `NETGUARD_FRAME_ANCESTORS` | No | Permitted frame ancestors for a non-production preview. Production always denies framing. |

Set these in **Project configuration → Environment variables** with Functions
scope if needed. Do not commit real values. [`.env.example`](.env.example)
contains the same optional settings for local Netlify tooling.

## Architecture

```text
content/                    authoring copies of documentation and notes
public/                     complete, checked-in CDN assets
netlify/edge-functions/     the Netlify request entry point
server/db/                  versioned state repository and Blobs adapter
server/http/                body, cookie, CSRF, routing and header policies
server/lib/                 auth, content snapshot, validation and domain logic
server/routes/              HTML and machine-readable route handlers
server/views/               layout, components and page groups
tests/                      application, security, crawl and design checks
```

### Requests and rendering

The application uses the standard Fetch `Request` and `Response` APIs throughout.
`server/lib/html.js` escapes every interpolated value by default. Pages remain
server rendered, forms still submit to real routes, search runs on the server,
and the coverage checker returns both HTML and JSON. Client JavaScript is only
progressive enhancement.

Markdown authoring files remain under `content/`. Their validated deployment
snapshot is checked in at `server/lib/content-data.js`, allowing Edge isolates
to initialise search and documentation without filesystem access or a content
build during deployment.

### Persistent state

Accounts, sessions, profiles, allowlists, enquiries, reviews, analytics and
login lockouts retain the same repository interfaces in `server/db/index.js`.
The state is a versioned JSON document in Netlify Blobs rather than a local
SQLite file.

Each request performs a strong read. A changed document is written with an ETag
precondition; if another Edge isolate commits first, the operation is replayed
against the newer state. This prevents concurrent writes from silently
clobbering one another. Record ownership checks and account-deletion cascades
are enforced in the repository.

Netlify Blobs is intended for frequent reads and comparatively infrequent
writes. This compact state model fits the demonstration and its existing
feature set; a high-volume service should move the same repository contract to
a transactional managed database.

### Static assets

All required CSS, JavaScript, fonts, icons, diagrams, maps and social imagery are
committed under `public/`. Netlify supplies CDN compression, conditional
requests and caching. No image library, font tool, native binding or asset
compiler runs during deployment.

### Security

- salted PBKDF2-HMAC-SHA-256 password hashes with 180,000 iterations;
- persistent lockout after five failed sign-ins per account/address pair in
  fifteen minutes, with equivalent password work for a missing account;
- opaque twelve-hour sessions in HttpOnly, Secure, SameSite=Lax cookies;
- random double-submit CSRF tokens compared in constant work, plus an Origin
  check on POST requests;
- ownership checks on every account-data mutation and atomic ETag writes;
- server-side schema validation that reads only named fields;
- escaped templates and a nonce-based Content Security Policy with neither
  `unsafe-inline` nor `unsafe-eval` for scripts;
- a 64 KiB body limit, two accepted content types and no file uploads;
- per-route-class rate limits, plus honeypot and elapsed-time form checks.

### Privacy

The resolver logs no DNS queries. The website sets no cookie on ordinary
content pages; a CSRF cookie is issued when a visitor opens a form, and a
session cookie is issued only after sign-in. First-party page counting is
opt-in and stores a day-salted, truncated hash that cannot be followed across
days. Browser assets make no
third-party requests, and the Content Security Policy forbids them.

## Optional local validation

Deployment itself does not need Node. The repository's compatibility test
harness does, because it emulates Netlify's Edge handler and static CDN using
Node's built-in test and HTTP modules. With a recent Node release installed,
run:

```sh
node --experimental-default-type=module --test --test-concurrency=1 "tests/*.test.js"
```

No `npm install` is needed. The suite currently contains 197 tests covering:

- page rendering, unique metadata and document structure;
- forms, search, coverage, accounts, sessions and dashboard ownership;
- CSRF, escaping, injection payloads, authentication and traversal resistance;
- design tokens, accessibility invariants and all 56 contrast pairs;
- a complete internal-link and asset crawl, compression and transfer budgets.

For a local platform-level preview, Netlify CLI can run the repository with its
own `netlify dev` command. That CLI is optional development tooling and is not
installed or invoked by the deploy.

## Licence

UNLICENSED. Not for redistribution.
