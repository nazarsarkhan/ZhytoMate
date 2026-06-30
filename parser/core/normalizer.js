import { v4 as uuidv4 } from 'uuid';

/**
 * Convert raw plugin output into the canonical item shape expected by RAG.
 *
 * @param {object} rawItem Raw item returned by a plugin.
 * @param {object} plugin Source plugin metadata.
 * @param {'web' | 'telegram'} type Source type.
 * @returns {object} Normalized item.
 */
export function normalizeItem(rawItem, plugin, type) {
  const now = new Date().toISOString();
  const publishedAt = rawItem.publishedAt
    ? new Date(rawItem.publishedAt).toISOString()
    : now;

  return {
    id: uuidv4(),
    source: plugin.id,
    type,
    url: rawItem.url || '',
    title: rawItem.title ?? null,
    body: rawItem.body || '',
    publishedAt,
    scrapedAt: now,
    lang: 'uk',
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
