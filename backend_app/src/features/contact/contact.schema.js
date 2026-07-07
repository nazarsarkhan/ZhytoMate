import Joi from "joi";
import { CONTACT_KINDS } from "./contact.model.js";

export const createContactSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).required(),
  phone: Joi.string().trim().min(1).max(64).required(),
  icon: Joi.string().trim().max(64).allow("").default("call"),
  group: Joi.string().trim().max(120).allow("").default(""),
  kind: Joi.string()
    .valid(...CONTACT_KINDS)
    .default("utility"),
  order: Joi.number().integer().min(0).default(0),
  isActive: Joi.boolean().default(true),
});

// Every field optional, at least one required.
export const updateContactSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120),
  phone: Joi.string().trim().min(1).max(64),
  icon: Joi.string().trim().max(64).allow(""),
  group: Joi.string().trim().max(120).allow(""),
  kind: Joi.string().valid(...CONTACT_KINDS),
  order: Joi.number().integer().min(0),
  isActive: Joi.boolean(),
}).min(1);

export const contactIdParamsSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

export default {
  createContactSchema,
  updateContactSchema,
  contactIdParamsSchema,
};
