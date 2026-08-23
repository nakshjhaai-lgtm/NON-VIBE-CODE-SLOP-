---
title: Why we do not advertise a blocklist count
description: Large blocklist totals are padded with dead domains and subdomain permutations. Here is how the padding works and what we publish instead.
date: 2026-08-18
updated: 2026-08-18
author: Priya Raghunathan
tags: [blocklists, honesty]
summary: A competitor advertises 4.2 million blocked domains. We counted ours and got 69. Both numbers are accurate and only one of them means anything.
---

A competitor's home page advertises 4.2 million blocked gambling domains. Ours has 69. Both numbers are accurate. Only one of them tells you anything about whether the product works, and it is not the big one.

## Where four million domains come from

Take a real gambling operator, `examplebet.com`. Now generate the variations.

Subdomains are the first multiplier. `www.examplebet.com`, `m.examplebet.com`, `api.examplebet.com`, `cdn.examplebet.com`, `static.examplebet.com`, `promo.examplebet.com`. Six entries where one suffix rule would do, and a suffix rule covers subdomains that have not been invented yet.

Country variants are the second. `examplebet.co.uk`, `.de`, `.it`, `.es`, `.com.au`, and forty more, most of which never resolved.

Dead domains are the third and largest. Blocklists are usually additive. A domain that stopped resolving in 2019 stays on the list because removing it requires someone to check, and checking four million domains is work nobody has funded. Studies of large public blocklists routinely find substantial fractions no longer resolve at all.

Aggregation is the fourth. Merge six lists that each merged four others and you get the union, duplicates in different forms, and no way to attribute any single entry to a source.

## What that costs you

The obvious cost is memory. A resolver holding four million entries needs a few hundred megabytes and a slower lookup path. That is a real cost on a Raspberry Pi.

The subtler cost is that nobody can audit it. If you cannot check the list, you cannot know whether a domain that should be blocked is on it, and you cannot know whether a domain that should not be is. Over-blocking hides inside a large list. When a bank or a news site gets caught by a wildcard rule, nobody notices until a user complains, and then nobody can explain why the entry is there.

The cost we care about most is that it invites the wrong question. "How many domains do you block" is not a useful question. "Do you block the ones my household would actually reach for" is.

## What we publish instead

Every entry, in the open, with the register it came from and the date a person last checked it. Sixty-nine suffix rules, which cover every subdomain of each. The [coverage page](/coverage) lists them and the review date for each list.

If you check a domain and we do not have it, [tell us](/contact) and we will add it, and the addition appears in the [changelog](/changelog) with the date.

## The honest weakness

A short list has a real disadvantage, and it would be dishonest to write this post without saying so.

Ours covers the operators and affiliates that a UK household is likely to encounter. It does not cover the long tail of offshore sites that appear and vanish inside a month. A four-million-entry list, for all its padding, will sometimes catch one of those by accident.

If your requirement is maximum coverage of the long tail rather than an auditable list, an aggregated feed is a defensible choice and there are good ones. We would rather tell you that than pretend the trade-off does not exist.

What we will not do is print a number designed to look impressive on a home page. If it cannot be counted from the data, it does not go on the page.
