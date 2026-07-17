import Joi from "joi";

export const updatePublicSettingsSchema = Joi.object({
  cityHotline: Joi.string().trim().min(1).max(64),
})
  .min(1)
  .unknown(false);

export default {
  updatePublicSettingsSchema,
};
