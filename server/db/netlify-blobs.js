/**
 * Dependency-free adapter for the two Netlify Blobs operations this site uses.
 *
 * Netlify injects an authenticated Blobs context into Edge Functions. The
 * official client ultimately performs these same authenticated GET and PUT
 * requests. Keeping this deliberately small subset in-repo avoids npm, native
 * modules, and a build-time package download while retaining strong reads and
 * atomic ETag writes.
 */
import { base64ToBytes } from '../lib/crypto.js';

const STORE = 'site:netguard-data';
const CONTENT_TYPE = 'application/json';
const RETRIES = 2;

function injectedContext() {
  let encoded = globalThis.netlifyBlobsContext;
  if (!encoded) {
    try {
      encoded = globalThis.Netlify?.env?.get('NETLIFY_BLOBS_CONTEXT');
    } catch {
      encoded = null;
    }
  }

  if (encoded && typeof encoded === 'object') return encoded;
  if (typeof encoded !== 'string' || !encoded) {
    throw new Error('Netlify Blobs context is unavailable. Run this application as a Netlify Edge Function.');
  }

  try {
    return JSON.parse(new TextDecoder().decode(base64ToBytes(encoded)));
  } catch {
    throw new Error('Netlify supplied an invalid Blobs context.');
  }
}

function safeSegment(value, fallback) {
  const segment = String(value || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 100);
  return segment || fallback;
}

function errorFor(response) {
  const requestId = response.headers.get('x-nf-request-id');
  return new Error(`Netlify Blobs returned HTTP ${response.status}${requestId ? ` (request ${requestId})` : ''}.`);
}

async function requestWithRetry(url, options) {
  let response;
  let lastError;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      response = await fetch(url, options);
      if (response.status !== 429 && response.status < 500) return response;
    } catch (error) {
      lastError = error;
    }
    if (attempt < RETRIES) await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
  }
  if (response) return response;
  throw lastError || new Error('Netlify Blobs request failed.');
}

/**
 * Creates a request-local storage adapter for `runInDatabase`.
 * Production uses a stable key across deploys; previews use their deploy ID so
 * test accounts cannot read or overwrite production state.
 */
export function createNetlifyBlobStorage(netlifyContext = {}) {
  const context = injectedContext();
  const { siteID, token, uncachedEdgeURL, edgeURL } = context;
  if (!siteID || !token) throw new Error('Netlify Blobs authentication is incomplete.');

  // Strong consistency is required for ETag transactions. Modern Netlify Edge
  // contexts always include this endpoint; failing closed avoids lost writes.
  const base = uncachedEdgeURL;
  if (!base) throw new Error(`Netlify Blobs strong-consistency endpoint is unavailable${edgeURL ? '' : ' (no endpoint was supplied)'}.`);

  const production = netlifyContext.deploy?.context === 'production' && netlifyContext.deploy?.published !== false;
  const scope = production
    ? 'production'
    : `deploy-${safeSegment(netlifyContext.deploy?.id, 'local')}`;
  const key = `${scope}/state-v1`;
  const url = new URL(`/${siteID}/${STORE}/${key}`, base).toString();
  const auth = `Bearer ${token}`;

  return {
    async load() {
      const response = await requestWithRetry(url, {
        method: 'GET',
        headers: { authorization: auth, accept: CONTENT_TYPE },
      });
      if (response.status === 404) return { data: null, etag: null };
      if (response.status !== 200) throw errorFor(response);
      const etag = response.headers.get('etag');
      if (!etag) throw new Error('Netlify Blobs returned state without an ETag.');
      return { data: await response.json(), etag };
    },

    async commit(data, etag) {
      const headers = {
        authorization: auth,
        'cache-control': 'max-age=0, stale-while-revalidate=60',
        'content-type': CONTENT_TYPE,
        [etag ? 'if-match' : 'if-none-match']: etag || '*',
      };
      const response = await requestWithRetry(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      });
      if (response.status === 412) return { modified: false };
      if (response.status !== 200) throw errorFor(response);
      return { modified: true, etag: response.headers.get('etag') || undefined };
    },
  };
}
