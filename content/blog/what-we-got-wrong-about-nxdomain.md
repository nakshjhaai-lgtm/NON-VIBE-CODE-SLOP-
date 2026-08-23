---
title: What we got wrong about NXDOMAIN
date: 2026-05-06
updated: 2026-05-09
author: Tomas Brennan
tags: [dns, engineering, postmortem]
description: We shipped 0.0.0.0 as the default blocked response. It broke Asus routers, slowed some clients by thirty seconds, and we changed it.
summary: A default we picked for a good reason turned out to be wrong for two reasons we had not considered. A short postmortem.
---

When a resolver blocks a domain it has to answer with something. The two sensible options are `NXDOMAIN`, meaning this name does not exist, and an address that goes nowhere, usually `0.0.0.0`.

We shipped `0.0.0.0` as the default. We were wrong, and it took two separate classes of bug report to convince us.

## Why we picked it

`0.0.0.0` gives you a connection refused error rather than a name resolution error. In several browsers that produces a slightly cleaner failure page, and it means a blocked request fails fast at the socket rather than after a DNS timeout.

It also makes filtering visible in packet captures, which was convenient during development.

Both of those reasons are about our convenience and about cosmetics. Neither is about correctness, and that should have been a warning.

## The first problem: rebind protection

Asus routers, and some others, implement DNS rebind protection. The router inspects DNS answers and discards any that point at private, loopback or null addresses, because that pattern is a known attack against devices on the local network.

`0.0.0.0` is exactly that pattern. The router silently dropped our answers.

The symptom was maddening: filtering worked sometimes. When the client retried and hit the secondary resolver, or when the answer came from a cache above the router, the request went through. Users reported "it blocks about half the time", which sounds like a flaky list and is not.

## The second problem: the thirty second stall

Some clients, given an address, will try to connect to it and wait for the TCP timeout. On a network with no route to `0.0.0.0`, that wait can be thirty seconds or more.

For a browser this is a slow error page. For a background app it is worse: it retries, and each retry stalls, and a device that checks in every minute ends up with a queue of stalled connections. One reporter had a smart television that became unresponsive because of it.

`NXDOMAIN` fails immediately. There is no address to try.

## The change

Version 0.7.0 changed the default to `NXDOMAIN`. Existing installations kept their setting on upgrade, because silently changing behaviour on a filtering product is worse than a suboptimal default, and we wrote to everyone we could identify to explain the option.

`zeroip` remains available. There are networks where something mishandles `NXDOMAIN`, and having the escape hatch costs nothing.

## What we should have done

The DNS specifications say `NXDOMAIN` means the name does not exist, and for a blocked domain, from that resolver's point of view, that is true. Returning an address that is not an address is a lie told to the client, and the client is entitled to believe it.

We picked the option that looked better in a browser over the option that was semantically correct. When the two disagree, and one of them is "tell the truth to the protocol", that is not a close call. It only looked like one because we were thinking about the error page rather than the protocol.

The general form of this mistake: we optimised the visible cosmetic case and broke the invisible correctness case. The visible one was ours to see during development. The invisible one belonged to users on routers we did not own.
