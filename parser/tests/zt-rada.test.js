import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isNewsArticleUrl,
  isNewsSectionUrl,
  shouldKeepItem,
} from '../plugins/web/zt-rada.js';

test('keeps evergreen zt-rada sections outside the news backfill window', () => {
  assert.equal(
    shouldKeepItem(
      {
        sourceKind: 'section',
        body: 'Довідкова інформація міської ради з актуальними правилами та послугами.',
        publishedAt: '2025-01-01T00:00:00.000Z',
      },
      new Date('2026-07-15T00:00:00.000Z'),
    ),
    true,
  );
});

test('recognizes only the official zt-rada news section and its articles', () => {
  assert.equal(isNewsSectionUrl('https://zt-rada.gov.ua/press-center/news'), true);
  assert.equal(isNewsSectionUrl('https://zt-rada.gov.ua/press-center/news?p=2'), true);
  assert.equal(
    isNewsArticleUrl('https://zt-rada.gov.ua/press-center/news/some-article'),
    true,
  );
  assert.equal(isNewsArticleUrl('https://zt-rada.gov.ua/documents/123'), false);
  assert.equal(isNewsArticleUrl('https://zt-rada.gov.ua/press-center/announce'), false);
});

test('recognizes an article URL discovered from the news index', () => {
  const discoveredUrl = 'https://zt-rada.gov.ua/some-news-route?id=42';

  assert.equal(isNewsArticleUrl(discoveredUrl, new Set([discoveredUrl])), true);
});
