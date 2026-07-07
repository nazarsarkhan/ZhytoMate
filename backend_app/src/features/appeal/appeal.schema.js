import Joi from "joi";
import {
  APPEAL_CATEGORIES,
  APPEAL_DESCRIPTION_MAX_LENGTH,
  APPEAL_DESCRIPTION_MIN_LENGTH,
  APPEAL_ADDRESS_MAX_LENGTH,
  APPEAL_ADDRESS_MIN_LENGTH,
} from "./appeal.model.js";

export const createAppealSchema = Joi.object({
  imageUrl: Joi.string().trim().uri().max(2048).required(),
  category: Joi.string().valid(...APPEAL_CATEGORIES).required(),
  description: Joi.string().trim().min(APPEAL_DESCRIPTION_MIN_LENGTH).max(APPEAL_DESCRIPTION_MAX_LENGTH).required(),
  address: Joi.string().trim().min(APPEAL_ADDRESS_MIN_LENGTH).max(APPEAL_ADDRESS_MAX_LENGTH).required(),
});

export const appealIdParamsSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

export default {
  createAppealSchema,
  appealIdParamsSchema,
};
