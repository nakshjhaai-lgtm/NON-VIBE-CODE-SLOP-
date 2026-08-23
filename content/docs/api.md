---
title: HTTP API
description: The read-only coverage endpoint, its rate limits, its response shape and its error codes.
order: 2
section: Operations
updated: 2026-08-18
summary: One endpoint, documented completely, including what it deliberately does not return.
---

The API is small on purpose. It exposes the coverage lookup and nothing else, because nothing else can be exposed without handling personal data.

## Base URL

```
https://netguard.example/api
```

All responses are `application/json; charset=utf-8`. All requests must use HTTPS; plain HTTP is redirected.

## POST /api/coverage

Checks whether a domain appears in the published blocklists.

**Request**

```
POST /api/coverage
Content-Type: application/json

{
  "domain": "example.com",
  "lists": ["gambling", "gambling-affiliate"]
}
```

`domain` is required, at most 253 characters. A full URL is accepted and reduced to its hostname. `lists` is optional; omit it to search every list.

Browser requests must include the CSRF token from the page, as the field `_csrf`. Server-to-server requests are exempt when no cookie is sent.

**Response**

```
200 OK

{
  "domain": "example.com",
  "listed": false,
  "checkedAt": "2026-08-23T09:14:22.000Z",
  "listsSearched": ["gambling", "gambling-affiliate"]
}
```

When the domain is listed, three further fields are present:

```
{
  "domain": "bet365.com",
  "listed": true,
  "list": "Gambling",
  "listId": "gambling",
  "matchedRule": "bet365.com",
  "source": "Operators licensed by the Gambling Commission, checked by hand against the public register",
  "checkedAt": "2026-08-23T09:14:22.000Z"
}
```

`matchedRule` is the list entry that matched, which may be a parent domain of the one you asked about, since a rule covers all subdomains.

A domain on the never-block list returns `listed: false` with `"protected": true`.

## Errors

Every error carries a machine-readable `error` code and a sentence a human can act on.

| Status | `error` | Meaning |
| --- | --- | --- |
| 400 | `invalid_domain` | The domain was missing, too long, or not a plausible hostname. |
| 400 | `invalid_json` | The body was not valid JSON. |
| 403 | `csrf_failed` | A cookie was sent without a matching token. |
| 413 | `body_too_large` | The body exceeded 64 KiB. |
| 415 | `unsupported_media_type` | `Content-Type` was neither JSON nor form-encoded. |
| 429 | `rate_limited` | See the `Retry-After` header. |

```
{
  "error": "invalid_domain",
  "message": "Enter a domain such as example.com."
}
```

## Rate limits

Sixty requests per minute per IP address. Exceeding it returns `429` with a `Retry-After` header in seconds. There is no paid tier that raises this; if you need more, [get in touch](/contact) and we will talk about it rather than sell you something.

## What the API does not return

No query logs. No per-device data. No information about who checked what. Those things are not behind authentication, they are not collected.

Coverage checks are recorded as a count only, so we know which lists get used. The domain checked is stored; the checker is not identified.

## Versioning

There is no version prefix, because there is one endpoint. If a breaking change becomes necessary, a `/api/v2` prefix will be introduced and the current path will keep working for at least twelve months. Changes are announced in the [changelog](/changelog).
