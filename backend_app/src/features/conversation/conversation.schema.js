import Joi from "joi";

export const conversationIdParamsSchema = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

export default {
  conversationIdParamsSchema,
};
