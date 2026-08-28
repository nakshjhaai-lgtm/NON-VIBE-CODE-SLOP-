import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createNetlifyBlobStorage } from '../server/db/netlify-blobs.js';
import {
  createDatabaseState,
  createMemoryStorage,
  runInDatabase,
  users,
} from '../server/db/index.js';

const realFetch = globalThis.fetch;
const realContext = globalThis.netlifyBlobsContext;

afterEach(() => {
  globalThis.fetch = realFetch;
  if (realContext === undefined) delete globalThis.netlifyBlobsContext;
  else globalThis.netlifyBlobsContext = realContext;
});

function injectContext(overrides = {}) {
  const context = {
    siteID: 'site-123',
    token: 'request-token',
    edgeURL: 'https://eventual.blobs.test/',
    uncachedEdgeURL: 'https://strong.blobs.test/',
    ...overrides,
  };
  globalThis.netlifyBlobsContext = Buffer.from(JSON.stringify(context)).toString('base64url');
}

describe('Netlify Blobs adapter', () => {
  test('uses the strong endpoint and stable production key', async () => {
    injectContext();
    const calls = [];
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options });
      return new Response(null, { status: 404 });
    };

    const storage = createNetlifyBlobStorage({
      deploy: { context: 'production', id: 'deploy-1', published: true },
    });
    assert.deepEqual(await storage.load(), { data: null, etag: null });
    assert.equal(calls[0].url, 'https://strong.blobs.test/site-123/site:netguard-data/production/state-v1');
    assert.equal(calls[0].options.headers.authorization, 'Bearer request-token');
  });

  test('isolates an unpublished or preview deploy by deploy ID', async () => {
    injectContext();
    let requested;
    globalThis.fetch = async (url) => {
      requested = url;
      return new Response(null, { status: 404 });
    };

    const storage = createNetlifyBlobStorage({
      deploy: { context: 'deploy-preview', id: 'abc123-preview', published: false },
    });
    await storage.load();
    assert.equal(requested, 'https://strong.blobs.test/site-123/site:netguard-data/deploy-abc123-preview/state-v1');
  });

  test('reads ETags and applies the correct atomic write precondition', async () => {
    injectContext();
    const state = createDatabaseState();
    const calls = [];
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options });
      if (options.method === 'GET') {
        return Response.json(state, { headers: { etag: '"revision-7"' } });
      }
      return new Response(null, { status: 200, headers: { etag: '"revision-8"' } });
    };

    const storage = createNetlifyBlobStorage({
      deploy: { context: 'production', id: 'deploy-1', published: true },
    });
    const loaded = await storage.load();
    assert.equal(loaded.etag, '"revision-7"');
    assert.deepEqual(loaded.data, state);

    assert.deepEqual(await storage.commit(state, loaded.etag), {
      modified: true,
      etag: '"revision-8"',
    });
    assert.equal(calls[1].options.headers['if-match'], '"revision-7"');
    assert.equal(calls[1].options.headers['if-none-match'], undefined);
    assert.equal(calls[1].options.headers['content-type'], 'application/json');

    await storage.commit(state, null);
    assert.equal(calls[2].options.headers['if-none-match'], '*');
    assert.equal(calls[2].options.headers['if-match'], undefined);
  });
});

describe('optimistic state transactions', () => {
  test('replays an operation after a conditional-write conflict', async () => {
    const memory = createMemoryStorage();
    let first = true;
    const storage = {
      load: () => memory.load(),
      async commit(state, etag) {
        if (first) {
          first = false;
          return { modified: false };
        }
        return memory.commit(state, etag);
      },
    };
    let runs = 0;

    const result = await runInDatabase(storage, () => {
      runs++;
      return users.create({
        email: 'conflict@example.com',
        displayName: 'Conflict Test',
        passwordHash: 'test-hash',
      });
    });

    assert.equal(runs, 2);
    assert.equal(result.email, 'conflict@example.com');
    assert.equal(memory.state().users.length, 1);
  });
});
