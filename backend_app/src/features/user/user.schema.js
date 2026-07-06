import Joi from "joi";

export const updateNameSchema = Joi.object({
  firstName: Joi.string().trim().min(1).max(64).required(),
  lastName: Joi.string().trim().min(1).max(64).required(),
  phone: Joi.string().trim().max(32).allow("").optional(),
});

export const updateAddressSchema = Joi.object({
  street: Joi.string().trim().max(160).allow("").optional(),
  building: Joi.string().trim().max(64).allow("").optional(),
  district: Joi.string().trim().max(120).allow("").optional(),
  city: Joi.string().trim().max(120).allow("").optional(),
});

export default {
  updateNameSchema,
  updateAddressSchema,
};
