import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePublishedAt } from '../plugins/web/zhytomir-info.js';
import { normalizeItem } from '../core/pipeline/normalizer.js';
import { toIngestRequest } from '../core/ingest/ingest-mapper.js';
import { shouldSendToNews } from '../core/delivery/routes.js';

test('parses Ukrainian month names from zhitomir.info article dates', () => {
  assert.equal(
    parsePublishedAt('15 липня 2026, 14:47'),
    '2026-07-15T11:47:00.000Z',
  );
});

test('routes zhytomir-info web items to the news output', () => {
  const item = normalizeItem(
    {
      url: 'https://www.zhitomir.info/news_123.html',
      title: 'Житомирська новина',
      body: 'Текст новини Житомир.info достатньої довжини для індексації та публікації.',
      publishedAt: '2026-07-17T08:00:00.000Z',
    },
    { id: 'zhytomir-info' },
    'web',
  );
  const output = toIngestRequest(item);

  assert.equal(output.request.doc_type, 'news');
  assert.equal(shouldSendToNews(item, output.request), true);
});

test('uses a stable document id for the same source URL across runs', () => {
  const rawItem = {
    url: 'https://www.zhitomir.info/news_123.html',
    title: 'Ð–Ð¸Ñ‚Ð¾Ð¼Ð¸Ñ€ÑÑŒÐºÐ° Ð½Ð¾Ð²Ð¸Ð½Ð°',
    body: 'Ð¢ÐµÐºÑÑ‚ Ð½Ð¾Ð²Ð¸Ð½Ð¸ Ð´Ð¾ÑÑ‚Ð°Ñ‚Ð½ÑŒÐ¾Ñ— Ð´Ð¾Ð²Ð¶Ð¸Ð½Ð¸ Ð´Ð»Ñ Ñ–Ð½Ð´ÐµÐºÑÐ°Ñ†Ñ–Ñ—.',
    publishedAt: '2026-07-17T08:00:00.000Z',
  };
  const first = toIngestRequest(normalizeItem(rawItem, { id: 'zhytomir-info' }, 'web'));
  const second = toIngestRequest(normalizeItem(rawItem, { id: 'zhytomir-info' }, 'web'));

  assert.equal(first.request.document_id, second.request.document_id);
});

test('keeps the configured backfill TTL for older news in RAG', () => {
  const item = normalizeItem(
    {
      url: 'https://www.zhitomir.info/news_older.html',
      title: 'Ð–Ð¸Ñ‚Ð¾Ð¼Ð¸Ñ€ÑÑŒÐºÐ° Ð½Ð¾Ð²Ð¸Ð½Ð°',
      body: 'Ð¢ÐµÐºÑÑ‚ Ð½Ð¾Ð²Ð¸Ð½Ð¸ Ð´Ð¾ÑÑ‚Ð°Ñ‚Ð½ÑŒÐ¾Ñ— Ð´Ð¾Ð²Ð¶Ð¸Ð½Ð¸ Ð´Ð»Ñ Ñ–Ð½Ð´ÐµÐºÑÐ°Ñ†Ñ–Ñ—.',
      publishedAt: '2026-05-01T08:00:00.000Z',
      ttlDays: 120,
    },
    { id: 'zhytomir-info' },
    'web',
  );

  assert.equal(toIngestRequest(item).request.ttl_days, 120);
});
