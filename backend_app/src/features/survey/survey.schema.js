import Joi from "joi";

const objectId = Joi.string().hex().length(24);

export const createSurveySchema = Joi.object({
  title: Joi.string().trim().min(3).max(160).required(),
  description: Joi.string().trim().max(1000).allow("").default(""),
  category: Joi.string().trim().max(64).allow("").default(""),
  options: Joi.array()
    .items(Joi.string().trim().min(1).max(160).required())
    .min(2)
    .max(20)
    .required(),
  startsAt: Joi.date().iso().allow(null).default(null),
  endsAt: Joi.date().iso().allow(null).default(null),
  isActive: Joi.boolean().default(true),
});

// Admin update: every field optional, but at least one must be present. `options` (array of
// labels) is only honored server-side while the survey has no votes.
export const updateSurveySchema = Joi.object({
  title: Joi.string().trim().min(3).max(160),
  description: Joi.string().trim().max(1000).allow(""),
  category: Joi.string().trim().max(64).allow(""),
  options: Joi.array()
    .items(Joi.string().trim().min(1).max(160).required())
    .min(2)
    .max(20),
  startsAt: Joi.date().iso().allow(null),
  endsAt: Joi.date().iso().allow(null),
  isActive: Joi.boolean(),
}).min(1);

export const surveyIdParamsSchema = Joi.object({
  id: objectId.required(),
});

export const voteSurveySchema = Joi.object({
  optionId: objectId.required(),
});

export default {
  createSurveySchema,
  updateSurveySchema,
  surveyIdParamsSchema,
  voteSurveySchema,
};
