import Joi from "joi";

const cityHotlineSchema = Joi.alternatives().try(
  Joi.string().valid(""),
  Joi.string().trim().min(1).max(64),
);

export const updatePublicSettingsSchema = Joi.object({
  cityHotline: cityHotlineSchema,
})
  .min(1)
  .unknown(false);

export default {
  updatePublicSettingsSchema,
};
