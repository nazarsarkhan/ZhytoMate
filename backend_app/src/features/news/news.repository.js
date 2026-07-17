import mongoose from "mongoose";
import News from "./news.model.js";

const parserNewsDbName = process.env.PARSER_NEWS_DB || "future_in_action_scraper";
const parserNewsCollectionName = process.env.PARSER_NEWS_COLLECTION || "news_items";

// Idempotent write: the parser may re-deliver the same item (its own dedup is best-effort), so we
// upsert on externalId rather than insert. setDefaultsOnInsert applies schema defaults on the very
// first insert only.
export function upsertNewsByExternalId(fields) {
  return News.findOneAndUpdate(
    { externalId: fields.externalId },
    { $set: fields },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

function buildNewsFilter({ category, source, isAnnouncement }) {
  return {
    ...(category ? { category } : {}),
    ...(source ? { source } : {}),
    ...(typeof isAnnouncement === "boolean" ? { isAnnouncement } : {}),
  };
}

export function findNews({ category, source, isAnnouncement, skip = 0, limit }) {
  const query = News.find(buildNewsFilter({ category, source, isAnnouncement })).sort({
    publishedAt: -1,
    createdAt: -1,
  });

  if (skip > 0) {
    query.skip(skip);
  }

  if (typeof limit === "number") {
    query.limit(limit);
  }

  return query;
}

export function countNews({ category, source, isAnnouncement }) {
  return News.countDocuments(buildNewsFilter({ category, source, isAnnouncement }));
}

export function findNewsById(id) {
  return News.findById(id);
}

export function updateNewsById(id, updates) {
  return News.findByIdAndUpdate(id, { $set: updates }, { new: true });
}

export function deleteNewsById(id) {
  return News.findByIdAndDelete(id);
}

function getParserNewsCollection() {
  return mongoose.connection
    .useDb(parserNewsDbName, { useCache: true })
    .collection(parserNewsCollectionName);
}

export async function findParserNews({ category, limit }) {
  const filter = category ? { category } : {};
  return getParserNewsCollection()
    .find(filter)
    .sort({ published_at: -1, publishedDate: -1, source: 1 })
    .limit(limit)
    .toArray();
}

export async function findParserNewsById(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return getParserNewsCollection().findOne({ _id: new mongoose.Types.ObjectId(id) });
}

export default {
  upsertNewsByExternalId,
  findNews,
  countNews,
  findNewsById,
  updateNewsById,
  deleteNewsById,
  findParserNews,
  findParserNewsById,
};
