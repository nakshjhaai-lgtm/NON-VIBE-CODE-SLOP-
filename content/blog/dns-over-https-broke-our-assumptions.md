---
title: DNS over HTTPS broke our assumptions
date: 2026-07-29
updated: 2026-08-04
author: Tomas Brennan
tags: [dns, engineering]
description: A support ticket that took three weeks to understand, and what it taught us about writing documentation for silent failures.
summary: Filtering worked on every device and failed in one browser. The bug was in our documentation, not our code.
---

In May we had a support ticket we could not reproduce. Filtering worked on every device on the reporter's network, on every test we could think of, and failed in Firefox on one laptop. Only Firefox. Only that laptop.

It took three weeks to understand, and the answer was not in our code.

## The investigation

The reporter, a parent who had set NetGuard up after a family conversation, was methodical. They ran every command we asked for. `scutil --dns` showed our resolver. `nslookup` against it returned `NXDOMAIN` for the domains they cared about. Chrome blocked them. Safari blocked them.

Firefox loaded them, instantly, with no error.

We looked at the resolver logs. There was no query. Firefox had not asked us anything.

Firefox had enabled DNS over HTTPS on its own, as it does by default in some regions, and was sending queries directly to Cloudflare over port 443. Nothing was broken. Our resolver was simply not being consulted, and there was no error anywhere because from Firefox's point of view everything worked perfectly.

The reporter had spent an evening convinced they had misconfigured something. They had not. Our documentation had not told them this could happen.

## Why this is the worst class of bug

A filter that fails loudly is annoying. A filter that fails silently is dangerous, because the person relying on it does not know they are unprotected.

This one is worse still because the failure is invisible from every angle. There is no error in the browser. There is no entry in the resolver log, because no query arrived. There is nothing in the operating system's DNS configuration, which still points at us and is still correct. Every diagnostic we had documented pointed at a working system.

The only test that would have caught it was "try the same site in a different browser", which we had not thought to write down because it does not look like a DNS diagnostic.

## What we changed

We wrote [encrypted DNS](/docs/encrypted-dns), which lists the exact setting in each browser and what each value does.

We put the cross-browser test at the top of [troubleshooting](/docs/troubleshooting), because it is the fastest way to identify this and it needs no tooling.

We added a page called [what DNS filtering cannot do](/docs/limitations), and we link to it from the home page rather than burying it. It is not a comfortable page to have in a sales funnel. It is the page most likely to prevent someone from relying on this when they should be using something else.

We shipped a DoH endpoint on the resolver, so people who want encrypted DNS can have it without giving up filtering. Fighting the technology was never going to work; the browsers are right that plain DNS should not be the default in 2026.

## What we did not change

We did not add a scary banner about unprotected browsers. We considered it and rejected it, because it would be wrong most of the time. Chrome's default upgrades to your own resolver's encrypted endpoint when it recognises it, which means the common case is fine, and a warning that cries wolf gets dismissed.

We did not add a "protection status" indicator to the dashboard. A web page cannot see your DNS settings. Any indicator we drew would be a guess dressed up as a fact, and the whole reason we lost three weeks was somebody trusting an indicator that could not know what it claimed to know.

## The general lesson

We had documented what to do when the product does not work. We had not documented what to do when the product appears to work and does not.

Those are different documents. The second one is harder to write, because it requires admitting where your product is not in the loop at all.
