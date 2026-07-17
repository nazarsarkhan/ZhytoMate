import {
  deleteNewsEntry,
  getNewsById,
  ingestNewsItem,
  listAdminNews,
  listNewsPage,
  updateNewsEntry,
} from "./news.service.js";

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
    const { category, isAnnouncement, limit, page, source } = req.validatedQuery;
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
