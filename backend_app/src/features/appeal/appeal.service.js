import fs from "node:fs/promises";
import path from "node:path";
import { ApiError } from "../../shared/ApiError.js";
import { analyzeVision } from "../../shared/mlClient.js";
import {
  countAppeals,
  createAppeal,
  findAppealById,
  findAppeals,
  findAppealsByUserId,
  updateAppealById,
} from "./appeal.repository.js";
import { toPublicAppeal } from "./appeal.model.js";
import { UPLOAD_DIR } from "./appeal.upload.js";

export async function createUserAppeal({
  userId,
  imageUrl,
  category,
  description,
  address,
}) {
  const appeal = await createAppeal({
    userId,
    imageUrl,
    category,
    description,
    address,
  });

  return toPublicAppeal(appeal);
}

export async function analyzeAppealPhoto({ filename, mimeType, hostUrl }) {
  // multer has already persisted the photo to UPLOAD_DIR (served statically from /uploads), so the
  // appeal can always be submitted regardless of ml-service health. The imageUrl is therefore
  // available immediately - only the AI triage (auto-fill of category/description) depends on
  // ml-service, so we treat it as best-effort: on any failure we return triage: null and let the
  // citizen fill the form manually instead of blocking the whole upload.
  const imageUrl = `${hostUrl}/uploads/appeals/${filename}`;

  let triage = null;
  try {
    const fileBuffer = await fs.readFile(path.join(UPLOAD_DIR, filename));
    triage = await analyzeVision({
      imageBase64: fileBuffer.toString("base64"),
      mimeType,
    });
  } catch (err) {
    console.warn("[appeal] photo triage skipped (ml-service unavailable)", err.message);
  }

  return { imageUrl, triage };
}

export async function getUserAppeals(userId) {
  const appeals = await findAppealsByUserId(userId);
  return appeals.map(toPublicAppeal);
}

export async function getUserAppealById({ appealId, userId, role }) {
  const appeal = await findAppealById(appealId);
  if (!appeal) {
    throw ApiError.notFound("Appeal not found");
  }

  if (role !== "admin" && appeal.user.toString() !== userId) {
    throw ApiError.notFound("Appeal not found");
  }

  return toPublicAppeal(appeal);
}

// Admin: paginated list of every citizen's appeals with optional status/category filters.
export async function getAllAppeals({ status, category, page = 1, limit = 20 }) {
  const filter = {};
  if (status) filter.status = status;
  if (category) filter.category = category;

  const skip = (page - 1) * limit;
  const [appeals, total] = await Promise.all([
    findAppeals({ filter, skip, limit }),
    countAppeals(filter),
  ]);

  return {
    items: appeals.map(toPublicAppeal),
    total,
    page,
    limit,
  };
}

// Admin: set the status and/or the citizen-facing response on an appeal.
export async function respondToAppeal({ appealId, status, response }) {
  const updates = {};
  if (status !== undefined) updates.status = status;
  if (response !== undefined) updates.response = response;

  const appeal = await updateAppealById(appealId, updates);
  if (!appeal) {
    throw ApiError.notFound("Appeal not found");
  }

  return toPublicAppeal(appeal);
}

export default {
  createUserAppeal,
  getUserAppeals,
  getUserAppealById,
  getAllAppeals,
  respondToAppeal,
};
