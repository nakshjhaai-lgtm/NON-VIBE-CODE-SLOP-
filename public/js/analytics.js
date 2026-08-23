/**
 * First-party page counting.
 *
 * This replaces a third-party analytics tag. It runs only after the visitor
 * has accepted, sends one request per page view to this site's own server,
 * and carries no identifier: no cookie is set, nothing is stored in the
 * browser, and the server keeps only a day-salted hash it cannot reverse.
 *
 * UTM parameters are forwarded when present, because knowing which campaign
 * a visit came from is the one thing the marketing pages genuinely need.
 */

function allowed() {
  try {
    return localStorage.getItem('ng-analytics') === 'accept';
  } catch {
    return false;
  }
}

function send() {
  const params = new URLSearchParams(window.location.search);
  const payload = {
    path: window.location.pathname,
    referrer: document.referrer || '',
    utm_source: params.get('utm_source') || '',
    utm_medium: params.get('utm_medium') || '',
    utm_campaign: params.get('utm_campaign') || '',
  };

  const body = JSON.stringify(payload);

  // sendBeacon survives the page being closed; fetch is the fallback.
  if (navigator.sendBeacon) {
    const ok = navigator.sendBeacon('/api/pageview', new Blob([body], { type: 'application/json' }));
    if (ok) return;
  }
  fetch('/api/pageview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    /* Counting a page view is never worth surfacing an error for. */
  });
}

if (allowed()) send();
else window.addEventListener('ng:analytics-allowed', send, { once: true });
