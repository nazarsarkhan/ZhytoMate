import { ApiError } from "../../shared/ApiError.js";
import {
  analyzeAppealPhoto,
  createUserAppeal,
  getAllAppeals,
  getUserAppealById,
  getUserAppeals,
  respondToAppeal,
} from "./appeal.service.js";

export async function createAppeal(req, res, next) {
  try {
    const appeal = await createUserAppeal({
      userId: req.user.id,
      imageUrl: req.body.imageUrl,
      category: req.body.category,
      description: req.body.description,
      address: req.body.address,
    });

    return res.status(201).json({ appeal });
  } catch (err) {
    return next(err);
  }
}

export async function uploadPhoto(req, res, next) {
  try {
    if (!req.file) {
      throw ApiError.badRequest("A photo file is required");
    }

    const result = await analyzeAppealPhoto({
      filename: req.file.filename,
      mimeType: req.file.mimetype,
      hostUrl: `${req.protocol}://${req.get("host")}`,
    });

    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export async function getMyAppeals(req, res, next) {
  try {
    const appeals = await getUserAppeals(req.user.id);
    return res.json({ appeals });
  } catch (err) {
    return next(err);
  }
}

export async function getAppealById(req, res, next) {
  try {
    const appeal = await getUserAppealById({
      appealId: req.params.id,
      userId: req.user.id,
      role: req.user.role,
    });

    return res.json({ appeal });
  } catch (err) {
    return next(err);
  }
}

// Admin: list every citizen's appeals with optional filters.
export async function getAppeals(req, res, next) {
  try {
    const { status, category, page, limit } = req.validatedQuery;
    const result = await getAllAppeals({ status, category, page, limit });

    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

// Admin: set status and/or the citizen-facing response on an appeal.
export async function updateAppeal(req, res, next) {
  try {
    const appeal = await respondToAppeal({
      appealId: req.params.id,
      status: req.body.status,
      response: req.body.response,
    });

    return res.json({ appeal });
  } catch (err) {
    return next(err);
  }
}

export default {
  createAppeal,
  uploadPhoto,
  getMyAppeals,
  getAppealById,
  getAppeals,
  updateAppeal,
};
