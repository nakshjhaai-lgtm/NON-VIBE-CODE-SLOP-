---
title: Query logging is off by default, and here is what that costs us
date: 2026-06-17
updated: 2026-06-17
author: Priya Raghunathan
tags: [privacy, product]
description: A DNS query log is a complete record of everything a household does online. We default it off and accept the support burden that follows.
summary: The single most useful debugging tool we have is also the most invasive file on the network. We turned it off and it made support harder.
---

A DNS query log is a record of every domain every device on a network asked for, with timestamps. It is not metadata in any meaningful sense. It is a diary.

It shows the hour someone woke up, the news they read, the bank they use, the health condition they searched, the dating app on their phone, and, for a product like ours, the gambling site they tried to reach at two in the morning.

For a filtering product bought by one household member to help another, that file is loaded in a way that goes beyond ordinary privacy. It is a surveillance capability, handed to someone in a relationship where trust is already strained.

So it is off.

## What off means

The resolver ships with `logging.queries = false`. Nothing is written to disk. The in-memory cache holds answers, not a history of who asked for what.

Aggregate counters remain: total queries, cache hit rate, and the number blocked, as numbers with no domains attached. That is what the dashboard graph is drawn from.

If you turn logging on, the config file says what you are turning on, in plain words, and the log rotates out after the retention you set. We default that to zero days, so an accidental enable does not quietly accumulate a year of history.

## What it costs

It made support meaningfully harder, and it is worth being specific about how.

The first cost is diagnosis. When someone reports a site loading that should not, the log would tell us immediately whether we saw the query, and if so what we answered. Without it, we have a conversation. That conversation is [the troubleshooting page](/docs/troubleshooting), written because we could not just read the answer off a log.

The second cost is a feature we cannot build. People ask for a weekly summary email: which sites were blocked, how often, trending up or down. It is a reasonable request and it is the single most common one we get. Building it requires exactly the record we refuse to keep. We have not built it and we do not intend to.

The third cost is that we cannot prove our own effectiveness. We would like to tell you that filtering reduces gambling site visits by some percentage. We cannot, because measuring that requires logging the thing we do not log. The [Gambling Commission's survey](https://www.gamblingcommission.gov.uk/report/gambling-survey-for-great-britain-annual-report-2025-official-statistics) can tell you about gambling harm in the population. Nothing on this site can tell you what our product did to it, and we would rather have that gap than fill it with an invented number.

## The argument we lost

One of us argued for logging on by default with a prominent off switch, on the grounds that most people never change a default, most people want the weekly summary, and a household that installs a gambling filter has usually already had the conversation about monitoring.

That last claim is the one that decided it. Sometimes they have. Sometimes the filter is installed by one person about another person, and the second person does not know. A default that assumes consent, in a product bought for exactly the situations where consent is complicated, is a default that will hurt someone.

Defaults are not neutral. Whatever we ship on is what most installations will do forever.

## If you want the logs

Turn them on. It is your network and your decision, and there are legitimate reasons: debugging a chatty smart device, or a household where everyone has agreed.

Turn them off again afterwards, and delete the file. It is more sensitive than anything else on that machine.
