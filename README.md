# NetGuard

NetGuard is a self-hosted DNS resolver that blocks gambling domains for every
device on a network. Point a router at it once and every phone, laptop,
console and television on that network is covered — with no client software to
install on any of them.

It is built to be the opposite of a vibe-coded landing page: no gradients, no
invented testimonials, no uncited statistics, and an honest account of what a
DNS filter can and cannot do.

## What's here

- **Server-side rendering** with no framework and no build step. Everything is
  checked in and served as-is from Netlify's edge.
- **A real design system**: a token file that holds every colour, spacing step,
  radius, shadow and duration, enforced by a test suite so nothing drifts.
- **Working product features**, not mockups. Try the coverage lookup, sign in,
  manage a profile, submit a review, or contact the team.
- **Documentation and notes** rendered from Markdown, with a search index built
  at runtime.

## Running the tests

The project needs no dependencies. Run the test suite with:

```sh
node --test tests/design-system.test.js
```

The design-system tests also verify WCAG contrast for every shipped colour
pair, so a token edit that quietly breaks readability cannot pass.

## The design brief

This site deliberately refuses the signals that make a page read as generated:

- **No gradients, glow, glassmorphism or decorative perpetual motion.**
- **One brand hue** (a desaturated pine green) plus a warm clay used sparingly.
- **A warm paper palette** instead of clinical white, and an editorial serif
  voice for headlines paired with IBM Plex Sans and IBM Plex Mono.
- **Real figures, each with its source** — a statistic without one is a
  decoration, and this site won't show one.
- **No fake reviews, no fake faces, no fabricated counters.**

There is no account-gated wall in front of the product: the fastest way to know
whether it is useful is to try the thing it does, so the coverage lookup sits
above the fold with no sign-in.
