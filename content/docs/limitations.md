---
title: What DNS filtering cannot do
description: An honest account of the ways DNS filtering is bypassed, who it is not suitable for, and when to use something else instead.
order: 1
section: Understanding the limits
updated: 2026-08-19
summary: Every documented way this is bypassed, written down in one place rather than buried. Read this before you rely on it.
---

Most products in this space describe what they block. This page describes what they do not, because a filter you have misunderstood is worse than no filter: it produces false confidence in the person relying on it.

## It is trivially reversible by the device owner

Anyone with administrator rights can change DNS settings back in under a minute. On a router, anyone with the admin password can do the same for the whole network.

This is not a defect we are working on. It is inherent to the approach. DNS is a setting, and settings can be changed. Products that market themselves as tamper-proof are usually relying on mobile device management or a supervised device profile, which are different technologies with their own costs.

What a filter does well is add friction at the moment of impulse. Research on self-exclusion schemes consistently finds that friction helps and determination defeats it. Both halves of that sentence are true.

## Encrypted DNS bypasses it silently

Firefox, Chrome and Edge can send DNS queries over HTTPS directly to a resolver of their own choosing, ignoring the operating system entirely. When that happens your filtering is not blocked or broken, it is simply not consulted, and there is no error to notice.

Chrome uses the same provider as your system resolver if it recognises it, so it typically works out. Firefox enables DNS over HTTPS with Cloudflare in some regions by default. See [encrypted DNS](/docs/encrypted-dns) for the settings to check on each browser.

## A VPN takes DNS with it

Almost every consumer VPN routes DNS through its own tunnel. Installing one takes a couple of minutes and defeats network-level filtering completely. There is no DNS configuration that prevents this.

If you need to prevent VPN use, that is a device management problem, not a DNS problem.

## Mobile data is untouched

Filtering applies to the network. A phone that leaves the house is unfiltered. Any product that filters a phone everywhere is running a VPN profile or an MDM profile on that phone.

## Blocklists are always incomplete

New domains appear daily. Operators register alternates specifically to route around filters. Our lists are reviewed against public registers, and the review date for each is printed on [the coverage page](/coverage) so you can see how stale they are rather than having to trust an unqualified "always up to date".

We publish the count of entries. We will not publish an impressive-sounding total that is padded with dead domains and subdomain permutations, which is how those numbers usually get large.

## It cannot see inside an app

An app that talks to a hard-coded IP address never makes a DNS query. This is uncommon on the open web and less uncommon in native apps.

## What it is genuinely good for

A household where everyone agrees the filter should be there. Removing the accidental route: the advert, the link in a group chat, the half-considered search at one in the morning.

A shared computer where one person wants a barrier and does not have admin rights on it.

A network where a person has self-excluded through [GAMSTOP](https://www.gamstop.co.uk/) and wants the technical route closed as well as the account route.

## When to use something else

If the person concerned does not want the filter, DNS is the wrong layer. Consider self-exclusion schemes, bank-level gambling blocks (most UK banks now offer one, and they are harder to reverse than a DNS setting because many impose a cooling-off period), and speaking to the National Gambling Helpline on 0808 8020 133, which is free and open at any hour.

We would rather you used the right tool than bought ours.
