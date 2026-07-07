import {
  getNewsById,
  ingestNewsItem,
  listNews,
} from "./news.service.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function ingestNews(req, res, next) {
  try {
    const news = await ingestNewsItem(req.body);
    return res.status(201).json({ news });
  } catch (err) {
    return next(err);
  }
}

export async function getNews(req, res, next) {
  try {
    // Parsed manually (not via validate(...,"query")): Express 5 makes req.query a getter-only
    // property, and the shared validate middleware reassigns req[source], which would throw here.
    const parsedLimit = Number(req.query.limit);
    const limit =
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, MAX_LIMIT)
        : DEFAULT_LIMIT;
    const category =
      typeof req.query.category === "string" && req.query.category.trim()
        ? req.query.category.trim()
        : undefined;

    const news = await listNews({ category, limit });
    return res.json({ news });
  } catch (err) {
    return next(err);
  }
}

export async function getNewsItemById(req, res, next) {
  try {
    const news = await getNewsById(req.params.id);
    return res.json({ news });
  } catch (err) {
    return next(err);
  }
}

export default {
  ingestNews,
  getNews,
  getNewsItemById,
};
