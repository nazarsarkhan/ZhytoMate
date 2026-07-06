import fs from "node:fs/promises";
import path from "node:path";
import { ApiError } from "../../shared/ApiError.js";
import { analyzeVision } from "../../shared/mlClient.js";
import {
  createAppeal,
  findAppealById,
  findAppealsByUserId,
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
  const fileBuffer = await fs.readFile(path.join(UPLOAD_DIR, filename));
  const triage = await analyzeVision({
    imageBase64: fileBuffer.toString("base64"),
    mimeType,
  });

  return {
    imageUrl: `${hostUrl}/uploads/appeals/${filename}`,
    triage,
  };
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

export default {
  createUserAppeal,
  getUserAppeals,
  getUserAppealById,
};
