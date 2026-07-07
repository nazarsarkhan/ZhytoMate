import Joi from "joi";
import { APPEAL_CATEGORIES, APPEAL_STATUSES } from "./appeal.model.js";

export const createAppealSchema = Joi.object({
  imageUrl: Joi.string().trim().uri().max(2048).required(),
  category: Joi.string().valid(...APPEAL_CATEGORIES).required(),
  description: Joi.string().trim().min(5).max(2000).required(),
  address: Joi.string().trim().min(3).max(256).required(),
});

export const appealIdParamsSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

// Admin list filters (?status=&category=&page=&limit=).
export const listAppealsQuerySchema = Joi.object({
  status: Joi.string().valid(...APPEAL_STATUSES).optional(),
  category: Joi.string().valid(...APPEAL_CATEGORIES).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

// Admin update: set status and/or the citizen-facing response (at least one required).
export const updateAppealSchema = Joi.object({
  status: Joi.string().valid(...APPEAL_STATUSES).optional(),
  response: Joi.string().trim().max(2000).allow("").optional(),
}).min(1);

export default {
  createAppealSchema,
  appealIdParamsSchema,
  listAppealsQuerySchema,
  updateAppealSchema,
};
