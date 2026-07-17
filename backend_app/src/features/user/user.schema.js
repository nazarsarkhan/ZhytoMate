import Joi from "joi";

export const adminUsersQuerySchema = Joi.object({
  q: Joi.string().trim().min(1).max(160).optional(),
  role: Joi.string().valid("user", "admin").optional(),
  isActive: Joi.boolean().optional(),
});

export const adminUserIdParamsSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

export const adminUserUpdateSchema = Joi.object({
  username: Joi.string().trim().min(3).max(32),
  firstName: Joi.string().trim().min(1).max(64),
  lastName: Joi.string().trim().min(1).max(64),
  email: Joi.string().trim().lowercase().email(),
  phone: Joi.string().trim().max(32).allow(""),
  role: Joi.string().valid("user", "admin"),
  isActive: Joi.boolean(),
}).min(1);

export const updateNameSchema = Joi.object({
  firstName: Joi.string().trim().min(1).max(64).required(),
  lastName: Joi.string().trim().min(1).max(64).required(),
  phone: Joi.string().trim().max(32).allow("").optional(),
});

export const updateAddressSchema = Joi.object({
  query: Joi.string().trim().min(3).max(300).required(),
  suggestionId: Joi.string().trim().max(300).allow("").optional(),
  street: Joi.string().trim().max(160).allow("").optional(),
  building: Joi.string().trim().max(64).allow("").optional(),
  neighborhood: Joi.string().trim().max(160).allow("").optional(),
  district: Joi.string().trim().max(120).allow("").optional(),
  city: Joi.string().trim().max(120).allow("").optional(),
});

export const addressSuggestionsQuerySchema = Joi.object({
  q: Joi.string().trim().min(3).max(160).required(),
});

export const addressReverseQuerySchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lon: Joi.number().min(-180).max(180).required(),
});

export const updatePreferencesSchema = Joi.object({
  utilityAlerts: Joi.boolean().required(),
  cityNews: Joi.boolean().required(),
});

export default {
  adminUsersQuerySchema,
  adminUserIdParamsSchema,
  adminUserUpdateSchema,
  updateNameSchema,
  updateAddressSchema,
  addressSuggestionsQuerySchema,
  addressReverseQuerySchema,
  updatePreferencesSchema,
};
