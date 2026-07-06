import Joi from "joi";
import { APPEAL_CATEGORIES } from "./appeal.model.js";

export const createAppealSchema = Joi.object({
  imageUrl: Joi.string().trim().uri().max(2048).required(),
  category: Joi.string().valid(...APPEAL_CATEGORIES).required(),
  description: Joi.string().trim().min(5).max(2000).required(),
  address: Joi.string().trim().min(3).max(256).required(),
});

export const appealIdParamsSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

export default {
  createAppealSchema,
  appealIdParamsSchema,
};
