---
title: Encrypted DNS
description: How DNS over HTTPS and DNS over TLS interact with network filtering, and the exact settings to check in each browser.
order: 2
section: Understanding the limits
updated: 2026-08-12
summary: The most common silent failure. What to check in Firefox, Chrome, Edge and Safari, and how to run your own encrypted endpoint.
---

Encrypted DNS is good for privacy and awkward for filtering, and both of those statements deserve to be taken seriously.

## What changes

Classic DNS is plain UDP on port 53. Anyone on the path can read the query, and the operating system decides which resolver to ask. DNS over HTTPS (DoH) and DNS over TLS (DoT) encrypt the query. DoH also lets an application choose its own resolver and use it over port 443, where it is indistinguishable from ordinary web traffic.

That last part is what breaks network filtering. It is not a bug in either technology. It is the point of the design.

## Browser settings to check

### Firefox

Settings, then Privacy and Security, then scroll to DNS over HTTPS. Firefox enables this in some regions by default.

- **Off** uses the system resolver, so your filtering applies.
- **Max Protection** uses Firefox's chosen provider and ignores yours.
- **Increased Protection** uses Firefox's provider but falls back to the system resolver on failure.

If you run your own encrypted endpoint, choose Max Protection with a custom provider and enter your own URL.

### Chrome

Settings, then Privacy and security, then Security, then "Use secure DNS".

Chrome's default, "With your current service provider", is the friendly case: Chrome upgrades to the encrypted endpoint of the resolver you already configured, when it recognises it, and otherwise uses plain DNS. Either way your resolver is still the one answering.

Choosing a named provider from the dropdown overrides your configuration.

### Edge

Same engine, same setting, at `edge://settings/privacy`, under "Use secure DNS to specify how to look up the network address for websites".

### Safari

Safari has no DoH setting of its own. It follows macOS and iOS, which can be given an encrypted resolver through a configuration profile. If none is installed, Safari uses whatever the network provides, so your filtering applies.

## Detecting whether it is on

Load a domain you expect to be filtered. If it loads in one browser and fails in another on the same device, that browser is using its own resolver. This is the quickest test and it needs no tooling.

## Running an encrypted endpoint yourself

The right answer to encrypted DNS is not to fight it, it is to offer it. If your resolver has a DoH endpoint, you get the privacy benefit and keep filtering.

The NetGuard resolver exposes one at:

```
https://your-resolver.example/dns-query
```

Point Firefox's custom provider at that URL, or install a configuration profile on macOS and iOS, and queries are both encrypted and filtered. On a network you control, you can also block outbound port 853 and the known DoH endpoints of the large public providers, which pushes applications back to your resolver. That is a blunt instrument and it will occasionally break something, so it belongs on a corporate network rather than a family one.

## A note on honesty

There is no configuration that makes filtering unbypassable on a device the user controls. Anyone selling you one is describing device management. See [what DNS filtering cannot do](/docs/limitations).
