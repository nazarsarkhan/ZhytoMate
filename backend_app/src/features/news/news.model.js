import mongoose from "mongoose";

// A single scraped-and-normalized news item, ingested from the parser/ collector service
// (parser/core/news/news-mapper.js's toNewsItem). Stored camelCase here; the parser sends
// snake_case, so news.service.js maps between the two on ingest. `category` is intentionally a
// free string (not an enum): the parser's taxonomy is broad and evolving, and a stricter schema
// would make valid scraped news get rejected (a 4xx which the parser treats as a permanent drop).
const newsImageSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true },
    alt: { type: String, trim: true, default: "" },
    caption: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

const newsSchema = new mongoose.Schema(
  {
    // Dedupe key from the parser (`${item.source}_${item.id}`). Upserted on ingest so re-runs
    // update in place instead of creating duplicates.
    externalId: { type: String, required: true, unique: true, trim: true },
    source: { type: String, trim: true },
    sourceUrl: { type: String, trim: true, default: null },
    title: { type: String, required: true, trim: true },
    summary: { type: String, trim: true, default: "" },
    body: { type: String, default: "" },
    bodyHtml: { type: String, default: null },
    coverImageUrl: { type: String, trim: true, default: null },
    images: { type: [newsImageSchema], default: [] },
    category: { type: String, trim: true },
    district: { type: String, trim: true, default: null },
    importance: { type: Number, default: 3 },
    importanceLabel: { type: String, trim: true, default: "normal" },
    isAnnouncement: { type: Boolean, default: false },
    eventDate: { type: Date, default: null },
    publishedAt: { type: Date },
    expiresAt: { type: Date, default: null },
    tags: { type: [String], default: [] },
    lang: { type: String, trim: true, default: "uk" },
  },
  { timestamps: true },
);

newsSchema.index({ publishedAt: -1 });

export const News = mongoose.model("News", newsSchema);

export function toPublicNews(news) {
  return {
    id: news._id.toString(),
    externalId: news.externalId,
    title: news.title,
    summary: news.summary || "",
    body: news.body || "",
    bodyHtml: news.bodyHtml || null,
    source: news.source || "",
    sourceUrl: news.sourceUrl || null,
    coverImageUrl: news.coverImageUrl || null,
    images: Array.isArray(news.images)
      ? news.images.map((image) => ({
          url: image.url,
          alt: image.alt || "",
          caption: image.caption || "",
        }))
      : [],
    category: news.category || "other",
    district: news.district || null,
    importance: news.importance,
    importanceLabel: news.importanceLabel || "normal",
    isAnnouncement: Boolean(news.isAnnouncement),
    eventDate: news.eventDate || null,
    publishedAt: news.publishedAt || null,
    expiresAt: news.expiresAt || null,
    tags: Array.isArray(news.tags) ? news.tags : [],
    lang: news.lang || "uk",
    createdAt: news.createdAt,
    updatedAt: news.updatedAt,
  };
}

export default News;
