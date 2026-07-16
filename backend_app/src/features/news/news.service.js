import { ApiError } from "../../shared/ApiError.js";
import {
  findNews,
  findNewsById,
  upsertNewsByExternalId,
} from "./news.repository.js";
import { toPublicNews } from "./news.model.js";

// The parser (parser/core/news/news-mapper.js) emits snake_case; the model is camelCase. This is
// the single place that bridges the two shapes on ingest.
function toModelFields(payload) {
  return {
    externalId: payload.external_id,
    source: payload.source,
    sourceUrl: payload.source_url ?? null,
    title: payload.title,
    summary: payload.summary ?? "",
    body: payload.body ?? "",
    bodyHtml: payload.body_html ?? null,
    coverImageUrl: payload.cover_image_url ?? null,
    images: Array.isArray(payload.images) ? payload.images : [],
    category: payload.category,
    district: payload.district ?? null,
    importance: payload.importance,
    importanceLabel: payload.importance_label,
    isAnnouncement: payload.is_announcement ?? false,
    eventDate: payload.event_date ?? null,
    publishedAt: payload.published_at,
    expiresAt: payload.expires_at ?? null,
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    lang: payload.lang,
  };
}

export async function ingestNewsItem(payload) {
  const fields = toModelFields(payload);
  const news = await upsertNewsByExternalId(fields);
  return toPublicNews(news);
}

export async function listNews({ category, source, limit }) {
  const items = await findNews({ category, source, limit });
  return items.map(toPublicNews);
}

export async function getNewsById(id) {
  const news = await findNewsById(id);
  if (!news) {
    throw ApiError.notFound("News not found");
  }
  return toPublicNews(news);
}

export default {
  ingestNewsItem,
  listNews,
  getNewsById,
};
