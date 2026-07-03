import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCollectorOutputs } from '../core/ai/ai-layer.js';
import { normalizeItem } from '../core/pipeline/normalizer.js';
import { toIngestRequest } from '../core/ingest/ingest-mapper.js';
import { clampTtlDays } from '../core/ingest/ttl.js';

function newsItem(overrides = {}) {
  return normalizeItem(
    {
      url: 'https://t.me/zhtmr/1',
      title: 'Подія у Житомирі',
      body: 'Захід у Житомирі відбудеться 01.01.2030 на майдані Соборному.',
      publishedAt: '2026-01-15T00:00:00.000Z',
      docType: 'news',
      sourceKind: 'post',
      ...overrides,
    },
    { id: 'zhytomyr-city-council' },
    'telegram',
  );
}

function withEnv(overrides, fn) {
  const previous = {};

  for (const key of Object.keys(overrides)) {
    previous[key] = process.env[key];
    process.env[key] = overrides[key];
  }

  return Promise.resolve(fn()).finally(() => {
    for (const key of Object.keys(overrides)) {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  });
}

function stubFetch(responseBody, { ok = true } = {}) {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok,
    status: ok ? 200 : 500,
    text: async () => JSON.stringify(responseBody),
    json: async () => responseBody,
  });
  return () => {
    globalThis.fetch = original;
  };
}

test('clampTtlDays keeps ttl within the RAG 1..365 contract', () => {
  assert.equal(clampTtlDays(400), 365);
  assert.equal(clampTtlDays(0), 1);
  assert.equal(clampTtlDays(-5), 1);
  assert.equal(clampTtlDays(30), 30);
  assert.equal(clampTtlDays(14.2), 15); // ceil, never below the requested days
  assert.equal(clampTtlDays(Number.NaN), 1);
});

test('ingest mapper clamps a far-future ttl to 365 and forwards published_at', () => {
  const output = toIngestRequest(newsItem());

  assert.equal(output.skipped, false);
  assert.equal(output.request.published_at, '2026-01-15T00:00:00.000Z');
  assert.equal(output.request.ttl_days, 365); // 01.01.2030 would otherwise be ~1400 days
});

test('ingest mapper caps text at the RAG 50k contract to avoid a 422', () => {
  const hugeBody = 'Житомир громада документ '.repeat(4000); // ~100k chars, well over 50k
  const item = normalizeItem(
    {
      url: 'https://zt-rada.gov.ua/doc',
      title: 'Довгий документ',
      body: hugeBody,
      publishedAt: '2026-01-15T00:00:00.000Z',
      docType: 'instruction',
      sourceKind: 'document',
    },
    { id: 'zt-rada' },
    'web',
  );

  const output = toIngestRequest(item);

  assert.equal(output.skipped, false);
  assert.equal(output.request.text.length, 50000);
});

test('AI layer applies structured output, clamps ttl, and keeps deterministic text', async () => {
  await withEnv(
    { AI_LAYER_ENABLED: 'true', AI_PROVIDER: 'openai', OPENAI_API_KEY: 'test-key' },
    async () => {
      const restore = stubFetch({
        choices: [
          {
            finish_reason: 'stop',
            message: {
              content: JSON.stringify({
                category: 'social',
                district: null,
                doc_type: 'news',
                title: 'Подія у Житомирі',
                summary: 'Коротко про подію.',
                importance: 3,
                importance_label: 'normal',
                is_announcement: true,
                event_date: '2030-01-01',
                ttl_days: 9999,
                tags: ['social'],
                should_skip: false,
                skip_reason: null,
              }),
            },
          },
        ],
      });

      try {
        const item = newsItem();
        const output = await buildCollectorOutputs(item);

        assert.equal(output.skipped, false);
        assert.equal(output.ai.mode, 'model_enriched');
        assert.equal(output.ingestRequest.ttl_days, 365); // model's 9999 clamped to contract
        assert.equal(output.ingestRequest.published_at, '2026-01-15T00:00:00.000Z');
        // Body text is deterministic (built from the source), not echoed by the model.
        assert.equal(output.ingestRequest.text, item.body ? `${item.title}\n\n${item.body}` : item.body);
        assert.equal(output.newsItem.body, output.ingestRequest.text);
      } finally {
        restore();
      }
    },
  );
});

test('AI layer fails open to the heuristic draft when the completion is truncated', async () => {
  await withEnv(
    { AI_LAYER_ENABLED: 'true', AI_PROVIDER: 'openai', OPENAI_API_KEY: 'test-key', AI_FAIL_OPEN: 'true' },
    async () => {
      const restore = stubFetch({
        choices: [{ finish_reason: 'length', message: { content: '{"category":"soci' } }],
      });

      try {
        const output = await buildCollectorOutputs(newsItem());

        assert.equal(output.skipped, false);
        assert.equal(output.ai.mode, 'model_failed_fallback');
        assert.match(output.ai.error, /finish_reason=length/);
        assert.equal(output.ingestRequest.ttl_days, 365); // heuristic draft still valid
      } finally {
        restore();
      }
    },
  );
});
