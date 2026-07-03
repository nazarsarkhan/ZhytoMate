import assert from 'node:assert/strict';
import test from 'node:test';
import { isPermanentHttpStatus } from '../core/delivery/sender.js';
import { normalizeItem } from '../core/pipeline/normalizer.js';

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
