---
title: Router setup
description: Apply DNS filtering to every device on a network by changing settings once on the router, including the DHCP details people usually miss.
order: 2
section: Getting started
updated: 2026-08-12
summary: One change covers every device, including the ones with no settings screen. Covers the DHCP trap and the two ways it goes wrong.
---

Changing DNS on the router covers every device that joins the network, including televisions, consoles and anything else with no settings screen worth speaking of. It is a single change, and it is the configuration most households end up with.

## The distinction that matters

Routers have two DNS settings and they do different things. Getting them confused is the single most common reason this does not work.

**WAN DNS**, sometimes labelled Internet DNS or Upstream DNS, is what the router itself uses. Changing it does not necessarily change what your devices use, because most routers hand out *their own* address as the DNS server over DHCP and then forward queries upstream. Filtering will appear to work in some tests and not others.

**LAN DNS**, sometimes labelled DHCP DNS or Advanced DHCP, is what the router *tells devices to use*. This is the one you want. Set it, and every device that renews its lease starts using your resolver directly.

If your router only exposes WAN DNS, filtering will still generally work, because queries are forwarded through the router to your resolver. You lose per-device visibility, since every query appears to come from the router.

## By manufacturer

### OpenWrt

Under Network, then DHCP and DNS, add your resolver under DNS forwardings. Then, under Network, Interfaces, LAN, DHCP Server, Advanced Settings, add a DHCP option:

```
6,198.51.100.10,198.51.100.11
```

Option 6 is the DNS server option. Without it, OpenWrt advertises itself.

### AVM FRITZ!Box

Internet, then Account Information, then DNS Server. Enter the addresses under "Use other DNSv4 servers". For IPv6, the equivalent is under DNSv6 on the same page. The FRITZ!Box advertises itself to clients, so all queries are forwarded.

### Asus

WAN, then Internet Connection. Set "Connect to DNS Server automatically" to No and enter the addresses. Then set "Forward local domain queries to upstream DNS" to Yes, and "Enable DNS Rebind protection" to No if your resolver returns `0.0.0.0` for blocked domains, because rebind protection discards such answers and you will see intermittent failures.

### TP-Link

Advanced, then Network, then Internet. Change "Primary DNS" and "Secondary DNS". On models with a DHCP Server page under Advanced, Network, DHCP Server, set the DNS there as well.

### ISP-supplied routers

Many locked-down ISP routers do not allow a DNS change at all. Two options: ask the ISP to switch the router to modem-only or bridge mode and put your own router behind it, or configure DNS per device as in the [quick start](/docs/quick-start). Neither is elegant. The second is free.

## After the change

Devices keep their old DNS settings until their DHCP lease renews. Reboot the router, then reboot one device and test from that device. Do not conclude anything from a device that has not renewed.

Verify from a device rather than from the router:

```
nslookup bet365.com
```

Note there is no server argument. This asks whatever the device believes its resolver to be, which is the thing you actually changed.

## What this does not cover

Mobile data. A phone on the household Wi-Fi is filtered; the same phone on 5G is not. There is no router-level fix for that, and any product claiming otherwise is describing a VPN, not DNS.

Devices configured with their own DNS. A device with static DNS settings ignores what DHCP tells it. So does a browser with DNS over HTTPS switched on, which is now the default in several browsers. See [encrypted DNS](/docs/encrypted-dns) for how to handle that.

Guest networks. On most routers these are isolated and carry separate DNS settings. Configure them too, or turn them off.
