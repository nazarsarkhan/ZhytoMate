import Joi from "joi";

const FEEDBACK_REASONS = [
  "incorrect_answer",
  "missing_information",
  "outdated_information",
  "poor_sources",
  "unclear_answer",
];

export const assistantFeedbackSchema = Joi.object({
  messageId: Joi.string().hex().length(24).required(),
  conversationId: Joi.string().hex().length(24).allow(null, "").optional(),
  vote: Joi.string().valid("up", "down").required(),
  reason: Joi.string().valid(...FEEDBACK_REASONS).allow(null, "").optional(),
  userQuery: Joi.string().trim().max(1000).allow("").optional(),
  answer: Joi.string().trim().max(12000).allow("").optional(),
  answerStatus: Joi.string().trim().max(40).allow("").optional(),
  verified: Joi.boolean().optional(),
  sourcesUsed: Joi.array().items(Joi.string().trim().max(500)).max(20).default([]),
  appLinks: Joi.array().items(
    Joi.object({
      capability: Joi.string().trim().max(80).allow(""),
      label: Joi.string().trim().max(120).allow(""),
      route: Joi.string().trim().max(200).allow(""),
      reason: Joi.string().trim().max(240).allow(""),
    }).unknown(false),
  ).max(10).default([]),
}).custom((value, helpers) => {
  if (value.vote === "up" && value.reason) {
    return helpers.error("any.invalid");
  }
  return value;
}, "vote reason relationship");

export { FEEDBACK_REASONS };

export default assistantFeedbackSchema;
