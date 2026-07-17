import {
  deleteNewsEntry,
  getNewsById,
  ingestNewsItem,
  listAdminNews,
  listNewsPage,
  updateNewsEntry,
} from "./news.service.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 20;

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function optionalTrimmedString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  return undefined;
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
    const page = positiveInteger(req.query.page, DEFAULT_PAGE);
    const limit = Math.min(positiveInteger(req.query.limit, DEFAULT_LIMIT), MAX_LIMIT);
    const category = optionalTrimmedString(req.query.category);
    const source = optionalTrimmedString(req.query.source);
    const isAnnouncement = optionalBoolean(req.query.isAnnouncement);
    const result = await listNewsPage({
      category,
      source,
      isAnnouncement,
      limit,
      page,
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export async function getAdminNews(req, res, next) {
  try {
    const { category, isAnnouncement, source } = req.validatedQuery;
    const news = await listAdminNews({ category, source, isAnnouncement });
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

export async function updateNews(req, res, next) {
  try {
    const news = await updateNewsEntry({
      newsId: req.params.id,
      updates: req.body,
    });
    return res.json({ news });
  } catch (err) {
    return next(err);
  }
}

export async function deleteNews(req, res, next) {
  try {
    const result = await deleteNewsEntry(req.params.id);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export default {
  ingestNews,
  getNews,
  getAdminNews,
  getNewsItemById,
  updateNews,
  deleteNews,
};
