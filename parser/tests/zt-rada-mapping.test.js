import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCollectorOutputs } from '../core/ai/ai-layer.js';
import { normalizeItem } from '../core/pipeline/normalizer.js';
import { toIngestRequest } from '../core/ingest/ingest-mapper.js';
import { toNewsItem } from '../core/news/news-mapper.js';
import { extractWebContent } from '../plugins/web/zt-rada.js';

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
      bodyHtml: '<p>Useful city council document text for indexing.</p>',
      coverImageUrl: 'https://zt-rada.gov.ua/uploads/cover.jpg',
      images: [
        {
          url: 'https://zt-rada.gov.ua/uploads/cover.jpg',
          alt: 'Cover',
          caption: 'Cover caption',
        },
      ],
      attachments: [{ url: 'https://zt-rada.gov.ua/files/example.pdf', ok: true }],
    },
    plugin,
    'web',
  );

  assert.equal(item.category, 'politics');
  assert.equal(item.docType, 'instruction');
  assert.equal(item.sourceKind, 'document-index');
  assert.equal(item.bodyHtml, '<p>Useful city council document text for indexing.</p>');
  assert.equal(item.coverImageUrl, 'https://zt-rada.gov.ua/uploads/cover.jpg');
  assert.deepEqual(item.images, [
    {
      url: 'https://zt-rada.gov.ua/uploads/cover.jpg',
      alt: 'Cover',
      caption: 'Cover caption',
    },
  ]);
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

test('news mapper forwards display html and images without changing RAG text', () => {
  const item = normalizeItem(
    {
      url: 'https://zt-rada.gov.ua/news/example',
      title: 'City update',
      body: 'Plain body for RAG.',
      bodyHtml: '<p><strong>Plain body</strong> for display.</p>',
      coverImageUrl: 'https://zt-rada.gov.ua/uploads/news.jpg',
      images: [{ url: 'https://zt-rada.gov.ua/uploads/news.jpg', alt: 'News', caption: '' }],
      publishedAt: '2026-01-15T00:00:00.000Z',
      docType: 'news',
      sourceKind: 'post',
    },
    plugin,
    'web',
  );
  const ingest = toIngestRequest(item).request;
  const newsItem = toNewsItem(item, ingest);

  assert.equal(newsItem.body, 'City update\n\nPlain body for RAG.');
  assert.equal(newsItem.body_html, '<p><strong>Plain body</strong> for display.</p>');
  assert.equal(newsItem.cover_image_url, 'https://zt-rada.gov.ua/uploads/news.jpg');
  assert.deepEqual(newsItem.images, [
    { url: 'https://zt-rada.gov.ua/uploads/news.jpg', alt: 'News', caption: '' },
  ]);
});

test('zt-rada extractor chooses article content and sanitizes html/images', () => {
  const content = extractWebContent(
    `
      <html>
        <head>
          <meta property="og:image" content="/uploads/cover.jpg">
        </head>
        <body>
          <div class="container"><nav><a href="/menu">Menu</a></nav></div>
          <article class="news-detail">
            <h1>Ignored by sanitizer</h1>
            <p onclick="bad()">First paragraph <strong>kept</strong>.</p>
            <figure>
              <img src="/uploads/inside.png" alt="Inside image" onerror="bad()">
              <figcaption>Inside caption</figcaption>
            </figure>
            <script>alert("bad")</script>
            <p>Second paragraph with <a href="/page">internal link</a>.</p>
            <p><a href="https://external.example/page">external link removed</a></p>
          </article>
        </body>
      </html>
    `,
    'https://zt-rada.gov.ua/news/example',
  );

  assert.match(content.body, /First paragraph kept\./);
  assert.match(content.body, /Second paragraph with internal link\./);
  assert.doesNotMatch(content.bodyHtml, /script|onclick|onerror|external\.example/);
  assert.match(content.bodyHtml, /<strong>kept<\/strong>/);
  assert.match(content.bodyHtml, /href="https:\/\/zt-rada\.gov\.ua\/page"/);
  assert.equal(content.coverImageUrl, 'https://zt-rada.gov.ua/uploads/cover.jpg');
  assert.deepEqual(content.images, [
    {
      url: 'https://zt-rada.gov.ua/uploads/inside.png',
      alt: 'Inside image',
      caption: 'Inside caption',
    },
  ]);
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
