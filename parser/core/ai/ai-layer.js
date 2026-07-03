import { toIngestRequest } from '../ingest/ingest-mapper.js';
import { toNewsItem } from '../news/news-mapper.js';

const allowedCategories = new Set([
  'memorial',
  'utilities',
  'weather',
  'economy',
  'social',
  'culture',
  'infrastructure',
  'transport',
  'safety',
  'health',
  'politics',
  'ecology',
  'other',
]);

const allowedDistricts = new Set(['bohunskyi', 'korolovskyi']);
const allowedDocTypes = new Set(['news', 'instruction']);
const allowedImportanceLabels = new Set(['critical', 'high', 'normal', 'low', 'archive']);
const importanceByLabel = new Map([
  ['critical', 5],
  ['high', 4],
  ['normal', 3],
  ['low', 2],
  ['archive', 1],
]);
const labelByImportance = new Map([...importanceByLabel].map(([label, importance]) => [importance, label]));

function isAiLayerEnabled() {
  return process.env.AI_LAYER_ENABLED === 'true';
}

function shouldUseAiForItem(item) {
  return isAiLayerEnabled() && item.useAi !== false;
}

function getAiProvider() {
  return process.env.AI_PROVIDER || 'placeholder';
}

function getAiModel() {
  return process.env.AI_MODEL || 'gpt-4o-mini';
}

function getOpenAiApiKey() {
  return process.env.OPENAI_API_KEY || '';
}

function getOpenAiBaseUrl() {
  return (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
}

function getAiTemperature() {
  const value = Number(process.env.AI_TEMPERATURE);
  return Number.isFinite(value) && value >= 0 ? value : 0.1;
}

function getAiMaxTokens() {
  const value = Number(process.env.AI_MAX_TOKENS);
  return Number.isFinite(value) && value > 0 ? value : 900;
}

function isAiFailOpen() {
  return process.env.AI_FAIL_OPEN !== 'false';
}

function stripText(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function truncateText(value, maxLength) {
  const text = value || '';

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3)}...`;
}

function toPublicDraft(draftRequest, draftNewsItem) {
  return {
    category: draftRequest.category,
    district: draftRequest.district,
    doc_type: draftRequest.doc_type,
    ttl_days: draftRequest.ttl_days,
    title: draftNewsItem.title,
    summary: draftNewsItem.summary,
    importance: draftNewsItem.importance,
    importance_label: draftNewsItem.importance_label,
    is_announcement: draftNewsItem.is_announcement,
    event_date: draftNewsItem.event_date,
    tags: draftNewsItem.tags,
  };
}

function buildAiInput(item, draftRequest) {
  const draftNewsItem = toNewsItem(item, draftRequest);

  return {
    source: item.source,
    source_type: item.type,
    source_url: item.url || '',
    published_at: item.publishedAt,
    lang: item.lang,
    title: item.title,
    text: truncateText(draftRequest.text, 6000),
    draft: toPublicDraft(draftRequest, draftNewsItem),
    allowed_values: {
      categories: [...allowedCategories],
      districts: [...allowedDistricts, null],
      doc_types: [...allowedDocTypes],
      importance_labels: [...allowedImportanceLabels],
    },
    draft_ingest_request: draftRequest,
    draft_news_item: draftNewsItem,
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

function buildOpenAiMessages(aiInput) {
  return [
    {
      role: 'system',
      content: [
        'You are a strict JSON classifier for a Zhytomyr city news parser.',
        'Improve the provided heuristic draft using only facts explicitly present in the source text.',
        'Do not invent names, dates, locations, numbers, or causes.',
        'Return exactly one JSON object and no markdown.',
      ].join(' '),
    },
    {
      role: 'user',
      content: JSON.stringify({
        task: [
          'Read the original text and correct the draft fields.',
          'Keep the item if it is relevant to Zhytomyr city or city residents.',
          'Skip only clear ads, empty/noisy posts, or items outside Zhytomyr city scope.',
          'Skip operational air raid alert notices, including alert started, alert ongoing, and alert cancelled/all-clear posts.',
          'Do not skip substantive news that only mentions an air raid alert as context.',
          'clean_text must preserve useful factual content while removing channel signatures, repeated whitespace, hashtags-only clutter, and tracking links.',
          'summary must be short and factual in the source language.',
          'title must be a concise news title in the source language.',
          'Use input.published_at as the reference date for relative dates such as today, tomorrow, and from tomorrow.',
          'event_date must be ISO8601 when an explicit or relative future/event date is present, otherwise null.',
          'The heuristic draft ttl_days is only an initial estimate.',
          'Adjust ttl_days up or down for any category based on usefulness from input.published_at; keep the draft value when it looks reasonable.',
          'Short one-off announcements for today/tomorrow/from tomorrow usually need ttl_days 1..3; long-running instructions, memorials, policy, or reference-like items may need more.',
        ],
        output_schema: {
          category: [...allowedCategories].join(' | '),
          district: 'bohunskyi | korolovskyi | null',
          doc_type: 'news | instruction',
          title: 'string',
          summary: 'string',
          clean_text: 'string',
          importance: 'integer 1..5',
          importance_label: 'critical | high | normal | low | archive',
          is_announcement: 'boolean',
          event_date: 'ISO8601 string | null',
          ttl_days: 'integer >= 1',
          tags: 'string[] up to 8 items',
          should_skip: 'boolean',
          skip_reason: 'string | null',
        },
        input: aiInput,
      }),
    },
  ];
}

async function callOpenAiChatCompletion(aiInput) {
  const apiKey = getOpenAiApiKey();

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required when AI_PROVIDER=openai');
  }

  const response = await fetch(`${getOpenAiBaseUrl()}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: getAiModel(),
      temperature: getAiTemperature(),
      max_tokens: getAiMaxTokens(),
      response_format: { type: 'json_object' },
      messages: buildOpenAiMessages(aiInput),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API failed with HTTP ${response.status}: ${truncateText(errorBody, 500)}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('OpenAI API returned an empty completion');
  }

  return JSON.parse(content);
}

function normalizeNullableString(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const text = stripText(String(value));
  return text || null;
}

function normalizeCategory(value, fallback) {
  return allowedCategories.has(value) ? value : fallback;
}

function normalizeDistrict(value, fallback) {
  if (value === null || value === '') {
    return null;
  }

  return allowedDistricts.has(value) ? value : fallback;
}

function normalizeDocType(value, fallback) {
  return allowedDocTypes.has(value) ? value : fallback;
}

function normalizeImportance(value, label, fallbackImportance, fallbackLabel) {
  const numericImportance = Number(value);
  const labelImportance = importanceByLabel.get(label);

  if (Number.isInteger(numericImportance) && numericImportance >= 1 && numericImportance <= 5) {
    return {
      importance: numericImportance,
      importance_label: labelByImportance.get(numericImportance),
    };
  }

  if (labelImportance) {
    return {
      importance: labelImportance,
      importance_label: label,
    };
  }

  return {
    importance: fallbackImportance,
    importance_label: fallbackLabel,
  };
}

function normalizeTtlDays(value, fallback) {
  const ttlDays = Number(value);

  if (Number.isFinite(ttlDays) && ttlDays >= 1) {
    return Math.ceil(ttlDays);
  }

  return Number(fallback);
}

function normalizeBoolean(value, fallback) {
  if (typeof value === 'boolean') {
    return value;
  }

  return fallback;
}

function normalizeTags(value, category, fallback) {
  const tags = new Set();

  if (category && category !== 'other') {
    tags.add(category);
  }

  const candidates = Array.isArray(value) ? value : fallback;

  for (const tag of candidates || []) {
    const normalizedTag = stripText(String(tag)).slice(0, 40);

    if (normalizedTag) {
      tags.add(normalizedTag);
    }
  }

  return [...tags].slice(0, 8);
}

function buildExpiresAt(publishedAt, ttlDays) {
  const expiresAt = new Date(publishedAt || Date.now());
  expiresAt.setUTCDate(expiresAt.getUTCDate() + ttlDays);
  return expiresAt.toISOString();
}

function mergeModelCorrections(aiInput, corrections) {
  const draftRequest = aiInput.draft_ingest_request;
  const draftNewsItem = aiInput.draft_news_item;

  if (corrections.should_skip === true) {
    return {
      skipped: true,
      reason: normalizeNullableString(corrections.skip_reason) || 'skipped by AI layer',
      ingestRequest: null,
      newsItem: null,
    };
  }

  const category = normalizeCategory(corrections.category, draftRequest.category);
  const district = normalizeDistrict(corrections.district, draftRequest.district);
  const docType = normalizeDocType(corrections.doc_type, draftRequest.doc_type);
  const cleanText = normalizeNullableString(corrections.clean_text) || draftRequest.text;
  const ttlDays = normalizeTtlDays(corrections.ttl_days, draftRequest.ttl_days);
  const title = normalizeNullableString(corrections.title) || draftNewsItem.title;
  const summary = normalizeNullableString(corrections.summary) || draftNewsItem.summary;
  const importance = normalizeImportance(
    corrections.importance,
    corrections.importance_label,
    draftNewsItem.importance,
    draftNewsItem.importance_label,
  );

  const ingestRequest = {
    ...draftRequest,
    text: cleanText,
    doc_type: docType,
    category,
    district,
    ttl_days: ttlDays,
  };

  const newsItem = {
    ...draftNewsItem,
    title: truncateText(title, 140),
    summary: truncateText(summary, 280),
    body: cleanText,
    category,
    district,
    importance: importance.importance,
    importance_label: importance.importance_label,
    is_announcement: normalizeBoolean(corrections.is_announcement, draftNewsItem.is_announcement),
    event_date: normalizeNullableString(corrections.event_date),
    expires_at: buildExpiresAt(draftNewsItem.published_at, ttlDays),
    tags: normalizeTags(corrections.tags, category, draftNewsItem.tags),
  };

  return {
    skipped: false,
    reason: null,
    ingestRequest,
    newsItem,
  };
}

async function runOpenAiModel(aiInput) {
  const corrections = await callOpenAiChatCompletion(aiInput);
  const merged = mergeModelCorrections(aiInput, corrections);

  return {
    skipped: merged.skipped,
    reason: merged.reason,
    ingestRequest: merged.ingestRequest,
    newsItem: merged.newsItem,
  };
}

async function runAiModel(aiInput) {
  const provider = getAiProvider();

  if (provider === 'placeholder') {
    return runPlaceholderModel(aiInput);
  }

  if (provider === 'openai') {
    return runOpenAiModel(aiInput);
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

  if (!shouldUseAiForItem(item)) {
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
        mode: item.useAi === false ? 'disabled_for_source' : 'heuristic_draft_only',
      },
    };
  }

  const aiInput = buildAiInput(item, draft.request);
  let aiOutput;

  try {
    aiOutput = await runAiModel(aiInput);
  } catch (error) {
    if (!isAiFailOpen()) {
      throw error;
    }

    console.error(`AI layer failed, using heuristic draft: ${error.message}`);

    aiOutput = {
      ingestRequest: aiInput.draft_ingest_request,
      newsItem: aiInput.draft_news_item,
      failed: true,
      error: error.message,
    };
  }

  if (aiOutput.skipped) {
    return {
      skipped: true,
      reason: aiOutput.reason,
      request: null,
      ingestRequest: null,
      newsItem: null,
      ai: {
        used: true,
        provider: getAiProvider(),
        model: getAiModel(),
        mode: aiOutput.failed ? 'model_failed_fallback' : 'model_skipped',
        error: aiOutput.error,
      },
    };
  }

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
      model: getAiModel(),
      mode: aiOutput.failed ? 'model_failed_fallback' : 'model_enriched',
      error: aiOutput.error,
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
