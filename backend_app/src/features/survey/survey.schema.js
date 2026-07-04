import Joi from "joi";

const objectId = Joi.string().hex().length(24);

export const createSurveySchema = Joi.object({
  title: Joi.string().trim().min(3).max(160).required(),
  description: Joi.string().trim().max(1000).allow("").default(""),
  options: Joi.array()
    .items(Joi.string().trim().min(1).max(160).required())
    .min(2)
    .max(20)
    .required(),
  startsAt: Joi.date().iso().allow(null).default(null),
  endsAt: Joi.date().iso().allow(null).default(null),
  isActive: Joi.boolean().default(true),
});

export const surveyIdParamsSchema = Joi.object({
  id: objectId.required(),
});

export const voteSurveySchema = Joi.object({
  optionId: objectId.required(),
});

export default {
  createSurveySchema,
  surveyIdParamsSchema,
  voteSurveySchema,
};
