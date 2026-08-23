---
title: Quick start
description: Point one device at a NetGuard resolver, confirm filtering works, and understand what happens when it does not.
order: 1
section: Getting started
updated: 2026-08-12
summary: Fifteen minutes, one device, no account. Change two DNS addresses, run one check, and read the result honestly.
---

This guide changes the DNS settings on a single device. Nothing else on your network is affected, which makes it the safest way to see what filtering does before you commit to it.

You do not need an account for this. You need about fifteen minutes and the ability to change network settings on the device.

## Before you start

Two things are worth knowing up front, because they decide whether this is the right tool for you.

DNS filtering blocks the *lookup*, not the *connection*. When a device asks "what is the address of a gambling site", the resolver answers "there isn't one" and the browser shows a connection error. It is effective because almost everything on a network asks DNS first, and it is not effective against anything that skips DNS: an app with a hard-coded IP address, a VPN, or a browser configured to use its own encrypted resolver.

Anyone with administrator rights on the device can undo it in under a minute. That is not a flaw to be engineered away. A filter is a speed bump that turns an impulse into a decision, and treating it as a lock will only lead to disappointment. If you need something that cannot be removed by the person using the device, read [what DNS filtering cannot do](/docs/limitations) before going further.

## Step 1: choose a resolver

Run your own, or use a public one. Running your own is the only way to be certain nobody else sees your queries, and it is what we recommend for anyone with a spare Raspberry Pi.

For a first test, the public resolvers are quicker to try:

```
Primary IPv4    198.51.100.10
Secondary IPv4  198.51.100.11
Primary IPv6    2001:db8:2::10
Secondary IPv6  2001:db8:2::11
```

These addresses are in ranges reserved by the IETF for documentation. They are written here so the shape of the configuration is clear. Substitute the address of the resolver you have actually deployed, which the installer prints when it finishes.

## Step 2: change the device DNS settings

### Windows 11

1. Open Settings, then Network and internet.
2. Select your active connection, then Edit next to DNS server assignment.
3. Switch the dropdown from Automatic to Manual.
4. Turn on IPv4 and enter the primary and secondary addresses.
5. Set DNS over HTTPS to Off for now. Encrypted DNS is worth turning on, but configure it after you have confirmed plain DNS works, so you are only changing one thing at a time.
6. Save.

### macOS

1. Open System Settings, then Network.
2. Select your connection, then Details.
3. Open the DNS tab.
4. Remove the existing servers with the minus button, then add yours with the plus button.
5. Click OK, then Apply.

### iOS and iPadOS

1. Open Settings, then Wi-Fi.
2. Tap the information button next to the connected network.
3. Tap Configure DNS, then Manual.
4. Remove the existing entries and add yours.
5. Tap Save.

This applies to that Wi-Fi network only. Mobile data will continue to use the carrier's resolver.

### Android

1. Open Settings, then Network and internet, then Internet.
2. Tap the settings icon beside your network, then Edit.
3. Expand Advanced options and set IP settings to Static.
4. Enter the DNS addresses. You will need to fill in the IP address and gateway fields as well; copy the values already shown.
5. Save.

On Android 9 and later, check Settings, then Network and internet, then Private DNS. If it is set to a hostname, that resolver is used in preference to yours and your filtering will not apply. Set it to Off or to your own hostname.

## Step 3: confirm it works

Load [the coverage checker](/coverage) and enter a domain from a list you have enabled. The checker tells you whether that domain is in our published lists. It does not test your device, because a web page cannot see your DNS settings.

To test the device itself, open a terminal and ask your resolver directly:

```
nslookup bet365.com 198.51.100.10
```

A filtered answer returns `0.0.0.0`, `NXDOMAIN`, or a timeout, depending on how the resolver is configured. An unfiltered answer returns a real public address. If you get a real address for a domain you expect to be blocked, work through [troubleshooting](/docs/troubleshooting).

## Step 4: decide what to do next

If the test worked and you want it on every device, the next step is [router setup](/docs/router-setup), which applies the same resolver to everything on the network without touching each device.

If you are setting this up because of someone else's gambling, please read [gambling support resources](/help) as well. A DNS filter addresses one route. It is not treatment and it is not a substitute for the National Gambling Helpline, which is free and open at any hour.
