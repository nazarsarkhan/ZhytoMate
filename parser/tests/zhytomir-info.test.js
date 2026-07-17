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
