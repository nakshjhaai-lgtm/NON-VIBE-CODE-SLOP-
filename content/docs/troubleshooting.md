---
title: Troubleshooting
description: Diagnose filtering that is not working, sites wrongly blocked, and slow lookups, with the exact commands to run at each step.
order: 1
section: Operations
updated: 2026-08-15
summary: Symptom, cause, fix. Ordered by how often each one turns out to be the answer.
---

Work through these in order. They are arranged by how often each turns out to be the cause, which will save you time.

## A site that should be blocked still loads

**Check the device is using your resolver.** This catches roughly half of all reports.

On Windows:

```
ipconfig /all
```

On macOS or Linux:

```
scutil --dns | grep nameserver
```

If the address shown is not yours, the setting did not take. On a router change, the device has probably not renewed its DHCP lease: reboot it.

**Check the browser is not using its own resolver.** Try the same site in a different browser. If one blocks and one does not, see [encrypted DNS](/docs/encrypted-dns).

**Check the answer is cached.** Operating systems and browsers cache DNS answers, sometimes for hours.

```
ipconfig /flushdns              Windows
sudo dscacheutil -flushcache    macOS
resolvectl flush-caches         Linux with systemd
```

In Chrome, also clear `chrome://net-internals/#dns`.

**Check the domain is actually on a list you enabled.** Use [the coverage checker](/coverage). Plenty of gambling sites reach people through affiliate domains that are on a separate list, off by default.

**Check for a VPN.** A VPN takes DNS with it. Nothing at the DNS layer can prevent this.

## A site that should not be blocked is blocked

Most often an aggressive entry, occasionally a shared hosting domain.

1. Confirm it is us. `nslookup thedomain.com your-resolver-address`. An answer of `0.0.0.0` or `NXDOMAIN` from us means it is our list. Any other failure is not.
2. Add it to your allowlist in the dashboard. It takes effect on the next query, subject to cache.
3. [Tell us](/contact). Every allowlist request is reviewed by a person, and we publish corrections in the [changelog](/changelog).

Certain domains can never be blocked, whatever a list says: GamCare, BeGambleAware, GAMSTOP, the NHS, Gamblers Anonymous, Citizens Advice and the Gambling Commission. Blocking a route to help would be indefensible.

## Everything is slow

**Measure before assuming.**

```
dig @198.51.100.10 example.com | grep "Query time"
```

Under 30 ms on a local network is healthy. Over 100 ms consistently means the resolver is reaching out for every query.

**Cold cache.** A resolver that has just started has nothing cached. Give it a day.

**Upstream is far away.** Check which upstream resolver is configured. A resolver in another country adds latency to every uncached lookup.

**One device is flooding it.** Check the query log for a device making hundreds of queries a minute. This is usually a misconfigured smart device retrying a dead endpoint.

## Everything is broken

If no site resolves, the resolver is down and your devices have no fallback.

Immediate fix: set DNS back to automatic on the affected device, or to `1.1.1.1` temporarily.

Prevention: always configure a secondary resolver. If you run a single instance, the secondary should be a public resolver, on the reasoning that unfiltered internet beats no internet. This is a real trade-off, and you should make it deliberately: with a public secondary, a device will fall back to unfiltered DNS whenever your resolver is briefly unreachable.

## Intermittent failures on an Asus router

Asus DNS Rebind Protection discards answers pointing at private or null addresses, which is exactly what a filtered answer looks like. Turn it off, or configure your resolver to return `NXDOMAIN` instead of `0.0.0.0`.

## Still stuck

[Send us the details](/contact): what you configured, what you expected, what happened, and the output of the commands above. We reply within one working day.
