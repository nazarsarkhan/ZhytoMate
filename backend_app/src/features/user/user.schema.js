import Joi from "joi";

export const updateNameSchema = Joi.object({
  firstName: Joi.string().trim().min(1).max(64).required(),
  lastName: Joi.string().trim().min(1).max(64).required(),
});

export default {
  updateNameSchema,
};
