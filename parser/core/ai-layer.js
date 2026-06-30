import { toIngestRequest } from './ingest-mapper.js';
import { toNewsItem } from './news-mapper.js';

function isAiLayerEnabled() {
  return process.env.AI_LAYER_ENABLED === 'true';
}

function getAiProvider() {
  return process.env.AI_PROVIDER || 'placeholder';
}

function buildAiInput(item, draftRequest) {
  return {
    raw_item: item,
    draft_ingest_request: draftRequest,
    draft_news_item: toNewsItem(item, draftRequest),
    required_output_schema: {
      ingestRequest: {
        document_id: 'string',
        text: 'string',
        doc_type: 'news | instruction',
        source: 'string',
        category: 'string',
        district: 'bohunskyi | korolovskyi | null',
        ttl_days: 'number',
      },
      newsItem: {
        external_id: 'string',
        source: 'string',
        source_url: 'string',
        title: 'string',
        summary: 'string',
        body: 'string',
        category: 'string',
        district: 'bohunskyi | korolovskyi | null',
        importance: '1..5',
        importance_label: 'critical | high | normal | low | archive',
        is_announcement: 'boolean',
        event_date: 'ISO8601 string | null',
        published_at: 'ISO8601 string',
        expires_at: 'ISO8601 string',
        tags: 'string[]',
        lang: 'uk | ru',
      },
    },
  };
}

async function runPlaceholderModel(aiInput) {
  // Future integration point for OpenAI or another model provider.
  // Keep this function side-effect free: it receives all context and must
  // return only final payloads compatible with downstream services.
  return {
    ingestRequest: aiInput.draft_ingest_request,
    newsItem: aiInput.draft_news_item,
  };
}

async function runAiModel(aiInput) {
  const provider = getAiProvider();

  if (provider === 'placeholder') {
    return runPlaceholderModel(aiInput);
  }

  throw new Error(`Unsupported AI_PROVIDER: ${provider}`);
}

function validateIngestRequest(request) {
  const requiredFields = [
    'document_id',
    'text',
    'doc_type',
    'source',
    'category',
    'ttl_days',
  ];

  for (const field of requiredFields) {
    if (request[field] === undefined || request[field] === null || request[field] === '') {
      throw new Error(`AI layer returned invalid ingest request: missing ${field}`);
    }
  }

  if (!Number.isFinite(Number(request.ttl_days)) || Number(request.ttl_days) < 1) {
    throw new Error('AI layer returned invalid ingest request: ttl_days must be >= 1');
  }

  return {
    ...request,
    ttl_days: Number(request.ttl_days),
    district: request.district || null,
  };
}

function validateNewsItem(newsItem) {
  const requiredFields = [
    'external_id',
    'source',
    'title',
    'summary',
    'body',
    'category',
    'importance',
    'importance_label',
    'published_at',
    'expires_at',
    'lang',
  ];

  for (const field of requiredFields) {
    if (newsItem[field] === undefined || newsItem[field] === null || newsItem[field] === '') {
      throw new Error(`AI layer returned invalid news item: missing ${field}`);
    }
  }

  return {
    ...newsItem,
    importance: Number(newsItem.importance),
    district: newsItem.district || null,
    event_date: newsItem.event_date || null,
    tags: Array.isArray(newsItem.tags) ? newsItem.tags : [],
  };
}

export async function buildCollectorOutputs(item) {
  const draft = toIngestRequest(item);

  if (draft.skipped) {
    return {
      ...draft,
      ingestRequest: null,
      newsItem: null,
      ai: {
        used: false,
        provider: getAiProvider(),
        mode: 'skipped_before_ai',
      },
    };
  }

  if (!isAiLayerEnabled()) {
    const ingestRequest = validateIngestRequest(draft.request);

    return {
      skipped: false,
      reason: null,
      request: ingestRequest,
      ingestRequest,
      newsItem: validateNewsItem(toNewsItem(item, ingestRequest)),
      ai: {
        used: false,
        provider: getAiProvider(),
        mode: 'heuristic_draft_only',
      },
    };
  }

  const aiInput = buildAiInput(item, draft.request);
  const aiOutput = await runAiModel(aiInput);
  const ingestRequest = validateIngestRequest(aiOutput.ingestRequest);

  return {
    skipped: false,
    reason: null,
    request: ingestRequest,
    ingestRequest,
    newsItem: validateNewsItem(aiOutput.newsItem || toNewsItem(item, ingestRequest)),
    ai: {
      used: true,
      provider: getAiProvider(),
      mode: 'model_enriched',
    },
  };
}

export async function buildIngestRequest(item) {
  const outputs = await buildCollectorOutputs(item);

  return {
    skipped: outputs.skipped,
    reason: outputs.reason,
    request: outputs.ingestRequest,
    ai: outputs.ai,
  };
}
