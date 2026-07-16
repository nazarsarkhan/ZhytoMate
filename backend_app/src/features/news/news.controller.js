import {
  getNewsById,
  ingestNewsItem,
  listNewsPage,
} from "./news.service.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 20;

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

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
    const page = positiveInteger(req.query.page, DEFAULT_PAGE);
    const limit = Math.min(positiveInteger(req.query.limit, DEFAULT_LIMIT), MAX_LIMIT);
    const category =
      typeof req.query.category === "string" && req.query.category.trim()
        ? req.query.category.trim()
        : undefined;

    const result = await listNewsPage({ category, limit, page });
    return res.json(result);
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
