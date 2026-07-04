import { ApiError } from "../../shared/ApiError.js";
import {
  createAppeal,
  findAppealById,
  findAppealsByUserId,
} from "./appeal.repository.js";
import { toPublicAppeal } from "./appeal.model.js";

export async function createUserAppeal({
  userId,
  imageUrl,
  description,
  address,
}) {
  const appeal = await createAppeal({
    userId,
    imageUrl,
    description,
    address,
  });

  return toPublicAppeal(appeal);
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
