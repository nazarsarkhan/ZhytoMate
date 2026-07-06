import Joi from "joi";

export const assistantQuerySchema = Joi.object({
  userQuery: Joi.string().trim().min(1).max(1000).required(),
  district: Joi.string().trim().allow(null, "").optional(),
  // Continues an existing conversation when supplied; a missing, stale, or foreign id just
  // starts a new one instead of failing the request (see conversation.service.recordExchange).
  conversationId: Joi.string().hex().length(24).allow(null, "").optional(),
});

export default {
  assistantQuerySchema,
};
