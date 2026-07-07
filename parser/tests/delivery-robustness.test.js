import assert from 'node:assert/strict';
import test from 'node:test';
import { isPermanentHttpStatus, postItem } from '../core/delivery/sender.js';
import { normalizeItem } from '../core/pipeline/normalizer.js';

function withMockedRagSend(status, jsonBody, run) {
  const originalFetch = globalThis.fetch;
  const originalSendEnabled = process.env.RAG_SEND_ENABLED;
  const originalToken = process.env.INTERNAL_TOKEN;

  process.env.RAG_SEND_ENABLED = 'true';
  process.env.INTERNAL_TOKEN = 'test-token';
  globalThis.fetch = async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => jsonBody,
  });

  return run().finally(() => {
    globalThis.fetch = originalFetch;
    process.env.RAG_SEND_ENABLED = originalSendEnabled;
    process.env.INTERNAL_TOKEN = originalToken;
  });
}

test('permanent vs transient HTTP classification', () => {
  // Permanent 4xx — retrying the same request will always fail, so it must be dropped.
  assert.equal(isPermanentHttpStatus(400), true);
  assert.equal(isPermanentHttpStatus(401), true);
  assert.equal(isPermanentHttpStatus(404), true);
  assert.equal(isPermanentHttpStatus(422), true);

  // Transient — worth retrying.
  assert.equal(isPermanentHttpStatus(429), false); // rate limited
  assert.equal(isPermanentHttpStatus(500), false);
  assert.equal(isPermanentHttpStatus(503), false);
});

test('normalizeItem falls back to now for an unparseable publishedAt instead of throwing', () => {
  const item = normalizeItem(
    { url: 'https://example.com', title: 't', body: 'b', publishedAt: 'невідомо' },
    { id: 'zt-rada' },
    'web',
  );

  // Must not throw, and must produce a valid ISO timestamp.
  assert.equal(Number.isNaN(Date.parse(item.publishedAt)), false);
});

test('normalizeItem preserves a valid publishedAt', () => {
  const item = normalizeItem(
    { url: 'https://example.com', title: 't', body: 'b', publishedAt: '2026-01-15T00:00:00.000Z' },
    { id: 'zt-rada' },
    'web',
  );

  assert.equal(item.publishedAt, '2026-01-15T00:00:00.000Z');
});

// ml-service's ingest endpoint returns HTTP 200 for "ingested", "duplicate", AND "expired" (the
// born-expired skip) alike — postItem must surface the actual status, not just the HTTP outcome,
// so the caller (drainQueue) can tell a real embedding apart from a silent discard.
test('postItem surfaces the ingested status from a 200 response', async () => {
  await withMockedRagSend(200, { status: 'ingested', document_id: 'd1', chunks_processed: 3 }, async () => {
    const status = await postItem({ document_id: 'd1', text: 'hello' });
    assert.equal(status, 'ingested');
  });
});

test('postItem surfaces the duplicate status from a 200 response', async () => {
  await withMockedRagSend(200, { status: 'duplicate', document_id: 'd1', chunks_processed: 0 }, async () => {
    const status = await postItem({ document_id: 'd1', text: 'hello' });
    assert.equal(status, 'duplicate');
  });
});

test('postItem surfaces the expired status from a 200 response, not just "ok"', async () => {
  await withMockedRagSend(200, { status: 'expired', document_id: 'd1', chunks_processed: 0 }, async () => {
    const status = await postItem({ document_id: 'd1', text: 'hello' });
    assert.equal(status, 'expired');
  });
});

test('postItem still throws DeliveryError on a non-2xx response', async () => {
  await withMockedRagSend(503, {}, async () => {
    await assert.rejects(() => postItem({ document_id: 'd1', text: 'hello' }), {
      name: 'DeliveryError',
      status: 503,
    });
  });
});
