import { ApiError } from "../../shared/ApiError.js";
import {
  deleteNewsById,
  findNews,
  findNewsById,
  findParserNews,
  findParserNewsById,
  countNews,
  updateNewsById,
  upsertNewsByExternalId,
} from "./news.repository.js";
import {
  NEWS_ADMIN_EDITABLE_FIELDS,
  toPublicNews,
  toPublicParserNews,
} from "./news.model.js";

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

export async function listNewsPage({ category, source, isAnnouncement, page, limit }) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    findNews({ category, source, isAnnouncement, skip, limit }),
    countNews({ category, source, isAnnouncement }),
  ]);
  const news = items.map(toPublicNews);

  return {
    news,
    pagination: {
      page,
      limit,
      total,
      totalPages: total ? Math.ceil(total / limit) : 0,
      hasMore: skip + news.length < total,
    },
  };
}

export async function getNewsById(id) {
  const news = await findNewsById(id);
  if (news) {
    return toPublicNews(news);
  }

  const parserNews = await findParserNewsById(id);
  if (!parserNews) {
    throw ApiError.notFound("News not found");
  }
  return toPublicParserNews(parserNews);
}

export async function listAdminNews({ category, source, isAnnouncement }) {
  const items = await findNews({ category, source, isAnnouncement });
  return items.map(toPublicNews);
}

function pickEditableNewsUpdates(updates) {
  return NEWS_ADMIN_EDITABLE_FIELDS.reduce((acc, field) => {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      acc[field] = updates[field];
    }
    return acc;
  }, {});
}

export async function updateNewsEntry({ newsId, updates }) {
  const editableUpdates = pickEditableNewsUpdates(updates);
  const news = await updateNewsById(newsId, editableUpdates);
  if (!news) {
    throw ApiError.notFound("News not found");
  }
  return toPublicNews(news);
}

export async function deleteNewsEntry(newsId) {
  const deleted = await deleteNewsById(newsId);
  if (!deleted) {
    throw ApiError.notFound("News not found");
  }
  return { id: newsId };
}

export default {
  ingestNewsItem,
  listNews,
  listNewsPage,
  getNewsById,
  listAdminNews,
  updateNewsEntry,
  deleteNewsEntry,
};
