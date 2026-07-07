import Joi from "joi";

// Validates the parser's ingest payload (snake_case, from parser/core/news/news-mapper.js).
// Deliberately permissive: the parser treats any 4xx as a PERMANENT drop (see
// parser/core/delivery/sender.js isPermanentHttpStatus), so an over-strict schema would silently
// discard valid scraped news. Only the fields the parser itself guarantees (its validateNewsItem)
// are required; category is a free string; unknown extras are stripped by the shared validate
// middleware. Dates are coerced from ISO8601 strings to Date so Mongoose stores them natively.
export const ingestNewsSchema = Joi.object({
  external_id: Joi.string().trim().max(512).required(),
  source: Joi.string().trim().max(256).required(),
  source_url: Joi.string().trim().max(2048).uri().allow(null, ""),
  title: Joi.string().trim().max(512).required(),
  summary: Joi.string().trim().max(2000).allow("").required(),
  body: Joi.string().max(50000).allow("").required(),
  body_html: Joi.string().allow(null, ""),
  cover_image_url: Joi.string().trim().max(2048).uri().allow(null, ""),
  images: Joi.array().items(Joi.object().unknown(true)).default([]),
  category: Joi.string().trim().max(64).required(),
  district: Joi.string().trim().max(64).allow(null, ""),
  importance: Joi.number().integer().min(1).max(5),
  importance_label: Joi.string().trim().max(32),
  is_announcement: Joi.boolean(),
  event_date: Joi.date().iso().allow(null),
  published_at: Joi.date().iso().required(),
  expires_at: Joi.date().iso().allow(null),
  tags: Joi.array().items(Joi.string().trim().max(64)).default([]),
  lang: Joi.string().trim().max(16).required(),
});

export const newsIdParamsSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

export default {
  ingestNewsSchema,
  newsIdParamsSchema,
};
