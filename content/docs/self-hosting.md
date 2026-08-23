---
title: Self-hosting
description: Run the resolver on your own hardware, from a Raspberry Pi to a small virtual machine, with the resource figures we actually measured.
order: 3
section: Operations
updated: 2026-08-15
summary: The configuration we recommend for a household, with measured memory and query figures rather than estimates.
---

Self-hosting is the only configuration where nobody but you can see your queries. It is also the cheapest, and on modest hardware it is faster than any public resolver because the cache is next to you.

## Hardware

A Raspberry Pi 4 with 2 GB of memory is comfortable for a household. A Pi Zero 2 W works and will feel slower on a cold cache.

The figures below are from our own instance serving six devices in one home, read from `systemd-cgtop` and the resolver's own counters over the thirty days to 15 August 2026. They are one data point, not a benchmark, and your numbers will differ.

| Measure | Value |
| --- | --- |
| Resident memory, steady state | 84 MB |
| Queries per day | 41,300 |
| Cache hit rate | 78% |
| Median response, cached | under 1 ms |
| Median response, uncached | 24 ms |
| Blocked share of queries | 0.9% |

The blocked share is low because this is a household with no active gambling problem. Do not read it as a general figure.

## Installation

```
curl -fsSL https://netguard.example/install.sh -o install.sh
sha256sum install.sh
sudo sh install.sh
```

Check the hash against the one published on the [changelog](/changelog) for the release you are installing before running it. Piping a download straight into a shell is a habit worth breaking, which is why the command above is written in three steps.

The installer writes to `/etc/netguard`, creates a system user, installs a unit file and starts the service. It does not phone home.

## Configuration

`/etc/netguard/config.toml`:

```
[listen]
address = "0.0.0.0"
port = 53
doh = true
doh_port = 443

[upstream]
servers = ["9.9.9.9", "1.1.1.1"]
strategy = "fastest"

[lists]
enabled = ["gambling", "gambling-affiliate"]
refresh_hours = 24

[blocking]
response = "nxdomain"

[logging]
queries = false
retention_days = 0
```

Two settings deserve comment.

`blocking.response` should be `nxdomain` unless something on your network mishandles it. The alternative, `zeroip`, returns `0.0.0.0`, which some routers discard as a rebind attack.

`logging.queries` defaults to off. Turning it on writes every domain every device on your network requests to disk. That is an unusually sensitive file. If you turn it on to debug something, turn it off afterwards and delete the file.

## Keeping lists current

The service refreshes lists every 24 hours by default. Refreshes are signed; a list that fails signature verification is rejected and the previous copy is kept, so a compromised distribution point cannot push you an empty list and silently disable filtering.

```
systemctl status netguard
journalctl -u netguard --since today
```

## Backups

The only state worth keeping is `/etc/netguard/config.toml` and your allowlist at `/etc/netguard/allow.txt`. Both are plain text. Copy them somewhere.

There is no database to back up unless you enabled query logging, in which case see the paragraph above about not doing that.
