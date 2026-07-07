import News from "./news.model.js";

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

export function findNews({ category, limit }) {
  const filter = category ? { category } : {};
  return News.find(filter).sort({ publishedAt: -1 }).limit(limit);
}

export function findNewsById(id) {
  return News.findById(id);
}

export default {
  upsertNewsByExternalId,
  findNews,
  findNewsById,
};
