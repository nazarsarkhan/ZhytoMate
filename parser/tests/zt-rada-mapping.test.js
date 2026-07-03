import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCollectorOutputs } from '../core/ai/ai-layer.js';
import { normalizeItem } from '../core/pipeline/normalizer.js';
import { toIngestRequest } from '../core/ingest/ingest-mapper.js';

const plugin = { id: 'zt-rada' };

test('normalizer preserves zt-rada metadata fields', () => {
  const item = normalizeItem(
    {
      url: 'https://zt-rada.gov.ua/documents',
      title: 'Document search',
      body: 'Useful city council document text for indexing.',
      publishedAt: '2026-01-15T00:00:00.000Z',
      category: 'politics',
      docType: 'instruction',
      sourceKind: 'document-index',
      attachments: [{ url: 'https://zt-rada.gov.ua/files/example.pdf', ok: true }],
    },
    plugin,
    'web',
  );

  assert.equal(item.category, 'politics');
  assert.equal(item.docType, 'instruction');
  assert.equal(item.sourceKind, 'document-index');
  assert.deepEqual(item.attachments, [{ url: 'https://zt-rada.gov.ua/files/example.pdf', ok: true }]);
});

test('ingest mapper uses explicit zt-rada instruction doc type', () => {
  const item = normalizeItem(
    {
      url: 'https://zt-rada.gov.ua/documents',
      title: 'Document search',
      body: 'Useful city council document text for indexing.',
      publishedAt: '2026-01-15T00:00:00.000Z',
      category: 'politics',
      docType: 'instruction',
      sourceKind: 'document-index',
    },
    plugin,
    'web',
  );

  const output = toIngestRequest(item);

  assert.equal(output.skipped, false);
  assert.equal(output.request.doc_type, 'instruction');
  assert.equal(output.request.category, 'politics');
});

test('ingest mapper treats zt-rada calendar items as news', () => {
  const item = normalizeItem(
    {
      url: 'https://zt-rada.gov.ua/var-calendar/get-events#2026-01-15',
      title: 'Calendar event',
      body: 'Public city announcement text relevant to Zhytomyr residents.',
      publishedAt: '2026-01-15T00:00:00.000Z',
      docType: 'news',
      sourceKind: 'calendar',
    },
    plugin,
    'web',
  );

  const output = toIngestRequest(item);

  assert.equal(output.skipped, false);
  assert.equal(output.request.doc_type, 'news');
});

test('collector skips AI for zt-rada when source config disables it', async () => {
  const previousAiEnabled = process.env.AI_LAYER_ENABLED;
  const previousProvider = process.env.AI_PROVIDER;
  process.env.AI_LAYER_ENABLED = 'true';
  process.env.AI_PROVIDER = 'openai';

  try {
    const item = normalizeItem(
      {
        url: 'https://zt-rada.gov.ua/search?search=%D0%92%D0%9F%D0%9E',
        title: 'Житловий комплекс для ВПО у Житомирі',
        body: 'Житловий комплекс для ВПО у Житомирі: на якому етапі будівництво',
        publishedAt: '2026-04-28T00:00:00.000Z',
        category: 'social',
        docType: 'news',
        sourceKind: 'search-result',
      },
      { id: 'zt-rada', settings: { useAi: false } },
      'web',
    );

    const output = await buildCollectorOutputs(item);

    assert.equal(output.skipped, false);
    assert.equal(output.ai.used, false);
    assert.equal(output.ai.mode, 'disabled_for_source');
  } finally {
    if (previousAiEnabled === undefined) {
      delete process.env.AI_LAYER_ENABLED;
    } else {
      process.env.AI_LAYER_ENABLED = previousAiEnabled;
    }

    if (previousProvider === undefined) {
      delete process.env.AI_PROVIDER;
    } else {
      process.env.AI_PROVIDER = previousProvider;
    }
  }
});
