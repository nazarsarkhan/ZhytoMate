import { v4 as uuidv4 } from 'uuid';

/**
 * Convert raw plugin output into the canonical item shape expected by RAG.
 *
 * @param {object} rawItem Raw item returned by a plugin.
 * @param {object} plugin Source plugin metadata.
 * @param {'web' | 'telegram'} type Source type.
 * @returns {object} Normalized item.
 */
function toIsoOrFallback(value, fallback) {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

export function normalizeItem(rawItem, plugin, type) {
  const now = new Date().toISOString();
  const publishedAt = toIsoOrFallback(rawItem.publishedAt, now);
  const images = Array.isArray(rawItem.images)
    ? rawItem.images
        .filter((image) => image && image.url)
        .map((image) => ({
          url: image.url,
          alt: image.alt || '',
          caption: image.caption || '',
        }))
    : [];

  return {
    id: uuidv4(),
    source: plugin.id,
    type,
    url: rawItem.url || '',
    title: rawItem.title ?? null,
    body: rawItem.body || '',
    bodyHtml: rawItem.bodyHtml || null,
    coverImageUrl: rawItem.coverImageUrl || null,
    images,
    publishedAt,
    scrapedAt: now,
    lang: 'uk',
    category: rawItem.category,
    docType: rawItem.docType,
    attachments: rawItem.attachments,
    sourceKind: rawItem.sourceKind,
    useAi: rawItem.useAi ?? plugin.settings?.useAi ?? plugin.useAi,
  };
}

/**
 * Normalize a list and drop empty entries that cannot be useful for ingestion.
 */
export function normalizeItems(rawItems, plugin, type) {
  return rawItems
    .filter(Boolean)
    .map((rawItem) => normalizeItem(rawItem, plugin, type))
    .filter((item) => item.body.trim().length > 0);
}
